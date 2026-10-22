// View-only history filtering. Never pass filtered rows into models or sync.
const HISTORY_CATEGORIES=[['all','All activity'],['tests','Tests'],['additions','Chemical additions'],['soaks','Soaks'],['service','Service'],['water','Water changes / top-offs'],['notes','Notes / other']];
const HISTORY_TEST_FIELDS=[['all','Any parameter'],['fc_ppm','FC'],['ph','pH (including 8+)'],['ta_ppm','TA'],['ch_ppm','CH'],['cc_ppm','CC'],['cya_ppm','CYA'],['borates_ppm','Borates'],['acid_demand_drops','Acid-demand drops']];
const HISTORY_ADDITION_KINDS=[['all','Any addition'],['chlorine','Chlorine'],['acid','pH down / acid'],['bicarbonate','TA up / baking soda'],['cya','CYA / dichlor'],['borates','Borates'],['calcium','Calcium'],['other','Other / unidentified']];
let historyFilterState={category:'all',detail:'all',product:'all',filterSet:'all',limit:100};
function historyFilterRecord(event){return event.record_removal&&event.removed_record?event.removed_record:event;}
function historyCategory(event){const e=historyFilterRecord(event);return ({chemistry:'tests',chemical_addition:'additions',soak:'soaks',maintenance:'service',water_change:'water',water_top_off:'water'})[e.type]||'notes';}
function historyProductKey(event){const e=historyFilterRecord(event),legacy=!e.product_id?profileForChoice(e.product):null;return e.product_id||legacy?'id:'+(e.product_id||legacy.id):'name:'+String(e.product||'Unspecified product').trim().toLowerCase();}
function historyAdditionKind(event){const e=historyFilterRecord(event),p=doseProduct(e);
 if(p)return ({hypochlorite:'chlorine',dichlor:'chlorine',bisulfate:'acid',hydrochloric:'acid',bicarbonate:'bicarbonate',boric:'borates',calcium:'calcium'})[p.family]||'other';
 if(e.product_profile||e.product_id)return 'other';
 const name=String(e.product||'');if(/bleach|chlorine|hypochlorite|dichlor/i.test(name))return 'chlorine';if(/acid|spa down|ph down|bisulfate/i.test(name)&&!/boric/i.test(name))return 'acid';if(/baking soda|bicarbonate/i.test(name))return 'bicarbonate';if(/boric|borate/i.test(name))return 'borates';if(/calcium/i.test(name))return 'calcium';return 'other';
}
function historyServiceKey(event){const e=historyFilterRecord(event);return e.activity==='custom'?'custom:'+String(e.custom_activity||'Other service'):String(e.activity||'unknown');}
function historyMatches(event,state=historyFilterState){
 const e=historyFilterRecord(event),category=historyCategory(event),detail=state.detail||'all';
 if(state.category==='all')return true;if(category!==state.category)return false;
 if(category==='tests'&&detail!=='all')return detail==='ph'?Number.isFinite(e.ph)||!!e.ph_bounds:Number.isFinite(e[detail]);
 if(category==='additions'){
   if(state.product&&state.product!=='all'&&historyProductKey(event)!==state.product)return false;
   if(detail==='cya')return doseProduct(e)?.family==='dichlor'||!e.product_profile&&!e.product_id&&/dichlor/i.test(String(e.product||''));
   return detail==='all'||historyAdditionKind(event)===detail;
 }
 if(category==='service')return (detail==='all'||historyServiceKey(event)===detail)&&(!state.filterSet||state.filterSet==='all'||e.filter_set===state.filterSet);
 if(category==='water')return detail==='all'||(e.type==='water_top_off'?'top_off':e.full?'full':'partial')===detail;
 return true;
}
function historyFilterRows(events){return events.filter(e=>historyMatches(e));}
function historyDisplayLimit(){return historyFilterState.limit;}
function setupHistoryFilters(){
 if(typeof window==='undefined'||!document.querySelector)return;
 const storageKey='j365_history_filters_v1';
 try{const p=JSON.parse(localStorage.getItem(storageKey)||'{}');if(p&&HISTORY_CATEGORIES.some(([key])=>key===p.category)){historyFilterState={...historyFilterState,...Object.fromEntries(['category','detail','product','filterSet'].filter(k=>typeof p[k]==='string'&&p[k].length<=240).map(k=>[k,p[k]]))};if(p.category==='tests'&&!HISTORY_TEST_FIELDS.some(([key])=>key===p.detail)||p.category==='additions'&&!HISTORY_ADDITION_KINDS.some(([key])=>key===p.detail))historyFilterState.detail='all';}}catch{}
 const panel=document.createElement('section');panel.id='historyFilters';panel.className='calcbox';panel.setAttribute('aria-label','History filters');
 panel.innerHTML='<div class="history-filter-main"><div><label for="historyCategory">Show</label><select id="historyCategory"></select></div><button type="button" class="secondary" id="clearHistoryFilters">Clear filters</button></div><div id="historySubfilters" class="history-subfilters"><div id="historyDetailField"><label for="historyDetail">Parameter / activity</label><select id="historyDetail"></select></div><div id="historyProductField"><label for="historyProduct">Product</label><select id="historyProduct"></select></div><div id="historySetField"><label for="historyFilterSet">Filter set</label><select id="historyFilterSet"></select></div></div><p id="historyFilterCount" class="help" role="status"></p>';
 $('history').before(panel);const more=document.createElement('button');more.id='historyLoadMore';more.type='button';more.className='secondary';more.textContent='Show more matching entries';$('history').after(more);
 const options=(node,rows,value)=>{node.innerHTML=rows.map(([key,label])=>'<option value="'+esc(key)+'">'+esc(label)+'</option>').join('');if(value!=='all'&&!rows.some(([key])=>key===value)){const option=document.createElement('option');option.value=value;option.textContent='Selected item (not in loaded records)';node.append(option);}node.value=value;};
 options($('historyCategory'),HISTORY_CATEGORIES,historyFilterState.category);
 const source=()=>($('showOriginals').checked?read():activeEvents()).filter(e=>!e.weather_for_event_id);
 const refresh=()=>{
   const all=source(),state=historyFilterState,category=state.category;
   $('historyCategory').value=category;$('historySubfilters').hidden=!['tests','additions','service','water'].includes(category);$('historyProductField').hidden=category!=='additions';$('historySetField').hidden=category!=='service';
   let details=HISTORY_TEST_FIELDS;
   if(category==='additions')details=HISTORY_ADDITION_KINDS;
   if(category==='water')details=[['all','Any water event'],['full','Full refill'],['partial','Partial water change'],['top_off','Top-off']];
   if(category==='service'){
     const activities=new Map();for(const event of [...all].sort(historyOrder).filter(e=>historyCategory(e)==='service')){const e=historyFilterRecord(event),key=historyServiceKey(event),label=e.activity==='custom'?e.custom_activity||'Other service':SERVICE_TASKS.find(([id])=>id===e.activity)?.[1]||String(e.activity||'Unknown service').replaceAll('_',' ');activities.set(key,label);}
     details=[['all','Any service'],...[...activities].sort((a,b)=>a[1].localeCompare(b[1]))];
   }
   $('historyDetailField').querySelector('label').textContent=category==='tests'?'Tested parameter':category==='additions'?'Addition type':'Activity';options($('historyDetail'),details,state.detail);
   const products=new Map();for(const event of [...all].sort(historyOrder).filter(e=>historyCategory(e)==='additions'&&historyMatches(e,{...state,category:'additions',product:'all'}))){const e=historyFilterRecord(event),key=historyProductKey(event);if(!products.has(key))products.set(key,e.product||e.product_profile?.name||'Unspecified product');}
   options($('historyProduct'),[['all','All products'],...[...products].sort((a,b)=>a[1].localeCompare(b[1]))],state.product);
   const sets=[...new Set(['A','B',...all.map(historyFilterRecord).map(e=>e.filter_set).filter(Boolean)])];options($('historyFilterSet'),[['all','All filter sets'],...sets.map(id=>[id,filterDisplayName(id)])],state.filterSet);
   const matching=historyFilterRows(all),shown=Math.min(state.limit,matching.length),active=category!=='all';
   $('clearHistoryFilters').disabled=!active;$('historyFilterCount').textContent='Showing '+shown+' of '+matching.length+' matching entr'+(matching.length===1?'y':'ies')+' · '+all.length+' loaded'+(active?' · filters active':'');more.hidden=shown>=matching.length;
   if(!matching.length&&all.length)$('history').textContent='No matching entries. Adjust or clear the filters. Older months can be loaded under Sync, backup and older records.';
 };
 const persist=()=>{try{const {limit,...state}=historyFilterState;localStorage.setItem(storageKey,JSON.stringify(state));}catch{}};
 const change=()=>{persist();render();};
 $('showOriginals').onchange=()=>render();
 $('historyCategory').onchange=()=>{historyFilterState={category:$('historyCategory').value,detail:'all',product:'all',filterSet:'all',limit:100};change();};
 $('historyDetail').onchange=()=>{historyFilterState.detail=$('historyDetail').value;historyFilterState.product='all';historyFilterState.limit=100;change();};
 $('historyProduct').onchange=()=>{historyFilterState.product=$('historyProduct').value;historyFilterState.limit=100;change();};
 $('historyFilterSet').onchange=()=>{historyFilterState.filterSet=$('historyFilterSet').value;historyFilterState.limit=100;change();};
 $('clearHistoryFilters').onclick=()=>{historyFilterState={category:'all',detail:'all',product:'all',filterSet:'all',limit:100};change();};more.onclick=()=>{historyFilterState.limit+=100;render();};
 const oldRender=render;render=function(){oldRender();refresh();};
 const style=document.createElement('style');style.textContent='#historyFilters{margin:0 0 12px;padding:12px}#historyFilters label{font-size:12px;margin:0 0 5px}#historyFilters select{min-height:44px;font-size:14px;padding:10px}#historyFilters .history-filter-main{display:flex;align-items:flex-end;gap:10px}#historyFilters .history-filter-main>div{flex:1;min-width:0}#clearHistoryFilters{min-height:44px;font-size:12px;flex:none}#historyFilters .history-subfilters{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;margin-top:10px}#historyFilterCount{margin-bottom:0}#historyLoadMore{display:block;margin:0 auto 18px}';document.head.append(style);render();
}
