// Presentation only: tests and actual additions still use separate, idempotent
// submissions. Suggestions never become records and no chemistry rules change.
let guestFlow={phase:'test',sample_id:null};
function setupGuestWorkflow(){
 if(!guestPage()||!$('guestForm'))return;
 const style=document.createElement('style');style.textContent='.guest-mode #guestActivities{grid-template-columns:repeat(2,minmax(0,1fr))}.guest-mode #guestChooseDose{font-size:13px;padding:9px 12px;margin:0 0 12px}.guest-flow-review{border-left:3px solid #79d7c3;padding:4px 12px;margin:12px 0}.guest-flow-review p{margin:6px 0}.guest-flow-review h3{margin:4px 0;font-size:17px}';document.head.append(style);
 $('guestChooseTest').textContent='Test & dose';
 const manual=$('guestChooseDose');$('guestActivities').after(manual);manual.textContent='Log a dose already added';manual.className='secondary';
 const review=document.createElement('section');review.id='guestFlowReview';review.className='guest-flow-review';review.hidden=true;review.setAttribute('aria-live','polite');review.innerHTML='<h3 id="guestFlowTitle"></h3><p id="guestFlowSample" class="help"></p><p id="guestFlowNext"></p><button id="guestFlowNewTest" type="button" class="secondary">New test</button>';manual.after(review);
 function showKind(type){$('guestKind').value=type;$('guestKind').dispatchEvent(new Event('change',{bubbles:true}));}
 function startTest(){guestFlow={phase:'test',sample_id:null};showKind('chemistry');}
 manual.onclick=()=>{if(guestBusy||guestCorrection){guestStatus('Save or cancel the current entry first.');return;}guestFlow={phase:'manual',sample_id:null};$('guestConfirmAdded').required=false;$('guestConfirmAdded').checked=false;$('guestConfirmRow').hidden=true;showKind('chemical_addition');};
 $('guestChooseTest').addEventListener('click',()=>{if(!guestBusy&&!guestCorrection)startTest();});
 $('guestChooseSoak').addEventListener('click',()=>{if(!guestBusy&&!guestCorrection){guestFlow={phase:'soak',sample_id:null};refreshGuestWorkflow();}});
 $('guestFlowNewTest').onclick=()=>{if(guestBusy||guestCorrection)return;if(Number($('guestAmount').value)>0&&!confirm('Leave this unsaved dose entry? Nothing will be recorded.'))return;startTest();};
 const guide=$('guestGuideTest').onclick;$('guestGuideTest').onclick=()=>{guide();if(!guestCorrection&&!guestBusy)startTest();};
 const shortcut=$('guestBleachShortcut').onclick;$('guestBleachShortcut').onclick=()=>{if(guestBusy||guestCorrection)return;if(guestFlow.phase==='review')return;shortcut();const sample=activeEvents().filter(e=>e.type==='chemistry'&&Number.isFinite(e.fc_ppm)&&modelTime(e)!=null).sort(timelineOrder).at(-1);guestFlow={phase:'review',sample_id:sample?.id??null};refreshGuestDoseAdvice();};
 const advice=refreshGuestDoseAdvice;refreshGuestDoseAdvice=function(...args){advice(...args);refreshGuestWorkflow();};
 // Only a confirmed server save can advance a test to a recommendation.
 document.addEventListener('guest-entry-saved',({detail:{event,refreshed}})=>{
  if(event.supersedes_event_id){guestFlow={phase:'manual',sample_id:null};refreshGuestWorkflow();guestBaseline=guestSignature();return;}
  if(event.type==='chemistry'&&refreshed){
   const rows=activeEvents(),products=guestContext?.products||[],bleach=guestBleachPlan(rows,products,config,session?.user_id),acid=guestAcidPlan(rows,products,config,session?.user_id);
   const b=products.find(p=>p.profile.family==='hypochlorite'),a=products.find(p=>p.profile.family==='bisulfate');
   // Address bleach first. A blocked bleach calculation must not be bypassed
   // by automatically offering an acid dose from the same test.
   const product=b&&bleach.status!=='none'?b:a&&acid.status!=='none'?a:b||a;
   guestFlow={phase:'review',sample_id:event.id};showKind(products.length?'chemical_addition':'chemistry');if(product)$('guestProduct').value=product.profile.id;
   refreshGuestDoseAdvice();guestStatus('Test saved. Review the next step below—no dose has been recorded.');
  }else if(event.type==='chemical_addition'){guestFlow={phase:'after-dose',sample_id:null};showKind('chemistry');guestStatus('Dose saved. Mix first, then log a fresh test before another adjustment.');}
  else if(!refreshed){guestFlow={phase:'test',sample_id:null};refreshGuestWorkflow();}
  guestBaseline=guestSignature();
 });
 $('guestOwnEntries').addEventListener('click',()=>refreshGuestWorkflow());
 $('guestCancel').addEventListener('click',()=>{guestFlow={phase:'test',sample_id:null};$('guestAmount').value='';for(const key of Object.keys(STRIP_PROFILE.blocks))$('guest-'+key).value='';showKind('chemistry');guestBaseline=guestSignature();});
 $('guestKind').addEventListener('change',()=>refreshGuestWorkflow());
 // Guidance uses the exact current buttons rather than a separate Dose tab.
 const steps=$('tab-guest-guide').querySelector('ol');steps.children[0].innerHTML='<strong>Log → Test &amp; dose.</strong> Enter strip FC and pH, then <strong>Save test &amp; check doses</strong>.';steps.children[1].innerHTML='<strong>Review the next step.</strong> If a dose is suggested, tap <strong>Use this amount</strong>. Add it, confirm the actual quantity, then <strong>Save actual dose</strong>. The test alone never records a dose.';
 steps.children[3].innerHTML='<strong>Log → Soak.</strong> Enter bathers, minutes and jets/air, then <strong>Save soak</strong>. Time is the soak’s start; change it if logging afterward. Secure the cover when finished.';
 const help=$('tab-guest-guide').querySelector('details p');help.textContent='Test & dose shows the next calculated dose or explains why none is suggested. Handle one chemical at a time, mix and save a fresh test before another adjustment. Log a dose already added is for recording completed additions, not a second recommendation.';
 refreshGuestWorkflow();
}
function refreshGuestWorkflow(){
 if(!$('guestFlowReview'))return;
 const type=$('guestKind').value,review=guestFlow.phase==='review'&&!guestCorrection&&type!=='soak';
 $('guestFlowReview').hidden=!review;
 const manual=$('guestChooseDose');manual.hidden=false;
 $('guestChooseTest').setAttribute('aria-pressed',String(type==='chemistry'||review));$('guestChooseTest').className=type==='chemistry'||review?'primary':'secondary';
 const label=guestCorrection?'Save correction':type==='chemistry'?(guestFlow.phase==='after-dose'?'Save retest & check doses':'Save test & check doses'):type==='chemical_addition'?'Save actual dose':'Save soak';$('guestSubmit').textContent=label;
 // Restore ordinary controls before deciding whether a guided dose is usable.
 $('guestSubmit').hidden=false;
 const productLabel=$('guestProduct').labels[0];productLabel.hidden=review;$('guestProduct').hidden=review;
 $('guestDoseAdvice').hidden=guestFlow.phase==='manual'&&!guestCorrection;
 for(const id of ['guestAmount','guestUnit']){$(id).hidden=false;$(id).labels[0].hidden=false;}
 if(!review)return;
 const rows=activeEvents(),sample=rows.find(e=>e.id===guestFlow.sample_id),products=guestContext?.products||[],selected=products.find(p=>p.profile.id===$('guestProduct').value);
 $('guestFlowTitle').textContent='Test saved · next step';
 $('guestFlowSample').textContent=sample?Object.entries(sample.strip_observations?.readings||{}).map(([k,r])=>({fc_ppm:'FC',ph:'pH',ta_ppm:'TA'}[k])+' '+r.choice).join(' · ')+' · '+sample.timestamp.replace('T',' '):'Test saved. Refresh the connection before calculating.';
 const plan=selected?(selected.profile.family==='bisulfate'?guestAcidPlan:guestBleachPlan)(rows,products,config,session?.user_id):null,actualDraft=Number($('guestAmount').value)>0,ready=!!selected&&(plan?.status==='dose'||actualDraft);
 const acid=products.some(p=>p.profile.family==='bisulfate')?guestAcidPlan(rows,products,config,session?.user_id):null;
 const bleach=products.some(p=>p.profile.family==='hypochlorite')?guestBleachPlan(rows,products,config,session?.user_id):null;
 const noAdjustment=!!(bleach||acid)&&(!bleach||bleach.status==='none')&&(!acid||acid.status==='none');
 $('guestFlowNext').textContent=actualDraft&&plan?.status!=='dose'?'The calculation changed. Your entered amount is preserved; save only if you actually added it.':ready?(selected.profile.family==='hypochlorite'&&acid?.status==='dose'?'Bleach first. Mix and retest before checking pH Down.':'Review the suggestion below. Save only what you actually add.'):!products.length?'No chemical additions are enabled. Your test is saved.':plan?.status==='none'?'No dose suggested for '+selected.profile.name+'. '+(acid&&acid.status!=='dose'?acid.message:''):'Check the message below before adding anything.';
 $('guestFlowNewTest').textContent='Log another test';
 if(noAdjustment&&!actualDraft)$('guestFlowNext').textContent='No dose suggested from these strip ranges. View Trends or log your soak when ready.';
 $('guestTest').hidden=true;$('guestDose').hidden=!products.length||noAdjustment&&!actualDraft;
 for(const input of $('guestDose').querySelectorAll('input,select'))input.disabled=guestBusy||!ready;
 $('guestSubmit').hidden=!ready||!actualDraft;
 const staging=ready&&!actualDraft,showUnit=actualDraft||staging&&!$('guestUseSuggested');
 $('guestAmount').labels[0].hidden=!actualDraft;$('guestAmount').hidden=!actualDraft;
 $('guestUnit').labels[0].hidden=!showUnit;$('guestUnit').hidden=!showUnit;
 if(!actualDraft)$('guestConfirmRow').hidden=true;
 $('guestBleachShortcut').hidden=true;
}
