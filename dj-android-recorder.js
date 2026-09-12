(function(){
'use strict';
if(!/Android/i.test(navigator.userAgent||''))return;
var rec={ctx:null,dest:null,mic:null,micSource:null,padSource:null,padGain:null,media:null,chunks:[],started:0,timer:null};
function el(id){return document.getElementById(id)}
function setStatus(t){var s=el('status');if(s)s.textContent=t;var r=el('djAndroidRecState');if(r)r.textContent=t}
function stamp(){var d=new Date(),p=function(v){return String(v).padStart(2,'0')};return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'_'+p(d.getHours())+'-'+p(d.getMinutes())+'-'+p(d.getSeconds())}
function fmt(sec){sec=Math.max(0,Math.floor(sec||0));return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0')}
function mime(){if(!window.MediaRecorder||!MediaRecorder.isTypeSupported)return '';var a=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus'];for(var i=0;i<a.length;i++)if(MediaRecorder.isTypeSupported(a[i]))return a[i];return ''}
function download(blob,type){var ext=(type||'').indexOf('ogg')>=0?'ogg':'webm',a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='MPC-DJ-Android_'+stamp()+'.'+ext;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},2500)}
function stopTracks(s){if(s&&s.getTracks)s.getTracks().forEach(function(t){try{t.stop()}catch(e){}})}
function padLevel(){var x=el('djAndroidPadLevel');return Math.max(0,1.5*(Number(x&&x.value||70)/100))}
function updatePadLevel(){if(rec.padGain)rec.padGain.gain.value=padLevel();var o=el('djAndroidPadOut');if(o)o.textContent=Math.round(padLevel()*100)+'%'}
function cleanup(){stopTracks(rec.mic);try{if(rec.micSource)rec.micSource.disconnect()}catch(e){}try{if(rec.padSource)rec.padSource.disconnect()}catch(e){}try{if(rec.padGain)rec.padGain.disconnect()}catch(e){}if(rec.ctx){try{rec.ctx.close()}catch(e){}}rec.ctx=rec.dest=rec.mic=rec.micSource=rec.padSource=rec.padGain=rec.media=null;clearInterval(rec.timer);rec.timer=null}
function ui(active){var s=el('djAndroidRecStart'),x=el('djAndroidRecStop');if(s){s.disabled=!!active;s.classList.toggle('recording',!!active)}if(x)x.disabled=!active}
async function start(){
 if(rec.media&&rec.media.state!=='inactive')return;
 if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.MediaRecorder){setStatus('REC Android indisponible sur ce navigateur');return}
 try{
  setStatus('Autorise le micro. Laisse le son du téléphone sortir par le haut-parleur.');
  var mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}}),AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw new Error('AudioContext indisponible');
  var ctx=new AC();if(ctx.state==='suspended')await ctx.resume();var dest=ctx.createMediaStreamDestination(),ms=ctx.createMediaStreamSource(mic);ms.connect(dest);
  rec.ctx=ctx;rec.dest=dest;rec.mic=mic;rec.micSource=ms;
  try{var ps=window.MPCAudioTap&&window.MPCAudioTap.getStream&&window.MPCAudioTap.getStream();if(ps&&ps.getAudioTracks&&ps.getAudioTracks().length){rec.padSource=ctx.createMediaStreamSource(ps);rec.padGain=ctx.createGain();rec.padGain.gain.value=padLevel();rec.padSource.connect(rec.padGain);rec.padGain.connect(dest)}}catch(e){}
  var m=mime(),opts={audioBitsPerSecond:160000};if(m)opts.mimeType=m;var mr=new MediaRecorder(dest.stream,opts);rec.media=mr;rec.chunks=[];rec.started=Date.now();
  mr.ondataavailable=function(e){if(e.data&&e.data.size)rec.chunks.push(e.data)};
  mr.onerror=function(){setStatus('Erreur pendant REC Android')};
  mr.onstop=function(){var type=mr.mimeType||m||'audio/webm',blob=new Blob(rec.chunks,{type:type});cleanup();ui(false);var t=el('djAndroidTimer');if(t)t.textContent='00:00';if(blob.size){download(blob,type);setStatus('Mix Android sauvegardé · micro + pads directs')}else setStatus('Enregistrement Android vide')};
  mr.start(500);ui(true);rec.timer=setInterval(function(){var t=el('djAndroidTimer');if(t)t.textContent=fmt((Date.now()-rec.started)/1000)},500);setStatus('● REC ANDROID · son téléphone + pads')
 }catch(e){cleanup();ui(false);setStatus(e&&e.message?e.message:'REC Android annulé')}
}
function stop(){if(rec.media&&rec.media.state!=='inactive')try{rec.media.stop()}catch(e){}}
function inject(){var box=el('djRecorder');if(!box||el('djAndroidRecorder'))return false;var d=document.createElement('div');d.id='djAndroidRecorder';d.className='djAndroidRecorder';d.innerHTML='<b>📱 REC ANDROID</b><div class="djRecorderBtns"><button id="djAndroidRecStart" type="button">● REC ANDROID · SON + PADS</button><button id="djAndroidRecStop" type="button" disabled>■ STOP & SAUVER</button></div><div class="djRecorderStatus"><span id="djAndroidRecState">Prêt</span><strong id="djAndroidTimer">00:00</strong></div><div class="djRecorderPad"><span>NIVEAU PADS DIRECTS</span><input id="djAndroidPadLevel" type="range" min="0" max="100" value="70"><output id="djAndroidPadOut">70%</output></div><small>Android bloque généralement la capture numérique du son YouTube dans une page web. Ce mode utilise donc le micro du téléphone pour capter la musique du haut-parleur et ajoute les pads directement au fichier. Pour le meilleur résultat, utilise le haut-parleur du téléphone dans une pièce calme.</small>';box.appendChild(d);el('djAndroidRecStart').onclick=start;el('djAndroidRecStop').onclick=stop;el('djAndroidPadLevel').oninput=updatePadLevel;var st=document.createElement('style');st.textContent='.djAndroidRecorder{display:grid;gap:7px;margin-top:9px;padding-top:9px;border-top:1px solid #284050}.djAndroidRecorder>b{font-size:10px;color:#69d8ff}.djAndroidRecorder button.recording{color:#ff6f80;border-color:#a33143;box-shadow:0 0 16px #ff405544}';document.head.appendChild(st);return true}
function init(){if(inject())return;var n=0,t=setInterval(function(){n++;if(inject()||n>120)clearInterval(t)},100)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.MPCAndroidRecorder={start:start,stop:stop};
})();
