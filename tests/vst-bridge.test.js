const test=require('node:test');
const assert=require('node:assert/strict');
const v=require('../vst-bridge.js');

test('normalizeBridgeUrl accepts local http endpoints only',()=>{
  assert.equal(v.normalizeBridgeUrl('http://127.0.0.1:8766/'),'http://127.0.0.1:8766');
  assert.equal(v.normalizeBridgeUrl('http://192.168.1.50:8766'),'http://192.168.1.50:8766');
  assert.throws(()=>v.normalizeBridgeUrl('https://evil.example.com'),/locale/i);
  assert.throws(()=>v.normalizeBridgeUrl('javascript:alert(1)'),/locale/i);
});

test('safePluginId accepts bridge generated ids only',()=>{
  assert.equal(v.safePluginId('vst_abc123EF'),'vst_abc123EF');
  assert.equal(v.safePluginId('../../x'),null);
});
