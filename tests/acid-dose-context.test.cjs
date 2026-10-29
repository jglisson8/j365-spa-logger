const assert=require('node:assert/strict'),h=require('./app-harness.cjs')(),{c,run}=h;
const now=Date.parse('2026-10-29T00:26:00Z');class Clock extends Date{constructor(...a){super(...(a.length?a:[now]))}static now(){return now}}c.Date=Clock;
const profile=run("profileById('legacy-acid')"),raw=run('taylorProfileMass(9,395,profileById("legacy-acid"))'),stamp=ts=>new Date(run('SpaTime.parse('+JSON.stringify(ts)+')')).toISOString();
const fill={id:'context-fill',type:'water_change',timestamp:'2026-09-12T12:00',created_at:stamp('2026-09-12T12:01'),full:true,gallons:395,new_fill_cycle_id:'context-fill',starting_cya_ppm:30,starting_borates_ppm:40};
function sample(id,ts){return {id,type:'chemistry',fill_cycle_id:fill.id,timestamp:ts,created_at:stamp(ts),ph_bounds:{operator:'>=',value:8},ta_ppm:150,acid_demand_drops:9,acid_demand_target_ph:7.4}}
function acid(id,ts,amount=6,unit='tbsp'){return {id,type:'chemical_addition',fill_cycle_id:fill.id,timestamp:ts,created_at:stamp(ts),product:'Leisure Time Spa Down',product_id:profile.id,product_profile:JSON.parse(JSON.stringify(profile)),amount,unit}}
const history=[fill];for(const day of ['25','26']){const before=sample('before-'+day,'2026-10-'+day+'T12:00'),dose=acid('cal-dose-'+day,'2026-10-'+day+'T12:01',raw*.69,'grams'),after={id:'after-'+day,type:'chemistry',fill_cycle_id:fill.id,timestamp:'2026-10-'+day+'T12:25',created_at:stamp('2026-10-'+day+'T12:25'),ph:7.4};history.push(before,dose,after);}
const before=sample('oct28-before','2026-10-28T18:25'),dose={...acid('oct28-manual','2026-10-28T18:25'),test_before_dose_id:before.id};c.fixture=[...history,before,dose];
const plan=run('acidRecommendation(9,395,fixture,fixture.at(-1).timestamp,profileById("legacy-acid"))');assert.equal(plan.correction.factor,.69);assert.equal(plan.correction.count,2);assert.ok(Math.abs(run('profileMassAmount(profileById("legacy-acid"),'+plan.grams+',"tbsp")')-5.936)<.001);
const projected=run('balanceProjection(fixture,"ph",Date.now())');assert.ok(Math.abs(projected.current-7.4)<.01,'A six-tbsp manual dose must satisfy the ≈5.94-tbsp corrected endpoint, not be classified as 69.7% complete: '+projected.current+' / '+projected.status);
console.log('PASS: October 28 manual dose uses the same dose-time correction as the calculator');
assert.equal(projected.workingBound,true);assert.equal(projected.taylorEndpoint.conditional,true);
assert.ok(projected.taylorEndpoint.fraction>1.01&&projected.taylorEndpoint.fraction<1.02);
assert.match(projected.status,/endpoint estimate/);assert.equal(projected.acidDoseContext.source,'reconstructed_at_dose');
const original=JSON.stringify(c.fixture);run('balanceProjection(fixture,"ph",Date.now())');assert.equal(JSON.stringify(c.fixture),original,'Historical reads must not backfill metadata');
const context=run('acidReferenceContext(fixture.at(-1),fixture.at(-2),fixture)');assert.equal(context.correction.factor,.69);
// New manual and calculator drafts freeze the same context and preserve actual units.
c.manual=[JSON.parse(JSON.stringify(before)),JSON.parse(JSON.stringify(dose))];c.history=history;
run('freezeAcidDoseContexts(manual,history)');const saved=JSON.parse(JSON.stringify(c.manual[1]));
assert.equal(saved.amount,6);assert.equal(saved.unit,'tbsp');assert.equal(saved.calculation.acid_response_correction.source,'stored_manual');
assert.equal(saved.calculation.acid_response_correction.factor,.69);
assert.equal(saved.calculation.acid_response_correction.reference_mass_grams,raw);
assert.equal(saved.calculation.acid_response_correction.corrected_mass_grams,raw*.69);
c.confirmed=[JSON.parse(JSON.stringify(before)),{...JSON.parse(JSON.stringify(dose)),calculation:{measurement_timestamp:before.timestamp,source_measurements:{acid_demand_drops:9,acid_demand_target_ph:7.4},acid_response_correction:{...plan.correction,reference_mass_grams:raw}}}];
run('freezeAcidDoseContexts(confirmed,history)');assert.equal(c.confirmed[1].calculation.acid_response_correction.source,'stored_calculator');
c.manualEvents=[...history,...c.manual];c.confirmedEvents=[...history,...c.confirmed];
assert.equal(run('balanceProjection(manualEvents,"ph",Date.now()).current'),run('balanceProjection(confirmedEvents,"ph",Date.now()).current'));
function project(tail){c.cases=[...history,before,...tail];return run('balanceProjection(cases,"ph",Date.now())')}
const half={...dose,amount:raw*.69/2,unit:'grams'},second={...half,id:'second-half',timestamp:'2026-10-28T18:26',created_at:stamp('2026-10-28T18:26')};
const partial=project([half]);assert.ok(partial.partialAcid.fraction>.499&&partial.partialAcid.fraction<.501);assert.ok(partial.current>7.4&&partial.current<8.5);assert.equal(partial.partialAcid.scenario,true);
const split=project([half,second]),whole=project([{...half,amount:raw*.69}]);assert.ok(Math.abs(split.current-whole.current)<.01);assert.equal(split.acidDoseContext.required,raw*.69);
assert.match(project([{...half,amount:raw*.69*1.11}]).status,/Excess cumulative/);
for(const fraction of [.8999,.9,.9001])assert.ok(Number.isFinite(project([{...half,amount:raw*.69*fraction}]).current));
const baking={id:'baking',type:'chemical_addition',timestamp:before.timestamp,created_at:before.created_at,fill_cycle_id:fill.id,product:'Baking soda',amount:1,unit:'tsp'};
assert.equal(project([baking,{...dose,timestamp:'2026-10-28T18:26'}]).taylorEndpoint,undefined,'Intervening chemical before the first acid invalidates the endpoint');
assert.equal(project([half,{...baking,timestamp:'2026-10-28T18:26'}, {...second,timestamp:'2026-10-28T18:27'}]).taylorEndpoint,undefined);
const retest={id:'retest',type:'chemistry',timestamp:'2026-10-28T18:26',fill_cycle_id:fill.id,ph:7.6,ta_ppm:100};
assert.equal(project([half,retest,{...second,timestamp:'2026-10-28T18:27'}]).taylorEndpoint,undefined,'New sample must anchor subsequent chemistry');
const revisionProfile={...profile,id:'custom-acid',legacy_reference:false,revision:2},revised={...dose,product_id:'custom-acid',product_profile:revisionProfile};assert.equal(project([revised]).acidDoseContext.correction.factor,1,'No cross-product calibration borrowing');
assert.equal(project([half,{...second,product_id:'custom-acid',product_profile:revisionProfile}]).taylorEndpoint,undefined);
c.rev1history=history.map(e=>e.type==='chemical_addition'?{...e,product_id:'custom-acid',product_profile:{...revisionProfile,revision:1}}:e);c.revised=revised;c.revisionEvents=[...c.rev1history,before,revised];
assert.equal(run('acidReferenceContext(revised,revisionEvents.at(-2),revisionEvents).correction.count'),0,'Revision 1 fits cannot train revision 2');
c.boundaryDose={...dose,fill_cycle_id:'another-fill'};c.before=before;assert.equal(run('acidReferenceContext(boundaryDose,before,fixture)'),null);
c.boundaryDose={...dose,timestamp:'2026-10-28T21:26'};assert.equal(run('acidReferenceContext(boundaryDose,before,fixture)'),null,'Taylor reference expires after two hours');
c.boundaryDose={...dose,timestamp:'2026-11-01T01:30',created_at:'2026-11-01T08:35:00Z'};assert.equal(run('acidReferenceContext(boundaryDose,before,fixture)'),null,'Ambiguous local time is not a calibration cutoff');
// Later reports and later corrections cannot change knowledge available at dosing.
const correctedHistory=history.map(e=>e.id==='after-26'?{...e,id:'later-correction',supersedes_event_id:e.id,created_at:stamp('2026-10-28T18:30'),ph:7.1}:e);
c.changed=[...correctedHistory,before,dose];assert.equal(run('acidReferenceContext(changed.at(-1),changed.at(-2),changed).source'),'uncalibrated_reference','Without the original audit record reconstruction is unavailable');
c.audit=[...history,...correctedHistory.filter(e=>e.id==='later-correction'),before,dose];
run('Object.defineProperty(changed,"acidAudit",{value:audit})');assert.equal(run('acidReferenceContext(changed.at(-1),changed.at(-2),changed).correction.factor'),.69,'Full audit restores dose-time original rather than future correction');
c.unknownCorrection=[...history,{...history.at(-1),id:'untimed-correction',supersedes_event_id:history.at(-1).id,created_at:undefined},before,dose];assert.equal(run('acidReferenceContext(unknownCorrection.at(-1),unknownCorrection.at(-2),unknownCorrection).uncertain'),true,'Unknown correction report time cannot establish dose-time history');
assert.equal(run('acidReferenceContext(changed.at(-1),changed.at(-2),acidEventSubset(changed,()=>true)).correction.factor'),.69,'Chart subsets retain the read-only original audit');
c.laterReported=[...history.map(e=>e.id==='after-26'?{...e,created_at:stamp('2026-10-28T18:30'),ph:7.1}:e),before,dose];
assert.equal(run('acidReferenceContext(laterReported.at(-1),laterReported.at(-2),laterReported).correction.count'),1,'A later-reported retest cannot train an older dose');
c.frozen=[...correctedHistory,before,saved];assert.equal(run('acidReferenceContext(frozen.at(-1),frozen.at(-2),frozen).correction.factor'),.69);
assert.equal(JSON.stringify(c.fixture),original);
console.log('PASS: workflow parity, frozen metadata, partial/split/90% doses, endpoint invalidation, fill/product/time and correction-audit boundaries');
