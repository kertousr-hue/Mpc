(function(){
'use strict';

if(window.MPCAudioTap)return;
var latestContext=null,latestStream=null;
var proto=window.AudioNode&&window.AudioNode.prototype;
var nativeConnect=proto&&proto.connect;

function announce(ctx,dest){
 latestContext=ctx;latestStream=dest.stream;
 try{window.dispatchEvent(new CustomEvent('mpc-audio-tap-ready',{detail:{context:ctx,stream:dest.stream}}))}catch(e){}
}
function ensureTap(ctx){
 if(!ctx||typeof ctx.createMediaStreamDestination!=='function')return null;
 if(ctx.__mpcAudioTapDest)return ctx.__mpcAudioTapDest;
 try{
  var dest=ctx.createMediaStreamDestination();
  Object.defineProperty(ctx,'__mpcAudioTapDest',{value:dest,configurable:false,enumerable:false,writable:false});
  Object.defineProperty(ctx,'__mpcAudioTapNodes',{value:new WeakSet(),configurable:false,enumerable:false,writable:false});
  announce(ctx,dest);return dest;
 }catch(e){return null}
}
if(proto&&nativeConnect&&!proto.__mpcAudioTapPatched){
 Object.defineProperty(proto,'__mpcAudioTapPatched',{value:true,configurable:false});
 proto.connect=function(){
  var result=nativeConnect.apply(this,arguments);
  try{
   var target=arguments[0],ctx=this.context;
   if(ctx&&target===ctx.destination){
    var tap=ensureTap(ctx),nodes=ctx.__mpcAudioTapNodes;
    if(tap&&nodes&&!nodes.has(this)){nativeConnect.call(this,tap);nodes.add(this)}
   }
  }catch(e){}
  return result;
 };
}
window.MPCAudioTap={
 getStream:function(){return latestStream},
 getContext:function(){return latestContext},
 ready:function(){return !!latestStream}
};
})();
