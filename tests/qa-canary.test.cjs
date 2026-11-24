// Prove the release contracts reject the actual failure classes, not just
// the current implementation. Mutations are in memory, never in the app file.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),journeys=require('./fixtures/forecast-journeys.cjs'),{replay}=require('./qa/replay.cjs');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),journey=journeys.find(j=>j.id==='tablet-rounded-acid-and-earlier-ta-anchor');
function inject(code){assert.ok(html.includes('setupUiPerformance();'));return html.replace('setupUiPerformance();',code+'\nsetupUiPerformance();');}
assert.throws(()=>replay(journey,inject('const qaCanaryBalance=balanceProjection;balanceProjection=function(...args){const p=qaCanaryBalance(...args);return args[1]==="ph"&&p.tablet_context?{...p,current:null}:p};')),/supported\/unsupported state/,'Reintroducing blanket pH suppression must fail QA');
assert.ok(html.includes('if(isTabletRecord(e))continue;if(key==='));
assert.throws(()=>replay(journey,html.replace('if(isTabletRecord(e))continue;if(key===','if(key===')),/supported\/unsupported state/,'Stopping TA at the tablet start must fail QA');
assert.throws(()=>replay(journey,inject('const qaCanaryContext=actionContext;actionContext=function(...args){const p=qaCanaryContext(...args);p.facts.ta_ppm={...p.facts.ta_ppm,kind:"unknown",value:null,display_estimate:null};return p};')),/Home must not hide/,'A correct API but blank Home value must fail QA');
assert.throws(()=>replay(journey,inject('const qaCanaryOverview=chartOverview;chartOverview=function(p,key,...rest){return key==="ph"?"<p class=chart-summary>Latest sample: 8+</p>":qaCanaryOverview(p,key,...rest)};')),/chart\/API parity/,'A chart hiding a supported estimate must fail QA');
assert.throws(()=>replay(journey,inject('const qaCanaryRendered=renderActionGuidance;renderActionGuidance=function(){qaCanaryRendered();for(const node of document.querySelectorAll(".current-estimates .estimate-value"))if(node.textContent.startsWith("TA:"))node.textContent="TA: needs a reading"};')),/rendered Home text/,'Correct model and context with a broken rendered Home must fail QA');
assert.throws(()=>replay(journey,inject('projectionSvg=()=>"";')),/forecast line must be rendered/,'Numeric forecasts with only dots and no model line must fail QA');
console.log('PASS: release contracts detect suppressed pH, blocked TA, hidden Home values and stale chart summaries');
