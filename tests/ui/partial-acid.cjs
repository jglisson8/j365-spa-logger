const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../../index.html'),'utf8').replace('render();calculate();connect();','render();calculate();');
const dom=new JSDOM(html,{url:'https://spa.test/',runScripts:'dangerously',beforeParse(w){w.alert=m=>{throw Error(m)};w.scrollTo=()=>{}}});
const w=dom.window,d=w.document,$=id=>d.getElementById(id),now=Date.parse('2026-10-19T18:00');w.Date.now=()=>now;
const fill={id:'fill',type:'water_change',full:true,gallons:395,new_fill_cycle_id:'cycle',timestamp:'2026-09-12T12:00',starting_cya_ppm:30,starting_borates_ppm:40};
const ta={id:'ta',type:'chemistry',timestamp:'2026-10-19T17:24',fill_cycle_id:'cycle',ta_ppm:140};
const sample={id:'test',type:'chemistry',timestamp:'2026-10-19T17:43',fill_cycle_id:'cycle',ph_bounds:{operator:'>=',value:8},acid_demand_drops:7,acid_demand_target_ph:7.4};
const dose={id:'acid',type:'chemical_addition',timestamp:'2026-10-19T17:44',fill_cycle_id:'cycle',product:'Leisure Time Spa Down',amount:6,unit:'tbsp',calculation:{suggested_amount:20.1,unit:'tsp',measurement_timestamp:sample.timestamp,source_measurements:{ph_bounds:sample.ph_bounds,acid_demand_drops:7,acid_demand_target_ph:7.4}}};
const fixture=[fill,ta,sample,dose],original=JSON.stringify(fixture);w.fixture=fixture;w.testNow=now;
const project=events=>{w.caseEvents=events;return w.eval("balanceProjection(caseEvents,'ph',testNow)")};
const p=project(fixture);assert.equal(p.blocked,false);assert.ok(p.current>7.4&&p.current<8);assert.ok(p.partialAcid.fraction>.895&&p.partialAcid.fraction<.9);assert.equal(p.workingBound,true);assert.equal(p.partialAcid.scenario,true);assert.match(p.status,/Conditional partial-acid scenario/);
assert.equal(p.points.at(-1).event_id,dose.id);assert.equal(p.points.at(-1).scenario,true);assert.ok(p.points[0].v>=8);assert.ok(p.points[0].scenario);assert.equal(JSON.stringify(fixture),original,'Never mutate source measurements, calculations or quantities');
// Independently solve TA conservation + endpoint-constrained DIC, not a scaled pH difference.
const state={ta_ppm:140,cya_ppm:30,borates_ppm:40,temperature_f:106,gas_k:0};w.state=state;
const independent=w.eval("(()=>{const required=taylorAcidMass(7,395),requiredChange=theoreticalTaChange({...fixture[3],amount:required,unit:'grams'},fixture),actualChange=theoreticalTaChange(fixture[3],fixture),carbon=carbonFromPh(7.4,{...state,ta_ppm:state.ta_ppm+requiredChange});return {value:phFromCarbon({...state,ta_ppm:state.ta_ppm+actualChange,carbon}),required}})()");
assert.ok(Math.abs(p.current-independent.value)<1e-8);assert.ok(Math.abs(p.current-(p.points[0].v+(7.4-p.points[0].v)*p.partialAcid.fraction))>.001);
// No cliff on either side of 90%; full-reference limit remains continuous.
const fractions=[.8999,.9,.9001,.99,.999,1],values=[];
for(const fraction of fractions){const q=project([...fixture.slice(0,3),{...dose,amount:independent.required*fraction,unit:'grams'}]);assert.equal(q.blocked,false);assert.ok(Number.isFinite(q.current));values.push(q.current);if(fraction<1)assert.ok(q.current>7.4);else assert.equal(q.current,7.4)}
assert.ok(Math.abs(values[0]-values[2])<.002);assert.ok(Math.abs(values.at(-2)-values.at(-1))<.002);assert.ok(values.every((v,i)=>!i||v<values[i-1]));
const split=project([...fixture.slice(0,3),{...dose,id:'half1',amount:3},{...dose,id:'half2',amount:3,timestamp:'2026-10-19T17:54'}]);assert.ok(Math.abs(split.current-p.current)<1e-8);assert.equal(split.points.length,3);
// Numeric samples use their measured initial DIC and actual acid equivalents.
const numeric=[fill,ta,{...sample,ph:8,ph_bounds:undefined},dose],n=project(numeric);w.numeric=numeric;
const numericExpected=w.eval("phFromCarbon({...state,carbon:carbonFromPh(8,state),ta_ppm:140+theoreticalTaChange(numeric[3],numeric)})");assert.ok(Math.abs(n.current-numericExpected)<1e-8);assert.equal(n.partialAcid.scenario,false);
// Missing/contradictory chemistry retains an explicit qualitative partial response.
const missing=project([fill,sample,dose]);assert.equal(missing.current,null);assert.match(missing.status,/Partial Taylor response/);assert.match(missing.status,/above 7.40/);
const conflict=project([{...fill,starting_cya_ppm:0,starting_borates_ppm:0},ta,sample,dose]);assert.equal(conflict.current,null);assert.match(conflict.status,/Partial Taylor response/);
// Later actual samples reset forecasts; the automatic learning pipeline remains intact.
const retest={id:'retest',type:'chemistry',timestamp:'2026-10-19T17:59',fill_cycle_id:'cycle',ph:7.7,ta_ppm:115};
const reset=project([...fixture,retest]);assert.equal(reset.current,7.7);assert.equal(reset.points[0].v,7.7);assert.equal(reset.partialAcid,undefined);w.withRetest=[...fixture,retest];
assert.ok(w.eval("automaticDosePairs(withRetest).some(pair=>pair.dose.id==='acid'&&pair.after?.id==='retest')"));
// Dose curve, legend, inspection and historical marker all identify the scenario.
w.localStorage.setItem('j365_spa_events_v2',JSON.stringify(fixture));w.eval("renderCharts(fixture,{key:'ph'})");
assert.ok($('trendCharts').querySelector('[data-partial-acid-scenario="true"]'));assert.ok($('trendCharts').querySelector('[data-post-dose-estimate="acid"]'));assert.match($('trendCharts').textContent,/Conditional pH scenario/);assert.match($('trendCharts').textContent,/not an exact endpoint/);
w.p=p;const inspected=w.eval("inspectChartValue({key:'ph',plotted:[{e:fixture[2],v:8,bounded:true}],projection:p,start:p.t,end:testNow,history:{doseEstimates:[]}},testNow)");assert.match(inspected.text,/Conditional scenario/);
w.eval("renderCharts(withRetest,{key:'ph'})");assert.ok($('trendCharts').querySelector('[data-post-dose-estimate="acid"]'),'Bounded historical interval retains its conditional dose marker');assert.match($('trendCharts').querySelector('[data-post-dose-estimate="acid"]').textContent,/conditional scenario/);
assert.equal(JSON.stringify(fixture),original);
console.log('Partial acid: Oct 19 7-drop/18-tsp event, nonlinear equilibrium, bounded scenarios, 90% continuity, split doses, missing context, later retests and chart labels passed; conditional pH',p.current.toFixed(3));dom.window.close();
