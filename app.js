const $=id=>document.getElementById(id);
const BANKS=['A','B','C','D'], STEPS=16, PATTERNS=8;
const FACTORY_SPEC=[
 ['Kicks','Kick',16],['Snares','Snare',16],['Claps','Clap',8],['Hi-Hats','Hi-Hat',16],
 ['Open Hats','Open Hat',8],['Percussions','Perc',16],['Toms','Tom',8],['Cymbals','Cymbal',8],
 ['Bass','Bass',12],['Synths','Synth',12],['FX Vox','FX Vox',8]
];
const FACTORY=[]; let fi=0;
for(const [category,label,count] of FACTORY_SPEC) for(let i=1;i<=count;i++) FACTORY.push({
 id:'factory-'+(++fi),name:`${label} ${String(i).padStart(2,'0')}`,category,variant:i
});
const DEFAULT_NAMES=['Kick 01','Snare 01','Hi-Hat 01','Perc 01','Clap 01','Rim','Tom 01','Shaker','Bass 01','Synth 01','FX Vox 01','Cymbal 01','Chord','Lead','Texture','Stab'];
const ORIENTAL_SOURCES=[
 {instrument:'Darbuka',count:8,url:'https://upload.wikimedia.org/wikipedia/commons/e/ed/Darbuka.ogg',source:'https://commons.wikimedia.org/wiki/File:Darbuka.ogg',creator:'Cassa342',license:'CC BY-SA 4.0'},
 {instrument:'Riq',count:4,url:'https://upload.wikimedia.org/wikipedia/commons/d/db/Riq_demo.ogg',source:'https://commons.wikimedia.org/wiki/File:Riq_demo.ogg',creator:'Derbake',license:'CC BY-SA 4.0'},
 {instrument:'Bendir',count:4,url:'https://upload.wikimedia.org/wikipedia/commons/e/e4/T%C3%BCrk_Aksa%C4%9F%C4%B1_%2890_bpm%29.ogg',source:'https://commons.wikimedia.org/wiki/File:T%C3%BCrk_Aksa%C4%9F%C4%B1_(90_bpm).ogg',creator:'Anomyq',license:'CC0 1.0'}
];

let audioCtx=null, masterGain=null, isPlaying=false, recArmed=false, metro=false, fullLevel=false, noteRepeat=false;
let bank='A', selectedPad='A01', selectedTrack=0, patternIndex=0, playStep=0, timer=null, nextStepTime=0, repeatDiv=4;
let tapTimes=[], clipboard=null, currentMode='sampling', sb=null, sbUser=null, cloudRows=[];
let padMode='play', levelsMode=false, levelsBasePad='A01', loopSequence=true, lastPreviewSample=null, browserTab='samples';
let transportMode='pattern', songOrder=[], songPos=0;
const activeSources=new Set(), soloPads=new Set();
const decodedCache=new Map();

function factoryIndexByName(name){const i=FACTORY.findIndex(x=>x.name===name);return Math.max(0,i)}
const pads={};
for(const b of BANKS) for(let i=0;i<16;i++){
 const id=b+String(i+1).padStart(2,'0');
 let sample=null;
 if(b==='A'){
   const names=['Kick 01','Snare 01','Hi-Hat 01','Perc 01','Clap 01','Snares 08','Tom 01','Perc 05','Bass 01','Synth 01','FX Vox 01','Cymbal 01','Synth 04','Synth 08','FX Vox 04','FX Vox 08'];
   sample={kind:'factory',factoryIndex:factoryIndexByName(names[i])};
 }
 pads[id]={id,name:DEFAULT_NAMES[i],gain:1,pitch:0,start:0,end:1,muted:false,loop:false,sample,userBlob:null,buffer:null,cloudPath:null};
}
const patterns=Array.from({length:PATTERNS},()=>Object.fromEntries(BANKS.flatMap(b=>Array.from({length:16},(_,i)=>[b+String(i+1).padStart(2,'0'),Array(STEPS).fill(false)]))));
[0,4,8,12].forEach(s=>patterns[0].A01[s]=true); [4,12].forEach(s=>patterns[0].A02[s]=true); [2,6,10,14].forEach(s=>patterns[0].A03[s]=true);

function ensureAudio(){
 if(!audioCtx){
   audioCtx=new (window.AudioContext||window.webkitAudioContext)();
   masterGain=audioCtx.createGain(); masterGain.gain.value=+$('master').value/100; masterGain.connect(audioCtx.destination);
 }
 if(audioCtx.state==='suspended') audioCtx.resume();
}
function status(t){$('status').textContent=t}
function padId(b,i){return b+String(i+1).padStart(2,'0')}
function selected(){return pads[selectedPad]}
function clamp(v,a,b){return Math.min(b,Math.max(a,v))}
function rateFromPitch(st){return Math.pow(2,st/12)}
function stepDuration(){return 60/(+$('bpm').value||92)/4}
function seeded(n){let x=Math.sin(n*999.17)*43758.5453;return x-Math.floor(x)}
function trackSource(src){activeSources.add(src);const old=src.onended;src.onended=()=>{activeSources.delete(src);if(typeof old==='function')old()};return src}
function stopAllSources(){for(const src of [...activeSources]){try{src.stop()}catch(e){}activeSources.delete(src)}stopRepeat()}
function isPadAudible(id){const p=pads[id];return !!p&&!p.muted&&(soloPads.size===0||soloPads.has(id))}

