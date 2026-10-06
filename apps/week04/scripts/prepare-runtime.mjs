import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root=path.resolve(import.meta.dirname,'..');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const run=(command,args)=>execFileSync(command,args,{cwd:root,stdio:'inherit'});
const seedDir=path.join(root,'src/assets/seed');
const seed=JSON.parse(await fs.readFile(path.join(seedDir,'native-seed.json'),'utf8'));
if(seed.format!=='patchouli-native-classroom-subset-v1'||seed.pdfs.length!==4)throw Error('预置数据库清单不完整');
for(const asset of [seed.database,...seed.pdfs]){
 const target=path.resolve(seedDir,asset.path);
 if(!target.startsWith(seedDir+path.sep))throw Error('预置资源路径越界');
 const bytes=await fs.readFile(target);
 if(bytes.length!==asset.bytes||hash(bytes)!==asset.sha256)throw Error('预置资源校验失败：'+asset.path);
}
console.log('Verified checked-in native SQLite and four PDFs');

const vendor=path.join(root,'vendor/patchouli');
const manifest=JSON.parse(await fs.readFile(path.join(vendor,'manifest.json'),'utf8'));
const sourceHashes=[];
for(const source of manifest.files){
 const target=path.resolve(vendor,source.path);
 if(!target.startsWith(vendor+path.sep))throw Error('原核心源码路径越界');
 const actual=hash(await fs.readFile(target));
 if(actual!==source.sha256)throw Error('原核心源码与清单不符：'+source.path);
 sourceHashes.push([source.path,actual]);
}
for(const name of ['Program.cs','CoreProbe.csproj','packages.lock.json'])sourceHashes.push(['core-probe/'+name,hash(await fs.readFile(path.join(root,'core-probe',name)))]);
const sourceHash=hash(JSON.stringify(sourceHashes));
const core=path.join(root,'src/assets/core');
const marker=path.join(core,'classroom-runtime.json');
const previous=JSON.parse(await fs.readFile(marker,'utf8').catch(()=>'{}'));
if(previous.source_sha256!==sourceHash||!await fs.stat(path.join(core,'index.html')).catch(()=>null)){
 run('dotnet',['restore','core-probe/CoreProbe.csproj','-p:Configuration=Release','--locked-mode']);
 run('dotnet',['publish','core-probe/CoreProbe.csproj','--no-restore','-c','Release','-o','core-probe/publish']);
 run(process.execPath,['scripts/prepare-core.mjs']);
 await fs.writeFile(marker,JSON.stringify({source_sha256:sourceHash},null,2)+'\n');
}else{
 await fs.mkdir(path.join(root,'src/assets/licenses'),{recursive:true});
 for(const [from,to] of [['LICENSE','patchouli-LICENSE.txt'],['manifest.json','patchouli-manifest.json']])await fs.copyFile(path.join(vendor,from),path.join(root,'src/assets/licenses',to));
 console.log('Reusing verified native core build');
}
run(process.execPath,['scripts/prepare-ocr.mjs']);
