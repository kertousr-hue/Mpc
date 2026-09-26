const test=require('node:test');
const assert=require('node:assert/strict');
const midi=require('../midi.js');

test('normalizeMidiMessage identifies note on, note off and cc',()=>{
  assert.deepEqual(midi.normalizeMidiMessage([0x90,60,100]),{type:'note',channel:0,number:60,value:100,normalized:100/127,on:true});
  assert.deepEqual(midi.normalizeMidiMessage([0x90,60,0]),{type:'note',channel:0,number:60,value:0,normalized:0,on:false});
  assert.deepEqual(midi.normalizeMidiMessage([0xB2,74,64]),{type:'cc',channel:2,number:74,value:64,normalized:64/127,on:true});
});

test('learnMapping replaces previous mapping for the same target',()=>{
  let map={};
  map=midi.learnMapping(map,'pad:A01',{type:'note',channel:0,number:36,value:100,on:true});
  map=midi.learnMapping(map,'pad:A01',{type:'note',channel:1,number:40,value:100,on:true});
  assert.deepEqual(map['pad:A01'],{type:'note',channel:1,number:40});
  assert.equal(Object.keys(map).length,1);
});

test('learnMapping moves one MIDI control to the newest target to avoid duplicate triggers',()=>{
  let map={};
  map=midi.learnMapping(map,'pad:A01',{type:'note',channel:0,number:36,value:100,on:true});
  map=midi.learnMapping(map,'pad:A02',{type:'note',channel:0,number:36,value:100,on:true});
  assert.equal(map['pad:A01'],undefined);
  assert.deepEqual(map['pad:A02'],{type:'note',channel:0,number:36});
});

test('findMappingTarget matches by type channel and number',()=>{
  const map={'pad:A01':{type:'note',channel:0,number:36},'mixer:A01:pan':{type:'cc',channel:1,number:10}};
  assert.equal(midi.findMappingTarget(map,{type:'note',channel:0,number:36}),'pad:A01');
  assert.equal(midi.findMappingTarget(map,{type:'cc',channel:1,number:10}),'mixer:A01:pan');
  assert.equal(midi.findMappingTarget(map,{type:'cc',channel:0,number:10}),null);
});


test('defaultArrangement excludes empty patterns',()=>{
  const empty={tracks:{A01:[{on:false}]}};
  const active={tracks:{A01:[{on:true}]}};
  assert.deepEqual(midi.defaultArrangement([empty,active,empty]),[{patternIndex:1,repeats:1}]);
});