function createNoise(ac,seconds){
 const b=ac.createBuffer(1,Math.max(1,Math.floor(ac.sampleRate*seconds)),ac.sampleRate),d=b.getChannelData(0);
 for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; return b;
}
function gainEnv(ac,dest,time,vol,decay){
 const g=ac.createGain(); g.gain.setValueAtTime(Math.max(.0001,vol),time); g.gain.exponentialRampToValueAtTime(.0001,time+decay); g.connect(dest); return g;
}
function oscHit(ac,dest,time,type,freq,endFreq,vol,decay){
 const o=trackSource(ac.createOscillator()),g=gainEnv(ac,dest,time,vol,decay); o.type=type;o.frequency.setValueAtTime(freq,time);
 if(endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(1,endFreq),time+Math.min(decay*.75,.25));
 o.connect(g);o.start(time);o.stop(time+decay+.03);
}
function noiseHit(ac,dest,time,vol,decay,filterType='highpass',freq=4000,q=.7){
 const s=trackSource(ac.createBufferSource()),f=ac.createBiquadFilter(),g=gainEnv(ac,dest,time,vol,decay);
 s.buffer=createNoise(ac,Math.max(decay,.03));f.type=filterType;f.frequency.value=freq;f.Q.value=q;s.connect(f);f.connect(g);s.start(time);s.stop(time+decay+.03);
}
function scheduleFactory(sample,ac,dest,time,vol=1,pitch=0){
 const v=sample.variant||1, r=rateFromPitch(pitch), c=sample.category, tweak=1+(v-1)*.012;
 if(c==='Kicks'){oscHit(ac,dest,time,'sine',145*r*tweak,42*r,.95*vol,.24+.008*(v%5));noiseHit(ac,dest,time,.08*vol,.025,'lowpass',1800)}
 else if(c==='Snares'){noiseHit(ac,dest,time,.72*vol,.14+.008*(v%5),'bandpass',1300+v*80,1.1);oscHit(ac,dest,time,'triangle',180*r,120*r,.2*vol,.1)}
 else if(c==='Claps'){[0,.017,.034].forEach((d,j)=>noiseHit(ac,dest,time+d,.32*vol,.07,'bandpass',1200+v*70,1.2))}
 else if(c==='Hi-Hats'){noiseHit(ac,dest,time,.34*vol,.045+.003*(v%4),'highpass',6000+v*100,1)}
 else if(c==='Open Hats'){noiseHit(ac,dest,time,.34*vol,.32+.015*(v%4),'highpass',5200+v*120,.8)}
 else if(c==='Percussions'){oscHit(ac,dest,time,v%2?'triangle':'sine',(260+v*22)*r,(180+v*8)*r,.42*vol,.09+.006*(v%6));noiseHit(ac,dest,time,.09*vol,.04,'bandpass',2600+v*90)}
 else if(c==='Toms'){oscHit(ac,dest,time,'sine',(125+v*20)*r,(75+v*10)*r,.7*vol,.22+.01*(v%4))}
 else if(c==='Cymbals'){noiseHit(ac,dest,time,.3*vol,.55+.03*(v%4),'highpass',3300+v*150,.6);[430,660,970,1450].forEach((f,i)=>oscHit(ac,dest,time,'square',f*r*tweak,null,.025*vol,.4))}
 else if(c==='Bass'){oscHit(ac,dest,time,v%2?'sawtooth':'square',(46+v*2.3)*r,null,.48*vol,.32);oscHit(ac,dest,time,'sine',(46+v*2.3)*r,null,.32*vol,.34)}
 else if(c==='Synths'){[220,277.18,329.63].forEach((f,i)=>oscHit(ac,dest,time,i?'triangle':'sawtooth',f*r*(1+(v%5)*.04),null,.11*vol,.42+.02*(v%3)))}
 else {noiseHit(ac,dest,time,.14*vol,.28,'bandpass',900+v*210,1);oscHit(ac,dest,time,'sine',(300+v*45)*r,null,.18*vol,.28)}
}
function scheduleUser(p,ac,dest,time,vol=1){
 if(!p.buffer) return;
 const src=trackSource(ac.createBufferSource()),g=ac.createGain(); src.buffer=p.buffer;src.playbackRate.value=rateFromPitch(p.pitch);g.gain.value=vol;src.loop=!!p.loop;src.connect(g);g.connect(dest);
 const dur=p.buffer.duration, st=clamp(p.start,0,.99)*dur, en=clamp(p.end,p.start+.01,1)*dur, playDur=Math.max(.01,(en-st)/src.playbackRate.value);
 if(src.loop){src.loopStart=st;src.loopEnd=en;src.start(time,st)} else {src.start(time,st,playDur)}
}
function playPad(id,time=null,dest=null,velocity=1){
 ensureAudio();const p=pads[id];if(!isPadAudible(id))return;
 const ac=dest?.context||audioCtx, out=dest||masterGain, t=time??ac.currentTime, vol=(fullLevel?1:velocity)*p.gain;
 if(p.sample?.kind==='factory') scheduleFactory(FACTORY[p.sample.factoryIndex],ac,out,t,vol,p.pitch);
 else if(p.buffer) scheduleUser(p,ac,out,t,vol);
 flashPad(id);
 if(recArmed&&isPlaying&&time===null){let q=playStep;const quant=$('quantize').value;if(quant==='1/8')q=Math.round(q/2)*2%STEPS;patterns[patternIndex][id][q]=true;renderSteps()}
}
function flashPad(id){const b=document.querySelector(`.pad[data-id="${id}"]`);if(!b)return;b.classList.add('hit');setTimeout(()=>b.classList.remove('hit'),90)}

function renderPads(){
 const root=$('pads');root.innerHTML='';
 for(let i=0;i<16;i++){const id=padId(bank,i),p=pads[id],b=document.createElement('button');b.className='pad'+(id===selectedPad?' selected':'')+(soloPads.has(id)?' solo':'')+(p.muted?' muted':'');b.dataset.id=id;
 const level=Math.round((i+1)/16*100);b.innerHTML=levelsMode?`<span class="num">${i+1}</span><span class="name">${level}%</span>`:`<span class="num">${i+1}</span><span class="name">${escapeHtml(p.name)}</span>`;
 b.addEventListener('pointerdown',e=>{e.preventDefault();if(levelsMode){const velocity=(i+1)/16;playPad(levelsBasePad,null,null,velocity);startRepeat(levelsBasePad,velocity);return}if(padMode==='select'||padMode==='edit'){selectPad(id);if(padMode==='edit')document.querySelector('.editor')?.scrollIntoView({behavior:'smooth',block:'nearest'});return}if(padMode==='mute'){p.muted=!p.muted;renderPads();renderEditor();status(p.muted?id+' muet':id+' réactivé');return}if(padMode==='solo'){soloPads.has(id)?soloPads.delete(id):soloPads.add(id);renderPads();status(soloPads.has(id)?id+' en solo':id+' retiré du solo');return}selectPad(id);playPad(id);startRepeat(id)});b.addEventListener('pointerup',stopRepeat);b.addEventListener('pointerleave',stopRepeat);root.appendChild(b)}
}
function selectPad(id){selectedPad=id;selectedTrack=Math.max(0,parseInt(id.slice(1),10)-1);renderPads();renderEditor();renderSteps();$('trackSelect').value=selectedTrack}
let repeatTimer=null;
function startRepeat(id,velocity=1){if(!noteRepeat)return;stopRepeat();const ms=stepDuration()*1000*4/repeatDiv;repeatTimer=setInterval(()=>playPad(id,null,null,velocity),ms)}
function stopRepeat(){if(repeatTimer){clearInterval(repeatTimer);repeatTimer=null}}

