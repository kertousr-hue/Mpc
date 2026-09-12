(function(){
'use strict';

const PAD_LABELS=['Kick','Snare','Hi-Hat','Perc','Clap','Rim','Tom','Shaker','Bass','Synth','FX Vox','Cymbal','Chord','Lead','Texture','Stab'];
const decks={
 A:{key:'A',player:null,ready:false,videoId:'',cue:0,loop:null,rates:[1],drag:null,padBank:'A',padPage:0},
 B:{key:'B',player:null,ready:false,videoId:'',cue:0,loop:null,rates:[1],drag:null,padBank:'A',padPage:0}
};
let ytPromise=null,ticker=null;

function el(id){return document.getElementById(id)}
function setStatus(message){const s=el('status');if(s)s.textContent=message}
function fmt(seconds){seconds=Math.max(0,Number(seconds)||0);const m=Math.floor(seconds/60),s=Math.floor(seconds%60);return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')}
function safe(deck,method,...args){try{if(deck.player&&deck.ready&&typeof deck.player[method]==='function')return deck.player[method](...args)}catch(e){}return null}

function extractVideoId(input){
 const raw=String(input||'').trim();
 if(/^[\w-]{11}$/.test(raw))return raw;
 try{
  const withProto=/^https?:\/\//i.test(raw)?raw:'https://'+raw;
  const url=new URL(withProto),host=url.hostname.replace(/^www\./,'').toLowerCase();
  if(host==='youtu.be')return (url.pathname.split('/').filter(Boolean)[0]||'').slice(0,11);
  if(host==='youtube.com'||host.endsWith('.youtube.com')){
   const v=url.searchParams.get('v');if(v&&/^[\w-]{11}$/.test(v))return v;
   const parts=url.pathname.split('/').filter(Boolean);
   if(['shorts','embed','live'].includes(parts[0])&&parts[1]&&/^[\w-]{11}$/.test(parts[1]))return parts[1];
  }
 }catch(e){}
 return '';
}

function loadYouTubeApi(){
 if(window.YT&&window.YT.Player)return Promise.resolve(window.YT);
 if(ytPromise)return ytPromise;
 ytPromise=new Promise((resolve,reject)=>{
  const previous=window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady=function(){try{if(typeof previous==='function')previous()}catch(e){}resolve(window.YT)};
  let script=document.querySelector('script[data-mpc-youtube-api]');
  if(!script){script=document.createElement('script');script.dataset.mpcYoutubeApi='1';script.src='https://www.youtube.com/iframe_api';script.async=true;script.onerror=()=>reject(new Error('Impossible de charger YouTube'));document.head.appendChild(script)}
  setTimeout(()=>{if(window.YT&&window.YT.Player)resolve(window.YT)},1200);
 });
 return ytPromise;
}

function deckHtml(key){
 return `<article class="djDeck" data-deck="${key}">
  <div class="djDeckHead"><div><small>PLATINE</small><h2>DECK ${key}</h2></div><span id="djState${key}" class="djState">VIDE</span></div>
  <div class="djLoadRow"><input id="djUrl${key}" type="url" inputmode="url" autocomplete="off" placeholder="Colle un lien YouTube…"><button id="djLoad${key}" type="button">CHARGER</button></div>
  <div class="djVideo"><div id="djPlayer${key}" class="djPlayerPlaceholder"><span>YOUTUBE ${key}</span></div></div>
  <div class="djTrackInfo"><strong id="djTitle${key}">Aucun morceau chargé</strong><span id="djTime${key}">00:00 / 00:00</span></div>
  <input id="djSeek${key}" class="djSeek" type="range" min="0" max="1000" value="0" aria-label="Position platine ${key}">
  <div id="djPlatter${key}" class="djPlatter" role="slider" tabindex="0" aria-label="Jog wheel platine ${key}"><span>${key}</span><i></i></div>
  <div class="djTransport">
   <button id="djBack${key}" type="button">−2 s</button>
   <button id="djCue${key}" type="button">CUE</button>
   <button id="djPlay${key}" class="djPlay" type="button">▶ PLAY</button>
   <button id="djPause${key}" type="button">Ⅱ</button>
   <button id="djFwd${key}" type="button">+2 s</button>
  </div>
  <div class="djTools">
   <button id="djSetCue${key}" type="button">● SET CUE</button>
   <button id="djLoop${key}" type="button">↻ LOOP 8 s</button>
  </div>
  <section class="djPadSection">
   <div class="djPadHead"><b>PERFORMANCE PADS</b><div><label>BANQUE <select id="djPadBank${key}"><option>A</option><option>B</option><option>C</option><option>D</option></select></label><button id="djPadPage${key}" type="button">PADS 1–8</button></div></div>
   <div id="djPads${key}" class="djPads"></div>
  </section>
  <div class="djFaders">
   <label>VOLUME <input id="djVol${key}" type="range" min="0" max="100" value="90"><output id="djVolOut${key}">90%</output></label>
   <label>VITESSE <select id="djRate${key}"><option value="1">1.00×</option></select></label>
  </div>
 </article>`;
}

function injectUi(){
 if(el('djWorkspace'))return;
 const nav=document.querySelector('.bigModes'),workspace=document.querySelector('.workspace');
 if(!nav||!workspace)return;
 const mode=document.createElement('button');
 mode.type='button';mode.dataset.mode='dj';mode.className='dj';
 mode.innerHTML='<b>🎧 DJ MIX</b><small>2 PLATINES · YOUTUBE · PADS · CROSSFADER</small>';
 nav.appendChild(mode);
 const section=document.createElement('section');section.id='djWorkspace';section.className='djWorkspace';
 section.innerHTML=`${deckHtml('A')}
  <aside class="djMixer panel">
   <div class="djMixerHead"><small>MIXEUR DJ</small><h2>MASTER</h2><p>Colle un lien YouTube sur chaque platine, lance les pads MPC et mélange A/B avec le crossfader.</p></div>
   <div class="djCrossWrap"><span>A</span><input id="djCross" type="range" min="0" max="100" value="50" aria-label="Crossfader"><span>B</span></div>
   <div class="djCrossLabels"><b id="djMixA">A 71%</b><b id="djMixB">B 71%</b></div>
   <button id="djStopAll" class="djStopAll" type="button">■ STOP DECK A + B</button>
   <div class="djHelp"><b>Mode YouTube + Pads</b><span>Play/Pause, CUE, recherche dans le morceau, jog seek, volume, vitesse disponible, 16 pads par banque et crossfader.</span><small>Les pads utilisent les sons de ta MPC. Les banques B/C/D jouent les samples que tu leur as assignés.</small></div>
  </aside>
 ${deckHtml('B')}`;
 workspace.insertAdjacentElement('afterend',section);
 bindModeButton(mode);
 bindMixer();
 ['A','B'].forEach(bindDeck);
 if(new URLSearchParams(location.search).get('mode')==='dj')mode.click();
 ticker=setInterval(updateAll,250);
}

function bindModeButton(button){
 button.addEventListener('click',()=>{
  document.body.dataset.mode='dj';
  document.querySelectorAll('.bigModes button').forEach(b=>b.classList.toggle('active',b===button));
  setStatus('DJ MIX · 2 platines YouTube + performance pads');
 });
}

function bindMixer(){
 el('djCross').addEventListener('input',applyMixer);
 el('djStopAll').addEventListener('click',()=>{['A','B'].forEach(k=>{safe(decks[k],'stopVideo');decks[k].loop=null;el('djLoop'+k).classList.remove('active')});setStatus('Platines A et B arrêtées')});
 const master=el('master');if(master)master.addEventListener('input',applyMixer);
}

function bindDeck(key){
 const d=decks[key];
 el('djLoad'+key).addEventListener('click',()=>loadDeck(key));
 el('djUrl'+key).addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();loadDeck(key)}});
 el('djPlay'+key).addEventListener('click',()=>safe(d,'playVideo'));
 el('djPause'+key).addEventListener('click',()=>safe(d,'pauseVideo'));
 el('djBack'+key).addEventListener('click',()=>nudge(key,-2));
 el('djFwd'+key).addEventListener('click',()=>nudge(key,2));
 el('djSetCue'+key).addEventListener('click',()=>{const t=Number(safe(d,'getCurrentTime'))||0;d.cue=t;setStatus(`Deck ${key} · CUE placé à ${fmt(t)}`)});
 el('djCue'+key).addEventListener('click',()=>{safe(d,'pauseVideo');safe(d,'seekTo',d.cue||0,true);setStatus(`Deck ${key} · retour CUE`)});
 el('djLoop'+key).addEventListener('click',()=>toggleLoop(key));
 el('djVol'+key).addEventListener('input',e=>{el('djVolOut'+key).textContent=e.target.value+'%';applyMixer()});
 el('djRate'+key).addEventListener('change',e=>{safe(d,'setPlaybackRate',Number(e.target.value)||1);setStatus(`Deck ${key} · vitesse ${e.target.value}×`)});
 el('djSeek'+key).addEventListener('input',e=>{const dur=Number(safe(d,'getDuration'))||0;if(dur)safe(d,'seekTo',dur*(Number(e.target.value)/1000),true)});
 el('djPadBank'+key).addEventListener('change',e=>{d.padBank=e.target.value;renderDjPads(key)});
 el('djPadPage'+key).addEventListener('click',()=>{d.padPage=d.padPage?0:1;renderDjPads(key)});
 renderDjPads(key);
 bindPlatter(key);
}

