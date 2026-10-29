const {JSDOM}=require('jsdom'),fs=require('node:fs'),assert=require('node:assert/strict');
const harness=require('../app-harness.cjs')(),profile=harness.run('profileById("legacy-acid")'),raw=harness.run('taylorProfileMass(9,395,profileById("legacy-acid"))');
const events=[{id:'fill',type:'water_change',full:true,new_fill_cycle_id:'cycle',gallons:395,timestamp:'2026-09-12T12:00',created_at:'2026-09-12T18:01:00Z',starting_cya_ppm:30,starting_borates_ppm:40}];
for(const day of ['25','26'])events.push(
 {id:'before-'+day,type:'chemistry',timestamp:`2026-10-${day}T12:00`,created_at:`2026-10-${day}T18:00:00Z`,fill_cycle_id:'cycle',ta_ppm:150,ph_bounds:{operator:'>=',value:8},acid_demand_drops:9,acid_demand_target_ph:7.4},
 {id:'dose-'+day,type:'chemical_addition',timestamp:`2026-10-${day}T12:01`,created_at:`2026-10-${day}T18:01:00Z`,fill_cycle_id:'cycle',product:'Leisure Time Spa Down',amount:raw*.69,unit:'grams',product_profile:profile,product_id:profile.id},
 {id:'after-'+day,type:'chemistry',timestamp:`2026-10-${day}T12:25`,created_at:`2026-10-${day}T18:25:00Z`,fill_cycle_id:'cycle',ph:7.4});
const html=fs.readFileSync(require('node:path').join(__dirname,'../../index.html'),'utf8').replace('render();calculate();connect();','render();calculate();');
async function enter(calculated){
 const now=Date.parse('2026-10-29T00:26:00Z'),dom=new JSDOM(html,{url:'https://spa.test/',runScripts:'dangerously',beforeParse(w){const Original=w.Date;w.Date=class extends Original{constructor(...a){super(...(a.length?a:[now]))}static now(){return now}};w.alert=m=>{throw Error(m)};w.confirm=()=>true;w.scrollTo=()=>{};w.localStorage.setItem('j365_spa_events_v2',JSON.stringify(events))}});
 const w=dom.window,$=id=>w.document.getElementById(id),form=$('chemistryForm');
 form.querySelector('.date').value='2026-10-28';form.querySelector('.time').value='18:25';$('ph').value='8plus';$('ta').value='150';$('acidDrops').value='9';$('targetPh').value='7.4';w.eval('calculate()');
 if(calculated){$('useAcid').click();$('calculatedActualAmount').value='6';$('calculatedActualUnit').value='tbsp';$('calculatedAddedAt').value='2026-10-28T18:25';$('confirmActualDose').click();}
 else {w.eval('addDose("Leisure Time Spa Down",6,"tbsp")');$('doses').lastElementChild.querySelector('.doseTime').value='18:25';}
 assert.equal(w.eval('read().length'),events.length,'Draft must not save');
 form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,20));
 const saved=JSON.parse(w.localStorage.getItem('j365_spa_events_v2')),added=saved.filter(e=>!events.some(x=>x.id===e.id)),dose=added.find(e=>e.type==='chemical_addition');
 assert.equal(added.length,2);assert.equal(dose.amount,6);assert.equal(dose.unit,'tbsp');assert.equal(dose.calculation.acid_response_correction.factor,.69);assert.equal(dose.calculation.acid_response_correction.count,2);assert.equal(dose.calculation.acid_response_correction.source,calculated?'stored_calculator':'stored_manual');assert.equal(dose.calculation.acid_response_correction.test_id,added.find(e=>e.type==='chemistry').id);
 const projection=w.eval('balanceProjection(activeEvents(),"ph",Date.now())');assert.ok(Math.abs(projection.current-7.4)<.02);assert.equal(projection.workingBound,true);
 for(const e of events)assert.deepEqual(saved.find(x=>x.id===e.id),JSON.parse(JSON.stringify(e)),'Existing records unchanged');dom.window.close();return projection.current;
}
(async()=>{assert.equal(await enter(false),await enter(true));console.log('PASS: actual manual/calculator forms → draft → one Save freeze equivalent acid context; actual quantity and originals preserved');})().catch(e=>{console.error(e);process.exitCode=1});
