const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom'),html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8').replace('render();calculate();connect();','render();calculate();');
const tick=()=>new Promise(r=>setTimeout(r,20));
function create({touch=true,vv=true}={}){
 let scrolled=0,scrolls=[];
 const dom=new JSDOM(html,{url:'https://spa.test/',runScripts:'dangerously',beforeParse(w){
  Object.defineProperty(w.navigator,'maxTouchPoints',{value:touch?5:0});Object.defineProperty(w,'innerWidth',{value:393,writable:true});Object.defineProperty(w,'innerHeight',{value:852,writable:true});
  if(vv){const viewport=new w.EventTarget();Object.assign(viewport,{height:852,offsetTop:0,scale:1});Object.defineProperty(w,'visualViewport',{value:viewport});}
  w.scrollTo=()=>{};w.scrollBy=options=>{scrolled+=options.top;scrolls.push(options.top)};w.alert=()=>{};
  w.HTMLElement.prototype.getClientRects=function(){if(this.closest('[hidden]'))return [];for(let p=this.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS'&&!p.open)return [];return [{}]};
  w.HTMLElement.prototype.getBoundingClientRect=function(){const top=Number(this.dataset?.mockTop??120)-scrolled,height=this.id==='mobileInputBar'?48:44;return {top,bottom:top+height,height,width:360,left:0,right:360}};
 }});return {dom,w:dom.window,$:id=>dom.window.document.getElementById(id),scrolls};
}
(async()=>{
 const {dom,w,$,scrolls}=create(),raw=w.localStorage.getItem('j365_spa_events_v2');$('fc').value='3.25';$('fc').focus();await tick();assert.equal($('mobileInputBar').hidden,true,'Focus without keyboard must not hide navigation');
 $('fc').dataset.mockTop='650';w.visualViewport.height=500;w.visualViewport.dispatchEvent(new w.Event('resize'));await tick();
 assert.equal($('mobileInputBar').hidden,false);assert.equal($('mobileInputBar').style.bottom,'352px');assert.equal(w.getComputedStyle(w.document.querySelector('.tabs')).display,'none');assert.equal(w.getComputedStyle(w.document.querySelector('.save-bar')).display,'none');assert.ok(scrolls[0]>0);
 const count=scrolls.length;w.visualViewport.dispatchEvent(new w.Event('scroll'));await tick();assert.equal(scrolls.length,count,'Do not keep recentering an already visible field');
 w.visualViewport.offsetTop=40;w.visualViewport.dispatchEvent(new w.Event('resize'));await tick();assert.equal($('mobileInputBar').style.bottom,'312px','Track the panned iOS visual viewport');w.visualViewport.offsetTop=0;
 $('mobileInputNext').click();await tick();assert.equal(w.document.activeElement.id,'ta','Skip native selectors and fields in closed details');$('mobileInputPrevious').click();await tick();assert.equal(w.document.activeElement.id,'fc');assert.equal($('fc').value,'3.25');
 const enter=new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});$('fc').dispatchEvent(enter);await tick();assert.equal(enter.defaultPrevented,true);assert.equal(w.document.activeElement.id,'ta','Enter advances, never submits a test');
 $('mobileInputDone').click();await tick();assert.equal($('mobileInputBar').hidden,true);assert.equal(w.document.body.classList.contains('keyboard-open'),false);assert.notEqual(w.getComputedStyle(w.document.querySelector('.save-bar')).display,'none');
 // Android-style layout resize: no inset, and no expensive chart redraw.
 $('fc').focus();w.innerHeight=500;w.visualViewport.height=500;w.eval('keyboardChartCalls=0;requestUiCharts=()=>keyboardChartCalls++');w.dispatchEvent(new w.Event('resize'));await tick();assert.equal($('mobileInputBar').style.bottom,'0px');assert.equal(w.keyboardChartCalls,0);
 w.innerWidth=852;w.innerHeight=220;w.visualViewport.height=220;w.dispatchEvent(new w.Event('resize'));await tick();assert.equal($('mobileInputBar').hidden,false,'Rotation keeps controls usable');assert.equal($('fc').value,'3.25');w.innerWidth=393;w.innerHeight=500;w.visualViewport.height=500;w.dispatchEvent(new w.Event('resize'));await tick();
 // The native Back/keyboard-dismiss action restores the app even if focus stays.
 w.innerHeight=852;w.visualViewport.height=852;w.visualViewport.dispatchEvent(new w.Event('resize'));await tick();assert.equal($('mobileInputBar').hidden,true);assert.equal($('fc').value,'3.25');
 // Pinch zoom is not a keyboard, and readonly/native picker fields are excluded.
 w.visualViewport.height=500;w.visualViewport.scale=2;w.visualViewport.dispatchEvent(new w.Event('resize'));await tick();assert.equal($('mobileInputBar').hidden,true);w.visualViewport.scale=1;
 $('ph').focus();w.visualViewport.dispatchEvent(new w.Event('resize'));await tick();assert.equal($('mobileInputBar').hidden,true);
 // Dynamically inserted dose/settings inputs receive the right keyboard hints.
 const dialog=w.document.createElement('dialog');dialog.open=true;dialog.innerHTML='<form><label for="keyboard-dose">Dose</label><input id="keyboard-dose" type="number" step="any" value="0.333"><input type="text" readonly value="skip"><textarea id="keyboard-notes"></textarea></form>';w.document.body.append(dialog);await tick();const dose=$('keyboard-dose');assert.equal(dose.inputMode,'decimal');dose.focus();await tick();assert.equal($('mobileInputBar').parentElement,dialog,'Controls must stay in the modal top layer');assert.equal($('mobileInputLabel').textContent,'Dose');
 $('mobileInputNext').click();await tick();assert.equal(w.document.activeElement.id,'keyboard-notes','Skip readonly fields');const newline=new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});$('keyboard-notes').dispatchEvent(newline);assert.equal(newline.defaultPrevented,false,'Notes retain multiline entry');
 $('mobileInputDone').click();await tick();assert.equal(dialog.open,true);assert.equal(dose.value,'0.333');assert.equal(w.localStorage.getItem('j365_spa_events_v2'),raw);dom.window.close();
 const fallback=create({vv:false});fallback.$('fc').focus();fallback.w.innerHeight=500;fallback.w.dispatchEvent(new fallback.w.Event('resize'));await tick();assert.equal(fallback.$('mobileInputBar').hidden,false);fallback.$('mobileInputDone').click();fallback.dom.window.close();
 const desktop=create({touch:false});desktop.$('fc').focus();desktop.w.visualViewport.height=500;desktop.w.visualViewport.dispatchEvent(new desktop.w.Event('resize'));await tick();assert.equal(desktop.$('mobileInputBar').hidden,true);desktop.dom.window.close();
 console.log('PASS: iOS overlay/Android resize/fallback, minimal scrolling, Next/Previous/Done, no implicit save, Back dismissal, native picker/zoom/desktop isolation, dynamic units/notes/modal controls and unchanged records');
})().catch(e=>{console.error(e);process.exitCode=1});