function renderEditor(){
 const p=selected(),s=p.sample?.kind==='factory'?FACTORY[p.sample.factoryIndex]:null;
 $('padCode').textContent='PAD '+p.id;$('padTitle').textContent=p.name;const meta=p.externalMeta||null;$('sampleFileName').textContent=s?('Factory · '+s.name):(p.userBlob?((meta&&meta.instrument?'Réel · '+meta.instrument:'Utilisateur')+' · '+p.name):'Aucun sample');$('sampleFileName').title=meta?[meta.creator,meta.license,meta.source].filter(Boolean).join(' · '):'';
 $('sampleTime').textContent=s?'SYNTH':p.buffer?(p.buffer.duration.toFixed(2)+' s'):'VIDE';
 $('padGain').value=Math.round(p.gain*100);$('gainOut').textContent=Math.round(p.gain*100)+'%';$('padPitch').value=p.pitch;$('pitchOut').textContent=p.pitch+' st';
 $('padStart').value=Math.round(p.start*100);$('startOut').textContent=Math.round(p.start*100)+'%';$('padEnd').value=Math.round(p.end*100);$('endOut').textContent=Math.round(p.end*100)+'%';
 $('loopPadBtn').classList.toggle('active',p.loop);$('oneShotBtn').classList.toggle('active',!p.loop);$('mutePadBtn').classList.toggle('active',p.muted);drawWave();
}
function drawWave(){
 const c=$('waveform'),x=c.getContext('2d'),p=selected(),w=c.width,h=c.height;x.clearRect(0,0,w,h);x.fillStyle='#03101a';x.fillRect(0,0,w,h);x.strokeStyle='#17b6ff';x.lineWidth=2;x.beginPath();
 if(p.buffer){const d=p.buffer.getChannelData(0),stride=Math.max(1,Math.floor(d.length/w));for(let i=0;i<w;i++){let max=0;for(let j=0;j<stride;j++)max=Math.max(max,Math.abs(d[Math.min(d.length-1,i*stride+j)]));const y=h/2,maxh=max*h*.44;if(i===0)x.moveTo(i,y-maxh);else x.lineTo(i,y-maxh)}for(let i=w-1;i>=0;i--){let max=0;for(let j=0;j<stride;j++)max=Math.max(max,Math.abs(d[Math.min(d.length-1,i*stride+j)]));x.lineTo(i,h/2+max*h*.44)}x.closePath();x.fillStyle='#0c91da99';x.fill()}
 else {const seed=(p.sample?.factoryIndex||1)+1;x.moveTo(0,h/2);for(let i=0;i<w;i++){const env=Math.exp(-i/(w*.34)),amp=(.15+seeded(seed+i)*.85)*env*h*.44;x.lineTo(i,h/2+(seeded(seed*7+i)-.5)*2*amp)}x.stroke()}
 x.strokeStyle='#18ee78';x.lineWidth=2;x.beginPath();x.moveTo(p.start*w,5);x.lineTo(p.start*w,h-5);x.stroke();x.strokeStyle='#ffb62e';x.beginPath();x.moveTo(p.end*w,5);x.lineTo(p.end*w,h-5);x.stroke()
}

function buildLibrary(){
 const cats=['Tous',...FACTORY_SPEC.map(x=>x[0])];$('categories').innerHTML='';cats.forEach(c=>{const b=document.createElement('button');b.textContent=c;b.className=c==='Tous'?'active':'';b.onclick=()=>{document.querySelectorAll('#categories button').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderLibrary(c,$('search').value)};$('categories').appendChild(b)});
 renderLibrary('Tous','');
}
let activeCategory='Tous';
function renderLibrary(cat=activeCategory,q=''){activeCategory=cat;q=q.toLowerCase().trim();const root=$('sampleList');root.innerHTML='';FACTORY.filter(s=>(cat==='Tous'||s.category===cat)&&(!q||s.name.toLowerCase().includes(q)||s.category.toLowerCase().includes(q))).forEach(s=>{const row=document.createElement('div');row.className='sample';row.innerHTML=`<div class="sampleWave"></div><div><strong>${escapeHtml(s.name)}</strong><small>${escapeHtml(s.category)} · FACTORY</small></div><button title="Assigner">＋</button>`;row.querySelector('.sampleWave').onclick=()=>previewFactory(s);row.querySelector('button').onclick=()=>assignFactory(s);root.appendChild(row)})}
function previewFactory(s){lastPreviewSample=s;ensureAudio();scheduleFactory(s,audioCtx,masterGain,audioCtx.currentTime,.85,0);status('Préécoute '+s.name)}
function assignFactory(s){const p=selected();p.sample={kind:'factory',factoryIndex:FACTORY.indexOf(s)};p.name=s.name;p.buffer=null;p.userBlob=null;p.cloudPath=null;p.externalMeta=null;renderPads();renderEditor();status(s.name+' assigné à '+p.id)}

function monoEnvelope(buffer,hop=128){
 const frames=Math.ceil(buffer.length/hop),env=new Float32Array(frames),channels=buffer.numberOfChannels;
 for(let f=0;f<frames;f++){let sum=0,n=0;const a=f*hop,z=Math.min(buffer.length,a+hop);for(let i=a;i<z;i++){let v=0;for(let c=0;c<channels;c++)v+=Math.abs(buffer.getChannelData(c)[i]);sum+=v/channels;n++}env[f]=n?sum/n:0}
 return env
}
function detectTransientTimes(buffer,count){
 const hop=128,env=monoEnvelope(buffer,hop),scores=[],lookback=6;let maxEnv=0,maxScore=0;
 for(const v of env)maxEnv=Math.max(maxEnv,v);
 for(let i=lookback;i<env.length-2;i++){let prev=0;for(let k=1;k<=lookback;k++)prev+=env[i-k];prev/=lookback;const score=Math.max(0,env[i]-prev*.9);if(score>maxScore)maxScore=score;scores.push({i,score,amp:env[i]})}
 const candidates=scores.filter(x=>x.score>maxScore*.10&&x.amp>maxEnv*.04).sort((a,b)=>b.score-a.score),picked=[],minGap=Math.max(1,Math.round(buffer.sampleRate*.10/hop));
 for(const c of candidates){if(picked.every(p=>Math.abs(p.i-c.i)>=minGap)){picked.push(c);if(picked.length>=count)break}}
 if(picked.length<count){const byAmp=scores.filter(x=>x.amp>maxEnv*.05).sort((a,b)=>b.amp-a.amp);for(const gap of [minGap,Math.max(1,Math.round(minGap*.55))]){for(const c of byAmp){if(picked.every(p=>Math.abs(p.i-c.i)>=gap)){picked.push(c);if(picked.length>=count)break}}if(picked.length>=count)break}}
 picked.sort((a,b)=>a.i-b.i);
 let times=picked.slice(0,count).map(x=>x.i*hop/buffer.sampleRate);
 if(times.length<count){for(let i=0;times.length<count&&i<count*4;i++){const t=buffer.duration*(i+1)/(count*4+1);if(times.every(x=>Math.abs(x-t)>.055))times.push(t)}times.sort((a,b)=>a-b)}
 return times.slice(0,count)
}
function cutHit(buffer,time,nextTime,maxDur=.85){
 const sr=buffer.sampleRate,start=Math.max(0,Math.floor((time-.012)*sr)),limit=Math.min(buffer.length,start+Math.floor(maxDur*sr)),next=nextTime==null?limit:Math.max(start+Math.floor(.08*sr),Math.floor((nextTime-.018)*sr)),end=Math.min(limit,next),len=Math.max(1,end-start),out=audioCtx.createBuffer(buffer.numberOfChannels,len,sr);
 for(let c=0;c<buffer.numberOfChannels;c++)out.copyToChannel(buffer.getChannelData(c).slice(start,end),c);return out
}
async function fetchOrientalSource(src){
 const r=await fetch(src.url,{mode:'cors',cache:'force-cache'});if(!r.ok)throw new Error(src.instrument+' HTTP '+r.status);const blob=await r.blob(),buffer=await decodeBlob(blob);return {src,buffer}
}
async function loadOrientalKit(button=null){
 ensureAudio();const targetBank=bank;if(button)button.disabled=true;status('Kit oriental réel : téléchargement des enregistrements…');
 try{
   const loaded=[];for(const src of ORIENTAL_SOURCES){status('Kit oriental : '+src.instrument+'…');loaded.push(await fetchOrientalSource(src))}
   let slot=0;
   for(const item of loaded){const times=detectTransientTimes(item.buffer,item.src.count);for(let n=0;n<item.src.count&&slot<16;n++,slot++){const hit=cutHit(item.buffer,times[n]??0,times[n+1],item.src.instrument==='Riq'?.65:.85),blob=new Blob([audioBufferToWav(hit)],{type:'audio/wav'}),id=padId(targetBank,slot),p=pads[id];Object.assign(p,{name:item.src.instrument+' '+String(n+1).padStart(2,'0'),sample:{kind:'user'},buffer:hit,userBlob:blob,cloudPath:null,start:0,end:1,pitch:0,gain:1,muted:false,loop:false,externalMeta:{provider:'Wikimedia Commons',instrument:item.src.instrument,source:item.src.source,license:item.src.license,creator:item.src.creator,realRecording:true}})}}
   bank=targetBank;selectedPad=padId(bank,0);selectedTrack=0;renderAll();status('Kit ORIENTAL RÉEL chargé : Darbuka · Riq · Bendir sur banque '+bank)
 }catch(e){status('Kit oriental : '+e.message)}
 finally{if(button)button.disabled=false}
}

