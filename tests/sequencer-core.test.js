const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../sequencer-core.js');

test('default step has v7 fields', () => {
  assert.deepEqual(core.createDefaultStep(true), {
    on: true,
    velocity: 1,
    probability: 1,
    micro: 0,
    pitch: 0,
    ratchet: 1,
    accent: false,
    locks: {}
  });
});

test('normalizeStep clamps malformed values', () => {
  assert.deepEqual(core.normalizeStep({
    on: 1, velocity: 4, probability: -2, micro: 2,
    pitch: -99, ratchet: 42, accent: 'yes', locks: { gain: 9 }
  }), {
    on: true,
    velocity: 1,
    probability: 0,
    micro: 0.49,
    pitch: -24,
    ratchet: 8,
    accent: true,
    locks: { gain: 9 }
  });
});

test('legacy boolean patterns migrate to one bar v7 patterns', () => {
  const legacy = [{ A01: [true, false, true, ...Array(13).fill(false)] }];
  const migrated = core.migrateLegacyPatterns(legacy);
  assert.equal(migrated[0].bars, 1);
  assert.equal(migrated[0].stepsPerBar, 16);
  assert.equal(migrated[0].tracks.A01.length, 16);
  assert.equal(migrated[0].tracks.A01[0].on, true);
  assert.equal(migrated[0].tracks.A01[1].on, false);
  assert.equal(migrated[0].tracks.A01[2].on, true);
});

test('resizePattern preserves existing steps and clamps bars 1..8', () => {
  const p = core.createPattern({ padIds: ['A01'], bars: 2 });
  p.tracks.A01[20] = core.normalizeStep({ on: true, velocity: .5 });
  const grown = core.resizePattern(p, 9);
  assert.equal(grown.bars, 8);
  assert.equal(grown.tracks.A01.length, 128);
  assert.equal(grown.tracks.A01[20].on, true);
  assert.equal(grown.tracks.A01[20].velocity, .5);
  const shrunk = core.resizePattern(grown, 1);
  assert.equal(shrunk.bars, 1);
  assert.equal(shrunk.tracks.A01.length, 16);
});


test('expandStepEvents applies swing then micro timing and stays inside safe window', () => {
  const events = core.expandStepEvents({
    step: {on:true, velocity:.8, micro:-.2, ratchet:1},
    stepIndex: 1,
    baseTime: 10,
    stepDuration: .25,
    swing: .5,
    swingLane: 'odd',
    cycleSeed: 1
  });
  assert.equal(events.length, 1);
  assert.ok(events[0].time >= 10);
  assert.ok(events[0].time < 10.25);
});

test('expandStepEvents probability zero suppresses and probability one always plays', () => {
  assert.equal(core.expandStepEvents({step:{on:true,probability:0},baseTime:1,stepDuration:.1}).length,0);
  assert.equal(core.expandStepEvents({step:{on:true,probability:1},baseTime:1,stepDuration:.1}).length,1);
});

test('expandStepEvents probability is deterministic for one cycle seed', () => {
  const args={step:{on:true,probability:.5},stepIndex:7,baseTime:2,stepDuration:.1,cycleSeed:'cycle-4'};
  assert.deepEqual(core.expandStepEvents(args),core.expandStepEvents(args));
});

test('expandStepEvents creates bounded ratchets', () => {
  const events=core.expandStepEvents({step:{on:true,velocity:.5,ratchet:8,accent:true,pitch:7},stepIndex:0,baseTime:3,stepDuration:.16,cycleSeed:1});
  assert.equal(events.length,8);
  assert.equal(events[0].pitch,7);
  assert.ok(events.every((e,i)=>e.ratchetIndex===i));
  assert.ok(events.every(e=>e.time>=3 && e.time<3.16));
  assert.ok(events[0].velocity>.5);
});


test('negative micro timing can schedule before nominal step but not before safeTime', () => {
  const events=core.expandStepEvents({step:{on:true,micro:-.4},stepIndex:2,baseTime:10,stepDuration:.25,safeTime:9.9,cycleSeed:'x',seedKey:'A01'});
  assert.equal(events.length,1);
  assert.ok(events[0].time<10);
  assert.ok(events[0].time>=9.9);
});

test('probability seed includes pad identity', () => {
  const step={on:true,probability:.5};
  let differs=false;
  for(let i=0;i<64;i++){
    const a=core.expandStepEvents({step,stepIndex:i,baseTime:i,stepDuration:.1,cycleSeed:'cycle',seedKey:'A01'}).length;
    const b=core.expandStepEvents({step,stepIndex:i,baseTime:i,stepDuration:.1,cycleSeed:'cycle',seedKey:'A02'}).length;
    if(a!==b){differs=true;break}
  }
  assert.equal(differs,true);
});

test('ratchets stay inside the current step after swing and positive micro timing', () => {
  const events=core.expandStepEvents({step:{on:true,micro:.49,ratchet:8},stepIndex:1,baseTime:5,stepDuration:.25,safeTime:4.9,swing:.7,swingLane:'odd',cycleSeed:'x',seedKey:'A01'});
  assert.equal(events.length,8);
  assert.ok(events.every(e=>e.time<5.25));
  assert.ok(events.every(e=>e.restoreTime<5.25));
});
