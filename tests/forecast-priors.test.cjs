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
assert.equal(fc.forecast_kind,'provisional_history');assert.equal(fc.points[0].v,5);assert.equal(fc.historical_prior.local_pairs,0);
assert.equal(fc.historical_prior.historical_pairs,2);assert.deepEqual(Array.from(fc.historical_prior.bands),[30]);assert.equal(fc.historical_prior.current_band,5);
assert.ok(fc.current>=0&&fc.current<5);
assert.equal(ph.forecast_kind,'provisional_history');assert.equal(ph.points[0].v,7.5);assert.ok(ph.current>7.5);assert.equal(ph.historical_prior.local_pairs,0);
assert.ok(ph.current>run('balanceProjection(rows.filter(e=>e.id!=="new-jets"),"ph",now).current'));
assert.equal(run('balanceProjection(rows,"ta_ppm",now).current'),170);
for(const key of ['fc_ppm','ph']){
 c.key=key;element('trendWindow').value='14';run('renderCharts(rows,{key})');
 const html=element('trendCharts').innerHTML;assert.match(html,/data-forecast-prior-band/);assert.match(html,/Provisional ≈/);
 const diag=run('(()=>{const p=key==="ph"?balanceProjection(rows,key,now):fcProjection(rows,now);return {range:historicalForecastBand(p,now),value:p.current,after:chartProjectionValue(p,p.prior_until+1000),held:actionContext(rows,now).facts[key].kind}})()');
 assert.ok(diag.range[0]<diag.value&&diag.range[1]>diag.value);assert.equal(diag.after,null);assert.equal(diag.held,'unknown');
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
const learned=run('balanceProjection([...rows,...newPh],"ph",now)');assert.equal(learned.historical_prior,undefined);assert.equal(learned.points[0].v,7.7);
c.nextTest={...freshFc[0],ph:7.55};
assert.equal(run('automaticForecastReview(nextTest,rows)?.parameters.fc_ppm'),undefined);
assert.equal(run('automaticForecastReview(nextTest,rows)?.parameters.ph'),undefined);
console.log('PASS: current-fill anchors, FC/pH history priors, uncertainty bands, expiry, no forecast from zero/bounds, local samples take over, and no treatment or validation leakage');
