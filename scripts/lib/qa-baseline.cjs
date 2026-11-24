const valid=value=>typeof value==='string'&&/^[0-9a-f]{40}$/i.test(value)&&!/^0+$/.test(value);
async function selectBaseline({prBase,fallback,deployments,statuses}){
 if(valid(prBase))return prBase;
 for(const d of deployments){if(valid(d.sha)&&(await statuses(d.id)).some(s=>s.state==='success'))return d.sha;}
 if(valid(fallback))return fallback;
 throw Error('No verified deployed baseline. Supply the last approved deployed commit SHA; do not skip comparison.');
}
module.exports={selectBaseline};
