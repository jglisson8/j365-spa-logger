const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{JSDOM,VirtualConsole}=require('jsdom');
const root=path.join(__dirname,'../..');
function replay(journey,html=fs.readFileSync(path.join(root,'index.html'),'utf8'),verify=true){
 const now=Date.parse(journey.now),errors=[],requests=[],original=JSON.stringify(journey.events),virtualConsole=new VirtualConsole();
 virtualConsole.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(html.replace('render();calculate();connect();','render();calculate();'),{url:'https://spa.test/',runScripts:'dangerously',virtualConsole,beforeParse(w){
  const Real=w.Date;w.Date=class extends Real{constructor(...a){super(...(a.length?a:[now]))}static now(){return now}};
  w.localStorage.setItem('j365_spa_events_v2',original);w.localStorage.setItem('j365_v1_migrated','1');
  w.alert=m=>errors.push(m);w.confirm=()=>true;w.scrollTo=()=>{};
  w.fetch=async(url,opts={})=>{requests.push({url:String(url),method:opts.method||'GET'});return Response.json({error:'Isolated QA environment'},{status:401})};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 }});
 try{
  const w=dom.window,run=s=>w.eval(s),$=id=>w.document.getElementById(id);
  const report={id:journey.id,at:journey.now,parameters:{},home:w.document.querySelector('.current-estimates')?.textContent??''};
  for(const key of ['fc_ppm','ph','ta_ppm']){
   w.qaKey=key;const p=run('qaKey==="fc_ppm"?fcProjection(activeEvents()):balanceProjection(activeEvents(),qaKey)'),facts=run('actionContext(activeEvents()).facts[qaKey]');
   run('setTab("trends");renderCharts(activeEvents(),{key:qaKey})');
   const svg=$('trendCharts').querySelector('svg'),summary=$('trendCharts').querySelector('.chart-summary')?.textContent??'',view=$('trendCharts').textContent;
   const plotted=run('activeEvents().filter(e=>e.type==="chemistry"&&effectiveModelFill(e,activeEvents())===fillAtTime(activeEvents(),new Date().toISOString())&&(Number.isFinite(e[qaKey])||qaKey==="ph"&&e.ph_bounds))');
   const displayed=Number.isFinite(facts.display_estimate)?facts.display_estimate:Number.isFinite(facts.value)&&facts.kind!=='unknown'?facts.value:null;
   const name={fc_ppm:'FC',ph:'pH',ta_ppm:'TA'}[key],homeText=[...w.document.querySelectorAll('.current-estimates .estimate-value')].map(n=>n.textContent).find(t=>t.startsWith(name+':'))??'';
   const record={current:Number.isFinite(p.current)?p.current:null,kind:p.forecast_kind??p.kind??'unsupported',conditional:!!p.tablet_context,status:p.status??'',home_value:displayed,home_text:homeText,chart_summary:summary,history_visible:!!svg,points:(p.points??[]).map(x=>({time:x.t,value:Number.isFinite(x.v)?x.v:null,kind:x.kind??null,event_id:x.event_id??null})),theoretical:(p.theoretical_doses??[]).map(x=>({value:x.v,delta:x.delta_ppm})),reason:p.interruption?.reason??p.status??''};
   report.parameters[key]=record;
   if(!verify)continue;
   const expected=journey.expected[key],prefix=journey.id+' / '+key;
   assert.equal(Number.isFinite(p.current),expected.numeric,prefix+' supported/unsupported state');
   if(expected.range)assert.ok(p.current>=expected.range[0]&&p.current<=expected.range[1],prefix+' independent expected range');
   if(expected.conditional)assert.ok(p.tablet_context,prefix+' uncertainty remains explicit');
   if(expected.requiredDose)assert.ok(p.points.some(x=>x.event_id===expected.requiredDose),prefix+' last actual dose is included');
   if(expected.anchor){const sample=journey.events.find(e=>e.id===expected.anchor);assert.equal(p.points[0].v,sample[key],prefix+' latest measurement resets the anchor');}
   if(expected.theoretical)assert.ok(p.theoretical_doses.some(x=>x.delta_ppm>=expected.theoretical[0]&&x.delta_ppm<=expected.theoretical[1]),prefix+' theoretical dose remains visible');
   if(plotted.length){assert.ok(svg,prefix+' measured history never disappears');assert.ok(svg.querySelector('[data-chart-bound="lower"]')&&svg.querySelector('[data-chart-bound="upper"]'),prefix+' target bounds');}
   if(svg)assert.doesNotMatch(svg.outerHTML,/NaN|Infinity|undefined/,prefix+' finite rendered chart geometry');
   if(Number.isFinite(p.current)){
    assert.ok(Number.isFinite(displayed),prefix+' Home must not hide a supported estimate');
    assert.ok(homeText.includes(displayed.toFixed(key==='ta_ppm'?0:1)),prefix+' rendered Home text must show its supported value');
    if(['sample','carried'].includes(facts.kind)){
     const baseline=journey.events.find(e=>e.id===facts.id);assert.equal(displayed,baseline[key],prefix+' Home correctly labels the actual measured baseline');
    }else assert.ok(Math.abs(displayed-p.current)<1e-8,prefix+' Home/API estimate parity');
    assert.match(summary,new RegExp(p.current.toFixed(key==='ph'?2:1).replace('.','\\.')),prefix+' chart/API parity');
    assert.ok(!p.blocked,prefix+' supported value cannot simultaneously be paused');
    if(p.horizon>now)assert.ok(svg?.querySelector('[data-chart-trend="future"],[data-chart-trend="balance"],[data-chart-trend="extrapolated"]'),prefix+' supported forecast line must be rendered, not only sample dots');
   }else if(!expected.noCurrentFillSample)assert.ok(record.reason,prefix+' unsupported state needs a reason');
   assert.ok(view.length,prefix+' nonempty chart container');
  }
  const cya=run('calculatedCya(activeEvents(),localNow())');report.cya={value:cya.value,allowance:!!cya.inventory_allowance,band:cya.band};
  if(verify&&journey.cya)assert.ok(cya.value>=journey.cya[0]&&cya.value<=journey.cya[1],journey.id+' CYA inventory');
  if(verify){assert.deepEqual(errors,[],journey.id+' runtime errors');assert.ok(requests.every(r=>r.method==='GET'),journey.id+' no remote writes');assert.equal(run('JSON.stringify(read())'),original,journey.id+' stored history is immutable');assert.equal(JSON.stringify(journey.events),original);}
  return report;
 }finally{dom.window.close();}
}
module.exports={replay};
