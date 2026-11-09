// Additive refill, exposure and dose-response views. Never rewrite source events.
function refillSettings(){
 const saved=generalPatch.refill_settings?.value??config?.refill_settings??{};
 const n=(k,d,lo,hi,integer=false)=>Number.isFinite(saved[k])&&saved[k]>=lo&&saved[k]<=hi&&(!integer||Number.isInteger(saved[k]))?saved[k]:d;
 const low=n('post_acid_low',config?.targets?.ph_post_adjustment_min??7.2,7,7.8),high=n('post_acid_high',config?.targets?.ph_post_adjustment_max??7.4,7,7.8);
 return {cya:n('cya',config?.targets?.cya_ppm??30,0,100),borates:n('borates',config?.targets?.borates_ppm??40,0,60),post_acid_low:low<high?low:7.2,post_acid_high:high>low?high:7.4,seats:n('seats',4,1,12,true),standalone_seats:n('standalone_seats',4,1,12,true),acid_max_minutes:n('acid_max_minutes',120,60,180,true)};
}
function aerationMetrics(e,minutes=e.exposure?.duration_minutes??e.duration_minutes){
 const jets=e.exposure?.kind==='jets',mode=jets?(e.exposure.air_on?'air_on':'water_only'):e.jet_air_use;
 if(!(minutes>=0)||!['air_on','mixed','water_only','off'].includes(mode))return null;
 const settings=refillSettings(),metadata=jets?e.exposure:e,capacity=metadata.aeration_seat_capacity??settings.seats;
 const nominal=jets?settings.standalone_seats:Math.min(capacity,Math.max(0,e.bathers??1)*(mode==='mixed'?.5:1));
 const seats=mode==='off'||mode==='water_only'?0:Math.max(0,Math.min(capacity,metadata.aerating_seats??nominal));
 const airMinutes=mode==='off'||mode==='water_only'?0:Math.max(0,Math.min(minutes,metadata.air_on_minutes??minutes));
 return {mode,seats,airMinutes,minutes,seatMinutes:seats*airMinutes};
}
function aerationGasLevel(e,exponent=.5){
 const m=aerationMetrics(e);
 if(!m||!m.minutes||m.mode==='off')return null;
 const water=PH_GAS.water_jet_equivalent;
 return water+(1-water)*m.seats**exponent*m.airMinutes/m.minutes;
}
function empiricalJetEffect(e,overlap,effects){
 const m=aerationMetrics(e);if(!m?.minutes||m.mode==='off')return 0;
 const air=overlap*m.airMinutes/m.minutes;
 return (air*Math.sqrt(m.seats)*effects.coefficients[4]+(overlap-air)*effects.coefficients[5])/15;
}
function fitAerationExponent(rows){
 const fallback={index:1,exponent:.5,learned:false,count:0},exact=rows.filter(r=>!r.bounded&&!r.bleach&&r.air_by_exponent?.[1]>0);
 const idle=rows.filter(r=>!r.bounded&&!r.bleach&&r.air_by_exponent?.[1]===0);
 // Need both a covered-water baseline and varied intensity. Equal intensity
 // can fit a rate but cannot identify how it scales with the number of seats.
 if(exact.length<4||idle.length<2||new Set(exact.map(r=>(r.air_by_exponent[2]/r.air_by_exponent[0]).toFixed(2))).size<2)return {...fallback,count:exact.length};
 const covered=median(idle.map(r=>r.y/r.hours)),loss=r=>Math.max(0,r.y-covered*r.hours);
 const error=index=>exact.reduce((sum,row)=>{
  const other=exact.filter(r=>r!==row),rate=other.reduce((s,r)=>s+r.air_by_exponent[index]*loss(r),0)/other.reduce((s,r)=>s+r.air_by_exponent[index]**2,0);
  return sum+(row.air_by_exponent[index]*rate-loss(row))**2;
 },0),errors=[0,1,2].map(error),best=errors.indexOf(Math.min(...errors));
 return best!==1&&errors[best]<.85*errors[1]?{index:best,exponent:[.25,.5,.75][best],learned:true,count:exact.length}:{...fallback,count:exact.length};
}
function aerationSessionStart(e){return e?.type==='maintenance'&&e.aeration_session?.state==='started'&&modelTime(e)!=null;}
function aerationClockFields(now){
 const ms=Math.floor(now/1000)*1000,timestamp=SpaTime.input(ms)+':'+String(new Date(ms).getUTCSeconds()).padStart(2,'0');
 return {timestamp,...SpaTime.metadata(timestamp,ms)};
}
function aerationStartRecord(now,settings){
 const clock=aerationClockFields(now);spaEntryChoices.set(clock.timestamp,modelTime(clock));
 return {...base('maintenance',clock.timestamp),...clock,activity:'custom',custom_activity:'Aeration started',aeration_session:{state:'started',...settings}};
}
function aerationFinishRecord(start,end){
 const clock=aerationClockFields(end),minutes=(modelTime(clock)-modelTime(start))/60000;
 if(!aerationSessionStart(start)||!(minutes>0&&minutes<=10080))return null;
 const s=start.aeration_session,{state,intended_minutes,...exposure}=s;
 const {aeration_session,...record}=start;
 return {...record,id:id(),created_at:new Date().toISOString(),supersedes_event_id:start.id,aeration_session_id:start.id,custom_activity:'Standalone jets',exposure:{...exposure,kind:'jets',duration_minutes:minutes,ended_at:clock.timestamp,ended_at_instant:clock.timestamp_instant,sunlight:false}};
}
function uniqueAerationFinishes(events,ledger=events){
 if(!ledger.some(e=>e.aeration_session_id||e.removed_record?.aeration_session_id))return events;
 const roots=new Set(),root=e=>{
  if(e.aeration_session_id)return e.aeration_session_id;
  // A removal marker retains the losing or winning finish in the audit.
  return e.removed_record?.aeration_session_id??null;
 };
 const candidates=[...ledger].filter(e=>root(e)&&e.supersedes_event_id===root(e)).sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at))||String(a.id).localeCompare(String(b.id)));
 const losers=new Set();
 for(const e of candidates){const key=root(e);if(roots.has(key))losers.add(e.id);else roots.add(key);}
 const byId=new Map(ledger.map(e=>[e.id,e]));
 return events.filter(e=>{let a=e,seen=new Set();while(a&&!seen.has(a.id)){if(losers.has(a.id))return false;seen.add(a.id);a=byId.get(a.supersedes_event_id);}return true;});
}
function elapsedAerationView(events,now){
 const ledger=events.acidAudit??events;
 const fills=events.filter(e=>e.type==='water_change'&&e.full).sort(timelineOrder);
 let changed=false;
 const result=events.map(e=>{
  const active=aerationSessionStart(e);
  if(!active&&(!isExposure(e)||e.exposure.kind!=='jets'))return e;
  const start=modelTime(e);if(start==null)return e;
  const refill=fills.find(x=>timelineOrder(x,e)>0),limit=modelTime(refill)??Infinity;
  const original=e.exposure?.duration_minutes,finish=active?now:start+original*60000,end=Math.min(limit,finish);
  if(!active&&!(end<finish))return e;
  const duration=Math.max(0,(end-start)/60000),exposure=active?e.aeration_session:e.exposure;
  const air=exposure.air_on_minutes;
  changed=true;
  return {...e,exposure:{...exposure,kind:'jets',duration_minutes:duration,active,...(Number.isFinite(air)&&!active&&original>0?{air_on_minutes:air*duration/original}:{})}};
 });
 if(!changed)return events;
 Object.defineProperty(result,'acidAudit',{value:ledger});return result;
}
// Guidance treats a session as an interval, not a point at its start.
function jetRetestState(events,fill,now){
 const jets=elapsedAerationView(events,now).filter(e=>isExposure(e)&&e.exposure.kind==='jets'&&effectiveModelFill(e,events)===fill&&modelTime(e)!=null&&modelTime(e)<=now&&!e.historical);
 const active=jets.some(e=>e.exposure.active||modelTime(e)+e.exposure.duration_minutes*60000>now);
 const end=Math.max(-Infinity,...jets.filter(e=>!e.exposure.active&&e.exposure.duration_minutes>0).map(e=>modelTime(e)+e.exposure.duration_minutes*60000));
 return {active,ids:jets.map(e=>e.id),needsRetest:sample=>active||Number.isFinite(end)&&(!sample||modelTime(sample)<end)};
}
function highChlorineTest(events,fill,cutoff){
 if(!fill||!Number.isFinite(cutoff))return null;
 // Strip working values cannot clear a known high Taylor result.
 const measured=events.filter(e=>e.type==='chemistry'&&!e.historical&&Number.isFinite(e.fc_ppm)&&!isStripParameter(e,'fc_ppm')&&modelTime(e)!=null&&modelTime(e)<=cutoff&&effectiveModelFill(e,events)===fill).sort(timelineOrder).at(-1);
 return measured?.fc_ppm>10?measured:null;
}
function acidFitContext(events,e,ta){
 const t=modelTime(e),at=t==null?e.timestamp:new Date(t).toISOString();
 const cya=calculatedCya(events,at,'before'),borates=calculatedBorates(events,at,'before'),environment=environmentContext(events,at),temperature=environment.temperature_source==='logged'?environment.temperature_f:null;
 return {ta_ppm:ta,borates_ppm:borates.value,cya_ppm:cya.value,temperature_f:temperature??106,temperature_assumed:temperature==null,inventory_known:cya.value!=null&&borates.value!=null&&!cya.issues?.length&&!borates.issues?.length};
}
function acidContextWeight(a,b){
 if(!Number.isFinite(b.ta_ppm)||!b.inventory_known)return .4;
 const distance=Math.abs(a.ta_ppm-b.ta_ppm)/50+Math.abs(a.borates_ppm-b.borates_ppm)/20+Math.abs(a.cya_ppm-b.cya_ppm)/15+Math.abs(a.temperature_f-b.temperature_f)/12;
 return 1/(1+distance*distance);
}
function acidDoseCalibration(events,at=localNow(),profile=null){
 const cutoff=Number.isFinite(at)?at:at===localNow()?Date.now():parseSpaTime(at),fill=Number.isFinite(cutoff)?fillAtTime(events,new Date(cutoff).toISOString()):null,key=profileCalibrationKey(profile);
 const available=elapsedAerationView(events,cutoff).filter(e=>modelTime(e)==null?chartTime(e)<=cutoff:modelTime(e)<=cutoff&&(!e.created_at||parseSpaTime(e.created_at)<=cutoff)).sort(timelineOrder);
 const tests=available.filter(e=>e.type==='chemistry'&&!e.historical&&modelTime(e)!=null&&(Number.isFinite(e.ph)||e.ph_bounds)),rows=[],bounds=[];
 const acid=/^(leisure time spa down|spa down|dry acid|sodium bisulfate)$/i;
 for(const dose of available.filter(e=>e.type==='chemical_addition'&&!e.historical&&modelTime(e)!=null&&acid.test(chemicalName(e))&&productCalibrationKey(e)===key)){
  const cohort=effectiveModelFill(dose,events),when=modelTime(dose),before=tests.filter(e=>modelTime(e)<when&&effectiveModelFill(e,events)===cohort).at(-1);
  const earliest=when+Math.max(15,dose.circulation_minutes??0)*60000;
  const after=tests.find(e=>modelTime(e)>=earliest&&effectiveModelFill(e,events)===cohort);
  if(!cohort||!before||!Number.isFinite(after?.ph)||dose.test_before_dose_id&&dose.test_before_dose_id!==before.id)continue;
  const start=modelTime(before),end=modelTime(after),minutes=(end-when)/60000;
  if(when-start>2*3600000||minutes<Math.max(15,dose.circulation_minutes??0)||minutes>refillSettings().acid_max_minutes||[before,after].some(e=>['left_open','blown_open'].includes(e.cover_condition)))continue;
  const disturbance=(a,b)=>available.some(e=>e.id!==dose.id&&(
   isExposure(e)?fcDisturbance(e,modelTime(a),modelTime(b)):
   ['chemical_addition','soak','water_change','water_top_off'].includes(e.type)&&(modelTime(e)==null?overlapsModelInterval(e,a,b):
    e.type==='soak'?modelTime(e)<=modelTime(b)&&modelTime(e)+(e.duration_minutes??0)*60000>modelTime(a):
    modelTime(e)>=modelTime(a)&&modelTime(e)<=modelTime(b)&&!(e.type==='water_change'&&e.full&&timelineOrder(e,a)<0&&modelTime(e)===modelTime(a)))
  ));
  if(disturbance(before,after))continue;
  const ta=available.filter(e=>e.type==='chemistry'&&!e.historical&&Number.isFinite(e.ta_ppm)&&modelTime(e)!=null&&timelineOrder(e,before)<=0&&effectiveModelFill(e,events)===cohort).at(-1);
  if(!ta||start-modelTime(ta)>3600000||ta.id!==before.id&&disturbance(ta,before))continue;
  if([before,ta,after].some(sample=>highChlorineTest(available,cohort,modelTime(sample))))continue;
  const context=acidFitContext(events,before,ta.ta_ppm),afterContext=acidFitContext(events,after,after.ta_ppm);
  if(!context.inventory_known||!afterContext.inventory_known||Math.abs(context.cya_ppm-afterContext.cya_ppm)>2||Math.abs(context.borates_ppm-afterContext.borates_ppm)>2||Math.abs(context.temperature_f-afterContext.temperature_f)>4)continue;
  const change=theoreticalTaChange(dose,events);if(!(change<0)||!(ta.ta_ppm+change>0))continue;
  if(Number.isFinite(after.ta_ppm)&&Math.abs(after.ta_ppm-(ta.ta_ppm+change))>Math.max(10,.25*Math.abs(change)))continue;
  const response=ph=>{
   const carbon=carbonFromPh(ph,context),q=carbonateTerms(after.ph,context);
   const observed=carbon>0?ta.ta_ppm-50000*(carbon*q.fraction+q.other):null;
   return observed>0?-change/observed:null;
  };
  const record={fill:cohort,context,minutes,dose_id:dose.id,before_id:before.id,after_id:after.id,ta_id:ta.id,weight:(minutes<=60?1:.5)*(context.temperature_assumed?.6:1)};
  if(Number.isFinite(before.ph)){
   const factor=response(before.ph);if(factor>=.5&&factor<=1.5&&before.ph-after.ph>=.1-1e-8)rows.push({...record,factor});
  }else{
   const b=before.ph_bounds,lo=b.minimum??(['>=','>'].includes(b.operator)?b.value:null),hi=b.maximum??(['<=','<'].includes(b.operator)?b.value:null);
   const upper=Number.isFinite(lo)?response(lo):null,lower=Number.isFinite(hi)?response(hi):null;
   const low=Math.max(.5,lower??.5),high=Math.min(1.5,upper??1.5);
   if(low<=high&&(low>.5||high<1.5))bounds.push({...record,lower:low,upper:high});
  }
 }
 const latestTa=available.filter(e=>e.type==='chemistry'&&!e.historical&&Number.isFinite(e.ta_ppm)&&effectiveModelFill(e,events)===fill).at(-1),context=Number.isFinite(cutoff)?acidFitContext(events,{timestamp:new Date(cutoff).toISOString()},latestTa?.ta_ppm):{};
 const current=rows.filter(r=>r.fill===fill),prior=rows.filter(r=>r.fill!==fill).slice(-8);
 let sum=1,weight=1,localWeight=0;
 for(const row of current.slice(-24)){const w=row.weight*acidContextWeight(row.context,context);sum+=row.factor*w;weight+=w;localWeight+=w;}
 for(const row of prior){const w=.075*row.weight*acidContextWeight(row.context,context);sum+=row.factor*w;weight+=w;}
 let fitted=sum/weight;const localBounds=bounds.filter(r=>r.fill===fill);
 for(const row of localBounds.slice(-8)){const w=.15*row.weight*acidContextWeight(row.context,context);sum+=Math.max(row.lower,Math.min(row.upper,fitted))*w;weight+=w;}
 fitted=sum/weight;
 const residual=current.slice(-24).map(r=>Math.abs(r.factor-fitted)),width=Math.max(.05,(.25+(residual.length?median(residual):0))/Math.sqrt(1+localWeight));
 return {factor:Math.round(Math.min(1,Math.max(.5,fitted))*1000)/1000,estimated_factor:fitted,count:current.length,prior_count:prior.length,bounded_count:localBounds.length,provisional:localWeight<4,quality:!localWeight?(prior.length||localBounds.length?'provisional prior / bounds':'reference only'):localWeight<4?'limited current-fill evidence':'more current-fill evidence',fill,product_key:key,context,scenario_range:[Math.max(.5,fitted-width),Math.min(1.5,fitted+width)],rows:current.slice(-8),version:'acid-response-context-v2'};
}
