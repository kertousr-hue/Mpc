(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MPCMixerCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function clamp(v,a,b){v=Number(v);if(!Number.isFinite(v))v=a;return Math.min(b,Math.max(a,v))}
  function createMixerState(){return {pan:0,eqLow:0,eqMid:0,eqHigh:0,cutoff:1,resonance:0,sendA:0,sendB:0,muted:false,solo:false}}
  function normalizeMixerState(v){v=v&&typeof v==='object'?v:{};var d=createMixerState();return {
    pan:clamp(v.pan==null?d.pan:v.pan,-1,1),
    eqLow:clamp(v.eqLow==null?d.eqLow:v.eqLow,-12,12),
    eqMid:clamp(v.eqMid==null?d.eqMid:v.eqMid,-12,12),
    eqHigh:clamp(v.eqHigh==null?d.eqHigh:v.eqHigh,-12,12),
    cutoff:clamp(v.cutoff==null?d.cutoff:v.cutoff,0,1),
    resonance:clamp(v.resonance==null?d.resonance:v.resonance,0,20),
    sendA:clamp(v.sendA==null?d.sendA:v.sendA,0,1),
    sendB:clamp(v.sendB==null?d.sendB:v.sendB,0,1),
    muted:!!v.muted,
    solo:!!v.solo
  }}
  function effectiveTrackGain(o){o=o||{};var gain=clamp(o.gain==null?1:o.gain,0,4);if(o.muted)return 0;if(o.anySolo&&!o.soloed)return 0;return gain}
  return {createMixerState:createMixerState,normalizeMixerState:normalizeMixerState,effectiveTrackGain:effectiveTrackGain};
});
