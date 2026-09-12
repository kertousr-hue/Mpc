(function(){
'use strict';

var PROVIDERS={
 youtube:{label:'YouTube',kind:'Recherche DJ',note:'Recherche des vidéos intégrables, affiche durée/vues et envoie directement vers Deck A ou Deck B. Clé YouTube Data API requise.'},
 jamendo:{label:'Jamendo',kind:'Musique CC',note:'Recherche et écoute de musique Jamendo. Import vers un pad uniquement quand le téléchargement est autorisé.'},
 lastfm:{label:'Last.fm',kind:'Découverte',note:'Recherche artistes et morceaux puis permet de relancer le titre sur YouTube en un clic. Métadonnées uniquement.'}
};
var DEFAULT_FILTERS={order:'relevance',duration:'any',safe:'moderate',count:'18'};
var provider='youtube',results=[],audio=null,busy=false,controller=null,view='search',page={next:'',prev:'',token:''};

function el(id){return document.getElementById(id)}
function esc(s){return String(s||'').replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]})}
function decodeHtml(s){var d=document.createElement('textarea');d.innerHTML=s||'';return d.value}
function statusMsg(s){var n=el('djApiState');if(n)n.textContent=s;var g=el('status');if(g)g.textContent=s}
function cfg(){try{return JSON.parse(localStorage.getItem('mpc-dj-api-settings')||'{}')}catch(e){return {}}}
function safeUrl(s){try{var u=new URL(s);return /^https?:$/.test(u.protocol)?u.href:''}catch(e){return ''}}
function create(tag,cls,html){var n=document.createElement(tag);if(cls)n.className=cls;if(html!==undefined)n.innerHTML=html;return n}
function compact(n){n=Number(n)||0;try{return new Intl.NumberFormat('fr-FR',{notation:'compact',maximumFractionDigits:1}).format(n)}catch(e){return n.toLocaleString('fr-FR')}}
function fmtSeconds(sec){sec=Math.max(0,Number(sec)||0);var m=Math.floor(sec/60),s=Math.floor(sec%60);return m+':'+String(s).padStart(2,'0')}
function isoDuration(s){var m=String(s||'').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);if(!m)return '';return fmtSeconds((Number(m[1])||0)*3600+(Number(m[2])||0)*60+(Number(m[3])||0))}
function setBusy(on){busy=on;var b=el('djApiSearchBtn');if(b){b.disabled=on;b.textContent=on?'RECHERCHE…':'RECHERCHER'}}
function filters(){return {order:(el('djApiOrder')&&el('djApiOrder').value)||DEFAULT_FILTERS.order,duration:(el('djApiDuration')&&el('djApiDuration').value)||DEFAULT_FILTERS.duration,safe:(el('djApiSafe')&&el('djApiSafe').value)||DEFAULT_FILTERS.safe,count:(el('djApiCount')&&el('djApiCount').value)||DEFAULT_FILTERS.count}}
function cacheRead(key){try{var all=JSON.parse(sessionStorage.getItem('mpc-dj-api-cache-v2')||'{}'),x=all[key];if(x&&Date.now()-x.ts<600000)return x.value}catch(e){}return null}
function cacheWrite(key,value){try{var all=JSON.parse(sessionStorage.getItem('mpc-dj-api-cache-v2')||'{}'),keys=Object.keys(all).sort(function(a,b){return all[a].ts-all[b].ts});while(keys.length>=12){delete all[keys.shift()]}all[key]={ts:Date.now(),value:value};sessionStorage.setItem('mpc-dj-api-cache-v2',JSON.stringify(all))}catch(e){}}
function history(){try{return JSON.parse(localStorage.getItem('mpc-dj-api-history')||'[]')}catch(e){return []}}
function addHistory(q){if(cfg().rememberSearch===false)return;var h=history().filter(function(x){return !(x.provider===provider&&x.q.toLowerCase()===q.toLowerCase())});h.unshift({provider:provider,q:q,ts:Date.now()});localStorage.setItem('mpc-dj-api-history',JSON.stringify(h.slice(0,12)));renderRecent()}
function favorites(){try{return JSON.parse(localStorage.getItem('mpc-dj-api-favorites')||'[]')}catch(e){return []}}
function favKey(r){return [r.type,r.id||'',r.creator||'',r.title||''].join('|').toLowerCase()}
function isFavorite(r){var k=favKey(r);return favorites().some(function(x){return favKey(x)===k})}
function toggleFavorite(r){var list=favorites(),k=favKey(r),idx=list.findIndex(function(x){return favKey(x)===k});if(idx>=0){list.splice(idx,1);statusMsg('Retiré des favoris')}else{list.unshift({type:r.type,id:r.id||'',title:r.title||'',creator:r.creator||'',image:r.image||'',preview:r.preview||'',download:r.download||'',downloadAllowed:!!r.downloadAllowed,license:r.license||'',source:r.source||'',detail:r.detail||'',duration:r.duration||'',views:r.views||''});list=list.slice(0,60);statusMsg('Ajouté aux favoris')}localStorage.setItem('mpc-dj-api-favorites',JSON.stringify(list));updateFavoriteCount();if(view==='favorites'){results=list;renderResults()}else renderResults()}
function updateFavoriteCount(){var n=el('djApiFavCount');if(n)n.textContent=String(favorites().length)}