function renderDjPads(key){
 const d=decks[key],root=el('djPads'+key),pageBtn=el('djPadPage'+key);if(!root)return;
 root.innerHTML='';
 const start=d.padPage*8;
 for(let i=0;i<8;i++){
  const index=start+i,padId=d.padBank+String(index+1).padStart(2,'0'),button=document.createElement('button');
  button.type='button';button.className='djPerfPad';button.dataset.pad=padId;
  const label=d.padBank==='A'?(PAD_LABELS[index]||('Pad '+(index+1))):('Pad '+(index+1));
  button.innerHTML=`<span>${padId}</span><b>${label}</b>`;
  button.addEventListener('pointerdown',e=>{e.preventDefault();triggerDjPad(key,padId,button)});
  root.appendChild(button);
 }
 if(pageBtn)pageBtn.textContent=d.padPage?'PADS 9–16':'PADS 1–8';
}

function triggerDjPad(deckKey,padId,button){
 button.classList.add('hit');setTimeout(()=>button.classList.remove('hit'),110);
 if(typeof window.playPad==='function'){
  try{window.playPad(padId);setStatus(`Deck ${deckKey} · ${padId}`);return}catch(e){}
 }
 setStatus(`Pad ${padId} indisponible`);
}

function bindPlatter(key){
 const d=decks[key],p=el('djPlatter'+key);
 p.addEventListener('pointerdown',e=>{if(!d.ready)return;p.setPointerCapture(e.pointerId);d.drag={x:e.clientX,time:Number(safe(d,'getCurrentTime'))||0};p.classList.add('scratching')});
 p.addEventListener('pointermove',e=>{if(!d.drag)return;const target=Math.max(0,d.drag.time+(e.clientX-d.drag.x)*0.045);safe(d,'seekTo',target,true)});
 const end=e=>{if(d.drag){d.drag=null;p.classList.remove('scratching');try{p.releasePointerCapture(e.pointerId)}catch(err){}}};
 p.addEventListener('pointerup',end);p.addEventListener('pointercancel',end);
 p.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();nudge(key,-1)}if(e.key==='ArrowRight'){e.preventDefault();nudge(key,1)}});
}

