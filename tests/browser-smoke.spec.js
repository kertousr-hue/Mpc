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

  await page.locator('.bigModes [data-mode="sequencing"]').click();
  await expect(page.locator('#grooveboxV2')).toBeVisible();

  for(const bank of ['A','B','C','D']){
    await assertBankReady(page,bank);
    await page.locator('#autoBeatBtn').click();
    await expect.poll(async()=>page.locator('.grooveStep.active').count()).toBeGreaterThan(0);
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