function loadFactoryKit(offset=0){for(let i=0;i<16;i++){const s=FACTORY[(offset+i)%FACTORY.length],p=pads[padId(bank,i)];p.sample={kind:'factory',factoryIndex:(offset+i)%FACTORY.length};p.name=s.name;p.buffer=null;p.userBlob=null;p.cloudPath=null;p.externalMeta=null}renderAll();status('Kit chargé sur banque '+bank)}
function renderKitBrowser(){const root=$('sampleList');$('categories').innerHTML='';root.innerHTML='';
 const oriental=document.createElement('div');oriental.className='sample realKit';oriental.innerHTML=`<div class="sampleWave"></div><div><strong>🥁 KIT ORIENTAL RÉEL</strong><small>Darbuka · Riq · Bendir · 16 vrais hits · banque ${bank}</small></div><button>CHARGER</button>`;const ob=oriental.querySelector('button');ob.onclick=()=>loadOrientalKit(ob);root.appendChild(oriental);
 [['KIT DRUMS',0],['KIT PERCUS',32],['KIT ELECTRO',64],['KIT SYNTH',96]].forEach(([name,off])=>{const row=document.createElement('div');row.className='sample';row.innerHTML=`<div class="sampleWave"></div><div><strong>${name}</strong><small>16 sons synthétiques · banque ${bank}</small></div><button>CHARGER</button>`;row.querySelector('button').onclick=()=>loadFactoryKit(off);root.appendChild(row)})}
function renderProjectBrowser(){const root=$('sampleList');$('categories').innerHTML='';root.innerHTML='';const has=!!localStorage.getItem('mpc-studio-project');const row=document.createElement('div');row.className='sample';row.innerHTML=`<div class="sampleWave"></div><div><strong>Projet local</strong><small>${has?'Sauvegarde disponible':'Aucune sauvegarde'}</small></div><button ${has?'':'disabled'}>OUVRIR</button>`;if(has)row.querySelector('button').onclick=loadLocal;root.appendChild(row)}
function openMainMenu(){let d=$('mainMenuDialog');if(!d){d=document.createElement('dialog');d.id='mainMenuDialog';d.innerHTML='<div class="cloudCard"><div class="dialogHead"><div><small>MPC STUDIO</small><h2>Menu</h2></div><button id="mainMenuClose">✕</button></div><button id="menuSave">💾 SAUVER LOCAL</button><button id="menuLoad">📂 OUVRIR LOCAL</button><button id="menuStop">■ STOP AUDIO</button><button id="menuCloud">☁ SUPABASE</button></div>';document.body.appendChild(d);$('mainMenuClose').onclick=()=>d.close();$('menuSave').onclick=saveLocal;$('menuLoad').onclick=loadLocal;$('menuStop').onclick=stopPlayback;$('menuCloud').onclick=()=>{$('cloudDialog').showModal();cloudRefresh()}}if(!d.open)d.showModal()}
function renderTrackSelect(){$('trackSelect').innerHTML='';for(let i=0;i<16;i++){const o=new Option(`${i+1} · ${pads[padId(bank,i)].name}`,i);$('trackSelect').add(o)}$('trackSelect').value=selectedTrack}
function renderPatternSelect(){$('patternSelect').innerHTML='';for(let i=0;i<PATTERNS;i++)$('patternSelect').add(new Option('Pattern '+(i+1),i));$('patternSelect').value=patternIndex}
function renderSteps(){
 const id=padId(bank,selectedTrack),arr=patterns[patternIndex][id],root=$('steps');root.innerHTML='';
 arr.forEach((on,i)=>{const b=document.createElement('button');b.className='step'+(on?' active':'')+(i===playStep&&isPlaying?' playing':'');b.dataset.n=i+1;b.onclick=()=>{arr[i]=!arr[i];renderSteps()};root.appendChild(b)});
 $('seqStatus').textContent=`16 pas · ${pads[id].name}`;
}
function patternHasNotes(i){return Object.values(patterns[i]).some(a=>a.some(Boolean))}
function setTransportMode(mode){transportMode=mode;const btns=[...document.querySelectorAll('.songRow>button:not(#loopSeqBtn)')];btns.forEach((b,i)=>b.classList.toggle('active',(mode==='pattern'&&i===0)||(mode==='song'&&i===1)));status(mode==='song'?'Mode chanson : patterns remplis enchaînés':'Mode pattern')}
function prepareSong(){songOrder=patterns.map((_,i)=>i).filter(patternHasNotes);if(!songOrder.length)songOrder=[patternIndex];songPos=Math.max(0,songOrder.indexOf(patternIndex));if(songOrder.indexOf(patternIndex)<0){songPos=0;patternIndex=songOrder[0]}renderPatternSelect()}
function finishTransport(message='Lecture terminée'){isPlaying=false;if(timer)clearInterval(timer);timer=null;setTimeout(()=>{$('playBtn').classList.remove('active');renderSteps();status(message)},Math.max(0,stepDuration()*1000))}
function nextSchedulerStep(){
 const base=stepDuration(),sw=clamp(+$('swing').value||0,0,70)/100;let dur=base;if(playStep%2===1)dur*=1+sw*.55;else dur*=1-sw*.55;
 nextStepTime+=dur;const last=playStep===STEPS-1;playStep=(playStep+1)%STEPS;
 if(last&&transportMode==='song'){if(songPos<songOrder.length-1){songPos++;patternIndex=songOrder[songPos];renderPatternSelect()}else if(loopSequence){songPos=0;patternIndex=songOrder[0];renderPatternSelect()}else finishTransport('Chanson terminée')}
 else if(last&&!loopSequence)finishTransport('Lecture terminée')
}
function scheduler(){
 if(!isPlaying)return;while(nextStepTime<audioCtx.currentTime+.12){const st=playStep;for(const b of BANKS)for(let i=0;i<16;i++){const id=padId(b,i);if(patterns[patternIndex][id][st])playPad(id,nextStepTime)}
 if(metro&&st%4===0)oscHit(audioCtx,masterGain,nextStepTime,'square',st===0?1200:850,null,.08,.025);nextSchedulerStep()}renderSteps()
}
function startPlayback(){ensureAudio();if(isPlaying)return;if(transportMode==='song')prepareSong();isPlaying=true;playStep=0;nextStepTime=audioCtx.currentTime+.05;timer=setInterval(scheduler,25);$('playBtn').classList.add('active');status(recArmed?'Enregistrement…':(transportMode==='song'?'Lecture chanson':'Lecture'))}
function stopPlayback(){isPlaying=false;if(timer)clearInterval(timer);timer=null;playStep=0;stopAllSources();$('playBtn').classList.remove('active');renderSteps();status('Arrêt')}

