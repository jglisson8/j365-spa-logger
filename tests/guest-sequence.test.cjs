const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM,VirtualConsole}=require('jsdom'),tick=()=>new Promise(r=>setTimeout(r,50));
(async()=>{
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));let network=0;
 const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://spa.test/guest?practice=1&source=demo',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.Response=Response;w.scrollTo=()=>{};w.confirm=()=>true;w.fetch=async()=>{network++;throw Error('No real requests allowed')};}}),w=dom.window,$=id=>w.document.getElementById(id),submit=()=> $('guestForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true})),count=t=>w.eval('activeEvents().filter(e=>e.guest_actor&&e.type==='+JSON.stringify(t)+').length');
 try{
  await tick();await tick();$('guest-fc_ppm').value='1';$('guest-ph').value='8.4';$('guest-ta_ppm').value='80';submit();await tick();await tick();
  $('guestUseSuggested').click();$('guestConfirmAdded').checked=true;submit();submit();await tick();await tick();
  assert.equal(count('chemistry'),1);assert.equal(count('chemical_addition'),1);assert.equal(w.eval('guestFlow.phase'),'sequence');assert.equal($('guestTest').hidden,true);assert.equal($('guestProduct').value,'legacy-acid');assert.equal($('guestSubmit').hidden,true);assert.equal($('guestUseSuggested'),null);assert.match($('guestWaitCountdown').textContent,/20 min/);assert.equal(w.eval('appHasUnsavedWork()'),false);
  const ready=w.eval('guestFlow.ready_at'),rows=JSON.parse(w.eval('JSON.stringify(activeEvents())')),products=JSON.parse(w.eval('JSON.stringify(guestContext.products)')),settings=JSON.parse(w.eval('JSON.stringify(config)')),user='practice-guest';
  const plan=(events=rows,ps=products,now=ready)=>w.guestCombinedAcidPlan(events,ps,settings,user,now),base=plan(),dose=rows.find(e=>e.id===base.bleach_id);
  assert.equal(plan(rows,products,ready-1).status,'wait');assert.equal(base.status,'dose');assert.ok(base.estimated_fc_upper<=10);assert.equal(base.sample_id,w.eval('guestFlow.sample_id'));assert.equal(plan(rows,products,ready+3*3600000),null);
  assert.equal(plan(rows.filter(e=>e.id!==base.sample_id)),null,'Removed test invalidates sequence');
  const source=rows.find(e=>e.id===base.sample_id),doseAt=w.eval('modelTime('+JSON.stringify(dose)+')'),at=ms=>({timestamp:new Date(ms).toISOString(),timestamp_instant:new Date(ms).toISOString(),time_zone:'America/Denver',created_at:new Date(ms).toISOString()});
  const separate=rows.map(e=>e.id===source.id?{...e,...at(doseAt-2*60000)}:e);separate.push({...source,id:'separate-fc',ph:undefined,ta_ppm:undefined,...at(doseAt-60000)});
  assert.equal(plan(separate)?.status,'dose','Separate usable FC and pH records also support the combined workflow');assert.equal(plan(separate).sample_id,source.id);
  for(const type of ['soak','chemistry','chemical_addition','water_top_off','water_change']){
   const later={id:'intervening-'+type,type,time_zone:'America/Denver',timestamp:new Date(ready-1000).toISOString(),timestamp_instant:new Date(ready-1000).toISOString()};assert.equal(plan([...rows,later]),null,type+' invalidates queued acid');
  }
  const high=rows.map(e=>e.id===dose.id?{...e,amount:.75}:e);assert.equal(plan(high).status,'check');assert.match(plan(high).message,/FC above 10/);
  assert.equal(plan([...rows,{id:'unknown-time',type:'soak',timestamp:dose.timestamp.slice(0,10),date_precision:'date_only'}]),null,'Unknown-time activity that day cannot be silently ignored');
  const changed=rows.map(e=>e.id===dose.id?{...e,product_revision:999}:e);assert.match(plan(changed).message,/product information changed/);
  assert.equal(plan(rows,products.map(p=>p.profile.family==='bisulfate'?{...p,max_single_mL:.1}:p)),null,'Current invitation limit is rechecked');
  // Expiry does not unlock an old snapshot. A successful context refresh is required.
  w.Date.now=()=>ready;w.refreshGuestDoseAdvice();assert.equal($('guestUseSuggested'),null);assert.match($('guestDoseAdvice').textContent,/Checking the latest/);
  const goodFetch=w.fetch;let disconnected=true;w.fetch=(path,options)=>path==='/api/guest/context'&&disconnected?Promise.resolve(new Response(JSON.stringify({error:'Connection interrupted'}),{status:503})):goodFetch(path,options);
  await w.guestSequenceTick();await tick();assert.equal($('guestForm').hidden,true);assert.equal($('guestReconnect').hidden,false);assert.match($('guestStatus').textContent,/Bleach is already saved/);
  disconnected=false;$('guestReconnect').click();await tick();await tick();assert.ok($('guestUseSuggested'));assert.equal($('guestReconnect').hidden,true);assert.equal(count('chemical_addition'),1,'Reconnect does not repeat bleach');
  assert.equal($('guestTest').hidden,true);assert.match($('guestFlowTitle').textContent,/pH Down/);assert.equal(count('chemistry'),1,'No intervening test needed or fabricated');
  // Reconstruct from synced events, not a countdown restarted on reconnect.
  w.eval("guestFlow={phase:'test',sample_id:null}");await w.connectGuest();assert.equal(w.eval('guestFlow.phase'),'sequence');assert.equal(w.eval('guestFlow.ready_at'),ready);assert.ok($('guestUseSuggested'));
  $('guestUseSuggested').click();assert.equal($('guestUnit').value,'tbsp');const staged=$('guestAmount').value;$('guestActualDetails').open=true;$('guestAmount').value='';$('guestAmount').dispatchEvent(new w.Event('input',{bubbles:true}));assert.equal($('guestActualDetails').hidden,false);assert.equal($('guestActualDetails').open,true);assert.equal($('guestAmount').hidden,false);assert.equal($('guestSubmit').hidden,false);assert.equal($('guestForm').checkValidity(),false);$('guestAmount').value=staged;$('guestAmount').dispatchEvent(new w.Event('input',{bubbles:true}));submit();await tick();assert.equal(count('chemical_addition'),1,'Acid still needs actual-addition confirmation');$('guestConfirmAdded').checked=true;submit();submit();await tick();await tick();assert.equal(count('chemical_addition'),2);assert.equal(count('chemistry'),1);assert.equal(w.eval('guestFlow.phase'),'after-dose');assert.equal($('guestTest').hidden,false);assert.equal($('guestSubmit').textContent,'Save retest');assert.equal($('guestUseSuggested'),null);assert.equal(w.eval('guestCombinedAcidPlan(activeEvents(),guestContext.products,config,session.user_id)'),null,'Never repeat queued acid');
  assert.equal(network,0);assert.deepEqual(errors,[]);
  console.log('PASS: one test → bleach → 20-minute wait → refreshed acid prompt → final test, exact timer boundary, resume, no duplicate saves, intervention/product/FC/limit/expiry guards and no invented readings');
 }finally{w.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
