const assert=require('node:assert/strict'),{c,run,element}=require('./app-harness.cjs')();
const now=Date.parse('2026-11-09T23:00Z');
class Clock extends Date{constructor(...a){super(...(a.length?a:[now]))}static now(){return now}}
c.Date=Clock;c.now=now;
const fill={id:'fill',timestamp:'2026-11-07T16:00',type:'water_change',full:true,gallons:395,new_fill_cycle_id:'f',starting_cya_ppm:30,starting_borates_ppm:40};
const sample=(id,timestamp,ph,fc_ppm)=>({id,fill_cycle_id:'f',timestamp,type:'chemistry',ph,fc_ppm,ta_ppm:110,temperature_f:104});
const soak={id:'incomplete',fill_cycle_id:'f',timestamp:'2026-11-09T13:30',type:'soak',duration_minutes:20};
const rows=[fill,sample('a','2026-11-08T08:00',7.3,5),sample('b','2026-11-08T12:00',7.34,4),{...soak,id:'known',timestamp:'2026-11-08T13:00',bathers:1,showered:true,jet_air_use:'air_on'},sample('c','2026-11-08T15:00',7.45,3.1),sample('d','2026-11-09T13:00',7.5,1.4),soak];
c.rows=rows;const original=JSON.stringify(rows);c.cutoff=run('modelTime(rows.at(-1))');
const ta=run('balanceProjection(rows,"ta_ppm",now)');assert.equal(ta.current,110);assert.equal(ta.blocked,false);
const ph=run('balanceProjection(rows,"ph",now)');assert.equal(ph.blocked,false);assert.ok(ph.gasFit.air>0);assert.equal(ph.forecast_kind,'conditional');assert.equal(ph.soak_scenarios.length,4);
const r=run('phSoakRange(balanceProjection(rows,"ph",now),now)');assert.ok(r[1]>r[0]+.01);assert.ok(ph.current>r[0]&&ph.current<r[1]);
const explicit=mode=>run(`balanceProjection(rows.map(e=>e.id==="incomplete"?{...e,jet_air_use:${JSON.stringify(mode)}}:e),"ph",now).current`);
assert.equal(r[0],explicit('off'));assert.equal(r[1],explicit('air_on'));
assert.equal(run('phSoakRange(balanceProjection(rows,"ph",now),cutoff-1)'),null);
assert.equal(run('actionContext(rows,now).facts.ph.kind'),'unknown');
assert.deepEqual(Array.from(run('actionContext(rows,now).facts.ph.display_range')),Array.from(r));
const fc=run('fcProjection(rows,now)');assert.equal(fc.current,null);assert.equal(fc.forecast_stop,c.cutoff);assert.match(fc.status,/bather count, shower status/);
assert.ok(run('chartProjectionValue(fcProjection(rows,now),cutoff-1000)')>0);
assert.equal(run('chartProjectionValue(fcProjection(rows,now),cutoff+1000)'),null);
assert.equal(run('chartProjectionValue(fcProjection(rows,now),now)'),null);
assert.equal(run('chartProjectionValue(fcProjection(rows,now),cutoff-1000)'),run('chartProjectionValue(fcProjection(rows.slice(0,-1),cutoff-1000),cutoff-1000)'));
for(const [key,match] of [['ph',/data-soak-ph-range/],['fc_ppm',/data-chart-trend="future"/],['ta_ppm',/data-chart-trend="balance"/]]){
 c.key=key;run('renderCharts(rows,{key,range:{start:now-6*3600000,end:now+6*3600000}})');assert.match(element('trendCharts').innerHTML,match);
 const inspect=run('inspectChartValue(chartInspection.get("trendCharts-"+key),now).text');
 if(key==='ph'){assert.match(inspect,/pH ≈[\d.]+–[\d.]+ · air setting unknown/);assert.match(element('trendCharts').innerHTML,/range across jet settings/);}
 if(key==='fc_ppm'){assert.match(inspect,/Incomplete soak/);assert.doesNotMatch(element('trendCharts').innerHTML,/NaN|Infinity/);}
}
c.missingTime=[...rows.slice(0,-1),{...soak,timestamp:'2026-11-09',date_precision:'date_only',duration_minutes:null}];
assert.equal(run('balanceProjection(missingTime,"ta_ppm",now).current'),110);
assert.equal(run('balanceProjection(missingTime,"ph",now).current'),null);
c.missingDuration=[...rows.slice(0,-1),{...soak,duration_minutes:null}];
assert.equal(run('balanceProjection(missingDuration,"ph",now).current'),null);
assert.equal(run('balanceProjection(missingDuration,"ta_ppm",now).current'),110);
c.retest=[...rows,sample('retest','2026-11-09T15:30',7.6,1)];
assert.equal(run('balanceProjection(retest,"ph",now).soak_scenarios'),undefined);
assert.ok(run('fcProjection(retest,now).current')>0);
assert.equal(run('automaticForecastReview(retest.at(-1),rows)?.parameters.ph'),undefined);
assert.equal(JSON.stringify(rows),original);
console.log('PASS: incomplete-soak TA carry, pH jet scenarios/range, FC pre-soak curve, retest reset and no fabricated records or training');
