const test=require('node:test');
const assert=require('node:assert/strict');
const midi=require('../midi-core.js');
const seq=require('../sequencer-core.js');

function text(bytes,a,b){return Buffer.from(bytes.slice(a,b)).toString('ascii')}

test('padToMidi maps 64 pads into stable note range',()=>{
  assert.equal(midi.padToMidi('A01'),36);
  assert.equal(midi.padToMidi('A16'),51);
  assert.equal(midi.padToMidi('D16'),99);
});

test('encodePattern creates valid standard midi file header and track',()=>{
  const p=seq.createPattern({padIds:['A01'],bars:1});
  p.tracks.A01[0]=seq.normalizeStep({on:true,velocity:.75,ratchet:2,pitch:2});
  const bytes=midi.encodePattern({pattern:p,bpm:120});
  assert.equal(text(bytes,0,4),'MThd');
  assert.equal(text(bytes,14,18),'MTrk');
  assert.ok(bytes.length>30);
});

test('encodePattern returns valid midi for empty pattern',()=>{
  const p=seq.createPattern({padIds:['A01'],bars:1});
  const bytes=midi.encodePattern({pattern:p,bpm:92});
  assert.equal(text(bytes,0,4),'MThd');
  assert.equal(text(bytes,14,18),'MTrk');
  assert.ok(bytes.includes(0x2f));
});

test('varLen encodes midi variable length quantities',()=>{
  assert.deepEqual(midi.varLen(0),[0]);
  assert.deepEqual(midi.varLen(127),[127]);
  assert.deepEqual(midi.varLen(128),[129,0]);
});

test('encodeSong concatenates arranged patterns',()=>{
  const a=seq.createPattern({padIds:['A01'],bars:1});a.tracks.A01[0]=seq.normalizeStep({on:true});
  const b=seq.createPattern({padIds:['A01'],bars:2});b.tracks.A01[16]=seq.normalizeStep({on:true});
  const bytes=midi.encodeSong({patterns:[a,b],arrangement:[{patternIndex:0,repeats:2},{patternIndex:1,repeats:1}],bpm:100});
  assert.equal(text(bytes,0,4),'MThd');
  assert.equal(text(bytes,14,18),'MTrk');
  assert.ok(bytes.length>40);
});
