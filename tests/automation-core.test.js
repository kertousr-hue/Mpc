const test=require('node:test');
const assert=require('node:assert/strict');
const a=require('../automation-core.js');
test('normalizeLocks keeps only supported bounded parameters',()=>{
  assert.deepEqual(a.normalizeLocks({gain:2,pan:-4,pitch:50,cutoff:-1,sendA:2,sendB:.4,hack:99}),{gain:1.5,pan:-1,pitch:24,cutoff:0,sendA:1,sendB:.4});
});
test('recordPoint coalesces near duplicate positions and bounds lane length',()=>{
  let lane=[];lane=a.recordPoint(lane,.1,.2);lane=a.recordPoint(lane,.1005,.8);assert.equal(lane.length,1);assert.equal(lane[0].value,.8);for(let i=0;i<600;i++)lane=a.recordPoint(lane,i/600,i);assert.ok(lane.length<=512);
});
test('sampleLane interpolates between automation points and wraps position',()=>{
  const lane=[{position:0,value:0},{position:.5,value:1},{position:1,value:0}];assert.equal(a.sampleLane(lane,.25),.5);assert.equal(a.sampleLane(lane,1.25),.5);
});
