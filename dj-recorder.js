(function(){
'use strict';

var rec={display:null,media:null,chunks:[],started:0,timer:null,stopping:false};
function el(id){return document.getElementById(id)}
function setStatus(t){var s=el('status');if(s)s.textContent=t;var r=el('djRecState');if(r)r.textContent=t}
function fmt(sec){sec=Math.max(0,Math.floor(sec||0));return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0')}
function stopTracks(stream){if(!stream)return;stream.getTracks().forEach(function(t){try{t.stop()}catch(e){}})}
function supportedMime(){if(!window.MediaRecorder||!MediaRecorder.isTypeSupported)return '';var types=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus'];for(var i=0;i<types.length;i++)if(MediaRecorder.isTypeSupported(types[i]))return types[i];return ''}
function stamp(){var d=new Date(),p=function(v){return String(v).padStart(2,'0')};return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'_'+p(d.getHours())+'-'+p(d.getMinutes())+'-'+p(d.getSeconds())}
function downloadBlob(blob,mime){var ext=(mime||'').indexOf('ogg')>=0?'ogg':'webm',a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='MPC-DJ-Mix_'+stamp()+'.'+ext;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1500)}
function updateUi(active){var start=el('djRecStart'),stop=el('djRecStop');if(start)start.disabled=!!active;if(stop)stop.disabled=!active;if(start)start.classList.toggle('recording',!!active)}
function tick(){var n=el('djRecTimer');if(n)n.textContent=fmt((Date.now()-rec.started)/1000)}

async function start(){
 if(rec.media&&rec.media.state!=='inactive')return;
 if(!navigator.mediaDevices||typeof navigator.mediaDevices.getDisplayMedia!=='function'||!window.MediaRecorder){setStatus('Enregistrement du mix complet disponible sur Chrome/Edge PC');return}
 try{
  setStatus('Choisis « Cet onglet » et active « Partager l’audio »');
  var display=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});
  var audioTracks=display.getAudioTracks();
  if(!audioTracks.length){stopTracks(display);throw new Error('Aucun son partagé. Recommence et coche « Partager l’audio »')}
  var audioOnly=new MediaStream(audioTracks),mime=supportedMime(),opts={audioBitsPerSecond:192000};if(mime)opts.mimeType=mime;
  var mr=new MediaRecorder(audioOnly,opts);rec.display=display;rec.media=mr;rec.chunks=[];rec.started=Date.now();rec.stopping=false;
  mr.ondataavailable=function(e){if(e.data&&e.data.size)rec.chunks.push(e.data)};
  mr.onerror=function(){setStatus('Erreur pendant l’enregistrement du mix')};
  mr.onstop=function(){
   clearInterval(rec.timer);rec.timer=null;var type=mr.mimeType||mime||'audio/webm',blob=new Blob(rec.chunks,{type:type});stopTracks(rec.display);rec.display=null;rec.media=null;rec.stopping=false;updateUi(false);if(el('djRecTimer'))el('djRecTimer').textContent='00:00';
   if(blob.size){downloadBlob(blob,type);setStatus('Mix enregistré · YouTube + pads')}else setStatus('Enregistrement vide')
  };
  display.getTracks().forEach(function(t){t.addEventListener('ended',function(){if(rec.media&&rec.media.state!=='inactive')stop()},{once:true})});
  mr.start(1000);rec.timer=setInterval(tick,500);tick();updateUi(true);setStatus('● ENREGISTREMENT MIX EN COURS · YouTube + pads')
 }catch(e){stopTracks(rec.display);rec.display=null;rec.media=null;updateUi(false);setStatus(e&&e.message?e.message:'Enregistrement annulé')}
}
function stop(){if(!rec.media||rec.media.state==='inactive'||rec.stopping)return;rec.stopping=true;setStatus('Finalisation de l’enregistrement…');try{rec.media.stop()}catch(e){rec.stopping=false;setStatus('Impossible d’arrêter l’enregistrement')}}

function injectStyle(){if(el('djRecorderStyle'))return;var s=document.createElement('style');s.id='djRecorderStyle';s.textContent='.djRecorder{display:grid;gap:7px;margin-top:12px;padding:10px;border:1px solid #4b275d;border-radius:9px;background:#0b1018}.djRecorder>b{font-size:11px;color:#e6a3ff}.djRecorderBtns{display:grid;grid-template-columns:1fr 1fr;gap:6px}.djRecorder button{font-size:10px}.djRecorder button.recording{color:#ff6f80;border-color:#a33143;box-shadow:0 0 16px #ff405544}.djRecorderStatus{display:flex;justify-content:space-between;gap:8px;font-size:9px;color:#90a6b5}.djRecorder small{font-size:9px;line-height:1.4;color:#728998}@media(max-width:760px){.djRecorderBtns{grid-template-columns:1fr}}';document.head.appendChild(s)}
function inject(){var mixer=document.querySelector('#djWorkspace .djMixer');if(!mixer||el('djRecorder'))return false;injectStyle();var box=document.createElement('section');box.id='djRecorder';box.className='djRecorder';box.innerHTML='<b>⏺ ENREGISTREMENT DU MIX</b><div class="djRecorderBtns"><button id="djRecStart" type="button">● REC MIX COMPLET</button><button id="djRecStop" type="button" disabled>■ STOP & SAUVER</button></div><div class="djRecorderStatus"><span id="djRecState">Prêt à enregistrer</span><strong id="djRecTimer">00:00</strong></div><small>Sur PC : choisis <b>Cet onglet</b> et active <b>Partager l’audio</b>. Le fichier contient le son YouTube entendu dans DJ Mix + tes pads MPC + le crossfader. Aucun flux YouTube n’est téléchargé directement.</small>';var stopAll=el('djStopAll');if(stopAll)stopAll.insertAdjacentElement('afterend',box);else mixer.appendChild(box);el('djRecStart').onclick=start;el('djRecStop').onclick=stop;if(!navigator.mediaDevices||typeof navigator.mediaDevices.getDisplayMedia!=='function'){el('djRecStart').textContent='REC MIX · PC UNIQUEMENT';el('djRecState').textContent='Utilise Chrome/Edge sur PC pour le mix complet'}return true}
function init(){if(inject())return;var tries=0,t=setInterval(function(){tries++;if(inject()||tries>80)clearInterval(t)},100)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.MPCDJRecorder={start:start,stop:stop,isRecording:function(){return !!(rec.media&&rec.media.state!=='inactive')}};
})();
