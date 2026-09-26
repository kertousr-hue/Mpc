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

  if(testInfo.project.name==='chromium-mobile'){
    const geometry=await page.evaluate(()=>{
      const rect=el=>{const r=el&&el.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}:null};
      const views=document.querySelector('.grooveViews'),toolbar=document.querySelector('.grooveToolbar'),sequencer=document.querySelector('.sequencer'),padPanel=document.querySelector('.padPanel');
      const buttons=Array.from(document.querySelectorAll('.grooveViews button')).map(el=>{
        const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,hit=document.elementFromPoint(cx,cy);
        return {view:el.dataset.view,text:el.textContent,rect:rect(el),hit:hit&&{tag:hit.tagName,className:hit.className,dataView:hit.dataset&&hit.dataset.view,dataId:hit.dataset&&hit.dataset.id}};
      });
      const cs=views?getComputedStyle(views):null,ts=toolbar?getComputedStyle(toolbar):null;
      return {innerWidth:window.innerWidth,views:rect(views),toolbar:rect(toolbar),sequencer:rect(sequencer),padPanel:rect(padPanel),viewsDisplay:cs&&cs.display,viewsColumns:cs&&cs.gridTemplateColumns,toolbarDisplay:ts&&ts.display,buttons};
    });
    console.log('MOBILE_GROOVE_GEOMETRY '+JSON.stringify(geometry));
  }

  for(const view of ['grid','step','mixer','fx','automation','midi']){
    const button=page.locator('.grooveViews [data-view="'+view+'"]');
    await expect(button).toBeVisible();
    await button.click();
  }
  await expect(page.locator('#grooveMidiPanel')).toBeVisible();

  await page.locator('.bigModes [data-mode="creation"]').click();
  await expect(page.locator('#soniloOpenBtn')).toBeVisible();
  await page.locator('#soniloOpenBtn').click();
  await expect(page.locator('#soniloDialog')).toHaveAttribute('open','');
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