async function getJson(url,opt){
 var r=await fetch(url,opt||{}),text=await r.text(),data=null;try{data=text?JSON.parse(text):{}}catch(e){}
 if(!r.ok){var msg=data&&data.error&&(data.error.message||data.error.error_description)||data&&data.headers&&data.headers.error_message||'';throw new Error(msg||('HTTP '+r.status))}
 return data||{};
}

function inject(){
 var bottom=document.querySelector('.bottom');
 if(bottom&&!el('djApiBtn')){var b=create('button','blueBtn','🎵 API DJ+');b.id='djApiBtn';b.type='button';b.onclick=open;bottom.appendChild(b)}
 if(el('djApiDialog'))return;
 var s=cfg(),d=create('dialog');d.id='djApiDialog';
 d.innerHTML='<div class="djApiCard">'+
  '<div class="djApiHead"><div><small>MUSIQUE · DJ · MÉTADONNÉES</small><h2>API DJ+</h2></div><button id="djApiClose" type="button">✕</button></div>'+
  '<div class="djApiNotice">Optimisé pour limiter les requêtes : cache de 10 min, annulation des recherches précédentes et historique local. MPC Studio ne télécharge pas les vidéos YouTube.</div>'+
  '<div id="djApiProviders" class="djApiProviders"></div>'+
  '<div class="djApiToolbar"><button id="djApiFavoritesBtn" type="button">★ FAVORIS <span id="djApiFavCount">0</span></button><button id="djApiHistoryBtn" type="button">🕘 HISTORIQUE</button><button id="djApiClearBtn" type="button">EFFACER</button></div>'+
  '<div class="djApiSearch"><input id="djApiQuery" autocomplete="off" placeholder="Artiste, titre, remix, musique…"><button id="djApiSearchBtn" type="button">RECHERCHER</button></div>'+
  '<div id="djApiFilters" class="djApiFilters"></div>'+
  '<div id="djApiInfo" class="djApiInfo"></div><div id="djApiRecent" class="djApiRecent"></div><div id="djApiResults" class="djApiResults"></div>'+
  '<div id="djApiPager" class="djApiPager"><button id="djApiPrev" type="button">← PRÉCÉDENT</button><span id="djApiPageInfo">Résultats</span><button id="djApiNext" type="button">SUIVANT →</button></div>'+
  '<details class="djApiSettings"><summary>⚙ Configuration des API</summary>'+
   '<label>YouTube Data API key<input id="djApiYoutubeKey" type="password" value="'+esc(s.youtubeKey||'')+'" placeholder="AIza…"></label>'+
   '<label>Région YouTube (2 lettres)<input id="djApiYoutubeRegion" maxlength="2" value="'+esc(s.youtubeRegion||'FR')+'" placeholder="FR"></label>'+
   '<label>Jamendo client_id<input id="djApiJamendoId" value="'+esc(s.jamendoClientId||'')+'" placeholder="Client ID Jamendo"></label>'+
   '<label>Last.fm API key<input id="djApiLastfmKey" type="password" value="'+esc(s.lastfmKey||'')+'" placeholder="Clé API Last.fm"></label>'+
   '<div class="djApiOptions"><label><input id="djApiCloseOnLoad" type="checkbox" '+(s.closeOnDeckLoad?'checked':'')+'> Fermer API DJ+ après envoi vers un deck</label><label><input id="djApiRemember" type="checkbox" '+(s.rememberSearch===false?'':'checked')+'> Mémoriser les recherches sur cet appareil</label></div>'+
   '<p>Les clés restent uniquement dans le stockage local de cet appareil.</p><button id="djApiSave" type="button">ENREGISTRER</button>'+
  '</details><div id="djApiState" class="djApiState">Prêt</div></div>';
 document.body.appendChild(d);
 el('djApiClose').onclick=function(){d.close()};
 el('djApiSave').onclick=save;
 el('djApiSearchBtn').onclick=function(){page.token='';search()};
 el('djApiQuery').onkeydown=function(e){if(e.key==='Enter'){e.preventDefault();page.token='';search()}};
 el('djApiFavoritesBtn').onclick=showFavorites;
 el('djApiHistoryBtn').onclick=showHistory;
 el('djApiClearBtn').onclick=clearView;
 el('djApiPrev').onclick=function(){if(page.prev){page.token=page.prev;search(true)}};
 el('djApiNext').onclick=function(){if(page.next){page.token=page.next;search(true)}};
 renderProviders();renderRecent();updateFavoriteCount();updatePager();
}
function open(){inject();var d=el('djApiDialog');if(d&&!d.open)d.showModal()}
function save(){
 var old=cfg();localStorage.setItem('mpc-dj-api-settings',JSON.stringify({
  youtubeKey:(el('djApiYoutubeKey').value||'').trim(),youtubeRegion:(el('djApiYoutubeRegion').value||'FR').trim().toUpperCase().slice(0,2),jamendoClientId:(el('djApiJamendoId').value||'').trim(),lastfmKey:(el('djApiLastfmKey').value||'').trim(),closeOnDeckLoad:!!el('djApiCloseOnLoad').checked,rememberSearch:!!el('djApiRemember').checked
 }));if(old.rememberSearch!==false&&!el('djApiRemember').checked)localStorage.removeItem('mpc-dj-api-history');renderRecent();statusMsg('Configuration API DJ+ enregistrée sur cet appareil')
}
function renderProviders(){var root=el('djApiProviders');if(!root)return;root.innerHTML='';Object.keys(PROVIDERS).forEach(function(id){var p=PROVIDERS[id],b=create('button',id===provider&&view==='search'?'active':'','<b>'+esc(p.label)+'</b><small>'+esc(p.kind)+'</small>');b.type='button';b.onclick=function(){provider=id;view='search';results=[];page={next:'',prev:'',token:''};renderProviders();renderFilters();renderInfo();renderResults();updatePager()};root.appendChild(b)});renderFilters();renderInfo()}
function renderFilters(){var root=el('djApiFilters');if(!root)return;if(provider!=='youtube'||view!=='search'){root.innerHTML='';return}var f=filters();root.innerHTML='<label>TRI<select id="djApiOrder"><option value="relevance">Pertinence</option><option value="date">Plus récent</option><option value="viewCount">Plus vues</option><option value="rating">Mieux notées</option></select></label><label>DURÉE<select id="djApiDuration"><option value="any">Toutes</option><option value="short">Courte &lt; 4 min</option><option value="medium">4–20 min</option><option value="long">Longue &gt; 20 min</option></select></label><label>SAFE SEARCH<select id="djApiSafe"><option value="none">Désactivé</option><option value="moderate">Modéré</option><option value="strict">Strict</option></select></label><label>RÉSULTATS<select id="djApiCount"><option value="12">12</option><option value="18">18</option><option value="24">24</option></select></label>';el('djApiOrder').value=f.order;el('djApiDuration').value=f.duration;el('djApiSafe').value=f.safe;el('djApiCount').value=f.count;['djApiOrder','djApiDuration','djApiSafe','djApiCount'].forEach(function(id){el(id).onchange=function(){page.token='';results=[];updatePager()}})}
function renderInfo(){var p=PROVIDERS[provider];if(!el('djApiInfo'))return;if(view==='favorites')el('djApiInfo').innerHTML='<b>Favoris</b> · Titres enregistrés uniquement sur cet appareil.';else if(view==='history')el('djApiInfo').innerHTML='<b>Historique</b> · Relance une recherche récente en un clic.';else el('djApiInfo').innerHTML='<b>'+esc(p.label)+'</b> · '+esc(p.note)}
function renderRecent(){var root=el('djApiRecent');if(!root)return;var h=history().slice(0,6);if(!h.length||view!=='search'){root.innerHTML='';return}root.innerHTML='<span>RÉCENT</span>';h.forEach(function(x){var b=create('button','',esc(x.q));b.type='button';b.title=PROVIDERS[x.provider]?PROVIDERS[x.provider].label:'';b.onclick=function(){provider=x.provider||'youtube';view='search';renderProviders();el('djApiQuery').value=x.q;page.token='';search()};root.appendChild(b)})}
function showFavorites(){view='favorites';results=favorites();page={next:'',prev:'',token:''};renderProviders();renderInfo();renderRecent();renderResults();updatePager();statusMsg(results.length+' favori(s)')}
function showHistory(){view='history';results=[];page={next:'',prev:'',token:''};renderProviders();renderInfo();renderRecent();var root=el('djApiResults'),h=history();root.innerHTML='';if(!h.length){root.innerHTML='<div class="djApiEmpty">Aucune recherche récente.</div>'}else h.forEach(function(x){var card=create('button','djApiHistoryItem','<b>'+esc(x.q)+'</b><small>'+esc((PROVIDERS[x.provider]||PROVIDERS.youtube).label)+'</small>');card.type='button';card.onclick=function(){provider=x.provider||'youtube';view='search';renderProviders();el('djApiQuery').value=x.q;page.token='';search()};root.appendChild(card)});updatePager();statusMsg(h.length+' recherche(s) récente(s)')}
function clearView(){if(controller)controller.abort();if(audio){audio.pause();audio=null}results=[];page={next:'',prev:'',token:''};view='search';if(el('djApiQuery'))el('djApiQuery').value='';renderProviders();renderRecent();renderResults();updatePager();statusMsg('API DJ+ prêt')}
function updatePager(){var p=el('djApiPager');if(!p)return;var searchable=view==='search'&&provider==='youtube'&&(page.next||page.prev);p.hidden=!searchable;el('djApiPrev').disabled=!page.prev;el('djApiNext').disabled=!page.next;el('djApiPageInfo').textContent=results.length+' résultat(s)'}

