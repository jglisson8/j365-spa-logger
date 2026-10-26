let guestPracticeState=null;
function guestPracticeSeed(){
 const now=Date.now(),at=offset=>{const timestamp=SpaTime.input(now-offset);return {timestamp,...SpaTime.metadata(timestamp)};},fill='practice-fill',make=(id,offset,values)=>({id,schema_version:2,created_at:new Date(now-offset).toISOString(),fill_cycle_id:fill,...at(offset),...values});
 const bleach=profileForChoice('7.5% liquid bleach'),acid=profileForChoice('Leisure Time Spa Down');
 return {user:'Practice guest',expires_at:new Date(now+86400000).toISOString(),instructions:'Practice only—do not add real chemicals based on these synthetic readings.',config:{schema_version:2,spa:{model:'Jacuzzi J-365',volume_gallons:395},current_fill_cycle_id:fill},products:[{profile:bleach,max_single_mL:120,max_daily_mL:240},{profile:acid,max_single_mL:60,max_daily_mL:100}],events:[make(fill,7*86400000,{type:'water_change',full:true,gallons:395,new_fill_cycle_id:fill,starting_cya_ppm:30,starting_borates_ppm:40}),...[[6,4,7.3],[3,2.8,7.4],[1,1.8,7.5]].map(([h,fc,ph],i)=>make('practice-sample-'+i,h*3600000,{type:'chemistry',fc_ppm:fc,ph,ta_ppm:100,ch_ppm:180}))]};
}
async function guestPracticeFetch(path,options={}){
 const answer=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}}),method=options.method||'GET';
 if(!GUEST_PRACTICE)return answer({error:'Practice API unavailable'},403);
 guestPracticeState??=guestPracticeSeed();const state=guestPracticeState;
 if(path==='/api/guest/me'&&method==='GET')return answer({user:state.user,user_id:'practice-guest',role:'guest',csrf:'practice-only',expires_at:state.expires_at});
 if(path==='/api/guest/context'&&method==='GET')return answer(state);
 if(path==='/api/guest/entries'&&method==='POST'){
  try{
   if(options.headers?.['X-CSRF-Token']!=='practice-only')throw Error('Practice session required');
   const input=JSON.parse(options.body).event,prior=state.events.find(e=>e.id===input.id);
   if(prior){if(prior.practice_submission!==JSON.stringify(input))throw Error('Submission ID already used');return answer({ok:true,event:prior,replayed:true});}
   const instant=Date.parse(input.timestamp_instant);if(!Number.isFinite(instant)||instant>Date.now()+60000||instant<Date.now()-48*3600000||SpaTime.input(instant)!==input.timestamp)throw Error('Choose a recent, valid Mountain time');
   const event={id:input.id,type:input.type,schema_version:2,created_at:new Date().toISOString(),timestamp:input.timestamp,...SpaTime.metadata(input.timestamp,instant),fill_cycle_id:'practice-fill',guest_actor:{user_id:'practice-guest',grant_id:'practice-grant',label:'Practice guest'},practice_submission:JSON.stringify(input)};
   if(input.supersedes_event_id){const old=guestActivePracticeEvents(state.events).find(e=>e.id===input.supersedes_event_id&&e.guest_actor?.user_id==='practice-guest');if(!old||input.type!=='remove'&&old.type!==input.type)throw Error('Only your own practice entries can be corrected');event.supersedes_event_id=old.id;if(input.type==='remove')Object.assign(event,{type:'note',record_removal:true,removed_record:old,notes:'Removed practice entry'});}
   if(input.type==='chemistry'){
    if(!input.readings||!Object.keys(input.readings).length)throw Error('Choose a strip reading');const readings={};for(const [key,choice]of Object.entries(input.readings)){if(!STRIP_PROFILE.blocks[key]?.map(String).includes(choice))throw Error('Choose a supported strip block');const r=stripObservation([],key,choice,instant);readings[key]=r;event[key]=r.working;}
    Object.assign(event,{measurement_method:'test_strip',measurement_sources:Object.fromEntries(Object.keys(readings).map(k=>[k,'test_strip'])),strip_observations:{schema_version:1,profile_id:STRIP_PROFILE.id,product:STRIP_PROFILE.name,readings}});
   }else if(input.type==='soak'){
    if(!Number.isInteger(input.bathers)||input.bathers<1||input.bathers>6||!Number.isInteger(input.duration_minutes)||input.duration_minutes<1||input.duration_minutes>180||typeof input.showered!=='boolean'||!['off','water_only','air_on'].includes(input.jet_air_use))throw Error('Check soak details');
    Object.assign(event,{bathers:input.bathers,duration_minutes:input.duration_minutes,showered:input.showered,jet_air_use:input.jet_air_use});
   }else if(input.type==='chemical_addition'){
    const product=state.products.find(p=>p.profile.id===input.product_id),mL=input.amount*PRODUCT_VOLUME[input.unit],used=guestActivePracticeEvents(state.events).filter(e=>e.type==='chemical_addition'&&e.product_id===input.product_id&&e.id!==input.supersedes_event_id&&Date.parse(e.created_at)>Date.now()-86400000).reduce((s,e)=>s+e.amount*PRODUCT_VOLUME[e.unit],0);
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
  const link=document.createElement('a');link.id='guestPracticeLink';link.href='/guest?practice=1';link.target='_blank';link.rel='noopener';link.className='secondary';link.textContent='Try guest practice mode';const help=document.createElement('p');help.className='help';help.textContent='Synthetic data; no invitation or real saves. Practice does not test access-code delivery or browser activation.';$('guestManagement').prepend(link,help);return;
 }
 if(!GUEST_PRACTICE)return;
 const banner=document.createElement('aside');banner.id='guestPracticeBanner';banner.className='panel';banner.setAttribute('role','status');banner.innerHTML='<strong>Practice only · synthetic water data</strong><p>No entries sync or persist. Do not use these sample doses on your real tub.</p><button id="resetGuestPractice" class="secondary" type="button">Reset practice</button> <a href="/" rel="noopener">Return to owner app</a>';$('guestPanel').before(banner);
 $('resetGuestPractice').onclick=()=>{if(confirm('Discard practice entries and start over? Your real history is unaffected.'))location.reload();};
 const logout=document.querySelector('#guestPanel a[href="/guest/logout"]');if(logout){logout.href='/';logout.textContent='Leave practice';}
 const reminder=guestDoseReminder;guestDoseReminder=function(){reminder();$('guestAfterDose').querySelector('p').textContent='Practice dose recorded—not a real addition. In the real workflow: '+GUEST_AFTER_DOSE;};
 const status=guestStatus;guestStatus=function(message){status('Practice · '+message);};
}
