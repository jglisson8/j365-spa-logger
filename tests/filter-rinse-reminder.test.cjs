const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8').replace('render();calculate();connect();','render();calculate();');
const now=Date.parse('2026-11-12T19:00:00-07:00');
const dom=new JSDOM(html,{url:'https://spa.test/',runScripts:'dangerously',beforeParse(w){
 const Real=w.Date;w.Date=class extends Real{constructor(...args){super(...(args.length?args:[now]))}static now(){return now;}};
 w.scrollTo=()=>{};
}});
const {window:w}=dom,run=s=>w.eval(s);
const event=(id,activity,filter_set,timestamp)=>({id,type:'maintenance',activity,filter_set,timestamp});
const rinse=event('poolpure-rinse','filter_rinse','A','2026-10-25T15:12');
const clean=event('poolpure-clean','filter_clean','A','2026-11-07T15:00');
const install=event('jacuzzi-install','filter_replace','B','2026-11-07T16:00');
try{
 w.rows=[rinse,clean,install];const original=JSON.stringify(w.rows);
 run('write(rows);render()');
 assert.match(w.document.getElementById('nextService').textContent,/Filter rinse \(Jacuzzi Filter\).*in 25 days/);
 assert.match(w.document.getElementById('maintenanceDue').textContent,/Filter rinse \(Jacuzzi Filter\): 2026-11-07 · due in 25 days/);
 assert.equal(run("serviceLast('filter_rinse',rows).id"),install.id);
 assert.equal(run("serviceLast('filter_clean',rows).id"),clean.id,'The separate deep-clean reminder is unchanged');
 assert.equal(JSON.stringify(w.rows),original);
 w.rows.push(event('inactive-clean','filter_clean','A','2026-11-10T12:00'),event('unknown-rinse','filter_rinse','Unknown','2026-11-11T12:00'),event('future-rinse','filter_rinse','B','2026-11-14T12:00'));
 assert.equal(run("serviceLast('filter_rinse',rows).id"),install.id);
 w.rows.push(event('installed-clean','filter_clean','B','2026-11-12T12:00'));
 assert.equal(run("serviceLast('filter_rinse',rows).id"),'installed-clean');
 w.rows.push(event('installed-rinse','filter_rinse','B','2026-11-12T13:00'));
 assert.equal(run("serviceLast('filter_rinse',rows).id"),'installed-rinse');
 w.rows.push(event('poolpure-reinstall','filter_swap','A','2026-11-12T14:00'));
 assert.equal(run("serviceLast('filter_rinse',rows).id"),'poolpure-reinstall');
 assert.equal(run("serviceLast('filter_rinse',rows.slice(0,2)).id"),rinse.id,'Old histories without installation still have a reminder');
 w.rows.push(event('unknown-install','filter_swap','Unknown','2026-11-12T15:00'));
 assert.equal(run("serviceLast('filter_rinse',rows).id"),'unknown-install','Do not assign older rinse to an unidentified installation');
}finally{dom.window.close();}
console.log('PASS: installed-set rinse reminder, legacy fallback, off-tub service exclusion and home/maintenance parity');
