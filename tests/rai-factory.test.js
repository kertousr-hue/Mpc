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

test('raï factory exposes four explicit playable banks',()=>{
  assert.deepEqual(Object.keys(rai.RAI_BANKS),['A','B','C','D']);
  const factory=rai.buildFactory();
  for(const bank of ['A','B','C','D']){
    const indices=rai.bankIndices(bank);
    assert.equal(indices.length,16);
    assert.ok(indices.every(i=>Number.isInteger(i)&&i>=0&&i<128));
    assert.equal(indices.length,new Set(indices).size);
    assert.ok(indices.every(i=>factory[i]));
  }
});

test('bank A covers a complete live raï palette',()=>{
  const factory=rai.buildFactory();
  const names=rai.bankIndices('A').map(i=>factory[i].name).join(' ');
  for(const re of [/Kick/i,/Darbuka/i,/Guellal/i,/Bendir/i,/Bass/i,/Gasba/i,/Accord/i,/Trump|Guitar|Synth|Vox/i]){
    assert.match(names,re);
  }
});

test('all raï kits use explicit 16-slot indices',()=>{
  assert.ok(Array.isArray(rai.RAI_KITS)&&rai.RAI_KITS.length>=4);
  for(const kit of rai.RAI_KITS){
    assert.equal(kit.indices.length,16);
    assert.ok(kit.indices.every(i=>Number.isInteger(i)&&i>=0&&i<128));
  }
});
