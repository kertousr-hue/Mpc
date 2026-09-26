const test=require('node:test');
const assert=require('node:assert/strict');
const v=require('../vst-bridge.js');

test('normalizeBridgeUrl accepts local http and https endpoints only',()=>{
  assert.equal(v.normalizeBridgeUrl('http://127.0.0.1:8766/'),'http://127.0.0.1:8766');
  assert.equal(v.normalizeBridgeUrl('http://192.168.1.50:8766'),'http://192.168.1.50:8766');
  assert.equal(v.normalizeBridgeUrl('https://127.0.0.1:8766/'),'https://127.0.0.1:8766');
  assert.equal(v.normalizeBridgeUrl('https://192.168.1.50:8766'),'https://192.168.1.50:8766');
  assert.throws(()=>v.normalizeBridgeUrl('https://evil.example.com'),/locale|LAN/i);
  assert.throws(()=>v.normalizeBridgeUrl('javascript:alert(1)'),/locale|LAN/i);
});

test('safePluginId accepts bridge generated ids only',()=>{
  assert.equal(v.safePluginId('vst_abc123EF'),'vst_abc123EF');
  assert.equal(v.safePluginId('../../x'),null);
});


test('bridgeRequestPolicy keeps mixed content blocked but allows private HTTPS',()=>{
  assert.deepEqual(v.bridgeRequestPolicy('https://mpc.example/','http://192.168.1.10:8766'),{allowed:false,reason:'mixed_content'});
  assert.deepEqual(v.bridgeRequestPolicy('https://mpc.example/','https://192.168.1.10:8766'),{allowed:true,reason:'ok'});
  assert.deepEqual(v.bridgeRequestPolicy('https://192.168.1.10:8766/','https://192.168.1.10:8766'),{allowed:true,reason:'ok'});
  assert.deepEqual(v.bridgeRequestPolicy('http://192.168.1.10:8766/','http://192.168.1.10:8766'),{allowed:true,reason:'ok'});
});

test('normalizeBridgeUrl rejects public hosts',()=>{
  assert.throws(()=>v.normalizeBridgeUrl('http://example.com:8766'),/locale|LAN/i);
});
