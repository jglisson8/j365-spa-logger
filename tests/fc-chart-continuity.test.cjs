const assert=require('node:assert/strict'),{c,run}=require('./app-harness.cjs')();
const h=3600000,start=Date.parse('2026-10-22T00:25Z'),horizon=start+15.05*h;
const projection={model:{k:.02},status:'Synthetic regression',horizon,points:[{t:start,v:1.8,k:.02},{t:start,v:5.76936,k:.02,jump_kind:'dose'},{t:start+4.133333333*h,v:4.22,k:.02,jump_kind:'soak'},{t:Date.parse('2026-10-23T05:01Z'),v:1.43,k:.02,jump_kind:'soak'}]};
c.p=projection;c.end=start+60*h;
const paths=svg=>Object.fromEntries([...svg.matchAll(/data-chart-trend="([^"]+)" points="([^"]+)"/g)].map(m=>[m[1],m[2].split(' ').map(s=>s.split(',').map(Number))]));
const render=()=>paths(run('projectionSvg(p,e=>Date.parse(e.timestamp),v=>v,end)'));
const original=JSON.stringify(projection),result=render(),extended=result.extrapolated;
assert.equal(result.future.at(-1)[0],horizon);assert.equal(extended[0][0],horizon);assert.deepEqual(result.future.at(-1),extended[0]);
const late=projection.points.at(-1),at=extended.filter(([t])=>t===late.t);assert.ok(at.some(([,v])=>Math.abs(v-late.v)<1e-9));assert.ok(at.some(([,v])=>v>late.v));
assert.ok(extended.some(([t])=>t>horizon&&t<late.t));assert.equal(extended.at(-1)[0],c.end);
for(const [t,v]of extended){const a=projection.points.filter(a=>a.t<=t).at(-1);if(t===late.t)continue;assert.ok(Math.abs(v-a.v*Math.exp(-a.k*(t-a.t)/h))<1e-8);}
// Multiple later events, including additions, remain sharp and in time order.
projection.points.push({t:start+35*h,v:5,k:.03,jump_kind:'dose'},{t:start+40*h,v:3.5,k:.03,jump_kind:'soak'});
const many=render().extrapolated;for(let i=1;i<many.length;i++)assert.ok(many[i][0]>=many[i-1][0]);for(const a of projection.points.slice(-2))assert.ok(many.some(([t,v])=>t===a.t&&Math.abs(v-a.v)<1e-9));
// A support boundary exactly on an event includes both sides of the jump.
projection.horizon=late.t;const boundary=render();assert.equal(boundary.future.at(-1)[0],late.t);assert.equal(boundary.extrapolated[0][0],late.t);assert.equal(boundary.future.at(-1)[1],late.v);
c.end=projection.horizon-h;assert.equal(render().extrapolated,undefined);
// View windows entirely inside the extension still use the active prior anchor.
c.end=start+60*h;const clipped=paths(run('(()=>{const x=e=>Date.parse(e.timestamp);x.start=p.horizon+3600000;return projectionSvg(p,x,v=>v,end)})()'));
assert.equal(clipped.future,undefined);assert.equal(clipped.extrapolated[0][0],projection.horizon+h);
// Rendering never updates a model coefficient or an observation.
c.p=JSON.parse(original);run('projectionSvg(p,e=>Date.parse(e.timestamp),v=>v,end)');assert.equal(JSON.stringify(c.p),original);
assert.match(run('projectionSvg(p,e=>Date.parse(e.timestamp),v=>v,end)'),/opacity=".45" stroke-dasharray="3 6"/);
console.log('PASS: FC extension continuity across support boundary, late soaks/doses, sharp jumps, clipped windows and unchanged forecast inputs');