async function decodeBlob(blob){ensureAudio();return await audioCtx.decodeAudioData((await blob.arrayBuffer()).slice(0))}
async function materializeFactory(p=selected()){
 if(!p||p.sample?.kind!=='factory')return p?.buffer||null;
 if(p.materializing)return await p.materializing;
 p.materializing=(async()=>{
  ensureAudio();const factory=FACTORY[p.sample.factoryIndex];if(!factory)throw new Error('Son Factory introuvable');
  status('Conversion de '+p.name+' en WAV éditable…');
  const sr=audioCtx.sampleRate||44100,dur=1.4,off=new OfflineAudioContext(2,Math.ceil(sr*dur),sr),g=off.createGain();g.gain.value=1;g.connect(off.destination);
  scheduleFactory(factory,off,g,0,1,0);
  const rendered=await off.startRendering(),wav=new Blob([audioBufferToWav(rendered)],{type:'audio/wav'});
  p.buffer=rendered;p.userBlob=wav;p.sample={kind:'user'};p.cloudPath=null;p.externalMeta={provider:'MPC Factory Render',factoryName:factory.name,category:factory.category,editable:true};
  renderPads();renderEditor();renderTrackSelect();status(p.name+' est maintenant éditable');
  return rendered
 })();
 try{return await p.materializing}finally{p.materializing=null}
}
async function ensureEditableSample(p=selected()){
 if(p?.sample?.kind==='factory')await materializeFactory(p);
 if(!p?.buffer)throw new Error('Aucun fichier audio éditable sur ce pad');
 return p.buffer
}
async function importAudio(file){try{const p=selected(),buf=await decodeBlob(file);p.buffer=buf;p.userBlob=file;p.sample={kind:'user'};p.name=file.name.replace(/\.[^.]+$/,'').slice(0,24)||'Sample';p.cloudPath=null;p.externalMeta=null;renderPads();renderEditor();status('Sample importé')}catch(e){status('Erreur audio : '+e.message)}}
let recorder=null,recChunks=[];
async function toggleMic(){
 if(recorder&&recorder.state==='recording'){recorder.stop();return}
 try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});recChunks=[];recorder=new MediaRecorder(stream);recorder.ondataavailable=e=>{if(e.data.size)recChunks.push(e.data)};recorder.onstop=async()=>{const blob=new Blob(recChunks,{type:recorder.mimeType||'audio/webm'});stream.getTracks().forEach(t=>t.stop());const p=selected();p.buffer=await decodeBlob(blob);p.userBlob=blob;p.sample={kind:'user'};p.name='Micro '+new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});p.cloudPath=null;$('micBtn').textContent='🎤 MICRO';renderPads();renderEditor();status('Enregistrement assigné')};recorder.start();$('micBtn').textContent='■ STOP MICRO';status('Enregistrement micro…')}catch(e){status('Micro refusé : '+e.message)}
}
async function sliceSelected(){
 const p=selected();try{await ensureEditableSample(p)}catch(e){status(e.message);return}
 const startIndex=parseInt(p.id.slice(1),10)-1;for(let n=0;n<4;n++){if(startIndex+n>=16)break;const id=padId(bank,startIndex+n),t=pads[id];Object.assign(t,{name:p.name+' '+(n+1),sample:{kind:'user'},buffer:p.buffer,userBlob:p.userBlob,cloudPath:null,start:n/4,end:(n+1)/4,pitch:p.pitch,gain:p.gain,externalMeta:p.externalMeta||null})}renderPads();renderEditor();status('Sample découpé sur 4 pads')
}
async function trimSelected(){const p=selected();try{await ensureEditableSample(p)}catch(e){status(e.message);return}ensureAudio();const start=Math.floor(p.start*p.buffer.length),end=Math.max(start+1,Math.floor(p.end*p.buffer.length)),len=end-start,b=audioCtx.createBuffer(p.buffer.numberOfChannels,len,p.buffer.sampleRate);for(let ch=0;ch<b.numberOfChannels;ch++)b.copyToChannel(p.buffer.getChannelData(ch).slice(start,end),ch);p.buffer=b;p.userBlob=new Blob([audioBufferToWav(b)],{type:'audio/wav'});p.sample={kind:'user'};p.start=0;p.end=1;p.cloudPath=null;renderEditor();status('Sample découpé définitivement')}
async function reverseSelected(){
 const p=selected();try{await ensureEditableSample(p)}catch(e){status(e.message);return}ensureAudio();const b=audioCtx.createBuffer(p.buffer.numberOfChannels,p.buffer.length,p.buffer.sampleRate);for(let ch=0;ch<b.numberOfChannels;ch++){const src=p.buffer.getChannelData(ch),dst=b.getChannelData(ch);for(let i=0;i<src.length;i++)dst[i]=src[src.length-1-i]}p.buffer=b;p.userBlob=new Blob([audioBufferToWav(b)],{type:'audio/wav'});p.sample={kind:'user'};p.cloudPath=null;drawWave();renderEditor();status('Sample inversé')
}
function clearPad(){const p=selected();p.sample=null;p.buffer=null;p.userBlob=null;p.cloudPath=null;p.externalMeta=null;p.name='Pad '+p.id;p.start=0;p.end=1;p.pitch=0;p.gain=1;renderPads();renderEditor()}
function randomBeat(){
 const pat=patterns[patternIndex];for(const id of Object.keys(pat))pat[id].fill(false);const p=n=>pat[padId(bank,n)];
 [0,4,8,12].forEach(s=>p(0)[s]=true);[4,12].forEach(s=>p(1)[s]=true);for(let s=0;s<16;s+=2)p(2)[s]=Math.random()>.15;for(let s=0;s<16;s++)if(Math.random()>.86)p(3)[s]=true;if(Math.random()>.5)[2,10].forEach(s=>p(8)[s]=true);renderSteps();status('Beat automatique créé sur banque '+bank)}
