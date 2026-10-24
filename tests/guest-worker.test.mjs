import assert from 'node:assert/strict';
import {createPrivateKey} from 'node:crypto';
import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['scripts/build-guest-worker.cjs','--check']);
const {default:worker,guestPolicy,guestConstruct,guestPublicEvent,guestStrip,guestPkcs8,seal}=await import('../worker/j365-worker-v3.9.mjs');
const now=Date.now(),hours=3600000,profile={schema_version:1,id:'bleach-test',revision:1,name:'Test bleach',family:'hypochlorite',form:'liquid',concentration:{basis:'active_mass_percent',value:7.5}};
const grant={id:'grant-123456',user_id:17,login:'TestGuest',starts_at:new Date(now-24*hours).toISOString(),ends_at:new Date(now+24*hours).toISOString(),revoked:false,instructions:'Use strips',products:[{profile,max_single_mL:100,max_daily_mL:150}]};
const identity={user:'TestGuest',user_id:17,grant_id:grant.id,grant},config={schema_version:2,spa:{model:'Jacuzzi J-365',volume_gallons:395},current_fill_cycle_id:'fill1'};
const ts=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Denver',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now-60000).replace(' ','T');
const base={id:'guest-test-123456789',timestamp:ts,timestamp_instant:new Date(now-60000).toISOString()};
assert.equal(guestPolicy({schema_version:1,grants:[grant]}).grants[0].user_id,17);
assert.throws(()=>guestPolicy({schema_version:1,grants:[{...grant,ends_at:grant.starts_at}]}));
assert.throws(()=>guestPolicy({schema_version:1,grants:[{...grant,products:[{...grant.products[0],max_single_mL:0}]}]}));
const sample=guestConstruct({...base,type:'chemistry',readings:{fc_ppm:'3',ph:'7.6'}},identity,[],config);
assert.equal(sample.measurement_method,'test_strip');assert.equal(sample.fc_ppm,3);assert.equal(sample.guest_actor.user_id,17);assert.equal(sample.fill_cycle_id,'fill1');assert.equal(guestStrip('ph','8.4').censored,true);
for(const changes of [{fc_ppm:99},{historical:{status:'assumed_added'}},{product_profile:profile},{guest_actor:{user_id:1}},{type:'maintenance'},{timestamp:'2026-01-01T12:00'},{readings:{ph:'7.3'}}])assert.throws(()=>guestConstruct({...base,type:'chemistry',readings:{ph:'7.6'},...changes},identity,[],config));
const dose=guestConstruct({...base,type:'chemical_addition',product_id:profile.id,amount:6,unit:'tsp'},identity,[],config);assert.equal(dose.amount,6);assert.equal(dose.unit,'tsp');assert.deepEqual(dose.product_profile,profile);
assert.throws(()=>guestConstruct({...base,type:'chemical_addition',product_id:profile.id,amount:1,unit:'cup'},identity,[],config),/single-dose/);
assert.throws(()=>guestConstruct({...base,type:'chemical_addition',product_id:profile.id,amount:90,unit:'mL'},identity,[{...dose,amount:90,unit:'mL'}],config),/24-hour/);
assert.throws(()=>guestConstruct({...base,id:'correct-123456789',type:'chemistry',readings:{ph:'7.6'},supersedes_event_id:'owner-event'},identity,[{id:'owner-event',type:'chemistry'}],config),/own active/);
const correction=guestConstruct({...base,id:'correct-123456789',type:'chemistry',readings:{ph:'7.8'},supersedes_event_id:sample.id},identity,[sample],config);assert.equal(correction.supersedes_event_id,sample.id);
const removal=guestConstruct({...base,id:'remove-1234567890',type:'remove',supersedes_event_id:sample.id},identity,[sample],config);assert.equal(removal.record_removal,true);
const redacted=guestPublicEvent({...sample,notes:'PRIVATE',cost:900,forecast_review:{secret:'PRIVATE'},removed_record:{notes:'PRIVATE'},migration:{notes:'PRIVATE'}});assert.doesNotMatch(JSON.stringify(redacted),/PRIVATE|cost|guest_submission/);
const env={SESSION_SECRET:'synthetic-session-secret-with-at-least-32-chars'};
let response=await worker.fetch(new Request('https://spa.test/api/guest/context'),env);assert.equal(response.status,401);
const cookie=await seal({role:'guest',user:'TestGuest',user_id:17,grant_id:grant.id,token:'synthetic-user-token',csrf:'csrf',until:now+hours},env),headers={Cookie:'__Host-j365='+cookie};
for(const path of ['/api/config','/api/events?month=2026-10','/api/log','/api/months','/api/guests']){response=await worker.fetch(new Request('https://spa.test'+path,{headers}),env);assert.equal(response.status,401,path);}
response=await worker.fetch(new Request('https://spa.test/api/me',{headers}),env);assert.equal(response.status,403); // Disabled by default, even with a valid cookie.
// Real WebCrypto JWT generation, fake GitHub: no credentials or private data.
const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
env.GITHUB_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----\n'+Buffer.from(await crypto.subtle.exportKey('pkcs8',keys.privateKey)).toString('base64')+'\n-----END PRIVATE KEY-----';env.GITHUB_APP_ID='123';env.GITHUB_INSTALLATION_ID='456';env.GUEST_ACCESS_ENABLED='true';
const pkcs1=createPrivateKey(env.GITHUB_PRIVATE_KEY).export({format:'pem',type:'pkcs1'});assert.deepEqual(Buffer.from(guestPkcs8(pkcs1)),Buffer.from(await crypto.subtle.exportKey('pkcs8',keys.privateKey)));
for(const wrapped of [JSON.stringify(pkcs1),pkcs1.replaceAll('\n','\\n'),Buffer.from(pkcs1).toString('base64')])assert.deepEqual(Buffer.from(guestPkcs8(wrapped)),Buffer.from(guestPkcs8(pkcs1)));
for(const invalid of ['not a key','"broken json','-----BEGIN RSA PRIVATE KEY-----\n?bad?\n-----END RSA PRIVATE KEY-----'])assert.throws(()=>guestPkcs8(invalid),e=>e.status===503&&!e.message.includes('?bad?'));
let policy={schema_version:1,grants:[grant]},calls=[],documents=new Map(),head=1,conflictOnce=false,postedTree=null,commitDocument=null;
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
globalThis.fetch=async(url,options={})=>{const u=new URL(url),p=u.pathname;calls.push([p,options.method||'GET']);
 if(p.endsWith('/access_tokens')){const body=JSON.parse(options.body);assert.deepEqual(body,{repositories:['j365-spa-data'],permissions:{contents:'write'}});const jwt=options.headers.Authorization.slice(7).split('.');assert.equal(JSON.parse(Buffer.from(jwt[0],'base64url')).alg,'RS256');assert.ok(await crypto.subtle.verify('RSASSA-PKCS1-v1_5',keys.publicKey,Buffer.from(jwt[2],'base64url'),new TextEncoder().encode(jwt[0]+'.'+jwt[1])));return json({token:'installation-token',expires_at:new Date(now+hours).toISOString()});}
 if(p.endsWith('/contents/guest-access.json'))return json({sha:'policy-sha',content:Buffer.from(JSON.stringify(policy)).toString('base64')});
 if(p.endsWith('/contents/config.json'))return json({sha:'config-sha',content:Buffer.from(JSON.stringify(config)).toString('base64')});
 const match=p.match(/\/contents\/(events\/.*\.json)$/);if(match){const doc=documents.get(match[1]);return doc?json({sha:'file-sha',content:Buffer.from(JSON.stringify(doc)).toString('base64')}):json({message:'Not found'},404);}
 if(p.endsWith('/git/ref/heads/main'))return json({object:{sha:'head'+head}});
 if(/\/git\/commits\/head\d+$/.test(p))return json({tree:{sha:'tree'+head}});
 if(/\/git\/trees\/[^/]+$/.test(p))return json({tree:[...documents.keys()].map(path=>({path,type:'blob'})),truncated:false});
 if(p.endsWith('/git/trees')){postedTree=JSON.parse(options.body);return json({sha:'new-tree'});}
 if(p.endsWith('/git/commits')){commitDocument=postedTree;return json({sha:'new-commit'});}
 if(p.endsWith('/git/refs/heads/main')){assert.equal(JSON.parse(options.body).force,false);if(conflictOnce){conflictOnce=false;head++;return json({message:'Not fast forward'},422);}for(const entry of commitDocument.tree)documents.set(entry.path,JSON.parse(entry.content));head++;return json({ok:true});}
 throw Error('Unexpected GitHub request '+p);
};
response=await worker.fetch(new Request('https://spa.test/api/me',{headers}),env);assert.equal(response.status,200);assert.equal((await response.json()).role,'guest');
const input={...base,type:'chemistry',readings:{ph:'7.6'}},post=()=>new Request('https://spa.test/api/guest/entries',{method:'POST',headers:{...headers,Origin:'https://spa.test','Content-Type':'application/json','X-CSRF-Token':'csrf'},body:JSON.stringify({event:input})});
response=await worker.fetch(new Request('https://spa.test/api/guest/entries',{method:'POST',headers}),env);assert.equal(response.status,403);
conflictOnce=true;response=await worker.fetch(post(),env);assert.equal(response.status,200,await response.clone().text());assert.equal([...documents.values()][0].events.length,1);
response=await worker.fetch(post(),env);assert.equal(response.status,200);assert.equal((await response.json()).replayed,true);assert.equal([...documents.values()][0].events.length,1);
response=await worker.fetch(new Request('https://spa.test/api/guest/context',{headers}),env);assert.equal(response.status,200);assert.equal((await response.json()).events[0].measurement_method,'test_strip');
const ownerCookie=await seal({user:'jglisson8',token:'synthetic-owner-token',csrf:'owner-csrf',until:now+hours},env);
response=await worker.fetch(new Request('https://spa.test/api/guests',{headers:{Cookie:'__Host-j365='+ownerCookie}}),env);assert.equal(response.status,200);assert.equal((await response.json()).policy.grants[0].user_id,17);
env.GUEST_ACCESS_ENABLED='false';response=await worker.fetch(new Request('https://spa.test/api/guests/check',{headers:{Cookie:'__Host-j365='+ownerCookie}}),env);assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true,repository:'j365-spa-data',backend_enabled:false});env.GUEST_ACCESS_ENABLED='true';
const invalidCsrf=new Request('https://spa.test/api/guest/entries',{method:'POST',headers:{...headers,Origin:'https://spa.test','Content-Type':'application/json','X-CSRF-Token':'wrong'},body:JSON.stringify({event:input})});response=await worker.fetch(invalidCsrf,env);assert.equal(response.status,403);
const crossOrigin=new Request('https://spa.test/api/guest/entries',{method:'POST',headers:{...headers,Origin:'https://evil.test','Content-Type':'application/json','X-CSRF-Token':'csrf'},body:JSON.stringify({event:input})});response=await worker.fetch(crossOrigin,env);assert.equal(response.status,403);
const oldMonth='2020-01',collisionId='collision-123456789';documents.set('events/2020/2020-01.json',{schema_version:2,year_month:oldMonth,events:[{id:collisionId,type:'note',timestamp:'2020-01-01T12:00',notes:'PRIVATE OWNER NOTE'}]});
const collision=new Request('https://spa.test/api/guest/entries',{method:'POST',headers:{...headers,Origin:'https://spa.test','Content-Type':'application/json','X-CSRF-Token':'csrf'},body:JSON.stringify({event:{...input,id:collisionId}})});response=await worker.fetch(collision,env);assert.equal(response.status,409);documents.delete('events/2020/2020-01.json');
policy={schema_version:1,grants:[{...grant,ends_at:new Date(now-1000).toISOString()}]};response=await worker.fetch(new Request('https://spa.test/api/me',{headers}),env);assert.equal(response.status,403);
policy={schema_version:1,grants:[{...grant,starts_at:new Date(now+1000).toISOString()}]};response=await worker.fetch(new Request('https://spa.test/api/me',{headers}),env);assert.equal(response.status,403);
policy={schema_version:1,grants:[{...grant,revoked:true}]};response=await worker.fetch(new Request('https://spa.test/api/me',{headers}),env);assert.equal(response.status,403);response=await worker.fetch(post(),env);assert.equal(response.status,403);
console.log('PASS: guest allowlist, expiry, role isolation, strict strip/addition validation, own-only corrections/removal, redaction, scoped JWT, CSRF, conflict retry, idempotency and immediate revocation');
