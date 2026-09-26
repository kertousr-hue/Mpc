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
