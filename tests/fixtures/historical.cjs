// Synthetic import: no private export, source quotes or real event identifiers.
const fixedNow=Date.parse('2026-10-20T15:00:00Z');
module.exports=[
 {id:'synthetic-fill',type:'water_change',full:true,timestamp:'2026-09-01',date_precision:'date_only',new_fill_cycle_id:'synthetic-cycle',gallons:395,starting_cya_ppm:30,starting_borates_ppm:40},
 ...[0,1,2].map(i=>({id:'synthetic-history-'+i,type:'chemistry',timestamp:'2026-09-0'+(2+i),date_precision:'date_only',fill_cycle_id:'synthetic-cycle',fc_ppm:4-i,ta_ppm:100,ph_bounds:{operator:'>',value:8},historical:{status:'reconstructed',import_id:'synthetic-import',exclude_from_training:true}})),
 ...Array.from({length:40},(_,i)=>({id:'synthetic-recent-'+i,type:'chemistry',timestamp:new Date(fixedNow-(40-i)*86400000).toISOString().slice(0,10),date_precision:'date_only',fill_cycle_id:'synthetic-cycle',fc_ppm:4-i/20,ta_ppm:100,ph_bounds:{operator:'>',value:8},historical:{status:'reconstructed',import_id:'synthetic-import',exclude_from_training:true}}))
];
