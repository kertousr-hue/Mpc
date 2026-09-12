(function(){
'use strict';

var originalPlayPad=null,installTimer=null,noiseCache=new WeakMap();
var KITS={
 E:{name:'ORIENTAL',labels:['Darbuka Dum','Darbuka Tek','Darbuka Slap','Riq Tek','Riq Jingle','Bendir Dum','Bendir Tek','Tabla Na','Tabla Tin','Zills','Finger Snap','Shaker','Darbuka Roll','Oriental Fill','Crash','Oriental FX']},
 F:{name:'AFRO / LATIN',labels:['Conga Low','Conga High','Bongo Low','Bongo High','Cowbell','Clave','Agogo Low','Agogo High','Timbale Low','Timbale High','Cabasa','Maracas','Guiro','Surdo','Samba Snare','Latin Crash']},
 G:{name:'TRAP / 808',labels:['808 Kick','808 Bass','Trap Snare','Trap Clap','Closed Hat','Open Hat','Hat Roll','Rim','Trap Perc','Vox Hit','Dark Stab','Pluck','Riser','Downlifter','Impact','Siren']},
 H:{name:'HOUSE / FX',labels:['House Kick','House Clap','House Snare','Closed Hat','Open Hat','Perc','Tom','Ride','Crash','House Bass','House Chord','Stab','Riser','Downlifter','Vox Chop','Big Impact']}
};

function clamp(v,a,b){return Math.min(b,Math.max(a,Number(v)||0))}
function status(t){var s=document.getElementById('status');if(s)s.textContent=t}
function getCtx(){return window.MPCAudioTap&&window.MPCAudioTap.getContext?window.MPCAudioTap.getContext():null}
function ensureCtx(id,time,dest,velocity){
 var ac=dest&&dest.context?dest.context:getCtx();
 if(ac)return ac;
 try{if(originalPlayPad)originalPlayPad(id,time,dest,0.00001)}catch(e){}
 return dest&&dest.context?dest.context:getCtx();
}
function noiseBuffer(ac,seconds){
 var cached=noiseCache.get(ac);if(cached&&cached.duration>=seconds)return cached;
 var len=Math.max(1,Math.ceil(ac.sampleRate*Math.max(1,seconds))),b=ac.createBuffer(1,len,ac.sampleRate),d=b.getChannelData(0);
 for(var i=0;i<d.length;i++)d[i]=Math.random()*2-1;
 noiseCache.set(ac,b);return b
}
function outDest(ac,dest){return dest||ac.destination}
function env(ac,dest,t,vol,decay,attack){
 var g=ac.createGain(),a=Math.max(0,attack||0);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0001,vol),t+a+.001);g.gain.exponentialRampToValueAtTime(.0001,t+a+Math.max(.02,decay));g.connect(dest);return g
}
function osc(ac,dest,t,type,f1,f2,vol,decay,attack){
 var o=ac.createOscillator(),g=env(ac,dest,t,vol,decay,attack);o.type=type||'sine';o.frequency.setValueAtTime(Math.max(1,f1),t);if(f2)o.frequency.exponentialRampToValueAtTime(Math.max(1,f2),t+Math.max(.02,decay*.85));o.connect(g);o.start(t);o.stop(t+Math.max(.04,decay+(attack||0))+.04)
}
function noise(ac,dest,t,vol,decay,type,freq,q){
 var s=ac.createBufferSource(),f=ac.createBiquadFilter(),g=env(ac,dest,t,vol,decay,0);s.buffer=noiseBuffer(ac,Math.max(1,decay+.2));f.type=type||'bandpass';f.frequency.value=freq||2200;f.Q.value=q||.8;s.connect(f);f.connect(g);s.start(t);s.stop(t+Math.max(.05,decay)+.05)
}
function metal(ac,dest,t,base,vol,decay){[1,1.37,1.91,2.73].forEach(function(r,i){osc(ac,dest,t,'square',base*r,null,vol*(i?0.08:0.13),decay,0)})}
function tom(ac,dest,t,f,vol,decay){osc(ac,dest,t,'sine',f*1.65,f,vol,decay||.2,0);noise(ac,dest,t,vol*.08,.04,'bandpass',1800,1)}
function clap(ac,dest,t,vol){[0,.018,.036].forEach(function(d,i){noise(ac,dest,t+d,vol*.34,.075,'bandpass',1500+i*180,1.2)})}
function hat(ac,dest,t,vol,open){noise(ac,dest,t,vol,open?.32:.055,'highpass',open?5200:6500,.8);metal(ac,dest,t,4200,vol*.2,open?.2:.04)}
function kick(ac,dest,t,vol,long808){osc(ac,dest,t,'sine',long808?165:150,long808?42:48,vol,long808?.62:.27,0);noise(ac,dest,t,vol*.07,.025,'lowpass',1600,.7)}
function chord(ac,dest,t,root,vol,decay){[1,1.2599,1.4983].forEach(function(r,i){osc(ac,dest,t,i?'triangle':'sawtooth',root*r,null,vol/4,decay||.3,.002)})}
function repeated(fn,t,count,spacing){for(var i=0;i<count;i++)fn(t+i*spacing,i)}

