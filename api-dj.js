(function(){
'use strict';

var PROVIDERS={
 youtube:{label:'YouTube',kind:'Recherche DJ',note:'Recherche des vidéos puis envoi direct vers Deck A ou Deck B. Clé YouTube Data API requise.'},
 jamendo:{label:'Jamendo',kind:'Musique CC',note:'Recherche et écoute de musique Jamendo. Import vers un pad uniquement quand le téléchargement est autorisé.'},
 lastfm:{label:'Last.fm',kind:'Découverte',note:'Recherche artistes et morceaux pour enrichir la sélection DJ. Métadonnées uniquement.'}
};
var provider='youtube',results=[],audio=null,busy=false;

function el(id){return document.getElementById(id)}
function esc(s){return String(s||'').replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]})}
function decodeHtml(s){var d=document.createElement('textarea');d.innerHTML=s||'';return d.value}
function statusMsg(s){var n=el('djApiState');if(n)n.textContent=s;var g=el('status');if(g)g.textContent=s}
function cfg(){try{return JSON.parse(localStorage.getItem('mpc-dj-api-settings')||'{}')}catch(e){return {}}}
function safeUrl(s){try{var u=new URL(s);return /^https?:$/.test(u.protocol)?u.href:''}catch(e){return ''}}
function create(tag,cls,html){var n=document.createElement(tag);if(cls)n.className=cls;if(html!==undefined)n.innerHTML=html;return n}
async function getJson(url,opt){var r=await fetch(url,opt||{});if(!r.ok){var text='';try{text=await r.text()}catch(e){}throw new Error('HTTP '+r.status+(text?' · '+text.slice(0,120):''))}return await r.json()}

function inject(){
 var bottom=document.querySelector('.bottom');
 if(bottom&&!el('djApiBtn')){var b=create('button','blueBtn','🎵 API DJ+');b.id='djApiBtn';b.type='button';b.onclick=open;bottom.appendChild(b)}
 if(el('djApiDialog'))return;
 var s=cfg(),d=create('dialog');d.id='djApiDialog';
 d.innerHTML='<div class="djApiCard">'+
  '<div class="djApiHead"><div><small>MUSIQUE · DJ · MÉTADONNÉES</small><h2>API DJ+</h2></div><button id="djApiClose" type="button">✕</button></div>'+
  '<div class="djApiNotice">Les services externes gardent leurs propres licences et conditions. MPC Studio ne télécharge pas les vidéos YouTube.</div>'+
  '<div id="djApiProviders" class="djApiProviders"></div>'+
  '<div class="djApiSearch"><input id="djApiQuery" autocomplete="off" placeholder="Artiste, titre, remix, musique…"><button id="djApiSearchBtn" type="button">RECHERCHER</button></div>'+
  '<div id="djApiInfo" class="djApiInfo"></div><div id="djApiResults" class="djApiResults"></div>'+
  '<details class="djApiSettings"><summary>⚙ Configuration des API</summary>'+
   '<label>YouTube Data API key<input id="djApiYoutubeKey" type="password" value="'+esc(s.youtubeKey||'')+'" placeholder="AIza…"></label>'+
   '<label>Jamendo client_id<input id="djApiJamendoId" value="'+esc(s.jamendoClientId||'')+'" placeholder="Client ID Jamendo"></label>'+
   '<label>Last.fm API key<input id="djApiLastfmKey" type="password" value="'+esc(s.lastfmKey||'')+'" placeholder="Clé API Last.fm"></label>'+
   '<p>Ces valeurs restent uniquement dans le stockage local de cet appareil.</p><button id="djApiSave" type="button">ENREGISTRER</button>'+
  '</details><div id="djApiState" class="djApiState">Prêt</div></div>';
 document.body.appendChild(d);
 el('djApiClose').onclick=function(){d.close()};el('djApiSave').onclick=save;el('djApiSearchBtn').onclick=search;el('djApiQuery').onkeydown=function(e){if(e.key==='Enter'){e.preventDefault();search()}};
 renderProviders();
}
function open(){inject();var d=el('djApiDialog');if(d&&!d.open)d.showModal()}
function save(){localStorage.setItem('mpc-dj-api-settings',JSON.stringify({youtubeKey:(el('djApiYoutubeKey').value||'').trim(),jamendoClientId:(el('djApiJamendoId').value||'').trim(),lastfmKey:(el('djApiLastfmKey').value||'').trim()}));statusMsg('Clés API DJ+ enregistrées sur cet appareil')}
function renderProviders(){var root=el('djApiProviders');if(!root)return;root.innerHTML='';Object.keys(PROVIDERS).forEach(function(id){var p=PROVIDERS[id],b=create('button',id===provider?'active':'','<b>'+esc(p.label)+'</b><small>'+esc(p.kind)+'</small>');b.type='button';b.onclick=function(){provider=id;results=[];renderProviders();renderInfo();renderResults()};root.appendChild(b)});renderInfo()}
function renderInfo(){var p=PROVIDERS[provider];if(el('djApiInfo'))el('djApiInfo').innerHTML='<b>'+esc(p.label)+'</b> · '+esc(p.note)}

