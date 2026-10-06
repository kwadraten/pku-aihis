import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {pageFromSlide,PATCHOULI_PAGES} from '../src/lib/patchouli-pages.ts';
import { CONCEPT_NAVIGATION } from '../src/lib/concept-navigation.ts';
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1366,height:768}}),page=await context.newPage(),errors=[];
page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));await fs.mkdir('artifacts',{recursive:true});
try {
 await page.goto((process.env.WEEK04_URL||'http://127.0.0.1:8774/week04/')+'#D04');await page.waitForFunction(()=>document.querySelector('.lib-status')?.textContent.includes('4题录'),null,{timeout:150000});
 const library=page.locator('deck-slide[slide-id=D04]');
 await library.locator('library-treegrid th button').first().waitFor();
 assert.deepEqual(await library.locator('library-treegrid th button').allInnerTexts(),['题录类型','年份','作者','标题','来源','OCR/索引状态','页数','关联文件']);
 assert.equal(await library.getByRole('treegrid',{name:'文献书库列表'}).getAttribute('aria-colcount'),'8');
 await library.locator('.library-expander').first().click();await library.locator('tr[aria-level="2"]').first().waitFor();assert.equal(await library.locator('tr[aria-level="2"] td').first().innerText(),'PDF');
 await library.locator('th[data-column=year] button').click();await library.locator('th[data-column=year][aria-sort=ascending]').waitFor();
 await page.screenshot({path:'artifacts/d04-complete-treegrid.png'});
 for(const [id,config] of Object.entries(CONCEPT_NAVIGATION)){
  await page.evaluate(id=>location.hash=id,id);const root=page.locator(`deck-slide[slide-id=${id}] metadata-split`);await root.locator('.mds-concept-diagram').waitFor();
  assert.equal(await root.locator('.mds-concept-node').count(),config.nodes.length);assert.equal(await root.locator('patchouli-app').count(),1);assert.equal(await root.getByRole('navigation',{name:'Patchouli应用导航'}).getByRole('img',{name:'Patchouli',exact:true}).count(),1);assert.equal(await root.locator('.mds-app-status').count(),1);assert.equal(await root.locator('.workbench-status,.work-state-strip').count(),0);
  const pane=await root.locator('.mds-app-pane').boundingBox();
  for(const node of config.nodes){
   await root.getByRole('button',{name:'查看'+node.label,exact:true}).click();
   if(id==='D11'&&node.label==='衍生说明'){await root.locator('markdown-lab .cm-editor').waitFor();assert.equal(await root.locator('concept-map').count(),1);continue;}if(node.target==='panel'&&['D10','D16','D17','D18','D19','D20','D21','D22','D23','D24','D25','D27','D28'].includes(node.page)){await page.waitForFunction(target=>location.hash==='#'+target,node.page);assert.equal(await page.locator('deck-slide[slide-id='+node.page+'] patchouli-app').count(),0);await page.evaluate(id=>location.hash=id,id);await root.locator('.mds-concept-diagram').waitFor();continue;}if(node.target==='panel'){await root.getByRole('region',{name:'Patchouli操作界面',exact:true}).waitFor();await page.waitForFunction(({id,target})=>document.querySelector(`deck-slide[slide-id=${id}] patchouli-app .patchouli-app`)?.getAttribute('data-page')===target,{id,target:(node.label==='集合'?'collections':node.label==='主题标签'?'tags':pageFromSlide(node.page))});assert.equal(await root.locator('.mds-editor-header h2').innerText(),PATCHOULI_PAGES[node.label==='集合'?'collections':node.label==='主题标签'?'tags':pageFromSlide(node.page)]);}
   if(id==='D26'&&node.label==='提取与识别')await root.getByRole('dialog',{name:'确认当前文献OCR'}).getByRole('button',{name:'取消',exact:true}).click();if(id==='D20'&&['原话','释义','推断','机器候选'].includes(node.label))await page.waitForFunction(label=>document.querySelector('deck-slide[slide-id=D20] select[aria-label="笔记成分"]')?.value===label,node.label);
   if(node.target==='editor')await root.locator('.mds-editor-header h2').filter({hasText:'编辑题录'}).waitFor();
   if(node.target==='attachments')await root.locator('.mds-editor-header h2').filter({hasText:'文件关联'}).waitFor();
   if(node.target==='library')await root.getByRole('region',{name:'书库页',exact:true}).waitFor();
   if(node.target==='search')await root.getByRole('region',{name:'检索页',exact:true}).waitFor();
   if(node.target==='reader'){
    await root.getByRole('region',{name:'PDF工作台阅读模式',exact:true}).waitFor();
    const reader=await root.locator('.mds-pdf-workspace').boundingBox();assert(reader.width<=pane.width+1);assert.equal(await root.locator('.mds-concept-diagram').count(),1);
    assert.equal(context.pages().length,1);if(id==='D26'&&node.label==='校对修订'){await root.getByRole('button',{name:'取消编辑',exact:true}).waitFor();await root.getByRole('button',{name:'取消编辑',exact:true}).click();}
   }
  }
  const layout=await root.evaluate(root=>{const graph=root.querySelector('.mds-concept-diagram').getBoundingClientRect(),nodes=[...root.querySelectorAll('.mds-concept-node')].map(node=>node.getBoundingClientRect()),body=root.closest('.slide-body').getBoundingClientRect(),summary=root.querySelector('.mds-layer-current').getBoundingClientRect();return {overlap:nodes.some((a,index)=>nodes.slice(index+1).some(b=>Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top))),fits:nodes.every(node=>node.top>=graph.top-2&&node.bottom<=graph.bottom+2)&&summary.bottom<=body.bottom+2,horizontal:root.scrollWidth>root.clientWidth};});
  assert(!layout.overlap&&layout.fits&&!layout.horizontal,id+' '+JSON.stringify(layout));await page.screenshot({path:`artifacts/concept-${id}.png`});console.log(id,config.kind,config.nodes.length,'nodes passed');
 }
 assert.deepEqual(errors,[]);console.log('All concept pages use one Patchouli application, real target panels and the same PDF pane; full TreeGrid columns passed');
}catch(error){await page.screenshot({path:'artifacts/concept-failure.png'});throw error;}finally{await context.close();await browser.close();}
