(function(){
'use strict';
var SERVICES={
  openverse:{label:'Openverse',kind:'Sons libres',note:'Audio Creative Commons ou domaine public. Vérifie la licence avant utilisation commerciale.'},
  wikimedia:{label:'Wikimedia Commons',kind:'Sons libres',note:'Fichiers audio Commons avec informations de licence.'},
  archive:{label:'Internet Archive',kind:'Archives audio',note:'Recherche gratuite. Les droits varient selon chaque élément.'},
  musicbrainz:{label:'MusicBrainz',kind:'Métadonnées',note:'Artistes, titres et identifiants. Pas de téléchargement audio.'},
  freesound:{label:'Freesound',kind:'Samples',note:'Clé API gratuite requise. Chaque son a sa propre licence.'},
  demucs:{label:'Demucs',kind:'Séparation',note:'Sépare un fichier en drums, bass, vocals et other.'},
  basicpitch:{label:'Basic Pitch',kind:'Audio vers MIDI',note:'Open source à auto-héberger. URL de serveur configurable.'}
};
var provider='openverse',results=[],remoteAudio=null,busy=false;
function esc(s){return String(s||'').replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]})}
function strip(s){var d=document.createElement('div');d.innerHTML=s||'';return d.textContent||''}
function safeUrl(s){try{var u=new URL(s);return u.protocol==='https:'||u.protocol==='http:'?u.href:''}catch(e){return ''}}
function settings(){try{return JSON.parse(localStorage.getItem('mpc-free-api-settings')||'{}')}catch(e){return {}}}
function apiStatus(s){var n=document.getElementById('apiState');if(n)n.textContent=s;if(typeof status==='function')status(s)}
function create(tag,cls,html){var n=document.createElement(tag);if(cls)n.className=cls;if(html!==undefined)n.innerHTML=html;return n}
function inject(){
  var bottom=document.querySelector('.bottom');
  if(bottom&&!document.getElementById('apiHubBtn')){
    var b=create('button','blueBtn','🌐 API GRATUITES');b.id='apiHubBtn';b.onclick=function(){document.getElementById('apiDialog').showModal()};bottom.appendChild(b)
  }
  if(document.getElementById('apiDialog'))return;
  var s=settings(),d=create('dialog');d.id='apiDialog';
  d.innerHTML=
  '<div class="apiCard">'+
  '<div class="dialogHead"><div><small>OUTILS EXTERNES</small><h2>API gratuites</h2></div><button id="apiCloseBtn">✕</button></div>'+
  '<div class="apiNotice">Les fichiers externes gardent leur licence. Vérifie toujours les droits avant une utilisation commerciale.</div>'+
  '<div id="apiProviders" class="apiProviders"></div>'+
  '<section id="apiSearchSection">'+
  '<div class="apiSearch"><input id="apiQuery" placeholder="kick house, percussion, piano, rain…"><button id="apiSearchBtn" class="blueBtn">RECHERCHER</button></div>'+
  '<div id="apiProviderInfo" class="apiProviderInfo"></div><div id="apiResults" class="apiResults"></div></section>'+
  '<section id="apiToolsSection" class="apiTools">'+
  '<div class="apiTool"><div><b>Demucs</b><small>Sépare le sample du pad sélectionné en 4 stems.</small></div><button id="demucsBtn">SÉPARER LE PAD</button></div>'+
  '<div class="apiTool"><div><b>Basic Pitch</b><small>Convertit le sample du pad en MIDI via ton serveur.</small></div><button id="basicPitchBtn">AUDIO → MIDI</button></div>'+
  '</section>'+
  '<details class="apiSettings"><summary>Configuration</summary>'+
  '<label>Clé Freesound gratuite<input id="apiFreesoundKey" value="'+esc(s.freesoundKey||'')+'" placeholder="API key Freesound"></label>'+
  '<label>URL serveur Basic Pitch<input id="apiBasicPitchUrl" value="'+esc(s.basicPitchUrl||'')+'" placeholder="https://serveur.example/audio-to-midi"></label>'+
  '<button id="apiSaveSettings">ENREGISTRER</button></details>'+
  '<div id="apiState" class="authState">Prêt</div></div>';
  document.body.appendChild(d);
  document.getElementById('apiCloseBtn').onclick=function(){d.close()};
  document.getElementById('apiSearchBtn').onclick=search;
  document.getElementById('apiQuery').onkeydown=function(e){if(e.key==='Enter')search()};
  document.getElementById('apiSaveSettings').onclick=saveSettings;
  document.getElementById('demucsBtn').onclick=runDemucs;
  document.getElementById('basicPitchBtn').onclick=runBasicPitch;
  renderProviders()
}
function saveSettings(){
  localStorage.setItem('mpc-free-api-settings',JSON.stringify({
    freesoundKey:(document.getElementById('apiFreesoundKey').value||'').trim(),
    basicPitchUrl:(document.getElementById('apiBasicPitchUrl').value||'').trim().replace(/\/$/,'')
  }));
  apiStatus('Configuration API enregistrée')
}
function renderProviders(){
  var root=document.getElementById('apiProviders');root.innerHTML='';
  Object.keys(SERVICES).forEach(function(id){
    var p=SERVICES[id],b=create('button',id===provider?'active':'','<b>'+esc(p.label)+'</b><small>'+esc(p.kind)+'</small>');
    b.onclick=function(){provider=id;renderProviders();renderInfo();document.getElementById('apiResults').innerHTML=''};root.appendChild(b)
  });
  renderInfo()
}
function renderInfo(){
  var p=SERVICES[provider],searchable=['openverse','wikimedia','archive','musicbrainz','freesound'].indexOf(provider)>=0;
  document.getElementById('apiProviderInfo').innerHTML='<b>'+esc(p.label)+'</b> · '+esc(p.note)+(provider==='freesound'?' <span class="apiKeyBadge">CLÉ GRATUITE</span>':'');
  document.getElementById('apiSearchSection').classList.toggle('apiHidden',!searchable);
  document.getElementById('apiToolsSection').classList.toggle('apiHidden',searchable)
}
async function getJson(url,opt){
  var r=await fetch(url,opt||{});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()
}
async function search(){
  if(busy)return;var q=(document.getElementById('apiQuery').value||'').trim();if(!q)return apiStatus('Entre un mot à rechercher');
  busy=true;apiStatus('Recherche '+SERVICES[provider].label+'…');document.getElementById('apiResults').innerHTML='<div class="apiLoading">Recherche…</div>';
  try{
    if(provider==='openverse')results=await openverse(q);
    else if(provider==='wikimedia')results=await wikimedia(q);
    else if(provider==='archive')results=await archive(q);
    else if(provider==='musicbrainz')results=await musicbrainz(q);
    else if(provider==='freesound')results=await freesound(q);
    renderResults();apiStatus(results.length+' résultat(s)')
  }catch(e){document.getElementById('apiResults').innerHTML='';apiStatus('Erreur API : '+e.message)}finally{busy=false}
}
async function openverse(q){
  var u=new URL('https://api.openverse.org/v1/audio/');u.searchParams.set('q',q);u.searchParams.set('page_size','20');var d=await getJson(u);
  return (d.results||[]).map(function(x){return {provider:'Openverse',title:x.title||'Sans titre',creator:x.creator||'',license:[x.license,x.license_version].filter(Boolean).join(' '),audio:safeUrl(x.url),preview:safeUrl(x.url),source:safeUrl(x.foreign_landing_url)||safeUrl(x.detail_url),detail:x.source||x.provider||''}})
}
async function wikimedia(q){
  var u=new URL('https://commons.wikimedia.org/w/api.php'),params={action:'query',format:'json',origin:'*',generator:'search',gsrsearch:q+' filetype:audio',gsrnamespace:'6',gsrlimit:'40',prop:'imageinfo',iiprop:'url|mime|extmetadata'};
  Object.keys(params).forEach(function(k){u.searchParams.set(k,params[k])});var d=await getJson(u),pages=Object.values((d.query&&d.query.pages)||{});
  return pages.map(function(p){var ii=(p.imageinfo&&p.imageinfo[0])||{},m=ii.extmetadata||{};if((ii.mime||'').indexOf('audio/')!==0)return null;return {provider:'Wikimedia',title:(p.title||'').replace(/^File:/,''),creator:strip(m.Artist&&m.Artist.value),license:strip((m.LicenseShortName&&m.LicenseShortName.value)||(m.UsageTerms&&m.UsageTerms.value)||''),audio:safeUrl(ii.url),preview:safeUrl(ii.url),source:'https://commons.wikimedia.org/wiki/'+encodeURIComponent(p.title||''),detail:ii.mime||'audio'}}).filter(Boolean).slice(0,20)
}
async function archive(q){
  var u=new URL('https://archive.org/advancedsearch.php');u.searchParams.set('q','mediatype:audio AND ('+q+')');['identifier','title','creator','licenseurl'].forEach(function(f){u.searchParams.append('fl[]',f)});u.searchParams.set('rows','20');u.searchParams.set('page','1');u.searchParams.set('output','json');var d=await getJson(u);
  return (((d||{}).response||{}).docs||[]).map(function(x){return {provider:'Internet Archive',title:x.title||x.identifier,creator:Array.isArray(x.creator)?x.creator.join(', '):(x.creator||''),license:Array.isArray(x.licenseurl)?x.licenseurl.join(', '):(x.licenseurl||'Voir la fiche'),audio:'',preview:'',source:'https://archive.org/details/'+encodeURIComponent(x.identifier),detail:'Archive audio'}})
}
async function musicbrainz(q){
  var u=new URL('https://musicbrainz.org/ws/2/recording/');u.searchParams.set('query',q);u.searchParams.set('fmt','json');u.searchParams.set('limit','20');var d=await getJson(u,{headers:{Accept:'application/json'}});
  return (d.recordings||[]).map(function(x){var a=(x['artist-credit']||[]).map(function(v){return v.name||(v.artist&&v.artist.name)||''}).filter(Boolean).join('');return {provider:'MusicBrainz',title:x.title||'Sans titre',creator:a,license:'Métadonnées',audio:'',preview:'',source:'https://musicbrainz.org/recording/'+encodeURIComponent(x.id),detail:x.length?Math.round(x.length/1000)+' s':''}})
}
async function freesound(q){
  var key=(settings().freesoundKey||'').trim();if(!key)throw new Error('Ajoute ta clé Freesound gratuite dans Configuration');
  var u=new URL('https://freesound.org/apiv2/search/');u.searchParams.set('query',q);u.searchParams.set('token',key);u.searchParams.set('page_size','20');u.searchParams.set('fields','id,name,username,license,previews,url,duration');var d=await getJson(u);
  return (d.results||[]).map(function(x){var p=(x.previews&&x.previews['preview-hq-mp3'])||(x.previews&&x.previews['preview-lq-mp3'])||'';return {provider:'Freesound',title:x.name||'Sample',creator:x.username||'',license:x.license||'',audio:safeUrl(p),preview:safeUrl(p),source:safeUrl(x.url)||('https://freesound.org/s/'+x.id+'/'),detail:x.duration?Number(x.duration).toFixed(2)+' s':''}})
}
function renderResults(){
  var root=document.getElementById('apiResults');root.innerHTML='';if(!results.length){root.innerHTML='<div class="apiEmpty">Aucun résultat.</div>';return}
  results.forEach(function(r){
    var card=create('article','apiResult','<div class="apiResultMain"><b>'+esc(r.title)+'</b><small>'+esc(r.creator||r.provider)+(r.detail?' · '+esc(r.detail):'')+'</small><span class="apiLicense">'+esc(r.license||'Licence à vérifier')+'</span></div><div class="apiResultActions">'+(r.preview?'<button data-a="play">▶</button>':'')+(r.audio?'<button data-a="import">＋ PAD</button>':'')+(r.source?'<button data-a="source">SOURCE</button>':'')+'</div>');
    var play=card.querySelector('[data-a="play"]'),imp=card.querySelector('[data-a="import"]'),src=card.querySelector('[data-a="source"]');
    if(play)play.onclick=function(){preview(r)};if(imp)imp.onclick=function(){importRemote(r)};if(src)src.onclick=function(){window.open(r.source,'_blank','noopener')};root.appendChild(card)
  })
}
function preview(r){
  if(remoteAudio){remoteAudio.pause();remoteAudio=null}remoteAudio=new Audio(r.preview);remoteAudio.crossOrigin='anonymous';remoteAudio.play().then(function(){apiStatus('Lecture : '+r.title)}).catch(function(){apiStatus('Préécoute bloquée par la source')})
}
async function importRemote(r){
  try{
    apiStatus('Téléchargement vers le pad '+selectedPad+'…');var res=await fetch(r.audio,{mode:'cors'});if(!res.ok)throw new Error('HTTP '+res.status);var blob=await res.blob(),ext=(blob.type||'').indexOf('mpeg')>=0?'mp3':((blob.type||'').indexOf('ogg')>=0?'ogg':((blob.type||'').indexOf('wav')>=0?'wav':'audio')),name=sanitize(r.title)+'.'+ext,file=new File([blob],name,{type:blob.type||'audio/mpeg'});
    await importAudio(file);var p=selected();p.externalMeta={provider:r.provider,source:r.source,license:r.license,creator:r.creator};renderEditor();apiStatus(r.title+' ajouté au '+p.id)
  }catch(e){apiStatus('Import direct impossible : '+e.message+'. Utilise SOURCE si nécessaire.')}
}
function sanitize(s){return String(s||'sample').replace(/[\\/:*?"<>|]+/g,' ').trim().slice(0,80)||'sample'}
async function toB64(blob){var bytes=new Uint8Array(await blob.arrayBuffer()),out='',size=32768;for(var i=0;i<bytes.length;i+=size)out+=String.fromCharCode.apply(null,bytes.subarray(i,i+size));return btoa(out)}
function fromB64(s,type){var bin=atob(s),a=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return new Blob([a],{type:type||'audio/mpeg'})}
function currentBlob(){var p=selected();if(p.userBlob)return p.userBlob;throw new Error('Importe d’abord un fichier audio sur le pad sélectionné')}
async function runDemucs(){
  try{
    var blob=currentBlob();if(blob.size>20*1024*1024)throw new Error('Utilise de préférence un fichier de moins de 20 Mo');apiStatus('Demucs : séparation en cours…');var b64=await toB64(blob),d=await getJson('https://demucs-api-hwbhnojdya-uc.a.run.app/predict',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({instances:[{b64:b64}]})}),parts=[['drums','Drums'],['bass','Bass'],['vocals','Vocals'],['other','Other']],start=Math.max(0,parseInt(selectedPad.slice(1),10)-1),done=0;ensureAudio();
    for(var n=0;n<parts.length;n++){var key=parts[n][0],label=parts[n][1];if(!d[key]||start+n>=16)continue;var stem=fromB64(d[key],'audio/mpeg'),id=padId(bank,start+n),p=pads[id];p.userBlob=stem;p.buffer=await decodeBlob(stem);p.sample={kind:'user'};p.name=label;p.start=0;p.end=1;p.pitch=0;p.gain=1;p.externalMeta={provider:'Demucs'};done++}
    renderPads();renderEditor();renderTrackSelect();apiStatus('Demucs terminé : '+done+' stems placés sur les pads')
  }catch(e){apiStatus('Demucs : '+e.message)}
}
async function runBasicPitch(){
  try{
    var endpoint=(settings().basicPitchUrl||'').trim();if(!endpoint)throw new Error('Configure l’URL de ton serveur Basic Pitch');var blob=currentBlob();apiStatus('Basic Pitch : conversion audio → MIDI…');var fd=new FormData();fd.append('file',blob,selected().name+'.audio');var r=await fetch(endpoint,{method:'POST',body:fd});if(!r.ok)throw new Error('HTTP '+r.status);var midi=await r.blob(),a=document.createElement('a');a.href=URL.createObjectURL(midi);a.download=sanitize(selected().name)+'.mid';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href)},5000);apiStatus('MIDI Basic Pitch téléchargé')
  }catch(e){apiStatus('Basic Pitch : '+e.message)}
}
window.MPCFreeAPIs={services:SERVICES,openverse:openverse,wikimedia:wikimedia,archive:archive,musicbrainz:musicbrainz,freesound:freesound,demucs:runDemucs,basicPitch:runBasicPitch};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject);else inject();
})();