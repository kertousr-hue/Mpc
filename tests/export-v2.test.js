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


test('parameterTimeline restores mixer values after step locks',()=>{
  const p=seq.createPattern({padIds:['A01'],bars:1});
  p.tracks.A01[0]=seq.normalizeStep({on:true,locks:{gain:.4,pan:-.7,cutoff:.1,sendA:.8,sendB:.6}});
  p.tracks.A01[1]=seq.normalizeStep({on:true});
  const mixer={pan:.25,cutoff:.75,sendA:.2,sendB:.3};
  const timeline=ex.parameterTimeline(p,120,'A01',mixer,0);
  const lock=timeline.find(e=>e.kind==='lock'&&e.stepIndex===0);
  const nextBase=timeline.find(e=>e.kind==='base'&&e.stepIndex===1);
  assert.deepEqual(lock.values,{gain:.4,pan:-.7,cutoff:.1,sendA:.8,sendB:.6});
  assert.deepEqual(nextBase.values,{gain:1,pan:.25,cutoff:.75,sendA:.2,sendB:.3});
  assert.equal(nextBase.time,.125);
});

test('stepBaseParams samples automation and falls back to mixer state',()=>{
  const p=seq.createPattern({padIds:['A01'],bars:1});
  p.automation={
    'A01:pan':[{position:0,value:-1},{position:.5,value:1}],
    'A01:gain':[{position:0,value:.5}]
  };
  assert.deepEqual(ex.stepBaseParams(p,'A01',4,{pan:.2,cutoff:.7,sendA:.1,sendB:.2}),{
    gain:.5,pan:0,cutoff:.7,sendA:.1,sendB:.2
  });
});

test('defaultSongArrangement excludes empty patterns and buildSongTimeline respects repeats',()=>{
  const p0=seq.createPattern({padIds:['A01'],bars:1});p0.tracks.A01[0].on=true;
  const p1=seq.createPattern({padIds:['A01'],bars:1});
  const p2=seq.createPattern({padIds:['A01'],bars:2});p2.tracks.A01[0].on=true;
  assert.deepEqual(ex.defaultSongArrangement([p0,p1,p2]),[
    {patternIndex:0,repeats:1},{patternIndex:2,repeats:1}
  ]);
  const auto=ex.buildSongTimeline({patterns:[p0,p1,p2]},120);
  assert.deepEqual(auto.segments.map(s=>[s.patternIndex,s.offsetSeconds,s.durationSeconds]),[
    [0,0,2],[2,2,4]
  ]);
  assert.equal(auto.totalDuration,6);
  const explicit=ex.buildSongTimeline({patterns:[p0,p1,p2],songArrangement:[{patternIndex:2,repeats:2},{patternIndex:0,repeats:1}]},120);
  assert.deepEqual(explicit.segments.map(s=>[s.patternIndex,s.offsetSeconds,s.durationSeconds]),[
    [2,0,4],[2,4,4],[0,8,2]
  ]);
  assert.equal(explicit.totalDuration,10);
});
