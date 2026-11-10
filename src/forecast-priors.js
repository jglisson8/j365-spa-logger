// Transfer rates, never readings, across a refill. The display band is
// sensitivity to explicit provisional assumptions, not a confidence interval.
const FORECAST_PRIOR_HOURS=72, FORECAST_PRIOR_FULL_WEIGHT_AT=3;
function precedingFillEvents(events,anchor){
 const fill=effectiveModelFill(anchor,events),cutoff=modelTime(anchor);
 const boundary=events.find(e=>e.type==='water_change'&&e.full&&e.new_fill_cycle_id===fill),start=modelTime(boundary)??(boundary?chartTime(boundary):null);
 if(!fill||start==null||cutoff==null||start>cutoff)return [];
 return events.filter(e=>chartTime(e)<start&&effectiveModelFill(e,events)!==fill);
}
function forecastDecayPrior(events,anchor,model){
 const n=model.intervals.length;
 if(n>=FORECAST_PRIOR_FULL_WEIGHT_AT)return model;
 const past=precedingFillEvents(events,anchor);if(!past.length)return model;
 const at=new Date(modelTime(anchor)).toISOString(),cya=model.currentCya?.band;
 const evidence=buildDecayModel(past,false,at).eligibleIntervals.filter(r=>r.k>0&&r.cyaBand!=null).slice(-24);
 if(evidence.length<2)return model;
 // Context mismatch reduces weight and widens the scenario; it does not
 // assert that CYA differences alone determine a decay-rate multiplier.
 const nearest=Math.min(...evidence.map(r=>cya==null?30:Math.abs(r.cyaBand-cya)));
 const rows=evidence.filter(r=>cya==null||Math.abs(r.cyaBand-cya)<=nearest+5);
 const weights=rows.map(r=>r.weight/(1+(cya==null?30:Math.abs(r.cyaBand-cya))/10));
 const oldK=rows.reduce((s,r,i)=>s+r.k*weights[i],0)/weights.reduce((s,w)=>s+w,0);
 const strength=n?(.5/(1+nearest/10)):1,fraction=n?strength/(n+strength):1;
 const k=n?(1-fraction)*model.k+fraction*oldK:oldK;
 const spread=nearest>5?2.5:1.75,oldMin=Math.min(oldK/spread,...rows.map(r=>r.k)),oldMax=Math.max(oldK*spread,...rows.map(r=>r.k));
 const widen=(old,local)=>n?(1-fraction)*local+fraction*old:old;
 return {...model,k,minK:widen(oldMin,model.minK),maxK:widen(oldMax,model.maxK),maxHours:n?model.maxHours:Math.max(...rows.map(r=>r.hours)),prior:{kind:'fc',historical_pairs:rows.length,local_pairs:n,weight:fraction,bands:[...new Set(rows.map(r=>r.cyaBand))],current_band:cya??null}};
}
function forecastPhPrior(events,sample,local){
 const n=local.exact??local.rows?.filter(r=>!r.bounded).length??0;
 if(local.ready&&n>=FORECAST_PRIOR_FULL_WEIGHT_AT)return local;
 const past=precedingFillEvents(events,sample);if(!past.length)return local;
 const anchors=new Map();
 for(const e of past.filter(e=>e.type==='chemistry'&&!e.historical&&modelTime(e)!=null&&(Number.isFinite(e.ph)||e.ph_bounds)).sort(timelineOrder)){
  const fill=effectiveModelFill(e,past);if(fill)anchors.set(fill,e);
 }
 for(const anchor of [...anchors.values()].reverse().slice(0,4)){
  const old=phGasFit(past,anchor);
  if(!old.ready||!old.exact)continue;
  // Shrink the transferred rate toward zero; a mostly censored historical
  // fit supports a direction more strongly than a magnitude. Use the new
  // fill's equilibrium and exposure rather than transferring an old pH.
  const shrink=old.exact/(old.exact+2),weight=local.ready?.5/(n+.5):1;
  // One numeric interval cannot separate idle loss from jet loss, but it
  // can nudge the overall prior rate without refitting both coefficients.
  const ratios=(local.rows??[]).filter(r=>!r.bounded&&!r.bleach).map(r=>{
   const expected=shrink*(old.covered*r.hours+old.air*r.air_by_exponent[1]);
   return expected>=.001?Math.max(0,Math.min(3,r.y/expected)):null;
  }).filter(Number.isFinite);
  const scale=!local.ready&&ratios.length?(2+ratios.reduce((a,b)=>a+b,0))/(2+ratios.length):1;
  const blend=(a,b)=>a*shrink*scale*weight+(b??0)*(1-weight);
  return {...(local.ready?local:old),covered:blend(old.covered,local.covered),air:blend(old.air,local.air),spread:Math.max(1,local.spread??0),seatFit:{index:1,exponent:.5,learned:false},prior:{kind:'ph',historical_pairs:old.exact,historical_bounds:old.bounded,local_pairs:n,weight},provisional:true};
 }
 return local;
}
function historicalForecastBand(p,t){
 if(!p?.historical_prior||t<p.points[0].t||t>Math.min(p.horizon??Infinity,p.prior_until??Infinity))return null;
 if(p.key==='ph'){
  const values=[0,2].flatMap(f=>[-PH_GAS.measurement_ph,PH_GAS.measurement_ph].map(delta=>phGasScenarioValue(p,t,f,f,delta))).filter(x=>x!=null);
  const center=chartProjectionValue(p,t);if(!values.length||!Number.isFinite(center))return null;
  return [Math.max(6,Math.min(center,...values)),Math.min(9,Math.max(center,...values))];
 }
 const points=p.points, simulate=(fast)=>{
  let v=Math.max(0,points[0].v+(fast?-1:1)*FC_UNCERTAINTY.measurement_ppm);
  for(let i=0;i<points.length;i++){
   const a=points[i],b=points[i+1],k=fast?(a.maxK??a.k):(a.minK??a.k),end=Math.min(b?.t??t,t);
   v=Math.max(0,v*Math.exp(-k*(end-a.t)/3600000)-delayedProjectionLoss(p,a.t,end,k)*(fast?1.5:.5));
   if(!b||b.t>t)break;
   const spread=b.jump_kind==='dose'?FC_UNCERTAINTY.dose_fraction:FC_UNCERTAINTY.soak_fraction;
   v=Math.max(0,v+b.jump_delta+(fast?-1:1)*Math.abs(b.jump_delta)*spread);
  }
  return v;
 };
 const center=chartProjectionValue(p,t);return Number.isFinite(center)?[Math.min(center,simulate(true)),Math.max(center,simulate(false))]:null;
}
function historicalForecastBandSvg(p,begin,end,x,y){
 if(!p?.historical_prior)return '';
 const start=Math.max(begin,p.points[0].t),stop=Math.min(end,p.horizon??Infinity,p.prior_until??Infinity);
 if(!(stop>start))return '';
 const groups=[];let points=[];
 const times=new Set(Array.from({length:49},(_,i)=>start+(stop-start)*i/48));
 for(const a of p.points)if(a.t>start&&a.t<=stop){times.add(a.t-1);times.add(a.t);}
 for(const t of [...times].sort((a,b)=>a-b)){
  const band=historicalForecastBand(p,t);
  if(band)points.push({t,band});else if(points.length){groups.push(points);points=[];}
 }
 if(points.length)groups.push(points);
 const coord=(a,i)=>x({timestamp:new Date(a.t).toISOString()})+','+y(a.band[i]);
 return groups.filter(g=>g.length>1).map(g=>'<polygon data-forecast-prior-band points="'+[...g.map(a=>coord(a,0)),...[...g].reverse().map(a=>coord(a,1))].join(' ')+'" fill="#ed8cfa" opacity=".2"><title>Provisional historical-rate sensitivity band, not a measured range or a confidence interval</title></polygon>').join('');
}
function formatHistoricalBand(band,key){
 return band.map((v,i)=>(key==='ph'?(i===0&&v===6?'≤':i===1&&v===9?'≥':''):'')+v.toFixed(key==='ph'?2:1)).join('–');
}
