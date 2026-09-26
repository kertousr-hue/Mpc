const test=require('node:test');
const assert=require('node:assert/strict');
const fx=require('../fx-rack.js');
test('divisionToSeconds follows BPM',()=>{
  assert.equal(fx.divisionToSeconds(120,'1/4'),.5);
  assert.equal(fx.divisionToSeconds(120,'1/8'),.25);
  assert.equal(fx.divisionToSeconds(60,'1/16'),.25);
  assert.ok(Math.abs(fx.divisionToSeconds(120,'1/8T')-(1/6))<1e-9);
});
test('normalizeState clamps rack controls',()=>{
  const s=fx.normalizeState({delayMix:2,delayFeedback:-1,reverbMix:5,distortion:4,bitcrush:-1,chorus:2,flanger:2,compressor:false,limiter:false,delayDivision:'bad'});
  assert.equal(s.delayMix,1);assert.equal(s.delayFeedback,0);assert.equal(s.reverbMix,1);assert.equal(s.distortion,1);assert.equal(s.bitcrush,0);assert.equal(s.chorus,1);assert.equal(s.flanger,1);assert.equal(s.compressor,false);assert.equal(s.limiter,false);assert.equal(s.delayDivision,'1/8');
});
