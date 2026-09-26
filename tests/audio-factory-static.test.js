const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('app.js','utf8');

test('factory noise is cached per audio context with deterministic data',()=>{
  assert.match(app,/const\s+noiseBuffers\s*=\s*new WeakMap\(\)/);
  assert.match(app,/function\s+getNoiseBuffer\s*\(ac\)/);
  assert.match(app,/noiseBuffers\.get\(ac\)/);
  assert.match(app,/noiseBuffers\.set\(ac\s*,\s*b\)/);
  assert.doesNotMatch(app,/function\s+getNoiseBuffer[\s\S]{0,1200}Math\.random\(/);
});

test('noiseHit reuses getNoiseBuffer instead of allocating a new noise buffer',()=>{
  const m=app.match(/function\s+noiseHit\s*\([^)]*\)\{([\s\S]*?)\n\}/);
  assert.ok(m,'noiseHit must exist');
  assert.match(m[1],/getNoiseBuffer\(ac\)/);
  assert.doesNotMatch(m[1],/createNoise\(/);
});
