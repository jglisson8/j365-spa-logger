const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8').replace('render();calculate();connect();','render();calculate();');
let now=Date.parse('2026-11-09T20:00:10Z'),saved={},alerts=[];
function open(){
 const dom=new JSDOM(html,{url:'https://spa.test/',runScripts:'dangerously',beforeParse(w){
  const Real=w.Date;w.Date=class extends Real{constructor(...a){super(...(a.length?a:[now]))}static now(){return now}};
  for(const [k,v] of Object.entries(saved))w.localStorage.setItem(k,v);
  w.alert=m=>alerts.push(m);w.confirm=()=>true;w.scrollTo=()=>{};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 }});
 const w=dom.window,$=id=>w.document.getElementById(id),run=s=>w.eval(s),change=e=>e.dispatchEvent(new w.Event('change',{bubbles:true})),submit=e=>e.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 return {dom,w,$,run,change,submit};
}
async function main(){
 let app=open();
 try{
  let {$,run,change,submit}=app;
  $('maintenanceActivity').value='water_change_full';change($('maintenanceActivity'));
  const next=$('fillWizard').querySelector('.wizard-actions button:last-child');
  next.click();next.click();
  $('fillFc').value='0';$('fillPh').value='7.3';$('fillTa').value='210';$('fillCh').value='175';$('fillTemp').value='100';
  $('fillWizard').querySelector('[data-fill-check="Circulation"]').checked=true;
  submit($('maintenanceForm'));await Promise.resolve();
  assert.equal(run('read().filter(e=>e.type==="water_change").length'),1);
  assert.equal(run('read().filter(e=>e.type==="chemistry").length'),1);
  assert.equal(run('read().find(e=>e.type==="chemistry").temperature_f'),100);
  assert.equal(run('read().find(e=>e.type==="water_change").startup_checks[0]'),'Circulation');
  assert.equal($('refillStartup').open,true);assert.match($('refillTasks').textContent,/No|no calcium addition/);
  $('refillTasks').querySelector('[data-startup-go="aerate"]').click();assert.equal($('bathers').value,'0');
  $('intendedAeration').value='20';$('startAeration').click();$('startAeration').click();
  assert.equal(run('read().filter(aerationSessionStart).length'),1);
  const started=run('read().find(aerationSessionStart)');assert.equal(started.timestamp_instant,new Date(now).toISOString());
  assert.equal(started.aeration_session.intended_minutes,20);assert.equal(started.aeration_session.aerating_seats,4);assert.equal(started.exposure,undefined);
  assert.equal($('stopAeration').hidden,false);
  run('setTab("chemistry")');$('nextActions').querySelector('[data-action-focus="aeration"]').click();
  assert.equal($('tab-soak').hidden,false);assert.equal(app.w.document.activeElement,$('stopAeration'));
  saved={...app.w.localStorage};app.dom.window.close();now+=6.5*60000;app=open();({$,run,change,submit}=app);
  assert.match($('aerationActive').textContent,/6:30.*20 min planned/);assert.equal($('stopAeration').hidden,false);
  assert.equal(run('elapsedAerationView(activeEvents(),Date.now()).find(isExposure).exposure.duration_minutes'),6.5);
  assert.equal(run('aerationMetrics(elapsedAerationView(activeEvents(),Date.now()).find(isExposure)).seatMinutes'),26);
  $('stopAeration').click();$('stopAeration').click();
  assert.equal(run('activeEvents().filter(aerationSessionStart).length'),0);
  const completed=run('activeEvents().filter(isExposure)');assert.equal(completed.length,1);
  assert.equal(completed[0].aeration_session_id,started.id);assert.equal(completed[0].exposure.duration_minutes,6.5);
  assert.equal(completed[0].exposure.ended_at_instant,new Date(now).toISOString());assert.equal($('stopAeration').hidden,true);
  const stored=run('read().find(aerationSessionStart)');assert.equal(JSON.stringify(stored),JSON.stringify(started));
  // A concurrent stop after sync may add another immutable audit record, but
  // must never count its exposure a second time.
  app.w.replay={...completed[0],id:'duplicate-finish-fixture',created_at:new Date(now+1000).toISOString()};
  run('write([...read(),replay]);render()');assert.equal(run('activeEvents().filter(isExposure).length'),1);
  const id=run('activeEvents().find(isExposure).id');app.w.document.querySelector('[data-edit="'+id+'"]').click();
  $('editAerationMinutes').value='5';$('editReason').value='Correct actual finish';submit($('editRecordForm'));
  assert.equal(run('activeEvents().find(isExposure).exposure.duration_minutes'),5);
  assert.equal(run('activeEvents().filter(isExposure).length'),1);
  assert.deepEqual(alerts,[]);
 }finally{app.dom.window.close();}
}
main().then(()=>console.log('PASS: real wizard startup, immediate aeration persistence, reload, elapsed-only exposure, early finish, duplicate prevention and correction')).catch(e=>{console.error(e);process.exitCode=1;});
