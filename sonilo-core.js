(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MPCSoniloCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function clamp(v,a,b){v=Number(v);if(!Number.isFinite(v))v=a;return Math.min(b,Math.max(a,v))}
  function normalizeGenerateRequest(v){
    v=v&&typeof v==='object'?v:{};var type=String(v.type||'').toLowerCase();if(type!=='music'&&type!=='sfx')throw new Error('Type Sonilo invalide');var prompt=String(v.prompt||'').trim();if(prompt.length<1)throw new Error('Prompt requis');if(prompt.length>2000)throw new Error('Prompt limité à 2000 caractères');var duration=Number(v.duration);if(!Number.isFinite(duration))duration=type==='music'?30:8;var format=String(v.format||'').toLowerCase();if(type==='music'){if(duration<5||duration>360)throw new Error('Durée musique entre 5 et 360 secondes');if(!format)format='m4a';if(['m4a','wav','mp3'].indexOf(format)<0)throw new Error('Format musique invalide')}else{if(duration<.5||duration>180)throw new Error('Durée SFX entre 0.5 et 180 secondes');if(!format)format='aac';if(['wav','mp3','aac','flac'].indexOf(format)<0)throw new Error('Format SFX invalide')}return {type:type,prompt:prompt,duration:duration,format:format}
  }
  function safeHttpsAudio(x){if(!x||typeof x!=='object')return null;var url=String(x.url||'');if(!/^https:\/\//i.test(url))return null;return {url:url,contentType:String(x.content_type||x.contentType||''),fileSize:Number(x.file_size||x.fileSize)||0}}
  function normalizeTaskResponse(v){v=v&&typeof v==='object'?v:{};var a=null;if(Array.isArray(v.audio)){for(var i=0;i<v.audio.length&&!a;i++)a=safeHttpsAudio(v.audio[i])}else a=safeHttpsAudio(v.audio);return {taskId:String(v.task_id||v.taskId||''),type:String(v.type||''),status:String(v.status||'processing'),audio:a,error:v.error?String(v.error.message||v.error):null,retryAfter:v.retry_after==null&&v.retryAfter==null?null:Number(v.retry_after||v.retryAfter)||null}}
  function normalizeHttpError(status,retryAfter){status=Number(status)||500;var code=status===401?'auth_invalid':status===402?'insufficient_balance':status===403?'forbidden':status===404?'not_found':status===422?'invalid_request':status===429?'rate_limited':'upstream_error';var retry=status===429?Number(retryAfter)||null:null;return {code:code,status:status,retryAfter:retry}}
  function validTaskId(id){return /^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/.test(String(id||''))}
  return {normalizeGenerateRequest:normalizeGenerateRequest,normalizeTaskResponse:normalizeTaskResponse,normalizeHttpError:normalizeHttpError,validTaskId:validTaskId};
});
