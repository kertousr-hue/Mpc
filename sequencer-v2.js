(function(root,factory){
  var core=(typeof module==='object'&&module.exports)?require('./sequencer-core.js'):(root&&root.MPCSequencerCore);
  var api=factory(core,root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MPCSequencerV2=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(core,root){
  'use strict';
  if(!core)throw new Error('MPCSequencerCore requis');

  function clone(v){return JSON.parse(JSON.stringify(v))}
  function ensureTracks(pattern,padIds){
    var bars=Math.max(1,Math.min(8,Number(pattern&&pattern.bars)||1)),base=core.createPattern({padIds:padIds,bars:bars});
    var normalized=pattern&&pattern.tracks?core.normalizeV7Pattern(pattern):null;
    if(normalized){
      base.timeSignature=normalized.timeSignature;base.automation=normalized.automation;base.swing=normalized.swing;
      padIds.forEach(function(id){var src=normalized.tracks[id]||[];for(var i=0;i<Math.min(src.length,base.tracks[id].length);i++)base.tracks[id][i]=core.normalizeStep(src[i])});
    }
    return base;
  }
  function createSession(opts){
    opts=opts||{};var padIds=Array.isArray(opts.padIds)?opts.padIds.slice():[],migrated=core.migrateLegacyPatterns(Array.isArray(opts.patterns)?opts.patterns:[]);
    while(migrated.length<8)migrated.push(core.createPattern({padIds:padIds,bars:1}));
    migrated=migrated.slice(0,8).map(function(p){return ensureTracks(p,padIds)});
    return {version:7,patterns:migrated,padIds:padIds,selectedBar:0,selectedStep:0,songArrangement:Array.isArray(opts.songArrangement)?clone(opts.songArrangement):[]};
  }
  function setBars(session,patternIndex,bars){
    var i=Math.max(0,Math.min(session.patterns.length-1,Number(patternIndex)||0));
    session.patterns[i]=ensureTracks(core.resizePattern(session.patterns[i],bars),session.padIds);
    session.selectedBar=Math.min(session.selectedBar,session.patterns[i].bars-1);return session.patterns[i];
  }
  function stepRef(session,patternIndex,padId,index){
    var p=session.patterns[Math.max(0,Math.min(session.patterns.length-1,Number(patternIndex)||0))];if(!p||!p.tracks[padId])return null;
    var i=Math.max(0,Math.min(p.tracks[padId].length-1,Number(index)||0));return p.tracks[padId][i];
  }
  function toggleStep(session,patternIndex,padId,index){var s=stepRef(session,patternIndex,padId,index);if(!s)return null;s.on=!s.on;session.selectedStep=index;return s}
  function setStepValues(session,patternIndex,padId,index,values){var s=stepRef(session,patternIndex,padId,index);if(!s)return null;var n=core.normalizeStep(Object.assign({},s,values||{}));Object.assign(s,n);session.selectedStep=index;return s}
  function serializeSession(session){return {version:7,patterns:clone(session.patterns),songArrangement:clone(session.songArrangement||[])}}
  function formatBarLabel(index,total){return 'Mesure '+(Number(index)+1)+'/'+Math.max(1,Number(total)||1)}
  function quantizePosition(position,mode,totalSteps){
    var grids={'1/8':2,'1/16':1,'1/32':.5,'1/8T':4/3,'1/16T':2/3},total=Math.max(1,Number(totalSteps)||16),grid=grids[mode]||1,pos=((Number(position)||0)%total+total)%total,q=Math.round(pos/grid)*grid;
    q=((q%total)+total)%total;var raw=Math.round(q),micro=Math.max(-.49,Math.min(.49,q-raw)),stepIndex=((raw%total)+total)%total;
    return {stepIndex:stepIndex,micro:micro};
  }

  var browser={session:null,playing:false,timer:null,playIndex:0,nextTime:0,transportStartTime:0,cycle:0,clipboard:null,selectedPadId:null,follow:true,raf:null,lastPaintStep:-1};
  function canUseBrowser(){return !!(root&&root.document&&root.window===root)}
  function currentPatternIndex(){try{return Math.max(0,Math.min(7,Number(patternIndex)||0))}catch(e){return 0}}
  function currentBank(){try{return bank}catch(e){return 'A'}}
  function currentTrack(){try{return Number(selectedTrack)||0}catch(e){return 0}}
  function appPadIds(){var out=[];try{for(var b of BANKS)for(var i=0;i<16;i++)out.push(padId(b,i))}catch(e){}return out}
  function legacyPatterns(){try{return patterns}catch(e){return []}}
  function syncLegacyFirstBar(){
    try{browser.session.patterns.forEach(function(p,pi){if(!patterns[pi])return;Object.keys(patterns[pi]).forEach(function(id){var src=p.tracks[id];if(!src||!Array.isArray(patterns[pi][id]))return;for(var i=0;i<16;i++)patterns[pi][id][i]=!!(src[i]&&src[i].on)})})}catch(e){}
  }
  function loadInitialSession(){
    var padIds=appPadIds(),raw=null;try{raw=JSON.parse(localStorage.getItem('mpc-studio-project')||'null')}catch(e){}
    if(raw&&raw.version>=7&&Array.isArray(raw.patterns))browser.session=createSession({patterns:raw.patterns,padIds:padIds,songArrangement:raw.songArrangement});
    else browser.session=createSession({patterns:legacyPatterns(),padIds:padIds});
  }
  function pattern(){return browser.session.patterns[currentPatternIndex()]}
  function currentTransportPosition(){
    var p=pattern(),total=Math.max(1,p.bars*16);if(!browser.playing||typeof audioCtx==='undefined'||!audioCtx)return browser.playIndex;
    var sd=stepDuration(),pos=(audioCtx.currentTime-browser.transportStartTime)/Math.max(.0001,sd);return ((pos%total)+total)%total;
  }
  function paintPlayhead(){
    if(!browser.playing)return;var p=pattern(),idx=Math.floor(currentTransportPosition())%(p.bars*16),bar=Math.floor(idx/16);
    if(browser.follow&&bar!==browser.session.selectedBar){browser.session.selectedBar=bar;renderToolbar();renderGrid()}
    if(idx!==browser.lastPaintStep){document.querySelectorAll('.grooveStep.playing').forEach(function(el){el.classList.remove('playing')});document.querySelectorAll('.grooveStep[data-step="'+idx+'"]').forEach(function(el){el.classList.add('playing')});browser.lastPaintStep=idx}
    browser.raf=requestAnimationFrame(paintPlayhead);
  }
  function selectedGridPad(){return browser.selectedPadId||((function(){try{return padId(currentBank(),currentTrack())}catch(e){return 'A01'}})())}
  function selectedStep(){var p=pattern(),id=selectedGridPad(),idx=Math.max(0,Math.min(p.bars*16-1,Number(browser.session.selectedStep)||0));return p.tracks[id]&&p.tracks[id][idx]}

  function injectUi(){
    var seq=document.querySelector('.sequencer');if(!seq||document.getElementById('grooveboxV2'))return;
    var head=seq.querySelector('.seqHead'),steps=document.getElementById('steps');if(steps)steps.style.display='none';
    var wrap=document.createElement('section');wrap.id='grooveboxV2';wrap.className='grooveboxV2';
    wrap.innerHTML='<div class="grooveToolbar"><div class="grooveViews"><button type="button" class="active" data-view="grid">GRID</button><button type="button" data-view="step">STEP</button></div><label>MESURES<select id="grooveBars">'+[1,2,3,4,5,6,7,8].map(function(n){return '<option>'+n+'</option>'}).join('')+'</select></label><label>SWING LANE<select id="grooveSwingLane"><option value="offbeat">OFFBEAT</option><option value="all">TOUS</option><option value="none">AUCUN</option></select></label><span id="grooveBarLabel"></span><button type="button" id="groovePrevBar">‹</button><button type="button" id="grooveNextBar">›</button></div><div id="grooveGrid" class="grooveGrid"></div><div id="grooveStepEditor" class="grooveStepEditor" hidden><div class="stepEditorTitle"><b id="grooveStepTitle">STEP</b><span id="grooveStepState"></span></div><label>VÉLOCITÉ <input id="grooveVelocity" type="range" min="0" max="100"><output id="grooveVelocityOut"></output></label><label>PROBABILITÉ <input id="grooveProbability" type="range" min="0" max="100"><output id="grooveProbabilityOut"></output></label><label>MICRO <input id="grooveMicro" type="range" min="-49" max="49"><output id="grooveMicroOut"></output></label><label>PITCH <input id="grooveStepPitch" type="range" min="-24" max="24"><output id="grooveStepPitchOut"></output></label><label>RATCHET <input id="grooveRatchet" type="range" min="1" max="8"><output id="grooveRatchetOut"></output></label><button type="button" id="grooveAccent">ACCENT</button></div>';
    if(head)head.insertAdjacentElement('afterend',wrap);else seq.prepend(wrap);
    bindUi();renderAllV2();
  }
  function renderAllV2(){renderToolbar();renderGrid();renderStepEditor()}
  function renderToolbar(){var p=pattern(),bar=Math.min(browser.session.selectedBar,p.bars-1);browser.session.selectedBar=bar;var barsEl=document.getElementById('grooveBars'),lab=document.getElementById('grooveBarLabel'),lane=document.getElementById('grooveSwingLane');if(barsEl)barsEl.value=String(p.bars);if(lab)lab.textContent=formatBarLabel(bar,p.bars);if(lane)lane.value=(p.swing&&p.swing.lane)||'offbeat'}
  function renderGrid(){
    var rootEl=document.getElementById('grooveGrid');if(!rootEl)return;var p=pattern(),bar=browser.session.selectedBar,start=bar*16;rootEl.innerHTML='';
    var ids=[];try{for(var i=0;i<16;i++)ids.push(padId(currentBank(),i))}catch(e){return}
    ids.forEach(function(id,row){var line=document.createElement('div');line.className='grooveTrack';var name='';try{name=pads[id].name}catch(e){name=id}line.innerHTML='<button type="button" class="grooveTrackName" data-pad="'+id+'"><span>'+String(row+1).padStart(2,'0')+'</span><b>'+escapeHtml(name)+'</b></button><div class="grooveTrackSteps"></div>';var cellRoot=line.querySelector('.grooveTrackSteps');
      for(var s=0;s<16;s++){var abs=start+s,step=p.tracks[id][abs],b=document.createElement('button');b.type='button';b.className='grooveStep'+(step.on?' active':'')+(browser.playing&&Math.floor(currentTransportPosition())===abs?' playing':'')+(browser.session.selectedStep===abs&&selectedGridPad()===id?' selected':'')+(step.accent?' accent':'');b.dataset.pad=id;b.dataset.step=String(abs);b.dataset.n=String(s+1);b.title='V '+Math.round(step.velocity*100)+' · P '+Math.round(step.probability*100)+'% · R'+step.ratchet;b.onclick=function(){browser.selectedPadId=id;try{selectedTrack=row;selectedPad=id}catch(e){}toggleStep(browser.session,currentPatternIndex(),id,abs);syncLegacyFirstBar();renderGrid();renderStepEditor()};cellRoot.appendChild(b)}
      rootEl.appendChild(line)
    })
  }
  function renderStepEditor(){
    var s=selectedStep(),id=selectedGridPad(),p=pattern();if(!s)return;var idx=Math.max(0,Math.min(p.bars*16-1,browser.session.selectedStep));
    var title=document.getElementById('grooveStepTitle'),state=document.getElementById('grooveStepState');if(title)title.textContent=id+' · STEP '+(idx+1);if(state)state.textContent=s.on?'ACTIF':'INACTIF';
    setCtl('grooveVelocity',Math.round(s.velocity*100),'grooveVelocityOut',Math.round(s.velocity*100)+'%');setCtl('grooveProbability',Math.round(s.probability*100),'grooveProbabilityOut',Math.round(s.probability*100)+'%');setCtl('grooveMicro',Math.round(s.micro*100),'grooveMicroOut',Math.round(s.micro*100)+'%');setCtl('grooveStepPitch',s.pitch,'grooveStepPitchOut',s.pitch+' st');setCtl('grooveRatchet',s.ratchet,'grooveRatchetOut','×'+s.ratchet);var a=document.getElementById('grooveAccent');if(a)a.classList.toggle('active',s.accent)
  }
  function setCtl(id,v,outId,text){var e=document.getElementById(id),o=document.getElementById(outId);if(e)e.value=String(v);if(o)o.textContent=text}
  function setSelected(values){var id=selectedGridPad(),idx=browser.session.selectedStep,s=setStepValues(browser.session,currentPatternIndex(),id,idx,values);if(s){syncLegacyFirstBar();renderGrid();renderStepEditor()}return s}
  function bindUi(){
    var barsEl=document.getElementById('grooveBars');if(barsEl)barsEl.onchange=function(){setBars(browser.session,currentPatternIndex(),Number(this.value));browser.session.selectedBar=Math.min(browser.session.selectedBar,pattern().bars-1);syncLegacyFirstBar();renderAllV2()};
    var lane=document.getElementById('grooveSwingLane');if(lane)lane.onchange=function(){pattern().swing=pattern().swing||{};pattern().swing.lane=this.value};
    var prev=document.getElementById('groovePrevBar'),next=document.getElementById('grooveNextBar');if(prev)prev.onclick=function(){browser.session.selectedBar=(browser.session.selectedBar-1+pattern().bars)%pattern().bars;renderAllV2()};if(next)next.onclick=function(){browser.session.selectedBar=(browser.session.selectedBar+1)%pattern().bars;renderAllV2()};
    document.querySelectorAll('.grooveViews button').forEach(function(b){b.onclick=function(){document.querySelectorAll('.grooveViews button').forEach(function(x){x.classList.remove('active')});b.classList.add('active');var isStep=b.dataset.view==='step';document.getElementById('grooveGrid').hidden=isStep;document.getElementById('grooveStepEditor').hidden=!isStep}});
    bindRange('grooveVelocity',function(v){setSelected({velocity:v/100})});bindRange('grooveProbability',function(v){setSelected({probability:v/100})});bindRange('grooveMicro',function(v){setSelected({micro:v/100})});bindRange('grooveStepPitch',function(v){setSelected({pitch:v})});bindRange('grooveRatchet',function(v){setSelected({ratchet:v})});var acc=document.getElementById('grooveAccent');if(acc)acc.onclick=function(){var s=selectedStep();if(s)setSelected({accent:!s.accent})};
  }
  function bindRange(id,fn){var e=document.getElementById(id);if(e)e.oninput=function(){fn(Number(this.value))}}

  function schedulePad(id,event){
    try{if(!isPadAudible(id))return;var p=pads[id],out=(root.MPCAudioEngineV2&&root.MPCAudioEngineV2.getTrackInput)?root.MPCAudioEngineV2.getTrackInput(id):masterGain,vol=(fullLevel?1:event.velocity)*p.gain,totalPitch=(Number(p.pitch)||0)+(Number(event.pitch)||0)+(Number(event.locks&&event.locks.pitch)||0);if(root.MPCAutomation&&root.MPCAutomation.applyStepLocks)root.MPCAutomation.applyStepLocks(id,event.locks,event.time,event.restoreTime);if(p.sample&&p.sample.kind==='factory')scheduleFactory(FACTORY[p.sample.factoryIndex],audioCtx,out,event.time,vol,totalPitch);else if(p.buffer)scheduleUser(Object.assign({},p,{pitch:totalPitch}),audioCtx,out,event.time,vol);var delay=Math.max(0,(event.time-audioCtx.currentTime)*1000);setTimeout(function(){try{flashPad(id)}catch(e){}},delay)}catch(e){console.error('Groovebox schedule',e)}
  }
  function scheduler(){
    if(!browser.playing)return;try{while(browser.nextTime<audioCtx.currentTime+.12){var p=pattern(),idx=browser.playIndex,sd=stepDuration(),safeTime=audioCtx.currentTime+.005,sw=Math.max(0,Math.min(.7,(Number(document.getElementById('swing')&&document.getElementById('swing').value)||0)/100)),lane=(p.swing&&p.swing.lane)||'offbeat';p.swing=p.swing||{};p.swing.amount=sw;browser.session.padIds.forEach(function(id){var step=p.tracks[id]&&p.tracks[id][idx];if(root.MPCAutomation&&root.MPCAutomation.applyAutomationAtStep)root.MPCAutomation.applyAutomationAtStep(id,p,idx,browser.nextTime);if(!step)return;var evs=core.expandStepEvents({step:step,stepIndex:idx,baseTime:browser.nextTime,safeTime:safeTime,stepDuration:sd,swing:sw,swingLane:lane,cycleSeed:currentPatternIndex()+':'+browser.cycle,seedKey:id});evs.forEach(function(ev){schedulePad(id,ev)})});if(typeof metro!=='undefined'&&metro&&idx%4===0)oscHit(audioCtx,masterGain,browser.nextTime,'square',idx%16===0?1200:850,null,.08,.025);browser.nextTime+=sd;browser.playIndex++;if(browser.playIndex>=p.bars*16){browser.playIndex=0;browser.cycle++;if(typeof transportMode!=='undefined'&&transportMode==='song'){advanceSong()}else if(typeof loopSequence!=='undefined'&&!loopSequence){stopTransport('Lecture terminée');break}}}}catch(e){stopTransport('Erreur séquenceur : '+e.message)}
  }
  function songIndices(){var arr=(browser.session.songArrangement||[]).flatMap(function(x){var out=[];for(var i=0;i<Math.max(1,Number(x.repeats)||1);i++)out.push(Number(x.patternIndex)||0);return out});if(arr.length)return arr;return browser.session.patterns.map(function(_,i){return i}).filter(function(i){var p=browser.session.patterns[i];return Object.values(p.tracks).some(function(a){return a.some(function(s){return s.on})})})}
  var songQueue=[],songCursor=0;
  function advanceSong(){if(!songQueue.length)songQueue=songIndices();if(!songQueue.length)return;if(songCursor<songQueue.length-1){songCursor++;try{patternIndex=songQueue[songCursor];document.getElementById('patternSelect').value=String(patternIndex)}catch(e){}}else if(typeof loopSequence==='undefined'||loopSequence){songCursor=0;try{patternIndex=songQueue[0];document.getElementById('patternSelect').value=String(patternIndex)}catch(e){}}else stopTransport('Chanson terminée');renderAllV2()}
  function startTransport(ev){if(ev){ev.preventDefault();ev.stopImmediatePropagation()}try{ensureAudio()}catch(e){}if(browser.playing)return;browser.playing=true;browser.playIndex=0;browser.cycle=0;browser.nextTime=audioCtx.currentTime+.05;browser.transportStartTime=browser.nextTime;browser.lastPaintStep=-1;songQueue=songIndices();songCursor=Math.max(0,songQueue.indexOf(currentPatternIndex()));browser.timer=setInterval(scheduler,25);var b=document.getElementById('playBtn');if(b)b.classList.add('active');status(typeof recArmed!=='undefined'&&recArmed?'Enregistrement Groovebox…':'Lecture Groovebox V2');renderGrid();if(browser.raf)cancelAnimationFrame(browser.raf);browser.raf=requestAnimationFrame(paintPlayhead)}
  function stopTransport(message,ev){if(ev){ev.preventDefault();ev.stopImmediatePropagation()}browser.playing=false;if(browser.timer)clearInterval(browser.timer);browser.timer=null;if(browser.raf)cancelAnimationFrame(browser.raf);browser.raf=null;browser.lastPaintStep=-1;browser.playIndex=0;try{stopAllSources()}catch(e){}var b=document.getElementById('playBtn');if(b)b.classList.remove('active');renderGrid();status(message||'Arrêt Groovebox')}
  function bindTransport(){var play=document.getElementById('playBtn'),stop=document.getElementById('stopBtn');if(play)play.addEventListener('click',startTransport,true);if(stop)stop.addEventListener('click',function(e){stopTransport('Arrêt',e)},true);root.addEventListener('keydown',function(e){if(e.code==='Space'&&!e.target.matches('input,select,textarea')){e.preventDefault();e.stopImmediatePropagation();browser.playing?stopTransport('Arrêt'):startTransport()}},true);document.addEventListener('pointerdown',function(e){if(!browser.playing||typeof recArmed==='undefined'||!recArmed)return;var b=e.target&&e.target.closest&&e.target.closest('.pad');if(!b)return;var id=b.dataset.id,p=pattern(),q=document.getElementById('quantize'),hit=quantizePosition(currentTransportPosition(),q&&q.value,p.bars*16);if(p.tracks[id]){var st=p.tracks[id][hit.stepIndex];st.on=true;st.micro=hit.micro;browser.selectedPadId=id;browser.session.selectedStep=hit.stepIndex;syncLegacyFirstBar();renderGrid();renderStepEditor()}},true)}
  function bindPatternActions(){
    var ps=document.getElementById('patternSelect');if(ps)ps.addEventListener('change',function(){browser.session.selectedBar=0;renderAllV2()});
    intercept('copyPatternBtn',function(){browser.clipboard=clone(pattern());status('Pattern V2 copié')});intercept('pastePatternBtn',function(){if(browser.clipboard){browser.session.patterns[currentPatternIndex()]=ensureTracks(clone(browser.clipboard),browser.session.padIds);syncLegacyFirstBar();renderAllV2();status('Pattern V2 collé')}});intercept('clearPatternBtn',function(){var p=pattern();Object.values(p.tracks).forEach(function(a){a.forEach(function(s){s.on=false})});syncLegacyFirstBar();renderAllV2();status('Pattern V2 effacé')});intercept('duplicateBtn',function(){var n=(currentPatternIndex()+1)%8;browser.session.patterns[n]=ensureTracks(clone(pattern()),browser.session.padIds);try{patternIndex=n;document.getElementById('patternSelect').value=String(n)}catch(e){}syncLegacyFirstBar();renderAllV2();status('Pattern V2 dupliqué')});intercept('autoBeatBtn',function(){var p=pattern(),b=browser.session.selectedBar,start=b*16;Object.values(p.tracks).forEach(function(a){for(var i=start;i<start+16;i++)a[i].on=false});function tr(n){try{return p.tracks[padId(currentBank(),n)]}catch(e){return null}}var a=tr(0),sn=tr(1),hh=tr(2),pc=tr(3);[0,4,8,12].forEach(function(s){if(a)a[start+s].on=true});[4,12].forEach(function(s){if(sn)sn[start+s].on=true});for(var s=0;s<16;s+=2)if(hh)hh[start+s].on=Math.random()>.15;for(var q=0;q<16;q++)if(pc&&Math.random()>.86)pc[start+q].on=true;syncLegacyFirstBar();renderAllV2();status('Beat Groovebox créé · '+formatBarLabel(b,p.bars))});
  }
  function intercept(id,fn){var e=document.getElementById(id);if(e)e.addEventListener('click',function(ev){ev.preventDefault();ev.stopImmediatePropagation();fn(ev)},true)}
  function wrapPersistence(){
    try{var legacySer=serializable;serializable=function(includeCloud){var d=legacySer(includeCloud);var v=serializeSession(browser.session);d.version=7;d.patterns=v.patterns;d.songArrangement=v.songArrangement;return d}}catch(e){}
    try{var legacyApply=applyProject;applyProject=async function(d,loadCloudAudio){var source=d||{},legacy=source;if(source.version>=7&&Array.isArray(source.patterns)){legacy=Object.assign({},source,{patterns:source.patterns.map(function(p){var o={};Object.keys(p.tracks||{}).forEach(function(id){o[id]=(p.tracks[id]||[]).slice(0,16).map(function(s){return !!(s&&s.on)})});return o})})}await legacyApply(legacy,loadCloudAudio);browser.session=createSession({patterns:source.patterns||legacyPatterns(),padIds:appPadIds(),songArrangement:source.songArrangement});syncLegacyFirstBar();renderAllV2();return source}}
    catch(e){}
  }
  function initBrowser(){loadInitialSession();injectUi();bindTransport();bindPatternActions();wrapPersistence();var q=document.getElementById('quantize');if(q){['1/32','1/8T','1/16T'].forEach(function(v){if(!Array.from(q.options).some(function(o){return o.value===v||o.text===v}))q.add(new Option(v,v))})}syncLegacyFirstBar();setTimeout(renderAllV2,100)}
  if(canUseBrowser()){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(initBrowser,50)},{once:true});else setTimeout(initBrowser,50)}

  return {createSession:createSession,setBars:setBars,toggleStep:toggleStep,setStepValues:setStepValues,serializeSession:serializeSession,formatBarLabel:formatBarLabel,quantizePosition:quantizePosition,get session(){return browser.session},getTransportState:function(){return {playing:browser.playing,playIndex:browser.playIndex,patternIndex:currentPatternIndex(),cycle:browser.cycle}},start:startTransport,stop:stopTransport,render:renderAllV2};
});
