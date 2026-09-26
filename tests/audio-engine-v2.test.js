const test=require('node:test');
const assert=require('node:assert/strict');
const eng=require('../audio-engine-v2.js');
test('createTrackDescriptor is stable and normalized',()=>{
  const d=eng.createTrackDescriptor('A01',{pan:3,sendA:.5});
  assert.equal(d.id,'A01');assert.equal(d.state.pan,1);assert.equal(d.state.sendA,.5);assert.equal(d.nodes,null);
});
test('normalizeMixerMap keeps one descriptor per pad',()=>{
  const map=eng.normalizeMixerMap(['A01','A02'],{A01:{pan:-.4},junk:{pan:1}});
  assert.deepEqual(Object.keys(map),['A01','A02']);assert.equal(map.A01.pan,-.4);assert.equal(map.A02.pan,0);
});
test('resolveStepParams overlays locks without mutating base state',()=>{
  const base={pan:.2,cutoff:.8,sendA:.1,sendB:.2};
  const out=eng.resolveStepParams(base,{pan:-.5,sendA:.9,gain:.7});
  assert.deepEqual(out,{gain:.7,pan:-.5,cutoff:.8,sendA:.9,sendB:.2});
  assert.deepEqual(base,{pan:.2,cutoff:.8,sendA:.1,sendB:.2});
});
