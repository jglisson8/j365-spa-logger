// Presentation only: tests and actual additions still use separate, idempotent
// submissions. Suggestions never become records and no chemistry rules change.
let guestFlow={phase:'test',sample_id:null};
function setupGuestWorkflow(){
 if(!guestPage()||!$('guestForm'))return;
 const style=document.createElement('style');style.textContent='.guest-mode #guestActivities{grid-template-columns:repeat(2,minmax(0,1fr))}.guest-mode #guestChooseDose{font-size:13px;padding:9px 12px;margin:0 0 12px}.guest-flow-review{border-left:3px solid #79d7c3;padding:4px 12px;margin:12px 0}.guest-flow-review p{margin:6px 0}.guest-flow-review h3{margin:4px 0;font-size:17px}';document.head.append(style);
 $('guestChooseTest').textContent='Check water';
 const manual=$('guestChooseDose'),other=document.createElement('details');other.id='guestOtherOptions';other.innerHTML='<summary>Other options</summary><p class="help">Use manual entry only for a dose already added outside this water check.</p>';$('guestSubmit').after(other);other.append(manual);manual.textContent='Enter a dose manually';manual.className='secondary';
 const review=document.createElement('section');review.id='guestFlowReview';review.className='guest-flow-review';review.hidden=true;review.setAttribute('aria-live','polite');review.innerHTML='<h3 id="guestFlowTitle"></h3><p id="guestFlowSample" class="help"></p><p id="guestFlowNext"></p><p id="guestFlowWarning" class="chart-warning" hidden></p><button id="guestFlowNewTest" type="button" class="secondary">New test</button>';$('guestActivities').after(review);
 function showKind(type){$('guestKind').value=type;$('guestKind').dispatchEvent(new Event('change',{bubbles:true}));}
 function startTest(){guestFlow={phase:'test',sample_id:null};showKind('chemistry');}
 manual.onclick=()=>{if(guestBusy||guestCorrection){guestStatus('Save or cancel the current entry first.');return;}guestFlow={phase:'manual',sample_id:null};$('guestConfirmAdded').required=true;$('guestConfirmAdded').checked=false;$('guestConfirmRow').hidden=false;showKind('chemical_addition');};
 $('guestChooseTest').addEventListener('click',()=>{if(!guestBusy&&!guestCorrection)startTest();});
 $('guestChooseSoak').addEventListener('click',()=>{if(!guestBusy&&!guestCorrection){guestFlow={phase:'soak',sample_id:null};refreshGuestWorkflow();}});
 $('guestFlowNewTest').onclick=()=>{if(guestBusy||guestCorrection)return;if(Number($('guestAmount').value)>0&&!confirm('Leave this unsaved dose entry? Nothing will be recorded.'))return;const parameter=$('guestFlowNewTest').dataset.completeParameter;if(parameter){const edit=[...$('guestOwnEntries').querySelectorAll('[data-guest-correct]')].find(b=>b.dataset.guestCorrect===guestFlow.sample_id);if(edit){edit.click();if(parameter==='ta_ppm')$('guestOptionalTests').open=true;$('guest-'+parameter).focus();return}}startTest();};
 const guide=$('guestGuideTest').onclick;$('guestGuideTest').onclick=()=>{guide();if(!guestCorrection&&!guestBusy)startTest();};
 const shortcut=$('guestBleachShortcut').onclick;$('guestBleachShortcut').onclick=()=>{if(guestBusy||guestCorrection)return;if(guestFlow.phase==='review')return;shortcut();const sample=activeEvents().filter(e=>e.type==='chemistry'&&Number.isFinite(e.fc_ppm)&&modelTime(e)!=null).sort(timelineOrder).at(-1);guestFlow={phase:'review',sample_id:sample?.id??null};refreshGuestDoseAdvice();};
 const advice=refreshGuestDoseAdvice;refreshGuestDoseAdvice=function(...args){advice(...args);refreshGuestWorkflow();};
 // Only a confirmed server save can advance a test to a recommendation.
 document.addEventListener('guest-entry-saved',({detail:{event,refreshed}})=>{
  if(event.supersedes_event_id&&event.type!=='chemistry'){guestFlow={phase:'manual',sample_id:null};refreshGuestWorkflow();guestBaseline=guestSignature();return;}
  if(event.type==='chemistry'&&refreshed){
   const rows=activeEvents(),products=guestContext?.products||[],bleach=guestPracticalDose(guestBleachPlan(rows,products,config,session?.user_id)),acid=guestPracticalDose(guestAcidPlan(rows,products,config,session?.user_id));
   const b=products.find(p=>p.profile.family==='hypochlorite'),a=products.find(p=>p.profile.family==='bisulfate');
   // Address bleach first. A blocked bleach calculation must not be bypassed
   // by automatically offering an acid dose from the same test.
   const product=b&&bleach.status!=='none'?b:a&&acid.status!=='none'?a:b||a;
   guestFlow={phase:'review',sample_id:event.id};showKind(products.length?'chemical_addition':'chemistry');if(product)$('guestProduct').value=product.profile.id;
   refreshGuestDoseAdvice();guestStatus('Test saved. Your next step is below.');$('guestFlowReview').scrollIntoView?.({behavior:'smooth',block:'nearest'});
  }else if(event.type==='chemical_addition'){guestFlow={phase:'after-dose',sample_id:null};showKind('chemistry');guestStatus('Dose saved. Mix first, then log a fresh test before another adjustment.');}
  else if(!refreshed){guestFlow={phase:'test',sample_id:null};refreshGuestWorkflow();}
  guestBaseline=guestSignature();
 });
 $('guestOwnEntries').addEventListener('click',()=>refreshGuestWorkflow());
 $('guestCancel').addEventListener('click',()=>{guestFlow={phase:'test',sample_id:null};$('guestAmount').value='';for(const key of Object.keys(STRIP_PROFILE.blocks))$('guest-'+key).value='';showKind('chemistry');guestBaseline=guestSignature();});
 $('guestKind').addEventListener('change',()=>refreshGuestWorkflow());
 // Guidance uses the exact current buttons rather than a separate Dose tab.
 const steps=$('tab-guest-guide').querySelector('ol');steps.children[0].innerHTML='<strong>Log → Check water.</strong> Match the FC and pH colors on the strip bottle. Tap <strong>Save test</strong>.';steps.children[1].innerHTML='<strong>Follow the next step.</strong> A suggested amount appears automatically. Tap <strong>Use this amount</strong>, have an adult add it, tick the confirmation, then <strong>Save dose</strong>. Save test never records a dose.';
 steps.children[3].innerHTML='<strong>Log → Soak.</strong> Enter bathers, minutes and jets/air, then <strong>Save soak</strong>. Time is the soak’s start; change it if logging afterward. Secure the cover when finished.';
 const help=$('tab-guest-guide').querySelector('details p');help.textContent='Check water shows the next suggested amount or explains what is missing. Only an adult should handle chemicals. Use one chemical at a time, mix, then retest. Other options → Enter a dose manually is only for an addition already completed outside this check.';
 refreshGuestWorkflow();
}
function refreshGuestWorkflow(){
 if(!$('guestFlowReview'))return;
 const type=$('guestKind').value,review=guestFlow.phase==='review'&&!guestCorrection&&type!=='soak';
 $('guestFlowReview').hidden=!review;
 const manual=$('guestChooseDose');manual.hidden=false;$('guestBleachShortcut').hidden=true;
 $('guestChooseTest').setAttribute('aria-pressed',String(type==='chemistry'||review));$('guestChooseTest').className=type==='chemistry'||review?'primary':'secondary';
 const label=guestCorrection?'Save correction':type==='chemistry'?(guestFlow.phase==='after-dose'?'Save retest':'Save test'):type==='chemical_addition'?'Save dose':'Save soak';$('guestSubmit').textContent=label;
 // Restore ordinary controls before deciding whether a guided dose is usable.
 $('guestSubmit').hidden=false;
 const productLabel=$('guestProduct').labels[0];productLabel.hidden=review;$('guestProduct').hidden=review;
 $('guestDoseAdvice').hidden=guestFlow.phase==='manual'&&!guestCorrection;
 for(const id of ['guestAmount','guestUnit']){$(id).hidden=false;$(id).labels[0].hidden=false;}
 $('guestFlowWarning').hidden=true;if(!review)return;
 const rows=activeEvents(),sample=rows.find(e=>e.id===guestFlow.sample_id),products=guestContext?.products||[],selected=products.find(p=>p.profile.id===$('guestProduct').value);
 $('guestFlowTitle').textContent='Test saved · next step';
 $('guestFlowSample').textContent=sample?Object.entries(sample.strip_observations?.readings||{}).map(([k,r])=>({fc_ppm:'FC',ph:'pH',ta_ppm:'TA'}[k])+' '+r.choice).join(' · ')+' · '+sample.timestamp.replace('T',' '):'Test saved. Refresh the connection before calculating.';
 const plan=selected?guestPracticalDose((selected.profile.family==='bisulfate'?guestAcidPlan:guestBleachPlan)(rows,products,config,session?.user_id)):null,actualDraft=Number($('guestAmount').value)>0,ready=!!selected&&(plan?.status==='dose'||actualDraft);
 const acid=products.some(p=>p.profile.family==='bisulfate')?guestPracticalDose(guestAcidPlan(rows,products,config,session?.user_id)):null;
 const bleach=products.some(p=>p.profile.family==='hypochlorite')?guestPracticalDose(guestBleachPlan(rows,products,config,session?.user_id)):null;
 const noAdjustment=!!(bleach||acid)&&(!bleach||bleach.status==='none')&&(!acid||acid.status==='none');
 $('guestFlowTitle').textContent=actualDraft?'Confirm the dose':plan?.status==='dose'?'Next: add '+(selected.profile.family==='hypochlorite'?'bleach':'pH Down'):noAdjustment?'No dose suggested':'One more check';
 $('guestFlowNext').textContent=actualDraft&&plan?.status!=='dose'?'The calculation changed. Your entered amount is unchanged. Save only if an adult actually added it.':actualDraft?'Check the amount and unit. After an adult adds it, tick the box and tap Save dose.':ready?(selected.profile.family==='hypochlorite'&&acid?.status==='dose'?'Bleach first. Keep the cover open with Jets 1 and 2 running for at least 20 minutes (longer if the label says), then retest before pH Down. After pH Down, run both jets with the cover open for another 20 minutes (longer if the label says), then retest before soaking. Never add them together.':'Use the suggested amount below. Only an adult should handle chemicals.'):!products.length?'This guest access has no approved products. Your test is saved; ask the owner to enable dosing.':plan?.status==='none'?'No dose suggested for '+selected.profile.name+'. '+(acid&&acid.status!=='dose'?acid.message:''):'Read the message below before adding anything.';
 $('guestFlowNewTest').textContent='Log another test';
 delete $('guestFlowNewTest').dataset.completeParameter;
 if(!ready&&plan?.status==='check'&&sample){const missing=sample.fc_ppm==null?'fc_ppm':sample.ph==null?'ph':/\bTA\b|alkalinity/i.test(plan.message)?'ta_ppm':null;if(missing){$('guestFlowNewTest').textContent='Add '+({fc_ppm:'FC',ph:'pH',ta_ppm:'alkalinity (TA)'}[missing])+' to this test';$('guestFlowNewTest').dataset.completeParameter=missing;}}
 if(noAdjustment&&!actualDraft)$('guestFlowNext').textContent='No chemical adjustment is suggested from these strip ranges. You can view Trends or log another activity.';
 if(sample&&(sample.ph<7.2||sample.fc_ppm>10)){$('guestFlowWarning').hidden=false;$('guestFlowWarning').textContent='Do not soak yet. Ask the owner to check this reading. Never add pH Down to low-pH water.';}
 $('guestTest').hidden=true;$('guestDose').hidden=!products.length||noAdjustment&&!actualDraft;
 for(const input of $('guestDose').querySelectorAll('input,select'))input.disabled=guestBusy||!ready;
 $('guestSubmit').hidden=!ready||!actualDraft;
 const staging=ready&&!actualDraft,showUnit=actualDraft||staging&&!$('guestUseSuggested');
 $('guestAmount').labels[0].hidden=!actualDraft;$('guestAmount').hidden=!actualDraft;
 $('guestUnit').labels[0].hidden=!showUnit;$('guestUnit').hidden=!showUnit;
 if(!actualDraft)$('guestConfirmRow').hidden=true;
 $('guestBleachShortcut').hidden=true;
}
