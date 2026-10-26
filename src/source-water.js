// One source baseline per fill and parameter; repeated testing of one fill
// must not outweigh other fills. These are proxies, not fresh source samples.
function sourceWaterBaselines(events,key,at=Date.now()){
 if(!['ta_ppm','ph','ch_ppm'].includes(key))return [];
 const cutoff=Number.isFinite(at)?at:parseSpaTime(at),fills=new Map();
 for(const e of [...events].sort(timelineOrder))if(e.type==='water_change'&&e.full&&chartTime(e)<=cutoff&&!fills.has(e.new_fill_cycle_id))fills.set(e.new_fill_cycle_id,e);
 const rows=[];
 for(const [fillId,fill]of fills){
  const explicit=fill.source_chemistry?.[key];if(Number.isFinite(explicit)){rows.push({fill_id:fillId,event_id:fill.id,timestamp:fill.timestamp,value:explicit,explicit:true});continue;}
  const start=SpaTime.calendar(fill.timestamp.slice(0,10)),samples=events.filter(e=>e.type==='chemistry'&&Number.isFinite(e[key])&&!isStripParameter(e,key)&&effectiveModelFill(e,events)===fillId&&chartTime(e)<=cutoff&&timelineOrder(e,fill)>=0&&(e.measurement_context==='initial_fill_before_balancing'||SpaTime.calendar(e.timestamp.slice(0,10))-start<=3*86400000)).sort(timelineOrder);
  const first=samples[0];if(!first)continue;
  const affects=e=>key==='ta_ppm'?/acid|spa down|bisulfate|carbonate|baking soda/i.test(chemicalName(e)):key==='ch_ppm'?/calcium/i.test(chemicalName(e)):true;
  if(events.some(e=>e.type==='chemical_addition'&&effectiveModelFill(e,events)===fillId&&timelineOrder(e,fill)>=0&&timelineOrder(e,first)<0&&affects(e)))continue;
  rows.push({fill_id:fillId,event_id:first.id,timestamp:first.timestamp,value:first[key],historical:!!first.historical,explicit:false});
 }
 return rows.sort((a,b)=>compareSpa(a.timestamp,b.timestamp));
}
function sourceWaterEstimate(events,key,at=Date.now()){
 const all=sourceWaterBaselines(events,key,at);if(!all.length)return null;
 const mode=config?.source_water?.mode==='average'?'average':'latest',rows=mode==='average'?all:[all.at(-1)];
 return {value:rows.reduce((s,r)=>s+r.value,0)/rows.length,approximate:true,basis:mode==='average'?'historical fill average':'latest fill baseline',mode,count:rows.length,event_id:rows.length===1?rows[0].event_id:undefined,event_ids:rows.map(r=>r.event_id),fill_ids:rows.map(r=>r.fill_id),timestamp:rows.at(-1).timestamp};
}
// Keep explicit per-top-off values and untreated FC behavior unchanged.
const sourceWaterOriginalTopOff=topOffSource;
topOffSource=function(event,events,key){
 if(Number.isFinite(event.source_chemistry?.[key])||key!=='ta_ppm')return sourceWaterOriginalTopOff(event,events,key);
 if(!events.some(e=>e.type==='water_change'&&e.full&&e.new_fill_cycle_id===effectiveModelFill(event,events)&&compareSpa(e,event)<=0))return null;
 return sourceWaterEstimate(events,key,chartTime(event));
};
topOffSourceNote=function(event,events){const s=topOffSource(event,events,'ta_ppm');return s?.approximate?'Top-off source TA ≈'+Number(s.value.toFixed(1))+' ppm · '+s.basis+' ('+s.count+' fill'+(s.count===1?'':'s')+'); source water was not retested':s?.basis==='initial-fill source measurement'?'Top-off uses recorded initial-fill source TA '+s.value+' ppm':null;};
function setupSourceWater(){
 if(typeof window==='undefined'||!document.querySelector||guestPage())return;
 const box=document.createElement('details');box.id='sourceWaterSettings';box.className='panel';
 box.innerHTML='<summary>Source water · fill &amp; top-offs</summary><p class="help">Your first Taylor readings after a fresh fill, before relevant balancing chemicals, become its baseline. Test fields entered with the new-fill form work too. Same-source water is assumed for later top-offs.</p><label for="sourceWaterMode">Use for future top-offs</label><select id="sourceWaterMode"><option value="latest">Latest available fill baseline</option><option value="average">Average of historical fill baselines</option></select><p class="help">One value per fill per parameter. Missing values can use an earlier fill. Entering source TA on a top-off always overrides the profile. FC still defaults to 0; pH is not averaged directly into the tub.</p><div id="sourceWaterSummary"></div><button type="button" class="secondary" id="saveSourceWater">Save source-water preference</button><p id="sourceWaterStatus" role="status"></p>';
 $('tab-maintenance').append(box);
 let sourceWaterDirty=false,editBase=null;$('sourceWaterMode').onchange=()=>{if(!sourceWaterDirty)editBase=configClone(config);sourceWaterDirty=true;};
 const refresh=()=>{const select=$('sourceWaterMode');if(!sourceWaterDirty)select.value=config?.source_water?.mode==='average'?'average':'latest';const rows=['ta_ppm','ph','ch_ppm'].map(key=>{const p=sourceWaterEstimate(activeEvents(),key),name={ta_ppm:'TA',ph:'pH',ch_ppm:'CH'}[key];return '<p>'+name+': '+(p?'≈'+p.value.toFixed(key==='ph'?1:0)+(key==='ph'?'':' ppm')+' · '+p.count+' fill'+(p.count===1?'':'s')+' · latest '+esc(p.timestamp.slice(0,10)):'awaiting an initial-fill reading')+'</p>';});$('sourceWaterSummary').innerHTML=rows.join('');};
 $('saveSourceWater').onclick=async()=>{const mode=$('sourceWaterMode').value;if(!['latest','average'].includes(mode))return;const value={schema_version:1,mode};stageConfigField('source_water',value,editBase??config);config=applyPendingConfig(config||{schema_version:2,spa:{model:'Jacuzzi J-365',volume_gallons:395}});writeConfigState(config,true);sourceWaterDirty=false;editBase=null;render();$('sourceWaterStatus').textContent='Saved on this device · sync pending';if(session){const ok=await syncConfig();$('sourceWaterStatus').textContent=ok?'Source-water preference synced':'Saved on this device · sync pending';}};
 const dirty=appHasUnsavedWork;appHasUnsavedWork=()=>dirty()||$('sourceWaterMode').value!==(config?.source_water?.mode==='average'?'average':'latest');
 const renderBefore=render;render=function(...args){renderBefore(...args);refresh();};
 const hint=document.createElement('p');hint.className='help';hint.textContent='Source TA left blank uses your saved fill-water profile when available.';$('sourceTa').after(hint);
 refresh();
}
