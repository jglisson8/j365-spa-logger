const {selectBaseline}=require('./lib/qa-baseline.cjs');
const repo='jglisson8/j365-spa-logger',headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(process.env.GH_TOKEN?{Authorization:'Bearer '+process.env.GH_TOKEN}:{})};
async function get(path){const r=await fetch('https://api.github.com/repos/'+repo+path,{headers,signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Cannot establish deployed baseline (GitHub '+r.status+')');return r.json();}
(async()=>{
 const prBase=process.env.QA_REQUEST_BASE_SHA,fallback=process.env.QA_FALLBACK_SHA;
 const deployments=prBase?[]:await get('/deployments?environment=github-pages&per_page=50');
 const sha=await selectBaseline({prBase,fallback,deployments,statuses:id=>get('/deployments/'+id+'/statuses?per_page=30')});
 console.log(sha);
})().catch(e=>{console.error(e.message);process.exitCode=1});
