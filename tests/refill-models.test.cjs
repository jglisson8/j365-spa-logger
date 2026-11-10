const assert=require('node:assert/strict'),{c,run,element}=require('./app-harness.cjs')();
const now=Date.parse('2026-11-08T23:00:00Z');
class Clock extends Date{constructor(...a){super(...(a.length?a:[now]))}static now(){return now}}
c.Date=Clock;
const fill=(id,timestamp,extra={})=>({id,type:'water_change',full:true,gallons:395,new_fill_cycle_id:id,timestamp,...extra});
const reading=(id,fill_cycle_id,timestamp,extra)=>({id,type:'chemistry',fill_cycle_id,timestamp,...extra});
const addition=(id,fill_cycle_id,timestamp,extra)=>({id,type:'chemical_addition',fill_cycle_id,timestamp,...extra});
const old=fill('old-fill','2026-11-05T16:00'),fresh=fill('new-fill','2026-11-07T16:00',{fill_cycle_id:old.id,water_source:'unsoftened'});
const initial=reading('initial-fc',fresh.id,fresh.timestamp,{fc_ppm:0,ch_ppm:180,ta_ppm:210,temperature_f:104});
const dichlor=addition('first-dichlor',fresh.id,'2026-11-07T20:30',{product:'Aqua Doc Dichlor',amount:1,unit:'tbsp'});
const oldTests=[reading('old-test-1',old.id,'2026-11-06T08:00',{fc_ppm:5,ph:7.4}),reading('old-test-2',old.id,'2026-11-06T12:00',{fc_ppm:4})];
c.rows=[dichlor,initial,oldTests[1],fresh,old,oldTests[0]];
const original=JSON.stringify(c.rows);
assert.equal(run('effectiveModelFill(rows[3],rows)'),fresh.id);
assert.ok(run('timelineOrder(rows[3],rows[1])')<0);
assert.equal(run('effectiveModelFill({...rows[1],fill_cycle_id:null},rows)'),fresh.id);
c.noRates=[dichlor,initial,fresh,old];
const fc=run('fcProjection(noRates)');
assert.equal(fc.kind,'insufficient_decay');assert.equal(fc.current,null);assert.equal(fc.measured.v,0);
assert.equal(fc.points[0].kind,'measured');assert.equal(fc.points[1].kind,'theoretical_dose');
assert.ok(Math.abs(fc.theoretical_doses[0].v-5.3)<.05);assert.ok(Math.abs(fc.theoretical_doses[0].cya_delta_ppm-4.8)<.05);
assert.match(fc.status,/not measured.*Insufficient decay calibration/);
const firstForecast=run('fcProjection(rows)');
assert.ok(firstForecast.historical_prior&&firstForecast.current>0);
assert.equal(firstForecast.points[0].kind,'measured');assert.equal(firstForecast.points[0].v,0);
assert.equal(firstForecast.points[1].kind,'theoretical_dose');
assert.ok(Math.abs(firstForecast.points[1].v-5.3)<.05);assert.ok(Math.abs(firstForecast.points[1].cya_delta_ppm-4.8)<.05);
assert.equal(run('chartProjectionValue(fcProjection(rows),modelTime(rows[0])-1000)'),0,'Do not decay or apply the dose before it happened');
assert.ok(firstForecast.current<firstForecast.points[1].v);
assert.equal(firstForecast.historical_prior.local_pairs,0);
assert.equal(run('fcProjection(rows.filter(e=>e.id!=="first-dichlor")).current'),null,'No dose means no forecast from a borrowed rate alone');
c.ramp=run('rows.map(e=>e.id==="new-fill"?{...e,starting_cya_ppm:4.5}:e)');
assert.equal(run('fcProjection(ramp).model.currentCya.band'),5,'Select the decay rate after the addition changed the CYA band');
c.disturbed=[...c.rows,addition('unknown-before-dichlor',fresh.id,'2026-11-07T19:00',{product:'Mystery treatment',amount:1,unit:'tsp'})];
assert.equal(run('fcProjection(disturbed).current'),null,'Do not bridge an unknown addition between the zero and the first sanitizer dose');
assert.equal(run('fcProjection(disturbed).theoretical_doses[0].v'),null,'The sanitizer contribution is not the total after unknown activity');
c.bleachFirst=[...c.rows.slice(1),{...dichlor,product:'7.5% liquid bleach',strength_percent:7.5,amount:2,unit:'fl oz'}];
assert.ok(run('fcProjection(bleachFirst).current')>0);
assert.equal(run('fcProjection(rows.filter(e=>e.id!=="initial-fc")).current'),undefined,'Do not reuse previous-fill FC');
assert.equal(JSON.stringify(c.rows),original);
const oldJet={id:'old-jets',type:'maintenance',activity:'custom',timestamp:'2026-11-07T15:50',fill_cycle_id:old.id,aeration_session:{state:'started',air_on:true}};
for(const session of [oldJet,{...oldJet,aeration_session:undefined,exposure:{kind:'jets',air_on:true,duration_minutes:20,air_on_minutes:10}}]){
 c.withOldJet=[...c.rows,session];
 assert.equal(run('fcProjection(withOldJet).points[1].event_id'),dichlor.id);
 assert.equal(run('fcProjection(withOldJet).current'),firstForecast.current);
 assert.equal(run('elapsedAerationView(withOldJet,Date.now()).find(e=>e.id==="old-jets").exposure.duration_minutes'),10);
 assert.equal(run('jetRetestState(withOldJet,"new-fill",Date.now()).active'),false);
}
element('trendWindow').value='14';run('renderCharts(noRates,{key:"fc_ppm"})');assert.match(element('trendCharts').innerHTML,/data-post-dose-estimate="first-dichlor"/);assert.doesNotMatch(element('trendCharts').innerHTML,/data-chart-trend="future"/);
run('renderCharts(rows,{key:"fc_ppm"})');assert.match(element('trendCharts').innerHTML,/data-post-dose-estimate="first-dichlor"/);assert.match(element('trendCharts').innerHTML,/data-chart-trend="future"/);
const subsequent=[reading('new-fc-1',fresh.id,'2026-11-08T09:00',{fc_ppm:4}),reading('new-fc-2',fresh.id,'2026-11-08T15:00',{fc_ppm:3})];
c.newTests=subsequent;assert.ok(run('fcProjection([...rows,...newTests]).current')>0);
c.nonzero=initial;
assert.equal(run('fcProjection(rows.filter(e=>!e.id.startsWith("old-test")).map(e=>e.id===nonzero.id?{...e,fc_ppm:1}:e)).theoretical_doses[0].v'),null,'A nonzero baseline plus a dose is not a known post-dose total without a decay rate');
const modeled=run('fcProjection(rows.map(e=>e.id===nonzero.id?{...e,fc_ppm:1}:e))');
assert.equal(modeled.points[0].v,1);assert.equal(modeled.points[1].kind,'theoretical_dose');assert.ok(modeled.historical_prior&&Number.isFinite(modeled.current));
const numeric=reading('last-exact-ph',fresh.id,'2026-11-08T11:00',{ph:7.8,ta_ppm:210});
const bounded=reading('bound-ph',fresh.id,'2026-11-08T13:13',{ph_bounds:{operator:'>=',value:8},acid_demand_drops:5,acid_demand_target_ph:7.4});
const dose=addition('partial-acid',fresh.id,'2026-11-08T13:14',{product:'Leisure Time Spa Down',amount:3,unit:'tbsp',calculation:{acid_response_correction:{factor:.69,count:2,provisional:true}}});
c.phRows=[...c.rows,numeric,bounded,dose];const phCopy=JSON.stringify(c.phRows);
const ph=run('balanceProjection(phRows,"ph")');
assert.equal(ph.current,null);assert.equal(ph.sample_bound.value,8);assert.equal(ph.acidDoseContext.correction.factor,.69);
assert.ok(ph.partialAcid.fraction>0&&ph.partialAcid.fraction<1);assert.match(ph.status,/no supported numeric curve/);
assert.equal(ph.points[0].scenario,undefined);assert.ok(ph.conditionalBound?.value>=7.4);
assert.ok(run('lastSupportedPh(phRows,balanceProjection(phRows,"ph")).last_supported_value')>=7.8);
c.repeatedBounds=[...c.phRows,reading('second-bound',fresh.id,'2026-11-08T14:00',{ph_bounds:{operator:'>=',value:8}})];
assert.ok(run('lastSupportedPh(repeatedBounds,balanceProjection(repeatedBounds,"ph")).last_supported_value')>=7.8,'Consecutive bounds do not erase the last supported segment');
run('renderCharts(phRows,{key:"ph"})');const chart=element('trendCharts').innerHTML;
assert.match(chart,/data-sample-kind="8plus"/);assert.match(chart,/data-last-supported-ph/);assert.match(chart,/no supported numeric curve/);assert.equal(JSON.stringify(c.phRows),phCopy);
assert.equal(run('balanceProjection(phRows.slice(0,-1),"ph").current'),null);
const task=run('refillStartupPlan(phRows)');assert.equal(task.tasks.find(t=>t.title==='Calcium hardness').state,'done');
assert.doesNotMatch(task.tasks.find(t=>t.title==='Balance TA and pH').detail,/increaser/);
c.mixed={type:'soak',bathers:1,jet_air_use:'mixed',duration_minutes:20};c.single={...c.mixed,jet_air_use:'air_on'};c.standalone={type:'maintenance',activity:'custom',exposure:{kind:'jets',duration_minutes:20,air_on:true}};
assert.equal(run('aerationMetrics(mixed).seatMinutes'),10);assert.equal(run('aerationMetrics({...mixed,air_on_minutes:8}).seatMinutes'),4);
assert.equal(run('aerationMetrics(single).seatMinutes'),20);assert.equal(run('aerationMetrics(standalone).seatMinutes'),80);
assert.equal(run('aerationMetrics({...single,bathers:6}).seatMinutes'),80);assert.equal(run('aerationMetrics({...mixed,bathers:6}).seatMinutes'),60);
assert.equal(run('aerationGasLevel({...single,jet_air_use:"water_only"})'),.25);
assert.ok(run('aerationGasLevel(standalone)/aerationGasLevel(single)')>1&&run('aerationGasLevel(standalone)/aerationGasLevel(single)')<4);
c.fitRows=[...Array.from({length:2},()=>({hours:1,y:.01,air_by_exponent:[0,0,0]})),...Array.from({length:6},(_,i)=>{const n=i%2?4:1;return {hours:1,y:.01+.1*n**.75,air_by_exponent:[n**.25,n**.5,n**.75]};})];
assert.equal(run('fitAerationExponent(fitRows).exponent'),.75);
// Generate independent numeric observations from a known mass/response mismatch.
const baseline={ta_ppm:150,cya_ppm:0,borates_ppm:0,temperature_f:104};
c.state=baseline;const grams=run('(()=>{const state={...stateArg()};const c=carbonFromPh(7.9,state),q=carbonateTerms(7.4,state);return (state.ta_ppm-50000*(c*q.fraction+q.other))*.7*395*3.78541*120.06/(50000*.95)})();function stateArg(){return globalThis.state}');
const pair=(prefix,fillId,day)=>[
 reading(prefix+'-before',fillId,day+'T09:00',{ph:7.9,ta_ppm:150,temperature_f:104}),
 addition(prefix+'-dose',fillId,day+'T09:01',{product:'Leisure Time Spa Down',amount:grams,unit:'grams',circulation_minutes:10}),
 reading(prefix+'-after',fillId,day+'T09:31',{ph:7.4,temperature_f:104})];
