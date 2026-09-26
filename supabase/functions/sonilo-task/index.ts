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

function safeAudio(value: any) {
  if (!value || typeof value !== 'object') return null
  const url = String(value.url || '')
  if (!url.startsWith('https://')) return null
  return { url, contentType: String(value.content_type || ''), fileSize: Number(value.file_size) || 0 }
}

function normalizeTask(data: any) {
  let audio = null
  if (Array.isArray(data?.audio)) {
    for (const item of data.audio) { audio = safeAudio(item); if (audio) break }
  } else audio = safeAudio(data?.audio)
  return {
    taskId: String(data?.task_id || ''),
    type: String(data?.type || ''),
    status: String(data?.status || 'processing'),
    audio,
    error: data?.error ? String(data.error?.message || data.error) : null,
    retryAfter: null,
  }
}

function upstreamError(status: number, retryAfter: string | null) {
  const code = status === 401 ? 'auth_invalid'
    : status === 402 ? 'insufficient_balance'
    : status === 403 ? 'forbidden'
    : status === 404 ? 'not_found'
    : status === 429 ? 'rate_limited'
    : 'upstream_error'
  return { code, status, retryAfter: status === 429 ? Number(retryAfter) || null : null }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: { code: 'method_not_allowed' } }, 405)
  if (!req.headers.get('Authorization')) return json({ error: { code: 'auth_required' } }, 401)

  let body: any
  try { body = await req.json() } catch (_) { return json({ error: { code: 'invalid_request' } }, 400) }
  const taskId = String(body?.taskId || '')
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/.test(taskId)) return json({ error: { code: 'invalid_task_id' } }, 400)

  const apiKey = Deno.env.get('SONILO_API_KEY')
  if (!apiKey) return json({ error: { code: 'sonilo_not_configured' } }, 503)

  let upstream: Response
  try {
    upstream = await fetch(`${SONILO_BASE}/tasks/${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${apiKey}`, 'User-Agent': 'MPC-Studio/2' },
    })
  } catch (_) {
    return json({ error: { code: 'upstream_unreachable' } }, 502)
  }

  if (!upstream.ok) {
    const error = upstreamError(upstream.status, upstream.headers.get('Retry-After'))
    return json({ error }, upstream.status === 404 ? 404 : upstream.status === 429 ? 429 : 502, error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {})
  }

  let data: any
  try { data = await upstream.json() } catch (_) { return json({ error: { code: 'invalid_upstream_response' } }, 502) }
  return json(normalizeTask(data))
})
