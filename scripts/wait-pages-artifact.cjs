// GitHub's artifact list can lag a successful upload. Fail closed, never publish
// a package from another attempt or choose arbitrarily among duplicate names.
async function waitForArtifact({list,name,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),attempts=20}){
 for(let attempt=0;attempt<attempts;attempt++){
  const artifacts=await list();
  const matches=artifacts.filter(a=>a.name===name&&!a.expired);
  if(matches.length>1)throw Error('Multiple release packages match this attempt');
  if(matches.length===1)return matches[0].id;
  if(attempt+1<attempts)await wait(3000);
 }
 throw Error('Release package did not become visible; deployment remains blocked');
}
module.exports={waitForArtifact};
if(require.main===module)(async()=>{
 const {GITHUB_REPOSITORY:repo,GITHUB_RUN_ID:run,GH_TOKEN:token,QA_PAGES_ARTIFACT:name}=process.env;
 if(!/^jglisson8\/j365-spa-logger$/.test(repo||'')||!/^\d+$/.test(run||'')||!/^github-pages-\d+$/.test(name||'')||!token)throw Error('Missing release package context');
 const list=async()=>{
  const r=await fetch(`https://api.github.com/repos/${repo}/actions/runs/${run}/artifacts?per_page=100`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error(`Release package lookup failed (${r.status})`);
  const body=await r.json();
  if(!Array.isArray(body.artifacts)||body.total_count>100)throw Error('Incomplete release package list');
  return body.artifacts;
 };
 const id=await waitForArtifact({list,name});console.log(`Release package ${name} is available (${id}).`);
})().catch(error=>{console.error(error.message);process.exitCode=1});
