// Tests and actual additions remain separate, idempotent saves. The combined
// workflow is reconstructed from saved events; a timer never records a dose.
let guestFlow={phase:'test',sample_id:null};
let guestSequenceLastRefresh=0;
function guestResumeDoseSequence(){
 if(!$('guestFlowReview')||!guestContext||guestBusy||guestCorrection||guestPending||Number($('guestAmount').value)>0||!['test','after-dose','sequence'].includes(guestFlow.phase))return false;
 const plan=guestCombinedAcidPlan(activeEvents(),guestContext.products,config,session?.user_id);
 if(!plan){if(guestFlow.phase==='sequence'){guestFlow={phase:'review',sample_id:guestFlow.sample_id};refreshGuestDoseAdvice();guestStatus('Water history changed. Check the next step before adding anything.');}return false;}
 guestFlow={phase:'sequence',sample_id:plan.sample_id,ready_at:plan.ready_at,bleach_id:plan.bleach_id};
 $('guestKind').value='chemical_addition';$('guestProduct').value=plan.profile.id;$('guestAfterDose').hidden=true;
 $('guestKind').dispatchEvent(new Event('change',{bubbles:true}));guestBaseline=guestSignature();return true;
}
function guestSequenceTick(){
 if(document.hidden||guestBusy||guestConnecting||guestFlow.phase!=='sequence'||!guestContext||!Number.isFinite(guestFlow.ready_at))return;
 const remaining=Math.max(0,guestFlow.ready_at-Date.now()),clock=$('guestWaitCountdown');
 if(clock)clock.textContent=remaining?'pH Down in '+Math.ceil(remaining/60000)+' min':'Mixing wait finished';
 // No forecast/chart recomputation on timer ticks. Refresh once at expiry
 // (retry at most every 15 seconds); suspended phones use wall-clock time.
 if(!remaining&&guestContextLoadedAt<guestFlow.ready_at&&Date.now()-guestSequenceLastRefresh>=15000){guestSequenceLastRefresh=Date.now();return connectGuest();}
}
function setupGuestWorkflow(){
 if(!guestPage()||!$('guestForm'))return;
 const style=document.createElement('style');style.textContent='#guestWaitCountdown{font-size:1.2rem;font-weight:700;color:#9fe5da}.guest-mode #guestActivities{grid-template-columns:repeat(2,minmax(0,1fr))}.guest-mode #guestChooseDose{font-size:13px;padding:9px 12px;margin:0 0 12px}.guest-flow-review{border-left:3px solid #79d7c3;padding:4px 12px;margin:12px 0}.guest-flow-review p{margin:6px 0}.guest-flow-review h3{margin:4px 0;font-size:17px}';document.head.append(style);
 $('guestChooseTest').textContent='Check water';
 const manual=$('guestChooseDose'),other=document.createElement('details');other.id='guestOtherOptions';other.innerHTML='<summary>Other options</summary><p class="help">Use manual entry only for a dose already added outside this water check.</p>';$('guestSubmit').after(other);other.append(manual);manual.textContent='Enter a dose manually';manual.className='secondary';
 const actual=document.createElement('details');actual.id='guestActualDetails';actual.innerHTML='<summary id="guestActualSummary">Amount added · change</summary>';$('guestDoseAdvice').after(actual);actual.append($('guestAmount').labels[0],$('guestAmount'),$('guestUnit').labels[0],$('guestUnit'));const unitHelp=[...$('guestDose').children].find(e=>e.matches('p.help'));if(unitHelp)actual.append(unitHelp);
 const review=document.createElement('section');review.id='guestFlowReview';review.className='guest-flow-review';review.hidden=true;review.setAttribute('aria-live','polite');review.innerHTML='<h3 id="guestFlowTitle"></h3><p id="guestWaitCountdown" aria-live="off" hidden></p><p id="guestFlowSample" class="help"></p><p id="guestFlowNext"></p><p id="guestFlowWarning" class="chart-warning" hidden></p><button id="guestFlowNewTest" type="button" class="secondary">New test</button>';$('guestActivities').after(review);
 function showKind(type){$('guestKind').value=type;$('guestKind').dispatchEvent(new Event('change',{bubbles:true}));}
 function startTest(){guestFlow={phase:'test',sample_id:null};showKind('chemistry');}
 document.addEventListener('click',e=>{
  if(!e.target.closest('#guestChooseTest,#guestChooseSoak,#guestGuideTest')||guestBusy||guestCorrection||$('guestKind').value!=='chemical_addition'||!(Number($('guestAmount').value)>0))return;
  if(!confirm('This dose is not saved. Leave it? If you already added it, save the dose first.')){e.preventDefault();e.stopImmediatePropagation();return;}
  $('guestAmount').value='';$('guestConfirmAdded').checked=false;guestPending=null;
 },true);
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
  }else if(event.type==='chemical_addition'){guestFlow={phase:'after-dose',sample_id:null};if(refreshed&&guestResumeDoseSequence()){guestStatus('Bleach saved. Mix for 20 minutes; pH Down is next.');}else{showKind('chemistry');guestStatus('Dose saved. Mix first, then log a final test before soaking.');}}
  else if(!refreshed){guestFlow={phase:'test',sample_id:null};refreshGuestWorkflow();}
  guestBaseline=guestSignature();
 });
 $('guestOwnEntries').addEventListener('click',()=>refreshGuestWorkflow());
 $('guestCancel').addEventListener('click',()=>{guestFlow={phase:'test',sample_id:null};$('guestAmount').value='';for(const key of Object.keys(STRIP_PROFILE.blocks))$('guest-'+key).value='';showKind('chemistry');guestBaseline=guestSignature();});
 $('guestKind').addEventListener('change',()=>refreshGuestWorkflow());
 // Guidance uses the exact current buttons rather than a separate Dose tab.
 const steps=$('tab-guest-guide').querySelector('ol');steps.children[0].innerHTML='<strong>Log → Check water.</strong> Match the FC and pH colors on the strip bottle. Tap <strong>Save test</strong>.';steps.children[1].innerHTML='<strong>Follow the next step.</strong> A suggested amount appears automatically. Tap <strong>Use this amount</strong>, have an adult add it, tick the confirmation, then <strong>Save dose</strong>. Save test never records a dose.';
 steps.children[3].innerHTML='<strong>Log → Soak.</strong> Enter bathers, minutes and jets/air, then <strong>Save soak</strong>. Time is the soak’s start; change it if logging afterward. Secure the cover when finished.';
 const help=$('tab-guest-guide').querySelector('details p');help.textContent='If both chemicals are suggested: bleach first, run both jets with the cover open for 20 minutes, then follow the pH Down prompt—no extra test in between. After pH Down, mix for another 20 minutes and log a final test before soaking. Follow longer product-label waits. A new soak, dose, refill or changed water data can require a fresh test. Only adults handle chemicals. Other options → Enter a dose manually is for an addition already completed outside this check.';
 steps.children[2].innerHTML='<strong>Follow the mixing screen.</strong> If both doses are needed, bleach comes first. Keep the cover open and Jets 1 and 2 running for at least 20 minutes, then follow the pH Down prompt. Mix another 20 minutes, then log a final test before soaking. Follow longer label waits.';
 setInterval(guestSequenceTick,1000);
 refreshGuestWorkflow();
}
function refreshGuestWorkflow(){
 if(!$('guestFlowReview'))return;
 const type=$('guestKind').value,sequence=guestFlow.phase==='sequence',review=['review','sequence'].includes(guestFlow.phase)&&!guestCorrection&&type!=='soak';
 $('guestFlowReview').hidden=!review;
 const manual=$('guestChooseDose');manual.hidden=false;$('guestBleachShortcut').hidden=true;
 $('guestChooseTest').setAttribute('aria-pressed',String(type==='chemistry'||review));$('guestChooseTest').className=type==='chemistry'||review?'primary':'secondary';
 const label=guestCorrection?'Save correction':type==='chemistry'?(guestFlow.phase==='after-dose'?'Save retest':'Save test'):type==='chemical_addition'?'Save dose':'Save soak';$('guestSubmit').textContent=label;
 // Restore ordinary controls before deciding whether a guided dose is usable.
 $('guestSubmit').hidden=false;
 const productLabel=$('guestProduct').labels[0];productLabel.hidden=review;$('guestProduct').hidden=review;
 $('guestActualDetails').hidden=false;if(!review){$('guestActualDetails').open=true;$('guestActualSummary').textContent='Amount actually added';}
 $('guestDoseAdvice').hidden=guestFlow.phase==='manual'&&!guestCorrection;
 for(const id of ['guestAmount','guestUnit']){$(id).hidden=false;$(id).labels[0].hidden=false;}
 $('guestFlowWarning').hidden=true;$('guestWaitCountdown').hidden=true;$('guestFlowNewTest').hidden=false;$('guestTimeDetails').hidden=false;if(!review)return;
 const rows=activeEvents(),sample=rows.find(e=>e.id===guestFlow.sample_id),products=guestContext?.products||[],selected=products.find(p=>p.profile.id===$('guestProduct').value);
 $('guestFlowTitle').textContent='Test saved · next step';
 $('guestFlowSample').textContent=sample?Object.entries(sample.strip_observations?.readings||{}).map(([k,r])=>({fc_ppm:'FC',ph:'pH',ta_ppm:'TA'}[k])+' '+r.choice).join(' · ')+' · '+sample.timestamp.replace('T',' '):'Test saved. Refresh the connection before calculating.';
 const plan=selected?guestUiDosePlan(selected.profile,rows,products,config,session?.user_id):null,actualDraft=Number($('guestAmount').value)>0||$('guestConfirmAdded').required&&!$('guestConfirmRow').hidden,ready=!!selected&&(plan?.status==='dose'||actualDraft);
 $('guestActualDetails').hidden=!actualDraft;if(!actualDraft)$('guestActualDetails').open=false;
 const amount=Number($('guestAmount').value),unit=$('guestUnit').value,fraction=unit==='cup'?(Math.abs(amount-1/3)<1e-7?'⅓':amount===.25?'¼':amount===.5?'½':amount):amount;
 $('guestActualSummary').textContent='Actual addition: '+fraction+' '+unit+' · change';
 if($('guestUseSuggested'))$('guestUseSuggested').hidden=actualDraft;
 $('guestTimeDetails').hidden=!actualDraft;
 const acid=products.some(p=>p.profile.family==='bisulfate')?guestPracticalDose(guestAcidPlan(rows,products,config,session?.user_id)):null;
 const bleach=products.some(p=>p.profile.family==='hypochlorite')?guestPracticalDose(guestBleachPlan(rows,products,config,session?.user_id)):null;
 const noAdjustment=!!(bleach||acid)&&(!bleach||bleach.status==='none')&&(!acid||acid.status==='none');
 $('guestFlowTitle').textContent=actualDraft?'Confirm the dose':plan?.status==='dose'?'Next: add '+(selected.profile.family==='hypochlorite'?'bleach':'pH Down'):noAdjustment?'No dose suggested':'One more check';
 $('guestFlowNext').textContent=actualDraft&&plan?.status!=='dose'?'The calculation changed. Your entered amount is unchanged. Save only if an adult actually added it.':actualDraft?'Check the amount and unit. After an adult adds it, tick the box and tap Save dose.':ready?(selected.profile.family==='hypochlorite'&&acid?.status==='dose'?'Bleach first. Keep the cover open with Jets 1 and 2 running for at least 20 minutes (longer if the label says), then this screen will prompt for pH Down—no test in between. After pH Down, run both jets with the cover open for another 20 minutes (longer if the label says), then retest before soaking. Never add them together.':'Use the suggested amount below. Only an adult should handle chemicals.'):!products.length?'This guest access has no approved products. Your test is saved; ask the owner to enable dosing.':plan?.status==='none'?'No dose suggested for '+selected.profile.name+'. '+(acid&&acid.status!=='dose'?acid.message:''):'Read the message below before adding anything.';
 $('guestFlowNewTest').textContent='Log another test';
 delete $('guestFlowNewTest').dataset.completeParameter;
 if(!ready&&plan?.status==='check'&&sample){const missing=sample.fc_ppm==null?'fc_ppm':sample.ph==null?'ph':/\bTA\b|alkalinity/i.test(plan.message)?'ta_ppm':null;if(missing){$('guestFlowNewTest').textContent='Add '+({fc_ppm:'FC',ph:'pH',ta_ppm:'alkalinity (TA)'}[missing])+' to this test';$('guestFlowNewTest').dataset.completeParameter=missing;}}
 if(noAdjustment&&!actualDraft)$('guestFlowNext').textContent='No chemical adjustment is suggested from these strip ranges. You can view Trends or log another activity.';
 if(sequence){
  $('guestFlowSample').textContent='Bleach saved → mix → pH Down → final water check';
  $('guestFlowNext').textContent=plan?.status==='wait'?'Keep the cover open with Jets 1 and 2 running. Do not add pH Down yet. This screen will show the next dose when the wait is finished.':plan?.status==='dose'?(actualDraft?'Check the actual amount and unit. After an adult adds it, tick the confirmation and tap Save dose.':'After both jets have run with the cover open for 20 minutes (longer if the label says), add the pH Down amount below. Then mix again and log a final test before soaking.'):'The next dose needs another check. '+(plan?.message||'Log a fresh test.');
  if(plan?.status==='wait'){$('guestFlowTitle').textContent='Bleach saved · mixing';$('guestWaitCountdown').hidden=false;$('guestWaitCountdown').textContent=Date.now()<guestFlow.ready_at?'pH Down in '+Math.ceil((guestFlow.ready_at-Date.now())/60000)+' min':'Checking latest water data…';$('guestFlowNewTest').hidden=true;$('guestTimeDetails').hidden=true;}
 }
 if(ready&&!actualDraft)$('guestFlowNewTest').hidden=true;
 if(sample&&(sample.ph<7.2||sample.fc_ppm>10)){$('guestFlowWarning').hidden=false;$('guestFlowWarning').textContent='Do not soak yet. Ask the owner to check this reading. Never add pH Down to low-pH water.';}
 $('guestTest').hidden=true;$('guestDose').hidden=!products.length||noAdjustment&&!actualDraft||sequence&&plan?.status==='wait';
 for(const input of $('guestDose').querySelectorAll('input,select'))input.disabled=guestBusy||!ready;
 $('guestSubmit').hidden=!ready||!actualDraft;
 const staging=ready&&!actualDraft,showUnit=actualDraft||staging&&!$('guestUseSuggested');
 $('guestAmount').labels[0].hidden=!actualDraft;$('guestAmount').hidden=!actualDraft;
 $('guestUnit').labels[0].hidden=!showUnit;$('guestUnit').hidden=!showUnit;
 if(!actualDraft)$('guestConfirmRow').hidden=true;
 $('guestBleachShortcut').hidden=true;
}
