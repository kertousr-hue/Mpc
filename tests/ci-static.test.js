const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('CI installs Playwright and runs desktop/mobile browser smoke',()=>{
  const workflow=fs.readFileSync('.github/workflows/check.yml','utf8');
  assert.match(workflow,/npm install --no-audit --no-fund/);
  assert.match(workflow,/playwright install --with-deps chromium/);
  assert.match(workflow,/npm run test:browser/);
  assert.match(workflow,/node --check cloud-project-core\.js/);
  assert.match(workflow,/node --check playwright\.config\.js/);
  assert.match(workflow,/node --check sw\.js/);
  assert.match(workflow,/python -m py_compile vst_bridge_core\.py/);
});
