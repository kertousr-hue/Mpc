(function(){
'use strict';

var state={connected:false,poll:null,failures:0,deleteCue:{1:false,2:false},timers:{}};
function el(id){return document.getElementById(id)}
function statusText(t){var s=el('status');if(s)s.textContent=t}
function esc(s){return String(s||'').replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]})}
function clamp(v,a,b){return Math.min(b,Math.max(a,Number(v)||0))}
function fmtPct(v){return Math.round(Number(v)||0)+'%'}
function isLocalHost(h){return /^(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(h||'')}
function saved(){try{return JSON.parse(localStorage.getItem('mpc-virtualdj')||'{}')}catch(e){return {}}}
function saveConfig(){localStorage.setItem('mpc-virtualdj',JSON.stringify({base:el('vdjBridgeUrl').value.trim(),pin:el('vdjPin').value.trim()}))}
function defaultBase(){var s=saved();if(s.base)return s.base;if(location.protocol==='http:'&&isLocalHost(location.hostname))return location.origin;return ''}
function normalizeBase(raw){var v=String(raw||'').trim().replace(/\/$/,'');if(!v)return location.protocol==='http:'&&isLocalHost(location.hostname)?location.origin:'';if(!/^https?:\/\//i.test(v))v='http://'+v;if(!/:\d+(?:\/|$)/.test(v.replace(/^https?:\/\//,'')))v+=':8765';return v.replace(/\/$/,'')}
function apiUrl(path){var base=normalizeBase(el('vdjBridgeUrl').value);return base+path}
function authHeaders(){return {'Content-Type':'application/json','X-MPC-PIN':el('vdjPin').value.trim()}}

async function request(path,opts){
 var url=apiUrl(path);if(!url||url===path)throw new Error('Adresse du PC manquante');
 if(location.protocol==='https:'&&url.indexOf('http://')===0)throw new Error('Android bloque la commande HTTP depuis la PWA HTTPS. Appuie sur « OUVRIR LE CONTRÔLE LOCAL » puis reconnecte-toi.');
 var r=await fetch(url,Object.assign({cache:'no-store'},opts||{}));var data={};try{data=await r.json()}catch(e){}
 if(!r.ok||data.ok===false)throw new Error(data.error||('HTTP '+r.status));return data
}
async function stateRequest(){return request('/api/vdj/state',{headers:{'X-MPC-PIN':el('vdjPin').value.trim()}})}
async function command(payload){
 if(!state.connected){statusText('VirtualDJ PC non connecté');return false}
 try{var d=await request('/api/vdj/command',{method:'POST',headers:authHeaders(),body:JSON.stringify(payload)});state.failures=0;return !!d.ok}catch(e){showError(e.message);return false}
}
function throttle(key,payload,delay){clearTimeout(state.timers[key]);state.timers[key]=setTimeout(function(){command(payload)},delay||100)}

function connBadge(kind,text){var b=el('vdjConnState');if(!b)return;b.className='vdjConnState '+(kind||'');b.textContent=text}
function showError(message){state.failures++;connBadge('error','ERREUR');el('vdjMessage').textContent=message;statusText('VirtualDJ : '+message);if(state.failures>=3)disconnect(false)}
function setConnected(info){state.connected=true;state.failures=0;connBadge('ok','CONNECTÉ');el('vdjMessage').textContent='VirtualDJ '+(info.version||'')+(info.build?' · build '+info.build:'');el('vdjConnectBtn').textContent='DÉCONNECTER';saveConfig();startPolling();statusText('VirtualDJ PC connecté')}
function disconnect(show){state.connected=false;clearInterval(state.poll);state.poll=null;connBadge('','DÉCONNECTÉ');el('vdjConnectBtn').textContent='CONNECTER';if(show!==false){el('vdjMessage').textContent='Connexion arrêtée';statusText('VirtualDJ PC déconnecté')}}
async function connect(){
 if(state.connected){disconnect();return}
 var base=normalizeBase(el('vdjBridgeUrl').value);if(!base){showError('Saisis l’adresse locale du PC, par exemple 192.168.1.25:8765');return}el('vdjBridgeUrl').value=base;saveConfig();connBadge('busy','CONNEXION…');el('vdjMessage').textContent='Recherche de VirtualDJ…';
 try{var d=await stateRequest();setConnected(d);renderState(d)}catch(e){showError(e.message)}
}
function startPolling(){clearInterval(state.poll);state.poll=setInterval(refreshState,900);refreshState()}
async function refreshState(){if(!state.connected)return;try{var d=await stateRequest();state.failures=0;renderState(d)}catch(e){showError(e.message)}}

function deckHtml(n,label){
 return '<article class="vdjDeck panel" data-vdj-deck="'+n+'">'+
 '<div class="vdjDeckHead"><div><small>VIRTUALDJ · DECK '+n+'</small><h2>'+label+'</h2></div><span id="vdjPlayState'+n+'" class="vdjPlayState">STOP</span></div>'+
 '<div class="vdjSong"><strong id="vdjTitle'+n+'">Aucun morceau</strong><span id="vdjArtist'+n+'">—</span><div><b id="vdjBpm'+n+'">0.0 BPM</b><b id="vdjKey'+n+'">—</b><b id="vdjPitchLabel'+n+'">0.0%</b></div></div>'+
 '<div class="vdjPosition"><i id="vdjPosition'+n+'"></i></div>'+
 '<div class="vdjTransport">'+
 '<button data-vdj-action="cue" data-deck="'+n+'">CUE</button><button data-vdj-action="set_cue" data-deck="'+n+'">SET CUE</button><button class="vdjPlayBtn" data-vdj-action="play_pause" data-deck="'+n+'">▶ / Ⅱ</button><button class="vdjSyncBtn" data-vdj-action="sync" data-deck="'+n+'">SYNC</button><button data-vdj-action="pfl" data-deck="'+n+'">🎧 PFL</button></div>'+
 '<div class="vdjSliders">'+
 slider('PITCH','vdjPitch'+n,-12,12,0,.1,'%')+slider('VOLUME','vdjVolume'+n,0,100,100,1,'%')+slider('BASS','vdjLow'+n,0,100,50,1,'%')+slider('MEDIUM','vdjMid'+n,0,100,50,1,'%')+slider('AIGU','vdjHigh'+n,0,100,50,1,'%')+slider('FILTER','vdjFilter'+n,0,100,50,1,'%')+'</div>'+
 '<div class="vdjLoop"><span>BOUCLE</span>'+[1,2,4,8,16].map(function(v){return '<button data-vdj-action="loop" data-value="'+v+'" data-deck="'+n+'">'+v+'</button>'}).join('')+'<button data-vdj-action="loop_exit" data-deck="'+n+'">EXIT</button></div>'+
 '<section class="vdjPadsBox"><div class="vdjPadsHead"><b>16 PERFORMANCE PADS</b><button id="vdjDeleteCue'+n+'" data-delete-cue="'+n+'">✕ CUE</button></div><small>HOT CUE 1–8</small><div class="vdjPads hot">'+Array.from({length:8},function(_,i){return '<button data-vdj-hotcue="'+(i+1)+'" data-deck="'+n+'"><span>HC</span>'+(i+1)+'</button>'}).join('')+'</div><small>PAGE PADS VIRTUALDJ 1–8</small><div class="vdjPads page">'+Array.from({length:8},function(_,i){return '<button data-vdj-action="pad" data-slot="'+(i+1)+'" data-deck="'+n+'"><span>PAD</span>'+(i+1)+'</button>'}).join('')+'</div></section>'+
 '<div class="vdjFx"><button data-vdj-action="echo" data-deck="'+n+'">ECHO</button><button data-vdj-action="reverb" data-deck="'+n+'">REVERB</button><button data-vdj-action="backspin" data-deck="'+n+'">BACKSPIN</button><button data-vdj-action="keylock" data-deck="'+n+'">KEY LOCK</button><button data-vdj-action="eq_reset" data-deck="'+n+'">RESET EQ</button></div>'+
 '</article>'
}
function slider(label,id,min,max,value,step,suffix){return '<label>'+label+'<input id="'+id+'" type="range" min="'+min+'" max="'+max+'" step="'+step+'" value="'+value+'"><output id="'+id+'Out">'+value+suffix+'</output></label>'}
function mixerHtml(){
 return '<aside class="vdjMixer panel"><div class="vdjConnectCard"><div class="vdjConnectHead"><div><small>ANDROID ↔ PC</small><h2>VIRTUALDJ</h2></div><span id="vdjConnState" class="vdjConnState">DÉCONNECTÉ</span></div><label>ADRESSE DU PC<input id="vdjBridgeUrl" inputmode="url" placeholder="192.168.1.25:8765"></label><label>CODE PIN<input id="vdjPin" inputmode="numeric" maxlength="12" placeholder="Code affiché sur le PC"></label><button id="vdjConnectBtn" class="blueBtn">CONNECTER</button><button id="vdjOpenLocalBtn">OUVRIR LE CONTRÔLE LOCAL</button><p id="vdjMessage">Lance virtualdj_bridge.py sur le PC, puis utilise l’adresse et le PIN affichés.</p></div>'+ 
 '<div class="vdjCross"><b>CROSSFADER</b><div><span>A</span><input id="vdjCrossfader" type="range" min="0" max="100" value="50"><span>B</span></div><output id="vdjCrossOut">50%</output></div>'+ 
 '<section class="vdjSampler"><b>SAMPLER VIRTUALDJ</b><small>Déclenche les slots 1 à 8 de la banque Sampler active.</small><div class="vdjSamplerPads">'+Array.from({length:8},function(_,i){return '<button data-vdj-action="sampler" data-slot="'+(i+1)+'" data-deck="1"><span>S</span>'+(i+1)+'</button>'}).join('')+'</div></section>'+ 
 '<button id="vdjRefreshBtn">↻ ACTUALISER</button><div class="vdjPcHint"><b>PC</b><span>VirtualDJ PRO + extension Network Control activée.</span><b>Android</b><span>Sur le même Wi‑Fi que le PC.</span></div></aside>'
}

function inject(){
 if(el('virtualDjWorkspace'))return;var nav=document.querySelector('.bigModes'),anchor=el('djWorkspace')||document.querySelector('.workspace');if(!nav||!anchor)return;
 var mode=document.createElement('button');mode.type='button';mode.dataset.mode='virtualdj';mode.className='virtualdj';mode.innerHTML='<b>🖥️ VIRTUALDJ PC</b><small>ANDROID · 2 DECKS · PADS · MIXEUR</small>';nav.appendChild(mode);
 var section=document.createElement('section');section.id='virtualDjWorkspace';section.className='virtualDjWorkspace';section.innerHTML=deckHtml(1,'DECK A')+mixerHtml()+deckHtml(2,'DECK B');anchor.insertAdjacentElement('afterend',section);
 mode.onclick=function(){document.body.dataset.mode='virtualdj';document.querySelectorAll('.bigModes button').forEach(function(b){b.classList.toggle('active',b===mode)});statusText('Mode VirtualDJ PC')};
 bind();var c=saved();el('vdjBridgeUrl').value=c.base||defaultBase();el('vdjPin').value=c.pin||'';
 if(location.protocol==='http:'&&isLocalHost(location.hostname)){el('vdjBridgeUrl').value=location.origin;el('vdjOpenLocalBtn').hidden=true}
 if(new URLSearchParams(location.search).get('mode')==='virtualdj')setTimeout(function(){mode.click()},0)
}

function bind(){
 el('vdjConnectBtn').onclick=connect;el('vdjRefreshBtn').onclick=refreshState;
 el('vdjOpenLocalBtn').onclick=function(){var base=normalizeBase(el('vdjBridgeUrl').value);if(!base){showError('Saisis d’abord l’adresse du PC');return}saveConfig();window.open(base+'/?mode=virtualdj','_blank','noopener')};
 document.querySelectorAll('[data-vdj-action]').forEach(function(b){b.addEventListener('click',function(){var p={action:b.dataset.vdjAction,deck:Number(b.dataset.deck||1)};if(b.dataset.value!==undefined)p.value=Number(b.dataset.value);if(b.dataset.slot!==undefined)p.slot=Number(b.dataset.slot);command(p)})});
 document.querySelectorAll('[data-vdj-hotcue]').forEach(function(b){b.addEventListener('click',function(){var deck=Number(b.dataset.deck),slot=Number(b.dataset.vdjHotcue);command({action:state.deleteCue[deck]?'delete_cue':'hot_cue',deck:deck,slot:slot})})});
 document.querySelectorAll('[data-delete-cue]').forEach(function(b){b.addEventListener('click',function(){var deck=Number(b.dataset.deleteCue);state.deleteCue[deck]=!state.deleteCue[deck];b.classList.toggle('active',state.deleteCue[deck]);b.textContent=state.deleteCue[deck]?'SUPPRIMER CUE':'✕ CUE'})});
 bindDeckSlider(1,'vdjPitch1','pitch',function(v){return v.toFixed(1)+'%'});bindDeckSlider(2,'vdjPitch2','pitch',function(v){return v.toFixed(1)+'%'});
 [[1,'vdjVolume1','volume'],[2,'vdjVolume2','volume'],[1,'vdjLow1','eq_low'],[2,'vdjLow2','eq_low'],[1,'vdjMid1','eq_mid'],[2,'vdjMid2','eq_mid'],[1,'vdjHigh1','eq_high'],[2,'vdjHigh2','eq_high'],[1,'vdjFilter1','filter'],[2,'vdjFilter2','filter']].forEach(function(x){bindDeckSlider(x[0],x[1],x[2],fmtPct)});
 var cross=el('vdjCrossfader');cross.oninput=function(){el('vdjCrossOut').textContent=fmtPct(cross.value);throttle('cross',{action:'crossfader',deck:1,value:Number(cross.value)},120)};
 el('vdjBridgeUrl').onchange=saveConfig;el('vdjPin').onchange=saveConfig;
}
function bindDeckSlider(deck,id,action,formatter){var input=el(id),out=el(id+'Out');input.oninput=function(){out.textContent=formatter(Number(input.value))};input.onchange=function(){command({action:action,deck:deck,value:Number(input.value)})}}
function setInput(id,value,formatter){var input=el(id);if(!input||document.activeElement===input)return;input.value=String(value);var out=el(id+'Out');if(out)out.textContent=formatter?formatter(Number(value)):String(value)}
function renderDeck(n,d){if(!d)return;el('vdjTitle'+n).textContent=d.title||'Aucun morceau';el('vdjArtist'+n).textContent=d.artist||'—';el('vdjBpm'+n).textContent=(Number(d.bpm)||0).toFixed(1)+' BPM';el('vdjKey'+n).textContent=d.key||'—';el('vdjPitchLabel'+n).textContent=(Number(d.pitch)||0).toFixed(1)+'%';el('vdjPlayState'+n).textContent=d.playing?'PLAY':'PAUSE';el('vdjPlayState'+n).classList.toggle('playing',!!d.playing);el('vdjPosition'+n).style.width=(clamp(d.position,0,1)*100)+'%';setInput('vdjPitch'+n,clamp(d.pitch,-12,12),function(v){return v.toFixed(1)+'%'});setInput('vdjVolume'+n,clamp(d.volume,0,100),fmtPct)}
function renderState(d){if(!d||!d.decks)return;renderDeck(1,d.decks['1']);renderDeck(2,d.decks['2']);setInput('vdjCrossfader',clamp(d.crossfader,0,100),fmtPct);el('vdjCrossOut').textContent=fmtPct(d.crossfader);connBadge('ok','CONNECTÉ');el('vdjMessage').textContent='VirtualDJ '+(d.version||'')+(d.build?' · build '+d.build:'')}

function init(){inject()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.MPCVirtualDJ={connect:connect,disconnect:disconnect,command:command};
})();
