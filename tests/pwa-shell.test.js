const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

function localAssetsFromHtml(html){
  const out=[];
  for(const m of html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)){
    const src=m[1];
    if(!/^https?:\/\//i.test(src)&&!src.startsWith('//')) out.push('./'+src.replace(/^\.\//,''));
  }
  for(const m of html.matchAll(/<link[^>]+href=["']([^"']+)["'][^>]*>/g)){
    const href=m[1],tag=m[0];
    if(/rel=["']stylesheet["']/i.test(tag)&&!/^https?:\/\//i.test(href)&&!href.startsWith('//')) out.push('./'+href.replace(/^\.\//,''));
  }
  return [...new Set(out)];
}

test('PWA cache is bumped for Raï Real+ and contains every local startup asset',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const sw=fs.readFileSync('sw.js','utf8');
  assert.match(sw,/const CACHE = ['"]mpc-studio-v31-rai-real-plus['"]/);
  const assets=localAssetsFromHtml(html);
  assert.ok(assets.includes('./cloud-project-core.js'));
  assert.ok(assets.includes('./rai-real-kit.js'));
  for(const asset of assets) assert.ok(sw.includes(JSON.stringify(asset)), 'missing from SHELL: '+asset);
});


test('PWA source files do not contain injected literal newline escapes between assets',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const sw=fs.readFileSync('sw.js','utf8');
  assert.doesNotMatch(html,/<\/script>\\n<script/i);
  assert.doesNotMatch(sw,/,\\n\s*["']/);
});