async function search(){
 if(busy)return;var q=(el('djApiQuery').value||'').trim();if(!q)return statusMsg('Entre un artiste ou un titre');busy=true;el('djApiResults').innerHTML='<div class="djApiLoading">Recherche…</div>';statusMsg('Recherche '+PROVIDERS[provider].label+'…');
 try{if(provider==='youtube')results=await searchYoutube(q);else if(provider==='jamendo')results=await searchJamendo(q);else results=await searchLastfm(q);renderResults();statusMsg(results.length+' résultat(s) · '+PROVIDERS[provider].label)}catch(e){results=[];renderResults();statusMsg('Erreur '+PROVIDERS[provider].label+' : '+e.message)}finally{busy=false}
}
async function searchYoutube(q){
 var key=(cfg().youtubeKey||'').trim();if(!key)throw new Error('Ajoute ta clé YouTube Data API dans Configuration');
 var u=new URL('https://www.googleapis.com/youtube/v3/search');u.searchParams.set('part','snippet');u.searchParams.set('q',q);u.searchParams.set('type','video');u.searchParams.set('maxResults','18');u.searchParams.set('videoEmbeddable','true');u.searchParams.set('safeSearch','moderate');u.searchParams.set('key',key);
 var d=await getJson(u);return (d.items||[]).map(function(x){var s=x.snippet||{},id=x.id&&x.id.videoId;if(!id)return null;return {type:'youtube',id:id,title:decodeHtml(s.title||'Vidéo'),creator:decodeHtml(s.channelTitle||'YouTube'),image:(s.thumbnails&&((s.thumbnails.medium||s.thumbnails.default||{}).url))||'',source:'https://www.youtube.com/watch?v='+encodeURIComponent(id),detail:s.publishedAt?String(s.publishedAt).slice(0,10):''}}).filter(Boolean)
}
async function searchJamendo(q){
 var client=(cfg().jamendoClientId||'').trim();if(!client)throw new Error('Ajoute ton client_id Jamendo dans Configuration');
 var u=new URL('https://api.jamendo.com/v3.0/tracks/');u.searchParams.set('client_id',client);u.searchParams.set('format','json');u.searchParams.set('limit','20');u.searchParams.set('search',q);u.searchParams.set('type','single albumtrack');u.searchParams.set('include','licenses musicinfo');u.searchParams.set('audioformat','mp32');u.searchParams.set('audiodlformat','mp32');u.searchParams.set('imagesize','300');
 var d=await getJson(u);if(d.headers&&d.headers.status&&d.headers.status!=='success')throw new Error(d.headers.error_message||'Erreur Jamendo');
 return (d.results||[]).map(function(x){return {type:'jamendo',id:x.id,title:x.name||'Sans titre',creator:x.artist_name||'',image:safeUrl(x.image||x.album_image),preview:safeUrl(x.audio),download:safeUrl(x.audiodownload),downloadAllowed:x.audiodownload_allowed===true||x.audiodownload_allowed==='true',license:safeUrl(x.license_ccurl)||'Licence Jamendo / Creative Commons à vérifier',source:safeUrl(x.shareurl)||('https://www.jamendo.com/track/'+encodeURIComponent(x.id)),detail:(x.duration?Math.round(Number(x.duration)/60)+' min':'')}})
}
async function searchLastfm(q){
 var key=(cfg().lastfmKey||'').trim();if(!key)throw new Error('Ajoute ta clé Last.fm dans Configuration');
 var u=new URL('https://ws.audioscrobbler.com/2.0/');u.searchParams.set('method','track.search');u.searchParams.set('track',q);u.searchParams.set('api_key',key);u.searchParams.set('format','json');u.searchParams.set('limit','20');
 var d=await getJson(u),arr=d.results&&d.results.trackmatches&&d.results.trackmatches.track||[];if(!Array.isArray(arr))arr=[arr];
 return arr.filter(Boolean).map(function(x){var imgs=x.image||[],img='';if(Array.isArray(imgs)){for(var i=imgs.length-1;i>=0;i--){if(imgs[i]&&imgs[i]['#text']){img=imgs[i]['#text'];break}}}return {type:'lastfm',title:x.name||'Sans titre',creator:x.artist||'',image:safeUrl(img),source:safeUrl(x.url),detail:x.listeners?Number(x.listeners).toLocaleString('fr-FR')+' auditeurs':'',license:'Métadonnées Last.fm'}})
}

