const SONILO_BASE = 'https://api.sonilo.com/v1'
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, ...extra } })
}

function normalizeRequest(value: any) {
  const type = String(value?.type || '').toLowerCase()
  if (type !== 'music' && type !== 'sfx') throw new Error('invalid_type')
  const prompt = String(value?.prompt || '').trim()
  if (!prompt || prompt.length > 2000) throw new Error('invalid_prompt')
  let duration = Number(value?.duration)
  const format = String(value?.format || (type === 'music' ? 'm4a' : 'aac')).toLowerCase()
  if (!Number.isFinite(duration)) duration = type === 'music' ? 30 : 8
  if (type === 'music') {
    if (duration < 5 || duration > 360) throw new Error('invalid_duration')
    if (!['m4a', 'wav', 'mp3'].includes(format)) throw new Error('invalid_format')
  } else {
    if (duration < 0.5 || duration > 180) throw new Error('invalid_duration')
    if (!['wav', 'mp3', 'aac', 'flac'].includes(format)) throw new Error('invalid_format')
  }
  return { type, prompt, duration, format } as { type: 'music' | 'sfx'; prompt: string; duration: number; format: string }
}

function upstreamError(status: number, retryAfter: string | null) {
  const code = status === 401 ? 'auth_invalid'
    : status === 402 ? 'insufficient_balance'
    : status === 403 ? 'forbidden'
    : status === 422 ? 'invalid_request'
    : status === 429 ? 'rate_limited'
    : 'upstream_error'
  return { code, status, retryAfter: status === 429 ? Number(retryAfter) || null : null }
}

function projectPublishableKey() {
  const legacy = Deno.env.get('SUPABASE_ANON_KEY')
  if (legacy) return legacy
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}')
    return String(keys.default || '')
  } catch (_) {
    return ''
  }
}

function databaseContext(req: Request) {
  return {
    url: Deno.env.get('SUPABASE_URL') || '',
    apikey: projectPublishableKey(),
    authorization: req.headers.get('Authorization') || '',
  }
}

async function reserveQuota(req: Request, kind: 'music' | 'sfx') {
  const ctx = databaseContext(req)
  if (!ctx.url || !ctx.apikey || !ctx.authorization) return { allowed: false, code: 'rate_guard_unavailable' }

  try {
    const response = await fetch(`${ctx.url}/rest/v1/rpc/reserve_sonilo_generation`, {
      method: 'POST',
      headers: {
        Authorization: ctx.authorization,
        apikey: ctx.apikey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_kind: kind }),
    })
    if (!response.ok) return { allowed: false, code: 'rate_guard_unavailable' }
    return await response.json()
  } catch (_) {
    return { allowed: false, code: 'rate_guard_unavailable' }
  }
}

function serviceRoleKey() {
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
}

async function authenticatedUserId(req: Request) {
  const url = Deno.env.get('SUPABASE_URL') || ''
  const apikey = projectPublishableKey()
  const authorization = req.headers.get('Authorization') || ''
  if (!url || !apikey || !authorization) return null
  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: authorization, apikey },
    })
    if (!response.ok) return null
    const user = await response.json()
    const id = String(user?.id || '')
    return /^[0-9a-fA-F-]{36}$/.test(id) ? id : null
  } catch (_) {
    return null
  }
}

async function rollback(reservationId: number) {
  const url = Deno.env.get('SUPABASE_URL') || ''
  const serviceRole = serviceRoleKey()
  if (!url || !serviceRole || !Number.isFinite(reservationId) || reservationId <= 0) return false
  try {
    const response = await fetch(`${url}/rest/v1/sonilo_generation_log?id=eq.${encodeURIComponent(String(reservationId))}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${serviceRole}`, apikey: serviceRole },
    })
    return response.ok
  } catch (_) {
    return false
  }
}

async function recordTask(taskId: string, kind: 'music' | 'sfx', userId: string) {
  const url = Deno.env.get('SUPABASE_URL') || ''
  const serviceRole = serviceRoleKey()
  if (!url || !serviceRole || !userId) return false
  try {
    const response = await fetch(`${url}/rest/v1/sonilo_tasks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRole}`,
        apikey: serviceRole,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ task_id: taskId, user_id: userId, kind }),
    })
    return response.ok
  } catch (_) {
    return false
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: { code: 'method_not_allowed' } }, 405)
  if (!req.headers.get('Authorization')) return json({ error: { code: 'auth_required' } }, 401)

  let input: ReturnType<typeof normalizeRequest>
  try {
    input = normalizeRequest(await req.json())
  } catch (error) {
    return json({ error: { code: String((error as Error).message || 'invalid_request') } }, 400)
  }

  const apiKey = Deno.env.get('SONILO_API_KEY') || Deno.env.get('Sonilo-api-key')
  if (!apiKey) return json({ error: { code: 'sonilo_not_configured' } }, 503)
  if (!serviceRoleKey()) return json({ error: { code: 'task_guard_unavailable' } }, 503)

  const userId = await authenticatedUserId(req)
  if (!userId) return json({ error: { code: 'task_guard_unavailable' } }, 503)

  const quota = await reserveQuota(req, input.type)
  if (!quota?.allowed) {
    const code = String(quota?.code || 'rate_guard_unavailable')
    const retryAfter = Number(quota?.retryAfter) || null
    return json({ error: { code, retryAfter } }, code === 'rate_limited' ? 429 : 503, retryAfter ? { 'Retry-After': String(retryAfter) } : {})
  }

  const reservationId = Number(quota?.reservationId)
  if (!Number.isFinite(reservationId) || reservationId <= 0) {
    return json({ error: { code: 'rate_guard_unavailable' } }, 503)
  }

  const form = new FormData()
  form.set('prompt', input.prompt)
  form.set('duration', String(input.duration))
  let endpoint: string
  if (input.type === 'music') {
    endpoint = `${SONILO_BASE}/text-to-music`
    form.set('mode', 'async')
    form.set('output_format', input.format)
  } else {
    endpoint = `${SONILO_BASE}/text-to-sfx`
    form.set('audio_format', input.format)
  }

  let upstream: Response
  try {
    upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'User-Agent': 'MPC-Studio/2' },
      body: form,
    })
  } catch (_) {
    await rollback(reservationId)
    return json({ error: { code: 'upstream_unreachable' } }, 502)
  }

  if (!upstream.ok) {
    const error = upstreamError(upstream.status, upstream.headers.get('Retry-After'))
    await rollback(reservationId)
    return json({ error }, upstream.status === 429 ? 429 : 502, error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {})
  }

  let data: any
  try {
    data = await upstream.json()
  } catch (_) {
    await rollback(reservationId)
    return json({ error: { code: 'invalid_upstream_response' } }, 502)
  }

  const taskId = String(data?.task_id || '')
  if (!taskId) {
    await rollback(reservationId)
    return json({ error: { code: 'missing_task_id' } }, 502)
  }

  if (!await recordTask(taskId, input.type, userId)) {
    await rollback(reservationId)
    return json({ error: { code: 'task_guard_unavailable' } }, 503)
  }

  return json({ taskId, status: 'processing' }, 202)
})
