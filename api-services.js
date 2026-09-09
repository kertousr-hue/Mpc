(function(){
'use strict';
var SERVICES={
  openverse:{label:'Openverse',kind:'Sons libres',note:'Audio Creative Commons ou domaine public. Vérifie la licence avant utilisation commerciale.'},
  wikimedia:{label:'Wikimedia Commons',kind:'Sons libres',note:'Fichiers audio Commons avec informations de licence.'},
  archive:{label:'Internet Archive',kind:'Archives audio',note:'Recherche gratuite. Les droits varient selon chaque élément.'},
  musicbrainz:{label:'MusicBrainz',kind:'Métadonnées',note:'Artistes, titres et identifiants. Pas de téléchargement audio.'},
  freesound:{label:'Freesound',kind:'Samples',note:'Clé API gratuite requise. Chaque son a sa propre licence.'},
  demucs:{label:'Demucs',kind:'Séparation',note:'Séparation 4 stems via un service public, avec serveur personnel en secours.'},
  basicpitch:{label:'Basic Pitch',kind:'Audio vers MIDI',note:'Conversion locale dans le navigateur avec le modèle officiel Spotify.'}
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
  '<div class="apiTool"><div><b>Basic Pitch</b><small>Convertit le sample du pad en MIDI directement sur l’appareil.</small></div><button id="basicPitchBtn">AUDIO → MIDI</button></div>'+
  '</section>'+
  '<details class="apiSettings"><summary>Configuration</summary>'+
  '<label>Clé Freesound gratuite<input id="apiFreesoundKey" value="'+esc(s.freesoundKey||'')+'" placeholder="API key Freesound"></label>'+ 
  '<label>Serveur Demucs personnel (optionnel)<input id="apiDemucsUrl" value="'+esc(s.demucsUrl||'')+'" placeholder="https://serveur.example/demucs"></label>'+ 
  '<label>Serveur Basic Pitch personnel (optionnel)<input id="apiBasicPitchUrl" value="'+esc(s.basicPitchUrl||'')+'" placeholder="Laisser vide pour conversion locale"></label>'+
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
    demucsUrl:(document.getElementById('apiDemucsUrl').value||'').trim().replace(/\/$/,''),
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
  return (((d||{}).response||{}).docs||[]).map(function(x){return {provider:'Internet Archive',title:x.title||x.identifier,creator:Array.isArray(x.creator)?x.creator.join(', '):(x.creator||''),license:Array.isArray(x.licenseurl)?x.licenseurl.join(', '):(x.licenseurl||'Voir la fiche'),audio:'',preview:'',archiveId:x.identifier,source:'https://archive.org/details/'+encodeURIComponent(x.identifier),detail:'Archive audio'}})
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
    var card=create('article','apiResult','<div class="apiResultMain"><b>'+esc(r.title)+'</b><small>'+esc(r.creator||r.provider)+(r.detail?' · '+esc(r.detail):'')+'</small><span class="apiLicense">'+esc(r.license||'Licence à vérifier')+'</span></div><div class="apiResultActions">'+(r.preview?'<button data-a="play">▶</button>':'')+((r.audio||r.archiveId)?'<button data-a="import">＋ PAD</button>':'')+(r.source?'<button data-a="source">SOURCE</button>':'')+'</div>');
    var play=card.querySelector('[data-a="play"]'),imp=card.querySelector('[data-a="import"]'),src=card.querySelector('[data-a="source"]');
    if(play)play.onclick=function(){preview(r)};if(imp)imp.onclick=function(){importRemote(r)};if(src)src.onclick=function(){window.open(r.source,'_blank','noopener')};root.appendChild(card)
  })
}
function preview(r){
  if(remoteAudio){remoteAudio.pause();remoteAudio=null}remoteAudio=new Audio(r.preview);remoteAudio.crossOrigin='anonymous';remoteAudio.play().then(function(){apiStatus('Lecture : '+r.title)}).catch(function(){apiStatus('Préécoute bloquée par la source')})
}
async function resolveArchiveAudio(r){
  if(r.audio)return r.audio;
  if(!r.archiveId)throw new Error('Fichier audio introuvable');
  apiStatus('Internet Archive : recherche du fichier audio…');
  var d=await getJson('https://archive.org/metadata/'+encodeURIComponent(r.archiveId));
  var files=(d.files||[]).filter(function(f){var n=(f.name||'').toLowerCase();return /\.(mp3|ogg|wav|flac|m4a)$/.test(n)&&!/^__/.test(n)});
  files.sort(function(a,b){var score=function(f){var n=(f.name||'').toLowerCase();return (n.endsWith('.mp3')?0:n.endsWith('.ogg')?1:n.endsWith('.wav')?2:3)+(Number(f.size||0)>50*1024*1024?10:0)};return score(a)-score(b)});
  if(!files.length)throw new Error('Aucun fichier audio téléchargeable dans cet élément');
  r.audio='https://archive.org/download/'+encodeURIComponent(r.archiveId)+'/'+files[0].name.split('/').map(encodeURIComponent).join('/');
  r.preview=r.audio;return r.audio
}
async function importRemote(r){
  try{
    apiStatus('Téléchargement vers le pad '+selectedPad+'…');var audioUrl=r.audio||await resolveArchiveAudio(r);var res=await fetch(audioUrl,{mode:'cors'});if(!res.ok)throw new Error('HTTP '+res.status);var blob=await res.blob(),ext=(blob.type||'').indexOf('mpeg')>=0?'mp3':((blob.type||'').indexOf('ogg')>=0?'ogg':((blob.type||'').indexOf('wav')>=0?'wav':'audio')),name=sanitize(r.title)+'.'+ext,file=new File([blob],name,{type:blob.type||'audio/mpeg'});
    await importAudio(file);var p=selected();p.externalMeta={provider:r.provider,source:r.source,license:r.license,creator:r.creator};renderEditor();apiStatus(r.title+' ajouté au '+p.id)
  }catch(e){apiStatus('Import direct impossible : '+e.message+'. Utilise SOURCE si nécessaire.')}
}
function sanitize(s){return String(s||'sample').replace(/[\\/:*?"<>|]+/g,' ').trim().slice(0,80)||'sample'}
async function toB64(blob){var bytes=new Uint8Array(await blob.arrayBuffer()),out='',size=32768;for(var i=0;i<bytes.length;i+=size)out+=String.fromCharCode.apply(null,bytes.subarray(i,i+size));return btoa(out)}
function fromB64(s,type){var bin=atob(s),a=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return new Blob([a],{type:type||'audio/mpeg'})}
function currentBlob(){var p=selected();if(p.userBlob)return p.userBlob;throw new Error('Importe d’abord un fichier audio sur le pad sélectionné')}
async function placeStems(blobs,names){
  var start=Math.max(0,parseInt(selectedPad.slice(1),10)-1),done=0;ensureAudio();
  for(var n=0;n<blobs.length&&n<4;n++){if(start+n>=16||!blobs[n])continue;var stem=blobs[n],id=padId(bank,start+n),p=pads[id];p.userBlob=stem;p.buffer=await decodeBlob(stem);p.sample={kind:'user'};p.name=(names&&names[n])||('Stem '+(n+1));p.start=0;p.end=1;p.pitch=0;p.gain=1;p.cloudPath=null;p.externalMeta={provider:'Demucs'};done++}
  renderPads();renderEditor();renderTrackSelect();return done
}
async function runCustomDemucs(endpoint,blob){
  var fd=new FormData();fd.append('file',blob,selected().name+'.audio');var r=await fetch(endpoint,{method:'POST',body:fd});if(!r.ok)throw new Error('HTTP '+r.status);
  var d=await r.json(),keys=['drums','bass','vocals','other'],out=[];for(var i=0;i<keys.length;i++){var v=d[keys[i]];if(!v){out.push(null);continue}if(/^https?:/.test(v)){var rr=await fetch(v);out.push(await rr.blob())}else out.push(fromB64(v,'audio/wav'))}
  return {blobs:out,names:['Drums','Bass','Vocals','Other']}
}
async function runPublicDemucs(blob){
  var gr=await import('https://esm.sh/@gradio/client@1.15.0?bundle'),client=await gr.Client.connect('aimuzik/demucs'),api=await client.view_api(),named=(api&&api.named_endpoints)||{},endpoint=named['/demucs_def']?'/demucs_def':Object.keys(named)[0];
  if(!endpoint)throw new Error('Aucun endpoint Demucs disponible sur le service public');
  var result=await client.predict(endpoint,[gr.handle_file(blob),'htdemucs.yaml','wav',2,'0.25']),data=(result&&result.data)||[],blobs=[];
  for(var i=0;i<data.length&&i<4;i++){var item=data[i],url=item&&typeof item==='object'?(item.url||item.path):item;if(!url){blobs.push(null);continue}if(url.charAt(0)==='/')url='https://aimuzik-demucs.hf.space'+url;var rr=await fetch(url);if(!rr.ok)throw new Error('Téléchargement stem HTTP '+rr.status);blobs.push(await rr.blob())}
  if(!blobs.filter(Boolean).length)throw new Error('Le service public n’a renvoyé aucun stem');
  return {blobs:blobs,names:['Stem 1','Stem 2','Stem 3','Stem 4']}
}
async function runDemucs(){
  try{
    var blob=currentBlob();if(blob.size>25*1024*1024)throw new Error('Pour le service public, utilise un fichier de moins de 25 Mo');apiStatus('Demucs : séparation en cours…');
    var endpoint=(settings().demucsUrl||'').trim(),result=endpoint?await runCustomDemucs(endpoint,blob):await runPublicDemucs(blob),done=await placeStems(result.blobs,result.names);
    apiStatus('Demucs terminé : '+done+' stem(s) placés sur les pads')
  }catch(e){apiStatus('Demucs indisponible : '+e.message+'. Tu peux configurer ton propre serveur Demucs dans Configuration.')}
}
function resampleMono(buffer,targetRate){
  var channels=buffer.numberOfChannels,inputLen=buffer.length,ratio=buffer.sampleRate/targetRate,outLen=Math.max(1,Math.round(inputLen/ratio)),out=new Float32Array(outLen);
  for(var i=0;i<outLen;i++){var pos=i*ratio,i0=Math.floor(pos),i1=Math.min(inputLen-1,i0+1),t=pos-i0,sum=0;for(var c=0;c<channels;c++){var d=buffer.getChannelData(c);sum+=(d[i0]*(1-t)+d[i1]*t)}out[i]=sum/channels}
  return out
}
function varLen(v){var b=v&127,out=[b];while((v>>=7)){b=(v&127)|128;out.unshift(b)}return out}
function notesToMidi(notes){
  var ppq=480,tps=960,events=[];notes.forEach(function(n){var start=Math.max(0,Math.round(n.startTimeSeconds*tps)),end=Math.max(start+1,Math.round((n.startTimeSeconds+n.durationSeconds)*tps)),pitch=Math.max(0,Math.min(127,Math.round(n.pitchMidi))),vel=Math.max(1,Math.min(127,Math.round((n.amplitude||.8)*127)));events.push({t:start,b:[0x90,pitch,vel],o:1});events.push({t:end,b:[0x80,pitch,0],o:0})});events.sort(function(a,b){return a.t-b.t||a.o-b.o});
  var tr=[0,0xff,0x51,3,0x07,0xa1,0x20],last=0;events.forEach(function(e){tr.push.apply(tr,varLen(e.t-last));tr.push.apply(tr,e.b);last=e.t});tr.push(0,0xff,0x2f,0);
  var head=[0x4d,0x54,0x68,0x64,0,0,0,6,0,0,0,1,(ppq>>8)&255,ppq&255],len=tr.length,track=[0x4d,0x54,0x72,0x6b,(len>>>24)&255,(len>>>16)&255,(len>>>8)&255,len&255].concat(tr);return new Blob([new Uint8Array(head.concat(track))],{type:'audio/midi'})
}
async function runLocalBasicPitch(){
  var p=selected();if(!p.buffer)throw new Error('Importe d’abord un fichier audio sur le pad sélectionné');apiStatus('Basic Pitch : chargement du modèle Spotify…');
  var bp=await import('https://esm.sh/@spotify/basic-pitch@1.0.1?bundle'),model='https://cdn.jsdelivr.net/npm/@spotify/basic-pitch@1.0.1/model/model.json',engine=new bp.BasicPitch(model),frames=[],onsets=[],contours=[],mono=resampleMono(p.buffer,22050);
  await engine.evaluateModel(mono,function(f,o,c){frames.push.apply(frames,f);onsets.push.apply(onsets,o);contours.push.apply(contours,c)},function(progress){apiStatus('Basic Pitch : '+Math.round(progress*100)+'%')});
  var notes=bp.noteFramesToTime(bp.addPitchBendsToNoteEvents(contours,bp.outputToNotesPoly(frames,onsets,.25,.25,5)));if(!notes.length)throw new Error('Aucune note détectée');
  return notesToMidi(notes)
}
async function runBasicPitch(){
  try{
    var endpoint=(settings().basicPitchUrl||'').trim(),midi;
    if(endpoint){var blob=currentBlob(),fd=new FormData();fd.append('file',blob,selected().name+'.audio');apiStatus('Basic Pitch : conversion serveur…');var r=await fetch(endpoint,{method:'POST',body:fd});if(!r.ok)throw new Error('HTTP '+r.status);midi=await r.blob()}
    else midi=await runLocalBasicPitch();
    var a=document.createElement('a');a.href=URL.createObjectURL(midi);a.download=sanitize(selected().name)+'.mid';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href)},5000);apiStatus('MIDI Basic Pitch téléchargé')
  }catch(e){apiStatus('Basic Pitch : '+e.message)}
}
window.MPCFreeAPIs={services:SERVICES,openverse:openverse,wikimedia:wikimedia,archive:archive,musicbrainz:musicbrainz,freesound:freesound,demucs:runDemucs,basicPitch:runBasicPitch};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject);else inject();
})();