function renderResults(){var root=el('djApiResults');if(!root)return;root.innerHTML='';if(!results.length){root.innerHTML='<div class="djApiEmpty">Aucun résultat.</div>';return}results.forEach(function(r){var actions='';if(r.type==='youtube')actions='<button data-a="deckA">DECK A</button><button data-a="deckB">DECK B</button>';if(r.type==='jamendo'){if(r.preview)actions+='<button data-a="play">▶ ÉCOUTER</button>';if(r.downloadAllowed&&r.download)actions+='<button data-a="pad">＋ PAD</button>'}if(r.source)actions+='<button data-a="source">SOURCE</button>';
 var card=create('article','djApiResult','<div class="djApiThumb">'+(r.image?'<img src="'+esc(r.image)+'" alt="" loading="lazy">':'<span>♫</span>')+'</div><div class="djApiMain"><b>'+esc(r.title)+'</b><small>'+esc(r.creator)+(r.detail?' · '+esc(r.detail):'')+'</small>'+(r.license?'<em>'+esc(r.license)+'</em>':'')+'</div><div class="djApiActions">'+actions+'</div>');
 var a=card.querySelector('[data-a="deckA"]'),b=card.querySelector('[data-a="deckB"]'),p=card.querySelector('[data-a="play"]'),pad=card.querySelector('[data-a="pad"]'),src=card.querySelector('[data-a="source"]');if(a)a.onclick=function(){loadDeck('A',r)};if(b)b.onclick=function(){loadDeck('B',r)};if(p)p.onclick=function(){preview(r)};if(pad)pad.onclick=function(){importJamendo(r)};if(src)src.onclick=function(){window.open(r.source,'_blank','noopener')};root.appendChild(card)})}
function loadDeck(deck,r){var mode=document.querySelector('.bigModes button[data-mode="dj"]');if(mode)mode.click();function go(){if(window.MPCDJ&&typeof window.MPCDJ.load==='function'){window.MPCDJ.load(deck,r.source);statusMsg(r.title+' envoyé vers Deck '+deck)}else statusMsg('Le module DJ n’est pas encore prêt')}setTimeout(go,80)}
function preview(r){if(audio){audio.pause();audio=null}audio=new Audio(r.preview);audio.crossOrigin='anonymous';audio.play().then(function(){statusMsg('Lecture Jamendo : '+r.title)}).catch(function(){statusMsg('La préécoute est bloquée par la source')})}
async function importJamendo(r){
 if(!r.downloadAllowed||!r.download)return statusMsg('Jamendo n’autorise pas le téléchargement de ce morceau');if(typeof window.importAudio!=='function'&&typeof importAudio!=='function')return statusMsg('Import pad indisponible');
 try{statusMsg('Téléchargement Jamendo…');var res=await fetch(r.download,{mode:'cors'});if(!res.ok)throw new Error('HTTP '+res.status);var blob=await res.blob();var name=String(r.title||'jamendo').replace(/[\\/:*?"<>|]+/g,' ').slice(0,80)+'.mp3';var file=new File([blob],name,{type:blob.type||'audio/mpeg'});var fn=window.importAudio||importAudio;await fn(file);try{var sp=window.selected?window.selected():(typeof selected==='function'?selected():null);if(sp){sp.externalMeta={provider:'Jamendo',source:r.source,license:r.license,creator:r.creator};if(typeof window.renderEditor==='function')window.renderEditor();else if(typeof renderEditor==='function')renderEditor()}}catch(e){}statusMsg(r.title+' importé sur le pad sélectionné') }catch(e){statusMsg('Import Jamendo impossible : '+e.message)}
}

function init(){inject()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.MPCDJAPIs={open:open,search:function(q,p){if(p&&PROVIDERS[p])provider=p;if(el('djApiQuery'))el('djApiQuery').value=q||'';open();return search()}};
})();
