const assert=require('node:assert/strict'),{c,run,element}=require('./app-harness.cjs')();
const now=Date.parse('2026-11-09T23:00Z');
class Clock extends Date{constructor(...a){super(...(a.length?a:[now]))}static now(){return now}}
c.Date=Clock;c.now=now;
const fill=(id,timestamp,cya,borates)=>({id,timestamp,type:'water_change',full:true,gallons:395,new_fill_cycle_id:id,starting_cya_ppm:cya,starting_borates_ppm:borates});
const test=(id,fill_cycle_id,timestamp,fields)=>({id,fill_cycle_id,timestamp,type:'chemistry',...fields});
const old=fill('october','2026-10-01T08:00',30,40),fresh=fill('november','2026-11-07T16:00',5,0);
const jets=(id,fill_cycle_id,timestamp)=>({id,fill_cycle_id,timestamp,type:'maintenance',activity:'custom',custom_activity:'Standalone jets',exposure:{kind:'jets',duration_minutes:20,air_on:true}});
const history=[old,test('fc1',old.id,'2026-11-01T08:00',{fc_ppm:6}),test('fc2',old.id,'2026-11-02T08:00',{fc_ppm:3}),test('fc3',old.id,'2026-11-03T08:00',{fc_ppm:2}),
 test('p1',old.id,'2026-11-05T09:00',{ph:7.3,ta_ppm:110,temperature_f:104}),test('p2',old.id,'2026-11-05T13:00',{ph:7.34,ta_ppm:110}),jets('old-jets',old.id,'2026-11-05T14:10'),test('p3',old.id,'2026-11-05T16:00',{ph:7.43,ta_ppm:110})];
