(function(){
'use strict';

var rec={display:null,media:null,chunks:[],started:0,timer:null,stopping:false,mixCtx:null,mixDest:null,displaySource:null,padSource:null,padGain:null,padStream:null};
function el(id){return document.getElementById(id)}
function setStatus(t){var s=el('status');if(s)s.textContent=t;var r=el('djRecState');if(r)r.textContent=t}
function fmt(sec){sec=Math.max(0,Math.floor(sec||0));return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0')}
function stopTracks(stream){if(!stream)return;stream.getTracks().forEach(function(t){try{t.stop()}catch(e){}})}
function supportedMime(){if(!window.MediaRecorder||!MediaRecorder.isTypeSupported)return '';var types=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus'];for(var i=0;i<types.length;i++)if(MediaRecorder.isTypeSupported(types[i]))return types[i];return ''}
function stamp(){var d=new Date(),p=function(v){return String(v).padStart(2,'0')};return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'_'+p(d.getHours())+'-'+p(d.getMinutes())+'-'+p(d.getSeconds())}
function downloadBlob(blob,mime){var ext=(mime||'').indexOf('ogg')>=0?'ogg':'webm',a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='MPC-DJ-Mix_'+stamp()+'.'+ext;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},2500)}
function padLevel(){var n=el('djRecPadLevel');return Math.max(0,Math.min(1.5,Number(n&&n.value||100)/100))}
function updatePadLevel(){if(rec.padGain)rec.padGain.gain.value=padLevel();var o=el('djRecPadOut');if(o)o.textContent=Math.round(padLevel()*100)+'%'}
function updateUi(active){var start=el('djRecStart'),stop=el('djRecStop'),top=el('recBtn');if(start)start.disabled=!!active;if(stop)stop.disabled=!active;if(start)start.classList.toggle('recording',!!active);if(top){top.classList.toggle('active',!!active);top.title=active?'DJ MIX : arrêter et sauvegarder':'DJ MIX : enregistrer musique + pads'}}
function tick(){var n=el('djRecTimer');if(n)n.textContent=fmt((Date.now()-rec.started)/1000)}
function isRecording(){return !!(rec.media&&rec.media.state!=='inactive')}

function attachPadStream(stream){
 if(!rec.mixCtx||!rec.mixDest||!stream||!stream.getAudioTracks||!stream.getAudioTracks().length)return false;
 if(rec.padStream===stream&&rec.padSource)return true;
 try{
  if(rec.padSource){try{rec.padSource.disconnect()}catch(e){}}
  if(rec.padGain){try{rec.padGain.disconnect()}catch(e){}}
  rec.padStream=stream;rec.padSource=rec.mixCtx.createMediaStreamSource(stream);rec.padGain=rec.mixCtx.createGain();rec.padGain.gain.value=padLevel();rec.padSource.connect(rec.padGain);rec.padGain.connect(rec.mixDest);updatePadLevel();
  var badge=el('djRecPadState');if(badge){badge.textContent='PADS DIRECTS : OK';badge.classList.add('ok')}
  return true
 }catch(e){return false}
}
function attachCurrentPadTap(){try{return !!(window.MPCAudioTap&&attachPadStream(window.MPCAudioTap.getStream()))}catch(e){return false}}
window.addEventListener('mpc-audio-tap-ready',function(e){if(isRecording()&&e.detail&&e.detail.stream)attachPadStream(e.detail.stream)});

async function cleanupMixer(){
 stopTracks(rec.display);rec.display=null;
 try{if(rec.displaySource)rec.displaySource.disconnect()}catch(e){}
 try{if(rec.padSource)rec.padSource.disconnect()}catch(e){}
 try{if(rec.padGain)rec.padGain.disconnect()}catch(e){}
 if(rec.mixCtx){try{await rec.mixCtx.close()}catch(e){}}
 rec.mixCtx=null;rec.mixDest=null;rec.displaySource=null;rec.padSource=null;rec.padGain=null;rec.padStream=null;
}
async function start(){
 if(isRecording())return;
 if(!navigator.mediaDevices||typeof navigator.mediaDevices.getDisplayMedia!=='function'||!window.MediaRecorder){setStatus('Enregistrement du mix complet disponible sur Chrome/Edge PC');return}
 try{
  setStatus('Choisis « Cet onglet » puis active « Partager l’audio »');
  var display=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true}),audioTracks=display.getAudioTracks();
  if(!audioTracks.length){stopTracks(display);throw new Error('Aucun son partagé : recommence et coche « Partager l’audio »')}
  var AC=window.AudioContext||window.webkitAudioContext;if(!AC){stopTracks(display);throw new Error('AudioContext indisponible')}
  var mixCtx=new AC();if(mixCtx.state==='suspended')await mixCtx.resume();var mixDest=mixCtx.createMediaStreamDestination();
  var tabAudio=new MediaStream(audioTracks),displaySource=mixCtx.createMediaStreamSource(tabAudio);displaySource.connect(mixDest);
  rec.display=display;rec.mixCtx=mixCtx;rec.mixDest=mixDest;rec.displaySource=displaySource;rec.padSource=null;rec.padGain=null;rec.padStream=null;
  attachCurrentPadTap();
  var mime=supportedMime(),opts={audioBitsPerSecond:192000};if(mime)opts.mimeType=mime;
  var mr=new MediaRecorder(mixDest.stream,opts);rec.media=mr;rec.chunks=[];rec.started=Date.now();rec.stopping=false;
  mr.ondataavailable=function(e){if(e.data&&e.data.size)rec.chunks.push(e.data)};
  mr.onerror=function(){setStatus('Erreur pendant l’enregistrement du mix')};
  mr.onstop=async function(){
   clearInterval(rec.timer);rec.timer=null;var type=mr.mimeType||mime||'audio/webm',blob=new Blob(rec.chunks,{type:type});await cleanupMixer();rec.media=null;rec.stopping=false;updateUi(false);if(el('djRecTimer'))el('djRecTimer').textContent='00:00';
   var badge=el('djRecPadState');if(badge){badge.textContent='PADS DIRECTS : EN ATTENTE';badge.classList.remove('ok')}
   if(blob.size){downloadBlob(blob,type);setStatus('Mix sauvegardé · musique + pads MPC')}else setStatus('Enregistrement vide')
  };
  display.getTracks().forEach(function(t){t.addEventListener('ended',function(){if(isRecording())stop()},{once:true})});
  mr.start(500);rec.timer=setInterval(tick,500);tick();updateUi(true);setStatus('● REC MIX · musique + pads MPC')
 }catch(e){await cleanupMixer();rec.media=null;rec.stopping=false;updateUi(false);setStatus(e&&e.message?e.message:'Enregistrement annulé')}
}
function stop(){if(!isRecording()||rec.stopping)return;rec.stopping=true;setStatus('Finalisation du mix…');try{rec.media.stop()}catch(e){rec.stopping=false;setStatus('Impossible d’arrêter l’enregistrement')}}

