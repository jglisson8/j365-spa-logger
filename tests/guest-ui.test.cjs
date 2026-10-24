const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),tick=()=>new Promise(r=>setTimeout(r,40));
(async()=>{
 const {guestConstruct,guestPublicEvent}=await import('../worker/j365-worker-v3.9.mjs'),now=Date.now(),hour=3600000,errors=[],requests=[],posts=[];
 const profile={schema_version:1,id:'legacy-bleach',revision:1,name:'7.5% liquid bleach',manufacturer:'HDX',family:'hypochlorite',form:'liquid',concentration:{value:7.5,basis:'legacy'},legacy_name:'7.5% liquid bleach',legacy_reference:true};
 const grant={id:'guest-grant1',user_id:17,login:'tester',starts_at:new Date(now-24*hour).toISOString(),ends_at:new Date(now+24*hour).toISOString(),revoked:false,instructions:'Owner instructions',products:[{profile,max_single_mL:100,max_daily_mL:150}]},identity={user:'tester',user_id:17,grant_id:grant.id,grant};
 const config={schema_version:2,spa:{model:'Jacuzzi J-365',volume_gallons:395},targets:{cya_ppm:30,borates_ppm:40},current_fill_cycle_id:'fill'};
 let events=[{id:'fill',type:'water_change',full:true,gallons:395,starting_cya_ppm:30,starting_borates_ppm:40,new_fill_cycle_id:'fill',timestamp:new Date(now-7*24*hour).toISOString()},...[24,12,1].map((h,i)=>({id:'sample'+i,type:'chemistry',fill_cycle_id:'fill',timestamp:new Date(now-h*hour).toISOString(),fc_ppm:5-i,ph:7.4+i*.1,ta_ppm:90}))],rejectNext=false;
 const console=new VirtualConsole();console.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(html,{url:'https://j365-spa-sync.jglisson8.workers.dev/guest',runScripts:'dangerously',virtualConsole:console,beforeParse(w){
  w.localStorage.setItem('j365_spa_events_v2','OWNER-PRIVATE-SENTINEL');w.localStorage.setItem('j365_spa_config_v2','OWNER-PRIVATE-CONFIG');w.scrollTo=()=>{};w.alert=m=>errors.push(m);w.confirm=()=>true;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.fetch=async(url,options={})=>{requests.push(String(url));let body,status=200;
   if(url==='/api/me')body={user:'tester',user_id:17,role:'guest',csrf:'csrf'};
   else if(url==='/api/guest/context')body={user:'tester',expires_at:grant.ends_at,products:grant.products,instructions:grant.instructions,config,events:events.map(guestPublicEvent)};
   else if(url==='/api/guest/entries'){const input=JSON.parse(options.body).event;posts.push(input);if(rejectNext){rejectNext=false;throw Error('Connection interrupted');}const saved=guestConstruct(input,identity,events,config);events=events.filter(e=>e.id!==saved.supersedes_event_id);if(!saved.record_removal)events.push(saved);body={ok:true,event:guestPublicEvent(saved)};}
   else{status=503;body={error:'Unavailable'};}return {ok:status===200,status,json:async()=>body};
  };
 }});const w=dom.window,d=w.document,$=id=>d.getElementById(id);await tick();await tick();
 assert.ok($('guestPanel'));assert.equal($('guestInstructions').textContent,'Owner instructions');assert.equal($('guestManagement'),null);assert.equal($('pwaStatus'),null);assert.equal(w.eval('appHasUnsavedWork()'),false);
 assert.equal(w.localStorage.getItem('j365_spa_events_v2'),'OWNER-PRIVATE-SENTINEL');assert.equal(w.eval('read().length'),4);assert.equal(requests.includes('/api/config'),false);assert.equal(requests.includes('/api/months'),false);
 for(const b of d.querySelectorAll('.tabs [data-tab]'))if(!['chemistry','trends'].includes(b.dataset.tab))assert.equal(b.hidden,true);
 d.querySelector('[data-tab="trends"]').click();assert.ok($('trendCharts').querySelectorAll('svg').length>=3);$('trendCharts').querySelector('[data-expand-chart]').click();assert.equal($('chartViewer').open,true);$('chartViewer').close();
 $('guest-ph').value='7.6';$('guest-fc_ppm').value='3';$('guest-ph').dispatchEvent(new w.Event('input',{bubbles:true}));assert.equal(w.eval('appHasUnsavedWork()'),true);
 const submit=()=> $('guestForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));rejectNext=true;submit();submit();await tick();assert.equal(posts.length,1);assert.match($('guestStatus').textContent,/Save not confirmed/);submit();await tick();await tick();assert.equal(posts.length,2);assert.equal(posts[0].id,posts[1].id);assert.equal(events.at(-1).measurement_method,'test_strip');assert.equal(w.eval('appHasUnsavedWork()'),false);
 assert.equal(w.localStorage.getItem('j365_spa_events_v2'),'OWNER-PRIVATE-SENTINEL');assert.equal(w.localStorage.getItem('j365_spa_config_v2'),'OWNER-PRIVATE-CONFIG');
 assert.deepEqual(errors,[]);dom.window.close();process.stdout.write('PASS: guest memory isolation, strips-only form, read-only expanded Trends, retry IDs, double-tap guard, drafts and owner API isolation\n');
})().catch(e=>{console.error(e);process.exit(1);});
