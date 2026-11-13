// Mobile WebKit smoke check. All requests are intercepted; no private data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {webkit}=require(process.env.J365_PLAYWRIGHT||'playwright');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
(async()=>{
 const browser=await webkit.launch();
 try{
  const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
  const errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{errors.push(d.message());return d.dismiss();});
  await page.clock.install({time:new Date('2026-11-09T20:00:10Z')});
  await page.route('https://spa.test/**',route=>{
   const req=route.request(),p=new URL(req.url()).pathname;
   if(req.method()!=='GET')writes.push(p);
   if(p==='/')return route.fulfill({body:html,contentType:'text/html'});
   if(p.startsWith('/assets/'))return route.fulfill({path:path.join(root,p)});
   return route.fulfill({status:401,json:{error:'Local test only'}});
  });
  await page.goto('https://spa.test/');
  await page.locator('[data-tab="maintenance"]').click();
  await page.locator('#maintenanceActivity').selectOption('water_change_full');
  const next=page.locator('#fillWizard .wizard-actions button:last-child');
  await next.click();await next.click();
  for(const [id,value] of Object.entries({fillFc:'0',fillPh:'7.3',fillTa:'210',fillCh:'175',fillTemp:'104'}))await page.locator('#'+id).fill(value);
  await page.locator('#saveMaintenance').click();
  await page.locator('[data-startup-go="aerate"]').click();
  await page.locator('#refillAerationMinutes').fill('20');
  await page.locator('#refillStartAeration').click();
  await page.locator('#refillAerationStatus').waitFor({state:'visible'});
  await page.clock.fastForward(300000);
  await page.reload();await page.locator('[data-tab="maintenance"]').click();
  if(!await page.locator('#refillStartup').evaluate(node=>node.open))await page.locator('#refillProgress').click();
  assert.match(await page.locator('#refillAerationStatus').textContent(),/5:0\d.*20 min planned/);
  await page.locator('#refillStopAeration').click();
  const history=await page.evaluate(()=>activeEvents());
  assert.equal(history.filter(e=>e.type==='water_change').length,1);
  assert.equal(history.filter(e=>e.type==='chemistry').length,1);
  const jets=history.filter(e=>e.exposure?.kind==='jets');assert.equal(jets.length,1);
  assert.ok(jets[0].exposure.duration_minutes>=5&&jets[0].exposure.duration_minutes<6);
  assert.equal(jets[0].exposure.aerating_seats,4);
  await page.setViewportSize({width:852,height:393});await page.locator('[data-tab="trends"]').click();
  await page.locator('svg[data-chart-inspect="trendCharts-ph"]').waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  console.log('PASS: mobile WebKit refill → aeration Start → reload → early Finish → pH Trends; no remote writes');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
