const test=require('node:test');
const assert=require('node:assert/strict');
const a=require('../automation.js');
test('lockToActions separates event pitch from mixer automation',()=>{
  const out=a.lockToActions({gain:.7,pan:-.4,pitch:5,cutoff:.6,sendA:.2,sendB:.8,other:99});
  assert.deepEqual(out,{event:{gain:.7,pitch:5},track:{pan:-.4,cutoff:.6,sendA:.2,sendB:.8}});
});


test('automationValuesAtStep returns base reset when no lanes exist',()=>{
  assert.deepEqual(a.automationValuesAtStep('A01',{bars:1,automation:{}},4),{});
});

test('automationValuesAtStep samples only existing lanes',()=>{
  const p={bars:1,automation:{'A01:pan':[{position:0,value:-1},{position:.5,value:1}]}};
  const vals=a.automationValuesAtStep('A01',p,4);
  assert.equal(vals.pan,0);
  assert.equal(vals.cutoff,undefined);
});
