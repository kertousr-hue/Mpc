const test=require('node:test');
const assert=require('node:assert/strict');
const cloud=require('../cloud-project-core.js');

test('cloud project state starts in insert mode',()=>{
  const state=cloud.createCloudProjectState();
  assert.deepEqual(state,{activeProjectId:null});
  assert.equal(cloud.saveOperation(state.activeProjectId),'insert');
});

test('loaded cloud project switches save operation to update',()=>{
  const state=cloud.createCloudProjectState();
  cloud.setLoadedProject(state,'project-123');
  assert.equal(state.activeProjectId,'project-123');
  assert.equal(cloud.saveOperation(state.activeProjectId),'update');
});

test('reset returns cloud project state to insert mode',()=>{
  const state=cloud.createCloudProjectState();
  cloud.setLoadedProject(state,'project-123');
  cloud.resetActiveProject(state);
  assert.equal(state.activeProjectId,null);
  assert.equal(cloud.saveOperation(state.activeProjectId),'insert');
});

test('empty identifiers never select update mode',()=>{
  for(const id of [null,undefined,'','   ',0,false]) assert.equal(cloud.saveOperation(id),'insert');
});
