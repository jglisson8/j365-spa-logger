const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const source=fs.readFileSync(path.join(__dirname,'../src/pwa-client.js'),'utf8');
(async()=>{
 const dom=new JSDOM('<div class="status"></div><form><input id="unsaved" value="my draft"></form>',{url:'https://j365-spa-sync.jglisson8.workers.dev/',runScripts:'outside-only'}),w=dom.window;
 const listeners={},reg={active:{},waiting:{},update:async()=>{},addEventListener:(type,fn)=>listeners[type]=fn};let registration;
 Object.defineProperty(w.navigator,'serviceWorker',{value:{register:async(...args)=>{registration=args;return reg},ready:Promise.resolve(reg)}});
 Object.defineProperty(w.navigator,'onLine',{value:false,configurable:true});w.eval(source+';setupPwa()');await new Promise(r=>setImmediate(r));
 assert.equal(registration[0],'sw.js');assert.equal(registration[1].scope,'./');assert.equal(registration[1].updateViaCache,'none');
 assert.match(w.document.getElementById('pwaConnection').textContent,/Offline.*save on this device/);assert.match(w.document.getElementById('pwaReady').textContent,/Ready for offline startup/);
 assert.equal(w.document.getElementById('pwaUpdate').hidden,false);assert.equal(w.document.getElementById('unsaved').value,'my draft');
 let prompted=0;const event=new w.Event('beforeinstallprompt',{cancelable:true});event.prompt=async()=>prompted++;event.userChoice=Promise.resolve({outcome:'accepted'});w.dispatchEvent(event);
 assert.equal(event.defaultPrevented,true);assert.equal(w.document.getElementById('pwaInstall').hidden,false);w.document.getElementById('pwaInstall').click();await new Promise(r=>setImmediate(r));assert.equal(prompted,1);
 w.dispatchEvent(new w.Event('appinstalled'));assert.equal(w.document.getElementById('pwaHelp').hidden,true);
 Object.defineProperty(w.navigator,'onLine',{value:true});w.dispatchEvent(new w.Event('online'));assert.equal(w.document.getElementById('pwaConnection').textContent,'');
 assert.doesNotMatch(source,/\.reload\(|\.skipWaiting\(|\.postMessage\(/);dom.window.close();
 const pages=new JSDOM('<div class="status"></div>',{url:'https://jglisson8.github.io/j365-spa-logger/',runScripts:'outside-only'});pages.window.eval(source+';setupPwa()');assert.equal(pages.window.document.getElementById('pwaStatus'),null);pages.window.close();
 console.log('PASS: secure-origin install prompt, offline/ready status, non-disruptive update notice, unfinished field preserved, online restoration and no registration on public Pages');
})().catch(e=>{console.error(e);process.exitCode=1});
