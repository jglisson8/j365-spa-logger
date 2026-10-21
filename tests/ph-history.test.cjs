const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').replace('render();calculate();connect();','render();calculate();');
const dom=new JSDOM(html,{url:'https://spa.test/',runScripts:'dangerously',beforeParse(w){w.scrollTo=()=>{};w.alert=()=>{};}}),w=dom.window;
const fill={id:'fill',type:'water_change',full:true,new_fill_cycle_id:'cycle',timestamp:'2026-10-01T12:00',starting_cya_ppm:30,starting_borates_ppm:40,gallons:395};
const a={id:'a',type:'chemistry',fill_cycle_id:'cycle',timestamp:'2026-10-19T12:00',ph:7.8,ta_ppm:60};
const b={...a,id:'b',timestamp:'2026-10-20T12:00',ph:7.3};
const real=w.eval('balanceProjection');
const plotted=events=>events.filter(e=>e.type==='chemistry'&&(Number.isFinite(e.ph)||e.ph_bounds)).map(e=>({e,v:e.ph??e.ph_bounds.value,bounded:!!e.ph_bounds}));
function history(events){w.fixture=events;w.plotted=plotted(events);return w.eval("calculatedChartHistory(fixture,'ph',plotted,0,Infinity)");}
// Actual no-buffer / unknown-dose gaps previously erased the entire connection.
const unknown={id:'unknown',type:'chemical_addition',timestamp:'2026-10-19',date_precision:'date_only',product:'Unidentified acid',amount:1,unit:'tbsp',fill_cycle_id:'cycle'};
for(const activity of [unknown,{...unknown,timestamp:'2026-10-19T18:00',date_precision:undefined},
 {id:'partial-water',type:'water_change',full:false,gallons:30,timestamp:'2026-10-19T18:00',fill_cycle_id:'cycle'}]){
 const events=[fill,a,activity,b],before=JSON.stringify(events),h=history(events);
 assert.equal(h.bridges.length,1);const curve=h.bridges[0];assert.ok(curve.points.every(p=>Number.isFinite(p.v)));assert.equal(curve.value(curve.start),7.8);assert.equal(curve.value(curve.end),7.3);assert.equal(JSON.stringify(events),before);
}
// A paused forecast cannot prevent a retrospective line; interpolation never
// fills the projection itself or makes its missing chemistry usable for training.
w.eval("balanceProjection=()=>({kind:'balance',points:[],blocked:true,horizon:0,status:'Missing buffer information',current:null})");
let h=history([fill,a,b]),curve=h.bridges[0];assert.equal(h.bridges.length,1);assert.equal(curve.interpolated,true);assert.equal(curve.conditional,false);
for(let i=0;i<=100;i++){const v=curve.value(curve.start+(curve.end-curve.start)*i/100);assert.ok(v>=7.3&&v<=7.8);}
assert.ok(Math.abs(curve.value(curve.start+(curve.end-curve.start)/4)-(7.8+(7.3-7.8)/4))>.02,'Fallback is curved, not a straight segment');
assert.equal(w.eval("balanceProjection([],'ph').current"),null);
// Unknown sample times connect at calendar-day positions without pretending to
// know an event's time. 8+ is a scenario anchor, never an exact pH=8 sample.
for(const sample of [{...a,ph:undefined,ph_bounds:{operator:'>=',value:8}},
 {...a,timestamp:'2026-10-19',date_precision:'date_only',historical:true}]){
 const events=[fill,sample,b],before=JSON.stringify(events);h=history(events);assert.equal(h.bridges.length,1);assert.equal(h.bridges[0].conditional,true);assert.match(h.bridges[0].description,/Not an exact/);assert.equal(JSON.stringify(events),before);
 w.meta={plotted:plotted(events),history:h,key:'ph',start:h.bridges[0].start,end:h.bridges[0].end,projection:null};w.mid=(w.meta.start+w.meta.end)/2;assert.match(w.eval('inspectChartValue(meta,mid).text'),/conditional scenario.*retrospective, not measured/);
}
// No interpolation across refill boundaries, even with incorrect explicit IDs.
const refill={...fill,id:'refill',new_fill_cycle_id:'next',timestamp:'2026-10-20T00:00'};
assert.equal(history([fill,a,refill,b]).bridges.length,0);
assert.equal(history([fill,a,{...b,fill_cycle_id:'other'}]).bridges.length,0);
assert.equal(history([fill,a,{...b,timestamp:a.timestamp}]).bridges.length,0);
assert.equal(history([fill,a]).bridges.length,0);
// Supported dose anchors are preserved. The response cannot begin before dose.
w.eval('balanceProjection=()=>({kind:"balance",points:[],horizon:0,current:null})');
w.originalHistory=w.eval('modeledChartHistory');w.eval('modeledChartHistory=()=>({bridges:[],doseEstimates:[{t:chartTime(fixture[2]),v:7.4,dose:fixture[2]}],addEstimates(){}})');
const dose={id:'acid',type:'chemical_addition',timestamp:'2026-10-19T18:00',product:'Spa Down',amount:1,unit:'tbsp'};
h=history([fill,a,dose,b]);curve=h.bridges[0];const doseTime=w.eval('chartTime(fixture[2])');assert.equal(curve.value(doseTime-1),7.8);assert.equal(curve.value(doseTime),7.4);assert.equal(curve.value(curve.end),7.3);
w.eval('modeledChartHistory=originalHistory');w.balanceProjection=real;
// Render + inspection share the same retrospective data and visible scenario key.
const bounded={...a,ph:undefined,ph_bounds:{operator:'>=',value:8},acid_demand_drops:7,acid_demand_target_ph:7.4};
w.fixture=[fill,bounded,b];w.eval("renderCharts(fixture,{target:'expandedChart',key:'ph',range:{start:chartTime(fixture[1]),end:chartTime(fixture[2])}})");
assert.ok(w.document.querySelector('[data-history-scenario="true"]'));assert.match(w.document.getElementById('expandedChart').textContent,/Between-points scenario/);assert.equal(bounded.ph,undefined);
// FC and TA retain the original stricter model-evidence requirements.
w.eval("balanceProjection=()=>({kind:'balance',points:[],blocked:true,horizon:0,current:null})");w.fixture=[fill,{...a,ta_ppm:60},{...b,ta_ppm:80}];w.eval("p=fixture.filter(e=>e.type==='chemistry').map(e=>({e,v:e.ta_ppm}))");assert.equal(w.eval("calculatedChartHistory(fixture,'ta_ppm',p,0,Infinity).bridges.length"),0);
dom.window.close();console.log('PASS: pH retrospective continuity through paused models, unknown doses/times, partial water changes, bounded scenarios; dose anchors, no refill bridge, readout/key and unchanged records/models');
