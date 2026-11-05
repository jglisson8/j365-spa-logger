// Reuse pure model work only inside one synchronous UI operation. Never keep a
// chemistry result across edits, settings changes, saves, syncs or clock ticks.
let uiPerformanceContext=null;
let uiChartsDirty=true,uiChartsLast=0;
function requestUiCharts(events){if(typeof window!=='undefined'&&$('tab-trends').hidden){uiChartsDirty=true;return}return renderCharts(events)}
function requestUiModelDetails(){if(typeof window==='undefined'||!$('tab-trends').hidden&&beta.open)return renderModelBeta()}
function uiPerformanceRun(fn){
 if(uiPerformanceContext)return fn();
 uiPerformanceContext={values:new Map(),ids:new WeakMap(),nextId:0,raw:null,rows:null};
 try{return fn()}finally{uiPerformanceContext=null}
}
function uiPerformanceScope(fn){return function(...args){return uiPerformanceRun(()=>fn.apply(this,args))}}
function uiPerformanceMemo(name,fn){return function(...args){return uiPerformanceRun(()=>{
 const c=uiPerformanceContext,identity=value=>{
  if(Array.isArray(value))return '['+value.map(identity).join(',')+']'+(value.acidAudit?'@audit:'+identity(value.acidAudit):'');
  if(value&&typeof value==='object'){if(!c.ids.has(value))c.ids.set(value,++c.nextId);return '@'+c.ids.get(value)}
  return typeof value+':'+JSON.stringify(value);
 },key=name+'|'+Math.floor(Date.now()/60000)+'|'+args.map(identity).join('|');
 if(c.values.has(key))return c.values.get(key);
 const result=fn.apply(this,args);c.values.set(key,result);return result;
})}}
function setupUiPerformance(){
 // Each read still returns an independent array: existing callers may sort it.
 // Event objects are shared only during this synchronous read-only operation.
 const originalRead=read;read=function(){const c=uiPerformanceContext;if(!c)return originalRead();const raw=localStorage.getItem(KEY)||'[]';if(c.raw!==raw){c.raw=raw;c.rows=originalRead();c.values.clear()}return c.rows.slice()};
 stripTrainingEvents=uiPerformanceMemo('stripTrainingEvents',stripTrainingEvents);
 calculatedCya=uiPerformanceMemo('calculatedCya',calculatedCya);
 calculatedBorates=uiPerformanceMemo('calculatedBorates',calculatedBorates);
 buildParameterFramework=uiPerformanceMemo('buildParameterFramework',buildParameterFramework);
 learnBalanceEffects=uiPerformanceMemo('learnBalanceEffects',learnBalanceEffects);
 phGasFit=uiPerformanceMemo('phGasFit',phGasFit);
 buildDecayModel=uiPerformanceMemo('buildDecayModel',buildDecayModel);
 acidDoseCalibration=uiPerformanceMemo('acidDoseCalibration',acidDoseCalibration);
 validForecastReviews=uiPerformanceMemo('validForecastReviews',validForecastReviews);
 automaticDosePairs=uiPerformanceMemo('automaticDosePairs',automaticDosePairs);
 balanceProjection=uiPerformanceScope(balanceProjection);fcProjection=uiPerformanceScope(fcProjection);
 const charts=renderCharts;renderCharts=uiPerformanceScope(function(...args){const result=charts(...args);if(!args[1]?.target||args[1].target==='trendCharts'){uiChartsDirty=false;uiChartsLast=Date.now()}return result});renderExtras=uiPerformanceScope(renderExtras);
 renderModelBeta=uiPerformanceScope(renderModelBeta);renderActionGuidance=uiPerformanceScope(renderActionGuidance);
 render=uiPerformanceScope(render);calculate=uiPerformanceScope(calculate);
 const tab=setTab;setTab=function(...args){const result=tab(...args);if(args[0]==='trends'){if(uiChartsDirty||Date.now()-uiChartsLast>=60000)renderCharts(activeEvents());requestUiModelDetails()}return result};
 if(typeof window!=='undefined')beta.addEventListener('toggle',()=>{if(beta.open&&!$('tab-trends').hidden)renderModelBeta()});
}
