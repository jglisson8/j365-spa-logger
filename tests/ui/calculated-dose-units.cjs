const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../../index.html'),'utf8').replace('render();calculate();connect();','render();calculate();');
const dom=new JSDOM(html,{url:'https://spa.test/',runScripts:'dangerously',beforeParse(w){w.alert=m=>{throw Error(m)};w.scrollTo=()=>{}}});
const w=dom.window,d=w.document,$=id=>d.getElementById(id);
for(const product of ['7.5% liquid bleach','Leisure Time Spa Down','Baking soda']){
 const choices=product.includes('bleach')?['fl oz','tbsp','tsp','cup','mL']:['tsp','tbsp','cup','mL','grams','oz by weight'];
 for(const unit of choices){
  w.localStorage.setItem('j365_spa_events_v2','[]');$('doses').innerHTML='';
  $('chemistryForm').querySelector('.date').value='2026-10-01';$('chemistryForm').querySelector('.time').value='10:00';$('fc').value='1';
  w.productUnderTest=product;w.eval("confirmCalculatedDose(productUnderTest,2,productUnderTest.includes('bleach')?'fl oz':'tsp')");
  $('calculatedActualAmount').value='.5';$('calculatedActualUnit').value=unit;$('calculatedActualUnit').dispatchEvent(new w.Event('change'));
  assert.equal(Number($('calculatedActualAmount').value),.5);
  $('calculatedAddedAt').value='2026-10-01T10:01';$('confirmActualDose').click();
  const row=$('doses').lastElementChild;assert.equal(Number(row.querySelector('.amount').value),.5);assert.equal(row.querySelector('.unit').value,unit);
  assert.equal(w.eval('read().length'),0,'Adding to draft must not save');
  $('chemistryForm').dispatchEvent(new w.Event('submit',{cancelable:true}));
  const saved=JSON.parse(w.localStorage.getItem('j365_spa_events_v2')),dose=saved.find(e=>e.type==='chemical_addition');
  assert.equal(saved.filter(e=>e.type==='chemistry').length,1);assert.equal(saved.filter(e=>e.type==='chemical_addition').length,1);
  assert.equal(dose.amount,.5);assert.equal(dose.unit,unit);assert.equal(dose.product,product);assert.equal(dose.timestamp,'2026-10-01T10:01');
  assert.equal(dose.calculation.suggested_amount,2,'Suggested dose remains separate from actual dose');
 }
}
console.log('Calculated doses: entered amount/unit preserved through draft and final save for bleach, acid and baking soda');dom.window.close();
