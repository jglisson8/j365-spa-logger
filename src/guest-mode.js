function guestPage(){return typeof location!=='undefined'&&location.pathname==='/guest';}
let guestContext=null,guestPending=null,guestBusy=false,guestCorrection=null,guestBaseline=null;
function guestSignature(){return $('guestForm')?JSON.stringify([...$('guestForm').querySelectorAll('input,select')].map(e=>[e.id,e.value,e.checked])):null;}
function guestStatus(message){if($('guestStatus'))$('guestStatus').textContent=message;}
async function guestRemove(id){
 if(guestBusy||!confirm('Remove your own accidental entry? The original remains in the audit history.'))return;
 const old=guestContext?.events.find(e=>e.id===id);if(!old)return;guestBusy=true;
 try{const event={id:crypto.randomUUID(),type:'remove',timestamp:old.timestamp,timestamp_instant:old.timestamp_instant,supersedes_event_id:old.id};await api('/api/guest/entries',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf},body:JSON.stringify({event})});await connectGuest();guestStatus('Entry removed.');}catch(e){guestStatus(e.message);}finally{guestBusy=false;}
}
async function connectGuest(){
 const clean=!guestContext||guestBaseline===guestSignature();
 try{
  if(guestInvitationToken){await api('/api/guest/redeem',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({invitation:guestInvitationToken})});guestInvitationToken=null;}
  session=await api('/api/guest/me');if(session.role!=='guest')throw Error('Open your guest invitation link.');
  const data=await api('/api/guest/context');guestContext=data;config=data.config;write(data.events);render();
  $('identity').textContent='Guest · '+data.user;$('syncState').textContent='Connected';
  $('guestInstructions').textContent=data.instructions||'Record strip tests, soaks and completed doses. Forecasts are approximate, not acid-dose instructions.';
  $('guestExpiry').textContent='Access ends '+SpaTime.format(Date.parse(data.expires_at),{dateStyle:'medium',timeStyle:'short'});
  const selectedProduct=$('guestProduct').value;
  $('guestProduct').innerHTML='<option value="">Choose product</option>'+data.products.map(p=>'<option value="'+esc(p.profile.id)+'">'+esc(p.profile.name)+'</option>').join('');
  $('guestProduct').value=data.products.some(p=>p.profile.id===selectedProduct)?selectedProduct:clean?data.products[0]?.profile.id||'':'';
  $('guestKind').querySelector('[value="chemical_addition"]').disabled=!data.products.length;
  $('guestOwnEntries').innerHTML=data.events.filter(e=>e.guest_actor?.user_id===session.user_id).sort((a,b)=>compareSpa(b,a)).slice(0,30).map(e=>'<div class="entry"><small>'+esc(e.timestamp)+'</small><strong>'+esc(label(e))+'</strong><button type="button" class="secondary" data-guest-correct="'+esc(e.id)+'">Correct my entry</button> <button type="button" class="secondary" data-guest-remove="'+esc(e.id)+'">Remove my entry</button></div>').join('')||'<p>No entries yet.</p>';
  guestStatus('Connected. Guest logging requires internet; private history is not saved on this device.');
  if(clean)guestBaseline=guestSignature();
  return true;
 }catch(error){session=null;guestContext=null;write([]);if(typeof chartViewer!=='undefined'&&chartViewer.open)chartViewer.close();render();$('identity').textContent='Guest access';$('syncState').textContent='Invitation required';guestStatus(error.status===401?'Open the invitation link sent by the spa owner. No GitHub account is needed.':error.message);return false;}
}
function guestInput(){
 const ts=$('guestAt').value,type=$('guestKind').value,event={id:guestPending?.id||crypto.randomUUID(),type,timestamp:ts,timestamp_instant:SpaTime.metadata(ts).timestamp_instant};
 if(guestCorrection)event.supersedes_event_id=guestCorrection;
 if(type==='chemistry'){event.readings={};for(const k of Object.keys(STRIP_PROFILE.blocks))if($('guest-'+k).value)event.readings[k]=$('guest-'+k).value;if(!Object.keys(event.readings).length)throw Error('Choose at least one strip reading.');}
 if(type==='soak')Object.assign(event,{bathers:Number($('guestBathers').value),duration_minutes:Number($('guestMinutes').value),showered:$('guestShowered').checked,jet_air_use:$('guestAir').value});
 if(type==='chemical_addition')Object.assign(event,{product_id:$('guestProduct').value,amount:Number($('guestAmount').value),unit:$('guestUnit').value});return event;
}
function setupGuestMode(){
 if(typeof window==='undefined'||!document.querySelector)return;
 const describe=label;label=function(e){return describe(e)+(e.guest_actor?' · Guest: '+(e.guest_actor.label||e.guest_actor.login||'Guest'):'');};
 if(!guestPage()){setupGuestManagement();return;}
 document.body.classList.add('guest-mode');const style=document.createElement('style');
 style.textContent='.guest-mode #chemistryForm,.guest-mode #tab-maintenance,.guest-mode #tab-soak,.guest-mode #tab-history,.guest-mode #headerMaintenance,.guest-mode #nextActions,.guest-mode #backupStatus,.guest-mode #chartBoundsSettings,.guest-mode #pwaStatus,.guest-mode #nextService{display:none!important}.guest-mode .tabs{grid-template-columns:1fr 1fr}.guest-mode #tab-trends>div.two{display:none}';document.head.append(style);
 const decorate=decorateAppCharts;decorateAppCharts=function(...args){decorate(...args);for(const b of document.querySelectorAll('[data-edit-chart-bound],[data-bound-key]')){b.disabled=true;b.style.cursor='default';}};
 for(const b of document.querySelectorAll('.tabs [data-tab]'))if(!['chemistry','trends'].includes(b.dataset.tab))b.hidden=true;
 const logTab=document.querySelector('.tabs [data-tab="chemistry"]');logTab.querySelector('span:last-child').textContent='Log';logTab.setAttribute('aria-label','Log guest activity');
 for(const id of Object.values(CHART_BOUNDS).flatMap(v=>v.ids))if($(id))$(id).disabled=true;
 document.addEventListener('click',e=>{if(e.target.closest('[data-edit-chart-bound],[data-bound-key],[data-edit],[data-remove-record],[data-restore-record]')){e.preventDefault();e.stopImmediatePropagation();}},true);
 syncMonths=async()=>{};syncConfig=async()=>{};save=()=>{throw Error('Use the guest form to record an activity.');};
 const panel=document.createElement('section');panel.id='guestPanel';panel.innerHTML='<h2>Guest water care</h2><p id="guestExpiry" class="help"></p><p id="guestInstructions"></p><p id="guestStatus" role="status">Connecting…</p><button id="guestRefresh" type="button" class="secondary">Refresh status &amp; trends</button> <a href="/guest/logout">Sign out</a><form id="guestForm"><label for="guestKind">Record</label><select id="guestKind"><option value="chemistry">Strip test</option><option value="soak">Soak</option><option value="chemical_addition">Bleach / pH adjustment</option></select><label for="guestAt">When · Mountain time</label><input id="guestAt" type="datetime-local" required><div id="guestTest">'+Object.entries(STRIP_PROFILE.blocks).map(([k,values])=>'<label for="guest-'+k+'">'+({fc_ppm:'FC · ppm',ph:'pH',ta_ppm:'TA · ppm'}[k])+'</label><select id="guest-'+k+'"><option value="">Not tested</option>'+values.map(v=>'<option>'+v+'</option>').join('')+'</select>').join('')+'<p class="help">Choose the AQUANEXO block. Results and forecasts retain approximate ranges.</p></div><div id="guestSoak" hidden><label for="guestBathers">Bathers</label><input id="guestBathers" type="number" min="1" max="6" value="1"><label for="guestMinutes">Minutes</label><input id="guestMinutes" type="number" min="1" max="180" value="15"><label class="inline"><input id="guestShowered" type="checkbox" checked>Showered beforehand</label><label for="guestAir">Jets / air</label><select id="guestAir"><option value="air_on">Air controls open</option><option value="water_only">Air controls closed</option><option value="off">Jets off</option></select></div><div id="guestDose" hidden><label for="guestProduct">Approved product</label><select id="guestProduct"></select><label for="guestAmount">Amount actually added</label><input id="guestAmount" type="number" min="0" step="any"><label for="guestUnit">Unit</label><select id="guestUnit"><option>cup</option><option>tbsp</option><option>tsp</option><option>fl oz</option><option>mL</option></select><p class="help">Follow the owner’s instructions. This records an actual dose, not a recommendation.</p></div><button id="guestSubmit" class="primary">Save entry</button><button id="guestCancel" class="secondary" type="button" hidden>Cancel correction</button></form><h3>Your recent entries</h3><div id="guestOwnEntries"></div>';
 $('tab-chemistry').prepend(panel);$('guestAt').value=localNow();
 const kind=()=>{for(const [id,type]of [['guestTest','chemistry'],['guestSoak','soak'],['guestDose','chemical_addition']])$(id).hidden=$('guestKind').value!==type;};$('guestKind').onchange=kind;
 const clear=()=>{guestCorrection=null;guestPending=null;$('guestSubmit').textContent='Save entry';$('guestCancel').hidden=true;};$('guestCancel').onclick=clear;
 for(const event of ['input','change'])$('guestForm').addEventListener(event,()=>{guestPending=null;});
 $('guestForm').onsubmit=async e=>{e.preventDefault();if(guestBusy)return;if(!session||!guestContext){guestStatus('Connect before saving.');return;}guestBusy=true;$('guestSubmit').disabled=true;
  try{guestPending=guestInput();await api('/api/guest/entries',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf},body:JSON.stringify({event:guestPending})});clear();$('guestAmount').value='';for(const k of Object.keys(STRIP_PROFILE.blocks))$('guest-'+k).value='';$('guestAt').value=localNow();guestBaseline=guestSignature();const refreshed=await connectGuest();guestStatus(refreshed?'Saved. Trends refreshed.':'Entry saved. Reconnect to refresh Trends; do not log it again.');}catch(error){guestStatus('Save not confirmed: '+error.message+'. Retry unchanged to check the same submission safely.');}finally{guestBusy=false;$('guestSubmit').disabled=false;}
 };
 $('guestOwnEntries').onclick=e=>{const remove=e.target.closest('[data-guest-remove]');if(remove){guestRemove(remove.dataset.guestRemove);return;}const b=e.target.closest('[data-guest-correct]');if(!b)return;const old=guestContext.events.find(x=>x.id===b.dataset.guestCorrect);if(!old)return;clear();guestCorrection=old.id;$('guestKind').value=old.type;$('guestAt').value=old.timestamp;kind();if(old.type==='chemistry')for(const k of Object.keys(STRIP_PROFILE.blocks))$('guest-'+k).value=old.strip_observations?.readings[k]?.choice||'';if(old.type==='soak'){ $('guestBathers').value=old.bathers;$('guestMinutes').value=old.duration_minutes;$('guestShowered').checked=old.showered;$('guestAir').value=old.jet_air_use;}if(old.type==='chemical_addition'){ $('guestProduct').value=old.product_id;$('guestAmount').value=old.amount;$('guestUnit').value=old.unit;}$('guestSubmit').textContent='Save correction';$('guestCancel').hidden=false;};
 $('guestRefresh').onclick=connectGuest;$('syncNow').onclick=connectGuest;document.querySelector('[data-tab="chemistry"]').click();
  guestBaseline=guestSignature();appHasUnsavedWork=()=>!!guestPending||guestSignature()!==guestBaseline;
  window.addEventListener('beforeunload',e=>{if(appHasUnsavedWork()){e.preventDefault();e.returnValue='';}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!guestBusy)connectGuest();});
}
function setupGuestManagement(){
 if(!$('tab-maintenance')||$('guestManagement'))return;
 const box=document.createElement('details');box.id='guestManagement';
 box.innerHTML='<summary>Guest invitations</summary><p class="help">No account needed. Each private link allows strip tests, soaks, approved additions and read-only Trends during its access window.</p><button type="button" class="secondary" id="guestLoadAccess">Load invitations</button> <button type="button" class="secondary" id="guestCheckBackend">Check guest connection</button><p id="guestManageStatus" role="status"></p><div id="guestGrantList"></div><div id="guestLinkPanel" hidden><label for="guestInviteLink">New private invitation link</label><input id="guestInviteLink" readonly autocomplete="off" spellcheck="false"><button type="button" class="secondary" id="guestCopyInvite">Copy invitation link</button><p class="help">Treat this link like a password. Anyone holding it has this guest’s access. Copy and send privately; the link cannot be retrieved after leaving/reloading. Revoke and create another if lost.</p></div><form id="guestGrantForm" hidden><label for="guestName">Guest name</label><input id="guestName" maxlength="100" required autocomplete="off"><label for="guestStart">Access starts · Mountain time</label><input id="guestStart" type="datetime-local" required><label for="guestEnd">Access ends · Mountain time</label><input id="guestEnd" type="datetime-local" required><label for="guestOwnerInstructions">Instructions</label><textarea id="guestOwnerInstructions" maxlength="2000"></textarea><p class="help">Optional product caps are permission limits, not recommended doses. Leave unchecked for tests and soaks only.</p>'+['bleach','acid'].map(role=>'<label class="inline"><input id="guestAllow-'+role+'" type="checkbox">Allow current '+role+' product</label><div class="three"><div><label for="guestSingle-'+role+'">Maximum per addition</label><input id="guestSingle-'+role+'" type="number" min="0.000001" step="any"></div><div><label for="guestDaily-'+role+'">Maximum in 24 hours</label><input id="guestDaily-'+role+'" type="number" min="0.000001" step="any"></div><div><label for="guestLimitUnit-'+role+'">Unit for both limits</label><select id="guestLimitUnit-'+role+'">'+['cup','tbsp','tsp','fl oz','mL'].map(u=>'<option'+(u===(role==='bleach'?'cup':'tbsp')?' selected':'')+'>'+u+'</option>').join('')+'</select></div></div>').join('')+'<button class="primary">Create invitation link</button></form>';
 $('tab-maintenance').append(box);
 let remote=null,busy=false;const status=m=>$('guestManageStatus').textContent=m;
 const dirty=appHasUnsavedWork;appHasUnsavedWork=function(){return dirty()||[...$('guestGrantForm').querySelectorAll('input,textarea,select')].some(e=>e.type==='checkbox'?e.checked!==e.defaultChecked:e.tagName==='SELECT'?e.selectedIndex!==[...e.options].findIndex(o=>o.defaultSelected):e.value!==e.defaultValue);};
 $('guestCheckBackend').onclick=async()=>{try{const result=await api('/api/guests/check');status(result.ok?'Repository connection verified. '+(result.backend_enabled?'Ready for owner-created invitations.':'Guest access is disabled in Cloudflare.'):'Connection not ready.');}catch(e){status(e.status===404?'Invitation Worker deployment is still required.':e.message);}};
 const load=async()=>{
  try{
   if(!session||session.role==='guest')throw Error('Sign in as the owner first.');
   remote=await api('/api/guests');$('guestGrantForm').hidden=false;
   status(remote.backend_enabled&&remote.backend_configured?'Ready. Only guests you explicitly invite can access the app.':'Guest connection is disabled or not configured. Check the connection first.');
   $('guestGrantList').innerHTML=remote.policy.grants.map(g=>'<div class="entry"><strong>'+esc(g.label||g.login)+'</strong><small>'+esc(SpaTime.format(Date.parse(g.starts_at),{dateStyle:'medium',timeStyle:'short'}))+' → '+esc(SpaTime.format(Date.parse(g.ends_at),{dateStyle:'medium',timeStyle:'short'}))+' · '+(g.revoked?'Revoked':Date.now()>=Date.parse(g.ends_at)?'Expired':Date.now()<Date.parse(g.starts_at)?'Scheduled':'Active')+'</small>'+(g.revoked?'':' <button type="button" class="secondary" data-revoke-guest="'+esc(g.id)+'">Revoke access</button>')+'</div>').join('')||'<p class="help">No guests authorized.</p>';
  }catch(e){status(e.status===404?'Invitation Worker deployment is required. Your owner app is unchanged.':e.message);}
 };
 const persist=async policy=>{await api('/api/guests',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf},body:JSON.stringify({sha:remote.sha,policy})});await load();};
 $('guestLoadAccess').onclick=load;
 $('guestCopyInvite').onclick=async()=>{try{await navigator.clipboard.writeText($('guestInviteLink').value);status('Private invitation copied. Send it directly to this guest.');}catch{$('guestInviteLink').focus();$('guestInviteLink').select();status('Select and copy the invitation link above.');}};
 $('guestGrantList').onclick=async e=>{
  const b=e.target.closest('[data-revoke-guest]');if(!b||busy||!confirm('Revoke this guest’s access immediately, including already-open sessions?'))return;busy=true;
  try{await persist({...remote.policy,grants:remote.policy.grants.map(g=>g.id===b.dataset.revokeGuest?{...g,revoked:true}:g)});$('guestInviteLink').value='';$('guestLinkPanel').hidden=true;status('Guest access revoked.');}catch(e){status(e.message);}finally{busy=false;}
 };
 $('guestGrantForm').onsubmit=async e=>{
  e.preventDefault();if(busy||!remote)return;busy=true;const button=e.currentTarget.querySelector('button');button.disabled=true;
  try{
   const products=[];
   for(const role of ['bleach','acid'])if($('guestAllow-'+role).checked){
    const profile=productForRole(role);if(!profile||!['hypochlorite','bisulfate'].includes(profile.family))throw Error('Choose a supported bleach/dry-acid product first.');
    const unit=$('guestLimitUnit-'+role).value,scale=PRODUCT_VOLUME[unit],single=Number($('guestSingle-'+role).value),daily=Number($('guestDaily-'+role).value);
    if(!(single>0&&daily>=single))throw Error('Enter positive limits; the daily total must be at least the single-addition limit.');
    products.push({profile,max_single_mL:single*scale,max_daily_mL:daily*scale});
   }
   const invitation={label:$('guestName').value.trim(),starts_at:SpaTime.metadata($('guestStart').value).timestamp_instant,ends_at:SpaTime.metadata($('guestEnd').value).timestamp_instant,products,instructions:$('guestOwnerInstructions').value};
   const result=await api('/api/guests/invitations',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf},body:JSON.stringify({sha:remote.sha,invitation})});
   $('guestInviteLink').value=result.invitation_url;$('guestLinkPanel').hidden=false;e.target.reset();await load();status('Invitation created. Copy the private link above; no GitHub account is needed.');
  }catch(e){status(e.message+' If creation was interrupted, load invitations and revoke any unwanted entry before trying again.');}finally{busy=false;button.disabled=false;}
 };
}
