const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8').replace('render();calculate();connect();','render();calculate();'),alerts=[];
const dom=new JSDOM(html,{url:'https://spa.test/',runScripts:'dangerously',beforeParse(w){w.scrollTo=()=>{};w.alert=m=>alerts.push(m);w.confirm=()=>true;}}),w=dom.window,$=id=>w.document.getElementById(id),form=$('chemistryForm');
function testTime(){form.querySelector('.date').value='2026-10-21';form.querySelector('.time').value='00:00';$('fc').value='1.8';}
function open(product,amount,unit){w.product=product;w.suggested=amount;w.unit=unit;w.eval('confirmCalculatedDose(product,suggested,unit)');$('calculatedAddedAt').value='2026-10-21T00:00';}
function submit(){form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));}
const snapshot=()=>w.localStorage.getItem('j365_spa_events_v2');
// Exact reported failure: .333 cup typed, main Save tapped without Add to draft.
testTime();open('7.5% liquid bleach',2.7,'fl oz');$('calculatedActualAmount').value='0.333';$('calculatedActualUnit').value='cup';const before=snapshot();submit();
submit();assert.match(alerts.at(-1),/dose is awaiting confirmation/);assert.equal(snapshot(),before);assert.equal($('fc').value,'1.8');assert.equal($('calculatedActualAmount').value,'0.333');assert.equal($('calculatedActualUnit').value,'cup');assert.match($('draftStatus').textContent,/dose awaiting confirmation/);assert.equal(form.querySelector('button[type=submit]').disabled,false);assert.equal($('calculatedActualAmount').closest('details').open,true);
// Refreshes retain the same input node, values, time and confirm handler.
const input=$('calculatedActualAmount');w.eval('calculate()');assert.equal($('calculatedActualAmount'),input);assert.equal(input.value,'0.333');assert.equal($('calculatedAddedAt').value,'2026-10-21T00:00');assert.equal($('calculatedActualUnit').value,'cup');
// Opening another calculation cannot overwrite or unit-convert a pending dose.
open('Leisure Time Spa Down',3,'tsp');assert.match(alerts.at(-1),/Finish the dose already/);assert.equal($('calculatedActualAmount'),input);assert.equal(input.value,'0.333');assert.equal($('calculatedActualUnit').value,'cup');
$('confirmActualDose').click();assert.equal(snapshot(),before,'Confirmation only stages, never saves');submit();let saved=JSON.parse(snapshot());assert.equal(saved.filter(e=>e.type==='chemistry').length,1);assert.equal(saved.filter(e=>e.type==='chemical_addition').length,1);const bleach=saved.find(e=>e.type==='chemical_addition');assert.equal(bleach.amount,.333);assert.equal(bleach.unit,'cup');assert.equal(bleach.timestamp,'2026-10-21T00:00');assert.equal(bleach.calculation.suggested_amount,2.7);assert.equal($('calculatedActualAmount'),null);
// Cancel is the explicit path for saving just the test. Acid/baking use the
// same safeguard, including an existing manual row that must not save early.
for(const product of ['Leisure Time Spa Down','Baking soda']){
 testTime();open(product,2,'tsp');$('calculatedActualAmount').value='.5';$('calculatedActualUnit').value='tbsp';const existing=snapshot();submit();assert.equal(snapshot(),existing);assert.equal($('calculatedActualAmount').value,'.5');$('cancelActualDose').click();$('cc').value=product==='Baking soda'?'.2':'.1';submit();saved=JSON.parse(snapshot());assert.equal(saved.filter(e=>e.type==='chemical_addition').length,1);
}
testTime();w.eval("addDose('7.5% liquid bleach',1,'tbsp')");open('Baking soda',2,'tsp');const staged=snapshot();submit();assert.equal(snapshot(),staged);assert.equal($('doses').querySelectorAll('.dose-row').length,1);assert.ok($('calculatedActualAmount'));
dom.window.close();console.log('PASS: pending .333-cup dose blocks Save without loss; calculator refresh/replacement protection, confirm+single save, explicit cancel, acid/baking and staged-row atomicity');
