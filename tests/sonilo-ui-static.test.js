const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('Sonilo prompt example is raï-oriented and no longer techno-oriented',()=>{
  const src=fs.readFileSync('sonilo.js','utf8');
  assert.match(src,/placeholder="[^"]*raï[^"]*"/i);
  assert.doesNotMatch(src,/placeholder="[^"]*techno[^"]*"/i);
});
