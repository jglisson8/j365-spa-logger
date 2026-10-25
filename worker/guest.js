// Guest authorization is additive. Existing owner APIs keep requireSession().
// No browser-supplied roles, product profiles, fill IDs or model results are trusted.
const GUEST_ACCESS_FILE = 'guest-access.json';
const GUEST_BLOCKS = {fc_ppm:[.5,1,3,5,10,20],ph:[6.2,6.8,7.2,7.6,7.8,8.4],ta_ppm:[0,40,80,120,180,240]};
const GUEST_UNITS = {mL:1,'fl oz':29.57352,tsp:4.92892,tbsp:14.78676,cup:236.58816};
let guestInstallationCache = null;
function guestFail(message,status=400){throw Object.assign(Error(message),{status});}
function guestKeys(value,allowed){if(!isObject(value)||Object.keys(value).some(k=>!allowed.includes(k)))guestFail('Unsupported guest fields');}
function guestStable(value){return JSON.stringify(value,(_,v)=>isObject(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);}
function guestEpoch(value){return typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{3})?)?Z$/.test(value)&&Number.isFinite(Date.parse(value))?Date.parse(value):NaN;}
function guestPolicy(value){
  guestKeys(value,['schema_version','grants']);
  if(value.schema_version!==1||!Array.isArray(value.grants)||value.grants.length>20)guestFail('Invalid guest access list');
  const ids=new Set();
  for(const g of value.grants){
    guestKeys(g,['id','user_id','login','auth_type','label','invite_hash','code_hash','code_sealed','single_device','device_hash','activated_at','starts_at','ends_at','revoked','products','instructions']);
    if(g.code_sealed!==undefined&&(g.auth_type!=='invite'||!g.single_device||typeof g.code_sealed!=='string'||g.code_sealed.length>1000||!/^[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{40,}$/.test(g.code_sealed)))guestFail('Invalid saved access code');
    if(!/^[-a-zA-Z0-9_]{8,100}$/.test(g.id)||ids.has(g.id))guestFail('Invalid guest identity');ids.add(g.id);
    if(g.auth_type==='invite'){
      if(typeof g.label!=='string'||!g.label.trim()||g.label.length>100||!/^[A-Za-z0-9_-]{43}$/.test(g.invite_hash)||g.user_id!=null||g.login!=null)guestFail('Invalid invitation identity');
      if(g.single_device!==undefined&&(g.single_device!==true||!/^[A-Za-z0-9_-]{43}$/.test(g.code_hash)||!(g.device_hash===null||/^[A-Za-z0-9_-]{43}$/.test(g.device_hash))||!(g.activated_at===null||Number.isFinite(guestEpoch(g.activated_at)))||!!g.device_hash!==!!g.activated_at))guestFail('Invalid browser activation');
      if(!g.single_device&&(g.code_hash!==undefined||g.device_hash!==undefined||g.activated_at!==undefined))guestFail('Invalid browser activation');
    }else if(g.auth_type!=null||!Number.isSafeInteger(g.user_id)||g.user_id<=0||typeof g.login!=='string'||!/^[-a-zA-Z0-9]{1,39}$/.test(g.login))guestFail('Invalid guest identity');
    const start=guestEpoch(g.starts_at),end=guestEpoch(g.ends_at);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>90*86400000||typeof g.revoked!=='boolean')guestFail('Choose a guest access window of at most 90 days');
    if(typeof g.instructions!=='string'||g.instructions.length>2000||!Array.isArray(g.products)||g.products.length>2)guestFail('Invalid guest instructions');
    const productIds=new Set();for(const p of g.products){
      guestKeys(p,['profile','max_single_mL','max_daily_mL']);const f=p.profile;
      if(!isObject(f)||!['hypochlorite','bisulfate'].includes(f.family)||typeof f.id!=='string'||!Number.isInteger(f.revision)||!f.name||productIds.has(f.id))guestFail('Only approved bleach or dry acid is supported');productIds.add(f.id);
      const ceiling=f.family==='hypochlorite'?250:100;
      if(!isFiniteNumber(p.max_single_mL,.1,ceiling)||!isFiniteNumber(p.max_daily_mL,p.max_single_mL,ceiling*2))guestFail('Invalid guest dose limits');
    }
  }return value;
}
function guestPkcs8(pem){
  if(typeof pem!=='string')guestFail('GITHUB_PRIVATE_KEY must contain the GitHub App RSA PEM key',503);
  pem=pem.trim();
  if(pem.startsWith('"')){try{pem=JSON.parse(pem);}catch{guestFail('GITHUB_PRIVATE_KEY has invalid quoted PEM text',503);}if(typeof pem!=='string')guestFail('GITHUB_PRIVATE_KEY must be PEM text, not a JSON object',503);}
  pem=pem.replace(/\\r\\n|\\n|\\r/g,'\n').trim();
  // Accept an explicitly base64-encoded PEM, but not arbitrary unlabelled DER.
  if(!pem.startsWith('-----BEGIN ')&&/^[A-Za-z0-9+/=\s]+$/.test(pem)){try{const decoded=atob(pem.replace(/\s/g,''));if(decoded.startsWith('-----BEGIN '))pem=decoded.trim();}catch{}}
  const match=pem.match(/^-----BEGIN (RSA PRIVATE KEY|PRIVATE KEY)-----\s*([A-Za-z0-9+/=\s]+)\s*-----END \1-----$/);
  if(!match)guestFail('GITHUB_PRIVATE_KEY is not a complete RSA PEM key. Re-enter the original GitHub App .pem file in Cloudflare; do not paste it into chat.',503);
  let der;try{der=Uint8Array.from(atob(match[2].replace(/\s/g,'')),c=>c.charCodeAt(0));}catch{guestFail('GITHUB_PRIVATE_KEY has invalid PEM base64 content',503);}
  if(match[1]==='PRIVATE KEY')return der;
  // GitHub downloads PKCS#1 RSA keys; WebCrypto imports PKCS#8. Wrap the same
  // key locally (version + rsaEncryption identifier + octet string), no rotation.
  const tlv=(tag,bytes)=>{const n=bytes.length,length=n<128?[n]:n<256?[129,n]:[130,n>>8,n&255];return new Uint8Array([tag,...length,...bytes]);};
  return tlv(48,new Uint8Array([2,1,0,48,13,6,9,42,134,72,134,247,13,1,1,1,5,0,...tlv(4,der)]));
}
async function guestInstallationToken(env,ownerCheck=false){
  if(env.GUEST_ACCESS_ENABLED!=='true'&&!ownerCheck)guestFail('Guest access is not enabled',403);
  if(!env.GITHUB_APP_ID||!env.GITHUB_INSTALLATION_ID||!env.GITHUB_PRIVATE_KEY)guestFail('Guest repository connection is not configured',503);
  const cacheKey=String(env.GITHUB_APP_ID)+':'+String(env.GITHUB_INSTALLATION_ID);
  if(guestInstallationCache?.key===cacheKey&&guestInstallationCache.until>Date.now()+60000)return guestInstallationCache.token;
  const der=guestPkcs8(env.GITHUB_PRIVATE_KEY);
  const key=await crypto.subtle.importKey('pkcs8',der,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const now=Math.floor(Date.now()/1000),part=v=>b64url(te.encode(JSON.stringify(v))),unsigned=part({alg:'RS256',typ:'JWT'})+'.'+part({iat:now-60,exp:now+540,iss:String(env.GITHUB_APP_ID)});
  const signature=b64url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,te.encode(unsigned))));
  const result=await github(`/app/installations/${encodeURIComponent(env.GITHUB_INSTALLATION_ID)}/access_tokens`,unsigned+'.'+signature,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({repositories:[REPO],permissions:{contents:'write'}})});
  if(typeof result.token!=='string'||!Number.isFinite(Date.parse(result.expires_at)))guestFail('GitHub App token unavailable',503);
  guestInstallationCache={key:cacheKey,token:result.token,until:Date.parse(result.expires_at)};return result.token;
}
async function guestGrant(identity,env){
  const invite=identity.auth_type==='invite';if(invite&&env.GUEST_ACCESS_ENABLED==='false')guestFail('Guest access is disabled',403);
  const token=await guestInstallationToken(env,invite),file=await readRepoJson(GUEST_ACCESS_FILE,token,true),policy=guestPolicy(file.value||{schema_version:1,grants:[]});
  const now=Date.now(),grant=policy.grants.find(g=>g.id===identity.grant_id&&(invite?g.auth_type==='invite'&&g.invite_hash===identity.invite_revision&&identity.user_id==='invite:'+g.id:g.auth_type!=='invite'&&g.user_id===identity.user_id)&&!g.revoked&&guestEpoch(g.starts_at)<=now&&now<guestEpoch(g.ends_at));
  if(!grant)guestFail('Guest access is inactive, expired or revoked',403);
  if(grant.single_device&&(!identity.device_hash||identity.device_hash!==grant.device_hash))guestFail('This invitation is activated in another browser. Ask the owner to reset access.',403);
  return {grant,token};
}
async function guestIdentity(req,env){
  let s;try{s=await unseal(getCookie(req,'__Host-j365-guest')||getCookie(req,'__Host-j365'),env);}catch{guestFail('Open your guest invitation link',401);}
  if(s.role!=='guest'||!(s.auth_type==='invite'?typeof s.user_id==='string'&&s.user_id==='invite:'+s.grant_id:!!s.token&&Number.isSafeInteger(s.user_id))||!Number.isFinite(s.until)||s.until<=Date.now())guestFail('Open your guest invitation link',401);
  if(s.auth_type==='invite')s.device_hash=await guestInviteDigest(getCookie(req,'__Host-j365-device'));
  const access=await guestGrant(s,env);return {...s,...access,user:access.grant.label??s.user};
}
const guestCookie=(value,age)=>`__Host-j365-guest=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
async function guestInviteDigest(secret){return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256',te.encode(secret))));}
function guestSafeGrant(g){return g.auth_type==='invite'?Object.fromEntries(Object.entries(g).filter(([k])=>!['invite_hash','code_hash','code_sealed','device_hash'].includes(k))):g;}
async function guestInvitationRoutes(req,env,url){
  if(url.pathname==='/api/guests/code'&&req.method==='POST'){
    const owner=await requireSession(req,env);requireWriteAuth(req,url,owner);
    const body=await parseJsonBody(req,1000);guestKeys(body,['id']);
    const file=await readRepoJson(GUEST_ACCESS_FILE,owner.token,true),grant=guestPolicy(file.value||{schema_version:1,grants:[]}).grants.find(g=>g.id===body.id&&g.auth_type==='invite'&&!g.revoked&&guestEpoch(g.ends_at)>Date.now());
    if(!grant)guestFail('Invitation is expired, revoked or unavailable',404);
    if(!grant.code_sealed)guestFail('This older code was not saved. Use Reset browser to generate a retrievable code.',409);
    let saved;try{saved=await unseal(grant.code_sealed,env);}catch{guestFail('Saved code cannot be decrypted. Use Reset browser to generate a new code.',409);}
    if(saved.purpose!=='guest-access-code'||saved.grant_id!==grant.id||typeof saved.code!=='string'||await guestInviteDigest(saved.code)!==grant.code_hash)guestFail('Saved code does not match this invitation. Use Reset browser.',409);
    return json({access_code:saved.code});
  }
  if(url.pathname==='/guest/logout'&&req.method==='GET')return redirect('/guest',guestCookie('',0));
  // Establish the browser cookie BEFORE consuming an invitation. A lost redeem
  // response can then be retried in the same browser without locking it out.
  if(url.pathname==='/api/guest/prepare'&&req.method==='POST'){
    if(req.headers.get('Origin')!==url.origin)guestFail('Invalid origin',403);
    const existing=getCookie(req,'__Host-j365-device'),device=/^[A-Za-z0-9_-]{43}$/.test(existing)?existing:random(32);
    return json({ok:true},200,{'Set-Cookie':`__Host-j365-device=${device}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=7776000`});
  }
  if(['/api/guests/invitations','/api/guests/reset'].includes(url.pathname)&&req.method==='POST'){
    const owner=await requireSession(req,env);requireWriteAuth(req,url,owner);
    const resetting=url.pathname==='/api/guests/reset',body=await parseJsonBody(req,30000);guestKeys(body,resetting?['sha','id']:['sha','invitation']);if(!resetting)guestKeys(body.invitation,['label','starts_at','ends_at','products','instructions']);
    const file=await readRepoJson(GUEST_ACCESS_FILE,owner.token,true);if(body.sha!==file.sha)guestFail('Guest settings changed; reload before creating an invitation',409);
    const policy=guestPolicy(file.value||{schema_version:1,grants:[]}),prior=resetting?policy.grants.find(g=>g.id===body.id&&g.auth_type==='invite'&&!g.revoked):null;
    if(resetting&&(!prior||guestEpoch(prior.ends_at)<=Date.now()))guestFail('Only an unrevoked, unexpired invitation can be reset');
    const secret=random(32),code=random(12),grant={...(prior||body.invitation),id:prior?.id||crypto.randomUUID(),auth_type:'invite',invite_hash:await guestInviteDigest(secret),single_device:true,code_hash:await guestInviteDigest(code),device_hash:null,activated_at:null,revoked:false};
    grant.code_sealed=await seal({purpose:'guest-access-code',grant_id:grant.id,code},env);
    const next=guestPolicy({schema_version:1,grants:resetting?policy.grants.map(g=>g.id===grant.id?grant:g):[...policy.grants,grant]});
    const sha=await writeRepoJson(GUEST_ACCESS_FILE,owner.token,next,file.sha,resetting?'Reset spa guest browser activation':'Create expiring spa guest invitation');
    // Codes are encrypted at rest; hashes still verify activation. The raw
    // invitation link remains one-time and is never stored. Responses no-store.
    return json({ok:true,sha,grant:guestSafeGrant(grant),access_code:code,invitation_url:url.origin+'/guest#invite='+grant.id+'.'+secret});
  }
  if(url.pathname==='/api/guest/redeem'&&req.method==='POST'){
    if(req.headers.get('Origin')!==url.origin)guestFail('Invalid origin',403);
    if(!req.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))guestFail('Content-Type must be application/json',415);
    if(env.GUEST_ACCESS_ENABLED==='false')guestFail('Guest access is disabled',403);
    const body=await parseJsonBody(req,1000);guestKeys(body,['invitation','access_code']);
    const match=typeof body.invitation==='string'&&body.invitation.match(/^([-a-zA-Z0-9_]{8,100})\.([A-Za-z0-9_-]{43})$/);if(!match)guestFail('Invitation is invalid or inactive',403);
    const token=await guestInstallationToken(env,true),file=await readRepoJson(GUEST_ACCESS_FILE,token,true),policy=guestPolicy(file.value||{schema_version:1,grants:[]}),hash=await guestInviteDigest(match[2]),now=Date.now();
    const grant=policy.grants.find(g=>g.auth_type==='invite'&&g.id===match[1]&&g.invite_hash===hash&&!g.revoked&&guestEpoch(g.starts_at)<=now&&now<guestEpoch(g.ends_at));
    if(!grant)guestFail('Invitation is invalid, not yet active, expired or revoked',403);
    if(grant.single_device){
      // A random 96-bit code avoids the brute-force weakness of short numeric
      // PINs without depending on per-isolate counters or new infrastructure.
      if(typeof body.access_code!=='string'||await guestInviteDigest(body.access_code.trim())!==grant.code_hash)guestFail('Enter the access code supplied separately by the owner.',403);
      const device=getCookie(req,'__Host-j365-device');if(!/^[A-Za-z0-9_-]{43}$/.test(device))guestFail('Enable browser cookies and try activation again.',400);
      const hash=await guestInviteDigest(device);
      if(grant.device_hash&&grant.device_hash!==hash)guestFail('This invitation is already activated in another browser. Ask the owner to reset access.',403);
      if(!grant.device_hash){
        grant.device_hash=hash;grant.activated_at=new Date(now).toISOString();
        // GitHub's SHA compare-and-swap makes the claim exclusive across Worker
        // isolates. A competing claim cannot receive a session cookie.
        try{await writeRepoJson(GUEST_ACCESS_FILE,token,policy,file.sha,'Activate spa guest browser');}catch(e){if(e.status===409||e.status===422)guestFail('Activation changed. Retry in this browser; ask the owner to reset if already claimed.',409);throw e;}
      }
    }
    const until=guestEpoch(grant.ends_at),cookie=await seal({role:'guest',auth_type:'invite',user:grant.label,user_id:'invite:'+grant.id,grant_id:grant.id,invite_revision:grant.invite_hash,until,csrf:random(24)},env);
    return json({ok:true,user:grant.label,expires_at:grant.ends_at},200,{'Set-Cookie':guestCookie(cookie,Math.max(1,Math.floor((until-now)/1000)))});
  }
  return null;
}
async function guestLogin(me,env){
  const token=await guestInstallationToken(env),file=await readRepoJson(GUEST_ACCESS_FILE,token,true),policy=guestPolicy(file.value||{schema_version:1,grants:[]}),now=Date.now();
  const g=policy.grants.find(g=>g.user_id===me.id&&!g.revoked&&guestEpoch(g.starts_at)<=now&&now<guestEpoch(g.ends_at));
  if(!g)guestFail('This GitHub account has no active guest access',403);return g;
}
function guestPick(value,keys){return Object.fromEntries(keys.filter(k=>value[k]!=null).map(k=>[k,value[k]]));}
function guestSafeProfile(p){const safe=guestPick(p,['schema_version','id','revision','name','manufacturer','family','form','legacy_reference','legacy_name','archived']);if(p.concentration)safe.concentration=guestPick(p.concentration,['value','basis']);if(p.density)safe.density=guestPick(p.density,['mode','value','unit','mass','mass_unit','volume','volume_unit']);return safe;}
// Explicit disclosure allowlist: chemistry/model inputs, never arbitrary notes,
// repair costs, raw imports, OAuth details, deleted records or saved forecasts.
function guestPublicEvent(e){
  const fields=['id','schema_version','app_version','type','timestamp','timestamp_instant','time_zone','utc_offset_minutes','date_precision','created_at','fill_cycle_id','fc_ppm','cc_ppm','ph','ph_bounds','ta_ppm','ch_ppm','cya_ppm','borates_ppm','temperature_f','acid_demand_drops','acid_demand_target_ph','bathers','duration_minutes','showered','jet_air_use','air_on_minutes','product','product_id','product_revision','amount','unit','strength_percent','purity_percent','circulation_minutes','activity','filter_set','full','gallons','new_fill_cycle_id','starting_cya_ppm','starting_borates_ppm','cya_baseline_ppm','borates_baseline_ppm','exposure','water_source','softened','water_appearance','water_odor','cover_condition','cover_open_minutes','measurement_method','measurement_sources','strip_observations','test_kit','guest_actor'];
  const v=Object.fromEntries(Object.entries(guestPick(e,fields)).filter(([,value])=>typeof value!=='object'));if(e.product_profile)v.product_profile=guestSafeProfile(e.product_profile);
  if(e.ph_bounds)v.ph_bounds=guestPick(e.ph_bounds,['operator','value','minimum','maximum']);
  if(e.exposure)v.exposure=guestPick(e.exposure,['kind','duration_minutes','ended_at','sunlight','air_on']);
  if(e.guest_actor)v.guest_actor=guestPick(e.guest_actor,['user_id','login','label','auth_type','grant_id']);
  if(e.measurement_sources)v.measurement_sources=guestPick(e.measurement_sources,['fc_ppm','ph','ta_ppm','cc_ppm','ch_ppm','cya_ppm','borates_ppm']);
  if(e.strip_observations)v.strip_observations={...guestPick(e.strip_observations,['schema_version','profile_id','product']),readings:Object.fromEntries(Object.entries(guestPick(e.strip_observations.readings||{},Object.keys(GUEST_BLOCKS))).map(([k,r])=>[k,guestPick(r,['choice','minimum','maximum','working','censored','comparison_count','correction_applied'])]))};
  if(e.weather_context)v.weather_context={...guestPick(e.weather_context,['source','data_kind','retrieved_at','issued_at']),location:guestPick(e.weather_context.location||{},['latitude','longitude','site_elevation_ft','grid_elevation_ft','time_zone']),hours:(e.weather_context.hours||[]).map(h=>guestPick(h,['start','end','temperature_f','humidity_percent','wind_m_s','retrieved_at','issued_at','data_kind']))};
  for(const k of ['test_before_dose_id','source_test_id','product_strength'])if(e[k]!=null)v[k]=e[k];
  if(e.calculation){v.calculation=guestPick(e.calculation,['volume_gallons','suggested_amount','unit','measurement_timestamp','target_fc_ppm','target_ph']);if(e.calculation.source_measurements)v.calculation.source_measurements=guestPick(e.calculation.source_measurements,['fc_ppm','ph','ph_bounds','ta_ppm','acid_demand_drops','acid_demand_target_ph']);if(e.calculation.acid_response_correction)v.calculation.acid_response_correction=guestPick(e.calculation.acid_response_correction,['factor','count','provisional','reference_mass_grams']);}
  // Don't copy user-written custom activity strings into shared trend context.
  if(e.type==='maintenance'&&e.custom_activity==='Standalone jets')v.custom_activity='Standalone jets';
  if(e.historical)v.historical=guestPick(e.historical,['status','import_id','exclude_from_training']);
  return v;
}
async function guestRead(path,token,ref){
  try{const file=await github(repoFilePath(path)+(ref?'?ref='+encodeURIComponent(ref):''),token);return {sha:file.sha,value:JSON.parse(decodeGitHubContent(file.content))};}catch(e){if(e.status===404)return {sha:null,value:null};throw e;}
}
function guestActive(events){const replaced=new Set(events.map(e=>e.supersedes_event_id).filter(Boolean));return events.filter(e=>!e.record_removal&&!replaced.has(e.id));}
async function guestTimeline(token,ref='main',raw=false){
  const tree=await github(`/repos/${OWNER}/${REPO}/git/trees/${encodeURIComponent(ref)}?recursive=1`,token);
  if(tree.truncated||!Array.isArray(tree.tree))guestFail('Trend archive could not be loaded completely',503);
  const paths=tree.tree.filter(x=>x.type==='blob'&&/^events\/\d{4}\/\d{4}-(0[1-9]|1[0-2])\.json$/.test(x.path)).map(x=>x.path).sort();
  if(paths.length>24)guestFail('Trend archive needs pagination before guest use',503);
  const events=[];for(const path of paths){const file=await guestRead(path,token,ref);validateMonthlyDocument(file.value,path.slice(-12,-5));events.push(...file.value.events);}
  return raw?events:guestActive(events);
}
function guestStrip(key,choice){
  const blocks=GUEST_BLOCKS[key],i=blocks.indexOf(Number(choice));if(!blocks||!blocks.map(String).includes(choice))guestFail('Choose a supported strip block');
  const value=blocks[i],minimum=i? (blocks[i-1]+value)/2:0,maximum=i===blocks.length-1?value:(value+blocks[i+1])/2;
  return {choice,minimum,maximum,working:value,censored:i===blocks.length-1||key==='ph'&&i===0,comparison_count:0,correction_applied:false,evidence_ids:[]};
}
function guestConstruct(input,identity,events,config){
  guestKeys(input,['id','type','timestamp','timestamp_instant','readings','bathers','duration_minutes','showered','jet_air_use','product_id','amount','unit','supersedes_event_id']);
  if(!/^[a-zA-Z0-9][-a-zA-Z0-9_]{15,99}$/.test(input.id))guestFail('Invalid submission ID');
  const instant=guestEpoch(input.timestamp_instant),now=Date.now(),g=identity.grant;
  if(!Number.isFinite(instant)||instant>now+60000||instant<now-48*3600000||instant<guestEpoch(g.starts_at)||instant>=guestEpoch(g.ends_at))guestFail('Record an activity within your access window and the last 48 hours');
  const local=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Denver',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(instant).replace(' ','T');
  if(input.timestamp!==local)guestFail('Event time must match the Mountain-time instant');
  const fill=events.filter(e=>e.type==='water_change'&&e.full&&String(e.timestamp)<=local).sort((a,b)=>String(b.timestamp).localeCompare(String(a.timestamp)))[0];
  const event={id:input.id,schema_version:2,app_version:'guest-2',type:input.type,timestamp:local,timestamp_instant:input.timestamp_instant,time_zone:'America/Denver',created_at:new Date().toISOString(),fill_cycle_id:fill?.new_fill_cycle_id??config.current_fill_cycle_id??null,guest_actor:{user_id:identity.user_id,...(g.auth_type==='invite'?{label:g.label,auth_type:'invite'}:{login:identity.user}),grant_id:g.id},guest_submission:guestStable(input)};
  if(input.supersedes_event_id){const prior=events.find(e=>e.id===input.supersedes_event_id);if(!prior||prior.guest_actor?.user_id!==identity.user_id||prior.guest_actor?.grant_id!==g.id||(input.type!=='remove'&&prior.type!==input.type)||prior.timestamp.slice(0,7)!==local.slice(0,7))guestFail('Only your own active entries from this access window can be corrected (within the same month)',403);event.supersedes_event_id=prior.id;event.correction_reason='Guest correction';if(input.type==='remove'){guestKeys(input,['id','type','timestamp','timestamp_instant','supersedes_event_id']);return {...event,type:'note',record_removal:true,removed_record:prior,notes:'Guest removed own accidental entry'};}}
  const subtypeFields={chemistry:['readings'],soak:['bathers','duration_minutes','showered','jet_air_use'],chemical_addition:['product_id','amount','unit']}[input.type];
  if(!subtypeFields)guestFail('Guests can log strip tests, soaks and approved additions only');
  for(const key of Object.keys(input))if(!['id','type','timestamp','timestamp_instant','supersedes_event_id',...subtypeFields].includes(key))guestFail('Fields do not match the event type');
  if(input.type==='chemistry'){
    guestKeys(input.readings,Object.keys(GUEST_BLOCKS));if(!Object.keys(input.readings).length)guestFail('Choose a strip reading');
    const readings={};for(const [key,choice]of Object.entries(input.readings)){const r=guestStrip(key,choice);event[key]=r.working;readings[key]=r;}
    Object.assign(event,{measurement_method:'test_strip',measurement_sources:Object.fromEntries(Object.keys(readings).map(k=>[k,'test_strip'])),test_kit:'AQUANEXO 3-in-1',strip_observations:{schema_version:1,profile_id:'aquanexo-3in1-v1',product:'AQUANEXO 3-in-1',readings}});
  }else if(input.type==='soak'){
    if(!Number.isInteger(input.bathers)||input.bathers<1||input.bathers>6||!Number.isInteger(input.duration_minutes)||input.duration_minutes<1||input.duration_minutes>180||typeof input.showered!=='boolean'||!['off','water_only','air_on'].includes(input.jet_air_use))guestFail('Invalid soak details');
    Object.assign(event,guestPick(input,subtypeFields)); // Temperature is not invented from the owner’s habits.
  }else{
    const approved=g.products.find(p=>p.profile.id===input.product_id);if(!approved)guestFail('This product is not approved for guest use',403);
    if(!Object.hasOwn(GUEST_UNITS,input.unit)||!isFiniteNumber(input.amount,.000001,1000))guestFail('Choose a positive amount and supported volume unit');
    const volume=input.amount*GUEST_UNITS[input.unit];if(volume>approved.max_single_mL+.00001)guestFail('Amount exceeds the owner-approved single-dose limit',403);
    const total=events.filter(e=>e.type==='chemical_addition'&&e.product_id===input.product_id&&e.guest_actor?.grant_id===g.id&&Date.parse(e.created_at)>now-86400000&&e.id!==input.supersedes_event_id).reduce((sum,e)=>sum+e.amount*(GUEST_UNITS[e.unit]||0),0);
    if(total+volume>approved.max_daily_mL+.00001)guestFail('Amount exceeds the owner-approved 24-hour limit',403);
    Object.assign(event,{product:approved.profile.name,product_id:approved.profile.id,product_revision:approved.profile.revision,product_profile:guestSafeProfile(approved.profile),amount:input.amount,unit:input.unit});
  }
  validateEvent(event,local.slice(0,7));return event;
}
async function guestRoutes(req,env,url){
  const invitationResponse=await guestInvitationRoutes(req,env,url);if(invitationResponse)return invitationResponse;
  if(url.pathname==='/api/guests/check'&&req.method==='GET'){
    await requireSession(req,env);const token=await guestInstallationToken(env,true);await readRepoJson(CONFIG_FILE,token);return json({ok:true,repository:REPO,backend_enabled:env.GUEST_ACCESS_ENABLED!=='false'});
  }
  if(url.pathname==='/api/guests'){
    const owner=await requireSession(req,env);
    if(req.method==='GET'){const file=await readRepoJson(GUEST_ACCESS_FILE,owner.token,true);return json({sha:file.sha,policy:{schema_version:1,grants:guestPolicy(file.value||{schema_version:1,grants:[]}).grants.map(guestSafeGrant)},backend_enabled:env.GUEST_ACCESS_ENABLED!=='false',backend_configured:!!(env.GITHUB_APP_ID&&env.GITHUB_INSTALLATION_ID&&env.GITHUB_PRIVATE_KEY)});}
    if(req.method==='POST'){
      requireWriteAuth(req,url,owner);const body=await parseJsonBody(req,50000);guestKeys(body,['sha','policy']);if(body.sha!==null&&typeof body.sha!=='string')guestFail('Reload guest settings');
      const saved=await readRepoJson(GUEST_ACCESS_FILE,owner.token,true);if(saved.sha!==body.sha)guestFail('Guest settings changed; reload before saving',409);
      const previous=guestPolicy(saved.value||{schema_version:1,grants:[]});if(!isObject(body.policy)||!Array.isArray(body.policy.grants))guestFail('Invalid guest settings');
      const policy=guestPolicy({...body.policy,grants:body.policy.grants.map(g=>{
        if(g.auth_type!=='invite')return g;const prior=previous.grants.find(p=>p.id===g.id&&p.auth_type==='invite');if(!prior)guestFail('Create new invitations using the invitation action');
        if(['invite_hash','code_hash','code_sealed','device_hash'].some(k=>g[k]!=null)||g.single_device!==prior.single_device||g.activated_at!==prior.activated_at)guestFail('Activation settings can only be changed using Reset browser');return {...g,invite_hash:prior.invite_hash,...(prior.single_device?{code_hash:prior.code_hash,device_hash:prior.device_hash,...(prior.code_sealed?{code_sealed:prior.code_sealed}:{})}: {})};
      })});
      // Pin immutable numeric identity and check supplied login. Never authorize by mutable login alone.
      for(const g of policy.grants){if(g.auth_type==='invite')continue;const user=await github('/users/'+encodeURIComponent(g.login),owner.token);if(user.id!==g.user_id||user.type!=='User')guestFail('Guest GitHub identity did not match');}
      const sha=await writeRepoJson(GUEST_ACCESS_FILE,owner.token,policy,body.sha,'Update temporary spa guest access');return json({ok:true,sha});
    }return json({error:'Method not allowed'},405);
  }
  if(url.pathname==='/api/guests/lookup'&&req.method==='GET'){const owner=await requireSession(req,env),login=url.searchParams.get('login');if(!/^[-a-zA-Z0-9]{1,39}$/.test(login||''))guestFail('Enter a GitHub username');const user=await github('/users/'+encodeURIComponent(login),owner.token);if(user.type!=='User')guestFail('Use a personal GitHub account');return json({login:user.login,user_id:user.id});}
  if(!url.pathname.startsWith('/api/guest/'))return null;
  const current=await guestIdentity(req,env);
  if(url.pathname==='/api/guest/me'&&req.method==='GET')return json({user:current.user,user_id:current.user_id,role:'guest',csrf:current.csrf,expires_at:current.grant.ends_at,api_version:4});
  if(url.pathname==='/api/guest/context'&&req.method==='GET'){
    const file=await readRepoJson(CONFIG_FILE,current.token),config=file.value,events=await guestTimeline(current.token);
    return json({user:current.user,expires_at:current.grant.ends_at,instructions:current.grant.instructions,products:current.grant.products.map(p=>({...p,profile:guestSafeProfile(p.profile)})),config:{...guestPick(config,['schema_version','targets','current_fill_cycle_id']),spa:guestPick(config.spa||{},['model','volume_gallons']),chemicals:guestPick(config.chemicals||{},['bleach_strength_percent'])},events:events.map(guestPublicEvent)});
  }
  if(url.pathname==='/api/guest/entries'&&req.method==='POST'){
    requireWriteAuth(req,url,current);const body=await parseJsonBody(req,12000);guestKeys(body,['event']);
    for(let attempt=0;attempt<3;attempt++){
      // Every attempt rechecks revocation and reads one pinned repository head.
      // A fast-forward-only commit serializes writes even across month boundaries.
      const fresh=await guestGrant(current,env);current.grant=fresh.grant;
      const prefix=`/repos/${OWNER}/${REPO}/git`,head=await github(prefix+'/ref/heads/main',current.token),ref=head.object.sha,commit=await github(prefix+'/commits/'+ref,current.token);
      const month=validateMonth(body.event?.timestamp?.slice(0,7)),path=monthlyPath(month),remote=await guestRead(path,current.token,ref),document=remote.value||{schema_version:2,year_month:month,events:[]};
      const existing=document.events.find(e=>e.id===body.event.id);
      if(existing){if(existing.guest_actor?.user_id!==current.user_id||existing.guest_submission!==guestStable(body.event))guestFail('Submission ID already used',409);return json({ok:true,event:guestPublicEvent(existing),replayed:true});}
      const archive=await guestTimeline(current.token,ref,true);if(archive.some(e=>e.id===body.event.id))guestFail('Submission ID already used in the archive',409);
      const events=guestActive(archive),file=await guestRead(CONFIG_FILE,current.token,ref),event=guestConstruct(body.event,current,events,file.value);
      document.events.push(event);validateMonthlyDocument(document,month);
      try{
        const tree=await github(prefix+'/trees',current.token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base_tree:commit.tree.sha,tree:[{path,mode:'100644',type:'blob',content:JSON.stringify(document,null,2)+'\n'}]})});
        const saved=await github(prefix+'/commits',current.token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Log spa guest activity',tree:tree.sha,parents:[ref]})});
        await github(prefix+'/refs/heads/main',current.token,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({sha:saved.sha,force:false})});
        return json({ok:true,event:guestPublicEvent(event)});
      }catch(error){if(![409,422].includes(error.status)||attempt===2)throw error;}
    }
  }return json({error:'Not found'},404);
}
