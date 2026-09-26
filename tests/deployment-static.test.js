const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('Vercel is the sole production deployment workflow',()=>{
  assert.equal(fs.existsSync('.github/workflows/pages.yml'),false);
  const readme=fs.readFileSync('README.md','utf8');
  assert.doesNotMatch(readme,/GitHub Pages|pages\.yml/i);
});
