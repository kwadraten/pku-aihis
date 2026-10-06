import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root = path.resolve(import.meta.dirname,'..'), docs = path.resolve(root,'../../docs/week04');
const read = async name => JSON.parse(await fs.readFile(path.join(root,name),'utf8'));
const development = await read('artifacts/browser-report.json');
const production = await read('artifacts/static-browser-report.json');
if (development.failure || production.failure || development.errors.length || production.errors.length) throw new Error('Do not publish a passing summary from failed checks');
const nativeText = execFileSync('dotnet',['run','--project','native-probe/NativeProbe.csproj','--no-restore','--verbosity','quiet','--','artifacts/export.sqlite'],{cwd:root,encoding:'utf8'});
const native = JSON.parse(nativeText.slice(nativeText.indexOf('{')));
await fs.writeFile(path.join(root,'artifacts/native-report.json'),JSON.stringify(native,null,2)+'\n');
await fs.mkdir(docs,{recursive:true});
const select = report => ({date:report.date,url:report.url,browser:report.browser,viewport:report.viewport,checks:report.checks,errors:report.errors,
  remote_requests:report.network.filter(r=>!r.url.startsWith(new URL(report.url).origin)&&!r.url.startsWith('blob:')&&!r.url.startsWith('data:'))});
await fs.writeFile(path.join(docs,'browser-verification.json'),JSON.stringify({scope:'Synthetic test fixtures only; no slides, no private library, no remote deployment',development:select(development),static:select(production),native},null,2)+'\n');
await fs.copyFile(path.join(root,'vendor/patchouli/manifest.json'),path.join(docs,'patchouli-source-manifest.json'));
await fs.copyFile(path.join(root,'public/ocr/models.json'),path.join(docs,'ocr-models.json'));
console.log(`Recorded ${development.checks.length} development / ${production.checks.length} static checks and ${native.revisions.length} native-validated revisions`);
