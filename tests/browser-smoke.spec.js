const {test,expect}=require('@playwright/test');

async function openApp(page){
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(String(error)));
  await page.route('https://cdn.jsdelivr.net/**',route=>route.abort());
  await page.goto('/');
  await expect(page.locator('.pad')).toHaveCount(16);
  await page.waitForFunction(()=>window.MPCSequencerV2&&document.querySelector('.grooveViews [data-view="midi"]'));
  return pageErrors;
}

async function assertBankReady(page,bank){
  await page.locator('#banks [data-bank="'+bank+'"]').click();
  await expect(page.locator('.pad')).toHaveCount(16);
  const names=await page.locator('.pad .name').allTextContents();
  expect(names).toHaveLength(16);
  expect(names.every(name=>name.trim().length>0)).toBeTruthy();
}

test('MPC Studio raï workflow works in desktop and mobile browsers',async({page},testInfo)=>{
  const pageErrors=await openApp(page);

  for(const bank of ['A','B','C','D']) await assertBankReady(page,bank);

  for(const bank of ['A','B','C','D']){
    await page.locator('.bigModes [data-mode="creation"]').click();
    await assertBankReady(page,bank);
    await expect(page.locator('#autoBeatBtn')).toBeVisible();
    await page.locator('#autoBeatBtn').click();

    await page.locator('.bigModes [data-mode="sequencing"]').click();
    await expect(page.locator('#grooveboxV2')).toBeVisible();
    await expect.poll(async()=>page.locator('.grooveStep.active').count()).toBeGreaterThan(0);
  }

  for(const id of ['grooveStepEditor','grooveMixerPanel','grooveFxPanel','grooveAutomationPanel','grooveMidiPanel']){
    await expect(page.locator('#'+id)).toBeHidden();
  }
  for(const view of ['grid','step','mixer','fx','automation','midi']){
    const button=page.locator('.grooveViews [data-view="'+view+'"]');
    await expect(button).toBeVisible();
    await button.click();
    if(testInfo.project.name==='chromium-mobile'&&view==='step'){
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const shift=await page.evaluate(()=>{
        const info=selector=>{
          const el=document.querySelector(selector),r=el&&el.getBoundingClientRect();
          if(!r)return null;
          const cx=r.left+r.width/2,cy=r.top+r.height/2,hit=document.elementFromPoint(cx,cy);
          return {rect:{x:r.x,y:r.y,w:r.width,h:r.height},hit:hit&&{tag:hit.tagName,cls:hit.className,view:hit.dataset&&hit.dataset.view,id:hit.dataset&&hit.dataset.id}};
        };
        return {
          scrollY:window.scrollY,
          innerHeight:window.innerHeight,
          docHeight:document.documentElement.scrollHeight,
          views:info('.grooveViews'),
          step:info('.grooveViews [data-view="step"]'),
          mixer:info('.grooveViews [data-view="mixer"]'),
          padD15:info('.pad[data-id="D15"]'),
          grooveGrid:{hidden:document.getElementById('grooveGrid').hidden,display:getComputedStyle(document.getElementById('grooveGrid')).display},
          stepEditor:{hidden:document.getElementById('grooveStepEditor').hidden,display:getComputedStyle(document.getElementById('grooveStepEditor')).display}
        };
      });
      console.log('MOBILE_AFTER_STEP_SHIFT '+JSON.stringify(shift));
    }
  }
  await expect(page.locator('#grooveMidiPanel')).toBeVisible();

  await page.locator('.bigModes [data-mode="creation"]').click();
  await expect(page.locator('#soniloOpenBtn')).toBeVisible();
  await page.locator('#soniloOpenBtn').click();
  await expect(page.locator('#soniloDialog')).toHaveAttribute('open','');
  if(testInfo.project.name==='chromium-mobile'){
    const modalGeometry=await page.evaluate(()=>{
      const describe=id=>{
        const el=document.getElementById(id),r=el&&el.getBoundingClientRect();
        if(!r)return null;
        const cx=r.left+r.width/2,cy=r.top+r.height/2,hit=document.elementFromPoint(cx,cy),cs=getComputedStyle(el);
        return {rect:{x:r.x,y:r.y,w:r.width,h:r.height},position:cs.position,zIndex:cs.zIndex,pointerEvents:cs.pointerEvents,hit:hit&&{tag:hit.tagName,id:hit.id,cls:hit.className}};
      };
      return {close:describe('soniloClose'),dialog:describe('soniloDialog'),card:(()=>{const el=document.querySelector('#soniloDialog .soniloCard'),r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})(),head:(()=>{const el=document.querySelector('#soniloDialog .dialogHead'),r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()};
    });
    console.log('MOBILE_SONILO_CLOSE_GEOMETRY '+JSON.stringify(modalGeometry));
  }
  await page.locator('#soniloClose').click();

  await expect(page.locator('#vstOpenBtn')).toBeVisible();
  await page.locator('#vstOpenBtn').click();
  await expect(page.locator('#vstDialog')).toHaveAttribute('open','');
  await page.locator('#vstClose').click();

  if(testInfo.project.name==='chromium-mobile'){
    await expect(page.locator('#playBtn')).toBeVisible();
    await expect(page.locator('#banks [data-bank="A"]')).toBeVisible();
    await expect(page.locator('.bigModes [data-mode="sampling"]')).toBeVisible();
  }

  expect(pageErrors).toEqual([]);
});
