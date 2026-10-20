// Dependency-free regression: node tests/partial-acid.test.cjs
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
let source=html.match(/<script>([\s\S]*)<\/script>/)[1];
for(const call of ['setupFriendlyUI();','streamlineUI();','setupEnvironmentLogging();setupEvaporationUI();setupWeatherLogging();setupAutomaticForecastChecks();','setupPhIntervalUI();','setupTaIntervalUI();','setupChartBoundsUI();','setupChartScreen();','setupBakingCalculator();','setupActionGuidance();','migrateLegacy();fillNow();render();calculate();connect();'])source=source.replace(call,'');
const storage=new Map(),elements=new Map(),now=Date.parse('2026-10-19T18:00');
class Clock extends Date{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}}
const element=id=>{if(!elements.has(id))elements.set(id,{value:'',checked:false,hidden:false,innerHTML:'',textContent:'',dataset:{},appendChild(){},insertBefore(){},insertAdjacentHTML(_,s){this.innerHTML+=s},addEventListener(){},querySelectorAll(){return []},querySelector(){return {value:'2026-10-19'}},showModal(){},close(){}});return elements.get(id)};
const context={console,Date:Clock,Math,JSON,Number,Set,Map,Error,crypto,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},document:{getElementById:element,querySelectorAll:()=>[],createElement:()=>({...element('generated'),style:{}}),body:{appendChild(){}},head:{appendChild(){}}},setTimeout(){},alert(){},confirm:()=>true,location:{hostname:'localhost'},navigator:{}};
vm.createContext(context);vm.runInContext(source,context);const run=s=>vm.runInContext(s,context);
const fill={id:'fill',type:'water_change',full:true,gallons:395,new_fill_cycle_id:'cycle',timestamp:'2026-09-12T12:00',starting_cya_ppm:30,starting_borates_ppm:40};
const sample={id:'test',type:'chemistry',timestamp:'2026-10-19T17:43',fill_cycle_id:'cycle',ta_ppm:140,ph_bounds:{operator:'>=',value:8},acid_demand_drops:7,acid_demand_target_ph:7.4};
const dose={id:'acid',type:'chemical_addition',timestamp:'2026-10-19T17:44',fill_cycle_id:'cycle',product:'Leisure Time Spa Down',amount:6,unit:'tbsp',calculation:{suggested_amount:20.1,unit:'tsp',measurement_timestamp:sample.timestamp,source_measurements:{ph_bounds:sample.ph_bounds,acid_demand_drops:7,acid_demand_target_ph:7.4}}};
context.fixture=[fill,sample,dose];const snapshot=JSON.stringify(context.fixture);
const project=events=>{context.events=events;return run("balanceProjection(events,'ph',Date.now())")};
const p=project(context.fixture);assert.equal(p.blocked,false);assert.ok(p.current>7.4&&p.current<7.6);assert.equal(p.workingBound,true);assert.equal(p.partialAcid.scenario,true);assert.ok(p.partialAcid.fraction>.895&&p.partialAcid.fraction<.9);assert.match(run('forecastSummary(balanceProjection(fixture,"ph"))'),/Conditional pH scenario/);
const required=run('taylorAcidMass(7,395)'),values=[];
for(const f of [.8999,.9,.9001,.99,.999,1]){const q=project([fill,sample,{...dose,amount:required*f,unit:'grams'}]);assert.equal(q.blocked,false);values.push(q.current)}
assert.ok(values.every((v,i)=>Number.isFinite(v)&&(!i||v<values[i-1])));assert.ok(Math.abs(values[0]-values[2])<.002);assert.equal(values.at(-1),7.4);
// In the bounded scenario, carbon is inferred from the Taylor endpoint and TA;
// pH is solved from alkalinity, not interpolated by the fraction of the dose.
assert.ok(Math.abs(p.current-(p.points[0].v+(7.4-p.points[0].v)*p.partialAcid.fraction))>.001);
const split=project([fill,sample,{...dose,id:'part1',amount:3},{...dose,id:'part2',amount:3,timestamp:'2026-10-19T17:54'}]);assert.ok(Math.abs(split.current-p.current)<1e-8);
const missing=project([fill,{...sample,ta_ppm:undefined},dose]);assert.equal(missing.current,null);assert.match(missing.status,/Partial Taylor response.*above 7.40/);
const inconsistent=project([{...fill,starting_cya_ppm:0,starting_borates_ppm:0},sample,dose]);assert.equal(inconsistent.current,null);assert.match(inconsistent.status,/Partial Taylor response/);
const numeric=project([fill,{...sample,ph:8,ph_bounds:undefined},dose]);assert.ok(Number.isFinite(numeric.current));assert.equal(numeric.partialAcid.scenario,false);
// A finite reported range must contain the inferred starting scenario.
assert.equal(project([fill,{...sample,ph_bounds:{minimum:8,maximum:8.2}},dose]).current,null);
assert.ok(Number.isFinite(project([fill,{...sample,ph_bounds:{minimum:8,maximum:8.4}},dose]).current));
// Never reuse the old Taylor endpoint across a buffer-changing addition.
const disturbed=project([fill,sample,{...dose,id:'part1',amount:3},{id:'baking',type:'chemical_addition',timestamp:'2026-10-19T17:50',fill_cycle_id:'cycle',product:'Baking soda',amount:1,unit:'tbsp'},{...dose,id:'part2',amount:3,timestamp:'2026-10-19T17:54'}]);assert.ok(Number.isFinite(disturbed.current));assert.match(disturbed.status,/Carbonate/);
const retest={id:'retest',type:'chemistry',timestamp:'2026-10-19T17:59',fill_cycle_id:'cycle',ph:7.7,ta_ppm:115};
const reset=project([...context.fixture,retest]);assert.equal(reset.current,7.7);assert.equal(reset.partialAcid,undefined);context.withRetest=[...context.fixture,retest];assert.ok(run("automaticDosePairs(withRetest).some(p=>p.dose.id==='acid'&&p.after?.id==='retest')"));
context.p=p;assert.match(run('projectionSvg(p,e=>Date.parse(e.timestamp),v=>v,p.horizon)'),/data-partial-acid-scenario="true"/);
const history=run("calculatedChartHistory(withRetest,'ph',[{e:fixture[1],v:8,bounded:true},{e:withRetest.at(-1),v:7.7}],Date.parse(fixture[1].timestamp),Date.now())");assert.equal(history.bridges.length,0);assert.equal(history.doseEstimates[0].scenario,true);
assert.equal(JSON.stringify(context.fixture),snapshot,'Original readings, Taylor reference and actual quantity must remain unchanged');
// Personal acid response: known post-dose order without inventing a test time.
const calDose={...dose,id:'6981e4eb-9782-4719-a783-256374be804e',created_at:'2026-10-19T17:44'},calRetest={id:'246b7158-6d40-44a6-b171-cdb7c7f83d2d',type:'chemistry',fill_cycle_id:'cycle',timestamp:'2026-10-19T17:44',created_at:'2026-10-19T18:02',ph:7.3};
context.calEvents=[fill,sample,calDose,calRetest];const calSnapshot=JSON.stringify(context.calEvents);
const cal=run("acidDoseCalibration(calEvents,'2026-10-19T19:00')");assert.equal(cal.factor,.8);assert.equal(cal.count,1);assert.equal(cal.provisional,true);assert.equal(cal.rows[0].confirmed_same_minute,true);
assert.equal(run("acidDoseCalibration(calEvents,'2026-10-19T18:00').factor"),1,'No look-ahead to a result saved later');
const plan=run("acidRecommendation(7,395,calEvents,'2026-10-19T19:00')");assert.equal(plan.reference,required);assert.ok(Math.abs(plan.grams-required*.8)<1e-9);
assert.equal(project(context.calEvents).current,7.3,'Known post-dose test must not have the acid applied a second time');
context.noOrder=[fill,sample,calDose,{...calRetest,id:'unconfirmed'}];assert.equal(run("acidDoseCalibration(noOrder,'2026-10-19T19:00').count"),0,'Do not infer post-dose order merely from save time');
context.disturbed=[...context.calEvents,{id:'intervening-bleach',type:'chemical_addition',timestamp:'2026-10-19T17:43:30',product:'7.5% liquid bleach',amount:.5,unit:'cup'}];assert.equal(run("acidDoseCalibration(disturbed,'2026-10-19T19:00').count"),0);
context.stale=[fill,{...sample,ta_ppm:undefined},{id:'old-ta',type:'chemistry',timestamp:'2026-10-19T15:00',ta_ppm:140,fill_cycle_id:'cycle'},calDose,calRetest];assert.equal(run("acidDoseCalibration(stale,'2026-10-19T19:00').count"),0);
// New evidence is pooled automatically; no calibration button is necessary.
context.more=[...context.calEvents,{...sample,id:'next-test',timestamp:'2026-10-19T18:10'},{...dose,id:'next-dose',timestamp:'2026-10-19T18:11'},{...calRetest,id:'next-retest',timestamp:'2026-10-19T18:31',created_at:'2026-10-19T18:32',ph:7.4}];assert.equal(run("acidDoseCalibration(more,'2026-10-19T19:00').count"),2);assert.equal(run("acidDoseCalibration(more,'2026-10-19T19:00').factor"),.85);
// Future calculator-confirmed doses freeze their correction for endpoint forecasts;
// legacy doses keep their original reference and are not retroactively rewritten.
const corrected=project([fill,sample,{...dose,amount:required*.8,unit:'grams',calculation:{...dose.calculation,acid_response_correction:cal}}]);assert.equal(corrected.current,7.4);assert.match(corrected.status,/Personally corrected Taylor/);
assert.equal(JSON.stringify(context.calEvents),calSnapshot);
// Provisional pH uncertainty exists before any empirical validation gate.
context.windowProjection={kind:'balance',key:'ph',t:now-6*3600000,current:7.42,points:[{t:now-6*3600000,v:7.3,rate:.02}],horizon:now+72*3600000,effects:{ta_band:140},status:'Provisional',assumptions:[]};
const emptyWindow=run("phUncertainty(windowProjection,fixture)");assert.equal(emptyWindow.ready,true);assert.equal(emptyWindow.checks,0);assert.equal(emptyWindow.calibrated,false);assert.ok(emptyWindow.current_band.every(Number.isFinite));assert.ok(emptyWindow.current_band[0]<7.42&&emptyWindow.current_band[1]>7.42);context.emptyWindow=emptyWindow;assert.doesNotMatch(run('phWindowText(emptyWindow)'),/0\/20|collecting data|need 20/);
const originalReviews=run('validForecastReviews');context.originalReviews=originalReviews;context.windowContext=run('phContext(windowProjection,fixture)');
context.relatedRows=[{event:{id:'related-check',timestamp:new Clock(now-3600000).toISOString()},anchor_time:now-5*3600000,error:.1,extrapolated:false,ph_context:{...context.windowContext,ta_band:60,inferred_acid_endpoint:true}}];
run('validForecastReviews=()=>relatedRows');const relatedWindow=run('phUncertainty(windowProjection,fixture)');assert.equal(relatedWindow.checks,1);assert.equal(relatedWindow.close_checks,0);assert.equal(relatedWindow.related_checks,1);assert.ok(relatedWindow.evidence_weight>0&&relatedWindow.evidence_weight<1);
context.consistentRows=Array.from({length:30},(_,i)=>({event:{id:'check-'+i,timestamp:new Clock(now-(i+1)*3600000).toISOString()},anchor_time:now-(i+5)*3600000,error:.05,extrapolated:false,ph_context:context.windowContext}));
run('validForecastReviews=()=>consistentRows');const narrow=run('phUncertainty(windowProjection,fixture)');assert.equal(narrow.ready,true);assert.equal(narrow.calibrated,false);assert.ok(narrow.current_band[1]-narrow.current_band[0]<emptyWindow.current_band[1]-emptyWindow.current_band[0]);
context.surprisingRows=context.consistentRows.map(r=>({...r,error:.8}));run('validForecastReviews=()=>surprisingRows');const wider=run('phUncertainty(windowProjection,fixture)');assert.ok(wider.current_band[1]-wider.current_band[0]>emptyWindow.current_band[1]-emptyWindow.current_band[0]);
// Future, malformed, extrapolated and stale-evidence reviews cannot sneak in.
context.badRows=[{...context.consistentRows[0],error:NaN},{...context.consistentRows[0],extrapolated:true},{...context.consistentRows[0],event:{timestamp:new Clock(now+3600000).toISOString()}},{...context.consistentRows[0],anchor_time:now+3600000}];run('validForecastReviews=()=>badRows');assert.equal(run('phUncertainty(windowProjection,fixture).checks'),0);run('validForecastReviews=originalReviews');
const conditionalWindow=run('phUncertainty({...windowProjection,workingBound:true},fixture)');assert.equal(conditionalWindow.conditional,true);assert.ok(conditionalWindow.current_band[1]-conditionalWindow.current_band[0]>emptyWindow.current_band[1]-emptyWindow.current_band[0]);
assert.equal(run('phUncertainty({...windowProjection,current:null},fixture).ready'),false);
context.windowChecks=run("(()=>{const a={id:'window-fill',type:'water_change',full:true,timestamp:'2026-10-18T10:00',gallons:395,new_fill_cycle_id:'window-fill'},b={id:'window-before',type:'chemistry',timestamp:'2026-10-19T10:00',ph:7.5,ta_ppm:100,fill_cycle_id:'window-fill'},c={id:'window-after',type:'chemistry',timestamp:'2026-10-19T12:00',ph:7.6,fill_cycle_id:'window-fill'};c.forecast_review=automaticForecastReview(c,[a,b]);return [a,b,c]})()");
const frozenReview=JSON.stringify(context.windowChecks[2].forecast_review);assert.equal(run("validForecastReviews(windowChecks,'ph').length"),1);context.editedChecks=context.windowChecks.map(e=>e.id==='window-before'?{...e,ph:7.4}:e);assert.equal(run("validForecastReviews(editedChecks,'ph').length"),0);assert.equal(run('phUncertainty(balanceProjection(editedChecks,"ph"),editedChecks).checks'),0);assert.equal(JSON.stringify(context.windowChecks[2].forecast_review),frozenReview);
const evidenceText=run('phIntervalEvidence(windowChecks)');assert.match(evidenceText,/Spa Down dose learning/);assert.match(evidenceText,/Forecast uncertainty/);assert.doesNotMatch(evidenceText,/need 20|0\/20/);
console.log('PASS: partial acid equilibrium/scenarios, Oct 19 7 drops + 18 tsp, 90% continuity, split doses, fallback, chart markers, calibration pairing and measurement reset');
console.log('PASS: provisional personal dose correction, fresh TA, known same-minute ordering, no look-ahead, confounder exclusion, new evidence updates and frozen future corrections');
console.log('PASS: provisional pH windows from zero checks, weighted related contexts, narrowing/widening, invalid/future review exclusion, conditional labels and separate learning status');