function randomKit(){for(let i=0;i<16;i++){const id=padId(bank,i),s=FACTORY[Math.floor(Math.random()*FACTORY.length)];pads[id].sample={kind:'factory',factoryIndex:FACTORY.indexOf(s)};pads[id].name=s.name;pads[id].buffer=null;pads[id].userBlob=null;pads[id].cloudPath=null;pads[id].externalMeta=null}renderPads();renderEditor();renderTrackSelect();status('Kit aléatoire chargé')}

function serializable(includeCloud=true){
 return {version:6,name:$('projectName').value,bpm:+$('bpm').value,swing:+$('swing').value,master:+$('master').value,bank,patternIndex,
 pads:Object.fromEntries(Object.entries(pads).map(([id,p])=>[id,{id:p.id,name:p.name,gain:p.gain,pitch:p.pitch,start:p.start,end:p.end,muted:p.muted,loop:p.loop,sample:p.sample,cloudPath:includeCloud?p.cloudPath:null,externalMeta:p.externalMeta||null}])),
 patterns:patterns.map(p=>Object.fromEntries(Object.entries(p).map(([id,a])=>[id,[...a]])))};
}
async function applyProject(d,loadCloudAudio=false){
 if(!d||!d.pads||!d.patterns)throw new Error('Projet invalide');$('projectName').value=d.name||'Projet';$('bpm').value=d.bpm||92;$('swing').value=d.swing||0;$('master').value=d.master??82;$('masterOut').textContent=$('master').value+'%';if(masterGain)masterGain.gain.value=+$('master').value/100;
 for(const [id,v] of Object.entries(d.pads))if(pads[id])Object.assign(pads[id],v,{buffer:null,userBlob:null});for(let i=0;i<Math.min(PATTERNS,d.patterns.length);i++)for(const [id,a] of Object.entries(d.patterns[i]))if(patterns[i][id])patterns[i][id]=a.slice(0,16).map(Boolean);
 bank=BANKS.includes(d.bank)?d.bank:'A';patternIndex=clamp(d.patternIndex||0,0,PATTERNS-1);selectedPad=padId(bank,0);selectedTrack=0;
 if(loadCloudAudio&&sb) await downloadCloudSamples();renderAll()
}
function openAudioDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open('mpc-studio',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('audio'))r.result.createObjectStore('audio')};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function saveAudioDb(){const db=await openAudioDb();await new Promise((resolve,reject)=>{const tx=db.transaction('audio','readwrite'),st=tx.objectStore('audio');st.clear();for(const [id,p] of Object.entries(pads))if(p.userBlob)st.put(p.userBlob,id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()}
async function restoreAudioDb(){const db=await openAudioDb();await Promise.all(Object.keys(pads).map(id=>new Promise((resolve)=>{const r=db.transaction('audio').objectStore('audio').get(id);r.onsuccess=async()=>{if(r.result){pads[id].userBlob=r.result;try{pads[id].buffer=await decodeBlob(r.result);pads[id].sample={kind:'user'}}catch(e){}}resolve()};r.onerror=resolve})));db.close()}
async function saveLocal(){try{localStorage.setItem('mpc-studio-project',JSON.stringify(serializable()));await saveAudioDb();status('Projet + samples sauvegardés localement')}catch(e){status('Sauvegarde locale : '+e.message)}}
async function loadLocal(){const raw=localStorage.getItem('mpc-studio-project');if(!raw)return;try{await applyProject(JSON.parse(raw));await restoreAudioDb();renderAll();status('Projet local + samples ouverts')}catch(e){status('Ouverture locale : '+e.message)}}
function downloadText(name,text,type='application/json'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),5000)}
async function blobToDataUrl(blob){return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob)})}
async function dataUrlToBlob(url){const r=await fetch(url);return await r.blob()}
async function exportProject(){try{const d=serializable();d.audioFiles={};for(const [id,p] of Object.entries(pads))if(p.userBlob)d.audioFiles[id]=await blobToDataUrl(p.userBlob);downloadText(($('projectName').value||'projet')+'.mpc.json',JSON.stringify(d,null,2));status('Projet + samples exportés')}catch(e){status('Export projet : '+e.message)}}
async function importProjectFile(f){try{const d=JSON.parse(await f.text());await applyProject(d);if(d.audioFiles){for(const [id,url] of Object.entries(d.audioFiles))if(pads[id]){const blob=await dataUrlToBlob(url);pads[id].userBlob=blob;pads[id].buffer=await decodeBlob(blob);pads[id].sample={kind:'user'}}}renderAll();status('Projet + samples importés')}catch(e){status('Import impossible : '+e.message)}}