function oriental(ac,dest,t,i,v){
 switch(i){
  case 1:tom(ac,dest,t,92,v,.3);break;
  case 2:tom(ac,dest,t,255,v*.72,.11);break;
  case 3:noise(ac,dest,t,v*.72,.09,'bandpass',2600,1.8);osc(ac,dest,t,'triangle',420,250,v*.25,.08);break;
  case 4:tom(ac,dest,t,330,v*.55,.075);noise(ac,dest,t,v*.18,.05,'highpass',4800,.8);break;
  case 5:metal(ac,dest,t,1900,v*.7,.22);noise(ac,dest,t,v*.16,.14,'highpass',6000,.6);break;
  case 6:tom(ac,dest,t,78,v,.38);break;
  case 7:tom(ac,dest,t,210,v*.65,.13);break;
  case 8:tom(ac,dest,t,185,v*.7,.12);noise(ac,dest,t,v*.16,.055,'bandpass',3200,1.4);break;
  case 9:tom(ac,dest,t,360,v*.55,.09);break;
  case 10:metal(ac,dest,t,2500,v*.75,.16);break;
  case 11:clap(ac,dest,t,v*.75);break;
  case 12:noise(ac,dest,t,v*.45,.12,'highpass',5200,.8);break;
  case 13:repeated(function(tt,n){tom(ac,dest,tt,220+n*18,v*.48,.07)},t,6,.055);break;
  case 14:repeated(function(tt,n){tom(ac,dest,tt,[110,150,210,290][n%4],v*.6,.12)},t,4,.09);break;
  case 15:noise(ac,dest,t,v*.5,.75,'highpass',3500,.5);metal(ac,dest,t,1200,v*.45,.62);break;
  default:osc(ac,dest,t,'sawtooth',620,110,v*.35,.45);noise(ac,dest,t,v*.16,.34,'bandpass',1700,1)
 }
}
function afro(ac,dest,t,i,v){
 switch(i){
  case 1:tom(ac,dest,t,105,v,.28);break;case 2:tom(ac,dest,t,175,v*.85,.22);break;case 3:tom(ac,dest,t,230,v*.72,.16);break;case 4:tom(ac,dest,t,320,v*.66,.13);break;
  case 5:metal(ac,dest,t,610,v*.75,.16);break;case 6:osc(ac,dest,t,'square',920,null,v*.42,.055);osc(ac,dest,t,'square',1330,null,v*.24,.045);break;
  case 7:metal(ac,dest,t,760,v*.55,.2);break;case 8:metal(ac,dest,t,1160,v*.5,.18);break;case 9:tom(ac,dest,t,165,v*.8,.18);break;case 10:tom(ac,dest,t,280,v*.74,.16);break;
  case 11:noise(ac,dest,t,v*.42,.18,'highpass',4200,.7);break;case 12:noise(ac,dest,t,v*.34,.12,'highpass',6000,.5);break;
  case 13:repeated(function(tt){noise(ac,dest,tt,v*.16,.035,'bandpass',2400,1.5)},t,7,.035);break;case 14:tom(ac,dest,t,68,v, .42);break;
  case 15:noise(ac,dest,t,v*.62,.15,'bandpass',1500,1.1);osc(ac,dest,t,'triangle',190,120,v*.18,.1);break;
  default:noise(ac,dest,t,v*.5,.7,'highpass',3300,.5);metal(ac,dest,t,1300,v*.4,.58)
 }
}
function trap(ac,dest,t,i,v){
 switch(i){
  case 1:kick(ac,dest,t,v,true);break;case 2:osc(ac,dest,t,'sine',58,48,v*.78,.85,.003);osc(ac,dest,t,'triangle',116,96,v*.16,.55);break;
  case 3:noise(ac,dest,t,v*.7,.16,'bandpass',1450,1.1);osc(ac,dest,t,'triangle',190,120,v*.18,.09);break;case 4:clap(ac,dest,t,v);break;
  case 5:hat(ac,dest,t,v*.55,false);break;case 6:hat(ac,dest,t,v*.55,true);break;case 7:repeated(function(tt,n){hat(ac,dest,tt,v*.34,false)},t,8,.045);break;
  case 8:osc(ac,dest,t,'triangle',470,260,v*.34,.055);noise(ac,dest,t,v*.08,.03,'bandpass',2100,2);break;case 9:tom(ac,dest,t,260,v*.48,.09);break;
  case 10:osc(ac,dest,t,'sawtooth',330,185,v*.24,.18);noise(ac,dest,t,v*.1,.12,'bandpass',900,1);break;case 11:chord(ac,dest,t,92,v*.7,.24);break;case 12:osc(ac,dest,t,'triangle',690,230,v*.42,.22);break;
  case 13:osc(ac,dest,t,'sawtooth',90,1200,v*.22,.72,.03);noise(ac,dest,t,v*.11,.7,'highpass',1500,.7);break;case 14:osc(ac,dest,t,'sawtooth',1300,90,v*.22,.62);break;
  case 15:kick(ac,dest,t,v*.7,false);noise(ac,dest,t,v*.34,.55,'lowpass',900,.7);break;default:osc(ac,dest,t,'sine',440,880,v*.35,.55);osc(ac,dest,t+.28,'sine',880,440,v*.26,.5)
 }
}
function house(ac,dest,t,i,v){
 switch(i){
  case 1:kick(ac,dest,t,v,false);break;case 2:clap(ac,dest,t,v);break;case 3:noise(ac,dest,t,v*.62,.13,'bandpass',1700,1.2);break;case 4:hat(ac,dest,t,v*.48,false);break;case 5:hat(ac,dest,t,v*.48,true);break;
  case 6:tom(ac,dest,t,245,v*.45,.095);break;case 7:tom(ac,dest,t,130,v*.72,.22);break;case 8:metal(ac,dest,t,2400,v*.55,.42);break;case 9:noise(ac,dest,t,v*.42,.8,'highpass',3400,.5);metal(ac,dest,t,1200,v*.3,.7);break;
  case 10:osc(ac,dest,t,'sawtooth',72,58,v*.38,.28);osc(ac,dest,t,'sine',72,58,v*.35,.3);break;case 11:chord(ac,dest,t,220,v*.68,.42);break;case 12:chord(ac,dest,t,330,v*.62,.13);break;
  case 13:osc(ac,dest,t,'sawtooth',100,1600,v*.18,.85,.04);noise(ac,dest,t,v*.09,.82,'highpass',1700,.7);break;case 14:osc(ac,dest,t,'sawtooth',1500,90,v*.18,.72);break;
  case 15:osc(ac,dest,t,'triangle',520,260,v*.25,.16);noise(ac,dest,t,v*.08,.12,'bandpass',1200,1);break;default:kick(ac,dest,t,v*.65,false);noise(ac,dest,t,v*.25,.65,'lowpass',1000,.6)
 }
}
function synthPad(id,time,dest,velocity){
 var bank=String(id||'').charAt(0).toUpperCase(),kit=KITS[bank];if(!kit)return false;
 var idx=clamp(parseInt(String(id).slice(1),10),1,16),ac=ensureCtx(id,time,dest,velocity);if(!ac)return false;
 if(ac.state==='suspended'&&ac.resume)ac.resume();var out=outDest(ac,dest),t=typeof time==='number'?Math.max(ac.currentTime,time):ac.currentTime+.002,v=clamp(velocity==null?1:velocity,0,1.5);
 if(bank==='E')oriental(ac,out,t,idx,v);else if(bank==='F')afro(ac,out,t,idx,v);else if(bank==='G')trap(ac,out,t,idx,v);else house(ac,out,t,idx,v);
 try{window.dispatchEvent(new CustomEvent('mpc-dj-kit-hit',{detail:{pad:id,kit:kit.name,label:kit.labels[idx-1]}}))}catch(e){}
 return true
}
function installPlayPad(){
 if(window.__MPC_EXTENDED_PAD_KITS)return true;if(typeof window.playPad!=='function')return false;
 originalPlayPad=window.playPad;
 window.playPad=function(id,time,dest,velocity){var bank=String(id||'').charAt(0).toUpperCase();if(KITS[bank]){if(synthPad(id,time,dest,velocity)){status(bank+' · '+(KITS[bank].labels[parseInt(String(id).slice(1),10)-1]||id));return}}return originalPlayPad.apply(this,arguments)};
 window.__MPC_EXTENDED_PAD_KITS=true;return true
}
function labelPads(key){
 var sel=document.getElementById('djPadBank'+key),root=document.getElementById('djPads'+key);if(!sel||!root)return;var bank=sel.value,kit=KITS[bank];if(!kit)return;
 root.querySelectorAll('.djPerfPad').forEach(function(b){var n=parseInt(String(b.dataset.pad||'').slice(1),10),label=kit.labels[n-1]||('Pad '+n),strong=b.querySelector('b');if(strong)strong.textContent=label;b.title=kit.name+' · '+label})
}
function addBankOptions(key){
 var sel=document.getElementById('djPadBank'+key);if(!sel)return false;
 Object.keys(KITS).forEach(function(bank){if(!sel.querySelector('option[value="'+bank+'"]')){var o=document.createElement('option');o.value=bank;o.textContent=bank+' · '+KITS[bank].name;sel.appendChild(o)}});
 if(!sel.dataset.extendedPads){sel.dataset.extendedPads='1';sel.addEventListener('change',function(){setTimeout(function(){labelPads(key)},0);var kit=KITS[sel.value];if(kit)status('Deck '+key+' · kit '+kit.name+' · 16 pads')})}
 return true
}
function injectLegend(){
 var w=document.getElementById('djWorkspace');if(!w||document.getElementById('djExtendedPadLegend'))return;
 var n=document.createElement('div');n.id='djExtendedPadLegend';n.className='djExtendedPadLegend';n.innerHTML='<b>+ 64 PADS</b><span>E ORIENTAL</span><span>F AFRO/LATIN</span><span>G TRAP/808</span><span>H HOUSE/FX</span><small>Banques A–D conservées pour tes sons et samples.</small>';
 var mix=w.querySelector('.djMixer');if(mix)mix.appendChild(n)
}
function injectStyle(){if(document.getElementById('djExtendedPadStyle'))return;var s=document.createElement('style');s.id='djExtendedPadStyle';s.textContent='.djExtendedPadLegend{margin-top:10px;padding:9px;border:1px solid #315068;border-radius:8px;background:#08131c;display:grid;grid-template-columns:repeat(2,1fr);gap:5px;font-size:8px}.djExtendedPadLegend b{grid-column:1/-1;color:#76e6ff;font-size:10px}.djExtendedPadLegend span{padding:5px;border:1px solid #294657;border-radius:6px;color:#d8e7ef}.djExtendedPadLegend small{grid-column:1/-1;color:#728997;line-height:1.4}.djPadHead select option{background:#071018;color:#d8e7ef}';document.head.appendChild(s)}
function refresh(){var okA=addBankOptions('A'),okB=addBankOptions('B');if(okA)labelPads('A');if(okB)labelPads('B');injectLegend();injectStyle();return okA&&okB}
function init(){
 installPlayPad();refresh();
 installTimer=setInterval(function(){installPlayPad();refresh()},700);
 var w=document.getElementById('djWorkspace');if(w&&window.MutationObserver){new MutationObserver(function(){labelPads('A');labelPads('B')}).observe(w,{childList:true,subtree:true})}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.MPCDJPadKits={kits:KITS,play:synthPad};
})();
