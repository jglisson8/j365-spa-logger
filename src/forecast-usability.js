function forecastPerformance(events,key){const rows=validForecastReviews(events,key).filter(r=>Number.isFinite(r.error)).slice(-20);return {count:rows.length,mae:rows.length?rows.reduce((s,r)=>s+Math.abs(r.error),0)/rows.length:null,bias:rows.length?rows.reduce((s,r)=>s+r.error,0)/rows.length:null};}
function setupForecastUsability(){
 if(typeof window==='undefined'||!document.querySelector)return;
 const style=document.createElement('style');style.textContent='#expandedChart .forecast-basis{display:none}#expandedChart [data-forecast-retest]{min-height:28px;padding:3px 8px;margin:0;font-size:12px}';document.head.append(style);
 const overview=chartOverview;chartOverview=function(p,key,plotted,now=Date.now()){
  const html=overview(p,key,plotted,now);if(!['fc_ppm','ph','ta_ppm'].includes(key))return html;
  if(p?.blocked||!Number.isFinite(p?.current))return html+'<button type="button" class="secondary" data-forecast-retest="'+key+'">Log a '+({fc_ppm:'FC',ph:'pH',ta_ppm:'TA'}[key])+' test</button>';
  const anchor=p.t??p.points?.[0]?.t,sample=Number.isFinite(anchor)?SpaTime.format(anchor,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):null,doses=p.points?.filter(point=>point.event_id).length||0;
  return html+(sample?'<p class="help forecast-basis">From '+esc(sample)+(doses?' + logged activity':'')+'</p>':'');
 };
 document.addEventListener('click',e=>{const button=e.target.closest('[data-forecast-retest]');if(!button)return;if(chartViewer.open)chartViewer.close();setTab('chemistry');if(guestPage())$('guestChooseTest').click();const key=button.dataset.forecastRetest,field=guestPage()?'guest-'+key:{fc_ppm:'fc',ph:'ph',ta_ppm:'ta'}[key];if(guestPage()&&key==='ta_ppm')$('guestOptionalTests').open=true;$(field)?.focus();$(field)?.scrollIntoView?.({behavior:'smooth',block:'center'});});
 if(guestPage())return;
 const box=document.createElement('details');box.id='forecastPerformanceSummary';box.className='panel';box.innerHTML='<summary>Forecast accuracy · recent checks</summary><div id="forecastPerformanceRows"></div><p class="help">Up to 20 comparable frozen predictions per parameter. Typical miss is mean absolute error; bias is measured minus predicted. These are checks against later samples, not recalculated historical fits or a safety guarantee.</p>';$('tab-maintenance').append(box);
 const update=()=>{$('forecastPerformanceRows').innerHTML=['fc_ppm','ph','ta_ppm'].map(key=>{const p=forecastPerformance(activeEvents(),key),digits=key==='ta_ppm'?0:2,unit=key==='ph'?'':' ppm';return '<p><strong>'+({fc_ppm:'FC',ph:'pH',ta_ppm:'TA'}[key])+'</strong> · '+(p.count?p.count+' check'+(p.count===1?'':'s')+' · typical miss '+p.mae.toFixed(digits)+unit+' · bias '+(p.bias>=0?'+':'')+p.bias.toFixed(digits)+unit:'No comparable checks yet')+'</p>';}).join('');};
 const before=render;render=function(...args){before(...args);update();};update();
}
