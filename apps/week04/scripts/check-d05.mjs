import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';

const url=process.env.WEEK04_URL||'http://127.0.0.1:8774/week04/';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1600,height:900},acceptDownloads:true});
const page=await context.newPage(),errors=[];
page.setDefaultTimeout(15000);
page.on('pageerror',e=>errors.push(e.message));
await fs.mkdir('artifacts',{recursive:true});
const slide=page.locator('deck-slide[slide-id="D05"]');
const editor=slide.locator('metadata-split');
const waitSaved=async()=>{await editor.locator('.mds-feedback').filter({hasText:'题录已保存'}).waitFor();};
const waitTitle=title=>page.waitForFunction(title=>document.querySelector('metadata-split input[aria-label="题名"]')?.value===title,title);
async function dbCopy(name){
 const pending=page.waitForEvent('download');
 await page.getByRole('button',{name:'导出 SQLite',exact:true}).click();
 const file=await pending;const target=`artifacts/d05-${name}.sqlite`;await file.saveAs(target);
 return new DatabaseSync(target,{readOnly:true});
}
try {
 await page.goto(url+'#D05');
 await page.waitForFunction(()=>document.querySelector('.lib-status')?.textContent.includes('4题录'),null,{timeout:150000});
 await editor.getByRole('button',{name:'查看条目',exact:true}).waitFor();
 assert.equal(await editor.locator('.mds-entity').count(),4);
 assert.equal(await editor.locator('canvas').count(),0);
 assert(!await editor.innerText().then(t=>/概念关系示意|实际四张|不能将|教学构造/.test(t)));
 await page.screenshot({path:'artifacts/d05-1600.png'});
 for(const title of ['条目','字段','元数据','附件']){
  const button=editor.getByRole('button',{name:'查看'+title,exact:true});
  await button.focus();await page.keyboard.press('Enter');
  await page.waitForFunction(label=>document.querySelector(`metadata-split button[aria-label="${label}"]`)?.getAttribute('aria-pressed')==='true','查看'+title);
  assert.equal(await button.getAttribute('aria-pressed'),'true');
  if(title==='条目')await editor.getByRole('region',{name:'书库页',exact:true}).waitFor();
  if(title==='字段'||title==='元数据')await editor.locator('.mds-editor-header h2').filter({hasText:'编辑题录'}).waitFor();
  if(title==='附件')await editor.locator('.mds-editor-header h2').filter({hasText:'文件关联'}).waitFor();
 }
 assert.equal(await editor.locator('.mds-nav button[aria-current=true]').innerText(),'文件关联');
 await editor.getByRole('button',{name:'字段：题名',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('metadata-split [data-field=title]')?.classList.contains('is-highlighted'));
 assert.equal(await editor.locator('[data-field=title]').getAttribute('class'),'mds-field is-highlighted');
 await editor.getByLabel('题名',{exact:true}).focus();
 await page.waitForFunction(()=>document.querySelector('metadata-split button[aria-label="查看元数据"]')?.getAttribute('aria-pressed')==='true');
 assert.equal(await editor.getByRole('button',{name:'查看元数据',exact:true}).getAttribute('aria-pressed'),'true');
 const initial=await editor.locator('patchouli-app').evaluate(app=>app.getState());const id=initial.item.item_id;
 const originalTitle=await editor.getByLabel('题名',{exact:true}).inputValue();
 const originalDate=await editor.getByLabel('出版日期',{exact:true}).inputValue();
 assert.equal(await editor.getByLabel('当前题录',{exact:true}).count(),0);const ids=initial.items.map(item=>item.item_id);const switchItem=async itemId=>{await editor.getByRole('button',{name:'书库',exact:true}).click();await editor.locator('library-treegrid').waitFor();await editor.locator('tr[data-item="'+itemId+'"] .grid-title').click();await editor.getByRole('button',{name:'编辑题录',exact:true}).click();};
 console.log('D05 entity keyboard and field linkage passed',id);
 await editor.getByLabel('题名',{exact:true}).fill(originalTitle+' D05草稿');
 const other=ids.find(i=>i!==id),otherTitle=initial.items.find(item=>item.item_id===other).title;
 await switchItem(other);await waitTitle(otherTitle);
 await switchItem(id);
 await waitTitle(originalTitle+' D05草稿');
 assert.equal(await editor.getByLabel('题名',{exact:true}).inputValue(),originalTitle+' D05草稿');
 await editor.getByRole('button',{name:'放弃更改',exact:true}).click();
 await waitTitle(originalTitle);
 assert.equal(await editor.getByLabel('题名',{exact:true}).inputValue(),originalTitle);
 console.log('D05 draft switch and discard passed');
 const before=await dbCopy('before');
 const preserved={
  creators:before.prepare('select * from item_creators where item_id=? order by sequence_index').all(id),
  dates:before.prepare('select * from item_dates where item_id=? order by date_id').all(id),
  identifiers:before.prepare('select * from item_identifiers where item_id=?').all(id),
  documents:before.prepare('select * from document_instances where item_id=?').all(id),
  item:before.prepare('select * from items where item_id=?').get(id),
 };before.close();
 await editor.getByLabel('题名',{exact:true}).fill(originalTitle+' D05验证');
 await editor.getByRole('button',{name:'保存题录',exact:true}).click();await waitSaved();
 const after=await dbCopy('title');
 for(const [table,key,order] of [['item_creators','creators',' order by sequence_index'],['item_dates','dates',' order by date_id'],['item_identifiers','identifiers',''],['document_instances','documents','']])assert.deepEqual(after.prepare(`select * from ${table} where item_id=?${order}`).all(id),preserved[key]);
 assert.equal(after.prepare('select title from items where item_id=?').get(id).title,originalTitle+' D05验证');
 after.close();
 await page.reload();await editor.getByLabel('题名',{exact:true}).waitFor();
 assert.equal(await editor.getByLabel('题名',{exact:true}).inputValue(),originalTitle+' D05验证');
 await editor.getByLabel('题名',{exact:true}).fill(originalTitle+' 无效日期');
 await editor.getByLabel('出版日期',{exact:true}).fill('2026-02-30');
 await editor.getByRole('button',{name:'保存题录',exact:true}).click();
 await editor.locator('.mds-feedback.is-error').waitFor();
 const invalid=await dbCopy('invalid');
 assert.equal(invalid.prepare('select title from items where item_id=?').get(id).title,originalTitle+' D05验证');invalid.close();
 await editor.getByRole('button',{name:'放弃更改',exact:true}).click();
 const creatorIndex=(await editor.locator('.mds-creator').count())+1;
 await editor.getByRole('button',{name:'添加作者／贡献者',exact:true}).click();
 await page.waitForFunction(n=>document.querySelectorAll('metadata-split .mds-creator').length===n,creatorIndex);
 await editor.getByLabel(`责任者${creatorIndex}姓名`,{exact:true}).fill('D05测试译者');
 await editor.getByLabel(`责任者${creatorIndex}角色`,{exact:true}).selectOption('translator');
 await editor.getByLabel('出版日期',{exact:true}).fill('2026-10');
 await editor.getByRole('button',{name:'保存题录',exact:true}).click();await waitSaved();
 const changed=await dbCopy('creators');
 assert.equal(changed.prepare("select literal from item_creators where item_id=? and role='translator' and literal='D05测试译者'").get(id).literal,'D05测试译者');
 for(const creator of preserved.creators)assert.deepEqual(changed.prepare('select * from item_creators where creator_id=?').get(creator.creator_id),creator);
 assert.deepEqual(JSON.parse(changed.prepare("select date_parts_json from item_dates where item_id=? and role='issued'").get(id).date_parts_json),[[2026,10]]);
 assert.equal(changed.prepare('pragma foreign_key_check').all().length,0);changed.close();
 await page.reload();await editor.getByLabel('出版日期',{exact:true}).waitFor();assert.equal(await editor.getByLabel('出版日期',{exact:true}).inputValue(),'2026-10');
 // Leave this isolated browser with the original sample metadata.
 const translatorIndex=await editor.locator('.mds-creator').evaluateAll(rows=>rows.findIndex(row=>row.querySelector('input')?.value==='D05测试译者'));
 assert(translatorIndex>=0);await editor.locator('.mds-creator').nth(translatorIndex).getByRole('button',{name:/移除责任者/}).click();
 await editor.getByLabel('题名',{exact:true}).fill(originalTitle);
 await editor.getByLabel('出版日期',{exact:true}).fill(originalDate);
 await editor.getByRole('button',{name:'保存题录',exact:true}).click();await waitSaved();
 const restored=await dbCopy('restored');assert.deepEqual(restored.prepare('select * from item_creators where item_id=? order by sequence_index').all(id),preserved.creators);restored.close();
 for(const [width,height] of [[1600,900],[1366,768],[1920,1080]]){
  await page.setViewportSize({width,height});
  await editor.getByRole('button',{name:'查看元数据',exact:true}).click();
  await page.screenshot({path:`artifacts/d05-${width}.png`});
  const layout=await editor.evaluate(el=>{
   const nodes=[...el.querySelectorAll('.mds-entity')].map(x=>x.getBoundingClientRect());
   const overlaps=nodes.flatMap((a,i)=>nodes.slice(i+1).filter(b=>Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)));
   const body=el.closest('.slide-body');const b=body.getBoundingClientRect();const takeaway=el.querySelector('.mds-takeaway').getBoundingClientRect();
   return {overlaps:overlaps.length,bottom:takeaway.bottom,available:b.bottom,horizontal:el.scrollWidth>el.clientWidth};
  });
  console.log('LAYOUT',width,height,layout);
  assert.equal(layout.overlaps,0,'entity nodes overlap');assert(!layout.horizontal,'horizontal overflow');assert(layout.bottom<=layout.available+2,'takeaway falls below slide body');
 }
 await editor.getByLabel('题名',{exact:true}).fill(originalTitle+' 阅读前草稿');
 await editor.getByRole('button',{name:'查看附件',exact:true}).click();
 await editor.locator('.mds-editor-header h2').filter({hasText:'文件关联'}).waitFor();
 await editor.getByRole('button',{name:'查看原件',exact:true}).first().click();
 await editor.getByRole('region',{name:'PDF工作台阅读模式',exact:true}).waitFor();
 await page.waitForFunction(()=>{const canvas=document.querySelector('metadata-split .reader-original canvas');return canvas?.width>300&&canvas?.height>300&&canvas.closest('.reader-original').getAttribute('data-pdf-ready')==='true';});
 assert.equal(context.pages().length,1);assert.equal(await editor.locator('a[target="_blank"]').count(),0);
 const firstPage=await editor.locator('.reader-original canvas').evaluate(canvas=>canvas.toDataURL());
 await page.screenshot({path:'artifacts/d05-pdf-workspace.png'});
 await editor.getByRole('navigation',{name:'PDF翻页',exact:true}).getByRole('button',{name:'下一页',exact:true}).click();
 await page.waitForFunction(first=>document.querySelector('metadata-split .reader-uri')?.textContent.includes('page-2.md')&&document.querySelector('metadata-split .reader-original canvas')?.toDataURL()!==first&&document.querySelector('metadata-split .reader-original')?.getAttribute('data-pdf-ready')==='true',firstPage);
 assert.equal(await editor.getByLabel('阅读页码',{exact:true}).inputValue(),'2');
 await page.keyboard.press('ArrowLeft');await page.waitForFunction(()=>document.querySelector('metadata-split input[aria-label="阅读页码"]')?.value==='1');assert.equal(new URL(page.url()).hash,'#D05');
 await editor.getByRole('button',{name:'返回上一界面',exact:true}).click();
 await editor.locator('.mds-editor-header h2').filter({hasText:'文件关联'}).waitFor();
 assert.equal(await editor.locator('.mds-pdf-workspace').count(),0);
 await editor.getByRole('button',{name:'查看元数据',exact:true}).click();await waitTitle(originalTitle+' 阅读前草稿');
 await editor.getByRole('button',{name:'放弃更改',exact:true}).click();await waitTitle(originalTitle);
 await editor.getByRole('button',{name:'查看条目',exact:true}).click();
 const library=editor.getByRole('region',{name:'书库页',exact:true});await library.waitFor();
 const last=library.locator('.work-table tbody tr').last(),chosen=await last.locator('[data-column=title] .grid-title').innerText();
 await last.locator('.grid-title').click();
 await editor.getByRole('button',{name:'查看元数据',exact:true}).click();await waitTitle(chosen);
 console.log('D05 library/editor/attachment routes, inline PDF paging, return and retained drafts passed');
 await page.evaluate(()=>location.hash='D04');await page.locator('deck-slide[slide-id=D04] .work-table tbody tr').first().waitFor();
 const selected=await page.locator('deck-slide[slide-id=D04] .work-table tbody tr').last().locator('[data-column=title] .grid-title').innerText();
 await page.locator('deck-slide[slide-id=D04] .work-table tbody tr').last().locator('[data-column=title] .grid-title').click();
 await page.evaluate(()=>location.hash='D05');await waitTitle(selected);assert(selected.startsWith(await editor.getByLabel('题名',{exact:true}).inputValue()));
 await page.evaluate(()=>location.hash='D06');await page.locator('deck-slide[slide-id=D06] .mds-concept-diagram').waitFor();
 assert.deepEqual(errors,[]);
 console.log('D05 entities, keyboard, drafts, atomic save, preserved IDs, dates, reload, layouts and shared selection passed');
} catch(error) { console.log('FAILED_STATE',await editor.evaluate(el=>({selection:el.querySelector('select[aria-label="当前题录"]')?.value,title:el.querySelector('input[aria-label="题名"]')?.value,status:el.querySelector('.mds-feedback')?.textContent})));await page.screenshot({path:'artifacts/d05-failure.png'});throw error; }
finally { await context.close();await browser.close(); }
