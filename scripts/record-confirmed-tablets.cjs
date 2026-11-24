// Narrow, idempotent historical import. Dry-run unless --write is explicit.
const fs=require('node:fs'),vm=require('node:vm'),{execFileSync}=require('node:child_process'),path=require('node:path');
const root=path.join(__dirname,'..'),repo='jglisson8/j365-spa-data',file='events/2026/2026-11.json';
const gh=(args,options={})=>JSON.parse(execFileSync('gh',['api',...args],{encoding:'utf8',...options}));
const remote=gh(['repos/'+repo+'/contents/'+file]);
const original=JSON.parse(Buffer.from(remote.content.replace(/\s/g,''),'base64').toString('utf8'));
if(original.schema_version!==2||(original.year_month??original.month)!=='2026-11'||!Array.isArray(original.events))throw Error('Unexpected monthly document');
const existing=original.events.filter(e=>e.id==='trichlor-glb-20261112-1700'||/trichlor|tablet/i.test(e.product??'')&&e.timestamp?.startsWith('2026-11-12'));
if(existing.length){console.log('Tablet record already exists; no write performed.');process.exit(0);}
const boundary=original.events.filter(e=>e.type==='water_change'&&e.full&&e.timestamp?.startsWith('2026-11-07')).at(-1);
if(!boundary?.new_fill_cycle_id||boundary.gallons!==395)throw Error('Confirm the November 7 395-gallon fill before importing');
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
const event=vm.runInNewContext(fs.readFileSync(path.join(root,'src/tablets.js'),'utf8')+';confirmedTabletEvent(fill,createdAt)',{APP_VERSION:version,Date,fill:boundary.new_fill_cycle_id,createdAt:new Date().toISOString()});
if(Date.parse(event.timestamp)!==Date.parse('2026-11-13T00:00:00Z')||event.amount!==4||event.unit!=='tablets')throw Error('Unexpected import event');
const next={...original,events:[...original.events,event]};
if(JSON.stringify(next.events.slice(0,-1))!==JSON.stringify(original.events))throw Error('Existing records would change');
console.log(JSON.stringify({mode:process.argv.includes('--write')?'write':'dry run',path:file,event_id:event.id,timestamp:event.timestamp,fill_cycle_id:event.fill_cycle_id,quantity:4,unit:'tablets',prior_records_unchanged:original.events.length}));
if(process.argv.includes('--write')){
 const payload={message:'Record confirmed November 12 GLB tablet dispenser load',sha:remote.sha,content:Buffer.from(JSON.stringify(next,null,2)+'\n').toString('base64')};
 const result=gh(['--method','PUT','repos/'+repo+'/contents/'+file,'--input','-'],{input:JSON.stringify(payload)});
 const verify=gh(['repos/'+repo+'/contents/'+file]);
 const saved=JSON.parse(Buffer.from(verify.content.replace(/\s/g,''),'base64').toString('utf8'));
 if(!saved.events.some(e=>e.id===event.id)||JSON.stringify(saved.events.filter(e=>e.id!==event.id))!==JSON.stringify(original.events))throw Error('Post-write verification failed');
 console.log(JSON.stringify({verified:true,commit:result.commit.sha,added_records:1,modified_existing_records:0}));
}
