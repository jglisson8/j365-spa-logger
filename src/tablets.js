// Continuous-source ledger. Counts are never converted into instantaneous FC.
const TABLET_LABEL_URL='https://www3.epa.gov/pesticides/chem_search/ppls/007364-00057-20250310.pdf';
const TABLET_MASS_REFERENCE={grams:.5*28.349523125,url:'https://imperialpoolsb2b.com/documents/glb71250-Installation-Manual.pdf',basis:'GLB product sheet nominal ½ oz; not individually weighed'};
function isTabletStart(e){return e?.tablet_dispenser?.schema_version===1&&e.tablet_dispenser.action==='start'||e?.type==='chemical_addition'&&/trichlor/i.test(e.product??'')&&/^tablets?$/.test(e.unit??'');}
function isTabletRecord(e){return isTabletStart(e)||e?.tablet_dispenser?.schema_version===1&&!!e.tablet_dispenser.session_id;}
function tabletWindows(events){
 if(!events.some(isTabletStart))return [];
 const ordered=events.slice().sort(timelineOrder);
 return ordered.filter(isTabletStart).flatMap(e=>{
  const start=modelTime(e),fill=effectiveModelFill(e,events);if(start==null||!fill)return [];
  const changes=ordered.filter(x=>x.tablet_dispenser?.session_id===e.id&&modelTime(x)>=start);
  const explicit=changes.find(x=>['removed','exhausted'].includes(x.tablet_dispenser.action));
  // Owner policy: the next liquid-bleach dose means the floater was removed
  // and its contents exhausted. This is an assumption, never an observation.
  const bleach=ordered.find(x=>x.type==='chemical_addition'&&!isTabletRecord(x)&&modelTime(x)>start&&effectiveModelFill(x,events)===fill&&/bleach|liquid.*chlorine|hypochlorite/i.test(chemicalName(x)));
  const refill=ordered.find(x=>x.type==='water_change'&&x.full&&modelTime(x)>start);
  const ends=[explicit,bleach,refill].filter(Boolean).sort(timelineOrder),endEvent=ends[0];
  return [{event:e,start,end:endEvent?modelTime(endEvent):Infinity,endEvent,fill,changes,end_assumed:!!endEvent&&endEvent===bleach,status:!endEvent?'active':endEvent===bleach?'assumed exhausted / removed':endEvent===refill?'ended at refill':endEvent.tablet_dispenser.action}];
 });
}
function tabletOverlap(events,start,end,fill=null){return tabletWindows(events).filter(w=>(!fill||w.fill===fill)&&w.start<end&&w.end>=start);}
function tabletContext(events,now=Date.now(),anchor=now){
 const fill=fillAtTime(events,new Date(now).toISOString());
 const windows=tabletWindows(events).filter(w=>w.fill===fill&&w.start<=now&&w.end>=anchor);
 return windows.length?{windows,active:windows.some(w=>w.end>now),release_known:false,reason:'Trichlor release is unknown. Tablet-period tests are excluded from bleach-response and normal decay calibration.'}:null;
}
function tabletCapacityScenario(events,ts,phase,baselineValue){
 const at=parseSpaTime(ts),fill=fillAtTime(events,ts),windows=tabletWindows(events).filter(w=>w.fill===fill&&w.start<=at&&!(phase==='before'&&w.start===at));
 if(!windows.length||!Number.isFinite(baselineValue))return null;
 const first=Math.min(...windows.map(w=>w.start));
 // A later measured baseline already includes unknown tablet CYA. Do not
 // add the entire load again. Water loss also makes a simple endpoint invalid.
 if(events.some(e=>effectiveModelFill(e,events)===fill&&modelTime(e)>=first&&modelTime(e)<=at&&(e.type==='chemistry'&&Number.isFinite(e.cya_ppm)||e.type==='note'&&Number.isFinite(e.cya_baseline_ppm)||isPartialWaterChange(e)||e.type==='water_top_off'&&e.top_off_reason==='water_loss')))return null;
 let mass=0,nominal=false;
 for(const w of windows){
  if(w.status==='removed'&&w.end<=at)return null;
  const recorded=w.event.tablet_dispenser?.tablet_mass_g;
  if(Number.isFinite(recorded)&&recorded>0)mass+=recorded*w.event.amount;
  else if(/^GLB\b.*trichlor.*tablets$/i.test(w.event.product??'')){mass+=TABLET_MASS_REFERENCE.grams*w.event.amount;nominal=true;}
  else return null;
 }
 const liters=fillVolume(events,ts)*3.78541,cya=mass*.99*129.07/232.41*1000/liters,target=refillSettings().cya;
 return {kind:'full_dissolution_capacity_not_current',baseline_cya_ppm:baselineValue,tablet_cya_ppm:cya,full_dissolution_cya_ppm:baselineValue+cya,total_product_grams:mass,cumulative_fc_capacity_ppm:mass*.9*1000/liters,nominal_mass:nominal,mass_basis:nominal?TABLET_MASS_REFERENCE.basis:'Recorded tablet mass',source_url:nominal?TABLET_MASS_REFERENCE.url:TABLET_LABEL_URL,target_cya_ppm:target,fraction_to_target:cya>0?(target-baselineValue)/cya:null};
}
function tabletCyaInventory(events,ts,phase,base){
 const at=parseSpaTime(ts),fill=fillAtTime(events,ts);
 const baseline=events.filter(e=>effectiveModelFill(e,events)===fill&&compareSpa(e,ts)<=0&&(e.type==='chemistry'&&Number.isFinite(e.cya_ppm)||e.type==='note'&&Number.isFinite(e.cya_baseline_ppm))).sort(timelineOrder).at(-1);
 let minimum=base.value,maximum=base.value,uncertain=false;
 const limit=baseline?modelTime(baseline):-Infinity;
 for(const w of tabletWindows(events).filter(w=>w.fill===fill&&w.start<=at&&!(phase==='before'&&w.start===at))){
  if(w.end<limit)continue;
  const p=w.event.tablet_dispenser??{},initial=Number.isFinite(p.tablet_mass_g)&&p.tablet_mass_g>0?p.tablet_mass_g*w.event.amount:null;
  const points=w.changes.filter(e=>modelTime(e)<=at&&modelTime(e)<=w.end&&!(phase==='before'&&modelTime(e)===at)&&Number.isFinite(e.tablet_dispenser.dissolved_mass_g)&&e.tablet_dispenser.dissolved_mass_g>=0).sort(timelineOrder);
  const before=points.filter(e=>modelTime(e)<=limit).at(-1),last=points.at(-1);
  const exhausted=w.end<=at&&(w.status==='exhausted'||w.end_assumed);
  const removed=w.end<=at&&w.status==='removed';
  const released=exhausted&&initial!=null?initial:last?.tablet_dispenser.dissolved_mass_g??0;
  // A checkpoint is an observed cumulative mass, not a constant release rate.
  // Baselines taken during dispensing already contain an unknown portion.
  const exactEnd=(exhausted&&initial!=null)||(removed&&last&&modelTime(last)===w.end);
  const startKnown=w.start>limit||w.start===limit&&phase==='before';
  const startMass=startKnown?0:before&&modelTime(before)===limit?before.tablet_dispenser.dissolved_mass_g:null;
  const low=startMass!=null?Math.max(0,released-startMass):0;
  const high=initial!=null?Math.max(0,(exactEnd?released:initial)-(startMass??0)):null;
  const diluted=events.some(e=>effectiveModelFill(e,events)===fill&&modelTime(e)>Math.max(w.start,limit)&&modelTime(e)<=at&&(isPartialWaterChange(e)||e.type==='water_top_off'&&e.top_off_reason==='water_loss'));
  const gramsToPpm=.99*129.07/232.41*1000/(fillVolume(events,ts)*3.78541);
  minimum+=(diluted?0:low)*gramsToPpm;
  maximum=maximum==null||high==null?null:maximum+high*gramsToPpm;
  if(!exactEnd||startMass==null||diluted||high==null||Math.abs(low-high)>1e-9)uncertain=true;
 }
 if(!uncertain&&minimum===base.value)return base;
 if(!uncertain)return {...base,value:minimum,band:base.issues.length?null:Math.floor(minimum/5)*5,source:'Dichlor + recorded trichlor dissolution'};
 return {...base,value:null,band:null,known_minimum:minimum,range:[minimum,maximum],capacity_scenario:tabletCapacityScenario(events,ts,phase,base.value),source:'Dichlor + uncertain trichlor dissolution',issues:[...base.issues,'Tablet mass / cumulative dissolution is not fully known; CYA target is not confirmed.']};
}
function tabletFcProjection(events,now){
 const fill=fillAtTime(events,new Date(now).toISOString()),sample=events.filter(e=>e.type==='chemistry'&&!e.historical&&Number.isFinite(e.fc_ppm)&&modelTime(e)<=now&&effectiveModelFill(e,events)===fill).sort(timelineOrder).at(-1);
 const context=tabletContext(events,now,sample?modelTime(sample):now);
 if(!context)return fcProjectionCore(events,now);
 // Suppress only the *instantaneous* application of the tablet record. Keep
 // its metadata in the model input so interval exclusion remains effective.
 const scenarioEvents=events.map(e=>isTabletRecord(e)?{...e,type:'note',tablet_dispenser:e.tablet_dispenser??{schema_version:1,action:'start'}}:e);
 const p=fcProjectionCore(scenarioEvents,now);
 return {...p,tablet_context:context,forecast_kind:'conditional',scenario_current:p.current??null,cross:null,range:null,
  status:'Conditional FC estimate from the latest test and actual logged doses. '+(context.active?'Further tablet release is not included.':'Tablet contribution between the test and floater removal is not included.')+' Tablet intervals do not train bleach response or decay. Confirm with a test before another adjustment.',
  assumptions:[...(p.assumptions??[]),'Conditional curve excludes unknown tablet release; it is not a lower confidence limit or dosing recommendation.']};
}
function tabletBalanceProjection(events,key,now){
 const p=balanceProjectionWithoutTablets(events,key,now);
 const context=tabletContext(events,now,p.t??now);
 if(!context||!['ph','ta_ppm'].includes(key))return p;
 const result={...p,tablet_context:context,forecast_kind:'conditional',scenario_current:p.current??null,status:'Conditional '+(key==='ph'?'pH':'TA')+' estimate includes actual logged adjustments. Additional trichlor acidity is not included; it does not erase the expected acid effect. Confirm with a test before another adjustment.'};
 delete result.ph_model_limit;return result;
}
function confirmedTabletEvent(fill,createdAt=new Date().toISOString()){
 return {id:'trichlor-glb-20261112-1700',schema_version:2,app_version:APP_VERSION,type:'chemical_addition',timestamp:'2026-11-12T17:00:00-07:00',timestamp_instant:'2026-11-13T00:00:00.000Z',time_zone:'America/Denver',utc_offset_minutes:-420,created_at:createdAt,fill_cycle_id:fill,timestamp_approximate:true,product:'GLB 1-inch trichlor tablets',amount:4,unit:'tablets',tablet_dispenser:{schema_version:1,action:'start',method:'floating_dispenser',tablet_mass_g:null,available_chlorine_percent:90,purity_percent:99,label_url:TABLET_LABEL_URL,bleach_ends_dispensing:true,confirmed_active_at:'2026-11-23'},notes:'Owner-confirmed: four tablets added at approximately 5 PM MST November 12; no replacements. Still dissolving November 23. Count is not a dissolved dose. Subsequent liquid bleach ends dispensing by owner assumption.'};
}
function setupTabletTracking(){
 if(typeof window==='undefined'||!document.querySelector||guestPage())return;
 const box=document.createElement('details');box.id='tabletTracking';box.className='panel';
 box.innerHTML='<summary>Tablet dispenser</summary><div id="tabletStatus"></div><label for="tabletSession">Tablet load</label><select id="tabletSession"></select><label for="tabletAction">Update</label><select id="tabletAction"><option value="checkpoint">Record dissolved weight so far</option><option value="removed">Floater removed</option><option value="exhausted">Tablets exhausted</option></select><label for="tabletMass">Cumulative dissolved product (grams, optional for removal)</label><input id="tabletMass" type="number" min="0" step="any"><label for="tabletDate">Date</label><input id="tabletDate" type="date"><label for="tabletTime">Time (Mountain)</label><input id="tabletTime" type="time"><button type="button" id="saveTabletUpdate">Save dispenser update</button><p class="help">A later bleach addition automatically ends dispensing by your assumption. Time alone never exhausts a load. Weight means product dissolved, not remaining weight. No chlorine release rate is inferred from FC readings.</p>';
 $('tab-maintenance').append(box);
 const cyaPanel=document.createElement('details');cyaPanel.id='tabletCyaTrend';cyaPanel.className='panel';cyaPanel.innerHTML='<summary>CYA · tablet inventory</summary><div id="tabletCyaDetails"></div>'; $('tab-trends').insertBefore(cyaPanel,$('trendCharts'));
 const load=document.createElement('details');load.innerHTML='<summary>Add a new tablet load</summary><label for="tabletProduct">Product</label><input id="tabletProduct" value="GLB 1-inch trichlor tablets" maxlength="200"><label for="tabletCount">Number of tablets</label><input id="tabletCount" type="number" min="1" max="100" step="1" value="4"><label for="tabletWeight">Verified weight per tablet (grams, optional)</label><input id="tabletWeight" type="number" min="0.001" step="any"><button type="button" id="addTabletLoad">Record new load at date/time above</button><p class="help">For this GLB trichlor product only: 99% trichlor, 90% available chlorine. Leave tablet weight blank unless verified. A new load does not silently remove an existing one.</p>';box.append(load);
 $('addTabletLoad').onclick=()=>{
  const events=activeEvents(),ts=$('tabletDate').value+'T'+$('tabletTime').value,at=parseSpaTime(ts),count=num($('tabletCount').value),weight=num($('tabletWeight').value),product=$('tabletProduct').value.trim();
  if(!Number.isFinite(at)||at>Date.now()||!Number.isInteger(count)||count<1||count>100||weight!=null&&!(weight>0)||!/^GLB.*trichlor.*tablets$/i.test(product))return alert('Check the date, count and GLB trichlor product. Only enter a verified positive tablet weight.');
  const fill=fillAtTime(events,ts);if(!fill)return alert('Record the fill first.');
  if(events.some(e=>isTabletStart(e)&&modelTime(e)===at&&e.amount===count&&e.product===product))return;
  const event={...base('chemical_addition',ts),fill_cycle_id:fill,product,amount:count,unit:'tablets',tablet_dispenser:{schema_version:1,action:'start',method:'floating_dispenser',tablet_mass_g:weight,purity_percent:99,available_chlorine_percent:90,label_url:TABLET_LABEL_URL,bleach_ends_dispensing:true},notes:'Trichlor load; continuous release, not an immediate FC dose.'};
  save([event],'Tablet load saved');
 };
 const update=()=>{
  const events=activeEvents(),now=Date.now(),windows=tabletWindows(events).filter(w=>w.start<=now),chosen=$('tabletSession').value;
  const inventory=calculatedCya(events,localNow()),capacity=inventory.capacity_scenario;
  cyaPanel.hidden=!inventory.range;
  $('tabletCyaDetails').innerHTML=inventory.range?'<p>Known CYA ≥'+inventory.known_minimum.toFixed(1)+' ppm. Current tablet contribution is not measured.</p>'+(capacity?'<p>If the entire load dissolves: CYA ≈'+capacity.full_dissolution_cya_ppm.toFixed(1)+' ppm, including ≈'+capacity.tablet_cya_ppm.toFixed(1)+' ppm from tablets. '+esc(capacity.mass_basis)+'.</p>'+(capacity.fraction_to_target>0&&capacity.fraction_to_target<1?'<p>Your '+capacity.target_cya_ppm+' ppm target corresponds to ≈'+Math.round(capacity.fraction_to_target*100)+'% of that load dissolving—not elapsed time.</p>':''):'')+'<p class="help">No time-based dissolution curve is assumed. FC samples during dispensing do not train bleach response or ordinary decay. The conditional FC curve excludes additional tablet release.</p>':'';
  $('tabletSession').innerHTML=windows.map(w=>'<option value="'+esc(w.event.id)+'">'+esc(w.event.product)+' · '+esc(w.event.timestamp.slice(0,10))+'</option>').join('');
  if(windows.some(w=>w.event.id===chosen))$('tabletSession').value=chosen;
  $('tabletStatus').innerHTML=windows.length?windows.map(w=>'<p>'+esc(w.event.amount+' tablets · '+w.status)+(w.end_assumed?' · assumed at bleach addition':'')+' · '+(w.event.tablet_dispenser?.tablet_mass_g?'tablet weight recorded':'tablet weight unknown')+'</p>').join(''):'<p>No tablet loads recorded.</p>';
  $('saveTabletUpdate').disabled=!windows.length;
  if(!$('tabletDate').value){const ts=localNow();$('tabletDate').value=ts.slice(0,10);$('tabletTime').value=ts.slice(11,16);}
 };
 $('saveTabletUpdate').onclick=()=>{
  const events=activeEvents(),w=tabletWindows(events).find(w=>w.event.id===$('tabletSession').value),action=$('tabletAction').value,mass=num($('tabletMass').value),ts=$('tabletDate').value+'T'+$('tabletTime').value,at=parseSpaTime(ts);
  if(!w||!Number.isFinite(at)||at<w.start||at>Date.now()||at>=w.end)return alert('Choose a time during this load’s dispensing period.');
  const previous=w.changes.filter(e=>modelTime(e)<=at).map(e=>e.tablet_dispenser.dissolved_mass_g).filter(Number.isFinite),total=w.event.tablet_dispenser?.tablet_mass_g*w.event.amount;
  if(w.changes.some(e=>modelTime(e)===at&&e.tablet_dispenser.action===action&&(mass==null||e.tablet_dispenser.dissolved_mass_g===mass)))return;
  if(action==='checkpoint'&&mass==null||mass!=null&&(!(mass>=0)||mass<Math.max(0,...previous)||total>0&&mass>total))return alert('Enter a consistent cumulative dissolved weight in grams.');
  const event={...base('note',ts),fill_cycle_id:w.fill,tablet_dispenser:{schema_version:1,session_id:w.event.id,action,...(mass!=null?{dissolved_mass_g:mass}:{})},notes:'Tablet dispenser: '+action+(mass!=null?' · '+mass+' g dissolved':'')};
  if(events.some(e=>e.tablet_dispenser?.session_id===w.event.id&&e.timestamp===ts&&JSON.stringify(e.tablet_dispenser)===JSON.stringify(event.tablet_dispenser)))return;
  save([event],'Dispenser update saved');$('tabletMass').value='';
 };
 const prior=render;render=function(...args){prior(...args);update();};update();
}
