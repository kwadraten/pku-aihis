import {chromium} from 'playwright';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const url=process.env.WEEK04_URL||'http://127.0.0.1:8774/week04/';
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
const page=await context.newPage(),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
const slide=()=>page.locator('deck-slide').filter({visible:true});
const go=async id=>{await page.evaluate(id=>location.hash=id,id);await page.waitForTimeout(250);};
await fs.mkdir('artifacts',{recursive:true});
const check=(name,result=true)=>{checks.push({name,result});console.log(name,JSON.stringify(result).slice(0,400));};
try{
 await page.goto(url+'#D04');await page.waitForFunction(()=>document.querySelector('.lib-status')?.textContent.includes('4题录'),null,{timeout:150000});
 await slide().getByRole('button',{name:'正文检索层：检索',exact:true}).click();await page.getByLabel('全文检索',{exact:true}).waitFor();
 await page.screenshot({path:'artifacts/workbench-D04.png'});
 assert.equal(await page.locator('tool-explainer').count(),0);check('Annotation controls removed');
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
 for(let i=1;i<=3;i++){const p=pdf.addPage([600,780]);p.drawText('ResearchEvidencePage'+i+'2026',{x:50,y:680,font,size:20});p.drawText('Original statement and its source page '+i,{x:50,y:620,font,size:14});}
 await fs.writeFile('artifacts/tool-import.pdf',await pdf.save());
 await go('D06');await slide().getByLabel('工具页面').selectOption('processing');await slide().getByLabel('工具页面',{exact:true}).selectOption('processing');await page.getByLabel('导入题名',{exact:true}).fill('Imported PDF');await page.getByLabel('导入作者',{exact:true}).fill('Researcher Test');await page.getByLabel('导入PDF文件',{exact:true}).setInputFiles('artifacts/tool-import.pdf');
 await page.waitForFunction(()=>document.querySelector('pdf-importer [role=status]')?.textContent.includes('已保存 1 份PDF'),null,{timeout:150000});
 assert.match(await page.locator('.lib-status').textContent(),/5题录.*5份PDF.*356页/);check('PDF import commits all three pages');
 await go('D04');await slide().getByRole('button',{name:'正文检索层：检索',exact:true}).click();await page.getByLabel('全文检索',{exact:true}).fill('ResearchEvidencePage32026');await slide().getByRole('button',{name:'检索',exact:true}).last().click();await page.locator('.work-hit').first().waitFor();await page.locator('.work-hit').first().click();
 await page.waitForFunction(()=>document.querySelector('pdf-reader .reader-uri')?.textContent.includes('page-3.md'));check('Last imported page is actually searchable and resolves to PDF page 3');
 const uri=await page.locator('pdf-reader .reader-uri').textContent();
 await go('D05');await slide().getByLabel('责任者1姓名',{exact:true}).fill('Researcher Test');await slide().getByLabel('出版日期',{exact:true}).fill('2026-10-06');await slide().getByRole('button',{name:'保存题录',exact:true}).click();await slide().locator('.mds-feedback').filter({hasText:'题录已保存'}).waitFor();check('Imported metadata accepts structured author and publication date');
 await go('D20');await slide().locator('markdown-lab .cm-editor').waitFor();await slide().locator('markdown-lab').evaluate((el,uri)=>el.setText('# Persisted source note\n\nEvidence: '+uri),uri);await page.reload();await page.waitForFunction(()=>document.querySelector('.lib-status')?.textContent.includes('5题录'),null,{timeout:150000});await slide().locator('markdown-lab .cm-editor').waitFor();assert.match(await slide().locator('markdown-lab').evaluate(el=>el.getText()),/Persisted source note/);check('Independent Markdown draft survives reload');
 await go('D12');await slide().getByRole('button',{name:'查看样式与语言',exact:true}).click();await page.waitForFunction(()=>document.querySelector('csl-renderer .w12-rendered')?.textContent.includes('Researcher Test'),null,{timeout:30000});check('Native CSL renderer accepts edited metadata');
 await go('D06');await slide().getByLabel('工具页面').selectOption('processing');await page.getByLabel('导入题名',{exact:true}).fill('Imported PDF');await page.getByLabel('导入作者',{exact:true}).fill('Researcher Test');await page.getByLabel('导入PDF文件',{exact:true}).setInputFiles('artifacts/tool-import.pdf');await page.waitForFunction(()=>document.querySelector('pdf-importer [role=status]')?.textContent.includes('已保存 1 份PDF'),null,{timeout:120000});assert.match(await page.locator('.lib-status').textContent(),/5题录.*5份PDF.*356页/);assert.match(await page.locator('pdf-importer [role=status]').textContent(),/保留3页/);check('Duplicate PDF reuses native identity and preserves existing pages');
 await go('D27');const backup=page.waitForEvent('download');await slide().getByRole('button',{name:'ZIP备份 → 独立空库恢复 → 校验',exact:true}).click();await(await backup).saveAs('artifacts/workbench-backup.zip');await slide().getByRole('status').filter({hasText:'核验通过'}).waitFor();check('ZIP backup restores into an independent library and verifies assets');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出 SQLite',exact:true}).click();await(await download).saveAs('artifacts/workbench-export.sqlite');
 const native=spawnSync('dotnet',['run','--project','native-probe','--','artifacts/workbench-export.sqlite'],{encoding:'utf8',maxBuffer:20*1024*1024});assert.equal(native.status,0,native.stderr);await fs.writeFile('artifacts/workbench-native-validation.json',native.stdout);const data=spawnSync('python',['-c',"import sqlite3,json;c=sqlite3.connect('artifacts/workbench-export.sqlite');assert c.execute('select count(*) from library_setting_records').fetchone()[0]==0;assert not any('x-pku-research' in json.loads(r[0]) for r in c.execute('select custom_fields_json from items'))"],{encoding:'utf8'});assert.equal(data.status,0,data.stderr);check('Desktop validator accepts imported PDF revisions; standalone notes add no research custom fields');
 for(let i=0;i<31;i++){const id='D'+String(i).padStart(2,'0');await go(id);if(id==='D29')await page.waitForTimeout(650);const metrics=await page.locator(`deck-slide[slide-id=${id}] .slide-body`).evaluate(el=>({height:el.clientHeight,overflow:el.scrollHeight-el.clientHeight}));assert(metrics.height>50&&metrics.overflow<3,id+' layout '+JSON.stringify(metrics));await page.screenshot({path:`artifacts/tool-${id}.png`});assert.equal(await slide().getByRole('button',{name:'讲解标注',exact:true}).count(),0);}
 check('All 31 pages open without outer overflow or annotation controls');assert.deepEqual(errors,[]);
}finally{await page.screenshot({path:'artifacts/workbench-last-state.png'}).catch(()=>{});await fs.writeFile('artifacts/workbench-report.json',JSON.stringify({date:new Date().toISOString(),url,checks,errors},null,2));await browser.close();}
