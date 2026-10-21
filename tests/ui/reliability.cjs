process.env.TZ='America/New_York';
const {JSDOM}=require('jsdom'),fs=require('node:fs'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../../index.html'),'utf8').replace('render();calculate();connect();','render();calculate();');
const now=Date.parse('2026-11-02T15:00:00Z'),alerts=[];let answer=null;
const dom=new JSDOM(html,{url:'https://spa.test/',runScripts:'dangerously',beforeParse(w){const D=w.Date;w.Date=class extends D{constructor(...a){super(...(a.length?a:[now]))}static now(){return now}};w.scrollTo=()=>{};w.alert=m=>alerts.push(m);w.prompt=()=>answer;w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false}}}),w=dom.window,d=w.document,$=id=>d.getElementById(id),run=s=>w.eval(s);
(async()=>{
 const form=$('chemistryForm'),date=form.querySelector('.date'),time=form.querySelector('.time');
 assert.equal(date.value,'2026-11-02');assert.equal(time.value,'08:00','Traveling device still defaults to spa Mountain time');
 const submit=(day,clock)=>{date.value=day;time.value=clock;$('fc').value='3';form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}))};
 submit('2026-03-08','02:30');assert.equal(run('read().length'),0);assert.match(alerts.at(-1),/does not exist/);
 submit('2026-11-01','01:30');assert.equal(run('read().length'),0);assert.match(alerts.at(-1),/explicit occurrence/);
 answer='2';submit('2026-11-01','01:30');const event=run('read()[0]');assert.equal(event.timestamp,'2026-11-01T01:30');assert.equal(event.timestamp_instant,'2026-11-01T08:30:00.000Z');assert.equal(event.utc_offset_minutes,-420);assert.equal(event.created_at,'2026-11-02T15:00:00.000Z');assert.equal(event.time_zone,'America/Denver');
 // Conflicts are visible and resolvable from the real rendered controls.
 run('config={schema_version:2,current_fill_cycle_id:"old"};configBaseline=configClone(config);stageConfigField("current_fill_cycle_id","local");guardError=null');
 try{run('guardConfigField("general","current_fill_cycle_id",["current_fill_cycle_id"],generalPatch.current_fill_cycle_id.base,"local",{current_fill_cycle_id:"remote"})')}catch{}
 assert.equal($('configConflictShortcut').hidden,false);assert.match($('configConflictList').textContent,/pending value: local/);assert.match($('configConflictList').textContent,/other device: remote/);assert.equal($('configConflictPanel').open,true);
 $('configConflictList').querySelector('[data-conflict-choice="remote"]').click();assert.equal(run('config.current_fill_cycle_id'),'remote');assert.equal(run('configPending'),false);assert.equal($('configConflictShortcut').hidden,true);assert.equal(run('read().length'),1);
 dom.window.close();console.log('PASS: offline traveling-device entry, DST rejection/explicit fold, UTC creation and usable conflict-resolution UI');
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1});