async function search(fromPager){
 if(busy)return;view='search';var q=(el('djApiQuery').value||'').trim();if(!q)return statusMsg('Entre un artiste ou un titre');if(controller)controller.abort();controller=new AbortController();setBusy(true);el('djApiResults').innerHTML='<div class="djApiLoading">Recherche…</div>';statusMsg('Recherche '+PROVIDERS[provider].label+'…');renderProviders();renderRecent();
 try{
  var payload;if(provider==='youtube')payload=await searchYoutube(q,page.token,controller.signal);else if(provider==='jamendo')payload={items:await searchJamendo(q,controller.signal),next:'',prev:''};else payload={items:await searchLastfm(q,controller.signal),next:'',prev:''};
  results=payload.items||[];page.next=payload.next||'';page.prev=payload.prev||'';addHistory(q);renderResults();updatePager();statusMsg(results.length+' résultat(s) · '+PROVIDERS[provider].label+(payload.cached?' · cache':'')+(fromPager?' · page suivante':''));
 }catch(e){if(e&&e.name==='AbortError')return;results=[];page.next='';page.prev='';renderResults();updatePager();statusMsg('Erreur '+PROVIDERS[provider].label+' : '+(e.message||e))}finally{setBusy(false)}
}
async function searchYoutube(q,token,signal){
 var key=(cfg().youtubeKey||'').trim();if(!key)throw new Error('Ajoute ta clé YouTube Data API dans Configuration');var f=filters(),region=(cfg().youtubeRegion||'FR').trim().toUpperCase().slice(0,2),cacheKey='yt|'+q.toLowerCase()+'|'+JSON.stringify(f)+'|'+region+'|'+(token||''),cached=cacheRead(cacheKey);if(cached){cached.cached=true;return cached}
 var u=new URL('https://www.googleapis.com/youtube/v3/search');u.searchParams.set('part','snippet');u.searchParams.set('q',q);u.searchParams.set('type','video');u.searchParams.set('maxResults',f.count);u.searchParams.set('videoEmbeddable','true');u.searchParams.set('order',f.order);u.searchParams.set('videoDuration',f.duration);u.searchParams.set('safeSearch',f.safe);if(region)u.searchParams.set('regionCode',region);var lang=(navigator.language||'fr').slice(0,2);if(lang)u.searchParams.set('relevanceLanguage',lang);if(token)u.searchParams.set('pageToken',token);u.searchParams.set('fields','nextPageToken,prevPageToken,items(id/videoId,snippet(title,channelTitle,publishedAt,thumbnails))');u.searchParams.set('key',key);
 var d=await getJson(u,{signal:signal}),items=(d.items||[]).map(function(x){var s=x.snippet||{},id=x.id&&x.id.videoId;if(!id)return null;return {type:'youtube',id:id,title:decodeHtml(s.title||'Vidéo'),creator:decodeHtml(s.channelTitle||'YouTube'),image:(s.thumbnails&&((s.thumbnails.medium||s.thumbnails.default||{}).url))||'',source:'https://www.youtube.com/watch?v='+encodeURIComponent(id),detail:s.publishedAt?String(s.publishedAt).slice(0,10):''}}).filter(Boolean);
 if(items.length){try{var ids=items.map(function(x){return x.id}).join(','),v=new URL('https://www.googleapis.com/youtube/v3/videos');v.searchParams.set('part','contentDetails,statistics');v.searchParams.set('id',ids);v.searchParams.set('fields','items(id,contentDetails/duration,statistics/viewCount)');v.searchParams.set('key',key);var vd=await getJson(v,{signal:signal}),map={};(vd.items||[]).forEach(function(x){map[x.id]=x});items.forEach(function(x){var info=map[x.id]||{};x.duration=isoDuration(info.contentDetails&&info.contentDetails.duration);x.views=info.statistics&&info.statistics.viewCount?compact(info.statistics.viewCount)+' vues':''})}catch(e){if(e.name==='AbortError')throw e}}
 var out={items:items,next:d.nextPageToken||'',prev:d.prevPageToken||''};cacheWrite(cacheKey,out);return out
}
async function searchJamendo(q,signal){
 var client=(cfg().jamendoClientId||'').trim();if(!client)throw new Error('Ajoute ton client_id Jamendo dans Configuration');var cacheKey='jamendo|'+q.toLowerCase(),cached=cacheRead(cacheKey);if(cached)return cached;
 var u=new URL('https://api.jamendo.com/v3.0/tracks/');u.searchParams.set('client_id',client);u.searchParams.set('format','json');u.searchParams.set('limit','20');u.searchParams.set('search',q);u.searchParams.set('type','single albumtrack');u.searchParams.set('include','licenses musicinfo');u.searchParams.set('audioformat','mp32');u.searchParams.set('audiodlformat','mp32');u.searchParams.set('imagesize','300');var d=await getJson(u,{signal:signal});if(d.headers&&d.headers.status&&d.headers.status!=='success')throw new Error(d.headers.error_message||'Erreur Jamendo');
 var out=(d.results||[]).map(function(x){return {type:'jamendo',id:x.id,title:x.name||'Sans titre',creator:x.artist_name||'',image:safeUrl(x.image||x.album_image),preview:safeUrl(x.audio),download:safeUrl(x.audiodownload),downloadAllowed:x.audiodownload_allowed===true||x.audiodownload_allowed==='true',license:safeUrl(x.license_ccurl)||'Licence Jamendo / Creative Commons à vérifier',source:safeUrl(x.shareurl)||('https://www.jamendo.com/track/'+encodeURIComponent(x.id)),duration:x.duration?fmtSeconds(x.duration):'',detail:x.album_name||''}});cacheWrite(cacheKey,out);return out
}
async function searchLastfm(q,signal){
 var key=(cfg().lastfmKey||'').trim();if(!key)throw new Error('Ajoute ta clé Last.fm dans Configuration');var cacheKey='lastfm|'+q.toLowerCase(),cached=cacheRead(cacheKey);if(cached)return cached;var u=new URL('https://ws.audioscrobbler.com/2.0/');u.searchParams.set('method','track.search');u.searchParams.set('track',q);u.searchParams.set('api_key',key);u.searchParams.set('format','json');u.searchParams.set('limit','20');var d=await getJson(u,{signal:signal}),arr=d.results&&d.results.trackmatches&&d.results.trackmatches.track||[];if(!Array.isArray(arr))arr=[arr];
 var out=arr.filter(Boolean).map(function(x){var imgs=x.image||[],img='';if(Array.isArray(imgs)){for(var i=imgs.length-1;i>=0;i--){if(imgs[i]&&imgs[i]['#text']){img=imgs[i]['#text'];break}}}return {type:'lastfm',id:x.mbid||'',title:x.name||'Sans titre',creator:x.artist||'',image:safeUrl(img),source:safeUrl(x.url),detail:x.listeners?compact(x.listeners)+' auditeurs':'',license:'Métadonnées Last.fm'}});cacheWrite(cacheKey,out);return out
}

