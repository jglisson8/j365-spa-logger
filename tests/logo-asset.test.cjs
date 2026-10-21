const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {serveLogoAsset,LOGO_ASSET_PATH,LOGO_ASSET_URL}=require('../src/logo-asset.js');
const png=fs.readFileSync(require('node:path').join(__dirname,'../assets/spa-mountain-logo.png'));
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
assert.match(html,/<img alt="" src="assets\/spa-mountain-logo\.png\?v=b3f5dd956a0b" width="100" height="84">/);
assert.doesNotMatch(html,/data:image\/png;base64,/);
for(const base of ['https://jglisson8.github.io/j365-spa-logger/','https://j365-spa-sync.jglisson8.workers.dev/'])assert.ok(new URL('assets/spa-mountain-logo.png?v=b3f5dd956a0b',base).pathname.endsWith('/assets/spa-mountain-logo.png'));
const realFetch=global.fetch;let calls=0;
(async()=>{
 global.fetch=async(url,options)=>{calls++;assert.equal(url,LOGO_ASSET_URL);assert.deepEqual(options.headers,{Accept:'image/png'});assert.equal(options.redirect,'error');return new Response(options.method==='HEAD'?null:png,{headers:{'Content-Type':'image/png','Set-Cookie':'must-not-forward','X-Private':'must-not-forward'}})};
 const request=new Request('https://spa.test'+LOGO_ASSET_PATH+'?v=example&url=https://untrusted.test/',{headers:{Cookie:'private-session',Authorization:'private-token'}});
 const r=await serveLogoAsset(request);assert.equal(r.status,200);assert.deepEqual(Buffer.from(await r.arrayBuffer()),png);assert.equal(r.headers.get('Content-Type'),'image/png');assert.equal(r.headers.get('Cache-Control'),'public, max-age=86400');assert.equal(r.headers.get('X-Content-Type-Options'),'nosniff');assert.equal(r.headers.get('Set-Cookie'),null);assert.equal(r.headers.get('X-Private'),null);
 const head=await serveLogoAsset(new Request(request.url,{method:'HEAD'}));assert.equal(head.status,200);assert.equal((await head.arrayBuffer()).byteLength,0);
 assert.equal((await serveLogoAsset(new Request('https://spa.test/assets/other.png'))).status,404);assert.equal((await serveLogoAsset(new Request(request.url,{method:'POST'}))).status,405);assert.equal(calls,2);
 for(const response of [new Response('missing',{status:404}),new Response('<html>not an image</html>',{headers:{'Content-Type':'text/html'}})]){global.fetch=async()=>response;const failed=await serveLogoAsset(request);assert.equal(failed.status,502);assert.equal(failed.headers.get('Cache-Control'),'no-store')}
 global.fetch=async()=>{throw Error('network down')};assert.equal((await serveLogoAsset(request)).status,502);
 assert.equal(crypto.createHash('sha256').update(png).digest('hex'),'b3f5dd956a0bafec509e5b290bda7ff508249e22d3f27c8a9e8aee33ef242e27');
 console.log('PASS: exact logo bytes, GET/HEAD caching, fixed upstream, no credential/header forwarding, method/path restrictions and safe upstream failures');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{global.fetch=realFetch});
