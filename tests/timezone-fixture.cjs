const assert=require('node:assert/strict'),{c,run,element}=require('./app-harness.cjs')();
const now=Date.parse('2026-10-02T14:30:00Z');class Clock extends Date{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}}c.Date=Clock;c.now=now;element('fcMinimum').value='1';element('fcTarget').value='3';
c.events=[{id:'tz-fill',type:'water_change',full:true,timestamp:'2026-09-01',date_precision:'date_only',new_fill_cycle_id:'tz-cycle',gallons:395,starting_cya_ppm:30,starting_borates_ppm:40},
 {id:'tz-a',type:'chemistry',timestamp:'2026-10-01T00:00',fc_ppm:4,ph:7.5,ta_ppm:110},
 {id:'tz-b',type:'chemistry',timestamp:'2026-10-01T12:00',fc_ppm:2,ph:7.6,ta_ppm:110},
 {id:'tz-bleach',type:'chemical_addition',timestamp:'2026-10-01T12:01',product:'7.5% liquid bleach',amount:1,unit:'fl oz'},
 {id:'tz-c',type:'chemistry',timestamp:'2026-10-01T12:31',fc_ppm:3.3,ph:7.6,ta_ppm:110},
 {id:'tz-soak',type:'soak',timestamp:'2026-10-01T18:00',bathers:2,duration_minutes:20,showered:true,jet_air_use:'air_on'},
 {id:'tz-d',type:'chemistry',timestamp:'2026-10-01T19:00',fc_ppm:2.2,ph:7.7,ta_ppm:110},
 {id:'tz-e',type:'chemistry',timestamp:'2026-10-02T07:00',fc_ppm:1.1,ph:7.8,ta_ppm:110},
 {id:'tz-demand',type:'chemistry',timestamp:'2026-10-02T07:05',ph_bounds:{operator:'>=',value:8},ta_ppm:110,acid_demand_drops:2,acid_demand_target_ph:7.4},
 {id:'tz-acid',type:'chemical_addition',timestamp:'2026-10-02T07:06',product:'Leisure Time Spa Down',amount:run('taylorAcidMass(2,395)'),unit:'grams'},
 {id:'tz-retest',type:'chemistry',timestamp:'2026-10-02T07:06',ph:7.4,fc_ppm:1,ta_ppm:103},
 {id:'tz-latest-soak',type:'soak',timestamp:'2026-10-02T07:30',bathers:1,duration_minutes:15,showered:false,jet_air_use:'air_on'}].map(e=>({...e,fill_cycle_id:'tz-cycle'}));
// Synthetic equivalent of the established same-minute ordering exception.
run("const oldConfirmed=confirmedAcidRetestDoseId;confirmedAcidRetestDoseId=e=>e.id==='tz-retest'?'tz-acid':oldConfirmed(e)");
const original=JSON.stringify(c.events);run('write(events)');const base=run("base('note','2026-10-02T08:30')");assert.equal(base.timestamp,'2026-10-02T08:30');assert.equal(base.timestamp_instant,'2026-10-02T14:30:00.000Z');assert.equal(base.created_at,'2026-10-02T14:30:00.000Z');assert.equal(base.time_zone,'America/Denver');
assert.equal(run("modelTime({timestamp:'2026-11-01T01:30'})"),null);assert.equal(run("modelTime({timestamp:'2026-03-08T02:30'})"),null);assert.equal(run("modelTime({timestamp:'2026-10-01',date_precision:'date_only'})"),null);
assert.throws(()=>run("base('note','2026-03-08T02:30')"),/does not exist/);assert.throws(()=>run("base('note','2026-11-01T01:30')"),/explicit occurrence/);
c.folds=run("SpaTime.candidates('2026-11-01T01:30').map(t=>({timestamp:'2026-11-01T01:30',...SpaTime.metadata('2026-11-01T01:30',t)}))");assert.equal(c.folds.length,2);assert.equal(run('modelTime(folds[1])-modelTime(folds[0])'),3600000);assert.ok(run('timelineOrder(folds[0],folds[1])')<0);
assert.equal(run("SpaTime.calendarDays('2026-10-31',SpaTime.parse('2026-11-02T00:30'))"),2);
assert.equal(run("compareSpa({timestamp:'2026-10-02T14:00Z'},{timestamp:'2026-10-02T08:30'})"),-1800000);
assert.ok(run("timelineOrder(events.find(e=>e.id==='tz-retest'),events.find(e=>e.id==='tz-acid'))")>0);
const result=run("(()=>{const fc=fcProjection(events,now),ph=balanceProjection(events,'ph',now),ta=balanceProjection(events,'ta_ppm',now),m=buildDecayModel(events,false,'2026-10-02T08:30');return {clock:localNow(),instant:modelTime(events[1]),fc:fc.current,ph:ph.current,ta:ta.current,k:m.k,acid:acidRecommendation(2,395,events,'2026-10-02T08:30'),cya:calculatedCya(events,'2026-10-02T08:30'),borates:calculatedBorates(events,'2026-10-02T08:30'),maintenance:maintenanceContext(events,'2026-10-02T08:30'),folds:folds.map(modelTime),month:base('note','2026-11-01T00:01').timestamp.slice(0,7)}})()");
assert.equal(JSON.stringify(c.events),original);console.log(JSON.stringify(result));
