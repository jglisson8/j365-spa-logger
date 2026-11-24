const assert=require('node:assert/strict'),{waitForArtifact}=require('../scripts/wait-pages-artifact.cjs');
const workflow=require('node:fs').readFileSync(require('node:path').join(__dirname,'../.github/workflows/test.yml'),'utf8');
assert.match(workflow,/needs: \[test, mobile-browser\]/,'Both QA jobs must gate deployment');
for(const field of ['name','QA_PAGES_ARTIFACT','artifact_name'])assert.ok(workflow.includes(`${field}: github-pages-${'${{ github.run_attempt }}'}`),'Upload, availability and deploy must select the same attempt');
(async()=>{
 let calls=0,waits=0;
 const artifact={id:42,name:'github-pages-2',expired:false};
 assert.equal(await waitForArtifact({name:artifact.name,list:async()=>++calls===1?[]:[{...artifact,name:'github-pages-1'},artifact],wait:async()=>waits++}),42);
 assert.equal(calls,2);assert.equal(waits,1,'Retry a temporarily missing artifact, not the deployment');
 await assert.rejects(waitForArtifact({name:artifact.name,list:async()=>[{...artifact,name:'github-pages-1'}],wait:async()=>{},attempts:2}),/deployment remains blocked/);
 await assert.rejects(waitForArtifact({name:artifact.name,list:async()=>[artifact,artifact]}),/Multiple release packages/);
 await assert.rejects(waitForArtifact({name:artifact.name,list:async()=>[{...artifact,expired:true}],wait:async()=>{},attempts:1}),/deployment remains blocked/);
 console.log('PASS: artifact propagation wait, attempt isolation, duplicate and expired package rejection');
})().catch(error=>{console.error(error);process.exitCode=1});
