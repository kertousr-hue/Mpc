const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('VST documentation recommends HTTPS LAN and session token',()=>{
  const doc=fs.readFileSync('VST_PC.md','utf8');
  assert.match(doc,/HTTPS LAN/i);
  assert.match(doc,/jeton de session/i);
  assert.match(doc,/MPC_VST_CERT/);
  assert.match(doc,/MPC_VST_KEY/);
  assert.match(doc,/MPC_VST_ALLOWED_ORIGINS/);
  assert.doesNotMatch(doc,/affiche un PIN|et le PIN/i);
});
