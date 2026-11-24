function forecastDiff(before,current){
 const changes=[];
 for(const key of Object.keys(current.parameters)){
  const a=before.parameters[key],b=current.parameters[key];
  if(a.current!==b.current||a.kind!==b.kind||a.home_value!==b.home_value||a.home_text!==b.home_text||a.chart_summary!==b.chart_summary||a.history_visible!==b.history_visible)changes.push({parameter:key,before:{value:a.current,kind:a.kind,home:a.home_value,home_text:a.home_text,chart_summary:a.chart_summary,history:a.history_visible},after:{value:b.current,kind:b.kind,home:b.home_value,home_text:b.home_text,chart_summary:b.chart_summary,history:b.history_visible}});
 }
 if(JSON.stringify(before.cya)!==JSON.stringify(current.cya))changes.push({parameter:'cya_ppm',before:before.cya??null,after:current.cya??null});
 return changes;
}
function unreviewedChanges(results,reviews,fingerprint){
 return results.flatMap(r=>r.changes.filter(c=>!reviews.some(v=>v.source_sha256===fingerprint&&v.scenario===r.id&&v.parameter===c.parameter&&typeof v.reason==='string'&&v.reason.trim().length>=30)).map(c=>({scenario:r.id,...c})));
}
module.exports={forecastDiff,unreviewedChanges};
