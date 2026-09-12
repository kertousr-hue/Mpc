(function(){
'use strict';

var MAX=250*1024*1024,ALLOWED=/\.(mp3|wav|flac|m4a|aac|ogg|opus|aiff|aif)$/i;
function el(id){return document.getElementById(id)}
function status(t){var s=el('status');if(s)s.textContent=t}
function isLocalHost(h){return /^(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(h||'')}
function normalizeBase(raw){var v=String(raw||'').trim().replace(/\/$/,'');if(!v){if(location.protocol==='http:'&&isLocalHost(location.hostname))return location.origin;return ''}if(!/^https?:\/\//i.test(v))v='http://'+v;if(!/:\d+(?:\/|$)/.test(v.replace(/^https?:\/\//,'')))v+=':8765';return v.replace(/\/$/,'')}
function pin(){return (el('vdjPin')&&el('vdjPin').value||'').trim()}
function setState(deck,text,error){var n=el('vdjFileState'+deck);if(n){n.textContent=text;n.classList.toggle('error',!!error)}status('VirtualDJ · '+text)}
function sizeText(n){if(n<1024*1024)return Math.max(1,Math.round(n/1024))+' Ko';return (n/1024/1024).toFixed(1)+' Mo'}

function upload(deck,file){
 if(!file)return;
 if(!ALLOWED.test(file.name||'')){setState(deck,'Format non pris en charge',true);return}
 if(file.size>MAX){setState(deck,'Fichier trop volumineux · 250 Mo max',true);return}
 var base=normalizeBase(el('vdjBridgeUrl')&&el('vdjBridgeUrl').value);
 if(!base){setState(deck,'Adresse du PC manquante',true);return}
 if(location.protocol==='https:'&&base.indexOf('http://')===0){setState(deck,'Ouvre d’abord le CONTRÔLE LOCAL pour envoyer une musique',true);var b=el('vdjOpenLocalBtn');if(b)b.focus();return}
 var url=base+'/api/vdj/upload?deck='+deck+'&filename='+encodeURIComponent(file.name),xhr=new XMLHttpRequest();
 xhr.open('POST',url,true);xhr.setRequestHeader('Content-Type','application/octet-stream');xhr.setRequestHeader('X-MPC-PIN',pin());xhr.timeout=10*60*1000;
 xhr.upload.onprogress=function(e){if(!e.lengthComputable)return;var p=Math.round(e.loaded/e.total*100);setState(deck,'Transfert '+p+'% · '+sizeText(file.size),false)};
 xhr.onerror=function(){setState(deck,'Connexion au bridge impossible',true)};
 xhr.ontimeout=function(){setState(deck,'Transfert trop long',true)};
 xhr.onload=function(){var data={};try{data=JSON.parse(xhr.responseText||'{}')}catch(e){}if(xhr.status>=200&&xhr.status<300&&data.ok){setState(deck,file.name+' chargé sur Deck '+(deck===1?'A':'B'),false);setTimeout(function(){var r=el('vdjRefreshBtn');if(r)r.click()},350)}else if(xhr.status===404){setState(deck,'Bridge ancien : relance start_virtualdj_bridge.bat après mise à jour',true)}else setState(deck,data.error||('Erreur HTTP '+xhr.status),true)};
 setState(deck,'Envoi vers le PC… '+sizeText(file.size),false);xhr.send(file)
}

function box(deck){var article=document.querySelector('[data-vdj-deck="'+deck+'"]');if(!article||el('vdjFileBox'+deck))return false;var n=document.createElement('section');n.id='vdjFileBox'+deck;n.className='vdjFileBox';n.innerHTML='<div><b>📂 CHARGER UNE MUSIQUE</b><small>MP3 · WAV · FLAC · M4A · max 250 Mo</small></div><label class="vdjFileButton">CHOISIR UN FICHIER<input id="vdjFile'+deck+'" type="file" accept="audio/*,.mp3,.wav,.flac,.m4a,.aac,.ogg,.opus,.aiff,.aif" hidden></label><span id="vdjFileState'+deck+'">Prêt</span>';var song=article.querySelector('.vdjSong');if(song)song.insertAdjacentElement('afterend',n);else article.prepend(n);var input=el('vdjFile'+deck);input.onchange=function(){var f=input.files&&input.files[0];if(f)upload(deck,f);input.value=''};n.addEventListener('dragover',function(e){e.preventDefault();n.classList.add('drag')});n.addEventListener('dragleave',function(){n.classList.remove('drag')});n.addEventListener('drop',function(e){e.preventDefault();n.classList.remove('drag');var f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];if(f)upload(deck,f)});return true}
function style(){if(el('vdjFilesStyle'))return;var s=document.createElement('style');s.id='vdjFilesStyle';s.textContent='.vdjFileBox{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;align-items:center;margin:8px 0 10px;padding:9px;border:1px solid #263f50;border-radius:8px;background:#08131b}.vdjFileBox>div{display:grid;gap:2px}.vdjFileBox b{font-size:10px;color:#6fdcff}.vdjFileBox small,.vdjFileBox>span{font-size:8px;color:#8299a8}.vdjFileBox>span{grid-column:1/-1}.vdjFileBox>span.error{color:#ff8290}.vdjFileButton{display:flex;align-items:center;justify-content:center;min-height:34px;padding:6px 9px;border:1px solid #2c6e8e;border-radius:7px;background:linear-gradient(180deg,#13232e,#0a151d);color:#9be4ff;font-size:9px;font-weight:700;cursor:pointer}.vdjFileBox.drag{border-color:#65d9ff;box-shadow:0 0 15px #19b8ff44}@media(max-width:760px){.vdjFileBox{grid-template-columns:1fr}.vdjFileButton{width:100%}}';document.head.appendChild(s)}
function inject(){style();var a=box(1),b=box(2);return a||b||!!(el('vdjFileBox1')&&el('vdjFileBox2'))}
function init(){if(inject())return;var tries=0,t=setInterval(function(){tries++;if((el('vdjFileBox1')&&el('vdjFileBox2'))||tries>100)clearInterval(t);else inject()},100)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.MPCVirtualDJFiles={upload:upload};
})();
