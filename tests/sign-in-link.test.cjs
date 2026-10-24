const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').replace('render();calculate();connect();','render();calculate();');
const tick=()=>new Promise(r=>setTimeout(r,20));
async function check(url){const alerts=[],dom=new JSDOM(html,{url,runScripts:'dangerously',beforeParse(w){w.scrollTo=()=>{};w.alert=m=>alerts.push(m);w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};}}),w=dom.window,d=w.document,$=id=>d.getElementById(id);await tick();
 const before=w.localStorage.getItem('j365_spa_events_v2'),link=$('appSyncLink');$('syncState').textContent='Local only';await tick();
 if(url.includes('workers.dev')){
   assert.equal(link.tagName,'A');assert.equal(link.getAttribute('href'),'/auth/start');assert.match(link.getAttribute('aria-label'),/sign in with GitHub/);assert.ok(link.classList.contains('is-sign-in'));
   let blocked;link.addEventListener('click',e=>{blocked=e.defaultPrevented;e.preventDefault();});link.click();assert.equal(blocked,false);assert.equal(alerts.length,0);
   $('fc').value='2.7';link.click();assert.equal(blocked,true);assert.match(alerts.at(-1),/Save or finish/);assert.equal($('fc').value,'2.7');assert.equal(w.localStorage.getItem('j365_spa_events_v2'),before);
   $('identity').innerHTML='<a href="/auth/start">Sign in with GitHub</a>';$('identity').querySelector('a').dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));assert.equal(alerts.length,2);
   $('fc').value='';w.eval("addDose('7.5% liquid bleach',.333,'cup')");link.click();assert.equal(blocked,true);assert.equal($('doses').querySelectorAll('.dose-row').length,1);
 }
 $('syncState').textContent='Synced';await tick();assert.equal(link.getAttribute('href'),'#appConnectionSettings');assert.equal(link.classList.contains('is-sign-in'),false);link.click();assert.equal($('appConnectionSettings').open,true);
 if(!url.includes('workers.dev')){$('syncState').textContent='Local only';await tick();assert.equal(link.getAttribute('href'),'#appConnectionSettings');}
 dom.window.close();}
(async()=>{await check('https://j365-spa-sync.jglisson8.workers.dev/');await check('https://jglisson8.github.io/j365-spa-logger/');console.log('PASS: Local only is a GitHub sign-in link, live state changes, saved-data preservation, unsaved test/dose guards and non-Worker settings fallback');})().catch(e=>{console.error(e);process.exitCode=1;});
