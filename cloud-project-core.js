(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MPCCloudProjectCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function normalizeId(value){return typeof value==='string'&&value.trim()?value.trim():null}
  function createCloudProjectState(){return {activeProjectId:null}}
  function saveOperation(activeProjectId){return normalizeId(activeProjectId)?'update':'insert'}
  function setLoadedProject(state,id){if(!state||typeof state!=='object')throw new Error('État Cloud invalide');state.activeProjectId=normalizeId(id);return state.activeProjectId}
  function resetActiveProject(state){if(!state||typeof state!=='object')throw new Error('État Cloud invalide');state.activeProjectId=null;return null}
  return {createCloudProjectState:createCloudProjectState,saveOperation:saveOperation,setLoadedProject:setLoadedProject,resetActiveProject:resetActiveProject};
});
