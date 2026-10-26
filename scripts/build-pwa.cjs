const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),htmlPath=path.join(root,'index.html'),html=fs.readFileSync(htmlPath,'utf8'),version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
const lib=fs.readFileSync(path.join(root,'src/pwa-client.js'),'utf8').trimEnd(),replacement='// BEGIN GENERATED PWA CLIENT\n'+lib+'\n// END GENERATED PWA CLIENT';
const ui=['src/app-ui.js','src/app-workflow.js','src/history-filters.js','src/strip-testing.js','src/source-water.js','src/guest-dose.js','src/guest-mode.js','src/guest-practice.js','src/forecast-usability.js'].map(p=>fs.readFileSync(path.join(root,p),'utf8').trimEnd()).join('\n');
const next=html.replace(/\/\/ BEGIN GENERATED PWA CLIENT\n[\s\S]*?\/\/ END GENERATED PWA CLIENT/,replacement).replace(/\/\/ BEGIN GENERATED APP UI\n[\s\S]*?\/\/ END GENERATED APP UI/,'// BEGIN GENERATED APP UI\n'+ui+'\n// END GENERATED APP UI');
const template=fs.readFileSync(path.join(root,'src/sw-template.js'),'utf8'),sw=template.replaceAll('__APP_VERSION__',version);
if(process.argv.includes('--check')){if(next!==html||sw!==fs.readFileSync(path.join(root,'sw.js'),'utf8')){console.error('Run node scripts/build-pwa.cjs');process.exit(1)}}else{fs.writeFileSync(htmlPath,next);fs.writeFileSync(path.join(root,'sw.js'),sw)}
console.log('PWA client and versioned offline worker match '+version);
