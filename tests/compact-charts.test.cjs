const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=html.slice(html.indexOf('function chartThresholdSummary('),html.indexOf('const chartInspection=new Map();'));
const bounds={fc_ppm:{lower:1,upper:10},ph:{lower:7.2,upper:7.8},ta_ppm:{lower:100,upper:150},ch_ppm:{lower:150,upper:250}},now=Date.now();
const context={Date,Number,Math,esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),chartBounds:key=>bounds[key],chartProjectionValue:(p,t)=>p.current+(p.testRate??0)*(t-now)/3600000,forecastSummary:p=>p.status+'; long explanation; '+(p.assumptions??[]).join('; ')};
vm.createContext(context);vm.runInContext(source,context);
const overview=(p,key,points=[])=>context.chartOverview(p,key,points,now),projection={kind:'balance',key:'ph',current:7.5,status:'Detailed equilibrium assumptions',assumptions:['Keep this long explanation collapsed'],horizon:now+72*3600000,points:[{rate:0}],testRate:.05};
for(const key of Object.keys(bounds)){
 const p={...projection,key,current:(bounds[key].lower+bounds[key].upper)/2,...(key==='fc_ppm'?{cross:now+18*3600000,model:{}}:{})},summary=overview(p,key),details=context.chartModelDetails(p,key,12);
 assert.match(summary,/class="chart-summary"/);assert.match(summary,/Alerts /);assert.doesNotMatch(summary,/Detailed equilibrium|long explanation|12 sample|manufacturer.*maximum/);
 assert.match(details,/<details class="help chart-model-details"><summary>Model details<\/summary>/);assert.doesNotMatch(details,/<details[^>]*\bopen\b/);assert.match(details,/long explanation/);assert.match(details,/12 sample/);
}
assert.match(overview(projection,'ph'),/Upper target in ~6.0 h/);
assert.match(overview({...projection,current:8},'ph'),/Currently above upper target/);
assert.match(overview({...projection,key:'ta_ppm',current:120},'ta_ppm'),/No drift-based crossing/);
assert.match(overview(null,'ch_ppm',[{v:180}]),/Latest sample: 180.0 ppm/);
assert.match(overview(null,'ch_ppm',[{v:180}]),/Sample history only/);
assert.match(overview({...projection,current:null,blocked:true,status:'Unknown dose <needs data>'},'ph',[{v:7.4}]),/Estimate paused: Unknown dose &lt;needs data&gt;/);
assert.match(overview({...projection,partialAcid:{scenario:true}},'ph'),/Conditional scenario/);
assert.match(overview({...projection,workingBound:true},'ph'),/not an exact pH/);
assert.match(overview({...projection,supported_until:now-1},'ph'),/Older-sample extrapolation/);
assert.match(overview({current:null,status:'Need readings'},'ph',[{v:8,bounded:true}]),/Latest sample: 8\+/);
assert.match(context.chartModelDetails(null,'ch_ppm',1),/no calcium-hardness forecast/);
// Main and expanded charts share this renderer; descriptions belong after the graph/key.
const render=html.slice(html.indexOf('function renderCharts('),html.indexOf("$('trendWindow').addEventListener"));
assert.match(render,/chartOverview\(projection,key,plotted\)/);assert.match(render,/chartKey\(key,projection\)\+chartModelDetails\(projection,key,points.length\)/);assert.doesNotMatch(render,/esc\(forecastSummary/);
console.log('PASS: compact summaries for FC/pH/TA/CH, target crossings, collapsed details, visible pause/bound/extrapolation warnings and shared expanded-chart layout');
