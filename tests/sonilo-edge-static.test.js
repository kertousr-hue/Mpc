const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
function read(p){return fs.readFileSync(path.join(root,p),'utf8')}

test('Sonilo edge functions read secret from environment and never hardcode sk keys',()=>{
  const gen=read('supabase/functions/sonilo-generate/index.ts');
  const task=read('supabase/functions/sonilo-task/index.ts');
  assert.match(gen,/Deno\.env\.get\(['"]SONILO_API_KEY['"]\)/);
  assert.match(task,/Deno\.env\.get\(['"]SONILO_API_KEY['"]\)/);
  assert.doesNotMatch(gen,/[\"'`]sk[-_][A-Za-z0-9]{8,}/);
  assert.doesNotMatch(task,/[\"'`]sk[-_][A-Za-z0-9]{8,}/);
});

test('Sonilo edge functions use only canonical runtime host',()=>{
  const src=read('supabase/functions/sonilo-generate/index.ts')+'\n'+read('supabase/functions/sonilo-task/index.ts');
  assert.match(src,/https:\/\/api\.sonilo\.com\/v1/);
  assert.match(src,/text-to-music/);
  assert.match(src,/text-to-sfx/);
  assert.match(src,/tasks\//);
  assert.doesNotMatch(src,/platform\.sonilo\.com/);
});


test('Sonilo generate reserves a server-side quota before upstream generation',()=>{
  const gen=read('supabase/functions/sonilo-generate/index.ts');
  assert.match(gen,/reserve_sonilo_generation/);
  assert.match(gen,/rate_guard_unavailable/);
  assert.match(gen,/rate_limited/);
  assert.match(gen,/SUPABASE_ANON_KEY|SUPABASE_PUBLISHABLE_KEYS/);
});


test('Sonilo schema exposes ownership reads but keeps task/quota mutations server-only',()=>{
  const schema=read('supabase-schema.sql');
  assert.match(schema,/create table if not exists public\.sonilo_tasks/i);
  assert.match(schema,/alter table public\.sonilo_tasks enable row level security/i);
  assert.match(schema,/sonilo_tasks_select_own/);
  assert.doesNotMatch(schema,/create policy "sonilo_tasks_insert_own"/i);
  assert.match(schema,/grant select on public\.sonilo_tasks to authenticated/i);
  assert.match(schema,/revoke insert, update, delete on public\.sonilo_tasks from authenticated/i);
  assert.doesNotMatch(schema,/create policy "sonilo_generation_delete_own"/i);
  assert.match(schema,/revoke delete on public\.sonilo_generation_log from authenticated/i);
  assert.match(schema,/reservationId/);
  assert.match(schema,/drop function if exists public\.record_sonilo_task/i);
  assert.match(schema,/auth\.uid\(\)/);
  assert.match(schema,/security invoker/i);
});

test('Sonilo generate rolls back failures and records ownership with server credentials',()=>{
  const gen=read('supabase/functions/sonilo-generate/index.ts');
  assert.match(gen,/reservationId/);
  assert.match(gen,/rollback/);
  assert.match(gen,/recordTask/);
  assert.match(gen,/SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(gen,/sonilo_generation_log/);
  assert.match(gen,/sonilo_tasks/);
});

test('Sonilo task checks ownership before calling upstream',()=>{
  const task=read('supabase/functions/sonilo-task/index.ts');
  assert.match(task,/ownsTask/);
  assert.match(task,/sonilo_tasks/);
  assert.match(task,/task_not_found/);
  assert.ok(task.indexOf('ownsTask') < task.indexOf('tasks/'));
});


test('authenticated clients cannot erase quota rows or forge task ownership',()=>{
  const schema=read('supabase-schema.sql');
  const gen=read('supabase/functions/sonilo-generate/index.ts');
  assert.doesNotMatch(schema,/grant\s+select,\s*insert,\s*delete\s+on\s+public\.sonilo_generation_log\s+to\s+authenticated/i);
  assert.doesNotMatch(schema,/create policy "sonilo_generation_delete_own"/i);
  assert.doesNotMatch(schema,/grant\s+select,\s*insert\s+on\s+public\.sonilo_tasks\s+to\s+authenticated/i);
  assert.match(schema,/grant\s+select\s+on\s+public\.sonilo_tasks\s+to\s+authenticated/i);
  assert.match(gen,/SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(gen,/\/auth\/v1\/user/);
});


test('Sonilo generate does not require service role for ownership or rollback',()=>{
  const schema=read('supabase-schema.sql');
  const gen=read('supabase/functions/sonilo-generate/index.ts');
  assert.match(schema,/record_sonilo_task/);
  assert.match(schema,/release_sonilo_generation/);
  assert.match(gen,/rpc\/record_sonilo_task/);
  assert.match(gen,/rpc\/release_sonilo_generation/);
  assert.doesNotMatch(gen,/SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(gen,/auth\/v1\/user/);
});
