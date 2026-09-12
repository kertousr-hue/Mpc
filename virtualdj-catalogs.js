(function(){
'use strict';

var STORE='mpc-vdj-catalog-v2';
var state={browser:{},history:[],favorites:[],settings:{autoPreview:false,autoSync:true,autoPlay:false}};
function el(id){return document.getElementById(id)}
function status(t){var s=el('status');if(s)s.textContent=t;var n=el('vdjCatalogState');if(n)n.textContent=t}
function esc(s){return String(s||'').replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]})}
function isLocalHost(h){return /^(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(h||'')}
function normalizeBase(raw){var v=String(raw||'').trim().replace(/\/$/,'');if(!v){if(location.protocol==='http:'&&isLocalHost(location.hostname))return location.origin;return ''}if(!/^https?:\/\//i.test(v))v='http://'+v;if(!/:\d+(?:\/|$)/.test(v.replace(/^https?:\/\//,'')))v+=':8765';return v.replace(/\/$/,'')}
function base(){return normalizeBase(el('vdjBridgeUrl')&&el('vdjBridgeUrl').value)}
function pin(){return String(el('vdjPin')&&el('vdjPin').value||'').trim()}
function fmtBpm(v){v=Number(v)||0;return v?v.toFixed(1)+' BPM':'—'}
function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}
function loadStore(){try{var d=JSON.parse(localStorage.getItem(STORE)||'{}');state.history=Array.isArray(d.history)?d.history.slice(0,12):[];state.favorites=Array.isArray(d.favorites)?d.favorites.slice(0,30):[];state.settings=Object.assign(state.settings,d.settings||{})}catch(e){}}
function saveStore(){try{localStorage.setItem(STORE,JSON.stringify({history:state.history,favorites:state.favorites,settings:state.settings}))}catch(e){}}
function uniqHistory(q){q=String(q||'').trim();if(!q)return;state.history=[q].concat(state.history.filter(function(x){return String(x).toLowerCase()!==q.toLowerCase()})).slice(0,12);saveStore();renderSaved()}
function trackKey(t){return [t&&t.artist,t&&t.title].map(function(v){return String(v||'').trim().toLowerCase()}).join('|')}

async function jsonRequest(path,opt){
 var b=base();if(!b)throw new Error('Adresse du PC manquante');
 if(location.protocol==='https:'&&b.indexOf('http://')===0)throw new Error('Ouvre le CONTRÔLE LOCAL pour utiliser la recherche VirtualDJ');
 var options=opt||{};options.cache='no-store';options.headers=Object.assign({},options.headers||{}, {'X-MPC-PIN':pin()});
 var r=await fetch(b+path,options),data={};try{data=await r.json()}catch(e){}
 if(!r.ok||data.ok===false)throw new Error(data.error||('HTTP '+r.status));return data
}
async function command(payload){return jsonRequest('/api/vdj/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})}

function renderBrowser(b){
 b=b||{};state.browser=b;
 var title=el('vdjCatalogTitle'),artist=el('vdjCatalogArtist'),meta=el('vdjCatalogMeta'),count=el('vdjCatalogCount'),fav=el('vdjCatalogFavorite');
 if(title)title.textContent=b.title||'Aucun morceau sélectionné';
 if(artist)artist.textContent=b.artist||'—';
 if(meta)meta.textContent=[fmtBpm(b.bpm),b.key||'—'].join(' · ');
 if(count)count.textContent=(Number(b.count)||0)+' résultat(s) visibles';
 if(fav){var yes=state.favorites.some(function(x){return trackKey(x)===trackKey(b)&&trackKey(b)!=='|'});fav.textContent=yes?'★ FAVORI':'☆ FAVORI';fav.classList.toggle('active',yes)}
}
async function refresh(){try{var d=await jsonRequest('/api/vdj/state');renderBrowser(d.browser);return d}catch(e){status('VirtualDJ · '+e.message);throw e}}
async function doSearch(query){
 var input=el('vdjCatalogQuery'),q=String(query!==undefined?query:(input&&input.value)||'').trim();if(!q){status('Entre un artiste ou un titre');return}
 if(input)input.value=q;uniqHistory(q);
 try{status('Recherche dans VirtualDJ…');await command({action:'catalog_search',query:q});await sleep(300);await refresh();status('Recherche VirtualDJ prête');if(state.settings.autoPreview)await preview()}catch(e){status('VirtualDJ · '+e.message)}
}
async function move(action,count){
 count=Math.max(1,Math.min(10,Number(count)||1));
 try{for(var i=0;i<count;i++){await command({action:action});if(count>1)await sleep(45)}await sleep(100);await refresh();if(state.settings.autoPreview)await preview()}catch(e){status('VirtualDJ · '+e.message)}
}
async function applyAfterLoad(deck){
 if(state.settings.autoSync){await sleep(450);try{await command({action:'sync',deck:deck})}catch(e){}}
 if(state.settings.autoPlay){await sleep(180);try{await command({action:'play',deck:deck})}catch(e){}}
}
async function load(deck){
 try{await command({action:'load_browsed',deck:deck});status('Morceau chargé sur Deck '+(deck===1?'A':'B'));await applyAfterLoad(deck);setTimeout(function(){var r=el('vdjRefreshBtn');if(r)r.click()},250)}catch(e){status('VirtualDJ · '+e.message)}
}
async function smartLoad(){
 try{var d=await jsonRequest('/api/vdj/state'),a=d.decks&&d.decks['1']||{},b=d.decks&&d.decks['2']||{},deck=1;
  if(a.playing&&!b.playing)deck=2;else if(!a.playing&&b.playing)deck=1;else if(a.title&&!b.title)deck=2;else if(!a.title&&b.title)deck=1;else deck=(Number(a.position)||0)<=(Number(b.position)||0)?1:2;
  await load(deck)
 }catch(e){status('VirtualDJ · '+e.message)}
}
async function preview(){try{await command({action:'preview_browsed'});status('Préécoute du morceau sélectionné')}catch(e){status('VirtualDJ · '+e.message)}}
async function stopPreview(){try{await command({action:'preview_stop'});status('Préécoute arrêtée')}catch(e){status('VirtualDJ · '+e.message)}}
async function clearSearch(){try{await command({action:'clear_catalog_search'});if(el('vdjCatalogQuery'))el('vdjCatalogQuery').value='';renderBrowser({});status('Recherche VirtualDJ effacée')}catch(e){status('VirtualDJ · '+e.message)}}
function toggleFavorite(){
 var b=state.browser||{},k=trackKey(b);if(!b.title||k==='|'){status('Sélectionne d’abord un morceau');return}
 var i=state.favorites.findIndex(function(x){return trackKey(x)===k});
 if(i>=0){state.favorites.splice(i,1);status('Retiré des favoris')}else{state.favorites.unshift({title:b.title||'',artist:b.artist||'',bpm:Number(b.bpm)||0,key:b.key||''});state.favorites=state.favorites.slice(0,30);status('Ajouté aux favoris')}
 saveStore();renderBrowser(b);renderSaved()
}
function renderSaved(){
 var h=el('vdjCatalogHistory'),f=el('vdjCatalogFavorites');if(!h||!f)return;
 h.innerHTML=state.history.length?state.history.map(function(q,i){return '<button type="button" data-vdj-history="'+i+'">'+esc(q)+'</button>'}).join(''):'<span>Aucune recherche récente</span>';
 f.innerHTML=state.favorites.length?state.favorites.slice(0,8).map(function(t,i){return '<button type="button" data-vdj-favorite="'+i+'"><b>'+esc(t.title||'Sans titre')+'</b><small>'+esc(t.artist||'—')+'</small></button>'}).join(''):'<span>Aucun favori</span>';
 h.querySelectorAll('[data-vdj-history]').forEach(function(b){b.onclick=function(){doSearch(state.history[Number(b.dataset.vdjHistory)])}});
 f.querySelectorAll('[data-vdj-favorite]').forEach(function(b){b.onclick=function(){var t=state.favorites[Number(b.dataset.vdjFavorite)];if(t)doSearch([t.artist,t.title].filter(Boolean).join(' '))}})
}
function setSetting(name,value){state.settings[name]=!!value;saveStore();status('Option enregistrée')}
function clearSaved(kind){if(kind==='history')state.history=[];else state.favorites=[];saveStore();renderSaved();status(kind==='history'?'Historique effacé':'Favoris effacés')}

function style(){if(el('vdjCatalogStyle'))return;var s=document.createElement('style');s.id='vdjCatalogStyle';s.textContent='.vdjCatalog{display:grid;gap:8px;margin-top:10px;padding:10px;border:1px solid #244457;border-radius:9px;background:#08131b}.vdjCatalogHead{display:flex;justify-content:space-between;align-items:center;gap:8px}.vdjCatalogHead b{font-size:10px;color:#68d8ff}.vdjCatalogHead span{font-size:8px;color:#7f96a5}.vdjCatalogServices{display:flex;flex-wrap:wrap;gap:4px}.vdjCatalogServices span{font-size:8px;padding:4px 6px;border:1px solid #254255;border-radius:999px;color:#9bcde2;background:#0c1922}.vdjCatalogSearch{display:grid;grid-template-columns:1fr auto;gap:6px}.vdjCatalogSearch input{min-width:0;width:100%}.vdjCatalogSearch button{color:#83ddff;border-color:#2c7190}.vdjCatalogSelected{display:grid;gap:3px;padding:8px;border:1px solid #1d3545;border-radius:7px;background:#061018}.vdjCatalogSelected strong{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vdjCatalogSelected span{font-size:9px;color:#839aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vdjCatalogNav{display:grid;grid-template-columns:repeat(5,1fr);gap:5px}.vdjCatalogLoad{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}.vdjCatalogLoad button:nth-child(2),.vdjCatalogLoad button:nth-child(3),.vdjCatalogLoad button:nth-child(4){color:#6ef0a0;border-color:#287949}.vdjCatalog button{font-size:9px;min-height:34px;padding:5px}.vdjCatalogFavorite.active{color:#ffd25f;border-color:#8c6b20}.vdjCatalogOptions{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.vdjCatalogOptions label{display:flex;gap:5px;align-items:center;justify-content:center;font-size:8px;color:#9bb0bc;border:1px solid #203a4a;border-radius:6px;padding:6px}.vdjCatalogOptions input{accent-color:#46cfff}.vdjCatalogSaved{display:grid;gap:5px;padding-top:5px;border-top:1px solid #18303e}.vdjCatalogSavedHead{display:flex;justify-content:space-between;align-items:center;gap:6px}.vdjCatalogSavedHead b{font-size:8px;color:#86a9bc}.vdjCatalogSavedHead button{min-height:26px;font-size:8px;padding:3px 6px}.vdjCatalogChips{display:flex;gap:4px;overflow:auto;padding-bottom:2px}.vdjCatalogChips>button{flex:0 0 auto;min-height:29px;font-size:8px;max-width:155px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.vdjCatalogFavorites{display:grid;grid-template-columns:1fr 1fr;gap:4px}.vdjCatalogFavorites>button{text-align:left;display:grid;gap:1px;min-width:0}.vdjCatalogFavorites b,.vdjCatalogFavorites small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.vdjCatalogFavorites small,.vdjCatalogChips>span,.vdjCatalogFavorites>span{font-size:8px;color:#718897}.vdjCatalog small{font-size:8px;line-height:1.4;color:#708796}.vdjCatalogState{font-size:8px;color:#8edbff}@media(max-width:760px){.vdjCatalogSearch{grid-template-columns:1fr}.vdjCatalogNav{grid-template-columns:repeat(5,minmax(0,1fr))}.vdjCatalogLoad{grid-template-columns:1fr 1fr}.vdjCatalogOptions{grid-template-columns:1fr}.vdjCatalogFavorites{grid-template-columns:1fr}.vdjCatalog button{min-height:38px}}';document.head.appendChild(s)}
function inject(){
 var mixer=document.querySelector('#virtualDjWorkspace .vdjMixer');if(!mixer||el('vdjCatalog'))return false;style();loadStore();
 var box=document.createElement('section');box.id='vdjCatalog';box.className='vdjCatalog';box.innerHTML='<div class="vdjCatalogHead"><b>☁ MUSIQUE EN LIGNE VIRTUALDJ</b><span id="vdjCatalogCount">0 résultat</span></div><div class="vdjCatalogServices"><span>SoundCloud</span><span>Beatport</span><span>Beatsource</span><span>TIDAL</span><span>Deezer</span><span>Catalogues VirtualDJ</span></div><div class="vdjCatalogSearch"><input id="vdjCatalogQuery" autocomplete="off" placeholder="Artiste, titre, remix…"><button id="vdjCatalogSearchBtn" type="button">RECHERCHER</button></div><div class="vdjCatalogSelected"><strong id="vdjCatalogTitle">Aucun morceau sélectionné</strong><span id="vdjCatalogArtist">—</span><span id="vdjCatalogMeta">—</span></div><div class="vdjCatalogNav"><button id="vdjCatalogPrev5" type="button">−5</button><button id="vdjCatalogPrev" type="button">←</button><button id="vdjCatalogTop" type="button">DÉBUT</button><button id="vdjCatalogNext" type="button">→</button><button id="vdjCatalogNext5" type="button">+5</button></div><div class="vdjCatalogLoad"><button id="vdjCatalogFavorite" class="vdjCatalogFavorite" type="button">☆ FAVORI</button><button id="vdjCatalogDeckA" type="button">DECK A</button><button id="vdjCatalogDeckB" type="button">DECK B</button><button id="vdjCatalogSmart" type="button">AUTO DECK</button></div><div class="vdjCatalogLoad"><button id="vdjCatalogPreview" type="button">▶ ÉCOUTER</button><button id="vdjCatalogStop" type="button">■ STOP</button><button id="vdjCatalogClear" type="button">EFFACER</button><button id="vdjCatalogRefresh" type="button">↻ INFO</button></div><div class="vdjCatalogOptions"><label><input id="vdjAutoPreview" type="checkbox"> PRÉÉCOUTE AUTO</label><label><input id="vdjAutoSync" type="checkbox"> SYNC APRÈS CHARGEMENT</label><label><input id="vdjAutoPlay" type="checkbox"> PLAY AUTO</label></div><div class="vdjCatalogSaved"><div class="vdjCatalogSavedHead"><b>🕘 RECHERCHES RÉCENTES</b><button id="vdjClearHistory" type="button">EFFACER</button></div><div id="vdjCatalogHistory" class="vdjCatalogChips"></div></div><div class="vdjCatalogSaved"><div class="vdjCatalogSavedHead"><b>★ FAVORIS</b><button id="vdjClearFavorites" type="button">EFFACER</button></div><div id="vdjCatalogFavorites" class="vdjCatalogFavorites"></div></div><small>La recherche utilise le navigateur de VirtualDJ. Les abonnements doivent être connectés directement dans VirtualDJ. AUTO DECK choisit en priorité la platine qui ne joue pas. Les favoris et options restent enregistrés sur cet appareil.</small><div id="vdjCatalogState" class="vdjCatalogState">Prêt</div>';
 var connect=mixer.querySelector('.vdjConnectCard');if(connect)connect.insertAdjacentElement('afterend',box);else mixer.prepend(box);
 el('vdjCatalogSearchBtn').onclick=function(){doSearch()};el('vdjCatalogQuery').onkeydown=function(e){if(e.key==='Enter'){e.preventDefault();doSearch()}else if(e.key==='ArrowDown'&&e.altKey){e.preventDefault();move('browser_next',1)}else if(e.key==='ArrowUp'&&e.altKey){e.preventDefault();move('browser_prev',1)}};
 el('vdjCatalogPrev').onclick=function(){move('browser_prev',1)};el('vdjCatalogNext').onclick=function(){move('browser_next',1)};el('vdjCatalogPrev5').onclick=function(){move('browser_prev',5)};el('vdjCatalogNext5').onclick=function(){move('browser_next',5)};el('vdjCatalogTop').onclick=function(){move('browser_top',1)};
 el('vdjCatalogDeckA').onclick=function(){load(1)};el('vdjCatalogDeckB').onclick=function(){load(2)};el('vdjCatalogSmart').onclick=smartLoad;el('vdjCatalogFavorite').onclick=toggleFavorite;el('vdjCatalogPreview').onclick=preview;el('vdjCatalogStop').onclick=stopPreview;el('vdjCatalogClear').onclick=clearSearch;el('vdjCatalogRefresh').onclick=function(){refresh().then(function(){status('Informations actualisées')}).catch(function(){})};
 el('vdjAutoPreview').checked=!!state.settings.autoPreview;el('vdjAutoSync').checked=!!state.settings.autoSync;el('vdjAutoPlay').checked=!!state.settings.autoPlay;
 el('vdjAutoPreview').onchange=function(e){setSetting('autoPreview',e.target.checked)};el('vdjAutoSync').onchange=function(e){setSetting('autoSync',e.target.checked)};el('vdjAutoPlay').onchange=function(e){setSetting('autoPlay',e.target.checked)};
 el('vdjClearHistory').onclick=function(){clearSaved('history')};el('vdjClearFavorites').onclick=function(){clearSaved('favorites')};renderSaved();
 return true
}
function init(){if(inject())return;var tries=0,t=setInterval(function(){tries++;if(inject()||tries>100)clearInterval(t)},100)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.MPCVirtualDJCatalogs={search:doSearch,refresh:refresh,load:load,smartLoad:smartLoad,preview:preview};
})();
