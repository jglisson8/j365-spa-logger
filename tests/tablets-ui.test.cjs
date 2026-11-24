const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8').replace('render();calculate();connect();','render();calculate();');
const now=Date.parse('2026-11-23T19:00:00-07:00'),alerts=[];
const dom=new JSDOM(html,{url:'https://spa.test/',runScripts:'dangerously',beforeParse(w){const Real=w.Date;w.Date=class extends Real{constructor(...a){super(...(a.length?a:[now]))}static now(){return now}};w.alert=m=>alerts.push(m);w.confirm=()=>true;w.scrollTo=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};}});
try{
 const w=dom.window,$=id=>w.document.getElementById(id),run=s=>w.eval(s);
 run('write([{id:"fill-fixture-1",type:"water_change",full:true,gallons:395,new_fill_cycle_id:"nov-fill",timestamp:"2026-11-07T16:00"},confirmedTabletEvent("nov-fill")]);render()');
 assert.match($('tabletStatus').textContent,/4 tablets · active/);
 assert.equal($('tabletCyaTrend').hidden,false);assert.match($('tabletCyaDetails').textContent,/entire load dissolves.*20.8 ppm/);assert.match($('tabletCyaDetails').textContent,/nominal.*not individually weighed/);
 $('tabletDate').value='2026-11-22';$('tabletTime').value='16:00';$('tabletMass').value='10';$('saveTabletUpdate').click();$('saveTabletUpdate').click();
 assert.equal(run('read().filter(e=>e.tablet_dispenser?.action==="checkpoint").length'),1);
 $('tabletAction').value='removed';$('tabletDate').value='2026-11-23';$('tabletTime').value='18:00';$('tabletMass').value='15';$('saveTabletUpdate').click();
 assert.match($('tabletStatus').textContent,/removed/);
 assert.equal(run('tabletContext(activeEvents(),Date.now())'),null);
 assert.equal(run('read().find(isTabletStart).amount'),4);
 $('tabletTime').value='18:30';$('tabletCount').value='2';$('tabletWeight').value='10';$('addTabletLoad').click();$('addTabletLoad').click();
 assert.equal(run('read().filter(isTabletStart).length'),2,'A repeated button click cannot add another load');
 assert.equal(run('tabletContext(activeEvents()).active'),true);
 assert.ok(run('activeEvents().filter(isTabletStart).at(-1).tablet_dispenser.tablet_mass_g')===10);
 assert.deepEqual(alerts,[]);
 console.log('PASS: owner dispenser checkpoints/removal/new loads, unknown/verified weights, duplicate guards, actual times and immutable original load');
}finally{dom.window.close();}