const initial=test('fresh-test',fresh.id,'2026-11-08T14:00',{ph:7.5,ta_ppm:170,fc_ppm:5,temperature_f:104}),currentJets=jets('new-jets',fresh.id,'2026-11-08T14:20');
c.rows=[...history,fresh,initial,currentJets];const before=JSON.stringify(c.rows);
const fc=run('fcProjection(rows,now)'),ph=run('balanceProjection(rows,"ph",now)');
assert.equal(fc.forecast_kind,'extrapolated');assert.equal(fc.points[0].v,5);assert.equal(fc.historical_prior.local_pairs,0);
assert.equal(fc.historical_prior.historical_pairs,2);assert.deepEqual(Array.from(fc.historical_prior.bands),[30]);assert.equal(fc.historical_prior.current_band,5);
assert.ok(fc.current>=0&&fc.current<5);
assert.equal(ph.forecast_kind,'calculated');assert.equal(ph.points[0].v,7.5);assert.ok(ph.current>7.5);assert.equal(ph.historical_prior.local_pairs,0);
assert.ok(ph.current>run('balanceProjection(rows.filter(e=>e.id!=="new-jets"),"ph",now).current'));
assert.equal(run('balanceProjection(rows,"ta_ppm",now).current'),170);
for(const key of ['fc_ppm','ph']){
 c.key=key;element('trendWindow').value='14';run('renderCharts(rows,{key})');
 const html=element('trendCharts').innerHTML;assert.match(html,/data-forecast-prior-band/);assert.match(html,/class="chart-summary">≈/);assert.match(html,/Forecast range/);assert.doesNotMatch(html,/Provisional ≈|Historical-rate scenario/);
 const diag=run('(()=>{const p=key==="ph"?balanceProjection(rows,key,now):fcProjection(rows,now),fact=actionContext(rows,now).facts[key];return {range:historicalForecastBand(p,now),value:p.current,held:fact.kind,display:fact.display_estimate,tap:inspectChartValue({projection:p,key,plotted:[{e:rows.find(e=>e.id==="fresh-test"),v:p.points[0].v}],start:p.points[0].t,end:now+3600000},now).text}})()');
 assert.ok(diag.range[0]<diag.value&&diag.range[1]>diag.value);assert.equal(diag.held,'unknown');
 assert.equal(diag.display,diag.value,'the post-aeration hold keeps the estimate visible without using it for guidance');assert.match(diag.tap,/≈.*range/);
 assert.ok(Number.isFinite(run('actionContext(rows.filter(e=>e.id!=="new-jets"),now).facts[key].display_estimate')));
}
assert.equal(JSON.stringify(c.rows),before);
c.noAnchor=[...history,fresh];assert.equal(run('fcProjection(noAnchor,now).current'),undefined);assert.equal(run('balanceProjection(noAnchor,"ph",now).current'),undefined);
c.bound=[...history,fresh,{...initial,ph:undefined,ph_bounds:{operator:'>=',value:8},fc_ppm:0}];
assert.equal(run('balanceProjection(bound,"ph",now).current'),null);assert.equal(run('fcProjection(bound,now).current'),null);
const freshFc=[test('f1',fresh.id,'2026-11-09T08:00',{fc_ppm:4}),test('f2',fresh.id,'2026-11-09T10:00',{fc_ppm:3}),test('f3',fresh.id,'2026-11-09T12:00',{fc_ppm:2}),test('f4',fresh.id,'2026-11-09T14:00',{fc_ppm:1.5})];
c.updated=[...c.rows,...freshFc];const blend=run('fcProjection(updated.slice(0,-2),now)');
assert.equal(blend.historical_prior.local_pairs,1);assert.ok(blend.historical_prior.weight<.5);
const local=run('fcProjection(updated,now)');assert.equal(local.historical_prior,undefined);assert.equal(local.points[0].v,1.5);
c.newPh=[test('fp1',fresh.id,'2026-11-09T09:00',{ph:7.55,ta_ppm:170}),test('fp2',fresh.id,'2026-11-09T11:00',{ph:7.6,ta_ppm:170}),test('fp3',fresh.id,'2026-11-09T13:00',{ph:7.65,ta_ppm:170}),test('fp4',fresh.id,'2026-11-09T15:00',{ph:7.7,ta_ppm:170})];
const onePh=run('balanceProjection([...rows.filter(e=>e.fill_cycle_id!=="november"),...newPh.slice(0,2)],"ph",now)');
assert.equal(onePh.historical_prior.local_pairs,1);assert.notEqual(onePh.gasFit.covered,ph.gasFit.covered);
const learned=run('balanceProjection([...rows.filter(e=>e.id!=="new-jets"),...newPh],"ph",now)');assert.equal(learned.points[0].v,7.7);assert.ok(learned.gasFit.air>0,'idle tests must not erase earlier aeration evidence');
c.nextTest={...freshFc[0],ph:7.55};
assert.equal(run('automaticForecastReview(nextTest,rows)?.parameters.fc_ppm'),undefined);
assert.equal(run('automaticForecastReview(nextTest,rows)?.parameters.ph'),undefined);
const rates=run(`(()=>{
 const rows=[{cyaBand:5,k:.1,weight:1},{cyaBand:30,k:.02,weight:1}];
 return [0,5,15,30,35].map(b=>cyaDecayRate(rows,b).k);
})()`);
assert.equal(rates[0],rates[1]);assert.ok(rates[1]>rates[2]&&rates[2]>rates[3]);assert.equal(rates[3],rates[4]);
assert.equal(run('cyaDecayRate([{cyaBand:30,k:.025,weight:1}],5).k'),.025,'a single observed band must not invent a CYA slope');
c.threshold={current:3,cross:now+80*3600000,horizon:now+24*3600000,historical_prior:{kind:'fc'}};
assert.match(run('chartThresholdSummary(threshold,"fc_ppm",now)'),/Lower target in .*extrapolated/);
c.later=run('modelTime(rows.find(e=>e.id==="fresh-test"))+73*3600000');
c.aging=run('rows.filter(e=>e.id!=="new-jets").map(e=>e.id==="fresh-test"?{...e,ph:7.1}:e)');
for(const key of ['fc_ppm','ph','ta_ppm']){
 c.key=key;
 const p=run('key==="fc_ppm"?fcProjection(aging,later):balanceProjection(aging,key,later)');
 assert.ok(Number.isFinite(p.current),key+' is still available at 73 hours');assert.equal(p.forecast_kind,'extrapolated');
 assert.match(run('(()=>{const p=key==="fc_ppm"?fcProjection(aging,later):balanceProjection(aging,key,later);return projectionSvg(p,e=>Date.parse(e.timestamp),v=>v,later+3600000)})()'),/data-chart-trend="extrapolated"/);
 assert.match(run('chartOverview(key==="fc_ppm"?fcProjection(aging,later):balanceProjection(aging,key,later),key,[],later)'),/Last measurement: 3d 1h ago.*Older-sample extrapolation/);
 if(key!=='ta_ppm')assert.match(run('(()=>{const p=key==="fc_ppm"?fcProjection(aging,later):balanceProjection(aging,key,later),sample=aging.find(e=>e.id==="fresh-test"),meta={key,projection:p,plotted:[{e:sample,v:sample[key]}],start:p.points[0].t,end:later+3600000},node={};chartUiReadout(node,inspectChartValue(meta,later),meta);return node.innerHTML})()'),/≈[^<]*–[^<]*Extended forecast.*Lower confidence/);
}
assert.match(run('balanceProjection(rows,"ph",later).status'),/supported range limit/);
const capped=run('balanceProjection(rows,"ph",later)');assert.equal(capped.current,null);assert.equal(capped.ph_model_limit.value,9);assert.equal(capped.ph_model_limit.last_measured,7.5);
assert.equal(run('actionContext(rows,later).facts.ph.kind'),'unknown');assert.equal(run('actionContext(rows,later).facts.ph.ph_model_limit.value'),9);
assert.match(run('chartOverview(balanceProjection(rows,"ph",later),"ph",[],later)'),/≈9\+ · model limit · Last measured: 7.5/);
assert.equal(run('chartProjectionValue(balanceProjection(rows,"ph",later),later)'),null,'The model limit is display-only, not a numeric forecast');
assert.match(run('(()=>{const p=balanceProjection(rows,"ph",later),meta={key:"ph",projection:p,plotted:[],start:p.t,end:later+3600000},node={};chartUiReadout(node,inspectChartValue(meta,later),meta);return node.innerHTML})()'),/≈9\+ · model limit.*Last measured: 7.5/);
assert.match(run('buildActionPlan(actionContext(rows,now)).cards.find(c=>c.id==="fc-unknown").steps[0]'),/No retest after aeration.*Test FC before adjusting/);
c.lateDose={id:'late-bleach',type:'chemical_addition',fill_cycle_id:fresh.id,timestamp:new Date(c.later-3600000).toISOString(),product:'7.5% liquid bleach',strength_percent:7.5,amount:1,unit:'fl oz'};
const afterDose=run('fcProjection([...rows,lateDose],later)');
assert.equal(afterDose.points.at(-1).event_id,'late-bleach');assert.ok(Number.isFinite(afterDose.current));
assert.equal(run('forecastMeasurementAge(fcProjection([...rows,lateDose],later),later)'),'Last measurement: 3d 1h ago','A dose does not reset measurement age');
c.unknown={...c.lateDose,product:'Unknown treatment',strength_percent:undefined};
assert.equal(run('fcProjection([...rows,unknown],later).current'),null);
assert.equal(run('balanceProjection([...rows,unknown],"ph",later).current'),null);
assert.equal(run('balanceProjection([...aging,unknown],"ph",later).ph_model_limit'),undefined,'Do not show 9+ for an unsupported addition');
c.otherBand=[...c.rows,...freshFc.slice(0,2),test('changedCya',fresh.id,'2026-11-09T11:00',{cya_ppm:20}),test('nextFc',fresh.id,'2026-11-09T14:00',{fc_ppm:4})];
const fallback=run('fcProjection(otherBand,now)');assert.ok(Number.isFinite(fallback.current));assert.equal(fallback.model.rate_basis.current_band,20);
assert.equal(run('buildDecayModel(otherBand.map(e=>e.id==="f2"?{...e,cover_condition:"left_open"}:e),false).eligibleIntervals.some(r=>r.b.id==="f2")'),false);
const buffered=run(`(()=>{
 const rise=borates_ppm=>{const s={ta_ppm:170,cya_ppm:5,borates_ppm,temperature_f:104};return phFromCarbon({...s,carbon:carbonFromPh(7.5,s)-.0001})-7.5;};
 return [rise(0),rise(40)];
})()`);assert.ok(buffered[0]>buffered[1]&&buffered[1]>0);
console.log('PASS: current-fill anchors, CYA-aware decay, borrowed aeration, borate buffering, extrapolation and measurement age, physical stops and guidance safeguards');
