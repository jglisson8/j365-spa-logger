const assert=require('node:assert/strict'),harness=require('./app-harness.cjs');
const {c,run,element}=harness();
const now=Date.parse('2026-10-02T12:00-06:00');c.now=now;
for(const [key,value]of [['fc_ppm',2.4],['ph',7.5],['ta_ppm',110]]){
 c.p={kind:'balance',key,current:value,t:now,horizon:now+86400000,supported_until:now+86400000,points:[{t:now,v:value,rate:0}]};c.key=key;
 const overview=run('chartOverview(p,key,[],now)');assert.match(overview,/class="chart-summary">≈/);assert.doesNotMatch(overview,/Estimate ≈|Estimated/);
}
assert.match(run("chartOverview(null,'ph',[{v:7.4}],now)"),/Latest sample: 7.4/);assert.doesNotMatch(run("chartOverview(null,'ph',[{v:7.4}],now)"),/≈/);
assert.match(run("chartOverview({...p,current:7.5,workingBound:true},'ph',[],now)"),/Scenario ≈/);
assert.match(run("chartOverview({...p,current:null,blocked:true,status:'Need new sample'},'ph',[],now)"),/Estimate paused/);
const key=run("chartKey('ph',null)");assert.equal((key.match(/Forecast ≈/g)||[]).length,1);assert.doesNotMatch(key,/Model ≈|Extrapolation/);assert.match(key,/Post-dose ≈/);assert.match(key,/Post-dose measured/);assert.match(key,/not sampled/);
c.sample={id:'synthetic-sample',type:'chemistry',timestamp:'2026-10-02T10:00',ph:7.4};
c.meta={key:'ph',plotted:[{e:c.sample,v:7.4}],start:now-7200000,end:now+7200000,history:{doseEstimates:[]},projection:{kind:'balance',key:'ph',t:now-7200000,horizon:now+7200000,points:[{t:now-7200000,v:7.4,rate:.02}]}};
assert.match(run('inspectChartValue(meta,now).text'),/pH: ≈7.44/);assert.doesNotMatch(run('inspectChartValue(meta,modelTime(sample)).text'),/≈|estimated/i);
for(const parameter of ['ph','ta_ppm']){c.meta.key=parameter;c.meta.projection.key=parameter;c.meta.projection.supported_until=now;assert.equal(run('inspectChartValue(meta,now).extended'),false);assert.equal(run('inspectChartValue(meta,now+3600000).extended'),true);assert.match(run('inspectChartValue(meta,now+3600000).text'),/Extended forecast · lower confidence/);}c.meta.key='ph';c.meta.projection.key='ph';delete c.meta.projection.supported_until;
c.meta.history.doseEstimates=[{t:now,v:7.3,dose:{product:'Synthetic acid'}}];assert.match(run('inspectChartValue(meta,now).text'),/Post-dose ≈7.30/);
c.meta.history.doseEstimates[0].scenario=true;assert.match(run('inspectChartValue(meta,now).text'),/Post-dose scenario ≈7.30/);
run('config=null');c.facts={facts:{fc_ppm:{kind:'estimate',value:2.4,hi:2.4},ph:{kind:'sample',value:7.4,hi:7.4},ta_ppm:{kind:'carried',value:110,hi:110}}};
run('actionContext=()=>facts;buildActionPlan=()=>({cards:[]});actionSignature=()=>"synthetic";renderActionGuidance()');
const action=element('nextActions').innerHTML;assert.match(action,/FC: ≈2.4 ppm/);assert.match(action,/pH: 7.4 · sample/);assert.match(action,/TA: ≈110 ppm · carried forward/);assert.doesNotMatch(action,/· estimated|pH: ≈/);
for(const [kind,value,expected] of [['sample',2,'FC: 2.0 ppm · sample'],['estimate',0.96,'FC: ≈1.0 ppm'],['carried',0.4,'FC: ≈0.4 ppm · carried forward']]){
 c.facts.facts.fc_ppm={kind,value,hi:value};run('renderActionGuidance()');assert.ok(element('nextActions').innerHTML.includes(expected),expected);
}
assert.equal(run("label({type:'water_top_off',gallons:5,volume_estimated:true})"),'Top-off — ≈5 gal');assert.equal(run("label({type:'water_top_off',gallons:5})"),'Top-off — 5 gal');assert.equal(run("label({type:'chemical_addition',amount:2,unit:'tbsp',product:'Actual dose'})"),'2 tbsp Actual dose');
console.log('PASS: ≈ for modeled/carried values, forecasts, post-dose readouts and approximate top-offs; measured samples, actual doses and warnings remain distinct');
