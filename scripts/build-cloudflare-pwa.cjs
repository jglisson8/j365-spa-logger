// Generate the standalone dashboard deployment from the retained 3.7 rollback.
const fs=require('node:fs'),path=require('node:path'),root=path.join(__dirname,'..'),outputs=path.resolve(root,'../../outputs');
let source=fs.readFileSync(path.join(outputs,'j365_spa_sync_worker_v3_7.js'),'utf8');
const helper=fs.readFileSync(path.join(root,'src/pwa-assets.js'),'utf8').replace(/if \(typeof module[^\n]+\n?/,'');
source=source.replace('export default {',helper+'\nexport default {').replace("if (path === LOGO_ASSET_PATH)","if (Object.hasOwn(PWA_ASSETS, path)) return servePwaAsset(req);\n      if (path === LOGO_ASSET_PATH)");
source=source.replace("connect-src 'self'; img-src", "connect-src 'self'; manifest-src 'self'; worker-src 'self'; img-src").replace("version: '3.7'","version: '3.8'").replace('Worker v3.7 — fixed public logo asset route; private APIs unchanged.','Worker v3.8 — installable public PWA assets; private APIs unchanged.');
fs.writeFileSync(path.join(outputs,'j365_spa_sync_worker_v3_8.js'),source);
console.log('Prepared Worker 3.8; OAuth, CSRF and private API implementation unchanged.');
