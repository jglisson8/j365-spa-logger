// Guest suggestions are drafts only. Canonical saved samples and actual doses
// still pass through the existing server validation and private event history.
function guestBleachPlan(events,products,settings,userId,now=Date.now()){
 const stop=message=>({status:'check',message});
 const approved=products.find(p=>p.profile.family==='hypochlorite');
 if(!approved)return stop('Bleach is not enabled for this invitation.');
 const rows=events.filter(e=>e.type==='chemistry'&&Number.isFinite(e.fc_ppm)&&Number.isFinite(modelTime(e))&&modelTime(e)<=now+60000).sort(timelineOrder),sample=rows.at(-1);
 if(!sample||now-modelTime(sample)>30*60000)return stop('Log a fresh FC test to calculate bleach.');
 const time=modelTime(sample);
 if(events.some(e=>e.id!==sample.id&&Number.isFinite(modelTime(e))&&modelTime(e)<=now+60000&&timelineOrder(e,sample)>0&&(['soak','chemical_addition','water_change','water_top_off'].includes(e.type)||isExposure(e))))return stop('Water has changed since that test. Retest FC before calculating another dose.');
 const range=isStripParameter(sample,'fc_ppm')?stripReading(sample,'fc_ppm'):null;
 if(isStripParameter(sample,'fc_ppm')&&(!range||!Number.isFinite(range.maximum)))return stop('That strip result is off scale. Confirm FC before adding bleach.');
 const assumed=range?range.maximum:sample.fc_ppm;
 const target=settings?.targets?.fc_target_ppm??5;
 if(!Number.isFinite(target)||target<=0||target>10)return stop('Ask the owner to check the FC target.');
 const base={sample_id:sample.id,sample_time:time,assumed_fc:assumed,target,profile:approved.profile,source:range?'strip upper bound':'Taylor reading'};
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
 const digits=unit==='mL'?1:2,scale=10**digits;
 return Math.floor((mL/PRODUCT_VOLUME[unit]+1e-10)*scale)/scale;
}
function refreshGuestDoseAdvice(){
 if(!$('guestDoseAdvice'))return;
 const rows=activeEvents(),plan=guestBleachPlan(rows,guestContext?.products||[],config,session?.user_id),selected=guestContext?.products.find(p=>p.profile.id===$('guestProduct').value);
 const box=$('guestDoseAdvice');box.replaceChildren();
 $('guestBleachShortcut').hidden=plan.status!=='dose'||!!guestCorrection;
 if(guestCorrection){box.textContent='Correct the amount actually added. This does not recommend a new dose.';return;}
 if(selected?.profile.family!=='hypochlorite'){box.textContent='For pH Down, follow the owner’s dose instructions. Automatic acid recommendations are not enabled.';return;}
 const summary=document.createElement('p');summary.textContent=plan.message;box.append(summary);
 if(plan.status!=='dose')return;
 if(selected.profile.id!==plan.profile.id){box.textContent='Select '+plan.profile.name+' to use the approved bleach calculation.';return;}
 const unit=$('guestUnit').value,amount=guestSuggestedAmount(plan.mL,unit);
 if(!(amount>0)){box.textContent='Calculated volume is too small for this unit. Choose tsp or mL.';return;}
 const quantity=document.createElement('strong');quantity.textContent='≈'+amount+' '+unit+' '+plan.profile.name;
 const context=document.createElement('p');context.className='help';context.textContent='FC '+plan.assumed_fc+' ppm ('+plan.source+') → target '+plan.target+' ppm · '+plan.volume_gallons+' gal';
 const use=document.createElement('button');use.id='guestUseSuggested';use.type='button';use.className='secondary';use.textContent='Use this amount';
 use.onclick=()=>{
  if(guestBusy||guestCorrection)return;
  const current=guestBleachPlan(activeEvents(),guestContext?.products||[],config,session?.user_id);
  if(current.status!=='dose'||current.sample_id!==plan.sample_id||current.mL!==plan.mL||$('guestProduct').value!==plan.profile.id){refreshGuestDoseAdvice();guestStatus('Test or product changed. Review the updated suggestion.');return;}
  if($('guestAmount').value&&Number($('guestAmount').value)!==amount&&!confirm('Replace the entered amount with this suggestion? Nothing is saved yet.'))return;
  $('guestAmount').value=amount;guestPending=null;$('guestConfirmAdded').checked=false;$('guestConfirmAdded').required=true;$('guestConfirmRow').hidden=false;
  guestStatus('Amount filled in—not saved. Add the dose, confirm the actual amount, then Save.');
 };
 box.prepend(quantity,context);box.append(use);
}
