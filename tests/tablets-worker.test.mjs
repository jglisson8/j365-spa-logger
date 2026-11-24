import assert from 'node:assert/strict';
import {default as worker,guestPublicEvent,guestConstruct,seal} from '../worker/j365-worker-v4.mjs';
const event={id:'trichlor-glb-20261112-1700',schema_version:2,type:'chemical_addition',timestamp:'2026-11-12T17:00:00-07:00',timestamp_instant:'2026-11-13T00:00:00.000Z',time_zone:'America/Denver',utc_offset_minutes:-420,fill_cycle_id:'fill-nov7',timestamp_approximate:true,product:'GLB 1-inch trichlor tablets',amount:4,unit:'tablets',tablet_dispenser:{schema_version:1,action:'start',method:'floating_dispenser',tablet_mass_g:null,purity_percent:99,available_chlorine_percent:90,bleach_ends_dispensing:true,private_detail:'SECRET'}};
const safe=guestPublicEvent(event);assert.equal(safe.tablet_dispenser.action,'start');assert.equal(safe.tablet_dispenser.available_chlorine_percent,90);assert.doesNotMatch(JSON.stringify(safe),/SECRET|private_detail/);
const stop={...event,id:'remove-tablet-fixture',type:'note',tablet_dispenser:{schema_version:1,session_id:event.id,action:'removed',dissolved_mass_g:20}};
assert.equal(guestPublicEvent(stop).tablet_dispenser.session_id,event.id);
assert.throws(()=>guestConstruct({...event,tablet_dispenser:{action:'start'}},{},[],{}),/Unsupported guest fields/,'Guests cannot submit tablet management metadata');
const env={SESSION_SECRET:'synthetic-tablet-owner-session-secret-123456'},owner=await seal({user:'jglisson8',token:'synthetic',csrf:'test-csrf',until:Date.now()+60000},env);
const document={schema_version:2,year_month:'2026-11',events:[{id:'prior-note-fixture',type:'note',timestamp:'2026-11-07T16:00'},event,stop]},original=globalThis.fetch;let saved;
globalThis.fetch=async(url,opts={})=>{
 assert.match(String(url),/^https:\/\/api.github.com\/repos\/jglisson8\/j365-spa-data\/contents\/events\/2026\/2026-11.json$/);
 if(opts.method==='PUT'){saved=JSON.parse(Buffer.from(JSON.parse(opts.body).content,'base64'));return Response.json({content:{sha:'next-sha'}});}
 return Response.json({sha:'existing-sha',content:Buffer.from(JSON.stringify({schema_version:2,year_month:'2026-11',events:document.events.slice(0,1)})).toString('base64')});
};
try{
 const r=await worker.fetch(new Request('https://spa.test/api/events?month=2026-11',{method:'POST',headers:{Cookie:'__Host-j365='+owner,Origin:'https://spa.test','X-CSRF-Token':'test-csrf','Content-Type':'application/json'},body:JSON.stringify({sha:'existing-sha',document})}),env);
 assert.equal(r.status,200);assert.deepEqual(saved,document,'Existing Worker schema accepts tablet metadata without changing legacy records');
}finally{globalThis.fetch=original;}
console.log('PASS: schema-v2 owner sync, tablet/lifecycle metadata preservation, guest disclosure allowlist and unchanged guest write restrictions');
