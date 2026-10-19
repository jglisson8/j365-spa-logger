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
console.log('PASS: partial acid equilibrium/scenarios, Oct 19 7 drops + 18 tsp, 90% continuity, split doses, fallback, chart markers, calibration pairing and measurement reset');
