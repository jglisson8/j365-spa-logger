let guestPracticeState=null,guestPracticeLoading=null,guestPracticeSnapshotData=null;
// Explicit owner-only GETs load a redacted snapshot. No fallback network path
// exists for practice submissions, invitations, weather or arbitrary URLs.
async function guestPracticeRead(path){
 if(!['/api/me','/api/config','/api/months','/api/guests'].includes(path)&&!/^\/api\/events\?month=\d{4}-(0[1-9]|1[0-2])$/.test(path))throw Error('Unsupported snapshot read');
 const response=await guestPracticeReadFetch(path,{method:'GET',credentials:'same-origin',cache:'no-store'});if(!response.ok)throw Error('Sign in to the owner app to load real-data practice.');return response.json();
}
function guestPracticeEvent(event){
 const fields=['id','schema_version','app_version','type','timestamp','timestamp_instant','time_zone','utc_offset_minutes','date_precision','created_at','fill_cycle_id','fc_ppm','cc_ppm','ph','ph_bounds','ta_ppm','ch_ppm','cya_ppm','borates_ppm','temperature_f','acid_demand_drops','acid_demand_target_ph','bathers','duration_minutes','showered','jet_air_use','air_on_minutes','product','product_id','product_revision','product_profile','amount','unit','strength_percent','purity_percent','circulation_minutes','activity','filter_set','full','gallons','new_fill_cycle_id','starting_cya_ppm','starting_borates_ppm','cya_baseline_ppm','borates_baseline_ppm','exposure','water_source','softened','measurement_method','measurement_sources','strip_observations','test_kit','calculation','test_before_dose_id','source_test_id','product_strength','historical','weather_context','source_chemistry','measurement_context','top_off_reason','water_level_before','water_level_after'];
 const safe=Object.fromEntries(fields.filter(k=>event[k]!=null).map(k=>[k,configClone(event[k])]));if(event.custom_activity==='Standalone jets')safe.custom_activity='Standalone jets';return safe;
}
function guestPracticeUseSnapshot(id){
 const snapshot=guestPracticeSnapshotData,grant=snapshot.grants.find(g=>g.id===id);if(!grant)throw Error('Choose an invitation for practice');
 const products=grant.products.map(p=>{const used=snapshot.raw.filter(e=>e.type==='chemical_addition'&&e.product_id===p.profile.id&&e.guest_actor?.grant_id===grant.id&&Date.parse(e.created_at)>snapshot.loaded_at-86400000).reduce((sum,e)=>sum+e.amount*(PRODUCT_VOLUME[e.unit]||0),0);return {...configClone(p),max_daily_mL:Math.max(0,p.max_daily_mL-used)};});
 return {user:'Practice guest',expires_at:new Date(Date.now()+86400000).toISOString(),instructions:grant.instructions||'',config:configClone(snapshot.config),products,events:snapshot.raw.map(guestPracticeEvent),snapshot:true,snapshot_at:new Date(snapshot.loaded_at).toISOString(),grant_label:grant.label||grant.login,grant_id:grant.id};
}
async function guestPracticeInitialize(){
 if(new URLSearchParams(location.search).get('source')!=='owner')return guestPracticeSeed();
 try{
  const me=await guestPracticeRead('/api/me');if(me.role==='guest')throw Error('Owner sign-in required');
  const [saved,archive,access]=await Promise.all(['/api/config','/api/months','/api/guests'].map(guestPracticeRead));
  const months=[...new Set(archive.months||[])];if(months.length>24)throw Error('Archive is too large for this practice view');
  const documents=await Promise.all(months.map(month=>guestPracticeRead('/api/events?month='+month))),raw=guestActivePracticeEvents(documents.flatMap(d=>d.document.events));
  const now=Date.now(),grants=access.policy.grants.filter(g=>!g.revoked&&Date.parse(g.ends_at)>now).sort((a,b)=>Number(Date.parse(a.starts_at)>now)-Number(Date.parse(b.starts_at)>now)||Date.parse(a.starts_at)-Date.parse(b.starts_at));
  if(!grants.length)throw Error('No unexpired invitation is available to rehearse');
  guestPracticeSnapshotData={raw,grants,loaded_at:now,config:{schema_version:2,spa:configClone(saved.config.spa),targets:configClone(saved.config.targets),chemicals:configClone(saved.config.chemicals),source_water:configClone(saved.config.source_water),current_fill_cycle_id:saved.config.current_fill_cycle_id}};
  return guestPracticeUseSnapshot(grants[0].id);
 }catch(error){return {...guestPracticeSeed(),snapshot_error:error.message};}
}
function guestPracticeSeed(){
 const now=Date.now(),at=offset=>{const timestamp=SpaTime.input(now-offset);return {timestamp,...SpaTime.metadata(timestamp)};},fill='practice-fill',make=(id,offset,values)=>({id,schema_version:2,created_at:new Date(now-offset).toISOString(),fill_cycle_id:fill,...at(offset),...values});
 const bleach=profileForChoice('7.5% liquid bleach'),acid=profileForChoice('Leisure Time Spa Down');
 return {user:'Practice guest',expires_at:new Date(now+86400000).toISOString(),instructions:'Practice only—do not add real chemicals based on these synthetic readings.',config:{schema_version:2,spa:{model:'Jacuzzi J-365',volume_gallons:395},current_fill_cycle_id:fill},products:[{profile:bleach,max_single_mL:120,max_daily_mL:240},{profile:acid,max_single_mL:60,max_daily_mL:100}],events:[make(fill,7*86400000,{type:'water_change',full:true,gallons:395,new_fill_cycle_id:fill,starting_cya_ppm:30,starting_borates_ppm:40}),...[[6,4,7.3],[3,2.8,7.4],[1,1.8,7.5]].map(([h,fc,ph],i)=>make('practice-sample-'+i,h*3600000,{type:'chemistry',fc_ppm:fc,ph,ta_ppm:100,ch_ppm:180}))]};
}
async function guestPracticeFetch(path,options={}){
 const answer=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}}),method=options.method||'GET';
 if(!GUEST_PRACTICE)return answer({error:'Practice API unavailable'},403);
 if(!guestPracticeState){guestPracticeLoading??=guestPracticeInitialize();guestPracticeState=await guestPracticeLoading;}const state=guestPracticeState;
 if(path==='/api/guest/me'&&method==='GET')return answer({user:state.user,user_id:'practice-guest',role:'guest',csrf:'practice-only',expires_at:state.expires_at});
 if(path==='/api/guest/context'&&method==='GET')return answer(state);
 if(path==='/api/guest/entries'&&method==='POST'){
  try{
   if(options.headers?.['X-CSRF-Token']!=='practice-only')throw Error('Practice session required');
   const input=JSON.parse(options.body).event,prior=state.events.find(e=>e.id===input.id);
   if(prior){if(prior.practice_submission!==JSON.stringify(input))throw Error('Submission ID already used');return answer({ok:true,event:prior,replayed:true});}
   const instant=Date.parse(input.timestamp_instant);if(!Number.isFinite(instant)||instant>Date.now()+60000||instant<Date.now()-48*3600000||SpaTime.input(instant)!==input.timestamp)throw Error('Choose a recent, valid Mountain time');
   const fill=state.events.filter(e=>e.type==='water_change'&&e.full&&timelineOrder(e,{timestamp:input.timestamp})<=0).sort(timelineOrder).at(-1);
   const event={id:input.id,type:input.type,schema_version:2,created_at:new Date().toISOString(),timestamp:input.timestamp,...SpaTime.metadata(input.timestamp,instant),fill_cycle_id:fill?.new_fill_cycle_id??state.config.current_fill_cycle_id??null,guest_actor:{user_id:'practice-guest',grant_id:'practice-grant',label:'Practice guest'},practice_submission:JSON.stringify(input)};
   if(input.supersedes_event_id){const old=guestActivePracticeEvents(state.events).find(e=>e.id===input.supersedes_event_id&&e.guest_actor?.user_id==='practice-guest');if(!old||input.type!=='remove'&&old.type!==input.type)throw Error('Only your own practice entries can be corrected');event.supersedes_event_id=old.id;if(input.type==='remove')Object.assign(event,{type:'note',record_removal:true,removed_record:old,notes:'Removed practice entry'});}
   if(input.type==='chemistry'){
    if(!input.readings||!Object.keys(input.readings).length)throw Error('Choose a strip reading');const readings={};for(const [key,choice]of Object.entries(input.readings)){if(!STRIP_PROFILE.blocks[key]?.map(String).includes(choice))throw Error('Choose a supported strip block');const r=stripObservation([],key,choice,instant);readings[key]=r;event[key]=r.working;}
    Object.assign(event,{measurement_method:'test_strip',measurement_sources:Object.fromEntries(Object.keys(readings).map(k=>[k,'test_strip'])),strip_observations:{schema_version:1,profile_id:STRIP_PROFILE.id,product:STRIP_PROFILE.name,readings}});
   }else if(input.type==='soak'){
    if(!Number.isInteger(input.bathers)||input.bathers<1||input.bathers>6||!Number.isInteger(input.duration_minutes)||input.duration_minutes<1||input.duration_minutes>180||typeof input.showered!=='boolean'||!['off','water_only','air_on'].includes(input.jet_air_use))throw Error('Check soak details');
    Object.assign(event,{bathers:input.bathers,duration_minutes:input.duration_minutes,showered:input.showered,jet_air_use:input.jet_air_use});
   }else if(input.type==='chemical_addition'){
    const product=state.products.find(p=>p.profile.id===input.product_id),mL=input.amount*PRODUCT_VOLUME[input.unit],used=guestActivePracticeEvents(state.events).filter(e=>e.type==='chemical_addition'&&e.guest_actor?.user_id==='practice-guest'&&e.product_id===input.product_id&&e.id!==input.supersedes_event_id&&Date.parse(e.created_at)>Date.now()-86400000).reduce((s,e)=>s+e.amount*PRODUCT_VOLUME[e.unit],0);
    if(!product||!(Number.isFinite(mL)&&mL>0)||mL>product.max_single_mL||used+mL>product.max_daily_mL)throw Error('Amount exceeds the practice dose limits');
    Object.assign(event,{product:product.profile.name,product_id:product.profile.id,product_profile:product.profile,product_revision:product.profile.revision,amount:input.amount,unit:input.unit});
   }else if(input.type!=='remove')throw Error('Unsupported practice activity');
   state.events.push(event);return answer({ok:true,event});
  }catch(error){return answer({error:error.message},400);}
 }
 // Fail closed: no fallback to real fetch, even for weather or owner endpoints.
 return answer({error:'Not available in practice mode. Nothing was sent or synced.'},403);
}
function guestActivePracticeEvents(events){const replaced=new Set(events.map(e=>e.supersedes_event_id).filter(Boolean));return events.filter(e=>!e.record_removal&&!replaced.has(e.id));}
function setupGuestPractice(){
 if(typeof window==='undefined'||!document.querySelector)return;
 if(!guestPage()){
  const link=document.createElement('a');link.id='guestPracticeLink';link.href='/guest?practice=1&source=owner';link.target='_blank';link.rel='noopener';link.className='secondary';link.textContent='Try guest practice mode';const help=document.createElement('p');help.className='help';help.textContent='Owner sign-in loads saved water history and an unexpired invitation’s products and remaining limits, including upcoming invitations. Practice additions never sync or activate access. No invitation? A clearly labeled synthetic demo is used instead.';$('guestManagement').prepend(link,help);return;
 }
 if(!GUEST_PRACTICE)return;
 const badge=document.createElement('p');badge.id='guestPracticeBadge';badge.className='help';badge.style.color='#ffd18b';badge.textContent='Practice only · nothing saves to your real tub';document.querySelector('.status').after(badge);
 const banner=document.createElement('aside');banner.id='guestPracticeBanner';banner.className='panel';banner.setAttribute('role','status');banner.innerHTML='<strong>Practice only · synthetic water data</strong><p>No entries sync or persist. Do not use these sample doses on your real tub.</p><button id="resetGuestPractice" class="secondary" type="button">Reset practice</button> <a href="/" rel="noopener">Return to owner app</a>';$('guestPanel').before(banner);
 $('resetGuestPractice').onclick=()=>{if(confirm('Discard practice entries and start over? Your real history is unaffected.'))location.reload();};
 const logout=document.querySelector('#guestPanel a[href="/guest/logout"]');if(logout){logout.href='/';logout.textContent='Leave practice';}
 const reminder=guestDoseReminder;guestDoseReminder=function(){reminder();$('guestAfterDose').querySelector('p').textContent='Practice dose recorded—not a real addition. In the real workflow: '+GUEST_AFTER_DOSE;};
 const status=guestStatus;guestStatus=function(message){status('Practice · '+message);};
}
function refreshGuestPracticeBanner(){
 const banner=$('guestPracticeBanner'),state=guestPracticeState;if(!banner||!state)return;
 banner.querySelector('strong').textContent=state.snapshot?'Practice only · actual water snapshot':'Practice only · synthetic water data';
 banner.querySelector('p').textContent=state.snapshot?'Saved data loaded '+SpaTime.format(Date.parse(state.snapshot_at),{dateStyle:'short',timeStyle:'short'})+'. Forecasts and calculations use this snapshot; practice entries never sync or persist. Do not add real chemicals from practice mode.':(state.snapshot_error?state.snapshot_error+'. Using a synthetic demo instead. ':'')+'No entries sync or persist. Do not use these sample doses on your real tub.';
 if(state.snapshot&&!$('guestPracticeGrant')){const label=document.createElement('label');label.htmlFor='guestPracticeGrant';label.textContent='Invitation to rehearse';const select=document.createElement('select');select.id='guestPracticeGrant';for(const grant of guestPracticeSnapshotData.grants){const option=document.createElement('option');option.value=grant.id;option.textContent=grant.label||grant.login;select.append(option);}select.value=state.grant_id;select.onchange=async()=>{if(!confirm('Discard temporary practice entries and switch invitation? Real records are unaffected.')){select.value=guestPracticeState.grant_id;return;}guestPracticeState=guestPracticeUseSnapshot(select.value);guestPending=null;guestCorrection=null;$('guestCancel').click();$('guestAmount').value='';for(const key of Object.keys(STRIP_PROFILE.blocks))$('guest-'+key).value='';await connectGuest();};banner.append(label,select);}
}
