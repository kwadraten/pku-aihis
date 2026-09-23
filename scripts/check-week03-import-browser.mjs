// Optional real-browser acceptance; local model assets must already be available.
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
const {values:v}=parseArgs({options:{url:{type:'string',default:'http://127.0.0.1:8767/week03/'},vectors:{type:'string'},output:{type:'string'},'forum-text':{type:'string'},'playwright-module':{type:'string',default:'playwright'},generation:{type:'boolean',default:false}}});
assert(v.vectors && v.output,'--vectors and --output are required');
const {chromium}=await import(v['playwright-module']);
const root=path.resolve(import.meta.dirname,'..'), corpus=path.join(root,'data/week03/cross-domain');
await fs.mkdir(v.output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({viewport:{width:1440,height:900}}), page=await context.newPage();
const report={checked_at:new Date().toISOString(),url:v.url,browser:await browser.version(),checks:[],errors:[],failed:[]};
page.on('pageerror',e=>report.errors.push(e.message));
page.on('response',r=>{if(r.status()>=400)report.failed.push({status:r.status(),url:r.url()});});
const hash=x=>createHash('sha256').update(x).digest('hex');
const read=async f=>JSON.parse(await fs.readFile(f,'utf8'));
const check=(name,details={})=>{report.checks.push({name,...details});console.log(name,JSON.stringify(details));};
const go=async id=>{await page.evaluate(id=>location.hash=id,id);const s=page.locator(`deck-slide[slide-id="${id}"]`);await s.waitFor({state:'visible'});return s;};
let docs=new Map();
async function importFile(file){
 const text=await fs.readFile(file,'utf8');let parsed;
 try{parsed=JSON.parse(text);}catch{parsed={records:text.split(/\r?\n/).filter(Boolean).map(JSON.parse)};}
 docs=new Map((parsed.records||parsed).map(d=>[d.id,d]));
 const s=await go('D01');await s.locator('input[type=file]').setInputFiles(file);
 await page.waitForFunction(count=>document.querySelector('deck-slide[slide-id="D01"] select[aria-label="选择史料片段"]').options.length===count,docs.size);
 assert((await s.innerText()).includes('本机导入'));
 assert.equal(await s.getByLabel('选择史料片段').locator('option').count(),docs.size);
 return s;
}
async function search(id,query,button){
 const s=await go(id);await s.getByLabel('检索问题').fill(query);
 const start=Date.now();await s.getByRole('button',{name:button,exact:true}).click();
 await page.waitForFunction(id=>{const s=document.querySelector(`deck-slide[slide-id="${id}"]`);return /已完成.*条候选/.test(s.textContent)||s.textContent.includes('Error:');},id,{timeout:120000});
 assert(!(await s.innerText()).includes('Error:'),(await s.innerText()).slice(0,2000));
 const count=await s.locator('.result').count();assert(count>0,`${id} returned no results for ${query}`);
 await s.locator('.result').first().click();
 const panel=s.locator('.source-evidence'), key=await panel.getAttribute('data-source-id'), d=docs.get(key);
 assert(d,`Stale or unknown result ${key}`);
 assert.equal(await panel.locator('.paper-text').textContent(),d.text);
 assert((await panel.innerText()).includes(d.locator||`PDF 第 ${d.pdf_page} 页`));
 if(d.source_url)assert.equal(await panel.getByRole('link',{name:'来源页面 ↗',exact:true}).getAttribute('href'),d.source_url);
 check(`${path.basename(currentFile)} ${id}`,{query,top_id:key,shown:count,elapsed_ms:Date.now()-start});
 return {s,panel,d};
}
let currentFile='';
try{
 await page.goto(v.url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelectorAll('lesson-lab.hydrated').length===33 && crossOriginIsolated);
 for(let i=0;i<33;i++){const s=await go('D'+String(i).padStart(2,'0'));assert(!/TypeError:|语料载入失败/.test(await s.innerText()));}
 check('33 pages and cross-origin isolation');
 const queries={'1606.07772v1':'emotional','1710.05832v1':'neutron','1906.11238v1':'M87','B01-INTRO':'Socrates','B01':'justice','B02':'selection','B03':'Rabbit','B04':'Sherlock','P01':'black hole','acm_3497842':'archaeology','plos_0323185':'radiocarbon'};
 const sources=await read(path.join(corpus,'sources.json'));
 for(const [name,q] of Object.entries(queries)){
  currentFile=path.join(corpus,'imports',name+'.jsonl');await importFile(currentFile);
  await search('D07',q,'BM25排序');
  const {panel,d}=await search('D11',q,'全文命中');
  const txt=await fs.readFile(path.join(corpus,d.text_file),'utf8');
  assert.equal(Array.from(txt).slice(d.start_char,d.end_char).join(''),d.text);
  const href=await panel.getByRole('link',{name:'打开本地核验原件 ↗',exact:true}).getAttribute('href');
  const response=await context.request.get(new URL(href,v.url).href);assert.equal(response.status(),200);
  const source=sources.find(s=>s.source_id===d.source_id);assert.equal(hash(await response.body()),source.raw_sha256);
  if(d.pdf_page)assert(href.endsWith('#page='+d.pdf_page));
  if(name==='B01'||name==='1906.11238v1'){
   await page.screenshot({path:path.join(v.output,name+'-source.png'),fullPage:true});
   const opened=context.waitForEvent('page');await panel.getByRole('link',{name:'打开本地核验原件 ↗',exact:true}).click();
   const original=await opened;await original.waitForURL(url=>url.pathname.startsWith('/api/corpus-source/'));await original.close();
  }
 }
 check('11 text imports: original bytes, character offsets, page/chapter locators and result identities');
 currentFile=path.join(corpus,'imports/B03.jsonl');await importFile(currentFile);
 let s=await go('D08');await s.getByLabel('检索问题').fill('Alice');await s.getByRole('button',{name:'精确余弦',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('deck-slide[slide-id="D08"]').textContent.includes('请在D01导入配套向量JSON'));
 check('Text-only import explains missing vectors instead of claiming semantic retrieval');
 for(const name of Object.keys(queries)){
  currentFile=path.join(v.vectors,name+'.vectors.json');await importFile(currentFile);
  await search('D08',queries[name],'精确余弦');
 }
 currentFile=path.join(v.vectors,'全部公开语料.vectors.json');await importFile(currentFile);assert.equal(docs.size,2686);
 await search('D07','Rabbit','BM25排序');await search('D11','Rabbit','全文命中');
 await search('D08','a rabbit carrying a watch','精确余弦');
 await search('D09','Rabbit watch','混合检索');await search('D12','a rabbit carrying a watch','运行EdgeVec');
 await page.screenshot({path:path.join(v.output,'all-public-EdgeVec.png'),fullPage:true});
 s=await go('D17');assert((await s.innerText()).includes('D01 导入不会自动重建'));
 check('External application corpus scope is explicit');
 if(v['forum-text']){
  for(const [name,q] of [['推荐帖','刘翔'],['已筛选回复','助跑']]){
   currentFile=path.join(v['forum-text'],name+'.jsonl');await importFile(currentFile);
   await search('D07',q,'BM25排序');await search('D11',q,'全文命中');
   currentFile=path.join(v.vectors,name+'.vectors.json');await importFile(currentFile);
   await search('D08',q,'精确余弦');await search('D09',q,'混合检索');await search('D12',q,'运行EdgeVec');
   assert(!docs.has('LEY-GOOD-00041'));assert([...docs.values()].every(d=>d.author==='论坛用户（课堂匿名展示）'));
  }
  check('242 local forum records: new corpus replaces old indexes, anonymous display, excluded ID absent');
 }
 currentFile=path.join(v.vectors,'B03.vectors.json');await importFile(currentFile);
 s=await go('D13');await s.getByLabel('检索问题').fill('White Rabbit waistcoat pocket watch：兔子从哪里取出表？只依据原文回答并引用片段编号。');
 await s.getByRole('button',{name:'1 检索',exact:true}).click();
 await s.getByRole('button',{name:'2 确认上下文',exact:true}).click();
 await s.getByRole('button',{name:'3 构建请求',exact:true}).click();
 const request=await s.locator('details').filter({has:page.locator('summary', {hasText:'实际请求'})}).locator('pre').textContent();
 assert(request.includes('B03-'));assert(request.includes('Lewis Carroll'));
 const ids=await s.getByRole('button',{name:/^核对 B03-/}).allTextContents();assert(ids.length>0);
 await s.getByRole('button',{name:ids[0],exact:true}).click();
 assert.equal(await s.locator('.source-evidence').getAttribute('data-source-id'),ids[0].slice(3));
 check('RAG context assembly and clickable source review',{context_ids:ids});
 if(v.generation){
  await s.getByRole('button',{name:'4 调用生成',exact:true}).click();
  await page.waitForFunction(()=>{const s=document.querySelector('deck-slide[slide-id="D13"]');return s.textContent.includes('citation_check')||s.textContent.includes('Error:');},null,{timeout:180000});
  const meta=JSON.parse(await s.locator('.lab-column').nth(1).locator(':scope > pre').first().textContent());
  report.generation={model:meta.model,citation_check:meta.citation_check,answer:await s.locator('.model-answer').textContent()};
  assert(meta.citation_check && !meta.citation_check.missing_ids);assert.deepEqual(meta.citation_check.unknown_ids,[]);
  assert((await s.locator('.citation-status').textContent()).includes('引用编号与本轮材料匹配'));
  check('Actual local model generated answer with valid new-corpus IDs',report.generation);
 }
 await page.screenshot({path:path.join(v.output,'RAG-source-review.png'),fullPage:true});
 // Negative UI check uses a clearly labeled response fixture, after the real model run above.
 await page.route('**/api/generate',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({text:'受控错误引用测试 [B03-NOT-IN-CONTEXT]',model:'TEST-FIXTURE',provider:'local',finish_reason:'stop'})}));
 await s.getByRole('button',{name:'4 调用生成',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('deck-slide[slide-id="D13"] .citation-status')?.textContent.includes('引用核验未通过'));
 assert((await s.locator('.citation-status').textContent()).includes('B03-NOT-IN-CONTEXT'));
 check('Controlled invalid-citation response is visibly rejected (not a model success)');
 await page.unroute('**/api/generate');
 await page.setViewportSize({width:390,height:844});await go('D11');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
 await page.screenshot({path:path.join(v.output,'mobile-source-review.png'),fullPage:true});
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.failed,[]);
 report.result='passed';
}catch(error){report.result='failed';report.failure=String(error);await page.screenshot({path:path.join(v.output,'failure.png'),fullPage:true});throw error;
}finally{await fs.writeFile(path.join(v.output,'browser-report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