const priorPair=pair('prior',old.id,'2026-11-06'),first=pair('first',fresh.id,'2026-11-08'),second=pair('second',fresh.id,'2026-11-09');
c.fit=[old,...priorPair,fresh,...first,...second];
const prior=run("acidDoseCalibration(fit,'2026-11-07T21:00')"),one=run("acidDoseCalibration(fit,'2026-11-08T13:00')"),two=run("acidDoseCalibration(fit,'2026-11-09T13:00')");
assert.equal(prior.count,0);assert.equal(prior.prior_count,1);assert.ok(prior.factor>.95&&prior.factor<1);
assert.equal(one.count,1);assert.ok(one.factor<prior.factor&&one.factor>.7);assert.ok(one.provisional);assert.equal(two.count,2);assert.ok(two.factor<one.factor&&two.factor>.7);
for(const activity of [
 {type:'maintenance',activity:'custom',exposure:{kind:'jets',duration_minutes:20,air_on:true}},
 {type:'soak',duration_minutes:10,bathers:1},{type:'water_top_off',gallons:2},{type:'chemical_addition',product:'Baking soda',amount:1,unit:'tsp'}
]){
 c.confounded=[...c.fit,{id:'disturbance',timestamp:'2026-11-08T09:10',fill_cycle_id:fresh.id,...activity}];
 assert.equal(run("acidDoseCalibration(confounded,'2026-11-08T13:00').count"),0);
}
c.censored=c.fit.map(e=>e.id==='first-before'?{...e,ph:undefined,ph_bounds:{operator:'>=',value:7.9}}:e);
assert.equal(run("acidDoseCalibration(censored,'2026-11-08T13:00').count"),0);assert.equal(run("acidDoseCalibration(censored,'2026-11-08T13:00').bounded_count"),1);
c.early=c.fit.map(e=>e.id==='first-after'?{...e,timestamp:'2026-11-08T09:08'}:e);
assert.equal(run("acidDoseCalibration(early,'2026-11-08T13:00').count"),0);
for(const id of ['first-before','first-after']){
 c.highFit=c.fit.map(e=>e.id===id?{...e,fc_ppm:12}:e);
 assert.equal(run("acidDoseCalibration(highFit,'2026-11-08T13:00').count"),0,'Known test interference must not train the model');
}
const suspect=reading('high-chlorine-test',fresh.id,'2026-11-08T14:00',{fc_ppm:12,ph:8,ta_ppm:210});
c.high=[fresh,suspect];
const plan=()=>run('refillStartupPlan(high).tasks.find(t=>t.title==="Balance TA and pH")');
assert.equal(plan().state,'wait');assert.match(plan().detail,/interfere/);
assert.equal(run('buildActionPlan(actionContext(high)).cards.some(x=>x.id==="fc-high")'),true);
c.high.push(reading('fc-retest',fresh.id,'2026-11-08T14:15',{fc_ppm:5}));
assert.equal(plan().action,'test','An FC retest does not rehabilitate the earlier interfered pH and TA');
c.high.push(reading('balance-retest',fresh.id,'2026-11-08T14:16',{ph:8,ta_ppm:210}));
assert.equal(plan().action,'acid','Fresh reliable measurements can resume guidance');
const active={...oldJet,id:'new-jets',fill_cycle_id:fresh.id,timestamp:'2026-11-08T14:20'};
const mid=reading('mid-jet-test',fresh.id,'2026-11-08T14:25',{fc_ppm:4,ph:7.3,ta_ppm:210});
c.jets=[fresh,active,mid];
assert.equal(run('buildActionPlan(actionContext(jets)).scenario'),'aeration-active');
assert.match(run('refillStartupPlan(jets).tasks.find(t=>t.title==="Balance TA and pH").detail'),/Finish the active/);
c.jets[1]={...active,aeration_session:undefined,exposure:{kind:'jets',air_on:true,duration_minutes:20}};
assert.equal(run('buildActionPlan(actionContext(jets)).cards.find(x=>x.id==="balance-unknown")?.id'),'balance-unknown');
assert.equal(run('refillStartupPlan(jets).tasks.find(t=>t.title==="Balance TA and pH").action'),'test');
c.jets.push(reading('after-jet-test',fresh.id,'2026-11-08T14:41',{fc_ppm:4,ph:7.7,ta_ppm:210}));
assert.equal(run('refillStartupPlan(jets).tasks.find(t=>t.title==="Balance TA and pH").action'),'acid');
const fold=(offset,utc)=>({timestamp_instant:utc,time_zone:'America/Denver',utc_offset_minutes:offset});
c.foldFills=[fill('first-fold','2026-11-01T01:15',fold(-360,'2026-11-01T07:15:00.000Z')),fill('second-fold','2026-11-01T01:15',fold(-420,'2026-11-01T08:15:00.000Z'))];
run('write(foldFills)');
for(const [utc,cohort] of [['2026-11-01T07:20:00Z','first-fold'],['2026-11-01T08:20:00Z','second-fold']]){
 c.foldTime=Date.parse(utc);
 const saved=run('aerationStartRecord(foldTime,{air_on:true})');
 assert.equal(Date.parse(saved.timestamp_instant),c.foldTime);assert.equal(saved.fill_cycle_id,cohort);
}
console.log('PASS: refill ownership and first dichlor, bounded pH fallback/chart, startup tasks, seat intensity, contextual adaptive acid calibration and confounders');
