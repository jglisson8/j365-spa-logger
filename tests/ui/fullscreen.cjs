const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../../index.html'),'utf8').replace('render();calculate();connect();','render();calculate();');
(async()=>{
 const dom=new JSDOM(html,{url:'https://spa.test/',runScripts:'dangerously',beforeParse(w){w.scrollTo=()=>{};w.alert=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))}}}),w=dom.window,d=w.document,$=id=>d.getElementById(id);
 let fullscreen=null,locks=0,unlocks=0,exits=0;
 Object.defineProperty(d,'fullscreenElement',{configurable:true,get:()=>fullscreen});
 d.documentElement.requestFullscreen=async()=>{fullscreen=d.documentElement;d.dispatchEvent(new w.Event('fullscreenchange'))};
 d.exitFullscreen=async()=>{exits++;fullscreen=null;d.dispatchEvent(new w.Event('fullscreenchange'))};
 Object.defineProperty(w.screen,'orientation',{configurable:true,value:{lock:async mode=>{assert.equal(mode,'landscape');locks++},unlock:()=>unlocks++}});
 $('chartViewer').showModal();await w.eval('enterChartFullscreen()');assert.equal(fullscreen,d.documentElement);assert.equal(locks,1);assert.equal($('chartFullscreen').textContent,'Exit full screen');
 await w.eval('releaseChartScreen()');assert.equal(fullscreen,null);assert.equal(unlocks,1);assert.equal(exits,1);
 // Unsupported browser fullscreen still leaves an expanded, rotatable dialog.
 delete d.documentElement.requestFullscreen;await w.eval('enterChartFullscreen()');assert.ok($('chartScreenStatus').textContent.includes('Rotate your phone'));assert.equal($('chartViewer').open,true);
 // Orientation rejection is a fallback, not a broken chart or rejected promise.
 d.documentElement.requestFullscreen=async()=>{fullscreen=d.documentElement};w.screen.orientation.lock=async()=>{throw Error('unsupported')};await w.eval('enterChartFullscreen()');assert.ok($('chartScreenStatus').textContent.includes('Rotate your phone'));await w.eval('releaseChartScreen()');assert.equal(fullscreen,null);
 // Closing a chart must not exit fullscreen owned by some other user action.
 fullscreen=d.documentElement;const previousExits=exits;await w.eval('releaseChartScreen()');assert.equal(exits,previousExits);fullscreen=null;
 assert.ok($('chartRangeControls').contains($('chartStart')));assert.ok($('chartRangeControls').contains($('chartZoomIn')));assert.equal($('chartRangeControls').open,false);
 assert.equal($('trendActivity').checked,true);
 // Expanded mode must not hide paused/conditional/extrapolated forecast warnings.
 $('expandedChart').innerHTML='<div class="trend-card"><h3>Title</h3><p class="help chart-targets">Alerts 1–10</p><p class="help chart-warning" role="status">Estimate paused: insufficient data</p></div>';
 assert.notEqual(w.getComputedStyle(d.querySelector('#expandedChart .chart-warning')).display,'none');
 // Target lines/key remain on the plot; the verbose summary is available in
 // Custom / info rather than consuming a separate row of the expanded screen.
 assert.equal(w.getComputedStyle(d.querySelector('#expandedChart .chart-targets')).display,'none');
 assert.equal($('chartViewer').style.padding,'');assert.equal($('chartViewer').style.overflow,'');
 assert.match($('chartFullscreen').getAttribute('aria-label'),/full screen/i);
 dom.window.close();console.log('Fullscreen, landscape fallback, ownership cleanup and compact chart controls passed');
})().catch(e=>{console.error(e);process.exitCode=1});
