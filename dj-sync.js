(function(){
'use strict';

var STORE='mpc-dj-beat-sync-v1';
var state={
 A:{enabled:false,bpm:120,origin:0,division:.25,taps:[]},
 B:{enabled:false,bpm:120,origin:0,division:.25,taps:[]}
};
var timer=null;
function el(id){return document.getElementById(id)}
function clamp(v,a,b){return Math.min(b,Math.max(a,Number(v)||0))}
function decks(){return window.MPCDJ&&window.MPCDJ.decks?window.MPCDJ.decks:null}
function deck(key){var d=decks();return d&&d[key]}
function safe(d,method){try{if(d&&d.player&&d.ready&&typeof d.player[method]==='function')return d.player[method]()}catch(e){}return null}
function status(t){var s=el('status');if(s)s.textContent=t}
function load(){
 try{
  var x=JSON.parse(localStorage.getItem(STORE)||'{}');
  ['A','B'].forEach(function(k){if(x[k]){state[k].enabled=!!x[k].enabled;state[k].bpm=clamp(x[k].bpm||120,40,240);state[k].origin=Number(x[k].origin)||0;state[k].division=[1,.5,.25,.125].indexOf(Number(x[k].division))>=0?Number(x[k].division):.25}})
 }catch(e){}
}
function save(){try{localStorage.setItem(STORE,JSON.stringify({A:{enabled:state.A.enabled,bpm:state.A.bpm,origin:state.A.origin,division:state.A.division},B:{enabled:state.B.enabled,bpm:state.B.bpm,origin:state.B.origin,division:state.B.division}}))}catch(e){}}
function currentTime(key){var d=deck(key),v=safe(d,'getCurrentTime');return Number(v)||0}
function playbackRate(key){var d=deck(key),v=safe(d,'getPlaybackRate');return Math.max(.25,Number(v)||1)}
function isPlaying(key){
 var d=deck(key);try{var Y=window.YT&&window.YT.PlayerState;return !!(d&&d.ready&&d.player&&Y&&d.player.getPlayerState()===Y.PLAYING)}catch(e){return false}
}
function effectiveBeatSeconds(key){return 60/clamp(state[key].bpm,40,240)}
function quantInterval(key){return effectiveBeatSeconds(key)*state[key].division}
function nextDelay(key){
 var s=state[key],now=currentTime(key),interval=quantInterval(key),origin=Number(s.origin)||0,rate=playbackRate(key);
 if(!interval||!isFinite(interval))return 0;
 var phase=(now-origin)/interval;
 var next=Math.ceil(phase-.002);
 var target=origin+next*interval;
 var mediaDelay=Math.max(0,target-now);
 return mediaDelay/rate;
}
function flash(button,delay){setTimeout(function(){if(!button)return;button.classList.add('hit','synced');setTimeout(function(){button.classList.remove('hit','synced')},120)},Math.max(0,delay*1000))}
function playSynced(key,padId,button){
 var delay=nextDelay(key);flash(button,delay);
 try{
  var ac=window.MPCAudioTap&&window.MPCAudioTap.getContext&&window.MPCAudioTap.getContext();
  if(ac&&typeof window.playPad==='function'){
   if(ac.state==='suspended'&&ac.resume)ac.resume();
   window.playPad(padId,ac.currentTime+delay);
  }else if(typeof window.playPad==='function'){
   setTimeout(function(){try{window.playPad(padId)}catch(e){}},Math.max(0,delay*1000));
  }else return false;
  status('SYNC Deck '+key+' · '+padId+' · '+state[key].bpm.toFixed(1)+' BPM');
  return true
 }catch(e){return false}
}
function capturePad(e){
 if(document.body.dataset.mode!=='dj')return;
 var b=e.target&&e.target.closest?e.target.closest('.djPerfPad'):null;if(!b)return;
 var article=b.closest('.djDeck'),key=article&&article.dataset.deck;if(!key||!state[key]||!state[key].enabled||!isPlaying(key))return;
 var padId=b.dataset.pad;if(!padId)return;
 e.preventDefault();e.stopImmediatePropagation();playSynced(key,padId,b)
}
function setOrigin(key,label){
 var d=deck(key);if(!d||!d.ready){status('Deck '+key+' : charge et lance d’abord un morceau');return}
 state[key].origin=currentTime(key);state[key].enabled=true;save();syncUi(key);status('Deck '+key+' · '+(label||'temps 1 calé')+' à '+state[key].bpm.toFixed(1)+' BPM')
}
function tap(key){
 var s=state[key],now=performance.now();s.taps=s.taps.filter(function(t){return now-t<3000});s.taps.push(now);if(s.taps.length>8)s.taps.shift();
 if(s.taps.length>=2){var sum=0;for(var i=1;i<s.taps.length;i++)sum+=s.taps[i]-s.taps[i-1];var bpm=60000/(sum/(s.taps.length-1));while(bpm<70)bpm*=2;while(bpm>180)bpm/=2;s.bpm=clamp(bpm,40,240);state[key].origin=currentTime(key);state[key].enabled=true;save();syncUi(key);status('Deck '+key+' · TAP '+s.bpm.toFixed(1)+' BPM · SYNC activé')}else status('Deck '+key+' · tape encore le tempo')
}
function nudge(key,seconds){state[key].origin+=(Number(seconds)||0);save();status('Deck '+key+' · grille décalée '+(seconds>0?'+':'')+Math.round(seconds*1000)+' ms')}
function syncUi(key){
 var s=state[key],on=el('djSyncOn'+key),bpm=el('djSyncBpm'+key),div=el('djSyncDiv'+key);if(on){on.classList.toggle('active',s.enabled);on.textContent=s.enabled?'✓ SYNC PADS ON':'SYNC PADS OFF'}if(bpm)bpm.value=Number(s.bpm).toFixed(1);if(div)div.value=String(s.division)
}
function beatNumber(key){
 var s=state[key],beat=effectiveBeatSeconds(key),now=currentTime(key);if(!beat)return 1;var n=Math.floor((now-s.origin)/beat);return ((n%4)+4)%4+1
}
function updateBeatUi(){
 ['A','B'].forEach(function(key){var d=deck(key),s=state[key],lamp=el('djSyncBeat'+key),phase=el('djSyncPhase'+key);if(!lamp||!d)return;var b=beatNumber(key);lamp.textContent=String(b);lamp.classList.toggle('live',s.enabled&&isPlaying(key));if(phase){var beat=effectiveBeatSeconds(key),now=currentTime(key),p=beat?((((now-s.origin)%beat)+beat)%beat)/beat:0;phase.style.setProperty('--phase',(p*100).toFixed(1)+'%')}})
}
function controls(key){
 return '<div class="djBeatSync" id="djBeatSync'+key+'">'+
 '<div class="djBeatSyncHead"><div><small>BEAT SYNC PADS</small><b>GRILLE DECK '+key+'</b></div><span id="djSyncBeat'+key+'" class="djSyncBeat">1</span></div>'+
 '<div id="djSyncPhase'+key+'" class="djSyncPhase"><i></i></div>'+
 '<div class="djBeatSyncGrid">'+
 '<button id="djSyncOn'+key+'" type="button">SYNC PADS OFF</button>'+
 '<label>BPM<input id="djSyncBpm'+key+'" type="number" min="40" max="240" step="0.1" value="120"></label>'+
 '<button id="djSyncTap'+key+'" type="button">TAP BPM</button>'+
 '<button id="djSyncSet'+key+'" type="button">CALER TEMPS 1</button>'+
 '<label>QUANTIF.<select id="djSyncDiv'+key+'"><option value="1">1 TEMPS</option><option value="0.5">1/2 TEMPS</option><option value="0.25" selected>1/4 TEMPS (1/16)</option><option value="0.125">1/8 TEMPS (1/32)</option></select></label>'+
 '<div class="djSyncNudge"><button id="djSyncMinus'+key+'" type="button">−20 ms</button><button id="djSyncPlus'+key+'" type="button">+20 ms</button></div>'+
 '</div><small class="djBeatSyncHint">TAP BPM au rythme du morceau, puis CALER TEMPS 1 sur un kick. Les pads seront quantifiés sur la grille et restent enregistrés dans REC MIX.</small></div>'
}
function injectStyle(){if(el('djBeatSyncStyle'))return;var s=document.createElement('style');s.id='djBeatSyncStyle';s.textContent='.djBeatSync{margin:0 0 9px;padding:9px;border:1px solid #315068;border-radius:9px;background:linear-gradient(180deg,#0b1620,#071019);display:grid;gap:7px}.djBeatSyncHead{display:flex;align-items:center;justify-content:space-between;gap:8px}.djBeatSyncHead>div{display:grid}.djBeatSyncHead small{font-size:8px;color:#7391a5}.djBeatSyncHead b{font-size:10px;color:#64d6ff}.djSyncBeat{width:31px;height:31px;border-radius:50%;display:grid;place-items:center;border:1px solid #315468;color:#7e9aaa;font-weight:900}.djSyncBeat.live{color:#08110c;background:#64f29a;border-color:#64f29a;box-shadow:0 0 16px #42ef8b77}.djSyncPhase{--phase:0%;height:5px;border-radius:999px;background:#051018;border:1px solid #213d4f;overflow:hidden}.djSyncPhase i{display:block;height:100%;width:var(--phase);background:linear-gradient(90deg,#52d5ff,#d376ff)}.djBeatSyncGrid{display:grid;grid-template-columns:1.25fr .7fr .8fr 1fr;gap:5px;align-items:end}.djBeatSyncGrid button{font-size:8px;min-height:32px;padding:5px}.djBeatSyncGrid button.active{color:#69f39c;border-color:#2d8c55;box-shadow:0 0 10px #31ef7b33}.djBeatSyncGrid label{display:grid;gap:3px;font-size:8px;color:#7892a4}.djBeatSyncGrid input,.djBeatSyncGrid select{width:100%;min-height:32px;font-size:10px;padding:4px}.djBeatSyncGrid label:nth-of-type(2){grid-column:1/3}.djSyncNudge{display:grid;grid-template-columns:1fr 1fr;gap:4px;grid-column:3/5}.djBeatSyncHint{font-size:8px;line-height:1.35;color:#708897}.djPerfPad.synced{border-color:#64f29a!important;box-shadow:0 0 20px #40ee8a88,inset 0 0 20px #40ee8a33!important}@media(max-width:760px){.djBeatSyncGrid{grid-template-columns:1fr 1fr}.djBeatSyncGrid label:nth-of-type(2),.djSyncNudge{grid-column:auto}.djSyncNudge{grid-column:1/-1}}';document.head.appendChild(s)}
function bind(key){
 var s=state[key];
 el('djSyncOn'+key).onclick=function(){s.enabled=!s.enabled;save();syncUi(key);status('Deck '+key+' · SYNC PADS '+(s.enabled?'activé':'désactivé'))};
 el('djSyncBpm'+key).onchange=function(){s.bpm=clamp(this.value,40,240);this.value=s.bpm.toFixed(1);save();status('Deck '+key+' · '+s.bpm.toFixed(1)+' BPM')};
 el('djSyncTap'+key).onclick=function(){tap(key)};el('djSyncSet'+key).onclick=function(){setOrigin(key,'temps 1 calé')};
 el('djSyncDiv'+key).onchange=function(){s.division=Number(this.value)||.25;save();status('Deck '+key+' · quantification mise à jour')};
 el('djSyncMinus'+key).onclick=function(){nudge(key,-.02)};el('djSyncPlus'+key).onclick=function(){nudge(key,.02)};syncUi(key)
}
function inject(){
 var workspace=el('djWorkspace');if(!workspace||!window.MPCDJ)return false;injectStyle();
 ['A','B'].forEach(function(key){if(el('djBeatSync'+key))return;var sec=workspace.querySelector('.djDeck[data-deck="'+key+'"] .djPadSection');if(!sec)return;var wrap=document.createElement('div');wrap.innerHTML=controls(key);sec.insertBefore(wrap.firstElementChild,sec.querySelector('.djPads'));bind(key)});
 if(!timer)timer=setInterval(updateBeatUi,80);return !!(el('djBeatSyncA')&&el('djBeatSyncB'))
}
function init(){load();document.addEventListener('pointerdown',capturePad,true);if(inject())return;var n=0,t=setInterval(function(){n++;if(inject()||n>120)clearInterval(t)},100)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.MPCDJSync={state:state,tap:tap,setBeat:function(key){setOrigin(String(key||'A').toUpperCase(),'temps 1 calé')},enable:function(key,on){key=String(key||'A').toUpperCase();if(state[key]){state[key].enabled=on!==false;save();syncUi(key)}}};
})();
