const test=require('node:test');
const assert=require('node:assert/strict');
const s=require('../sonilo-core.js');

test('normalizeGenerateRequest validates and trims music requests',()=>{
  assert.deepEqual(s.normalizeGenerateRequest({type:'music',prompt:'  dark electro groove  ',duration:60,format:'mp3'}),{type:'music',prompt:'dark electro groove',duration:60,format:'mp3'});
  assert.throws(()=>s.normalizeGenerateRequest({type:'music',prompt:'x',duration:4}),/5/);
  assert.throws(()=>s.normalizeGenerateRequest({type:'music',prompt:'x',duration:361}),/360/);
  assert.throws(()=>s.normalizeGenerateRequest({type:'music',prompt:'x',duration:30,format:'flac'}),/format/i);
});

test('normalizeGenerateRequest validates sfx duration and formats',()=>{
  assert.deepEqual(s.normalizeGenerateRequest({type:'sfx',prompt:'laser hit',duration:.5,format:'wav'}),{type:'sfx',prompt:'laser hit',duration:.5,format:'wav'});
  assert.throws(()=>s.normalizeGenerateRequest({type:'sfx',prompt:'laser',duration:.4}),/0.5/);
  assert.throws(()=>s.normalizeGenerateRequest({type:'sfx',prompt:'laser',duration:181}),/180/);
});

test('normalizeGenerateRequest rejects unsupported type and huge prompt',()=>{
  assert.throws(()=>s.normalizeGenerateRequest({type:'video',prompt:'x'}),/type/i);
  assert.throws(()=>s.normalizeGenerateRequest({type:'music',prompt:'x'.repeat(2001),duration:30}),/2000/);
});

test('normalizeTaskResponse selects safe audio url from sfx object or music array',()=>{
  assert.deepEqual(s.normalizeTaskResponse({task_id:'abc',type:'text_to_sfx',status:'succeeded',audio:{url:'https://cdn.example/a.wav',content_type:'audio/wav',file_size:123}}),{taskId:'abc',type:'text_to_sfx',status:'succeeded',audio:{url:'https://cdn.example/a.wav',contentType:'audio/wav',fileSize:123},error:null,retryAfter:null});
  assert.equal(s.normalizeTaskResponse({task_id:'def',type:'text_to_music',status:'succeeded',audio:[{url:'https://cdn.example/m.m4a',content_type:'audio/mp4',file_size:999}]}).audio.url,'https://cdn.example/m.m4a');
});

test('normalizeTaskResponse rejects non-https result urls',()=>{
  const out=s.normalizeTaskResponse({task_id:'x',status:'succeeded',audio:{url:'http://bad/a.wav'}});
  assert.equal(out.audio,null);
});

test('normalizeHttpError maps Sonilo status classes without leaking response body',()=>{
  assert.deepEqual(s.normalizeHttpError(401,'10'),{code:'auth_invalid',status:401,retryAfter:null});
  assert.deepEqual(s.normalizeHttpError(402,null),{code:'insufficient_balance',status:402,retryAfter:null});
  assert.deepEqual(s.normalizeHttpError(429,'7'),{code:'rate_limited',status:429,retryAfter:7});
  assert.deepEqual(s.normalizeHttpError(500,null),{code:'upstream_error',status:500,retryAfter:null});
});
