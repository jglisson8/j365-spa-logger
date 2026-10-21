const assert=require('node:assert/strict'),{c,run,storage}=require('./app-harness.cjs')();
let renders=0;c.spy=()=>renders++;run('render=spy');
c.entry={id:'synthetic-once',type:'chemistry',timestamp:'2026-10-01T12:00',ph:7.5};
run('save([entry],"Synthetic save",false)');
assert.equal(renders,1,'One synchronous full render per save, not two');
assert.equal(run('read().length'),1);assert.equal(run('read()[0].ph'),7.5);
assert.equal(run('activeEvents().length'),1);assert.match(run('document.getElementById("toast").textContent'),/Synthetic save/);
// A failed local persistence must not show success or invoke render.
c.localStorage.setItem=()=>{throw Error('Quota exceeded')};assert.throws(()=>run('save([{...entry,id:"synthetic-unsaved"}],"Unsaved",false)'),/Quota/);assert.equal(renders,1);assert.equal(JSON.parse(storage.get('j365_spa_events_v2')).length,1);
console.log('PASS: single synchronous save render, one record, toast ordering and local-persistence failure');
