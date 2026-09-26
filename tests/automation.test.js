const test=require('node:test');
const assert=require('node:assert/strict');
const a=require('../automation.js');
test('lockToActions separates event pitch from mixer automation',()=>{
  const out=a.lockToActions({gain:.7,pan:-.4,pitch:5,cutoff:.6,sendA:.2,sendB:.8,other:99});
  assert.deepEqual(out,{event:{gain:.7,pitch:5},track:{pan:-.4,cutoff:.6,sendA:.2,sendB:.8}});
});
