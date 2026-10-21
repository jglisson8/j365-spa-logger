const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../../index.html'),'utf8').replace('render();calculate();connect();','render();calculate();');
const dom=new JSDOM(html,{url:'https://spa.test/',runScripts:'dangerously',beforeParse(w){w.alert=m=>{throw Error(m)};w.scrollTo=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false}}});
const w=dom.window,d=w.document,$=id=>d.getElementById(id);
w.eval('save=(records)=>{globalThis.savedCorrection=records[0]}');
for(const product of ['7.5% liquid bleach','Dichlor','Leisure Time Spa Down','Baking soda','Boric acid','Calcium increaser','Other']){
 for(const unit of ['cup','tbsp','tsp','mL','fl oz','grams','oz by weight']){
  const original={id:'original-dose',type:'chemical_addition',timestamp:'2026-10-16T17:34',product,amount:2,unit:'fl oz',notes:'Keep this note',fill_cycle_id:null};
  w.localStorage.setItem('j365_spa_events_v2',JSON.stringify([original]));w.eval('render()');
  $('history').querySelector('[data-edit]').click();
  assert.equal($('edit-unit').tagName,'SELECT');assert.equal($('edit-unit').value,'fl oz');
  assert.equal($('edit-unit').options.length,7);assert.equal($('edit-product').readOnly,false);
  $('edit-unit').value=unit;$('edit-unit').dispatchEvent(new w.Event('change'));
  assert.equal($('edit-amount').value,'2','Unit selection must not silently alter entered amount');
  $('edit-amount').value='.5';$('editReason').value='Correct actual dose units';
  $('editRecordForm').dispatchEvent(new w.Event('submit',{cancelable:true}));
  assert.equal(w.savedCorrection.amount,.5);assert.equal(w.savedCorrection.unit,unit);
  assert.equal(w.savedCorrection.product,product);assert.equal(w.savedCorrection.notes,original.notes);
  assert.equal(w.savedCorrection.supersedes_event_id,original.id);assert.notEqual(w.savedCorrection.id,original.id);
  assert.equal(w.savedCorrection.timestamp,original.timestamp);
  assert.deepEqual(JSON.parse(w.localStorage.getItem('j365_spa_events_v2')),[original]);
 }
}
// Preserve historical/custom units without forcing a reinterpretation.
w.localStorage.setItem('j365_spa_events_v2',JSON.stringify([{id:'legacy-dose',type:'chemical_addition',timestamp:'2026-10-16T17:34',product:'Other',amount:1,unit:'scoop'}]));w.eval('render()');$('history').querySelector('[data-edit]').click();assert.equal($('edit-unit').value,'scoop');assert.equal($('edit-unit').options.length,8);
w.savedCorrection=null;$('edit-amount').value='3';$('cancelEdit').click();assert.equal(w.savedCorrection,null);assert.equal($('recordEditor').open,false);
// Non-dose records keep their existing editor.
w.localStorage.setItem('j365_spa_events_v2',JSON.stringify([{id:'test',type:'chemistry',timestamp:'2026-10-16T17:33',ph:7,ta_ppm:40}]));w.eval('render()');$('history').querySelector('[data-edit]').click();assert.equal($('edit-unit'),null);assert.equal($('edit-ph').type,'number');
console.log('Dose corrections: all 7 products × 7 units, original preservation, legacy units, cancel and chemistry editor passed');dom.window.close();
