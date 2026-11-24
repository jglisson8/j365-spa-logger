// Review artifact: independent acceptance ranges plus candidate/baseline deltas.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),journeys=require('../tests/fixtures/forecast-journeys.cjs'),{replay}=require('../tests/qa/replay.cjs');
const root=path.join(__dirname,'..'),output=path.join(root,'artifacts','forecast-qa.json'),baseline=process.env.QA_BASE_REF;
const {forecastDiff,unreviewedChanges}=require('./lib/qa-diff.cjs'),crypto=require('node:crypto');
const fingerprint=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'index.html'))).digest('hex');
let oldHtml=null;
if(baseline&&!/^0+$/.test(baseline)){
 if(!/^[0-9a-f]{7,40}$/i.test(baseline))throw Error('QA_BASE_REF must be a commit SHA');
 oldHtml=execFileSync('git',['show',baseline+':index.html'],{cwd:root,encoding:'utf8',maxBuffer:4*1024*1024});
}
const results=journeys.map(journey=>{
 const current=replay(journey),before=oldHtml?replay(journey,oldHtml,false):null,changes=before?forecastDiff(before,current):[];
 return {...current,changes};
});
const missingReviews=unreviewedChanges(results,JSON.parse(fs.readFileSync(path.join(root,'qa/forecast-change-reviews.json'))),fingerprint);
const report={schema_version:1,created_at:new Date().toISOString(),source_sha256:fingerprint,candidate:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),baseline:oldHtml?baseline:null,note:'Synthetic data only. Passing contracts do not prove chemical accuracy. Forecast changes require review; never regenerate expectations merely to make tests pass.',unreviewed:missingReviews,results};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log('PASS: '+results.length+' acceptance journeys; '+results.length*3+' parameter checks. Report: artifacts/forecast-qa.json');
for(const r of results)for(const change of r.changes)console.log('REVIEW forecast delta: '+r.id+' / '+change.parameter+' '+JSON.stringify(change));
if(missingReviews.length){console.error('BLOCKED: '+missingReviews.length+' forecast changes need a source-hash-scoped reason in qa/forecast-change-reviews.json. Inspect the report; do not automatically bless the new output.');process.exitCode=1;}