function bindTopRecord(){
 var b=el('recBtn');if(!b||b.dataset.djMixRecorder==='1')return false;b.dataset.djMixRecorder='1';
 b.addEventListener('click',function(e){
  if(document.body.dataset.mode!=='dj')return;
  e.preventDefault();e.stopImmediatePropagation();if(isRecording())stop();else start();
 },true);
 return true
}
function injectStyle(){if(el('djRecorderStyle'))return;var s=document.createElement('style');s.id='djRecorderStyle';s.textContent='.djRecorder{display:grid;gap:8px;margin-top:12px;padding:11px;border:1px solid #4b275d;border-radius:9px;background:#0b1018}.djRecorder>b{font-size:11px;color:#e6a3ff}.djRecorderBtns{display:grid;grid-template-columns:1fr 1fr;gap:6px}.djRecorder button{font-size:10px}.djRecorder button.recording{color:#ff6f80;border-color:#a33143;box-shadow:0 0 16px #ff405544}.djRecorderStatus{display:flex;justify-content:space-between;gap:8px;font-size:9px;color:#90a6b5}.djRecorderPad{display:grid;grid-template-columns:auto 1fr auto;gap:7px;align-items:center;font-size:9px;color:#91a6b4}.djRecorderPad input{width:100%;accent-color:#d475ff}.djRecorderPad output{min-width:34px;text-align:right}.djRecPadState{font-size:9px;color:#d4a3ed}.djRecPadState.ok{color:#67f39b}.djRecorder small{font-size:9px;line-height:1.45;color:#728998}@media(max-width:760px){.djRecorderBtns{grid-template-columns:1fr}.djRecorderPad{grid-template-columns:1fr}.djRecorderPad output{text-align:left}}';document.head.appendChild(s)}
function inject(){
 var mixer=document.querySelector('#djWorkspace .djMixer');if(!mixer||el('djRecorder'))return false;injectStyle();var box=document.createElement('section');box.id='djRecorder';box.className='djRecorder';
 box.innerHTML='<b>⏺ ENREGISTREMENT DU MIX</b><div class="djRecorderBtns"><button id="djRecStart" type="button">● REC MUSIQUE + PADS</button><button id="djRecStop" type="button" disabled>■ STOP & SAUVER</button></div><div class="djRecorderStatus"><span id="djRecState">Prêt à enregistrer</span><strong id="djRecTimer">00:00</strong></div><div class="djRecorderPad"><span>NIVEAU PADS DANS LE FICHIER</span><input id="djRecPadLevel" type="range" min="0" max="150" value="100"><output id="djRecPadOut">100%</output></div><span id="djRecPadState" class="djRecPadState">PADS DIRECTS : EN ATTENTE</span><small>Le son des pads MPC est maintenant ajouté directement au fichier, indépendamment du partage d’onglet. Sur PC, choisis <b>Cet onglet</b> et coche <b>Partager l’audio</b> pour ajouter la musique YouTube. Le bouton rouge REC du haut lance aussi cet enregistrement quand tu es en DJ MIX. Si les pads paraissent doublés dans le fichier, baisse leur niveau ici.</small>';
 var stopAll=el('djStopAll');if(stopAll)stopAll.insertAdjacentElement('afterend',box);else mixer.appendChild(box);el('djRecStart').onclick=start;el('djRecStop').onclick=stop;el('djRecPadLevel').oninput=updatePadLevel;bindTopRecord();if(!navigator.mediaDevices||typeof navigator.mediaDevices.getDisplayMedia!=='function'){el('djRecStart').textContent='REC MIX · PC UNIQUEMENT';el('djRecState').textContent='Utilise Chrome/Edge sur PC pour musique + pads'}return true
}
function init(){bindTopRecord();if(inject())return;var tries=0,t=setInterval(function(){tries++;bindTopRecord();if(inject()||tries>100)clearInterval(t)},100)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.MPCDJRecorder={start:start,stop:stop,isRecording:isRecording};
})();
