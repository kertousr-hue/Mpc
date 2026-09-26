const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('PWA shell precaches the raï factory module',()=>{
  const sw=fs.readFileSync('sw.js','utf8');
  assert.match(sw,/["']\.\/rai-factory\.js["']/);
});

test('app initial pattern is built from the raï beat definition',()=>{
  const app=fs.readFileSync('app.js','utf8');
  assert.match(app,/RAI_FACTORY\.createRaiBeat\(\)/);
  assert.doesNotMatch(app,/patterns\[0\]\.A01\[s\]=true/);
});

test('Groovebox V2 auto beat also uses the shared raï beat definition',()=>{
  const seq=fs.readFileSync('sequencer-v2.js','utf8');
  assert.match(seq,/MPCRaiFactory|RAI_FACTORY|createRaiBeat/);
});
