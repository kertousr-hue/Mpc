(function(root,factory){
  var seq=(typeof module==='object'&&module.exports)?require('./sequencer-core.js'):(root&&root.MPCSequencerCore);
  var mix=(typeof module==='object'&&module.exports)?require('./mixer-core.js'):(root&&root.MPCMixerCore);
  var fx=(typeof module==='object'&&module.exports)?require('./fx-rack.js'):(root&&root.MPCFXRack);
  var auto=(typeof module==='object'&&module.exports)?require('./automation-core.js'):(root&&root.MPCAutomationCore);
  var api=factory(seq,mix,fx,auto,root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MPCExportV2=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(seq,mix,fx,auto,root){
  'use strict';
  if(!seq||!mix||!fx||!auto)throw new Error('Modules export V2 requis');

  function clamp(v,a,b){v=Number(v);if(!Number.isFinite(v))v=a;return Math.min(b,Math.max(a,v))}
  function patternDurationSeconds(pattern,bpm){var bars=Math.max(1,Math.min(8,Number(pattern&&pattern.bars)||1));return 60/clamp(bpm||120,40,300)*4*bars}
  function safeFilename(name){var s=String(name||'').replace(/[\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim().slice(0,80);return s||'track'}
  function patternHasNotes(pattern){return !!(pattern&&pattern.tracks&&Object.values(pattern.tracks).some(function(a){return Array.isArray(a)&&a.some(function(s){return !!(s&&s.on)})}))}
  function audibleTrackIds(pattern,mixer){var ids=Object.keys((pattern&&pattern.tracks)||{}).filter(function(id){return (pattern.tracks[id]||[]).some(function(s){return s&&s.on})}),anySolo=Object.values(mixer||{}).some(function(s){return !!(s&&s.solo)});return ids.filter(function(id){var s=(mixer&&mixer[id])||{};return !s.muted&&(!anySolo||s.solo)})}
  function eventSchedule(pattern,bpm,ids,swingAmount){var sd=60/clamp(bpm||120,40,300)/4,out=[],tracks=(pattern&&pattern.tracks)||{},list=ids||Object.keys(tracks),amount=clamp(swingAmount==null?((pattern&&pattern.swing&&pattern.swing.amount)||0):swingAmount,0,.7),lane=(pattern&&pattern.swing&&pattern.swing.lane)||'offbeat';list.forEach(function(id){(tracks[id]||[]).forEach(function(step,i){var base=i*sd,events=seq.expandStepEvents({step:step,stepIndex:i,baseTime:base,safeTime:0,stepDuration:sd,swing:amount,swingLane:lane,cycleSeed:'export',seedKey:id});events.forEach(function(e){out.push({padId:id,stepIndex:i,time:e.time,restoreTime:e.restoreTime,velocity:e.velocity,pitch:e.pitch+(Number(e.locks&&e.locks.pitch)||0),locks:e.locks||{},accent:e.accent,ratchetIndex:e.ratchetIndex})})})});out.sort(function(a,b){return a.time-b.time||a.padId.localeCompare(b.padId)});return out}

  function stepBaseParams(pattern,padId,stepIndex,mixerState){
    var base=mix.normalizeMixerState(mixerState),total=Math.max(1,(Number(pattern&&pattern.bars)||1)*16),pos=(Number(stepIndex)||0)/total,vals={gain:1,pan:base.pan,cutoff:base.cutoff,sendA:base.sendA,sendB:base.sendB},lanes=(pattern&&pattern.automation)||{};
    ['gain','pan','cutoff','sendA','sendB'].forEach(function(k){var v=auto.sampleLane(lanes[padId+':'+k],pos);if(v!=null)vals[k]=v});
    var norm=auto.normalizeLocks(vals);
    return {gain:norm.gain==null?1:norm.gain,pan:norm.pan==null?base.pan:norm.pan,cutoff:norm.cutoff==null?base.cutoff:norm.cutoff,sendA:norm.sendA==null?base.sendA:norm.sendA,sendB:norm.sendB==null?base.sendB:norm.sendB};
  }

  function parameterTimeline(pattern,bpm,padId,mixerState,swingAmount){
    var total=Math.max(1,(Number(pattern&&pattern.bars)||1)*16),sd=60/clamp(bpm||120,40,300)/4,out=[],track=(pattern&&pattern.tracks&&pattern.tracks[padId])||[],amount=clamp(swingAmount==null?((pattern&&pattern.swing&&pattern.swing.amount)||0):swingAmount,0,.7),lane=(pattern&&pattern.swing&&pattern.swing.lane)||'offbeat';
    for(var i=0;i<total;i++){
      var base=stepBaseParams(pattern,padId,i,mixerState),baseTime=i*sd;
      out.push({time:baseTime,stepIndex:i,kind:'base',values:base});
      var step=seq.normalizeStep(track[i]);
      if(!step.on||!Object.keys(step.locks||{}).some(function(k){return k!=='pitch'}))continue;
      var events=seq.expandStepEvents({step:step,stepIndex:i,baseTime:baseTime,safeTime:0,stepDuration:sd,swing:amount,swingLane:lane,cycleSeed:'export',seedKey:padId});
      events.forEach(function(ev){
        var locks=auto.normalizeLocks(ev.locks||{}),values=Object.assign({},base);
        ['gain','pan','cutoff','sendA','sendB'].forEach(function(k){if(locks[k]!=null)values[k]=locks[k]});
        out.push({time:ev.time,stepIndex:i,kind:'lock',values:values});
      });
    }
    out.sort(function(a,b){return a.time-b.time||(a.kind==='base'?-1:1)});
    return out;
  }

  function defaultSongArrangement(patterns){
    var out=[];(patterns||[]).forEach(function(p,i){if(patternHasNotes(p))out.push({patternIndex:i,repeats:1})});return out;
  }
  function buildSongTimeline(session,bpm,arrangement){
    var patterns=(session&&session.patterns)||[],arr=Array.isArray(arrangement)&&arrangement.length?arrangement:(Array.isArray(session&&session.songArrangement)&&session.songArrangement.length?session.songArrangement:defaultSongArrangement(patterns)),segments=[],offset=0;
    arr.forEach(function(entry){var idx=Number(entry&&entry.patternIndex);if(!Number.isInteger(idx)||idx<0||idx>=patterns.length)return;var reps=Math.max(1,Math.min(64,Number(entry.repeats)||1)),duration=patternDurationSeconds(patterns[idx],bpm);for(var r=0;r<reps;r++){segments.push({patternIndex:idx,offsetSeconds:offset,durationSeconds:duration,repeatIndex:r});offset+=duration}});
    return {segments:segments,totalDuration:offset};
  }

  function canUseBrowser(){return !!(root&&root.document&&root.window===root)}
  function cutoffHz(n){n=clamp(n,0,1);return 80*Math.pow(250,n)}
  function buildTrack(ctx,rack,state){state=mix.normalizeMixerState(state);var input=ctx.createGain(),low=ctx.createBiquadFilter(),mid=ctx.createBiquadFilter(),high=ctx.createBiquadFilter(),filter=ctx.createBiquadFilter(),pan=ctx.createStereoPanner(),dry=ctx.createGain(),sendA=ctx.createGain(),sendB=ctx.createGain();low.type='lowshelf';low.frequency.value=180;low.gain.value=state.eqLow;mid.type='peaking';mid.frequency.value=1000;mid.Q.value=.8;mid.gain.value=state.eqMid;high.type='highshelf';high.frequency.value=6500;high.gain.value=state.eqHigh;filter.type='lowpass';filter.frequency.value=cutoffHz(state.cutoff);filter.Q.value=state.resonance;pan.pan.value=state.pan;dry.gain.value=1;sendA.gain.value=state.sendA;sendB.gain.value=state.sendB;input.connect(low);low.connect(mid);mid.connect(high);high.connect(filter);filter.connect(pan);pan.connect(dry);dry.connect(rack.getInput());pan.connect(sendA);sendA.connect(rack.getSendAInput());pan.connect(sendB);sendB.connect(rack.getSendBInput());return {input:input,pan:pan,filter:filter,dry:dry,sendA:sendA,sendB:sendB}}
  function applyParams(nodes,values,time){values=values||{};try{nodes.dry.gain.setValueAtTime(clamp(values.gain==null?1:values.gain,0,1.5),time);nodes.pan.pan.setValueAtTime(clamp(values.pan==null?0:values.pan,-1,1),time);nodes.filter.frequency.setValueAtTime(cutoffHz(values.cutoff==null?1:values.cutoff),time);nodes.sendA.gain.setValueAtTime(clamp(values.sendA==null?0:values.sendA,0,1),time);nodes.sendB.gain.setValueAtTime(clamp(values.sendB==null?0:values.sendB,0,1),time)}catch(e){}}

  function appState(){var session=root.MPCSequencerV2&&root.MPCSequencerV2.session;if(!session)throw new Error('Séquenceur V2 indisponible');var pi=0;try{pi=Number(patternIndex)||0}catch(e){}var bpm=Number(document.getElementById('bpm').value)||120,mixer=(root.MPCAudioEngineV2&&root.MPCAudioEngineV2.snapshot)?root.MPCAudioEngineV2.snapshot():{mixer:{},fxRack:{}};return {session:session,pattern:session.patterns[pi],patternIndex:pi,bpm:bpm,mixer:mixer.mixer||{},fxRack:mixer.fxRack||{},master:(Number(document.getElementById('master').value)||82)/100,swing:clamp((Number(document.getElementById('swing')&&document.getElementById('swing').value)||0)/100,0,.7),name:document.getElementById('projectName').value||'MPC'}}

  function schedulePattern(pattern,bpm,ids,chains,st,off,offset,swing){
    ids.forEach(function(id){parameterTimeline(pattern,bpm,id,st.mixer[id],swing).forEach(function(pe){var nodes=chains[id];if(nodes)applyParams(nodes,pe.values,offset+pe.time)})});
    eventSchedule(pattern,bpm,ids,swing).forEach(function(ev){var p=pads[ev.padId],nodes=chains[ev.padId];if(!p||!nodes)return;var vol=ev.velocity*(Number(p.gain)||1),pitch=(Number(p.pitch)||0)+ev.pitch,time=offset+ev.time;if(p.sample&&p.sample.kind==='factory')scheduleFactory(FACTORY[p.sample.factoryIndex],off,nodes.input,time,vol,pitch);else if(p.buffer)scheduleUser(Object.assign({},p,{pitch:pitch,loop:false}),off,nodes.input,time,vol)});
  }

  async function renderTracks(ids,options){options=options||{};var st=options.state||appState(),pattern=options.pattern||st.pattern,bpm=options.bpm||st.bpm,duration=patternDurationSeconds(pattern,bpm)+1.2,sampleRate=44100;try{ensureAudio();sampleRate=audioCtx.sampleRate||44100}catch(e){}var off=new OfflineAudioContext(2,Math.ceil(sampleRate*duration),sampleRate),master=off.createGain();master.gain.value=st.master==null?.82:st.master;master.connect(off.destination);var rack=fx.create(off,master,st.fxRack);rack.setBpm(bpm);var chains={};ids.forEach(function(id){chains[id]=buildTrack(off,rack,st.mixer[id])});schedulePattern(pattern,bpm,ids,chains,st,off,0,options.swing==null?st.swing:options.swing);return await off.startRendering()}

  function songTrackIds(session,mixer,timeline){var set=new Set(),patterns=(session&&session.patterns)||[];(timeline&&timeline.segments||[]).forEach(function(seg){audibleTrackIds(patterns[seg.patternIndex],mixer).forEach(function(id){set.add(id)})});return Array.from(set)}
  async function renderSongTracks(ids,options){options=options||{};var st=options.state||appState(),bpm=options.bpm||st.bpm,timeline=buildSongTimeline(st.session,bpm,options.arrangement),duration=timeline.totalDuration+1.2,sampleRate=44100;try{ensureAudio();sampleRate=audioCtx.sampleRate||44100}catch(e){}var off=new OfflineAudioContext(2,Math.max(1,Math.ceil(sampleRate*duration)),sampleRate),master=off.createGain();master.gain.value=st.master==null?.82:st.master;master.connect(off.destination);var rack=fx.create(off,master,st.fxRack);rack.setBpm(bpm);var chains={};ids.forEach(function(id){chains[id]=buildTrack(off,rack,st.mixer[id])});timeline.segments.forEach(function(seg){var p=st.session.patterns[seg.patternIndex],segmentIds=ids.filter(function(id){return (p.tracks[id]||[]).some(function(step){return step&&step.on})});schedulePattern(p,bpm,segmentIds,chains,st,off,seg.offsetSeconds,p.swing&&p.swing.amount!=null?p.swing.amount:st.swing)});return await off.startRendering()}

  function downloadWav(buffer,name){var bytes=audioBufferToWav(buffer),blob=new Blob([bytes],{type:'audio/wav'}),a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=safeFilename(name)+'.wav';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},5000)}
  async function renderMaster(options){var st=(options&&options.state)||appState(),ids=audibleTrackIds(st.pattern,st.mixer);return await renderTracks(ids,Object.assign({},options,{state:st}))}
  async function renderStem(padId,options){var st=(options&&options.state)||appState();return await renderTracks([padId],Object.assign({},options,{state:st}))}
  async function renderSongMaster(options){var st=(options&&options.state)||appState(),timeline=buildSongTimeline(st.session,st.bpm,options&&options.arrangement),ids=songTrackIds(st.session,st.mixer,timeline);return await renderSongTracks(ids,Object.assign({},options,{state:st}))}
  async function renderSongStem(padId,options){var st=(options&&options.state)||appState();return await renderSongTracks([padId],Object.assign({},options,{state:st}))}

  async function renderAllStems(){var st=appState(),ids=audibleTrackIds(st.pattern,st.mixer);if(!ids.length){status('Aucune piste audible à exporter');return}for(var i=0;i<ids.length;i++){var id=ids[i];status('Export stems '+(i+1)+'/'+ids.length+' · '+id);var buf=await renderStem(id,{state:st}),name=st.name+'-'+id+'-'+(pads[id]&&pads[id].name||'track');downloadWav(buf,name);await new Promise(function(r){setTimeout(r,220)})}status(ids.length+' stems WAV exportés')}
  async function renderAllSongStems(){var st=appState(),timeline=buildSongTimeline(st.session,st.bpm),ids=songTrackIds(st.session,st.mixer,timeline);if(!ids.length){status('Aucune piste Song audible à exporter');return}for(var i=0;i<ids.length;i++){var id=ids[i];status('Export stems Song '+(i+1)+'/'+ids.length+' · '+id);var buf=await renderSongStem(id,{state:st}),name=st.name+'-song-'+id+'-'+(pads[id]&&pads[id].name||'track');downloadWav(buf,name);await new Promise(function(r){setTimeout(r,220)})}status(ids.length+' stems Song exportés')}
  async function exportMaster(){try{status('Rendu master Pattern…');var st=appState(),buf=await renderMaster({state:st});downloadWav(buf,st.name+'-master-pattern');status('Master Pattern exporté')}catch(e){status('Export V2 : '+e.message)}}
  async function exportSongMaster(){try{status('Rendu master Song…');var st=appState(),buf=await renderSongMaster({state:st});downloadWav(buf,st.name+'-master-song');status('Master Song exporté')}catch(e){status('Export Song : '+e.message)}}

  function inject(){var btn=document.getElementById('exportWavBtn');if(btn)btn.addEventListener('click',function(e){e.preventDefault();e.stopImmediatePropagation();exportMaster()},true);var bottom=document.querySelector('.bottom');if(bottom&&!document.getElementById('exportStemsBtn')){var b=document.createElement('button');b.id='exportStemsBtn';b.textContent='STEMS PATTERN';b.onclick=function(){renderAllStems().catch(function(e){status('Stems : '+e.message)})};bottom.appendChild(b)}if(bottom&&!document.getElementById('exportSongBtn')){var s=document.createElement('button');s.id='exportSongBtn';s.textContent='MASTER SONG';s.onclick=function(){exportSongMaster()};bottom.appendChild(s)}if(bottom&&!document.getElementById('exportSongStemsBtn')){var ss=document.createElement('button');ss.id='exportSongStemsBtn';ss.textContent='STEMS SONG';ss.onclick=function(){renderAllSongStems().catch(function(e){status('Stems Song : '+e.message)})};bottom.appendChild(ss)}return true}
  function init(){inject()}
  if(canUseBrowser()){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init()}

  return {patternDurationSeconds:patternDurationSeconds,safeFilename:safeFilename,patternHasNotes:patternHasNotes,audibleTrackIds:audibleTrackIds,eventSchedule:eventSchedule,stepBaseParams:stepBaseParams,parameterTimeline:parameterTimeline,defaultSongArrangement:defaultSongArrangement,buildSongTimeline:buildSongTimeline,renderMaster:renderMaster,renderStem:renderStem,renderSongMaster:renderSongMaster,renderSongStem:renderSongStem,renderAllStems:renderAllStems,renderAllSongStems:renderAllSongStems};
});
