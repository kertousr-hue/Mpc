const {defineConfig}=require('@playwright/test');

module.exports=defineConfig({
  testDir:'./tests',
  testMatch:'browser-smoke.spec.js',
  fullyParallel:false,
  workers:1,
  retries:0,
  use:{
    baseURL:'http://127.0.0.1:4173',
    trace:'retain-on-failure'
  },
  webServer:{
    command:'python -m http.server 4173 --bind 127.0.0.1',
    url:'http://127.0.0.1:4173',
    reuseExistingServer:false
  },
  projects:[
    {
      name:'chromium-desktop',
      use:{browserName:'chromium',viewport:{width:1440,height:900}}
    },
    {
      name:'chromium-mobile',
      use:{browserName:'chromium',viewport:{width:412,height:915},isMobile:true,hasTouch:true}
    }
  ]
});
