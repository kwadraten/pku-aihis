import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1600,height:900}}),page=await context.newPage(),errors=[];
page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
const root=page.locator('deck-slide[slide-id=D04] metadata-split');
await fs.mkdir('artifacts',{recursive:true});
const loadedPdf=()=>page.waitForFunction(()=>{const canvas=document.querySelector('deck-slide[slide-id=D04] .reader-original canvas');return canvas?.width>300&&canvas?.height>300&&canvas.closest('.reader-original').getAttribute('data-pdf-ready')==='true';});
try {
 await page.goto((process.env.WEEK04_URL||'http://127.0.0.1:8774/week04/')+'#D04');
 await page.waitForFunction(()=>document.querySelector('.lib-status')?.textContent.includes('4题录'),null,{timeout:150000});
 await root.getByRole('region',{name:'书库页',exact:true}).waitFor();
 assert.equal(await root.locator('.mds-layer').count(),3);assert.equal(await root.locator('.mds-entity').count(),0);
 for(const [width,height] of [[1600,900],[1366,768],[1920,1080]]){
  await page.setViewportSize({width,height});await page.screenshot({path:`artifacts/d04-layers-${width}.png`});
  const layout=await root.evaluate(root=>{const layers=[...root.querySelectorAll('.mds-layer')].map(x=>x.getBoundingClientRect()),body=root.closest('.slide-body').getBoundingClientRect(),bottom=root.querySelector('.mds-layer-counts').getBoundingClientRect().bottom;return {ordered:layers[0].bottom<layers[1].top&&layers[1].bottom<layers[2].top,fits:bottom<=body.bottom+2,horizontal:root.scrollWidth>root.clientWidth};});
  assert(layout.ordered&&layout.fits&&!layout.horizontal,JSON.stringify({width,height,...layout}));
 }
 await page.setViewportSize({width:1600,height:900});
 const searchLayer=root.getByRole('button',{name:'正文检索层：检索',exact:true});await searchLayer.focus();await page.keyboard.press('Enter');
 const search=root.getByRole('region',{name:'检索页',exact:true});await search.waitFor();
 await search.getByLabel('全文检索',{exact:true}).fill('subaltern');await search.getByRole('button',{name:'检索',exact:true}).click();await search.locator('.work-hit').first().waitFor();
 const count=await search.locator('.work-hit').count(),uri=await search.locator('.work-hit small').first().innerText();
 await page.screenshot({path:'artifacts/d04-search.png'});
 await search.locator('.work-hit').first().click();await root.getByRole('region',{name:'PDF工作台阅读模式',exact:true}).waitFor();await loadedPdf();
 const pageUri=new URL(await root.locator('.reader-uri').innerText()),hitUri=new URL(uri);assert.equal(pageUri.pathname,hitUri.pathname);assert.equal(pageUri.searchParams.get('rev'),hitUri.searchParams.get('rev'));assert.equal(context.pages().length,1);
 await root.getByRole('button',{name:'返回上一界面',exact:true}).click();await search.waitFor();
 assert.equal(await search.getByLabel('全文检索',{exact:true}).inputValue(),'subaltern');assert.equal(await search.locator('.work-hit').count(),count);
 await root.getByRole('button',{name:'附件层：PDF工作台',exact:true}).click();await root.getByRole('region',{name:'PDF工作台阅读模式',exact:true}).waitFor();await loadedPdf();
 await page.keyboard.press('Escape');await search.waitFor();assert.equal(new URL(page.url()).hash,'#D04');assert.equal(await search.getByLabel('全文检索',{exact:true}).inputValue(),'subaltern');
 await root.getByRole('button',{name:'题录层：书库',exact:true}).click();const library=root.getByRole('region',{name:'书库页',exact:true});await library.waitFor();
 await root.getByLabel('筛选题录',{exact:true}).fill('貨幣');await library.locator('.grid-title').filter({hasText:'貨幣'}).waitFor();
 await library.locator('.grid-title').filter({hasText:'貨幣'}).click();
 await root.getByRole('button',{name:'附件层：PDF工作台',exact:true}).click();await root.getByRole('region',{name:'PDF工作台阅读模式',exact:true}).waitFor();await loadedPdf();
 await root.getByRole('button',{name:'返回上一界面',exact:true}).click();await library.waitFor();assert.equal(await root.getByLabel('筛选题录',{exact:true}).inputValue(),'貨幣');
 await page.evaluate(()=>location.hash='D05');await page.locator('deck-slide[slide-id=D05] input[aria-label="题名"]').waitFor();await page.waitForFunction(()=>document.querySelector('deck-slide[slide-id=D05] input[aria-label="题名"]')?.value.includes('貨幣'));
 assert.deepEqual(errors,[]);
 console.log('D04 three-layer 3D navigation, projection layouts, real search, matched PDF page, return sessions, keyboard and D05 selection passed');
}catch(error){await page.screenshot({path:'artifacts/d04-failure.png'});throw error;}
finally {await context.close();await browser.close();}
