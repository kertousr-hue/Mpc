const test=require('node:test');
const assert=require('node:assert/strict');
const m=require('../mixer-core.js');

test('createMixerState returns neutral defaults',()=>{
  assert.deepEqual(m.createMixerState(),{pan:0,eqLow:0,eqMid:0,eqHigh:0,cutoff:1,resonance:0,sendA:0,sendB:0,muted:false,solo:false});
});
test('normalizeMixerState clamps all ranges',()=>{
  assert.deepEqual(m.normalizeMixerState({pan:9,eqLow:-99,eqMid:99,eqHigh:3,cutoff:2,resonance:50,sendA:-1,sendB:4,muted:1,solo:'x'}),{pan:1,eqLow:-12,eqMid:12,eqHigh:3,cutoff:1,resonance:20,sendA:0,sendB:1,muted:true,solo:true});
});
test('effectiveTrackGain respects mute and solo isolation',()=>{
  assert.equal(m.effectiveTrackGain({gain:.8,muted:false,soloed:false,anySolo:false}),.8);
  assert.equal(m.effectiveTrackGain({gain:.8,muted:true,soloed:true,anySolo:true}),0);
  assert.equal(m.effectiveTrackGain({gain:.8,muted:false,soloed:false,anySolo:true}),0);
  assert.equal(m.effectiveTrackGain({gain:.8,muted:false,soloed:true,anySolo:true}),.8);
});
