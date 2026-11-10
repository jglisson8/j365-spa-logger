const assert=require('node:assert/strict'),{c,run,element}=require('./app-harness.cjs')();
const now=Date.parse('2026-11-08T21:00Z');
class Clock extends Date{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}}
c.Date=Clock;c.now=now;
const fill={id:'fresh-fill',type:'water_change',full:true,gallons:395,new_fill_cycle_id:'fresh',timestamp:'2026-11-07T12:00'};
const test={id:'test-start',type:'chemistry',fill_cycle_id:'fresh',timestamp:'2026-11-08T12:00',ph:7.5,ta_ppm:110};
const dose={id:'dose-first',type:'chemical_addition',fill_cycle_id:'fresh',timestamp:'2026-11-08T12:30',product:'Aqua Doc Dichlor',amount:1,unit:'tbsp'};
c.rows=[fill,test,dose];const before=JSON.stringify(c.rows);
for(const [key,carried] of [['ph',7.5],['ta_ppm',110]]){
 c.key=key;
 const p=run('balanceProjection(rows,key,now)');assert.equal(p.blocked,false);assert.equal(p.current,carried);
 assert.equal(p.unmodeled_dichlor,true);assert.equal(p.points.at(-1).unmodeled_dose,true);
 assert.match(p.assumptions.join(' '),/immediate effect of dichlor on pH and TA is not included/);
 assert.equal(run('actionContext(rows,now).facts[key].display_estimate'),carried);
 assert.equal(run('actionContext(rows,now).facts[key].kind'),'unknown','Do not base treatment on an unmodeled immediate effect');
 element('trendWindow').value='14';run('renderCharts(rows,{key})');
 const html=element('trendCharts').innerHTML;
 assert.match(html,/data-chart-trend="balance"/);assert.match(html,/immediate effect of dichlor/);
 assert.doesNotMatch(html,/data-post-dose-estimate="dose-first"/);
 assert.match(html,/data-trend-marker="chemical_addition"/);
}
assert.equal(run('balanceProjection(rows,"ph",now).points[0].chemistry.cya_ppm'),0);
const postCya=run('balanceProjection(rows,"ph",now).points[1].chemistry.cya_ppm');
assert.ok(Math.abs(postCya-4.8)<.05);
// Same-minute doses must apply their CYA exactly once, in timeline order.
c.two=[...c.rows,{...dose,id:'dose-second'}];
const p2=run('balanceProjection(two,"ph",now)');
assert.equal(p2.points[1].chemistry.cya_ppm,postCya);
assert.equal(p2.points[2].chemistry.cya_ppm,2*postCya);
c.profiled=run('({...rows[2],...productIdentity("Dichlor")})');
assert.equal(c.profiled.product_profile?.family,'dichlor');
assert.equal(run('balanceProjection([...rows.slice(0,2),profiled],"ph",now).unmodeled_dichlor'),true);
for(const invalid of [{...dose,product:'Mystery treatment'},{...dose,unit:'packets'},{...dose,product:'Dichlor blend'},{...dose,fill_cycle_id:'other'}]){
 c.invalid=[fill,test,invalid];
 for(const key of ['ph','ta_ppm']){c.key=key;assert.equal(run('balanceProjection(invalid,key,now).blocked'),true);}
}
c.retest=[...c.rows,{...test,id:'retest',timestamp:'2026-11-08T13:00',ph:7.4,ta_ppm:105}];
assert.equal(run('balanceProjection(retest,"ph",now).current'),7.4);
assert.equal(run('balanceProjection(retest,"ta_ppm",now).current'),105);
assert.equal(run('balanceProjection(retest,"ph",now).unmodeled_dichlor'),undefined);
assert.equal(run('balanceProjection(retest,"ta_ppm",now).unmodeled_dichlor'),undefined);
c.bound=[fill,{...test,ph:undefined,ph_bounds:{operator:'>=',value:8}},dose];
assert.equal(run('balanceProjection(bound,"ph",now).current'),null,'A known dichlor dose cannot turn a bound into a numeric pH');
assert.equal(JSON.stringify(c.rows),before);
console.log('PASS: dichlor pH/TA continuity, CYA rebase, no invented post-dose marker or treatment, strict dose recognition, bound and retest');
