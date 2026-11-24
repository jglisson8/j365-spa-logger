// Read-only post-release check of exact public bytes and unauthenticated API guards.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),root=path.join(__dirname,'..'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const expected={html:hash(fs.readFileSync(path.join(root,'index.html'))),sw:hash(fs.readFileSync(path.join(root,'sw.js')))},version=JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version;
(async()=>{
 for(let n=0;n<24;n++){
  const results=await Promise.all(['https://jglisson8.github.io/j365-spa-logger','https://j365-spa-sync.jglisson8.workers.dev'].map(async origin=>{
   const get=p=>fetch(origin+p+'?qa='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(15000)}),html=await get('/'),sw=await get('/sw.js');
   return {origin,status:html.status,html_matches:hash(await html.text())===expected.html,sw_matches:hash(await sw.text())===expected.sw};
  }));
  if(results.every(r=>r.status===200&&r.html_matches&&r.sw_matches)){
   for(const route of ['/api/config','/api/events?month=2026-11','/api/guest/context']){const r=await fetch('https://j365-spa-sync.jglisson8.workers.dev'+route,{signal:AbortSignal.timeout(15000)});if(![401,403].includes(r.status))throw Error('Private route guard failed: '+route);}
   console.log(JSON.stringify({verified:true,version,results},null,2));return;
  }
  if(n===23)throw Error('Release does not match tested files: '+JSON.stringify(results));
  await new Promise(resolve=>setTimeout(resolve,5000));
 }
})().catch(e=>{console.error(e);process.exitCode=1});
