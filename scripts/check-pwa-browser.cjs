// Optional real Chromium smoke test, isolated local server/profile; never private data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.J365_PLAYWRIGHT||'playwright');
const root=path.join(__dirname,'..'),csp="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; img-src 'self' data: blob:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
const allowed={'/':'index.html','/sw.js':'sw.js','/manifest.webmanifest':'manifest.webmanifest','/assets/icon-192.png':'assets/icon-192.png','/assets/icon-512.png':'assets/icon-512.png','/assets/spa-mountain-logo.png':'assets/spa-mountain-logo.png'};
const requests=[];
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;requests.push(p);
 if(p.startsWith('/api/')){res.writeHead(401,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"error":"Test only; not signed in"}');return;}
 const file=allowed[p];if(!file){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':p.endsWith('.png')?'image/png':p.endsWith('.js')?'text/javascript':p.endsWith('.webmanifest')?'application/manifest+json':'text/html','Cache-Control':'no-store','Content-Security-Policy':p==='/sw.js'?"default-src 'none'; script-src 'self'; connect-src 'self'":csp});res.end(fs.readFileSync(path.join(root,file)));
});
(async()=>{if(!process.env.J365_PWA_URL)await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{browser=await chromium.launch({headless:true,...(process.env.J365_CHROMIUM?{executablePath:process.env.J365_CHROMIUM}:{})});const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));context.on('console',m=>{if(m.type()==='error')console.error('Browser:',m.text())});
 const url=process.env.J365_PWA_URL||'http://127.0.0.1:'+server.address().port;await page.goto(url);await page.waitForFunction(()=>document.getElementById('pwaReady')?.textContent.includes('Ready for offline'),{},{timeout:20000}).catch(async e=>{console.error('Offline readiness:',await page.locator('#pwaReady').textContent(),errors,requests,await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();return {active:r?.active?.state,installing:r?.installing?.state,waiting:r?.waiting?.state,caches:await caches.keys()}}));throw e});await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 assert.match(await page.locator('#pwaReady').textContent(),/Ready for offline startup/);
 const client=await context.newCDPSession(page),manifest=await client.send('Page.getAppManifest');assert.equal(manifest.errors.length,0);assert.equal(JSON.parse(manifest.data).display,'standalone');
 const cache=await page.evaluate(async()=>{const key=(await caches.keys()).find(k=>k.startsWith('j365-public-shell-'));return (await(await caches.open(key)).keys()).map(r=>new URL(r.url).pathname)});assert.deepEqual(cache.sort(),Object.keys(allowed).filter(p=>p!='/sw.js').sort());
 const before=await page.evaluate(()=>{localStorage.setItem('pwa-test-only','retained');return localStorage.getItem('j365_spa_events_v2')});
 await context.setOffline(true);await page.reload();await page.waitForSelector('#nextActions');if(await page.evaluate(()=>!navigator.onLine))assert.match(await page.locator('#pwaConnection').textContent(),/Offline/);
 assert.equal(await page.evaluate(()=>localStorage.getItem('pwa-test-only')),'retained');assert.equal(await page.evaluate(()=>localStorage.getItem('j365_spa_events_v2')),before);
 assert.equal(await page.evaluate(()=>fetch('/api/me').then(()=>true,()=>false)),false,'Offline API cannot receive cached response');
 await context.setOffline(false);assert.equal(await page.evaluate(()=>fetch('/api/me').then(r=>r.status)),401);assert.deepEqual(errors,[]);
 console.log('PASS: real Chromium CSP, installation manifest, controlling service worker, exact public cache, fresh offline launch, retained local data and uncached private API');
 }finally{await browser?.close();if(server.listening)server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
