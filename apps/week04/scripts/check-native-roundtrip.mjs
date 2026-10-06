import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const url=process.env.WEEK04_URL||'http://127.0.0.1:8776/week04/';
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await fs.mkdir('artifacts',{recursive:true});
try{
 await page.goto(url);
 await page.waitForFunction(()=>document.querySelector('.lib-status')?.textContent.includes('4题录 · 4份PDF · 353页'),null,{timeout:150000});
 const download=page.waitForEvent('download');
 await page.getByRole('button',{name:'导出 SQLite',exact:true}).click();
 await(await download).saveAs('artifacts/native-web-export.sqlite');
 const compare=spawnSync('python',['-c',`
import sqlite3,json
a=sqlite3.connect('src/assets/seed/native-library.sqlite');b=sqlite3.connect('artifacts/native-web-export.sqlite')
schema=lambda c:c.execute("select type,name,tbl_name,sql from sqlite_schema where sql is not null order by name").fetchall()
assert schema(a)==schema(b),'schema changed'
for (name,) in a.execute("select name from sqlite_schema where type='table' and name not like 'search_units_fts_%'"):
 assert sorted(a.execute('select * from "'+name+'"').fetchall(),key=repr)==sorted(b.execute('select * from "'+name+'"').fetchall(),key=repr),name
assert b.execute('pragma integrity_check').fetchone()[0]=='ok'
assert not b.execute('pragma foreign_key_check').fetchall()
print('All original schema and rows preserved through browser export')
`],{encoding:'utf8'});
 assert.equal(compare.status,0,compare.stderr);console.log(compare.stdout);
 await page.evaluate(()=>location.hash='D04');
 const slide=page.locator('deck-slide[slide-id=D04]');
 const pdf=await page.evaluate(async()=>{const seed=await(await fetch('assets/seed/native-seed.json')).json();const r=await fetch('assets/seed/'+seed.pdfs[0].path),bytes=new Uint8Array(await r.arrayBuffer());return {bytes:bytes.length,magic:new TextDecoder().decode(bytes.slice(0,5))};});assert.equal(pdf.magic,'%PDF-');assert(pdf.bytes>500000);
 await slide.getByRole('button',{name:'正文检索层：检索',exact:true}).click();
 for(const query of ['collectivization','金銀']){
  await slide.getByLabel('全文检索',{exact:true}).fill(query);
  if(query==='金銀')await slide.getByLabel('全文检索模式',{exact:true}).selectOption('substring');
  await slide.getByRole('button',{name:'检索',exact:true}).last().click();
  await page.waitForTimeout(300);
  const hits=await slide.locator('.work-hit').count();
  assert(hits>0,'No actual OCR hits for '+query);console.log(query,hits);
 }
 await slide.locator('.work-hit').first().click();
 await slide.locator('[data-pdf-ready=true]').waitFor();assert.match(await slide.locator('.reader-uri').innerText(),/page-\d+\.md/);
 const modify=spawnSync('dotnet',['run','--project','native-probe','--','artifacts/native-web-export.sqlite','artifacts/native-edited.sqlite'],{encoding:'utf8',maxBuffer:10*1024*1024});
 assert.equal(modify.status,0,modify.stderr);await fs.writeFile('artifacts/native-export-validation.json',modify.stdout);
 await page.evaluate(()=>location.hash='D04');await page.locator('deck-slide[slide-id=D04] patchouli-app .patchouli-app').waitFor();
 await page.getByLabel('打开 SQLite', {exact:true}).setInputFiles('artifacts/native-edited.sqlite');
 await page.waitForFunction(()=>document.querySelector('input[aria-label="打开 SQLite"]')?.value==='');
 const assertNativeNote=async filename=>{const pending=page.waitForEvent('download');await page.getByRole('button',{name:'导出 SQLite',exact:true}).click();await(await pending).saveAs(filename);const verify=spawnSync('python',['-c',"import sqlite3;c=sqlite3.connect('"+filename+"');assert c.execute(\"select count(*) from items where note='NATIVE_ROUNDTRIP_2026'\").fetchone()[0]>0"],{encoding:'utf8'});assert.equal(verify.status,0,verify.stderr);};
 await assertNativeNote('artifacts/native-reopened.sqlite');await page.screenshot({path:'artifacts/native-roundtrip.png'});
 await page.reload();await page.waitForFunction(()=>document.querySelector('.lib-status')?.textContent.includes('353页'),null,{timeout:150000});await assertNativeNote('artifacts/native-after-reload.sqlite');
 const trial=spawnSync('python',['-c',`
import sqlite3,shutil
shutil.copyfile('src/assets/seed/native-library.sqlite','artifacts/obsolete-trial.sqlite')
c=sqlite3.connect('artifacts/obsolete-trial.sqlite');c.execute('create table browser_seed_imports (key text)');c.commit()
`],{encoding:'utf8'});assert.equal(trial.status,0,trial.stderr);
 const trialBytes=(await fs.readFile('artifacts/obsolete-trial.sqlite')).toString('base64');
 await page.evaluate(async encoded=>{
  const binary=atob(encoded),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('week04-patchouli-lab-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put({bytes,files:{}},'library');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
 },trialBytes);
 console.log('Inserted obsolete trial fixture; reloading');await page.reload();
 await page.waitForFunction(()=>document.querySelector('.lib-status')?.textContent.includes('4题录 · 4份PDF · 353页'),null,{timeout:150000});
 const replacement=page.waitForEvent('download');await page.getByRole('button',{name:'导出 SQLite',exact:true}).click();await(await replacement).saveAs('artifacts/replaced-trial.sqlite');
 const verified=spawnSync('python',['-c',"import sqlite3;c=sqlite3.connect('artifacts/replaced-trial.sqlite');assert not c.execute(\"select name from sqlite_schema where name='browser_seed_imports'\").fetchall();assert c.execute('select count(*) from items').fetchone()[0]==4"],{encoding:'utf8'});assert.equal(verified.status,0,verified.stderr);
 await fs.unlink('artifacts/obsolete-trial.sqlite');
 assert.deepEqual(errors,[]);
 await fs.writeFile('artifacts/native-roundtrip-report.json',JSON.stringify({url,schemaAndRowsIdentical:true,pdfs:4,pages:353,queries:['collectivization','金銀'],nativeWriteReadBack:true,cachedNativeEditsPreserved:true,obsoleteTrialReplaced:true,errors},null,2));
 console.log('Native → browser → native → browser roundtrip passed');
}finally{console.log('Final library state',await page.locator('.lib-status').textContent().catch(()=>''));await browser.close();}
