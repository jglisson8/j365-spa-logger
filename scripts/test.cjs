const {spawnSync}=require('node:child_process'),path=require('node:path'),fs=require('node:fs');
if(Number(process.versions.node.split('.')[0])!==24)throw Error('Use Node.js 24 (see .nvmrc).');
const root=path.join(__dirname,'..');
const tests=['scripts/build-time.cjs',...fs.readdirSync(path.join(root,'tests')).filter(f=>/\.test\.(cjs|mjs)$/.test(f)).map(f=>'tests/'+f),...fs.readdirSync(path.join(root,'tests/ui')).filter(f=>f.endsWith('.cjs')).map(f=>'tests/ui/'+f)];
for(const file of tests){console.log('\n▶ '+file);const result=spawnSync(process.execPath,[file,...(file.includes('build-time')?['--check']:[])],{cwd:root,env:{...process.env,TZ:'America/Denver'},stdio:'inherit',timeout:120000});if(result.error)console.error(result.error);if(result.status!==0)process.exit(result.status||1)}
console.log('\nPASS: all '+tests.length+' regression commands.');
