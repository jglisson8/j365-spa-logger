function refillEquipmentFields(){
 const checks=[...document.querySelectorAll?.('[data-fill-check]:checked')??[]].map(e=>e.dataset.fillCheck);
 return checks.length?{startup_checks:checks}:{};
}
function openAerationLogger(){
 setTab('soak');$('bathers').value='0';$('bathers').dispatchEvent(new Event('change',{bubbles:true}));
 const button=$('stopAeration').hidden?$('startAeration'):$('stopAeration');button.scrollIntoView?.({block:'center'});button.focus();
}
function refillStartupPlan(events,now=Date.now()){
 const fill=events.filter(e=>e.type==='water_change'&&e.full&&chartTime(e)<=now).sort(timelineOrder).at(-1);
 if(!fill)return null;
 const cohort=events.filter(e=>effectiveModelFill(e,events)===fill.new_fill_cycle_id&&chartTime(e)<=now).sort(timelineOrder);
 const sample=k=>cohort.filter(e=>e.type==='chemistry'&&!e.historical&&modelTime(e)!=null&&!isStripParameter(e,k)&&(Number.isFinite(e[k])||k==='ph'&&e.ph_bounds)).at(-1);
 const after=(s,p)=>s&&cohort.some(e=>timelineOrder(e,s)>0&&p(e));
 const dose=e=>e.type==='chemical_addition',water=e=>e.type==='water_top_off'||e.type==='water_change'&&!e.full;
 const fields={fc_ppm:'FC',ph:'pH',ta_ppm:'TA',ch_ppm:'CH',temperature_f:'temperature'},settings=refillSettings(),tasks=[],add=(title,state,detail,action)=>tasks.push({title,state,detail,action});
 const missing=Object.keys(fields).filter(k=>!sample(k)).map(k=>fields[k]);
 add('Startup measurements',missing.length?'next':'done',missing.length?'Record '+missing.join(', ')+'.':'All five readings logged.',missing.length?'test':null);
 const at=new Date(now).toISOString(),cya=calculatedCya(events,at),borates=calculatedBorates(events,at),fc=sample('fc_ppm'),ta=sample('ta_ppm'),ph=sample('ph'),ch=sample('ch_ppm'),fcBounds=chartBounds('fc_ppm'),phBounds=chartBounds('ph'),taBounds=chartBounds('ta_ppm'),chBounds=chartBounds('ch_ppm');
 const jets=jetRetestState(events,fill.new_fill_cycle_id,now),chlorineHold=highChlorineTest(events,fill.new_fill_cycle_id,now);
 if(chlorineHold)add('Sanitizer','next','Confirm high FC with a fresh test before further treatment.','test');
 else if(jets.active)add('Sanitizer','wait','Finish aeration, then measure FC.');
 else if(!fc||jets.needsRetest(fc)||after(fc,e=>water(e)||dose(e)&&!isFcBalancingAddition(e)||e.type==='soak'||isExposure(e)&&e.exposure.kind!=='jets'))add('Sanitizer','next','Measure FC before deciding on the next sanitizer addition.','test');
 else if(fc.fc_ppm<fcBounds.lower)add('Sanitizer','next',cya.value!=null&&!cya.issues.length&&cya.value<settings.cya?'FC is below your alert limit. If treating, use your measured FC and dichlor while building CYA; retest after mixing.':'FC is below your alert limit. Use the measured FC in the chlorine calculator if using bleach; retest after mixing.','test');
 else if(fc.fc_ppm>fcBounds.upper)add('Sanitizer','next','FC is above your alert limit. Do not add more sanitizer; retest before use.','test');
 else add('Sanitizer','done','Last measured FC is within your configured alert limits. This is not clearance to soak.');
 const phStale=jets.needsRetest(ph)||!!(ph&&highChlorineTest(events,fill.new_fill_cycle_id,modelTime(ph)))||after(ph,e=>water(e)||dose(e)||isExposure(e)&&e.exposure.kind!=='jets'||e.type==='soak'),taStale=jets.needsRetest(ta)||!!(ta&&highChlorineTest(events,fill.new_fill_cycle_id,modelTime(ta)))||after(ta,e=>water(e)||dose(e)&&(/acid|spa down|baking|carbonate/i.test(chemicalName(e))||!productDoseSupported(e)));
 let balanced=false;
 if(jets.active)add('Balance TA and pH','next','Finish the active aeration session, then measure pH and TA before another adjustment.','aerate');
 else if(chlorineHold)add('Balance TA and pH','wait','Confirm FC with a fresh test. High chlorine can interfere with pH and TA tests; do not adjust from those readings.','test');
 else if(!ta||!ph||phStale||taStale)add('Balance TA and pH','next','Measure pH and TA together'+(phStale||taStale?' after the last addition or activity.':'.')+' Use a measured result before repeating a treatment.','test');
 else if(ta.ta_ppm>taBounds.upper){
  if(Number.isFinite(ph.ph)&&ph.ph<=settings.post_acid_high)add('Balance TA and pH','next','TA is high and pH is at or below your post-acid target. Aerate to raise pH without adding alkalinity, then retest both before another acid dose.','aerate');
  else add('Balance TA and pH','next','TA is high. Use a fresh Taylor acid-demand test for an incremental adjustment toward pH '+settings.post_acid_low+'–'+settings.post_acid_high+'. Log the actual dose, mix, and retest pH and TA. Repeat only from measured results.','acid');
 }else if(ta.ta_ppm<taBounds.lower)add('Balance TA and pH','next','Measured TA is low. Review pH and the TA calculator before adjusting; retest both afterward.','test');
 else if(ph.ph_bounds||ph.ph<phBounds.lower||ph.ph>phBounds.upper)add('Balance TA and pH','next','TA is in range. Check pH separately before adjusting; use acid demand for a high pH result.','test');
 else {balanced=true;add('Balance TA and pH','done','Measured TA and pH are within your configured limits. No TA increaser indicated.');}
 if(!ch||after(ch,e=>water(e)||dose(e)&&/calcium/i.test(chemicalName(e))))add('Calcium hardness','next','Measure CH before deciding whether it needs adjustment.','test');
 else if(ch.ch_ppm<chBounds.lower)add('Calcium hardness','next','Measured CH is below your target. Review the calcium product directions for the measured shortfall.','test');
 else if(ch.ch_ppm>chBounds.upper)add('Calcium hardness','next','Measured CH is above your target. Do not add calcium.');
 else add('Calcium hardness','done','Measured CH is adequate; no calcium addition indicated.');
 const knownCya=cya.value!=null&&!cya.issues.length;
 add('CYA → bleach',knownCya?(cya.value>=settings.cya?'done':'next'):'wait',knownCya?'CYA ≈'+cya.value.toFixed(1)+' / '+settings.cya+' ppm. '+(cya.value>=settings.cya?'Use bleach for subsequent sanitizer needs.':'Build only as sanitizer is needed; use bleach instead if a dichlor dose would overshoot.'):'Review the starting CYA or incomplete dichlor entries.');
 const knownBorates=borates.value!=null&&!borates.issues.length;
 add('Borates',knownBorates&&borates.value>=settings.borates?'done':balanced&&knownBorates?'next':'wait',knownBorates?'Borates ≈'+borates.value.toFixed(1)+' / '+settings.borates+' ppm. '+(borates.value>=settings.borates?'No addition indicated.':balanced?'After balancing, review the product and log the actual weighed addition; retest pH afterward.':'Finish TA/pH balancing first.'):'Review the fill baseline and boric acid weight/purity entries.');
 return {fill,tasks,complete:tasks.filter(t=>t.state==='done').length};
}
function setupRefillStartup(){
 if(typeof window==='undefined'||!document.querySelector||guestPage())return;
 const checks=document.createElement('details');checks.className='optional';checks.innerHTML='<summary>Optional equipment checks</summary>'+['Circulation','Heating','Filtration','No visible leaks'].map(s=>'<label class="inline"><input type="checkbox" data-fill-check="'+s+'">'+s+' checked</label>').join('');
 $('fillPh').closest('.two').after(checks);
 $('fillPh').after(Object.assign(document.createElement('label'),{className:'inline',innerHTML:'<input id="fillPhBound" type="checkbox"> pH 8+ (upper end of test scale)'}));
 $('fillPhBound').onchange=()=>{if($('fillPhBound').checked)$('fillPh').value='';};
 $('fillPh').addEventListener('input',()=>{if($('fillPh').value)$('fillPhBound').checked=false;});
 const panel=document.createElement('details');panel.className='panel';panel.id='refillStartup';panel.innerHTML='<summary id="refillProgress">Refill startup</summary><div id="refillTasks"></div>';
 $('maintenanceForm').before(panel);
 const settings=document.createElement('details');settings.className='panel';settings.id='refillSettings';
 const fields=[['cya','CYA goal (ppm)',0,100,1],['borates','Borate goal (ppm)',0,60,1],['post_acid_low','Post-acid pH lower goal',7,7.8,.1],['post_acid_high','Post-acid pH upper goal',7,7.8,.1],['seats','Aerating seat capacity',1,12,1],['standalone_seats','Default jets-only seats',1,12,1],['acid_max_minutes','Longest acid calibration retest (min)',60,180,1]];
 settings.innerHTML='<summary>Refill and aeration settings</summary><p class="help">FC, pH, TA and CH alerts use the existing Trends limits. These startup targets are preferences, not safe-to-soak limits.</p><form id="refillSettingsForm">'+fields.map(([k,label,min,max,step])=>'<label for="refill-'+k+'">'+label+'</label><input id="refill-'+k+'" type="number" min="'+min+'" max="'+max+'" step="'+step+'" required>').join('')+'<button type="submit">Save refill settings</button></form><p id="refillSettingsStatus" role="status"></p>';
 $('tab-maintenance').append(settings);
 let dirty=false,editBase=null;
 const form=$('refillSettingsForm');form.oninput=()=>{if(!dirty)editBase=configClone(config);dirty=true;};
 form.onsubmit=async e=>{
  e.preventDefault();if(!form.reportValidity())return;
  const value=Object.fromEntries(fields.map(([k])=>[k,Number($('refill-'+k).value)]));
  if(value.post_acid_low>=value.post_acid_high||value.standalone_seats>value.seats){$('refillSettingsStatus').textContent='Check the pH range and seat capacity.';return;}
  stageConfigField('refill_settings',value,editBase??config);config=applyPendingConfig(config||{schema_version:2,spa:{model:'Jacuzzi J-365',volume_gallons:395}});writeConfigState(config,configPending);
  dirty=false;editBase=null;render();$('refillSettingsStatus').textContent='Saved on this device';
  if(session&&await syncConfig())$('refillSettingsStatus').textContent='Refill settings synced';
 };
 const unsaved=appHasUnsavedWork;appHasUnsavedWork=()=>unsaved()||dirty;
 panel.addEventListener('click',e=>{const action=e.target.closest('[data-startup-go]')?.dataset.startupGo;if(!action)return;
  if(action==='aerate')openAerationLogger();
  else {setTab('chemistry');if(action==='acid'){const select=$('targetPh'),target=String(refillSettings().post_acid_high);if(![...select.options].some(o=>o.value===target))select.add(new Option(target,target));select.value=target;$('acidDrops').closest('details')?.setAttribute('open','');calculate();}$('chemistryForm').scrollIntoView?.({block:'start'});}
 });
 const refresh=()=>{
  if(!dirty){const p=refillSettings();for(const [k] of fields)$('refill-'+k).value=p[k];}
  const plan=refillStartupPlan(activeEvents());panel.hidden=!plan;if(!plan)return;
  $('refillProgress').textContent='Refill startup · '+plan.complete+'/'+plan.tasks.length+' complete';
  const checks=plan.fill.startup_checks??[];
  $('refillTasks').innerHTML='<p class="help">'+esc(plan.fill.timestamp.replace('T',' '))+' · '+esc(plan.fill.water_source||'source not recorded')+'</p><ol>'+plan.tasks.map(t=>'<li><strong>'+esc(t.title)+'</strong> · '+({done:'Done',next:'Next',wait:'Later'})[t.state]+'<p>'+esc(t.detail)+'</p>'+(t.action?'<button class="secondary" type="button" data-startup-go="'+t.action+'">'+(t.action==='aerate'?'Open aeration logger':t.action==='acid'?'Open acid-demand test':'Open test and dose')+'</button>':'')+'</li>').join('')+'</ol>'+(checks.length?'<p>Equipment checked: '+esc(checks.join(', '))+'</p>':'')+'<p class="help">Retest after adjustments. Estimates and this checklist do not establish safe-to-soak conditions.</p>';
 };
 const before=render;render=function(...args){before(...args);refresh();};
 const tab=setTab;setTab=function(...args){const result=tab(...args);if(args[0]==='maintenance')refresh();return result;};
 const saveBefore=save;save=function(events,message,autoSync=true){const result=saveBefore(events,message,autoSync);if(message==='New fill cycle saved')panel.open=true;return result;};
 refresh();
}
