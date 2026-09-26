const test=require('node:test');
const assert=require('node:assert/strict');
const v2=require('../sequencer-v2.js');

test('createSession migrates legacy patterns and keeps all pad tracks',()=>{
  const legacy=[{A01:[true,...Array(15).fill(false)]}];
  const s=v2.createSession({patterns:legacy,padIds:['A01','A02']});
  assert.equal(s.patterns[0].bars,1);
  assert.equal(s.patterns[0].tracks.A01[0].on,true);
  assert.equal(s.patterns[0].tracks.A02.length,16);
});

test('setBars grows current pattern without losing existing events',()=>{
  const s=v2.createSession({patterns:[],padIds:['A01']});
  v2.toggleStep(s,0,'A01',3);
  v2.setBars(s,0,4);
  assert.equal(s.patterns[0].bars,4);
  assert.equal(s.patterns[0].tracks.A01.length,64);
  assert.equal(s.patterns[0].tracks.A01[3].on,true);
});

test('setStepValues clamps rich step data',()=>{
  const s=v2.createSession({patterns:[],padIds:['A01']});
  v2.setStepValues(s,0,'A01',0,{velocity:2,probability:-1,micro:.9,pitch:99,ratchet:9,accent:true});
  const step=s.patterns[0].tracks.A01[0];
  assert.equal(step.velocity,1);
  assert.equal(step.probability,0);
  assert.equal(step.micro,.49);
  assert.equal(step.pitch,24);
  assert.equal(step.ratchet,8);
  assert.equal(step.accent,true);
});

test('serializeSession deep clones patterns and explicit song arrangement',()=>{
  const s=v2.createSession({patterns:[],padIds:['A01']});
  s.songArrangement=[{patternIndex:0,repeats:2,mutes:{A01:false}}];
  const out=v2.serializeSession(s);
  assert.equal(out.version,7);
  assert.deepEqual(out.songArrangement,s.songArrangement);
  out.patterns[0].tracks.A01[0].on=true;
  assert.equal(s.patterns[0].tracks.A01[0].on,false);
});

test('formatBarLabel uses human friendly bar numbering',()=>{
  assert.equal(v2.formatBarLabel(0,4),'Mesure 1/4');
  assert.equal(v2.formatBarLabel(3,4),'Mesure 4/4');
});
