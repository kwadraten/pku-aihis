import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('src/index.html','utf8');assert(!source.includes('tool-explainer'));assert.equal([...source.matchAll(/<deck-slide slide-id=/g)].length,31);
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1366,height:768}}),page=await context.newPage();
try {
 await page.goto((process.env.WEEK04_URL||'http://127.0.0.1:8774/week04/')+'#D04');await page.waitForFunction(()=>document.querySelector('.lib-status')?.textContent.includes('4题录'),null,{timeout:150000});await page.locator('deck-slide[slide-id=D04] library-treegrid').waitFor();
 assert.equal(await page.locator('deck-slide').count(),31);assert.equal(await page.locator('tool-explainer,.te-trigger,.te-overlay,.te-callout').count(),0);
 assert.equal(await page.getByRole('button',{name:/讲解标注/}).count(),0);
 await fs.mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/d04-final-no-annotations.png'});
 console.log('All 31 slides have no annotation buttons or popup components; D04 TreeGrid and layer navigation remain');
}finally{await context.close();await browser.close();}
