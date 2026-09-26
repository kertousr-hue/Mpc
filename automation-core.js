(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MPCAutomationCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function clamp(v,a,b){v=Number(v);if(!Number.isFinite(v))v=a;return Math.min(b,Math.max(a,v))}
  var LIMITS={gain:[0,1.5],pan:[-1,1],pitch:[-24,24],cutoff:[0,1],sendA:[0,1],sendB:[0,1]};
  function normalizeLocks(v){var out={};v=v&&typeof v==='object'?v:{};Object.keys(LIMITS).forEach(function(k){if(v[k]!=null){var r=LIMITS[k];out[k]=clamp(v[k],r[0],r[1])}});return out}
  function recordPoint(lane,position,value){var out=Array.isArray(lane)?lane.slice():[],p=((Number(position)||0)%1+1)%1,v=Number(value)||0,idx=out.findIndex(function(x){return Math.abs(Number(x.position)-p)<.001});if(idx>=0)out[idx]={position:p,value:v};else out.push({position:p,value:v});out.sort(function(a,b){return a.position-b.position});if(out.length>512){var stride=out.length/512,next=[];for(var i=0;i<512;i++)next.push(out[Math.min(out.length-1,Math.floor(i*stride))]);out=next}return out}
  function sampleLane(lane,position){if(!Array.isArray(lane)||!lane.length)return null;if(lane.length===1)return Number(lane[0].value)||0;var p=((Number(position)||0)%1+1)%1,pts=lane.slice().sort(function(a,b){return a.position-b.position});var prev=pts[0],next=pts[pts.length-1];for(var i=0;i<pts.length-1;i++){if(p>=pts[i].position&&p<=pts[i+1].position){prev=pts[i];next=pts[i+1];break}}if(p<pts[0].position){prev={position:pts[pts.length-1].position-1,value:pts[pts.length-1].value};next=pts[0]}else if(p>pts[pts.length-1].position){prev=pts[pts.length-1];next={position:pts[0].position+1,value:pts[0].value}}var span=next.position-prev.position;if(Math.abs(span)<1e-9)return Number(next.value)||0;var t=(p-prev.position)/span;return (Number(prev.value)||0)+(Number(next.value)-Number(prev.value))*t}
  return {LIMITS:LIMITS,normalizeLocks:normalizeLocks,recordPoint:recordPoint,sampleLane:sampleLane};
});
