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