async function renderWav(){
 ensureAudio();const bpm=+$('bpm').value||92,dur=60/bpm*4+.5,off=new OfflineAudioContext(2,Math.ceil(audioCtx.sampleRate*dur),audioCtx.sampleRate),mg=off.createGain();mg.gain.value=+$('master').value/100;mg.connect(off.destination);
 const sd=60/bpm/4;for(let s=0;s<16;s++){const t=s*sd;for(const b of BANKS)for(let i=0;i<16;i++){const id=padId(b,i),p=pads[id];if(patterns[patternIndex][id][s]&&isPadAudible(id)){if(p.sample?.kind==='factory')scheduleFactory(FACTORY[p.sample.factoryIndex],off,mg,t,p.gain,p.pitch);else if(p.buffer)scheduleUser(p,off,mg,t,p.gain)}}}
 status('Rendu WAV…');const rendered=await off.startRendering();downloadText(($('projectName').value||'beat')+'.wav',audioBufferToWav(rendered),'audio/wav');status('WAV exporté')
}
function audioBufferToWav(buffer){
 const ch=buffer.numberOfChannels,len=buffer.length*ch*2+44,ab=new ArrayBuffer(len),v=new DataView(ab);let p=0;const s=x=>{for(let i=0;i<x.length;i++)v.setUint8(p++,x.charCodeAt(i))};s('RIFF');v.setUint32(p,36+buffer.length*ch*2,true);p+=4;s('WAVEfmt ');v.setUint32(p,16,true);p+=4;v.setUint16(p,1,true);p+=2;v.setUint16(p,ch,true);p+=2;v.setUint32(p,buffer.sampleRate,true);p+=4;v.setUint32(p,buffer.sampleRate*ch*2,true);p+=4;v.setUint16(p,ch*2,true);p+=2;v.setUint16(p,16,true);p+=2;s('data');v.setUint32(p,buffer.length*ch*2,true);p+=4;
 for(let i=0;i<buffer.length;i++)for(let c=0;c<ch;c++){let x=clamp(buffer.getChannelData(c)[i],-1,1);v.setInt16(p,x<0?x*32768:x*32767,true);p+=2}return ab
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

function getSbConfig(){const stored=JSON.parse(localStorage.getItem('mpc-supabase')||'{}'),base=window.MPC_SUPABASE_CONFIG||{};return {url:stored.url||base.url||'',key:stored.key||base.publishableKey||''}}
function safeKey(k){return /^sb_publishable_/.test(k)||/^eyJ/.test(k)}
async function initSupabase(){
 const c=getSbConfig();$('sbUrl').value=c.url;$('sbKey').value=c.key;if(!c.url||!safeKey(c.key)||!window.supabase){$('authState').textContent='Supabase non configuré';return}
 try{sb=window.supabase.createClient(c.url,c.key);const {data}=await sb.auth.getUser();sbUser=data.user||null;updateCloudState();sb.auth.onAuthStateChange((_e,s)=>{sbUser=s?.user||null;updateCloudState()})}catch(e){$('authState').textContent='Erreur Supabase : '+e.message}
}
function updateCloudState(){$('cloudBtn').classList.toggle('connected',!!sbUser);$('authState').textContent=sbUser?('Connecté : '+sbUser.email):(sb?'Supabase configuré · non connecté':'Supabase non configuré')}
async function cloudSave(){
 if(!sbUser)return status('Connecte-toi à Supabase');try{
   const initial=serializable();const {data:row,error}=await sb.from('music_projects').insert({user_id:sbUser.id,name:initial.name,bpm:initial.bpm,swing:initial.swing,project_data:initial}).select('id').single();if(error)throw error;
   for(const [id,p] of Object.entries(pads))if(p.userBlob){const ext=(p.userBlob.type||'audio/webm').includes('mpeg')?'mp3':(p.userBlob.type||'').includes('wav')?'wav':'webm',path=`${sbUser.id}/${row.id}/${id}.${ext}`;const up=await sb.storage.from('music-samples').upload(path,p.userBlob,{upsert:true,contentType:p.userBlob.type||'application/octet-stream'});if(up.error)throw up.error;p.cloudPath=path}
   const finalData=serializable();const {error:uerr}=await sb.from('music_projects').update({project_data:finalData,updated_at:new Date().toISOString()}).eq('id',row.id);if(uerr)throw uerr;status('Projet sauvegardé dans Supabase');await cloudRefresh()
 }catch(e){status('Cloud : '+e.message)}
}
async function cloudRefresh(){
 if(!sbUser)return;const {data,error}=await sb.from('music_projects').select('id,name,bpm,updated_at,project_data').order('updated_at',{ascending:false}).limit(50);if(error){status(error.message);return}cloudRows=data||[];$('cloudProjects').innerHTML='';cloudRows.forEach(r=>$('cloudProjects').add(new Option(`${r.name} · ${r.bpm} BPM`,r.id)))
}
async function downloadCloudSamples(){
 if(!sb)return;for(const p of Object.values(pads))if(p.cloudPath){const {data,error}=await sb.storage.from('music-samples').download(p.cloudPath);if(!error&&data){p.userBlob=data;p.buffer=await decodeBlob(data);p.sample={kind:'user'}}}
}
async function cloudLoad(){const id=$('cloudProjects').value,row=cloudRows.find(r=>r.id===id);if(!row)return;try{await applyProject(row.project_data,true);status('Projet Cloud ouvert')}catch(e){status('Cloud : '+e.message)}}

function renderAll(){document.querySelectorAll('#banks button').forEach(b=>b.classList.toggle('active',b.dataset.bank===bank));renderPads();renderEditor();renderTrackSelect();renderPatternSelect();renderSteps()}
function bind(){
 $('search').oninput=e=>{if(browserTab==='samples')renderLibrary(activeCategory,e.target.value)};
 $('fileInput').onchange=e=>{if(e.target.files[0])importAudio(e.target.files[0]);e.target.value=''};
 $('micBtn').onclick=toggleMic;
 document.querySelectorAll('#banks button').forEach(b=>b.onclick=()=>{bank=b.dataset.bank;selectedPad=padId(bank,selectedTrack);renderAll()});
 $('trackSelect').onchange=e=>{selectedTrack=+e.target.value;selectedPad=padId(bank,selectedTrack);renderPads();renderEditor();renderSteps()};
 $('patternSelect').onchange=e=>{patternIndex=+e.target.value;renderSteps()};
 $('copyPatternBtn').onclick=()=>{clipboard=JSON.parse(JSON.stringify(patterns[patternIndex]));status('Pattern copié')};
 $('pastePatternBtn').onclick=()=>{if(clipboard){patterns[patternIndex]=JSON.parse(JSON.stringify(clipboard));renderSteps();status('Pattern collé')}};
 $('clearPatternBtn').onclick=()=>{for(const a of Object.values(patterns[patternIndex]))a.fill(false);renderSteps()};
 $('duplicateBtn').onclick=()=>{const n=(patternIndex+1)%PATTERNS;patterns[n]=JSON.parse(JSON.stringify(patterns[patternIndex]));patternIndex=n;renderPatternSelect();renderSteps();status('Pattern dupliqué')};
 $('playBtn').onclick=startPlayback;$('stopBtn').onclick=stopPlayback;$('recBtn').onclick=()=>{recArmed=!recArmed;$('recBtn').classList.toggle('active',recArmed);status(recArmed?'REC armé':'REC désarmé')};
 $('metroBtn').onclick=()=>{metro=!metro;$('metroBtn').classList.toggle('active',metro)};
 $('repeatBtn').onclick=()=>{noteRepeat=!noteRepeat;$('repeatBtn').classList.toggle('active',noteRepeat)};
 $('fullBtn').onclick=()=>{fullLevel=!fullLevel;$('fullBtn').classList.toggle('active',fullLevel)};
 document.querySelectorAll('.repeatDiv button').forEach(b=>b.onclick=()=>{repeatDiv=+b.dataset.div;document.querySelectorAll('.repeatDiv button').forEach(x=>x.classList.remove('active'));b.classList.add('active')});
 $('tapBtn').onclick=()=>{const n=performance.now();tapTimes=tapTimes.filter(t=>n-t<3500);tapTimes.push(n);if(tapTimes.length>1){let sum=0;for(let i=1;i<tapTimes.length;i++)sum+=tapTimes[i]-tapTimes[i-1];$('bpm').value=Math.round(60000/(sum/(tapTimes.length-1)))}};
 $('master').oninput=e=>{$('masterOut').textContent=e.target.value+'%';if(masterGain)masterGain.gain.value=+e.target.value/100};
 $('padGain').oninput=e=>{selected().gain=+e.target.value/100;$('gainOut').textContent=e.target.value+'%'};
 $('padPitch').oninput=e=>{selected().pitch=+e.target.value;$('pitchOut').textContent=e.target.value+' st'};
 $('padStart').oninput=async e=>{const p=selected();try{await ensureEditableSample(p)}catch(err){status(err.message);return}p.start=Math.min(+e.target.value/100,p.end-.01);$('startOut').textContent=Math.round(p.start*100)+'%';drawWave()};
 $('padEnd').oninput=async e=>{const p=selected();try{await ensureEditableSample(p)}catch(err){status(err.message);return}p.end=Math.max(+e.target.value/100,p.start+.01);$('endOut').textContent=Math.round(p.end*100)+'%';drawWave()};
 $('oneShotBtn').onclick=()=>{selected().loop=false;renderEditor();$('oneShotBtn').classList.add('active')};$('loopPadBtn').onclick=()=>{selected().loop=!selected().loop;renderEditor();$('oneShotBtn').classList.toggle('active',!selected().loop)};$('mutePadBtn').onclick=()=>{selected().muted=!selected().muted;renderEditor();renderPads()};
 $('sliceBtn').onclick=sliceSelected;$('reverseBtn').onclick=reverseSelected;$('trimBtn').onclick=trimSelected;$('assignBtn').onclick=()=>{if(lastPreviewSample)assignFactory(lastPreviewSample);else status('Préécoute d’abord un son dans la bibliothèque')};
 $('clearPadBtn').onclick=clearPad;$('autoBeatBtn').onclick=randomBeat;$('randomKitBtn').onclick=randomKit;
 $('levelsBtn').onclick=()=>{levelsMode=!levelsMode;levelsBasePad=selectedPad;$('levelsBtn').classList.toggle('active',levelsMode);renderPads();status(levelsMode?'16 niveaux activés sur '+levelsBasePad:'16 niveaux désactivés')};
 $('loopSeqBtn').onclick=()=>{loopSequence=!loopSequence;$('loopSeqBtn').classList.toggle('active',loopSequence);$('loopSeqBtn').textContent=loopSequence?'↻ LECTURE EN BOUCLE':'→ LECTURE 1 FOIS';status(loopSequence?'Boucle activée':'Lecture unique activée')};$('loopSeqBtn').classList.toggle('active',loopSequence);
 document.querySelectorAll('.bigModes button').forEach(b=>b.onclick=()=>{currentMode=b.dataset.mode;document.body.dataset.mode=currentMode;document.querySelectorAll('.bigModes button').forEach(x=>x.classList.remove('active'));b.classList.add('active');status(b.textContent.trim())});
 $('saveBtn').onclick=saveLocal;$('saveLocalBtn').onclick=saveLocal;$('exportProjectBtn').onclick=exportProject;$('projectImport').onchange=e=>{if(e.target.files[0])importProjectFile(e.target.files[0]);e.target.value=''};$('exportWavBtn').onclick=renderWav;
 $('cloudBtn').onclick=()=>{$('cloudDialog').showModal();cloudRefresh()};$('saveSbBtn').onclick=async()=>{const url=$('sbUrl').value.trim().replace(/\/$/,''),key=$('sbKey').value.trim();if(!/^https:\/\/.+\.supabase\.co$/.test(url)||!safeKey(key))return $('authState').textContent='URL ou Publishable key invalide';localStorage.setItem('mpc-supabase',JSON.stringify({url,key}));sb=null;sbUser=null;await initSupabase();status('Configuration Supabase enregistrée')};
 $('signInBtn').onclick=async()=>{if(!sb)return;const {error}=await sb.auth.signInWithPassword({email:$('email').value,password:$('password').value});if(error)$('authState').textContent=error.message};
 $('signUpBtn').onclick=async()=>{if(!sb)return;const {error}=await sb.auth.signUp({email:$('email').value,password:$('password').value});$('authState').textContent=error?error.message:'Compte créé. Vérifie ton e-mail si demandé.'};
 $('signOutBtn').onclick=async()=>{if(sb)await sb.auth.signOut()};
 $('cloudSaveBtn').onclick=cloudSave;$('cloudRefreshBtn').onclick=cloudRefresh;$('cloudLoadBtn').onclick=cloudLoad;
 const padModeBtns=[...document.querySelectorAll('.padModes button')];padModeBtns.forEach((b,i)=>{const modes=['play','select','edit','mute','solo'];b.onclick=()=>{padMode=modes[i]||'play';levelsMode=false;$('levelsBtn').classList.remove('active');padModeBtns.forEach(x=>x.classList.remove('active'));b.classList.add('active');renderPads();status('Mode pad : '+b.textContent.trim())}});
 $('bankMode').onclick=()=>{levelsMode=false;padMode='play';$('levelsBtn').classList.remove('active');padModeBtns.forEach((x,i)=>x.classList.toggle('active',i===0));renderPads();status('Mode banque · jouer')};
 const footerPadMode=[...document.querySelectorAll('.padFooter>button')].find(b=>b.textContent.trim()==='PAD MODE');if(footerPadMode)footerPadMode.onclick=()=>{const modes=['play','select','edit','mute','solo'],n=(modes.indexOf(padMode)+1)%modes.length;padModeBtns[n].click()};
 const songBtns=[...document.querySelectorAll('.songRow>button:not(#loopSeqBtn)')];if(songBtns[0])songBtns[0].onclick=()=>setTransportMode('pattern');if(songBtns[1])songBtns[1].onclick=()=>setTransportMode('song');if(songBtns[2]){songBtns[2].disabled=true;songBtns[2].title='Scènes : prochaine version'}
 const navBtns=document.querySelectorAll('.editorHead>div:last-child button');if(navBtns[0])navBtns[0].onclick=()=>{let i=(parseInt(selectedPad.slice(1),10)-2+16)%16;selectPad(padId(bank,i))};if(navBtns[1])navBtns[1].onclick=()=>{let i=parseInt(selectedPad.slice(1),10)%16;selectPad(padId(bank,i))};
 const browserTabs=[...document.querySelectorAll('.tabs button')];browserTabs.forEach((b,i)=>b.onclick=()=>{browserTabs.forEach(x=>x.classList.remove('active'));b.classList.add('active');browserTab=['samples','kits','project'][i];if(browserTab==='samples'){buildLibrary();status('Bibliothèque échantillons')}else if(browserTab==='kits'){renderKitBrowser()}else{renderProjectBrowser()}});
 const editorTabs=[...document.querySelectorAll('.editorTabs button')];editorTabs.forEach((b,i)=>{if(i>0){b.disabled=true;b.title='Fonction avancée prévue dans une prochaine version';return}b.onclick=()=>{editorTabs.forEach(x=>x.classList.remove('active'));b.classList.add('active');status('Éditeur échantillon')}});
 $('menuBtn').onclick=openMainMenu;
 window.addEventListener('keydown',e=>{if(e.target.matches('input,select'))return;const map='1234qwerasdfzxcv',i=map.indexOf(e.key.toLowerCase());if(i>=0)playPad(padId(bank,i));if(e.code==='Space'){e.preventDefault();isPlaying?stopPlayback():startPlayback()}});
}
buildLibrary();renderAll();bind();document.body.dataset.mode=currentMode;initSupabase();if(localStorage.getItem('mpc-studio-project'))loadLocal();
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
