import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { CARD_SOURCES, SEED_CARDS, noteUri } from '../src/lib/card-box.ts';

const native = new DatabaseSync('src/assets/seed/native-library.sqlite', { readOnly: true });
for (const source of CARD_SOURCES) {
 const uri=new URL(source.uri),[,doc,page]=uri.pathname.match(/^\/([^/]+)\/page-(\d+)\.md$/);
 const row=native.prepare('select s.resolved_text from search_units s join pages p on p.page_id=s.page_id where s.document_instance_id=? and p.page_index=? and s.tree_revision_id=? and s.box_id=?').get(doc,Number(page)-1,uri.searchParams.get('rev'),uri.searchParams.get('box'));
 assert(row?.resolved_text.trim(), 'Missing source '+source.label);
}
native.close();assert.equal(new Set(SEED_CARDS.map(card=>card.id)).size,6);
assert(SEED_CARDS.every(card=>card.title.endsWith('？')&&card.citations.every(c=>c.reason.trim())));
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1366,height:768},acceptDownloads:true}),page=await context.newPage(),errors=[];
page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));await fs.mkdir('artifacts',{recursive:true});
const root=page.locator('deck-slide[slide-id=D21] zettel-lab');
const settled=()=>root.locator('.cb-paper.cb-card').waitFor();
const take=async index=>{await root.locator('.cb-slip strong').nth(index).click();await settled();};
const putBack=async()=>{await root.getByRole('button',{name:'把卡片放回卡片盒',exact:true}).click();await root.locator('.cb-paper').waitFor({state:'detached'});};
async function snapshot(name){const pending=page.waitForEvent('download');await page.getByRole('button',{name:'导出 SQLite',exact:true}).click();const file=await pending;await file.saveAs(`artifacts/d21-${name}.sqlite`);return await fs.readFile(`artifacts/d21-${name}.sqlite`);}
try {
 await page.goto((process.env.WEEK04_URL||'http://127.0.0.1:8774/week04/')+'#D21');
 await root.locator('.cb-slip').first().waitFor();await page.waitForFunction(()=>document.querySelector('.lib-status')?.textContent.includes('4题录'),null,{timeout:150000});
 assert.equal(await root.locator('.cb-slip').count(),6);assert.equal(await root.locator('.mds-app-bar').count(),0);
 const before=await snapshot('before');
 for (const [width,height] of [[1366,768],[1600,900],[1920,1080]]) {
  await page.setViewportSize({width,height});
  const fits=await root.evaluate(root=>{const body=root.closest('.slide-body').getBoundingClientRect(),desk=root.querySelector('.cb-desk').getBoundingClientRect(),nodes=[...root.querySelectorAll('.mds-concept-node')].map(node=>node.getBoundingClientRect());return desk.top>=body.top&&desk.bottom<=body.bottom+1&&nodes.every(node=>node.top>=body.top&&node.bottom<=body.bottom)&&root.scrollWidth<=root.clientWidth;});assert(fits,'Layout '+width);await page.screenshot({path:`artifacts/d21-box-${width}.png`});
 }
 await page.setViewportSize({width:1366,height:768});
 for(let index=0;index<6;index++){
  await take(index);assert.equal(await root.locator('.cb-paper').getAttribute('data-note-uri'),noteUri(SEED_CARDS[index].id));assert.equal(await root.locator('.cb-paper-scroll > h2').innerText(),SEED_CARDS[index].title);
  assert.equal(await root.locator('.cb-citations a').getAttribute('href'),SEED_CARDS[index].citations[0].uri);assert(!(await root.locator('.cb-markdown').first().innerText()).includes('**'));
  if(index===0){
   for(const [label,part] of [['固定地址','address'],['选择性引用','question'],['明确理由','reason']]){await root.getByRole('button',{name:'查看'+label,exact:true}).click();await root.locator(`[data-card-part=${part}] mark`).waitFor();assert.equal(await root.locator(`[data-card-part=${part}] mark`).count(),1);assert.equal(await root.locator('.cb-marker').count(),1);}
   const unchanged=await root.locator('.cb-paper').innerHTML();await root.getByRole('button',{name:'查看意外关联',exact:true}).click();assert.equal(await root.locator('.cb-paper').innerHTML(),unchanged);
   await page.screenshot({path:'artifacts/d21-highlight-reason.png'});
   const paperUri=await root.locator('.cb-paper').getAttribute('data-note-uri'),desk=await root.locator('.cb-desk').boundingBox();
   await root.locator('.cb-citations a').click();await root.getByRole('region',{name:'卡片出处阅读模式'}).waitFor();await root.locator('[data-pdf-ready=true]').waitFor();
   assert.equal(await root.locator('pdf-reader').evaluate(reader=>reader.pageNumber),8);const source=await root.locator('.cb-source').boundingBox();assert(source.width<=desk.width+1);assert.equal(context.pages().length,1);await page.screenshot({path:'artifacts/d21-source.png'});
   await root.getByRole('button',{name:'返回当前卡片',exact:true}).click();assert.equal(await root.locator('.cb-paper').getAttribute('data-note-uri'),paperUri);assert.equal(await root.locator('[data-card-part=reason] mark').count(),1);
  }
  if(index===1){await root.getByRole('link',{name:'材料可见与个人发声的区别',exact:true}).click();await page.waitForFunction(()=>document.querySelector('deck-slide[slide-id=D21] .cb-paper.cb-card')?.getAttribute('data-note-uri')==='patchouli://notes/812cfe38-9d7e-4b76-95b4-dc7c108abc01.md');}
  await putBack();
 }
 await root.getByRole('button',{name:'查看选择性引用',exact:true}).focus();await page.keyboard.press('Enter');await root.locator('[data-card-part=question] mark').waitFor();assert.equal(await root.locator('[data-card-part=question] mark').count(),1);await page.keyboard.press('Escape');await root.locator('.cb-paper').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>location.hash),'#D21');
 await root.getByRole('button',{name:/创建卡片/}).click();await settled();const canceled=await root.locator('.cb-paper').getAttribute('data-note-uri');await root.getByRole('button',{name:'取消',exact:true}).click();await root.locator('.cb-burning').waitFor();assert.equal(await root.locator('.cb-embers i').count(),14);await page.waitForFunction(()=>document.querySelector('.cb-burning')?.getAnimations().some(animation=>animation.animationName==='cb-burn'&&animation.currentTime>450));await page.screenshot({path:'artifacts/d21-burn.png'});await root.locator('.cb-paper').waitFor({state:'detached'});assert.equal(await root.locator('.cb-slip').count(),6);assert(!(await page.evaluate(()=>localStorage.getItem('week04-cardbox-v1')||'')).includes(canceled));
 await root.getByRole('button',{name:/创建卡片/}).click();await settled();const fresh=await root.locator('.cb-paper').getAttribute('data-note-uri');
 await root.getByRole('button',{name:'放入卡片盒',exact:true}).click();await root.locator('.cb-error').filter({hasText:'问题作标题'}).waitFor();
 await root.getByLabel('卡片问题',{exact:true}).fill('技术被采用以后，地方经验怎样保留下来？');
 await root.getByLabel('卡片Markdown内容',{exact:true}).fill('## 我的判断\n\n先检查 **具体行动者**。\n\n- 记录实施者\n- 比较实践\n\n<script>window.cardInjected=true</script>');
 await root.getByLabel('选择卡片引用材料',{exact:true}).selectOption(CARD_SOURCES[2].uri);await root.getByLabel('卡片引用理由',{exact:true}).fill('这段材料列出了保留与结合地方经验的行动者，直接回应我的问题。');
 await root.getByRole('button',{name:'查看卡片',exact:true}).click();await root.locator('.cb-markdown strong').filter({hasText:'具体行动者'}).waitFor();assert.equal(await root.locator('.cb-markdown strong').filter({hasText:'具体行动者'}).count(),1);assert.equal(await root.locator('.cb-markdown li').count(),2);assert.equal(await page.evaluate(()=>window.cardInjected),undefined);await page.screenshot({path:'artifacts/d21-new-card.png'});
 await root.getByRole('button',{name:'继续书写',exact:true}).click();await root.getByLabel('卡片引用VFS',{exact:true}).fill(CARD_SOURCES[2].uri.replace(/box=.*/, 'box=00000000-0000-0000-0000-000000000000'));await root.getByRole('button',{name:'放入卡片盒',exact:true}).click();await root.locator('.cb-error').waitFor();assert.equal(await root.locator('.cb-slip').count(),6);
 await root.getByLabel('卡片引用VFS',{exact:true}).fill(CARD_SOURCES[2].uri);await root.getByRole('button',{name:'放入卡片盒',exact:true}).click();await root.locator('.cb-paper').waitFor({state:'detached'});assert.equal(await root.locator('.cb-slip').count(),7);
 await take(6);assert.equal(await root.locator('.cb-paper').getAttribute('data-note-uri'),fresh);
 const pending=page.waitForEvent('download');await root.getByRole('button',{name:'下载 Markdown',exact:true}).click();const file=await pending;await file.saveAs('artifacts/d21-created.md');const markdown=await fs.readFile('artifacts/d21-created.md','utf8');assert(markdown.startsWith('# 技术'));assert(markdown.includes(fresh)&&markdown.includes(CARD_SOURCES[2].uri)&&markdown.includes('**引用理由**'));
 await putBack();assert.deepEqual(await snapshot('after'),before,'Card actions changed SQLite bytes');
 await page.reload();await root.locator('.cb-slip').first().waitFor();assert.equal(await root.locator('.cb-slip').count(),7);await take(6);assert.equal(await root.locator('.cb-paper').getAttribute('data-note-uri'),fresh);await putBack();
 await page.emulateMedia({reducedMotion:'reduce'});await take(0);await putBack();
 assert.equal(await page.locator('tool-explainer,.te-trigger,.te-overlay,.te-callout').count(),0);assert.deepEqual(errors,[]);
 console.log('D21 passed: six verified VFS cards, 3D take/return/burn, Markdown and safe rendering, highlights/no-op, inline PDF return, validated creation, stable local addresses, unchanged SQLite, 3 sizes and keyboard/reduced-motion');
}catch(error){console.log('Page errors',errors);console.log('Reader state',await root.locator('patchouli-app').evaluateAll(nodes=>nodes.map(n=>({active:n.active,request:n.request,html:n.innerHTML.slice(0,400)}))));await page.screenshot({path:'artifacts/d21-failure.png'});throw error;}finally{await context.close();await browser.close();}
