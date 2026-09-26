(function(root,factory){
  var api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MPCPerformanceV2=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  function clamp(v,a,b){v=Number(v);if(!Number.isFinite(v))v=a;return Math.min(b,Math.max(a,v))}
  function expandFlam(event,stepDuration,amount){event=event||{};var sd=Math.max(.001,Number(stepDuration)||.125),amt=clamp(amount==null?.45:amount,.05,.95),base=Number(event.time)||0,vel=clamp(event.velocity==null?1:event.velocity,0,1);return [Object.assign({},event,{time:base,velocity:vel}),Object.assign({},event,{time:base+sd*(.08+.22*amt),velocity:vel*(.72-.18*amt)})]}
  function repeatInterval(bpm,division){var beat=60/clamp(bpm||120,40,300),m={'1/8':.5,'1/16':.25,'1/32':.125}[division]||.25;return beat*m}
  function accentVelocity(v,mult){return clamp((Number(v)||0)*(Number(mult)||1.2),0,1)}
  function stutterEvents(o){o=o||{};var start=Number(o.startTime)||0,dur=Math.max(.001,Number(o.duration)||.25),intv=Math.max(.005,Number(o.interval)||.05),max=Math.max(1,Math.min(32,Math.floor(Number(o.maxEvents)||16))),vel=clamp(o.velocity==null?1:o.velocity,0,1),out=[];for(var i=0;i<max;i++){var t=start+i*intv;if(t>=start+dur-1e-9)break;out.push({time:t,velocity:vel,index:i})}return out}
  function canUseBrowser(){return !!(root&&root.document&&root.window===root)}
  var live={flam:.45,division:'1/16',stutterTimer:null,accent:false};
  function currentPad(){try{return selectedPad}catch(e){return 'A01'}}
  function bpm(){var e=document.getElementById('bpm');return Number(e&&e.value)||120}
  function statusText(t){try{status(t)}catch(e){var n=document.getElementById('status');if(n)n.textContent=t}}
  function playFlam(){try{ensureAudio();var id=currentPad(),sd=stepDuration(),hits=expandFlam({time:audioCtx.currentTime+.01,velocity:live.accent?1:.85},sd,live.flam);hits.forEach(function(h){playPad(id,h.time,null,h.velocity)});statusText('FLAM · '+id)}catch(e){statusText('Flam : '+e.message)}}
  function startStutter(){stopStutter();try{ensureAudio();var id=currentPad(),interval=repeatInterval(bpm(),live.division),start=audioCtx.currentTime+.01;live.stutterTimer=setInterval(function(){try{playPad(id,null,null,live.accent?1:.85)}catch(e){}},Math.max(16,interval*1000));playPad(id,start,null,live.accent?1:.85);statusText('STUTTER '+live.division+' · '+id)}catch(e){statusText('Stutter : '+e.message)}}
  function stopStutter(){if(live.stutterTimer){clearInterval(live.stutterTimer);live.stutterTimer=null}}
  function inject(){var wrap=document.getElementById('grooveboxV2'),toolbar=wrap&&wrap.querySelector('.grooveToolbar');if(!toolbar||document.getElementById('perfLive'))return false;var box=document.createElement('div');box.id='perfLive';box.className='perfLive';box.innerHTML='<button id="perfFlam" type="button">FLAM</button><button id="perfStutter" type="button">STUTTER</button><select id="perfDivision"><option>1/8</option><option selected>1/16</option><option>1/32</option></select><button id="perfAccent" type="button">ACCENT</button>';toolbar.appendChild(box);document.getElementById('perfFlam').onclick=playFlam;var st=document.getElementById('perfStutter');st.addEventListener('pointerdown',function(e){e.preventDefault();startStutter()});['pointerup','pointerleave','pointercancel'].forEach(function(n){st.addEventListener(n,stopStutter)});document.getElementById('perfDivision').onchange=function(){live.division=this.value};document.getElementById('perfAccent').onclick=function(){live.accent=!live.accent;this.classList.toggle('active',live.accent);statusText(live.accent?'Accent live activé':'Accent live désactivé')};return true}
  function init(){var n=0,t=setInterval(function(){n++;if(inject()||n>100)clearInterval(t)},50);window.addEventListener('blur',stopStutter);document.addEventListener('visibilitychange',function(){if(document.hidden)stopStutter()})}
  if(canUseBrowser()){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init()}
  return {expandFlam:expandFlam,repeatInterval:repeatInterval,accentVelocity:accentVelocity,stutterEvents:stutterEvents,stopStutter:stopStutter};
});
