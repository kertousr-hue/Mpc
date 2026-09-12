(function(){
'use strict';

function el(id){return document.getElementById(id)}
function status(t){var s=el('status');if(s)s.textContent=t;var n=el('vdjCatalogState');if(n)n.textContent=t}
function isLocalHost(h){return /^(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(h||'')}
function normalizeBase(raw){var v=String(raw||'').trim().replace(/\/$/,'');if(!v){if(location.protocol==='http:'&&isLocalHost(location.hostname))return location.origin;return ''}if(!/^https?:\/\//i.test(v))v='http://'+v;if(!/:\d+(?:\/|$)/.test(v.replace(/^https?:\/\//,'')))v+=':8765';return v.replace(/\/$/,'')}
function base(){return normalizeBase(el('vdjBridgeUrl')&&el('vdjBridgeUrl').value)}
function pin(){return String(el('vdjPin')&&el('vdjPin').value||'').trim()}
function fmtBpm(v){v=Number(v)||0;return v?v.toFixed(1)+' BPM':'—'}

async function jsonRequest(path,opt){
 var b=base();if(!b)throw new Error('Adresse du PC manquante');
 if(location.protocol==='https:'&&b.indexOf('http://')===0)throw new Error('Ouvre le CONTRÔLE LOCAL pour utiliser la recherche VirtualDJ');
 var options=opt||{};options.cache='no-store';options.headers=Object.assign({},options.headers||{}, {'X-MPC-PIN':pin()});
 var r=await fetch(b+path,options),data={};try{data=await r.json()}catch(e){}
 if(!r.ok||data.ok===false)throw new Error(data.error||('HTTP '+r.status));return data
}
async function command(payload){return jsonRequest('/api/vdj/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})}

function renderBrowser(b){
 b=b||{};var title=el('vdjCatalogTitle'),artist=el('vdjCatalogArtist'),meta=el('vdjCatalogMeta'),count=el('vdjCatalogCount');
 if(title)title.textContent=b.title||'Aucun morceau sélectionné';
 if(artist)artist.textContent=b.artist||'—';
 if(meta)meta.textContent=[fmtBpm(b.bpm),b.key||'—'].join(' · ');
 if(count)count.textContent=(Number(b.count)||0)+' résultat(s) visibles dans VirtualDJ';
}
async function refresh(){try{var d=await jsonRequest('/api/vdj/state');renderBrowser(d.browser);return d}catch(e){status('VirtualDJ · '+e.message);throw e}}
async function doSearch(){
 var q=String(el('vdjCatalogQuery').value||'').trim();if(!q){status('Entre un artiste ou un titre');return}
 try{status('Recherche dans VirtualDJ…');await command({action:'catalog_search',query:q});setTimeout(function(){refresh().then(function(){status('Recherche VirtualDJ prête')}).catch(function(){})},350)}catch(e){status('VirtualDJ · '+e.message)}
}
async function move(action){try{await command({action:action});setTimeout(function(){refresh().catch(function(){})},120)}catch(e){status('VirtualDJ · '+e.message)}}
async function load(deck){try{await command({action:'load_browsed',deck:deck});status('Morceau chargé sur Deck '+(deck===1?'A':'B'));setTimeout(function(){var r=el('vdjRefreshBtn');if(r)r.click()},300)}catch(e){status('VirtualDJ · '+e.message)}}
async function preview(){try{await command({action:'preview_browsed'});status('Préécoute du morceau sélectionné')}catch(e){status('VirtualDJ · '+e.message)}}
async function stopPreview(){try{await command({action:'preview_stop'});status('Préécoute arrêtée')}catch(e){status('VirtualDJ · '+e.message)}}
async function clearSearch(){try{await command({action:'clear_catalog_search'});el('vdjCatalogQuery').value='';renderBrowser({});status('Recherche VirtualDJ effacée')}catch(e){status('VirtualDJ · '+e.message)}}

function style(){if(el('vdjCatalogStyle'))return;var s=document.createElement('style');s.id='vdjCatalogStyle';s.textContent='.vdjCatalog{display:grid;gap:8px;margin-top:10px;padding:10px;border:1px solid #244457;border-radius:9px;background:#08131b}.vdjCatalogHead{display:flex;justify-content:space-between;align-items:center;gap:8px}.vdjCatalogHead b{font-size:10px;color:#68d8ff}.vdjCatalogHead span{font-size:8px;color:#7f96a5}.vdjCatalogServices{display:flex;flex-wrap:wrap;gap:4px}.vdjCatalogServices span{font-size:8px;padding:4px 6px;border:1px solid #254255;border-radius:999px;color:#9bcde2;background:#0c1922}.vdjCatalogSearch{display:grid;grid-template-columns:1fr auto;gap:6px}.vdjCatalogSearch input{min-width:0;width:100%}.vdjCatalogSearch button{color:#83ddff;border-color:#2c7190}.vdjCatalogSelected{display:grid;gap:3px;padding:8px;border:1px solid #1d3545;border-radius:7px;background:#061018}.vdjCatalogSelected strong{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vdjCatalogSelected span{font-size:9px;color:#839aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vdjCatalogNav,.vdjCatalogLoad{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.vdjCatalogLoad{grid-template-columns:repeat(4,1fr)}.vdjCatalog button{font-size:9px;min-height:34px;padding:5px}.vdjCatalogLoad button:nth-child(3),.vdjCatalogLoad button:nth-child(4){color:#6ef0a0;border-color:#287949}.vdjCatalog small{font-size:8px;line-height:1.4;color:#708796}.vdjCatalogState{font-size:8px;color:#8edbff}@media(max-width:760px){.vdjCatalogSearch{grid-template-columns:1fr}.vdjCatalogNav{grid-template-columns:repeat(3,1fr)}.vdjCatalogLoad{grid-template-columns:1fr 1fr}}';document.head.appendChild(s)}
function inject(){
 var mixer=document.querySelector('#virtualDjWorkspace .vdjMixer');if(!mixer||el('vdjCatalog'))return false;style();
 var box=document.createElement('section');box.id='vdjCatalog';box.className='vdjCatalog';box.innerHTML='<div class="vdjCatalogHead"><b>☁ MUSIQUE EN LIGNE VIRTUALDJ</b><span id="vdjCatalogCount">0 résultat</span></div><div class="vdjCatalogServices"><span>SoundCloud</span><span>Beatport</span><span>Beatsource</span><span>TIDAL</span><span>Deezer</span><span>Catalogues VirtualDJ</span></div><div class="vdjCatalogSearch"><input id="vdjCatalogQuery" autocomplete="off" placeholder="Artiste, titre, remix…"><button id="vdjCatalogSearchBtn" type="button">RECHERCHER</button></div><div class="vdjCatalogSelected"><strong id="vdjCatalogTitle">Aucun morceau sélectionné</strong><span id="vdjCatalogArtist">—</span><span id="vdjCatalogMeta">—</span></div><div class="vdjCatalogNav"><button id="vdjCatalogPrev" type="button">← PRÉC.</button><button id="vdjCatalogTop" type="button">DÉBUT</button><button id="vdjCatalogNext" type="button">SUIV. →</button></div><div class="vdjCatalogLoad"><button id="vdjCatalogPreview" type="button">▶ ÉCOUTER</button><button id="vdjCatalogStop" type="button">■ STOP</button><button id="vdjCatalogDeckA" type="button">DECK A</button><button id="vdjCatalogDeckB" type="button">DECK B</button></div><button id="vdjCatalogClear" type="button">EFFACER RECHERCHE</button><small>La recherche utilise le navigateur de VirtualDJ. Connecte d’abord tes abonnements SoundCloud, Beatport, Beatsource, TIDAL ou Deezer directement dans VirtualDJ. Les morceaux disponibles peuvent ensuite être chargés sur Deck A ou B.</small><div id="vdjCatalogState" class="vdjCatalogState">Prêt</div>';
 var connect=mixer.querySelector('.vdjConnectCard');if(connect)connect.insertAdjacentElement('afterend',box);else mixer.prepend(box);
 el('vdjCatalogSearchBtn').onclick=doSearch;el('vdjCatalogQuery').onkeydown=function(e){if(e.key==='Enter'){e.preventDefault();doSearch()}};el('vdjCatalogPrev').onclick=function(){move('browser_prev')};el('vdjCatalogNext').onclick=function(){move('browser_next')};el('vdjCatalogTop').onclick=function(){move('browser_top')};el('vdjCatalogDeckA').onclick=function(){load(1)};el('vdjCatalogDeckB').onclick=function(){load(2)};el('vdjCatalogPreview').onclick=preview;el('vdjCatalogStop').onclick=stopPreview;el('vdjCatalogClear').onclick=clearSearch;
 return true
}
function init(){if(inject())return;var tries=0,t=setInterval(function(){tries++;if(inject()||tries>100)clearInterval(t)},100)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.MPCVirtualDJCatalogs={search:doSearch,refresh:refresh,load:load};
})();
