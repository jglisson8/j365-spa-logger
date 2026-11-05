const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),harness=require('./app-harness.cjs');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),fast=harness(),plain=harness(new Map(),html.replace('setupUiPerformance();',''));
let now=Date.parse('2026-11-04T19:00:00Z');class Clock extends Date{constructor(...a){super(...(a.length?a:[now]))}static now(){return now}}
const events=[{id:'perf-fill',type:'water_change',full:true,new_fill_cycle_id:'perf-fill',timestamp:'2026-10-20T12:00',gallons:395,starting_cya_ppm:30,starting_borates_ppm:40},...Array.from({length:12},(_,i)=>({id:'perf-sample-'+i,type:'chemistry',fill_cycle_id:'perf-fill',timestamp:`2026-11-${String(1+Math.floor(i/4)).padStart(2,'0')}T${String(1+i%4*5).padStart(2,'0')}:00`,ph:7.2+i*.03,ta_ppm:100,fc_ppm:6-i*.35,interval_confirmation:{no_intervening_activity:true}})),{id:'perf-dose',type:'chemical_addition',fill_cycle_id:'perf-fill',timestamp:'2026-11-03T18:00',product:'7.5% liquid bleach',amount:2,unit:'fl oz'}];
for(const h of [plain,fast]){h.c.Date=Clock;h.storage.set('j365_spa_events_v2',JSON.stringify(events));}
const expressions=['fcProjection(activeEvents(),Date.now())','balanceProjection(activeEvents(),"ph",Date.now())','balanceProjection(activeEvents(),"ta_ppm",Date.now())','buildParameterFramework(activeEvents())'];
for(const expression of expressions)assert.equal(fast.run('JSON.stringify('+expression+')'),plain.run('JSON.stringify('+expression+')'),expression+' exact uncached/cached parity');
// Cache lifetime and independent arrays. No chemistry result survives the root call.
fast.c.calls=0;fast.run('probe=uiPerformanceMemo("probe",x=>{calls++;return x*2});uiPerformanceRun(()=>{probe(3);probe(3)})');assert.equal(fast.c.calls,1);fast.run('probe(3)');assert.equal(fast.c.calls,2);
fast.run('uiPerformanceRun(()=>{const a=read();a.reverse();if(read()[0].id!=="perf-fill")throw Error("Read order leaked")})');
fast.run('uiPerformanceRun(()=>{probe(3);localStorage.setItem(KEY,JSON.stringify([...read(),{id:"new-input",type:"note",timestamp:"2026-11-04T11:00"}]));read();probe(3)})');assert.equal(fast.c.calls,4,'A storage update invalidates the in-operation cache');
assert.throws(()=>fast.run('uiPerformanceRun(()=>{throw Error("interrupted")})'),/interrupted/);assert.equal(fast.run('uiPerformanceContext'),null,'Exception releases cached private inputs');
// Input identity includes audit provenance and does not conflate scenario clones.
fast.run('auditA=[{id:"same"}];auditB=[{id:"same",ph:7.9}];a=[auditA[0]];b=[auditA[0]];Object.defineProperty(a,"acidAudit",{value:auditA});Object.defineProperty(b,"acidAudit",{value:auditB});auditCalls=0;auditProbe=uiPerformanceMemo("audit",()=>++auditCalls);uiPerformanceRun(()=>{auditProbe(a);auditProbe(a);auditProbe(b)})');assert.equal(fast.c.auditCalls,2);
// Saved changes, settings and time shifts each produce a fresh root operation.
for(const h of [plain,fast]){h.element('fcMinimum').value='2';h.storage.set('j365_spa_events_v2',JSON.stringify([...events,{id:'next-test',type:'chemistry',fill_cycle_id:'perf-fill',timestamp:'2026-11-04T11:00',ph:7.4,ta_ppm:110,fc_ppm:5}]));}
now+=3600000;for(const expression of expressions.slice(0,3))assert.equal(fast.run('JSON.stringify('+expression+')'),plain.run('JSON.stringify('+expression+')'));
// Temperature constants are numerically identical to the original equations.
for(const temperature_f of [70,90,104,106])for(const ph of [6.8,7.4,8,8.5]){
 const T=(temperature_f-32)*5/9+273.15,k1=10**(-356.31-.06092*T+21834.4/T+126.834*Math.log10(T)-1684915/(T*T)),k2=10**(-107.887-.032528*T+5151.79/T+38.9256*Math.log10(T)-563713.9/(T*T)),H=10**(-ph),d=H*H+k1*H+k1*k2;
 fast.c.state={temperature_f,borates_ppm:40,cya_ppm:30};fast.c.testPh=ph;const q=fast.run('carbonateTerms(testPh,state)');assert.equal(q.fraction,(k1*H+2*k1*k2)/d);assert.equal(q.other,40/10810/(1+H/10**(-9.24))+30/129070/(1+H/10**(-6.88))+1e-14/H-H);
}
console.log('PASS: exact cached/uncached FC/pH/TA parity, fresh saves/settings/time, audit/scenario isolation, independent reads, exception cleanup and unchanged equilibrium constants');
