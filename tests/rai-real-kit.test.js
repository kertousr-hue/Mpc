const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const kit=require('../rai-real-kit.js');

test('open raï real+ kit exposes exactly 16 real audio pads',()=>{
  assert.equal(kit.OPEN_LAYOUT.length,16);
  assert.ok(kit.OPEN_LAYOUT.every(slot=>slot&&slot.sourceId&&slot.name));
  const sources=new Map(kit.SOURCES.map(src=>[src.id,src]));
  for(const slot of kit.OPEN_LAYOUT){
    const src=sources.get(slot.sourceId);
    assert.ok(src,'missing source '+slot.sourceId);
    assert.equal(src.realRecording,true);
    assert.match(src.license,/CC0|CC BY|CC BY-SA|Public Domain/i);
    assert.match(src.url,/^https:\/\/upload\.wikimedia\.org\//);
    assert.match(src.source,/^https:\/\/commons\.wikimedia\.org\//);
  }
});

test('open raï real+ kit adds real accordion trumpet and guitar recordings',()=>{
  const names=kit.OPEN_LAYOUT.map(x=>x.instrument).join(' ');
  assert.match(names,/Accordéon/i);
  assert.match(names,/Trompette/i);
  assert.match(names,/Guitare/i);
  assert.match(names,/Darbuka/i);
  assert.match(names,/Riq/i);
  assert.match(names,/Bendir/i);
});

test('gasba and guellal are declared as licensed gaps instead of being faked',()=>{
  assert.deepEqual(kit.LICENSED_GAPS.map(x=>x.instrument),['Gasba','Guellal']);
  assert.ok(kit.LICENSED_GAPS.every(x=>x.reason&&x.nextStep==='commercial-source-to-validate'));
  assert.ok(kit.LICENSED_GAPS.every(x=>!x.candidate));
  assert.ok(kit.OPEN_LAYOUT.every(x=>!['Gasba','Guellal'].includes(x.instrument)));
});

test('app loads RAÏ RÉEL+ atomically and asks before replacing the selected bank',()=>{
  const app=fs.readFileSync('app.js','utf8');
  assert.match(app,/MPCRealRaiKit/);
  assert.match(app,/confirm\(/);
  assert.match(app,/OPEN_LAYOUT/);
  assert.match(app,/KIT RAÏ RÉEL\+/);
});

test('PWA loads and caches the raï real+ source module before app.js',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const sw=fs.readFileSync('sw.js','utf8');
  assert.match(html,/rai-real-kit\.js/);
  assert.ok(html.indexOf('rai-real-kit.js')<html.indexOf('app.js'));
  assert.match(sw,/["']\.\/rai-real-kit\.js["']/);
});
