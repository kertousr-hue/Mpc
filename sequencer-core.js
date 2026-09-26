(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MPCSequencerCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var DEFAULT_STEP={on:false,velocity:1,probability:1,micro:0,pitch:0,ratchet:1,accent:false,locks:{}};
  function clamp(v,a,b){v=Number(v);if(!Number.isFinite(v))v=a;return Math.min(b,Math.max(a,v))}
  function createDefaultStep(on){return {on:!!on,velocity:1,probability:1,micro:0,pitch:0,ratchet:1,accent:false,locks:{}}}
  function normalizeStep(value){
    if(typeof value==='boolean')return createDefaultStep(value);
    value=value&&typeof value==='object'?value:{};
    return {
      on:!!value.on,
      velocity:clamp(value.velocity==null?1:value.velocity,0,1),
      probability:clamp(value.probability==null?1:value.probability,0,1),
      micro:clamp(value.micro==null?0:value.micro,-.49,.49),
      pitch:clamp(value.pitch==null?0:value.pitch,-24,24),
      ratchet:Math.round(clamp(value.ratchet==null?1:value.ratchet,1,8)),
      accent:!!value.accent,
      locks:value.locks&&typeof value.locks==='object'&&!Array.isArray(value.locks)?Object.assign({},value.locks):{}
    };
  }
  function normalizeBars(v){return Math.round(clamp(v==null?1:v,1,8))}
  function createPattern(options){
    options=options||{};
    var bars=normalizeBars(options.bars), padIds=Array.isArray(options.padIds)?options.padIds:[], length=bars*16, tracks={};
    padIds.forEach(function(id){tracks[id]=Array.from({length:length},function(){return createDefaultStep(false)})});
    return {bars:bars,stepsPerBar:16,timeSignature:{numerator:4,denominator:4},tracks:tracks,automation:{},swing:{amount:0,lane:'even'}};
  }
  function resizePattern(pattern,bars){
    var nextBars=normalizeBars(bars), out=createPattern({padIds:Object.keys((pattern&&pattern.tracks)||{}),bars:nextBars});
    if(pattern&&pattern.timeSignature)out.timeSignature={numerator:Number(pattern.timeSignature.numerator)||4,denominator:Number(pattern.timeSignature.denominator)||4};
    if(pattern&&pattern.automation&&typeof pattern.automation==='object')out.automation=JSON.parse(JSON.stringify(pattern.automation));
    if(pattern&&pattern.swing&&typeof pattern.swing==='object')out.swing=Object.assign({},out.swing,pattern.swing);
    Object.keys(out.tracks).forEach(function(id){
      var src=(pattern.tracks&&pattern.tracks[id])||[];
      for(var i=0;i<Math.min(src.length,out.tracks[id].length);i++)out.tracks[id][i]=normalizeStep(src[i]);
    });
    return out;
  }
  function normalizeV7Pattern(pattern){
    pattern=pattern&&typeof pattern==='object'?pattern:{};
    if(!pattern.tracks)return createPattern({padIds:[],bars:1});
    var padIds=Object.keys(pattern.tracks),bars=normalizeBars(pattern.bars||Math.ceil(Math.max(16,...padIds.map(function(id){return (pattern.tracks[id]||[]).length}))/16));
    var out=createPattern({padIds:padIds,bars:bars});
    out.timeSignature=pattern.timeSignature||out.timeSignature;out.automation=pattern.automation||{};out.swing=Object.assign({},out.swing,pattern.swing||{});
    padIds.forEach(function(id){var src=pattern.tracks[id]||[];for(var i=0;i<out.tracks[id].length;i++)out.tracks[id][i]=normalizeStep(src[i]);});
    return out;
  }
  function migrateLegacyPatterns(patterns){
    if(!Array.isArray(patterns))return [];
    return patterns.map(function(pattern){
      if(pattern&&pattern.tracks)return normalizeV7Pattern(pattern);
      var padIds=Object.keys(pattern||{}),out=createPattern({padIds:padIds,bars:1});
      padIds.forEach(function(id){var arr=Array.isArray(pattern[id])?pattern[id]:[];for(var i=0;i<16;i++)out.tracks[id][i]=normalizeStep(arr[i]||false)});
      return out;
    });
  }
  function hashSeed(seed){var s=String(seed==null?'':seed),h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0)/4294967296}
  function shouldSwing(stepIndex,lane){if(lane==='odd')return stepIndex%2===1;if(lane==='all')return true;if(lane==='none')return false;return stepIndex%2===1}
  function expandStepEvents(args){
    args=args||{};var step=normalizeStep(args.step);if(!step.on||step.probability<=0)return [];
    var seed=String(args.cycleSeed==null?'0':args.cycleSeed)+':'+String(args.seedKey==null?'':args.seedKey)+':'+String(args.stepIndex||0);
    if(step.probability<1&&hashSeed(seed)>=step.probability)return [];
    var sd=Math.max(.0001,Number(args.stepDuration)||.1),base=Number(args.baseTime)||0,safe=args.safeTime==null?base:Number(args.safeTime),idx=Math.max(0,Number(args.stepIndex)||0),amount=clamp(args.swing||0,0,.7),lane=args.swingLane||'even';
    if(!Number.isFinite(safe))safe=base;
    var offset=0;if(shouldSwing(idx,lane))offset+=sd*amount*.55;offset+=sd*step.micro;
    var first=Math.max(safe,base+offset),stepEnd=base+sd,count=step.ratchet,available=Math.max(.0001,stepEnd-first),gap=available/count,events=[];
    for(var i=0;i<count;i++)events.push({time:Math.max(safe,Math.min(stepEnd-.000001,first+i*gap)),restoreTime:Math.max(safe,stepEnd-.000001),velocity:step.velocity*(step.accent?1.18:1),pitch:step.pitch,locks:Object.assign({},step.locks),accent:step.accent,ratchetIndex:i});
    return events;
  }
  return {DEFAULT_STEP:DEFAULT_STEP,createDefaultStep:createDefaultStep,normalizeStep:normalizeStep,createPattern:createPattern,resizePattern:resizePattern,migrateLegacyPatterns:migrateLegacyPatterns,normalizeV7Pattern:normalizeV7Pattern,expandStepEvents:expandStepEvents};
});
