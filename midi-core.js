(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MPCMIDI=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var PPQ=480,STEP_TICKS=PPQ/4;
  function clamp(v,a,b){v=Number(v);if(!Number.isFinite(v))v=a;return Math.min(b,Math.max(a,v))}
  function varLen(value){var v=Math.max(0,Math.floor(Number(value)||0)),buffer=v&0x7f,out=[buffer];while((v>>=7)){buffer=(v&0x7f)|0x80;out.unshift(buffer)}return out}
  function padToMidi(id){var m=String(id||'').match(/^([A-D])(\d{2})$/);if(!m)return 36;var bank=m[1].charCodeAt(0)-65,index=clamp(parseInt(m[2],10)||1,1,16)-1;return Math.round(clamp(36+bank*16+index,0,127))}
  function push32(a,v){a.push((v>>>24)&255,(v>>>16)&255,(v>>>8)&255,v&255)}
  function push16(a,v){a.push((v>>>8)&255,v&255)}
  function tempoBytes(bpm){var us=Math.round(60000000/clamp(bpm||120,20,400));return [0xff,0x51,0x03,(us>>>16)&255,(us>>>8)&255,us&255]}
  function normalizeStep(s){s=s&&typeof s==='object'?s:{};return {on:!!s.on,velocity:clamp(s.velocity==null?1:s.velocity,0,1),pitch:Math.round(clamp(s.pitch||0,-24,24)),ratchet:Math.round(clamp(s.ratchet||1,1,8)),accent:!!s.accent}}
  function patternEvents(pattern,offsetTicks){offsetTicks=Number(offsetTicks)||0;var events=[],bars=Math.max(1,Math.min(8,Number(pattern&&pattern.bars)||1)),tracks=(pattern&&pattern.tracks)||{};Object.keys(tracks).sort().forEach(function(id){var arr=tracks[id]||[],base=padToMidi(id);for(var i=0;i<Math.min(arr.length,bars*16);i++){var s=normalizeStep(arr[i]);if(!s.on)continue;var rat=s.ratchet,gap=STEP_TICKS/rat,note=Math.round(clamp(base+s.pitch,0,127)),vel=Math.round(clamp(s.velocity*(s.accent?1.15:1),0,1)*127);vel=Math.max(1,vel);for(var r=0;r<rat;r++){var on=Math.round(offsetTicks+i*STEP_TICKS+r*gap),off=Math.round(on+Math.max(1,gap*.72));events.push({tick:on,order:1,data:[0x90,note,vel]});events.push({tick:off,order:0,data:[0x80,note,0]})}}});return {events:events,duration:bars*16*STEP_TICKS}}
  function buildFile(events,totalTicks,bpm){events=events.slice().sort(function(a,b){return a.tick-b.tick||a.order-b.order});var track=[0].concat(tempoBytes(bpm)),last=0;events.forEach(function(e){track.push.apply(track,varLen(Math.max(0,e.tick-last)));track.push.apply(track,e.data);last=e.tick});track.push.apply(track,varLen(Math.max(0,Math.round(totalTicks)-last)));track.push(0xff,0x2f,0);var out=[0x4d,0x54,0x68,0x64];push32(out,6);push16(out,0);push16(out,1);push16(out,PPQ);out.push(0x4d,0x54,0x72,0x6b);push32(out,track.length);out.push.apply(out,track);return Uint8Array.from(out)}
  function encodePattern(opts){opts=opts||{};var pe=patternEvents(opts.pattern||{},0);return buildFile(pe.events,pe.duration,opts.bpm||120)}
  function encodeSong(opts){opts=opts||{};var patterns=Array.isArray(opts.patterns)?opts.patterns:[],arr=Array.isArray(opts.arrangement)&&opts.arrangement.length?opts.arrangement:patterns.map(function(_,i){return {patternIndex:i,repeats:1}}),events=[],offset=0;arr.forEach(function(entry){var idx=Math.max(0,Math.min(patterns.length-1,Number(entry.patternIndex)||0)),p=patterns[idx];if(!p)return;var reps=Math.max(1,Math.min(64,Number(entry.repeats)||1));for(var r=0;r<reps;r++){var pe=patternEvents(p,offset);events.push.apply(events,pe.events);offset+=pe.duration}});return buildFile(events,offset,opts.bpm||120)}
  function toDownloadBlob(bytes){return new Blob([bytes],{type:'audio/midi'})}
  return {PPQ:PPQ,STEP_TICKS:STEP_TICKS,varLen:varLen,padToMidi:padToMidi,encodePattern:encodePattern,encodeSong:encodeSong,toDownloadBlob:toDownloadBlob};
});
