const test=require('node:test');
const assert=require('node:assert/strict');
const rai=require('../rai-factory.js');

test('raï factory preserves exactly 128 stable slots',()=>{
  const factory=rai.buildFactory();
  assert.equal(factory.length,128);
  assert.equal(factory[0].id,'factory-1');
  assert.equal(factory[127].id,'factory-128');
  assert.ok(factory.every((s,i)=>s.factoryIndex===i));
});

test('all factory categories and names are explicitly raï-oriented',()=>{
  const factory=rai.buildFactory();
  assert.ok(factory.every(s=>/rai|raï|darbuka|guellal|bendir|tbal|riq|gasba|accord|trump|guitar|shaker|tambour|vox|bass|clap|rim|kick|snare|synth/i.test(s.name+' '+s.category)));
});

test('default bank exposes a complete 16-pad raï palette',()=>{
  assert.equal(rai.DEFAULT_RAI_BANK.length,16);
  const factory=rai.buildFactory();
  const names=rai.DEFAULT_RAI_BANK.map(i=>factory[i].name);
  assert.match(names[0],/Kick/i);
  assert.match(names[3],/Darbuka/i);
  assert.ok(names.some(n=>/Gasba/i.test(n)));
  assert.ok(names.some(n=>/Accord/i.test(n)));
  assert.ok(names.some(n=>/Trump/i.test(n)));
  assert.ok(names.some(n=>/Guitar/i.test(n)));
});

test('raï auto beat places kick, clap/snare, shaker and darbuka on musical steps',()=>{
  const beat=rai.createRaiBeat();
  assert.deepEqual(beat[0],[0,4,8,12]);
  assert.deepEqual(beat[1],[4,12]);
  assert.ok(beat[2].length>=8);
  assert.ok(beat[3].length>=4);
  for(const steps of Object.values(beat)) assert.ok(steps.every(s=>Number.isInteger(s)&&s>=0&&s<16));
});

test('kit offsets remain aligned to 16-slot factory boundaries',()=>{
  assert.deepEqual(rai.RAI_KITS.map(k=>k.offset),[0,32,64,96,112]);
  assert.ok(rai.RAI_KITS.every(k=>k.offset>=0&&k.offset<128));
});
