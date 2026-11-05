const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM,VirtualConsole}=require('jsdom');
const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://spa.test/',runScripts:'dangerously',virtualConsole:new VirtualConsole(),beforeParse(w){w.scrollTo=()=>{};w.fetch=async()=>({ok:false,status:503,json:async()=>({})});}}),w=dom.window,volume=w.eval('PRODUCT_VOLUME');
try{
 for(const [family,unit,limits]of [['hypochlorite','cup',[.25,1/3,.5]],['bisulfate','tbsp',[1,2,3]]]){
  const p={status:'dose',profile:{family},mL:0};
  assert.equal(w.guestPracticalDose(p).status,'check');
  for(const limit of limits){
   const exact=limit*volume[unit];
   for(const offset of [-.01,0,.01]){
    const source={...p,mL:exact+offset},frozen=JSON.stringify(source),r=w.guestPracticalDose(source);
    assert.equal(JSON.stringify(source),frozen);
    if(r.status==='dose'){assert.ok(r.mL<=source.mL+1e-8);assert.equal(r.suggested_unit,unit);assert.ok(family==='bisulfate'?Number.isInteger(r.suggested_amount):limits.includes(r.suggested_amount));}
    if(offset===0){assert.equal(r.status,'dose');assert.equal(r.suggested_amount,limit);}
    if(offset<0&&limit===limits[0])assert.equal(r.status,'check','Never round up to the minimum practical measure');
   }
  }
  const large=w.guestPracticalDose({...p,mL:999});if(family==='hypochlorite')assert.equal(large.suggested_amount,.5,'No larger cup suggestion is introduced');
 }
 assert.equal(w.guestPracticalDose({status:'check',message:'Existing safety guard'}).message,'Existing safety guard');
 console.log('PASS: exact/below/above ¼, ⅓, ½ cup and whole-tablespoon boundaries, no upward rounding, immutable calculations, unchanged safety blocks');
}finally{w.close()}