function renderResults(){
 var root=el('djApiResults');if(!root)return;root.innerHTML='';if(!results.length){root.innerHTML='<div class="djApiEmpty">Aucun résultat.</div>';return}
 results.forEach(function(r){
  var actions='<button data-a="fav" class="djApiFav '+(isFavorite(r)?'active':'')+'">'+(isFavorite(r)?'★':'☆')+'</button>';
  if(r.type==='youtube')actions+='<button data-a="deckA">DECK A</button><button data-a="deckB">DECK B</button>';
  if(r.type==='jamendo'){if(r.preview)actions+='<button data-a="play">▶ ÉCOUTER</button>';if(r.downloadAllowed&&r.download)actions+='<button data-a="pad">＋ PAD</button>';actions+='<button data-a="youtube">🔎 YT</button>'}
  if(r.type==='lastfm')actions+='<button data-a="youtube">🔎 YOUTUBE</button>';
  if(r.source)actions+='<button data-a="copy">COPIER</button><button data-a="source">SOURCE</button>';
  var meta=[r.duration,r.views,r.detail].filter(Boolean).join(' · '),card=create('article','djApiResult','<div class="djApiThumb">'+(r.image?'<img src="'+esc(r.image)+'" alt="" loading="lazy" decoding="async">':'<span>♫</span>')+'</div><div class="djApiMain"><b>'+esc(r.title)+'</b><small>'+esc(r.creator)+(meta?' · '+esc(meta):'')+'</small>'+(r.license?'<em>'+esc(r.license)+'</em>':'')+'</div><div class="djApiActions">'+actions+'</div>');
  var a=card.querySelector('[data-a="deckA"]'),b=card.querySelector('[data-a="deckB"]'),p=card.querySelector('[data-a="play"]'),pad=card.querySelector('[data-a="pad"]'),src=card.querySelector('[data-a="source"]'),fav=card.querySelector('[data-a="fav"]'),yt=card.querySelector('[data-a="youtube"]'),copy=card.querySelector('[data-a="copy"]');
  if(a)a.onclick=function(){loadDeck('A',r)};if(b)b.onclick=function(){loadDeck('B',r)};if(p)p.onclick=function(){preview(r,p)};if(pad)pad.onclick=function(){importJamendo(r)};if(src)src.onclick=function(){window.open(r.source,'_blank','noopener')};if(fav)fav.onclick=function(){toggleFavorite(r)};if(yt)yt.onclick=function(){searchOnYoutube(r)};if(copy)copy.onclick=function(){copyLink(r)};root.appendChild(card)
 })
}
function loadDeck(deck,r){var mode=document.querySelector('.bigModes button[data-mode="dj"]');if(mode)mode.click();function go(){if(window.MPCDJ&&typeof window.MPCDJ.load==='function'){window.MPCDJ.load(deck,r.source);statusMsg(r.title+' envoyé vers Deck '+deck);if(cfg().closeOnDeckLoad){var d=el('djApiDialog');if(d&&d.open)d.close()}}else statusMsg('Le module DJ n’est pas encore prêt')}setTimeout(go,80)}
function searchOnYoutube(r){provider='youtube';view='search';page={next:'',prev:'',token:''};renderProviders();renderRecent();el('djApiQuery').value=[r.creator,r.title].filter(Boolean).join(' ');search()}
function copyLink(r){var text=r.source||[r.creator,r.title].filter(Boolean).join(' - ');if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(function(){statusMsg('Lien copié')}).catch(function(){statusMsg('Copie impossible')});else statusMsg('Copie non disponible')}
function preview(r,button){if(audio){audio.pause();audio=null;document.querySelectorAll('.djApiActions button.playing').forEach(function(x){x.classList.remove('playing')})}if(!r.preview)return;audio=new Audio(r.preview);audio.crossOrigin='anonymous';button.classList.add('playing');audio.onended=function(){button.classList.remove('playing');audio=null};audio.play().then(function(){statusMsg('Lecture Jamendo : '+r.title)}).catch(function(){button.classList.remove('playing');statusMsg('La préécoute est bloquée par la source')})}
async function importJamendo(r){
 if(!r.downloadAllowed||!r.download)return statusMsg('Jamendo n’autorise pas le téléchargement de ce morceau');if(typeof window.importAudio!=='function'&&typeof importAudio!=='function')return statusMsg('Import pad indisponible');
 try{statusMsg('Téléchargement Jamendo…');var res=await fetch(r.download,{mode:'cors'});if(!res.ok)throw new Error('HTTP '+res.status);var blob=await res.blob(),name=String(r.title||'jamendo').replace(/[\\/:*?"<>|]+/g,' ').slice(0,80)+'.mp3',file=new File([blob],name,{type:blob.type||'audio/mpeg'}),fn=window.importAudio||importAudio;await fn(file);try{var sp=window.selected?window.selected():(typeof selected==='function'?selected():null);if(sp){sp.externalMeta={provider:'Jamendo',source:r.source,license:r.license,creator:r.creator};if(typeof window.renderEditor==='function')window.renderEditor();else if(typeof renderEditor==='function')renderEditor()}}catch(e){}statusMsg(r.title+' importé sur le pad sélectionné')}catch(e){statusMsg('Import Jamendo impossible : '+e.message)}
}

function init(){inject()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.MPCDJAPIs={open:open,search:function(q,p){if(p&&PROVIDERS[p])provider=p;view='search';open();if(el('djApiQuery'))el('djApiQuery').value=q||'';page.token='';return search()},favorites:function(){open();showFavorites()}};
})();
