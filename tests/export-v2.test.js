const test=require('node:test');
const assert=require('node:assert/strict');
const ex=require('../export-v2.js');
const seq=require('../sequencer-core.js');

test('patternDurationSeconds scales with bars and bpm',()=>{
  assert.equal(ex.patternDurationSeconds({bars:1},120),2);
  assert.equal(ex.patternDurationSeconds({bars:4},120),8);
  assert.equal(ex.patternDurationSeconds({bars:2},60),8);
});

test('safeFilename strips invalid filename characters',()=>{
  assert.equal(ex.safeFilename('A/B:C*D? E'),'A B C D E');
  assert.equal(ex.safeFilename('   '),'track');
});

test('audibleTrackIds respects mute and solo mixer state',()=>{
  const p=seq.createPattern({padIds:['A01','A02','A03'],bars:1});
  p.tracks.A01[0].on=true;p.tracks.A02[0].on=true;p.tracks.A03[0].on=true;
  assert.deepEqual(ex.audibleTrackIds(p,{A01:{muted:false,solo:false},A02:{muted:true,solo:false},A03:{muted:false,solo:false}}),['A01','A03']);
  assert.deepEqual(ex.audibleTrackIds(p,{A01:{muted:false,solo:false},A02:{muted:false,solo:true},A03:{muted:false,solo:false}}),['A02']);
});

test('eventSchedule expands ratchets and step pitch without duplicates',()=>{
  const p=seq.createPattern({padIds:['A01'],bars:1});
  p.tracks.A01[0]=seq.normalizeStep({on:true,ratchet:2,velocity:.7,pitch:3});
  const events=ex.eventSchedule(p,120,['A01']);
  assert.equal(events.length,2);
  assert.equal(events[0].padId,'A01');
  assert.equal(events[0].pitch,3);
  assert.ok(events[1].time>events[0].time);
});
