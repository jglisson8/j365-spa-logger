// Transfer rates, never readings, across a refill. The display band is
// sensitivity to rate assumptions, not a confidence interval.
const FORECAST_PRIOR_FULL_WEIGHT_AT=3;
function precedingFillEvents(events,anchor){
 const fill=effectiveModelFill(anchor,events),cutoff=modelTime(anchor);
 const boundary=events.find(e=>e.type==='water_change'&&e.full&&e.new_fill_cycle_id===fill),start=modelTime(boundary)??(boundary?chartTime(boundary):null);
 if(!fill||start==null||cutoff==null||start>cutoff)return [];
 return events.filter(e=>chartTime(e)<start&&effectiveModelFill(e,events)!==fill);
}
function cyaDecayRate(rows,target){
 if(!rows.length)return null;
 const mean=rs=>rs.reduce((s,r)=>s+r.k*r.weight,0)/rs.reduce((s,r)=>s+r.weight,0);
 const pool=mean(rows),groups=new Map();
 for(const r of rows)if(r.cyaBand!=null){if(!groups.has(r.cyaBand))groups.set(r.cyaBand,[]);groups.get(r.cyaBand).push(r);}
 const bands=[...groups.keys()].sort((a,b)=>a-b);
 // Each band borrows one interval's worth of evidence from the overall pool.
 const rate=band=>{const group=groups.get(band),w=group.reduce((s,r)=>s+r.weight,0);return (w*mean(group)+pool)/(w+1);};
 if(target==null||!bands.length)return {k:pool,bands,nearest:null};
 const lo=bands.filter(b=>b<=target).at(-1)??bands[0],hi=bands.find(b=>b>=target)??bands.at(-1);
 const mix=hi===lo?0:(target-lo)/(hi-lo);
 return {k:(1-mix)*rate(lo)+mix*rate(hi),bands,nearest:Math.min(Math.abs(target-lo),Math.abs(target-hi))};
}
function forecastDecayPrior(events,anchor,model){
 const n=model.intervals.length,past=precedingFillEvents(events,anchor);
 const at=new Date(modelTime(anchor)).toISOString(),cya=model.currentCya?.band;
 const rows=(past.length?buildDecayModel(past,false,at).eligibleIntervals:[]).slice(-24);
 const local=(model.allEligibleIntervals??model.eligibleIntervals).slice(-24);
 const basis=cyaDecayRate([...rows.map(r=>({...r,weight:r.weight*.5})),...local],cya);
 if(!basis)return model;
 const strength=.5/(1+(basis.nearest??30)/10),fraction=n?strength/(n+strength):1;
 const k=n?(1-fraction)*model.k+fraction*basis.k:basis.k;
 const spread=basis.nearest==null||basis.nearest>5?2.5:1.75;
 const oldMin=Math.min(basis.k/spread,...rows.map(r=>r.k),...local.map(r=>r.k));
 const oldMax=Math.max(basis.k*spread,...rows.map(r=>r.k),...local.map(r=>r.k));
 const widen=(old,local)=>n?(1-fraction)*local+fraction*old:old;
 const context={kind:'fc',historical_pairs:rows.length,local_pairs:n,weight:fraction,bands:basis.bands,current_band:cya??null};
 return {...model,k,minK:widen(oldMin,model.minK),maxK:widen(oldMax,model.maxK),maxHours:n?model.maxHours:Math.max(...rows.concat(local).map(r=>r.hours)),rate_basis:context,prior:n<FORECAST_PRIOR_FULL_WEIGHT_AT&&(rows.length||!n)?context:undefined};
}
function forecastPhPrior(events,sample,local){
 const n=local.exact??local.rows?.filter(r=>!r.bounded).length??0;
 if(local.ready&&local.independent&&n>=FORECAST_PRIOR_FULL_WEIGHT_AT)return local;
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
  const seatFit=local.seatFit?.learned?local.seatFit:old.seatFit??{index:1,exponent:.5,learned:false};
  const shrink=old.exact/(old.exact+2),weight=local.ready?.5/(n+.5):1;
  // One numeric interval cannot separate idle loss from jet loss, but it
  // can nudge the overall prior rate without refitting both coefficients.
  const ratios=(local.rows??[]).filter(r=>!r.bounded&&!r.bleach).map(r=>{
   const expected=shrink*(old.covered*r.hours+old.air*r.air_by_exponent[seatFit.index]);
   return expected>=.001?Math.max(0,Math.min(3,r.y/expected)):null;
  }).filter(Number.isFinite);
  const scale=!local.ready&&ratios.length?(2+ratios.reduce((a,b)=>a+b,0))/(2+ratios.length):1;
  const blend=(a,b)=>a*shrink*scale*weight+(b??0)*(1-weight);
  // Idle-only tests cannot establish that the jets have no effect.
  return {...(local.ready?local:old),covered:blend(old.covered,local.covered),air:local.independent?blend(old.air,local.air):old.air*shrink*scale,spread:Math.max(1,local.spread??0),seatFit,prior:{kind:'ph',historical_pairs:old.exact,historical_bounds:old.bounded,local_pairs:n,weight},provisional:true};
 }
 return local;
}
function historicalForecastBand(p,t){
 if(!p?.historical_prior||!p.points?.length||t<p.points[0].t||t>(p.kind==='balance'?p.horizon:Infinity)||t>=Math.min(p.forecast_stop??Infinity,p.soak_range_start??Infinity))return null;
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
 const start=Math.max(begin,p.points[0].t),stop=Math.min(end,p.kind==='balance'?p.horizon:Infinity,p.forecast_stop??Infinity,p.soak_range_start??Infinity);
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
 return groups.filter(g=>g.length>1).map(g=>'<polygon data-forecast-prior-band points="'+[...g.map(a=>coord(a,0)),...[...g].reverse().map(a=>coord(a,1))].join(' ')+'" fill="#ed8cfa" opacity=".2"><title>Forecast range from rate sensitivity, not a confidence interval</title></polygon>').join('');
}
function formatHistoricalBand(band,key){
 return band.map((v,i)=>(key==='ph'?(i===0&&v===6?'≤':i===1&&v===9?'≥':''):'')+v.toFixed(key==='ph'?2:1)).join('–');
}