function nudge(key,seconds){
 const d=decks[key],t=Number(safe(d,'getCurrentTime'))||0,dur=Number(safe(d,'getDuration'))||0;
 safe(d,'seekTo',Math.max(0,Math.min(dur||Infinity,t+seconds)),true);
}

function toggleLoop(key){
 const d=decks[key],btn=el('djLoop'+key);
 if(d.loop){d.loop=null;btn.classList.remove('active');setStatus(`Deck ${key} · boucle désactivée`);return}
 const start=Number(safe(d,'getCurrentTime'))||0;d.loop={start,end:start+8};btn.classList.add('active');setStatus(`Deck ${key} · boucle 8 s activée`);
}

async function loadDeck(key){
 const d=decks[key],input=el('djUrl'+key),id=extractVideoId(input.value);
 if(!id){setStatus(`Deck ${key} · lien YouTube invalide`);input.focus();return}
 el('djState'+key).textContent='CHARGEMENT';el('djTitle'+key).textContent='YouTube · '+id;
 try{
  await loadYouTubeApi();
  if(d.player){d.videoId=id;d.cue=0;d.loop=null;el('djLoop'+key).classList.remove('active');d.player.cueVideoById(id);setStatus(`Deck ${key} · morceau YouTube chargé`);return}
  d.videoId=id;
  d.player=new YT.Player('djPlayer'+key,{
   width:'100%',height:'100%',videoId:id,
   playerVars:{playsinline:1,controls:1,rel:0,iv_load_policy:3},
   events:{
    onReady:()=>onReady(key),
    onStateChange:e=>onState(key,e.data),
    onPlaybackRateChange:e=>{const rate=Number(e.data)||1;const sel=el('djRate'+key);if([...sel.options].some(o=>Number(o.value)===rate))sel.value=String(rate)},
    onError:e=>onError(key,e.data)
   }
  });
 }catch(error){el('djState'+key).textContent='ERREUR';setStatus(`Deck ${key} · ${error.message||'erreur YouTube'}`)}
}

