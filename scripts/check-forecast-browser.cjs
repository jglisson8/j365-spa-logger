// Real mobile browser release checks. Every request is intercepted; no live data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),engines=require('playwright'),journeys=require('../tests/fixtures/forecast-journeys.cjs');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),names=(process.env.QA_BROWSER||'chromium,webkit').split(','),out=path.join(root,'artifacts','browser');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 for(const name of names){
  assert.ok(['chromium','webkit'].includes(name),'Supported release browser');
  const browser=await engines[name].launch();
  try{for(const journey of journeys){
   const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,serviceWorkers:'block'}),page=await context.newPage(),errors=[],writes=[],unexpected=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{errors.push(d.message());await d.dismiss()});
   await page.clock.install({time:new Date(journey.now)});
   await page.addInitScript(events=>{localStorage.setItem('j365_spa_events_v2',JSON.stringify(events));localStorage.setItem('j365_v1_migrated','1');},journey.events);
   await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());if(req.method()!=='GET')writes.push(url.pathname);
    if(url.origin!=='https://spa.test'){unexpected.push(url.origin);return route.abort();}
    if(url.pathname==='/')return route.fulfill({body:html,contentType:'text/html'});
    if(['/assets/icon-192.png','/assets/icon-512.png','/assets/spa-mountain-logo.png'].includes(url.pathname))return route.fulfill({path:path.join(root,url.pathname)});
    return route.fulfill({status:401,json:{error:'Isolated QA environment'}});
   });
   try{
    await page.goto('https://spa.test/');
    const stored=await page.evaluate(()=>JSON.stringify(read()));
    for(const key of ['fc_ppm','ph','ta_ppm']){
     const expected=journey.expected[key],model=await page.evaluate(key=>{const p=key==='fc_ppm'?fcProjection(activeEvents()):balanceProjection(activeEvents(),key),f=actionContext(activeEvents()).facts[key],name={fc_ppm:'FC',ph:'pH',ta_ppm:'TA'}[key],text=[...document.querySelectorAll('.current-estimates .estimate-value')].find(n=>n.textContent.startsWith(name+':'))?.textContent??'';return {value:p.current,blocked:p.blocked,display:Number.isFinite(f.display_estimate)?f.display_estimate:f.kind!=='unknown'?f.value:null,home:text};},key);
     assert.equal(Number.isFinite(model.value),expected.numeric,name+' '+journey.id+' '+key+' forecast availability');
     if(expected.range)assert.ok(model.value>=expected.range[0]&&model.value<=expected.range[1],name+' '+journey.id+' '+key+' expected range');
     if(Number.isFinite(model.value))assert.ok(Number.isFinite(model.display)&&model.home.includes(model.display.toFixed(key==='ta_ppm'?0:1)),name+' '+journey.id+' '+key+' actual Home readout');
    }
    await page.locator('[data-tab="trends"]').click();
    for(const key of ['fc_ppm','ph','ta_ppm']){
     const button=page.locator('[data-expand-chart="'+key+'"]');if(!await button.count())continue;
     await button.click();await page.locator('#chartViewer').waitFor({state:'visible'});
     await page.waitForFunction(()=>history.state?.spaDialog==='chartViewer');
     const svg=page.locator('#expandedChart svg').first();await svg.waitFor({state:'visible'});
     assert.doesNotMatch(await svg.evaluate(n=>n.outerHTML),/NaN|Infinity|undefined/,name+' '+journey.id+' finite chart');
     await svg.tap();
     await page.waitForFunction(()=>{const text=document.querySelector('#expandedChart .chart-readout')?.textContent??'';return text.trim()&&!text.includes('Drag to inspect');});
     await page.setViewportSize({width:852,height:393});
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' landscape overflow');
     await page.waitForFunction(()=>document.querySelector('#expandedChart svg')?.getBoundingClientRect().height>=100);
     await page.waitForFunction(()=>{const svg=document.querySelector('#expandedChart svg');if(!svg)return false;const r=svg.getBoundingClientRect(),v=svg.viewBox.baseVal;return v.height>0&&r.height>0&&Math.abs((v.width/v.height)/(r.width/r.height)-1)<.2;});
     if(journey.id==='tablet-rounded-acid-and-earlier-ta-anchor')await page.screenshot({path:path.join(out,name+'-'+key+'-landscape.png')});
     await page.locator('#closeChart').click();await page.locator('#chartViewer').waitFor({state:'hidden'});await page.waitForFunction(()=>history.state?.spaDialog!=='chartViewer');await page.setViewportSize({width:393,height:852});
    }
    await page.reload();assert.equal(await page.evaluate(()=>JSON.stringify(read())),stored,name+' '+journey.id+' reload preserves records');
    assert.deepEqual(errors,[],name+' '+journey.id+' browser errors');assert.deepEqual(writes,[],name+' no writes');assert.deepEqual(unexpected,[],name+' no external requests');
    console.log('PASS '+name+' mobile: '+journey.id+' · all forecasts, expansion, touch, landscape, reload');
   }catch(e){await page.screenshot({path:path.join(out,name+'-'+journey.id+'-failure.png')}).catch(()=>{});throw e;}
   finally{await context.close();}
  }}finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1});
