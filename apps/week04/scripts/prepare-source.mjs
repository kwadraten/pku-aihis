import fs from 'node:fs/promises';
import path from 'node:path';
const dest=path.resolve('www/pku-aihis/week04/assets/licenses/corresponding-source');
const root=path.resolve('.');
await fs.mkdir(dest,{recursive:true});
// Only build inputs for the distributed GPL core and browser adaptation.
async function copy(relative){
 const from=path.join(root,relative),info=await fs.stat(from);
 if(info.isDirectory()){
  for(const name of await fs.readdir(from)){
   if(['bin','obj','publish','assets'].includes(name))continue;
   await copy(path.join(relative,name));
  }
 }else if(/\.(cs|csproj|sql|ts|tsx|mjs|css|html)$/.test(relative)||relative.endsWith('LICENSE')||relative.endsWith('manifest.json')){
  const to=path.join(dest,relative);await fs.mkdir(path.dirname(to),{recursive:true});await fs.copyFile(from,to);
 }
}
for(const dir of ['vendor/patchouli','core-probe','native-probe','src/lib','src/components','src/global','scripts','infrastructure-sources'])await copy(dir);
await fs.mkdir(path.join(dest,'src/assets/skos'),{recursive:true});for(const name of ['tools.entry.mjs','history.ttl','manifest.json','LICENSES.txt'])await fs.copyFile(path.join('src/assets/skos',name),path.join(dest,'src/assets/skos',name));
await fs.mkdir(path.join(dest,'src/assets/data'),{recursive:true});await fs.copyFile('src/assets/data/classroom-tags.json',path.join(dest,'src/assets/data/classroom-tags.json'));
for(const f of ['package.json','pnpm-lock.yaml','stencil.config.ts','tsconfig.json','README.md'])await fs.copyFile(f,path.join(dest,f));
await fs.writeFile(path.resolve('www/pku-aihis/week04/assets/licenses/SOURCE.txt'),
 'Patchouli GPL-3.0: see patchouli-LICENSE.txt and patchouli-manifest.json.\nCorresponding source and browser adaptations: ./corresponding-source/\nBuild instructions: corresponding-source/README.md\nUpstream: https://github.com/kwadraten/patchouli\n');

for(const relative of ['src/components/vocabulary-lab/vocabulary-lab.tsx','src/components/research-board/research-board.tsx','src/components/concept-labs/quality-lab.tsx','src/components/concept-labs/structure-lab.tsx'])await fs.unlink(path.join(dest,relative)).catch(error=>{if(error.code!=='ENOENT')throw error;});
