// Real touch/layout smoke test. Synthetic accounts and chemistry only.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.J365_PLAYWRIGHT||'playwright'),root=path.join(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.J365_CHROMIUM?{executablePath:process.env.J365_CHROMIUM}:{})});try{
 const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true}),errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));
 const now=Date.now(),h=3600000,events=[{id:'fill',type:'water_change',full:true,gallons:395,starting_cya_ppm:30,starting_borates_ppm:40,new_fill_cycle_id:'fill',timestamp:new Date(now-7*24*h).toISOString()},...[24,12,1].map((v,i)=>({id:'test'+i,type:'chemistry',fill_cycle_id:'fill',timestamp:new Date(now-v*h).toISOString(),fc_ppm:5-i,ph:7.4+i*.1,ta_ppm:90}))];
 await page.addInitScript(()=>localStorage.setItem('j365_spa_events_v2','OWNER-SENTINEL'));
 await page.route('https://spa.test/**',async route=>{const u=new URL(route.request().url());calls.push(u.pathname);
  if(u.pathname==='/api/guest/prepare')return route.fulfill({json:{ok:true}});
  if(u.pathname==='/api/guest/redeem'){if(!route.request().postDataJSON().access_code)return route.fulfill({status:403,json:{error:'Enter the access code.'}});assert.equal(route.request().postDataJSON().access_code,'synthetic-code');return route.fulfill({json:{ok:true}});}
  if(u.pathname==='/api/guest/me')return route.fulfill({json:{user:'synthetic-guest',user_id:17,role:'guest',csrf:'test'}});
  if(u.pathname==='/api/guest/context')return route.fulfill({json:{user:'synthetic-guest',expires_at:new Date(now+86400000).toISOString(),products:[],instructions:'Use strips to check the water and log each soak.',config:{schema_version:2,spa:{model:'J-365',volume_gallons:395},current_fill_cycle_id:'fill'},events}});
  if(u.pathname.startsWith('/api/'))return route.fulfill({status:503,json:{error:'Synthetic unavailable'}});
  if(u.pathname.startsWith('/assets/'))return route.fulfill({path:path.join(root,u.pathname)});
  return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,'index.html'),'utf8')});
 });
 await page.goto('https://spa.test/guest#invite=synthetic-invitation');await page.locator('#guestActivation').waitFor({state:'visible'});assert.equal(await page.locator('#guestForm').isVisible(),false);await page.locator('#guestAccessCode').fill('synthetic-code');await page.locator('#guestActivate').click();await page.waitForFunction(()=>document.getElementById('guestInstructions').textContent.includes('Use strips'));assert.equal(await page.locator('#guestActivation').isVisible(),false);assert.equal(await page.locator('#guestAccessCode').inputValue(),'');
 assert.equal(await page.locator('.tabs button:visible').count(),3);assert.equal(await page.locator('#chemistryForm').isVisible(),false);assert.equal(await page.locator('#guestTest').isVisible(),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.equal(await page.locator('#guestKind').isVisible(),false);assert.equal(await page.locator('#guestChooseDose').isDisabled(),true);assert.equal(await page.locator('#guest-ta_ppm').isVisible(),false);assert.equal(await page.locator('#guestAt').isVisible(),false);assert.equal(await page.locator('#guestRefresh').isVisible(),false);
 const activityBoxes=await Promise.all(['Test','Soak','Dose'].map(k=>page.locator('#guestChoose'+k).boundingBox()));assert.ok(Math.max(...activityBoxes.map(b=>b.y))-Math.min(...activityBoxes.map(b=>b.y))<2,'Activity choices must stay in one phone-width row');
 await page.locator('#guestChooseSoak').click();await page.locator('#guestMinutes').fill('0');assert.equal(await page.locator('#guestForm').evaluate(e=>e.checkValidity()),false);await page.locator('#guestChooseTest').click();assert.equal(await page.locator('#guestForm').evaluate(e=>e.checkValidity()),true);await page.locator('#guestOptionalTests summary').click();assert.equal(await page.locator('#guest-ta_ppm').isVisible(),true);await page.locator('#guestOptionalTests summary').click();
 await page.locator('[data-tab="guest-guide"]').click();assert.equal(await page.locator('#tab-guest-guide').isVisible(),true);assert.match(await page.locator('#tab-guest-guide').textContent(),/at least 20 minutes/);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.locator('#guestGuideTest').click();assert.equal(await page.locator('#guestTest').isVisible(),true);
 await page.screenshot({path:'/tmp/j365-guest-phone.png'});
 await page.locator('[data-tab="trends"]').click();await page.locator('[data-expand-chart="ph"]').click();const portrait=await page.locator('#expandedChart svg').boundingBox();assert.ok(portrait.height>400);
 await page.touchscreen.tap(portrait.x+portrait.width*.65,portrait.y+portrait.height*.5);assert.equal(await page.locator('#expandedChart .chart-readout strong').count(),1);
 assert.equal(await page.locator('#expandedChart [data-edit-chart-bound]:enabled').count(),0);
 await page.setViewportSize({width:852,height:393});await page.waitForTimeout(100);const landscape=await page.locator('#expandedChart svg').boundingBox();assert.ok(landscape.height>200);await page.screenshot({path:'/tmp/j365-guest-trends-landscape.png'});
 assert.equal(await page.evaluate(()=>window.localStorage.getItem('j365_spa_events_v2')),'OWNER-SENTINEL');assert.equal(calls.includes('/api/config'),false);assert.deepEqual(errors,[]);
 console.log('PASS: guest phone layout, Instructions/Log/Trends navigation, touch readout, expanded portrait/landscape Trends, readonly limits and owner store isolation');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
