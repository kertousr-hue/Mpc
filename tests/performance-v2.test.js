const test=require('node:test');
const assert=require('node:assert/strict');
const perf=require('../performance-v2.js');

test('expandFlam returns main hit plus a bounded delayed hit',()=>{
  const hits=perf.expandFlam({time:1,velocity:.8,pitch:2},.25,.5);
  assert.equal(hits.length,2);
  assert.equal(hits[0].time,1);
  assert.ok(hits[1].time>1 && hits[1].time<1.25);
  assert.ok(hits[1].velocity<hits[0].velocity);
});

test('repeatInterval maps supported note repeat divisions',()=>{
  assert.equal(perf.repeatInterval(120,'1/8'),.25);
  assert.equal(perf.repeatInterval(120,'1/16'),.125);
  assert.equal(perf.repeatInterval(120,'1/32'),.0625);
});

test('accentVelocity raises velocity but clamps to 1',()=>{
  assert.equal(perf.accentVelocity(.5,1.2),.6);
  assert.equal(perf.accentVelocity(.95,1.2),1);
});

test('stutterEvents stays bounded in one window',()=>{
  const hits=perf.stutterEvents({startTime:2,duration:.5,interval:.05,velocity:.7,maxEvents:8});
  assert.equal(hits.length,8);
  assert.ok(hits.every(h=>h.time>=2 && h.time<2.5));
});
