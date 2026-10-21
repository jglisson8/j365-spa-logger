const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
assert.equal(spawnSync(process.execPath,['scripts/build-pwa.cjs','--check'],{cwd:root,stdio:'inherit'}).status,0);
const manifest=JSON.parse(read('manifest.webmanifest'));
assert.equal(manifest.display,'standalone');assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');assert.equal(manifest.id,'./');assert.equal(manifest.orientation,undefined);
for(const n of [192,512]){const icon=fs.readFileSync(path.join(root,`assets/icon-${n}.png`));assert.equal(icon.readUInt32BE(16),n);assert.equal(icon.readUInt32BE(20),n);assert.ok(manifest.icons.some(i=>i.sizes===`${n}x${n}`));}
assert.match(read('index.html'),/rel="manifest" href="manifest.webmanifest"/);
function workerHarness(version,shared=new Map()){
 const listeners={},context={URL,Response,Request,Promise,Error,self:{registration:{scope:'https://spa.test/'},addEventListener:(name,fn)=>listeners[name]=fn},caches:{keys:async()=>[...shared.keys()],delete:async key=>shared.delete(key),open:async key=>{if(!shared.has(key))shared.set(key,new Map());const cache=shared.get(key);return {put:async(k,v)=>cache.set(k,v.clone()),match:async k=>cache.get(k)?.clone()}}},fetch:async url=>new Response(url==='https://spa.test/'?`const APP_VERSION='${version}'`:url.endsWith('.png')?'icon':'{}',{headers:{'Content-Type':url==='https://spa.test/'?'text/html':url.endsWith('.png')?'image/png':'application/manifest+json'}})};
 vm.createContext(context);vm.runInContext(read('src/sw-template.js').replaceAll('__APP_VERSION__',version),context);
 return {context,shared,install:()=>new Promise((resolve,reject)=>listeners.install({waitUntil:p=>p.then(resolve,reject)})),activate:()=>new Promise((resolve,reject)=>listeners.activate({waitUntil:p=>p.then(resolve,reject)})),fetch:(url,mode='navigate',method='GET')=>{let result=null;listeners.fetch({request:{url,mode,method},respondWith:p=>result=p});return result;}};
}
(async()=>{
 const h=workerHarness('6.51.0');const seen=[];const fetch=h.context.fetch;h.context.fetch=async(url,opts)=>{seen.push(opts);return fetch(url,opts)};
 await h.install();assert.equal(h.shared.get('j365-public-shell-6.51.0').size,5);assert.ok(seen.every(o=>o.credentials==='omit'&&o.redirect==='error'));
 h.context.fetch=async()=>{throw Error('offline')};assert.match(await (await h.fetch('https://spa.test/?launch=home')).text(),/6.51.0/);
 assert.equal((await h.fetch('https://spa.test/assets/icon-192.png','no-cors')).status,200);
 for(const url of ['/api/me','/api/config','/api/events?month=2026-10','/auth/start','/auth/callback?code=private','/api/weather','/other'])assert.equal(h.fetch('https://spa.test'+url),null,url);
 assert.equal(h.fetch('https://untrusted.test/'),null);assert.equal(h.fetch('https://spa.test/','navigate','POST'),null);
 // New cache does not take over or delete the active one during installation.
 const update=workerHarness('6.52.0',h.shared);await update.install();assert.ok(h.shared.has('j365-public-shell-6.51.0'));assert.match(await (await h.fetch('https://spa.test/')).text(),/6.51.0/);
 h.shared.set('other-app-cache',new Map());await update.activate();assert.ok(!h.shared.has('j365-public-shell-6.51.0'));assert.ok(h.shared.has('other-app-cache'));
 const mismatch=workerHarness('6.53.0');mismatch.context.fetch=fetch;await assert.rejects(mismatch.install(),/version mismatch/);assert.equal(mismatch.shared.size,0);
 const failed=workerHarness('6.53.0');failed.context.fetch=async()=>new Response('error',{status:503});await assert.rejects(failed.install());assert.equal(failed.shared.size,0);
 assert.doesNotMatch(read('src/sw-template.js'),/self\.skipWaiting\(|clients\.claim\(/);
 const {servePwaAsset,PWA_ASSETS}=require('../src/pwa-assets.js'),original=global.fetch;
 try{for(const [asset,type]of Object.entries(PWA_ASSETS)){
  global.fetch=async(url,opts)=>{const target=new URL(url);assert.equal(target.origin+target.pathname,'https://jglisson8.github.io/j365-spa-logger'+asset);assert.match(target.search,/^\?public_asset=\d+$/);assert.equal(opts.redirect,'manual');assert.deepEqual(opts.headers,{Accept:type});return new Response(opts.method==='HEAD'?null:'public',{headers:{'Content-Type':type,'Set-Cookie':'no-forward'}})};
  const r=await servePwaAsset(new Request('https://spa.test'+asset+'?url=https://untrusted.test',{headers:{Cookie:'secret',Authorization:'secret'}}));assert.equal(r.status,200);assert.equal(r.headers.get('Set-Cookie'),null);assert.equal(r.headers.get('Service-Worker-Allowed'),asset==='/sw.js'?'/':null);
  assert.equal((await servePwaAsset(new Request('https://spa.test'+asset,{method:'HEAD'}))).status,200);
  assert.equal((await servePwaAsset(new Request('https://spa.test'+asset,{method:'POST'}))).status,405);
 }
 assert.equal((await servePwaAsset(new Request('https://spa.test/api/config'))).status,404);
 for(const status of [302,404,503]){global.fetch=async()=>new Response(null,{status});assert.equal((await servePwaAsset(new Request('https://spa.test/sw.js'))).status,502);}
 global.fetch=async()=>new Response('<html>wrong type</html>',{headers:{'Content-Type':'text/html'}});assert.equal((await servePwaAsset(new Request('https://spa.test/sw.js'))).status,502);
 }finally{global.fetch=original}
 console.log('PASS: installable manifest/icons, credential-free public cache, offline startup, API/auth/weather bypass, safe waiting updates, atomic fetch failures, version mismatch rejection and fixed Worker asset routes');
})().catch(e=>{console.error(e);process.exitCode=1});
