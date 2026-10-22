// Isolated mutable-origin update test: synthetic local data, no accounts.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.J365_PLAYWRIGHT||'playwright'),root=path.join(__dirname,'..');
let version='update-test-a';
const files={'/':'index.html','/manifest.webmanifest':'manifest.webmanifest','/assets/icon-192.png':'assets/icon-192.png','/assets/icon-512.png':'assets/icon-512.png','/assets/spa-mountain-logo.png':'assets/spa-mountain-logo.png'};
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;
 if(p.startsWith('/api/')){res.writeHead(401,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"error":"Synthetic test only"}');return;}
 if(p==='/sw.js'){res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});res.end(fs.readFileSync(path.join(root,'src/sw-template.js'),'utf8').replaceAll('__APP_VERSION__',version));return;}
 if(!files[p]){res.writeHead(404);res.end();return;}let body=fs.readFileSync(path.join(root,files[p]));if(p==='/')body=body.toString().replace(/const APP_VERSION='[^']+'/,"const APP_VERSION='"+version+"'");
 res.writeHead(200,{'Content-Type':p==='/'?'text/html':p.endsWith('.png')?'image/png':'application/manifest+json','Cache-Control':'no-store'});res.end(body);
});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{browser=await chromium.launch({headless:true,...(process.env.J365_CHROMIUM?{executablePath:process.env.J365_CHROMIUM}:{})});const context=await browser.newContext(),page=await context.newPage(),url='http://127.0.0.1:'+server.address().port,errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
 await page.waitForFunction(()=>document.getElementById('pwaReady')?.textContent.includes('Ready for offline'));
 await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 const before=await page.evaluate(()=>{localStorage.setItem('update-test-probe','retained');return localStorage.getItem('j365_spa_events_v2');});
 const other=await context.newPage();await other.goto(url);await other.waitForFunction(()=>!!navigator.serviceWorker.controller);
 version='update-test-b';await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});await page.waitForSelector('#pwaUpdate:not([hidden])');
 await page.locator('#fc').fill('1.9');await page.locator('#pwaUpdateNow').click();assert.match(await page.locator('#pwaUpdateText').textContent(),/unsaved/);assert.equal(await page.locator('#fc').inputValue(),'1.9');assert.equal(await page.evaluate(()=>APP_VERSION),'update-test-a');
 await page.locator('#fc').fill('');await page.locator('[data-tab="maintenance"]').click();await page.locator('#appConnectionSettings > summary').click();await page.locator('#pwaServiceUpdate').click();await page.waitForFunction(()=>document.getElementById('pwaUpdateText').textContent.includes('Close other'));
 assert.equal(await page.evaluate(()=>APP_VERSION),'update-test-a');await other.close();
 await page.locator('#pwaUpdateNow').focus();await Promise.all([page.waitForNavigation(),page.keyboard.press('Enter')]);assert.equal(await page.evaluate(()=>APP_VERSION),'update-test-b');assert.equal(await page.evaluate(()=>localStorage.getItem('update-test-probe')),'retained');assert.equal(await page.evaluate(()=>localStorage.getItem('j365_spa_events_v2')),before);
 await context.setOffline(true);await page.reload();assert.equal(await page.evaluate(()=>APP_VERSION),'update-test-b');assert.equal(await page.evaluate(()=>localStorage.getItem('update-test-probe')),'retained');assert.deepEqual(errors,[]);
 console.log('PASS: real waiting-worker update blocked by draft and second window; explicit activation/reload, retained records and new-version offline startup');
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
