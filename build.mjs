import {mkdir,cp,rm,access,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export const PUBLIC_FILES=['index.html','app.js','core.js','maps.js','map-config.js','onelap.js','xingzhe.js','igpsport.js','favorites.js','style.css','assets'];
const root=path.dirname(fileURLToPath(import.meta.url)),output=path.resolve(root,'public');
if(path.dirname(output)!==root||path.basename(output)!=='public')throw Error('Invalid build output directory.');
for(const file of PUBLIC_FILES)await access(path.join(root,file));
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
if(pkg.private!==true)throw Error('Expected the private ride-weather website project.');
// This verified project-local directory contains generated public files only.
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
for(const file of PUBLIC_FILES)await cp(path.join(root,file),path.join(output,file),{recursive:true});
console.log('Built public website assets, including favorites.js, xingzhe.js and igpsport.js. Backend sources, tests and local diagnostics are excluded.');
