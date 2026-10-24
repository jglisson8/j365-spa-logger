// Interaction layer only: no chemistry/model/storage-schema changes.
let appWorkflowState=null;
function setupSoakAeration(){
  const oldLabel=label;label=function(e){return isExposure(e)&&e.exposure.kind==='jets'?'Jets / aeration — '+e.exposure.duration_minutes+' min · air controls '+(e.exposure.air_on?'open':'closed'):oldLabel(e);};
  const form=$('soakForm'),bathers=$('bathers'),shower=$('showered'),jets=$('jetAirUse'),button=form.querySelector('button[type="submit"]');
  const hint=document.createElement('p');hint.id='aerationHint';hint.className='help';hint.hidden=true;hint.textContent='Jets without bathers. Date/time is when aeration ended (defaults to now); the start is calculated from the duration. Saved as a jets-only exposure for pH trends, not a soak.';bathers.closest('.two').after(hint);
  let zero=false,previousShower=shower.checked,previousJets=jets.value;
  const mode=()=>{const next=bathers.value==='0';if(next&&!zero){previousShower=shower.checked;previousJets=jets.value;}shower.disabled=next;shower.closest('.inline').style.opacity=next?'.45':'';if(next)shower.checked=false;else if(zero){shower.checked=previousShower;jets.value=previousJets;}
    for(const option of jets.options)option.disabled=next&&!['air_on','water_only'].includes(option.value);
    if(next&&!['air_on','water_only'].includes(jets.value))jets.value='air_on';const time=form.querySelector('.time');time.previousElementSibling.textContent=next?'Aeration ended at':'Time';if(next&&!zero){const details=time.closest('details');if(details)details.open=true;}hint.hidden=!next;button.textContent=next?'Save aeration':'Save soak';zero=next;conditionUI();};
  bathers.addEventListener('change',mode);mode();
  const submit=form.onsubmit;form.onsubmit=function(e){if(bathers.value!=='0')return submit.call(this,e);e.preventDefault();const duration=num($('minutes').value),ended=timestamp(this),end=entryTime(ended),start=end-duration*60000;
    if(!Number.isInteger(duration)||duration<1||duration>720||!['air_on','water_only'].includes(jets.value)||!Number.isFinite(start)||end>Date.now()+60000){alert('Enter a completed aeration session: end time, 1–720 minutes, and air controls open or closed.');return;}
    const ts=SpaTime.input(start);spaEntryChoices.set(ts,start);save([{...base('maintenance',ts),activity:'custom',custom_activity:'Standalone jets',temperature_f:Number($('temperature').value),exposure:{kind:'jets',duration_minutes:duration,ended_at:ended,sunlight:false,air_on:jets.value==='air_on'},notes:text($('soakNotes').value)}],'Aeration saved');$('soakNotes').value='';fillNow();
  };
  // Existing exposure records keep the same wire format; expose their nested
  // duration/air fields to the normal reversible correction flow.
  $('history').addEventListener('click',e=>{if(!e.target.closest('[data-edit]')||!isExposure(editingRecord)||editingRecord.exposure.kind!=='jets')return;$('editFields').insertAdjacentHTML('beforeend','<label for="editAerationMinutes">Aeration minutes</label><input id="editAerationMinutes" type="number" min="1" max="10080" step="1" required value="'+editingRecord.exposure.duration_minutes+'"><label class="inline"><input id="editAerationAir" type="checkbox"'+(editingRecord.exposure.air_on?' checked':'')+'>Air controls open</label>');});
  const correct=$('editRecordForm').onsubmit;$('editRecordForm').onsubmit=function(e){if(!isExposure(editingRecord)||editingRecord.exposure.kind!=='jets'||!$('editAerationMinutes'))return correct.call(this,e);const duration=num($('editAerationMinutes').value),ts=$('edit-timestamp').value,start=parseSpaTime(ts);if(!Number.isInteger(duration)||duration<1||duration>10080||!Number.isFinite(start)||start+duration*60000>Date.now()+60000){e.preventDefault();alert('Enter a completed aeration session and a valid duration.');return;}const original=editingRecord;editingRecord={...original,exposure:{...original.exposure,duration_minutes:duration,air_on:$('editAerationAir').checked,ended_at:SpaTime.input(start+duration*60000)}};try{return correct.call(this,e);}finally{editingRecord=original;}};
}
function appHasUnsavedWork(){
  if(!appWorkflowState)return false;
  const s=appWorkflowState;
  if(document.querySelector('#doses .dose-row')||document.getElementById('calculatedActualAmount'))return true;
  if(document.getElementById('recordEditor')?.open||document.getElementById('productEditor')?.hidden===false)return true;
  if(typeof serviceSettingsDirty!=='undefined'&&serviceSettingsDirty)return true;
  if(typeof productDefaultsDirty!=='undefined'&&productDefaultsDirty)return true;
  return s.forms.some(form=>s.signature(form)!==s.baselines.get(form)||s.dateDirty.has(form)&&s.dates(form)!==s.dateBaselines.get(form));
}
function setupAppWorkflow(){
  if(typeof window==='undefined'||!document.querySelector)return;
  setupSoakAeration();
  setupStripTesting();
  const prefKey='j365_app_choices_v1';let prefs;
  try{prefs=JSON.parse(localStorage.getItem(prefKey)||'{}');if(!prefs||typeof prefs!=='object'||Array.isArray(prefs))prefs={};}catch{prefs={};}
  const persist=()=>{try{localStorage.setItem(prefKey,JSON.stringify(prefs));}catch{ /* optional preferences must never stop entry */ }};
  const productKey=choice=>profileForChoice(choice)?choice:null;
  const preferredUnit=choice=>units.includes(prefs.units?.[choice])?prefs.units[choice]:null;
  const rememberDose=(choice,unit)=>{if(!productKey(choice)||!units.includes(unit))return;prefs.product=choice;prefs.units={...prefs.units,[choice]:unit};persist();};
  const originalAdd=addDose;addDose=function(product,amount,unit,snapshot){
    product=product??(productKey(prefs.product)&&!profileForChoice(prefs.product).archived?prefs.product:defaultProductChoice('bleach'));
    unit=unit??preferredUnit(product)??'fl oz';originalAdd(product,amount??'',unit,snapshot);
    const row=$('doses').lastElementChild;
    row.addEventListener('change',e=>{if(e.target.matches('.product')&&!row.querySelector('.amount').value){const u=preferredUnit(e.target.value);if(u)row.querySelector('.unit').value=u;}rememberDose(row.querySelector('.product').value,row.querySelector('.unit').value);});
    rememberDose(product,unit);
  };
  const originalConfirm=confirmCalculatedDose;confirmCalculatedDose=function(product,amount,unit){
    if(!originalConfirm(product,amount,unit))return;const u=preferredUnit(product);
    // Convert only the untouched, newly opened suggestion. Subsequent user unit
    // changes retain the entered number, matching the established unit contract.
    if(u&&$('calculatedActualUnit')&&[...$('calculatedActualUnit').options].some(o=>o.value===u)){
      const converted=convertActualDose(product,amount,unit,u);
      if(Number.isFinite(converted)&&converted>0){$('calculatedActualAmount').value=Number(converted.toFixed(4));$('calculatedActualUnit').value=u;}
    }
  };
  const safeActivity=a=>a!=='water_change_full'&&[...$('maintenanceActivity').options].some(o=>o.value===a);
  if(safeActivity(prefs.service)){$('maintenanceActivity').value=prefs.service;maintenanceUI();}
  const originalOpen=openExpandedChart;openExpandedChart=function(key){originalOpen(key);const preset=prefs.chartPresets?.[key],view=prefs.chartViews?.[key];if(['24h','7d','14d','Fill'].includes(preset))document.querySelector('[data-chart-preset="'+preset+'"]')?.click();else if(view&&Number.isFinite(view.start)&&Number.isFinite(view.end)&&view.end>view.start&&view.end-view.start<=366*86400000){$('chartStart').value=chartInputTime(view.start);$('chartEnd').value=chartInputTime(view.end);updateExpandedChart();}};
  document.querySelector('.chart-quick-controls').addEventListener('click',e=>{const preset=e.target.closest('[data-chart-preset]');if(preset&&expandedChartKey){prefs.chartPresets={...prefs.chartPresets,[expandedChartKey]:preset.dataset.chartPreset};persist();}});
  const rememberView=()=>{if($('chartRangeError').textContent||!expandedChartKey)return;const start=parseSpaTime($('chartStart').value),end=parseSpaTime($('chartEnd').value);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return;prefs.chartViews={...prefs.chartViews,[expandedChartKey]:{start,end}};if(prefs.chartPresets)delete prefs.chartPresets[expandedChartKey];persist();};
  for(const id of ['applyChartRange','chartEarlier','chartLater','chartZoomIn','chartZoomOut'])$(id).addEventListener('click',rememberView);
  const fingers=new Set();let pinched=false;$('expandedChart').addEventListener('pointerdown',e=>{if(!e.target.closest('svg'))return;fingers.add(e.pointerId);if(fingers.size>1)pinched=true;});for(const type of ['pointerup','pointercancel'])$('expandedChart').addEventListener(type,e=>{fingers.delete(e.pointerId);if(!fingers.size&&pinched){rememberView();pinched=false;}});
  // One visible entry summary, one actual submit path. Nothing stages or saves
  // on navigation, calculator display, inspection or preference changes.
  const summary=document.createElement('details');summary.id='entryReview';summary.className='entry-review';summary.innerHTML='<summary>Review entry</summary><div id="entryReviewBody"></div>';$('doses').after(summary);
  const forms=['chemistryForm','soakForm','maintenanceForm'].map($),baselines=new Map(),dateDirty=new Set(),dateBaselines=new Map();
  const dates=form=>JSON.stringify([...form.querySelectorAll('.date,.time')].map(e=>e.value));
  const signature=form=>JSON.stringify([...form.querySelectorAll('input,select,textarea')].filter(e=>!e.matches('.date,.time')&&!['targetFc','targetPh','bakingMode','bakingTargetTa','bakingTargetPh','bakingMaxTa'].includes(e.id)).map(e=>[e.id||e.className,e.type==='checkbox'?e.checked:e.value]));
  const resetBaseline=form=>{baselines.set(form,signature(form));dateBaselines.set(form,dates(form));dateDirty.delete(form);};
  forms.forEach(resetBaseline);appWorkflowState={forms,baselines,dateDirty,dateBaselines,dates,signature};
  const review=()=>{
    const m=calculatorMeasurements(),measurements=Object.keys(m).filter(k=>['fc_ppm','cc_ppm','ph','ph_bounds','ta_ppm','ch_ppm','cya_ppm'].includes(k));
    const pending=$('calculatedActualAmount'),rows=[...$('doses').querySelectorAll('.dose-row')],parts=measurements.map(k=>(k==='ph_bounds'?'pH 8+':({fc_ppm:'FC',cc_ppm:'CC',ta_ppm:'TA',ch_ppm:'CH',cya_ppm:'CYA',ph:'pH'}[k]+' '+m[k])));
    if(pending)parts.push('Dose awaiting confirmation: '+(pending.value||'Amount needed')+' '+$('calculatedActualUnit').value+' · tap Add to draft or Cancel');
    for(const row of rows)parts.push((row.querySelector('.amount').value||'Amount needed')+' '+row.querySelector('.unit').value+' '+row.querySelector('.product').selectedOptions[0]?.textContent+' · '+row.querySelector('.doseTime').value);
    summary.hidden=!parts.length;summary.querySelector('summary').textContent='Review entry · '+measurements.length+' reading'+(measurements.length===1?'':'s')+' / '+rows.length+' addition'+(rows.length===1?'':'s');
    $('entryReviewBody').innerHTML='<p class="help">Test first, then additions at their recorded times. Nothing saves until Save test / additions.</p>'+parts.map(s=>'<p>'+esc(s)+'</p>').join('');
    const status=$('draftStatus');if(status)status.textContent=parts.length?measurements.length+' reading'+(measurements.length===1?'':'s')+' · '+rows.length+' addition'+(rows.length===1?'':'s')+(pending?' · dose awaiting confirmation':'')+' · not saved':'';
  };
  $('chemistryForm').addEventListener('input',review);$('chemistryForm').addEventListener('change',review);new MutationObserver(review).observe($('doses'),{childList:true,subtree:true});new MutationObserver(review).observe($('recommendations'),{childList:true,subtree:true});review();
  for(const form of forms)for(const type of ['input','change'])form.addEventListener(type,e=>{if(e.target.matches('.date,.time'))dateDirty.add(form);});
  // Commit acknowledgement and Undo wrap the existing final save pipeline once.
  // Full refills are intentionally excluded: they change fill/config ownership.
  const originalSave=save,savedGeneration=new Map();let undoBatch=null,undoTimer=null;
  const notice=document.createElement('div');notice.id='appSaveNotice';notice.setAttribute('role','status');notice.hidden=true;notice.innerHTML='<span></span> <button type="button" class="secondary" id="undoLastSave">Undo</button>';document.body.append(notice);
  const clearUndo=()=>{undoBatch=null;notice.hidden=true;clearTimeout(undoTimer);};
  save=function(events,message,autoSync=true){
    const before=new Set(read().map(e=>e.id)),form=message==='Chemistry saved'?$('chemistryForm'):['Soak saved','Aeration saved'].includes(message)?$('soakForm'):['Maintenance saved','Exposure saved','New fill cycle saved'].includes(message)?$('maintenanceForm'):null;
    const activity=$('maintenanceActivity').value;
    const result=originalSave(events,message,autoSync),saved=read(),fresh=events.filter(e=>!before.has(e.id)&&saved.some(r=>r.id===e.id));
    if(form&&fresh.length){
      savedGeneration.set(form,(savedGeneration.get(form)||0)+1);
      if(form.id==='maintenanceForm'&&safeActivity(activity)){prefs.service=activity;persist();}
      queueMicrotask(()=>{resetBaseline(form);review();});
      clearUndo();
      if(!fresh.some(e=>e.type==='water_change'&&e.full)){
        undoBatch={ids:fresh.map(e=>e.id),until:Date.now()+15000};notice.querySelector('span').textContent='Saved on this device · '+fresh.length+' entr'+(fresh.length===1?'y':'ies');notice.hidden=false;$('toast').textContent='';undoTimer=setTimeout(clearUndo,15000);
      }
    }
    return result;
  };
  $('undoLastSave').onclick=()=>{
    const batch=undoBatch;clearUndo();if(!batch||Date.now()>batch.until)return;
    const current=activeEvents(),targets=current.filter(e=>batch.ids.includes(e.id));
    if(targets.length!==batch.ids.length){$('toast').textContent='Entry changed since saving. Review it in History.';return;}
    const markers=targets.map(record=>({...removalMarker(record),supersedes_event_id:record.id,record_removal:true,removed_record:record,notes:'Undid recent entry: '+label(record),correction_reason:'Undo recent save'}));
    originalSave(markers,'Save undone');
  };
  // Stop repeated taps during async service saves; original validations and
  // confirmation callbacks still decide whether a save is allowed.
  for(const form of forms){const submit=form.onsubmit;let submitting=false;form.onsubmit=function(e){e.preventDefault();if(form.id==='chemistryForm'&&$('calculatedActualAmount')){review();alert('A dose is awaiting confirmation. Tap Add to draft to include it, or Cancel to save without it. Your readings and dose have not been saved or cleared.');focusPendingCalculatedDose();return;}if(submitting)return;submitting=true;const button=form.querySelector('button[type="submit"]'),generation=savedGeneration.get(form)||0;if(button)button.disabled=true;const done=()=>{submitting=false;if(button)button.disabled=false;if((savedGeneration.get(form)||0)>generation){resetBaseline(form);review();}};try{const result=submit.call(this,e);if(result?.then)return result.finally(done);done();return result;}catch(error){done();throw error;}};}
  // Restore a convenient service activity after the original form.reset().
  $('maintenanceForm').addEventListener('reset',()=>queueMicrotask(()=>{if(safeActivity(prefs.service)){$('maintenanceActivity').value=prefs.service;maintenanceUI();}resetBaseline($('maintenanceForm'));}));
  // Account detail belongs in Service; routine state stays as one compact badge.
  const settings=$('appConnectionSettings'),status=document.querySelector('.status');
  if(settings&&status){
    const detail=document.createElement('p');detail.append($('identity'));settings.append(detail);
    const link=document.createElement('a');link.id='appSyncLink';link.className='app-sync-button';link.append($('syncState'));status.append(link);
    const isSignIn=()=>$('syncState').textContent.trim()==='Local only'&&location.hostname.endsWith('workers.dev');
    const refreshLink=()=>{const signIn=isSignIn();link.href=signIn?'/auth/start':'#appConnectionSettings';link.classList.toggle('is-sign-in',signIn);link.setAttribute('aria-label',signIn?'Local only — sign in with GitHub':'Open app and connection settings');link.title=signIn?'Sign in with GitHub':'App & connection';};
    const guardSignIn=e=>{if(appHasUnsavedWork()){e.preventDefault();alert('Save or finish your unsaved work before signing in. Your entry has not been cleared.');}};
    link.onclick=e=>{if(isSignIn()){guardSignIn(e);return;}e.preventDefault();setTab('maintenance');settings.open=true;settings.scrollIntoView?.({behavior:'smooth',block:'center'});};
    $('identity').addEventListener('click',e=>{if(e.target.closest('a[href="/auth/start"]'))guardSignIn(e);});
    new MutationObserver(refreshLink).observe($('syncState'),{childList:true,characterData:true,subtree:true});refreshLink();
    const signInStyle=document.createElement('style');signInStyle.textContent='.app-sync-button{display:inline-flex;align-items:center;min-height:40px;text-decoration:none}.app-sync-button.is-sign-in{text-decoration:underline;text-underline-offset:3px}.app-sync-button:focus-visible{outline:2px solid #79d6c2;outline-offset:3px;border-radius:5px}';document.head.append(signInStyle);
  }
  const style=document.createElement('style');style.textContent='.entry-review{margin:10px 0;font-size:12px}.entry-review p{margin:6px 0}#appSaveNotice{position:fixed;bottom:calc(var(--app-nav-height,76px) + 86px);left:50%;transform:translateX(-50%);z-index:40;max-width:calc(100% - 24px);width:max-content;padding:8px 12px;background:#142d32;border:1px solid #4c786e;border-radius:12px;color:#adf0de;font-size:13px;box-shadow:0 5px 25px #0005}#appSaveNotice button{margin-left:8px;min-height:40px}.app-ui .status{background:transparent;border:0;justify-content:flex-end;padding:0;margin:0 0 6px}.app-sync-button{background:transparent;border:0;font-size:11px;padding:6px;color:#aac4ce}.chart-readout[data-pinned="true"]{border-color:#79d6c2}';document.head.append(style);
  return {resetBaseline,review};
}