function onReady(key){
 const d=decks[key];d.ready=true;el('djState'+key).textContent='PRÊT';
 try{const rates=d.player.getAvailablePlaybackRates();if(Array.isArray(rates)&&rates.length)d.rates=rates}catch(e){}
 const sel=el('djRate'+key);sel.innerHTML='';d.rates.forEach(r=>{const o=document.createElement('option');o.value=String(r);o.textContent=Number(r).toFixed(2)+'×';sel.appendChild(o)});if(d.rates.includes(1))sel.value='1';
 applyMixer();updateDeck(key);setStatus(`Deck ${key} · prêt`);
}

function onState(key,state){
 const label=el('djState'+key);if(!label)return;
 const Y=window.YT&&YT.PlayerState;
 if(Y&&state===Y.PLAYING)label.textContent='PLAY';else if(Y&&state===Y.PAUSED)label.textContent='PAUSE';else if(Y&&state===Y.BUFFERING)label.textContent='BUFFER';else if(Y&&state===Y.ENDED)label.textContent='FIN';else label.textContent='PRÊT';
}

function onError(key,code){
 const messages={2:'lien ou ID invalide',5:'lecture HTML5 impossible',100:'vidéo introuvable',101:'intégration interdite par la vidéo',150:'intégration interdite par la vidéo'};
 el('djState'+key).textContent='ERREUR';setStatus(`Deck ${key} · ${messages[code]||('erreur YouTube '+code)}`);
}

function updateAll(){updateDeck('A');updateDeck('B');applyMixer(false)}
function updateDeck(key){
 const d=decks[key];if(!d.ready)return;
 const current=Number(safe(d,'getCurrentTime'))||0,dur=Number(safe(d,'getDuration'))||0;
 if(d.loop&&current>=d.loop.end)safe(d,'seekTo',d.loop.start,true);
 el('djTime'+key).textContent=fmt(current)+' / '+fmt(dur);
 if(dur&&!d.drag)el('djSeek'+key).value=String(Math.round(current/dur*1000));
 try{const data=d.player.getVideoData&&d.player.getVideoData();if(data&&data.title)el('djTitle'+key).textContent=data.title}catch(e){}
 const platter=el('djPlatter'+key);if(platter)platter.style.setProperty('--turn',((current*28)%360)+'deg');
}

function applyMixer(show=true){
 const cross=Number(el('djCross')?.value||50)/100,master=Math.max(0,Math.min(1,Number(el('master')?.value||100)/100));
 const aMix=Math.cos(cross*Math.PI/2),bMix=Math.sin(cross*Math.PI/2);
 const aVol=Number(el('djVolA')?.value||90)/100,bVol=Number(el('djVolB')?.value||90)/100;
 safe(decks.A,'setVolume',Math.round(100*aVol*aMix*master));safe(decks.B,'setVolume',Math.round(100*bVol*bMix*master));
 if(el('djMixA'))el('djMixA').textContent='A '+Math.round(aMix*100)+'%';if(el('djMixB'))el('djMixB').textContent='B '+Math.round(bMix*100)+'%';
 if(show)setStatus('DJ MIX · crossfader A '+Math.round(aMix*100)+'% / B '+Math.round(bMix*100)+'%');
}

function init(){injectUi()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.MPCDJ={load:function(key,url){const k=String(key||'A').toUpperCase();if(!decks[k])return false;el('djUrl'+k).value=url||'';loadDeck(k);return true},decks:decks};
})();
