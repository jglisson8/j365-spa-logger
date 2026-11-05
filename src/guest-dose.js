// Guest suggestions are drafts only. Canonical saved samples and actual doses
// still pass through the existing server validation and private event history.
function guestBleachPlan(events,products,settings,userId,now=Date.now()){
 const stop=message=>({status:'check',message});
 const approved=products.find(p=>p.profile.family==='hypochlorite');
 if(!approved)return stop('Bleach is not enabled for this invitation.');
 const rows=events.filter(e=>e.type==='chemistry'&&Number.isFinite(e.fc_ppm)&&Number.isFinite(modelTime(e))&&modelTime(e)<=now+60000).sort(timelineOrder),sample=rows.at(-1);
 if(!sample||now-modelTime(sample)>30*60000)return stop('Log a fresh FC test to calculate bleach.');
 const time=modelTime(sample);
 const lastDose=events.filter(e=>e.type==='chemical_addition'&&modelTime(e)!=null&&modelTime(e)<=time).sort(timelineOrder).at(-1);
 if(lastDose&&time-modelTime(lastDose)<20*60000)return stop('Allow at least 20 minutes of mixing after the last dose, then save a fresh FC test before calculating more bleach.');
 if(events.some(e=>e.id!==sample.id&&Number.isFinite(modelTime(e))&&modelTime(e)<=now+60000&&timelineOrder(e,sample)>0&&(['soak','chemical_addition','water_change','water_top_off'].includes(e.type)||isExposure(e))))return stop('Water has changed since that test. Retest FC before calculating another dose.');
 const range=isStripParameter(sample,'fc_ppm')?stripReading(sample,'fc_ppm'):null;
 if(isStripParameter(sample,'fc_ppm')&&(!range||range.censored||!Number.isFinite(range.maximum)))return stop('That strip result is off scale. Confirm FC before adding bleach.');
 const assumed=range?range.maximum:sample.fc_ppm;
 const target=settings?.targets?.guest_fc_target_ppm??settings?.targets?.fc_target_ppm??7.5;
 if(!Number.isFinite(target)||target<=0||target>10)return stop('Ask the owner to check the FC target.');
 const base={sample_id:sample.id,sample_time:time,assumed_fc:assumed,target,target_default:settings?.targets?.guest_fc_target_ppm==null&&settings?.targets?.fc_target_ppm==null,profile:approved.profile,source:range?'strip upper bound':'Taylor reading'};
 if(assumed>=target)return {...base,status:'none',message:'No extra bleach suggested from this test. Confirm levels before soaking.'+(range&&range.minimum<target?' The strip range also includes values below the target.':'')};
 const fill=events.filter(e=>e.type==='water_change'&&e.full&&timelineOrder(e,sample)<=0).sort(timelineOrder).at(-1),volume=fill?.gallons??settings?.spa?.volume_gallons??395;
 if(!(Number.isFinite(volume)&&volume>0))return stop('Ask the owner to check the tub volume.');
 const perML=profileFcGrams(approved.profile,1,'mL')*1000/(volume*3.78541);
 if(!(Number.isFinite(perML)&&perML>0))return stop('This bleach needs usable product strength/density information before calculating.');
 const mL=Math.floor(((target-assumed)/perML)*10)/10;
 const used=events.filter(e=>e.type==='chemical_addition'&&e.product_id===approved.profile.id&&e.guest_actor?.user_id===userId&&Date.parse(e.created_at)>now-86400000).reduce((sum,e)=>sum+e.amount*(PRODUCT_VOLUME[e.unit]||0),0);
 if(!(approved.max_single_mL>0&&approved.max_daily_mL>0)||mL>approved.max_single_mL+.00001||used+mL>approved.max_daily_mL+.00001)return stop('The calculated amount exceeds your permitted dose limit. Check with the owner.');
 return {...base,status:'dose',mL,volume_gallons:volume,message:(range?'Uses the strip’s upper bound. ':'')+'Retest after mixing; actual FC may still be below the target.'};
}
function guestSuggestedAmount(mL,unit='cup'){
 const digits=unit==='mL'?1:unit==='cup'?3:2,scale=10**digits;
 return Math.floor((mL/PRODUCT_VOLUME[unit]+1e-10)*scale)/scale;
}
// Practical measures never round upward or change a recorded amount.
function guestPracticalDose(plan){
 if(plan.status!=='dose')return plan;
 const acid=plan.profile.family==='bisulfate',unit=acid?'tbsp':'cup';
 const amount=acid?Math.floor(plan.mL/PRODUCT_VOLUME.tbsp+1e-10):[.5,1/3,.25].find(n=>n*PRODUCT_VOLUME.cup<=plan.mL+1e-8);
 if(!(amount>0))return {...plan,status:'check',message:acid?'The supported acid correction is less than 1 tbsp. No whole-tablespoon dose is suggested; do not round up.':'The supported bleach correction is less than ¼ cup. No cup-size dose is suggested; do not round up.'};
 return {...plan,calculated_mL:plan.mL,mL:amount*PRODUCT_VOLUME[unit],suggested_amount:amount,suggested_unit:unit,suggested_label:acid?String(amount):amount===.5?'½':amount===.25?'¼':'⅓'};
}
// A single, bounded bleach → acid workflow. This reuses the original test,
// never manufactures a post-bleach measurement, and never permits repeat acid.
function guestCombinedAcidPlan(events,products,settings,userId,now=Date.now()){
 const relevant=e=>['chemistry','chemical_addition','soak','water_change','water_top_off','maintenance'].includes(e.type)||isExposure(e)||e.cya_baseline_ppm!=null||e.borates_baseline_ppm!=null;
 const ordered=events.filter(e=>Number.isFinite(modelTime(e))&&modelTime(e)<=now+60000).sort(timelineOrder);
 const dose=ordered.filter(e=>e.type==='chemical_addition'&&e.guest_actor?.user_id===userId&&e.product_profile?.family==='hypochlorite').at(-1);
 if(!dose||now-modelTime(dose)>2*3600000||ordered.some(e=>timelineOrder(e,dose)>0&&relevant(e)))return null;
 if(events.some(e=>e.id!==dose.id&&relevant(e)&&modelTime(e)==null&&(!e.timestamp||String(e.timestamp).slice(0,10)>=dose.timestamp.slice(0,10))))return null;
 const before=events.filter(e=>timelineOrder(e,dose)<0);
 const bleach=guestPracticalDose(guestBleachPlan(before,products,settings,userId,modelTime(dose))),acid=guestPracticalDose(guestAcidPlan(before,products,settings,userId,modelTime(dose)));
 if(bleach.status!=='dose'||acid.status!=='dose')return null;
 // The original FC and pH may have been saved separately. Keep each actual
 // source; neither becomes a newly timed post-dose sample.
 const sources=[bleach.sample_id,acid.sample_id].map(id=>before.find(e=>e.id===id));
 if(sources.some(test=>!test||modelTime(test)==null||modelTime(dose)-modelTime(test)<0||modelTime(dose)-modelTime(test)>30*60000||now-modelTime(test)>2*3600000))return null;
 const stop=message=>({...acid,status:'check',sequence:true,bleach_id:dose.id,message});
 // Pin the real bleach formulation; changing products/strength needs a test.
 if(dose.product_id!==bleach.profile.id||dose.product_revision!==bleach.profile.revision||dose.product_profile.concentration?.value!==bleach.profile.concentration?.value||dose.product_profile.concentration?.basis!==bleach.profile.concentration?.basis||densityGml(dose.product_profile.density)!==densityGml(bleach.profile.density))return stop('Bleach product information changed. Log a fresh test before pH Down.');
 const mass=profileFcGrams(dose.product_profile,dose.amount,dose.unit),volume=bleach.volume_gallons;
 if(!(Number.isFinite(mass)&&mass>0))return stop('The actual bleach amount cannot be checked. Log a fresh test before pH Down.');
 const upperFc=bleach.assumed_fc+mass*1000/(volume*3.78541);
 if(upperFc>10)return stop('The logged bleach could put FC above 10 ppm. Test FC before pH Down.');
 const readyAt=modelTime(dose)+20*60000;
 return {...acid,sequence:true,bleach_id:dose.id,ready_at:readyAt,estimated_fc_upper:upperFc,status:now<readyAt?'wait':'dose',message:now<readyAt?'Bleach saved. Keep the cover open and Jets 1 and 2 running. pH Down will be offered after the 20-minute mixing wait.':'Next: pH Down, using the original test and the checked bleach addition. This is a calculation, not a new water reading. Mix and retest after pH Down before soaking.'};
}
function guestUiDosePlan(profile,events,products,settings,userId){
 if(profile?.family==='bisulfate'&&typeof guestFlow!=='undefined'&&guestFlow.phase==='sequence'){
  const combined=guestCombinedAcidPlan(events,products,settings,userId);
  if(!combined)return {status:'check',message:'The water history changed or this dose sequence expired. Log a fresh test before another dose.'};
  if(combined.status==='dose'&&guestContextLoadedAt<combined.ready_at)return {...combined,status:'wait',message:'Mixing wait finished. Checking the latest saved water data before pH Down…'};
  return combined;
 }
 return guestPracticalDose((profile?.family==='bisulfate'?guestAcidPlan:guestBleachPlan)(events,products,settings,userId));
}
function guestAcidPlan(events,products,settings,userId,now=Date.now()){
 const stop=message=>({status:'check',message}),approved=products.find(p=>p.profile.family==='bisulfate');if(!approved)return stop('pH Down is not enabled for this invitation.');
 const sample=events.filter(e=>e.type==='chemistry'&&Number.isFinite(e.ph)&&modelTime(e)!=null&&modelTime(e)<=now+60000).sort(timelineOrder).at(-1);
 if(!sample||now-modelTime(sample)>30*60000)return stop('Log → Test: save a fresh pH and FC strip test first.');
 const fill=effectiveModelFill(sample,events),rows=events.filter(e=>effectiveModelFill(e,events)===fill),time=modelTime(sample);
 const lastDose=rows.filter(e=>e.type==='chemical_addition'&&modelTime(e)!=null&&modelTime(e)<=now).sort(timelineOrder).at(-1);
 if(lastDose&&time-modelTime(lastDose)<20*60000)return stop('Allow at least 20 minutes of mixing after the last dose, then save a fresh FC/pH strip test before another acid step.');
 if(events.some(e=>e.id!==sample.id&&timelineOrder(e,sample)>0&&modelTime(e)<=now+60000&&(['soak','chemical_addition','water_change','water_top_off'].includes(e.type)||isExposure(e))))return stop('Water changed after that test. Mix, then save a fresh FC/pH strip test before calculating more acid.');
 const fc=rows.filter(e=>e.type==='chemistry'&&Number.isFinite(e.fc_ppm)&&modelTime(e)!=null&&modelTime(e)<=time).sort(timelineOrder).at(-1),fcRange=fc&&isStripParameter(fc,'fc_ppm')?stripReading(fc,'fc_ppm'):null;
 if(!fc||time-modelTime(fc)>30*60000||(fcRange?fcRange.maximum==null||fcRange.maximum>10:fc.fc_ppm>10))return stop('Save a fresh usable FC test too. High or off-scale chlorine can interfere with pH colors.');
 let lower=sample.ph-.1,source='Taylor reading minus 0.1';
 if(isStripParameter(sample,'ph')){const r=stripReading(sample,'ph');if(!r)return stop('Choose a supported pH strip block.');lower=r.minimum;source='strip lower working bound';const fit=stripComparison(rows,'ph',r.choice,time);if(fit.count>=5){lower=Math.min(...fit.values)-.1;source='paired Taylor lower working bound';}}
 const target=settings?.targets?.guest_ph_target??7.4;
 if(!Number.isFinite(target)||target<7.2||target>7.8)return stop('Ask the owner to check the guest pH goal.');
 const base={sample_id:sample.id,sample_time:time,assumed_ph:lower,target,profile:approved.profile,source};
 // The desired endpoint is distinct from the conservative correction trigger.
 if(!(lower>7.8))return {...base,status:'none',message:'No acid suggested: this pH range overlaps 7.8 or below. Goal '+target.toFixed(1)+'; retest rather than guessing a dose.'};
 const taSample=rows.filter(e=>e.type==='chemistry'&&Number.isFinite(e.ta_ppm)&&modelTime(e)!=null&&modelTime(e)<=time).sort(timelineOrder).at(-1);
 if(!taSample||time-modelTime(taSample)>30*86400000)return stop('Log → Test → Optional · alkalinity: add a TA strip result to support the acid calculation.');
 const p=balanceProjection(rows.filter(e=>timelineOrder(e,sample)<=0),'ta_ppm',time),u=taUncertainty(p,rows,time),taRange=isStripParameter(taSample,'ta_ppm')?stripReading(taSample,'ta_ppm'):null;
 let taLow=Number.isFinite(p.current)?Math.min(p.current-10,u?.current_band?.[0]??Infinity):NaN;
 if(taRange){if(!Number.isFinite(taRange.maximum)||taRange.censored)return stop('TA is off scale. Confirm alkalinity before acid.');const changes=Number.isFinite(p.current)?p.current-taSample.ta_ppm:NaN;taLow=Math.min(taLow,taRange.minimum+changes);}
 if(!(taLow>40))return stop('TA may be too low for an acid suggestion. Log a fresh TA strip test; do not keep adding acid to chase pH.');
 const cya=calculatedCya(rows,sample.timestamp,'before'),borates=calculatedBorates(rows,sample.timestamp,'before');
 if(cya.value==null||borates.value==null||cya.issues?.length||borates.issues?.length)return stop('Current-fill CYA/borate inventory is needed before estimating an acid step.');
 const purity=approved.profile.concentration,perML=profileDoseMass(approved.profile,1,'mL');if(purity?.basis!=='active_mass_percent'||!(purity.value>0&&perML>0))return stop('pH Down needs product purity and loose-volume density before calculating.');
 const volume=fillVolume(rows,sample.timestamp),temperature=environmentContext(rows,sample.timestamp).temperature_f??106;
 // Use this fill's usable buffer inventory, not fictitious zero-borate/CYA
 // scenarios. Conservatism comes from the lower pH/TA, downward calibration
 // and practical rounding. Acid changes TA; never scale pH linearly.
 const state={ta_ppm:taLow,borates_ppm:borates.value,cya_ppm:cya.value,temperature_f:temperature},carbon=carbonFromPh(lower,state);
 if(!(carbon>0))return stop('Buffer context is inconsistent; confirm TA before acid.');
 const q=carbonateTerms(target,state),demand=taLow-50000*(carbon*q.fraction+q.other);if(!(demand>0))return stop('No supported acid correction from this chemistry.');
 const correction=acidDoseCalibration(rows,sample.timestamp,approved.profile),taReduction=Math.min(demand*Math.min(1,correction.factor),taLow-40),grams=taReduction*(volume*3.78541)*120.06/(50000*(purity.value/100)),mL=Math.floor(grams/perML*10)/10;
 const used=events.filter(e=>e.type==='chemical_addition'&&e.product_id===approved.profile.id&&e.guest_actor?.user_id===userId&&Date.parse(e.created_at)>now-86400000).reduce((s,e)=>s+e.amount*(PRODUCT_VOLUME[e.unit]||0),0);
 if(!(mL>0&&approved.max_single_mL>0&&approved.max_daily_mL>0)||mL>approved.max_single_mL+.00001||used+mL>approved.max_daily_mL+.00001)return stop('The calculated acid correction exceeds the remaining invitation limit. Do not guess a larger dose.');
 return {...base,status:'dose',mL,volume_gallons:volume,ta_lower:taLow,ta_reduction:taReduction,correction:correction.factor,cya_ppm:cya.value,borates_ppm:borates.value,temperature_f:temperature,message:'Calculated correction toward pH '+target.toFixed(1)+' using the conservative starting range and this fill’s buffer inventory—not a guaranteed endpoint. Add one supported dose, mix for at least 20 minutes (longer if the label says), then retest before soaking. Do not automatically repeat the dose.'};
}
function refreshGuestDoseAdvice(){
 if(!$('guestDoseAdvice'))return;
 const rows=activeEvents(),selected=guestContext?.products.find(p=>p.profile.id===$('guestProduct').value),acid=selected?.profile.family==='bisulfate',planner=(...args)=>guestUiDosePlan(selected?.profile,...args),plan=planner(rows,guestContext?.products||[],config,session?.user_id);
 const box=$('guestDoseAdvice');box.replaceChildren();
 $('guestBleachShortcut').hidden=!guestContext?.products.some(p=>p.profile.family==='hypochlorite')||!!guestCorrection;
 if(guestCorrection){box.textContent='Correct the amount actually added. This does not recommend a new dose.';return;}
 if(!selected){box.textContent='Select an approved product to check its calculated dose.';return;}
 const summary=document.createElement('p');summary.textContent=plan.message;
 if(plan.status!=='dose'){box.append(summary);return;}
 if(selected.profile.id!==plan.profile.id){box.textContent='Select '+plan.profile.name+' to use its approved calculation.';return;}
 const unit=plan.suggested_unit,amount=plan.suggested_amount;
 if(!(amount>0)){box.textContent='Calculated volume is too small for this unit. Choose tsp or mL.';return;}
 const quantity=document.createElement('strong');quantity.style.cssText='display:block;margin-bottom:10px';quantity.textContent=plan.suggested_label+' '+unit+' '+plan.profile.name;
 const context=document.createElement('p');context.className='help';context.textContent=acid?'pH lower working bound ≈'+plan.assumed_ph.toFixed(1)+' ('+plan.source+') · calculated correction toward '+plan.target.toFixed(1)+' · '+plan.volume_gallons+' gal':'FC '+plan.assumed_fc+' ppm ('+plan.source+') → target '+plan.target+' ppm'+(plan.target_default?' (default; not yet set by owner)':'')+' · '+plan.volume_gallons+' gal';
 if(acid&&unit==='cup')context.textContent+=' · ≈'+(amount*48).toFixed(2)+' tsp (same amount)';
 const use=document.createElement('button');use.id='guestUseSuggested';use.type='button';use.className='secondary';use.textContent=plan.sequence?'Mixing finished · use this amount':'Use this amount';
 use.onclick=()=>{
  if(guestBusy||guestCorrection)return;
  const current=planner(activeEvents(),guestContext?.products||[],config,session?.user_id);
  if(current.status!=='dose'||current.sample_id!==plan.sample_id||current.mL!==plan.mL||$('guestProduct').value!==plan.profile.id){refreshGuestDoseAdvice();guestStatus('Test or product changed. Review the updated suggestion.');return;}
  if($('guestAmount').value&&(Number($('guestAmount').value)!==amount||$('guestUnit').value!==unit)&&!confirm('Replace the entered amount and unit with this suggestion? Nothing is saved yet.'))return;
  $('guestAmount').value=amount;$('guestUnit').value=unit;guestPending=null;$('guestConfirmAdded').checked=false;$('guestConfirmAdded').required=true;$('guestConfirmRow').hidden=false;
  guestStatus('Amount filled in—not saved. After an adult adds it, confirm the amount and tap Save dose.');
  if(typeof refreshGuestWorkflow==='function')refreshGuestWorkflow();
 };
 const details=document.createElement('details'),heading=document.createElement('summary');heading.textContent='How this was calculated';details.append(heading,summary,context);box.append(quantity,use,details);
}
function setupGuestDoseTarget(){
 const box=document.createElement('section');box.id='guestDoseTargetSettings';box.className='calcbox';box.innerHTML='<h3>Bleach dosing target</h3><label for="guestFcTarget">FC target · ppm</label><input id="guestFcTarget" type="number" min="0.1" max="10" step="0.1"><p class="help">Shared by owner and guest bleach calculators. Separate from chart limits; invitation dose caps still apply.</p><button id="guestSaveFcTarget" type="button" class="secondary">Save dosing target</button><p id="guestFcTargetStatus" role="status"></p>';$('guestManagement').prepend(box);
 let dirty=false,base=null,calculatorEdited=false;
 $('guestFcTarget').oninput=()=>{if(!dirty)base=configClone(config);dirty=true;};
 $('targetFc').addEventListener('input',()=>{calculatorEdited=true;});
 const refresh=()=>{if(!dirty)$('guestFcTarget').value=config?.targets?.fc_target_ppm??5;if(!calculatorEdited){$('targetFc').value=config?.targets?.fc_target_ppm??5;calculate();}if(!dirty)$('guestFcTargetStatus').textContent=config?.targets?.fc_target_ppm==null?'Current default: 5 ppm · save to make it explicit':generalPatch.fc_target_ppm?'Saved on this device · sync pending':'Saved target: '+config.targets.fc_target_ppm+' ppm';};
 $('guestSaveFcTarget').onclick=async()=>{const input=$('guestFcTarget'),value=Number(input.value);if(!input.value||!Number.isFinite(value)||value<.1||value>10){$('guestFcTargetStatus').textContent='Enter an FC target from 0.1 to 10 ppm.';return;}stageConfigField('fc_target_ppm',value,base??config);config=applyPendingConfig(config||{schema_version:2,spa:{model:'Jacuzzi J-365',volume_gallons:395}});writeConfigState(config,true);dirty=false;base=null;calculatorEdited=false;render();if(session){const ok=await syncConfig();refresh();if(!ok)$('guestFcTargetStatus').textContent='Saved on this device · sync pending';}};
 box.querySelector('h3').textContent='Owner bleach dosing target';box.querySelector('p.help').textContent='Owner calculator target. Guest goals below can differ; chart limits and invitation caps are separate.';
 const goals=document.createElement('section');goals.id='guestGoalSettings';goals.className='calcbox';goals.innerHTML='<h3>Guest dosing goals</h3><label for="guestGoalPh">pH goal</label><input id="guestGoalPh" type="number" min="7.2" max="7.8" step="0.1"><label for="guestGoalFc">FC goal · ppm</label><input id="guestGoalFc" type="number" min="0.1" max="10" step="0.1"><p class="help">Defaults: pH 7.4 · FC 7.5 ppm. Acid uses a conservative calculated correction only when the strip range clearly exceeds 7.8; no promise of an exact endpoint. Dose limits still apply.</p><button id="guestSaveGoals" type="button" class="secondary">Save guest goals</button><p id="guestGoalStatus" role="status"></p>';box.after(goals);
 let goalsDirty=false,goalsBase=null;for(const id of ['guestGoalPh','guestGoalFc'])$(id).oninput=()=>{if(!goalsDirty)goalsBase=configClone(config);goalsDirty=true;};
 const refreshGoals=()=>{if(goalsDirty)return;$('guestGoalPh').value=config?.targets?.guest_ph_target??7.4;$('guestGoalFc').value=config?.targets?.guest_fc_target_ppm??config?.targets?.fc_target_ppm??7.5;$('guestGoalStatus').textContent=generalPatch.guest_ph_target||generalPatch.guest_fc_target_ppm?'Saved on this device · sync pending':'Guest goals: pH '+$('guestGoalPh').value+' · FC '+$('guestGoalFc').value+' ppm';};
 $('guestSaveGoals').onclick=async()=>{const ph=Number($('guestGoalPh').value),fc=Number($('guestGoalFc').value);if(!Number.isFinite(ph)||ph<7.2||ph>7.8||!Number.isFinite(fc)||fc<.1||fc>10){$('guestGoalStatus').textContent='Use pH 7.2–7.8 and FC 0.1–10 ppm.';return;}for(const [key,value]of [['guest_ph_target',ph],['guest_fc_target_ppm',fc]])stageConfigField(key,value,goalsBase??config);config=applyPendingConfig(config||{schema_version:2,spa:{model:'Jacuzzi J-365',volume_gallons:395}});writeConfigState(config,true);goalsDirty=false;goalsBase=null;render();if(session){await syncConfig();refreshGoals();}};
 const before=render;render=function(...args){before(...args);refresh();refreshGoals();};const unsaved=appHasUnsavedWork;appHasUnsavedWork=()=>unsaved()||dirty||goalsDirty;refresh();refreshGoals();
}
