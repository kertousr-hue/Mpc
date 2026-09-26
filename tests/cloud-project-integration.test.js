const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('cloud project core loads before app and is cached offline',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const sw=fs.readFileSync('sw.js','utf8');
  assert.ok(html.indexOf('cloud-project-core.js')>=0);
  assert.ok(html.indexOf('cloud-project-core.js')<html.indexOf('app.js'));
  assert.match(sw,/["']\.\/cloud-project-core\.js["']/);
});

test('app updates active cloud project instead of always inserting',()=>{
  const app=fs.readFileSync('app.js','utf8');
  assert.match(app,/MPCCloudProjectCore/);
  assert.match(app,/activeProjectId/);
  assert.match(app,/saveOperation/);
  assert.match(app,/\.eq\(['"]user_id['"],\s*sbUser\.id\)/);
  assert.match(app,/setLoadedProject/);
  assert.match(app,/resetActiveProject/);
});
