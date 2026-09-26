(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MPCFXRack=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function clamp(v,a,b){v=Number(v);if(!Number.isFinite(v))v=a;return Math.min(b,Math.max(a,v))}
  var DIVS={'1/1':4,'1/2':2,'1/4':1,'1/8':.5,'1/16':.25,'1/32':.125,'1/8D':.75,'1/8T':1/3,'1/16T':1/6};
  function divisionToSeconds(bpm,division){var beat=60/clamp(bpm||120,40,300),mul=DIVS[division];if(mul==null)mul=DIVS['1/8'];return beat*mul}
  function defaultState(){return {delayMix:.28,delayFeedback:.32,reverbMix:.22,distortion:0,bitcrush:0,chorus:0,flanger:0,compressor:true,limiter:true,delayDivision:'1/8'}}
  function normalizeState(v){v=v&&typeof v==='object'?v:{};var d=defaultState(),div=Object.prototype.hasOwnProperty.call(DIVS,v.delayDivision)?v.delayDivision:d.delayDivision;return {delayMix:clamp(v.delayMix==null?d.delayMix:v.delayMix,0,1),delayFeedback:clamp(v.delayFeedback==null?d.delayFeedback:v.delayFeedback,0,.95),reverbMix:clamp(v.reverbMix==null?d.reverbMix:v.reverbMix,0,1),distortion:clamp(v.distortion==null?d.distortion:v.distortion,0,1),bitcrush:clamp(v.bitcrush==null?d.bitcrush:v.bitcrush,0,1),chorus:clamp(v.chorus==null?d.chorus:v.chorus,0,1),flanger:clamp(v.flanger==null?d.flanger:v.flanger,0,1),compressor:v.compressor==null?d.compressor:!!v.compressor,limiter:v.limiter==null?d.limiter:!!v.limiter,delayDivision:div}}
  function makeDistCurve(amount){var n=2048,a=Math.max(0,amount)*80,out=new Float32Array(n);for(var i=0;i<n;i++){var x=i*2/(n-1)-1;out[i]=(1+a)*x/(1+a*Math.abs(x))}return out}
  function makeBitCurve(amount){var n=2048,bits=Math.round(16-clamp(amount,0,1)*12),levels=Math.pow(2,bits-1),out=new Float32Array(n);for(var i=0;i<n;i++){var x=i*2/(n-1)-1;out[i]=Math.round(x*levels)/levels}return out}
  function makeImpulse(ctx,seconds,decay){var len=Math.max(1,Math.floor(ctx.sampleRate*seconds)),buf=ctx.createBuffer(2,len,ctx.sampleRate);for(var c=0;c<2;c++){var d=buf.getChannelData(c);for(var i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,decay)}return buf}
  function setParam(p,v,t){try{p.setTargetAtTime(v,t,.015)}catch(e){p.value=v}}
  function create(ctx,destination,initial){
    if(!ctx||!destination)throw new Error('AudioContext et destination requis');var state=normalizeState(initial),bpm=120;
    var input=ctx.createGain(),dist=ctx.createWaveShaper(),bits=ctx.createWaveShaper(),dry=ctx.createGain(),chorusDelay=ctx.createDelay(.08),chorusGain=ctx.createGain(),flangerDelay=ctx.createDelay(.03),flangerGain=ctx.createGain(),flangerFb=ctx.createGain(),comp=ctx.createDynamicsCompressor(),lim=ctx.createDynamicsCompressor(),sendA=ctx.createGain(),delay=ctx.createDelay(4),delayFb=ctx.createGain(),delayReturn=ctx.createGain(),sendB=ctx.createGain(),conv=ctx.createConvolver(),reverbReturn=ctx.createGain();
    input.connect(dist);dist.connect(bits);bits.connect(dry);dry.connect(comp);bits.connect(chorusDelay);chorusDelay.connect(chorusGain);chorusGain.connect(comp);bits.connect(flangerDelay);flangerDelay.connect(flangerGain);flangerGain.connect(comp);flangerDelay.connect(flangerFb);flangerFb.connect(flangerDelay);
    comp.connect(lim);lim.connect(destination);
    sendA.connect(delay);delay.connect(delayReturn);delayReturn.connect(comp);delay.connect(delayFb);delayFb.connect(delay);
    sendB.connect(conv);conv.connect(reverbReturn);reverbReturn.connect(comp);conv.buffer=makeImpulse(ctx,2.2,2.8);
    var chorusLfo=ctx.createOscillator(),chorusDepth=ctx.createGain(),flangerLfo=ctx.createOscillator(),flangerDepth=ctx.createGain();chorusLfo.frequency.value=.35;chorusLfo.connect(chorusDepth);chorusDepth.connect(chorusDelay.delayTime);chorusLfo.start();flangerLfo.frequency.value=.18;flangerLfo.connect(flangerDepth);flangerDepth.connect(flangerDelay.delayTime);flangerLfo.start();
    function apply(next){state=normalizeState(Object.assign({},state,next||{}));var t=ctx.currentTime;dist.curve=makeDistCurve(state.distortion);dist.oversample='2x';bits.curve=makeBitCurve(state.bitcrush);setParam(chorusDelay.delayTime,.018,t);setParam(chorusDepth.gain,.006*state.chorus,t);setParam(chorusGain.gain,.65*state.chorus,t);setParam(flangerDelay.delayTime,.003,t);setParam(flangerDepth.gain,.0025*state.flanger,t);setParam(flangerGain.gain,.55*state.flanger,t);setParam(flangerFb.gain,.35*state.flanger,t);setParam(delay.delayTime,divisionToSeconds(bpm,state.delayDivision),t);setParam(delayFb.gain,state.delayFeedback,t);setParam(delayReturn.gain,state.delayMix,t);setParam(reverbReturn.gain,state.reverbMix,t);comp.threshold.value=state.compressor?-18:0;comp.knee.value=state.compressor?18:0;comp.ratio.value=state.compressor?3:1;comp.attack.value=.006;comp.release.value=.16;lim.threshold.value=state.limiter?-1:0;lim.knee.value=0;lim.ratio.value=state.limiter?20:1;lim.attack.value=.002;lim.release.value=.08;return state}
    function setBpm(v){bpm=clamp(v,40,300);apply({});return bpm}
    apply(state);
    return {input:input,sendA:sendA,sendB:sendB,getInput:function(){return input},getSendAInput:function(){return sendA},getSendBInput:function(){return sendB},setState:apply,getState:function(){return Object.assign({},state)},setBpm:setBpm,setDelayDivision:function(v){return apply({delayDivision:v})},destroy:function(){try{chorusLfo.stop();flangerLfo.stop()}catch(e){}}};
  }
  return {DIVISIONS:DIVS,divisionToSeconds:divisionToSeconds,defaultState:defaultState,normalizeState:normalizeState,create:create};
});
