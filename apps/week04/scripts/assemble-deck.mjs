import fs from 'node:fs/promises';
const revisedNotes={D06:'目的：从检索结果取得证据地址并回到所用原话。范例引导：复制一条命中的URI，再输入解析，观察原页高亮和鼠标提示。机制背景：沿持久化的文档、页、修订与文本块关系定位，引用保持所用版本。',D07:'目的：理解充分性和必要性由本次需求决定。范例引导：沿元需求、子需求、字段名到表单，悬停和点击字段，讨论少录与多录的后果。机制背景：示例选择姓名、出版日期和征引页码；需求改变时字段集合也随之调整。',D09:'目的：区分作品、表达、载体表现与单件。范例引导：沿《资本论》的任一语言分支观察表达、出版版本与藏本。机制背景：用户提供的图包含一项作品、四种表达、四项载体表现与四件藏本。'};
Object.assign(revisedNotes,{D10:'目的：辨明同一文献的身份层，并区分正文与可重建索引。范例引导：点击复制PDF、重新扫描、换版与校对四种变化，查看题录、文档实例、文件哈希和内容修订的关系，再查看实际FTS内容、行号映射与fts5vocab词项位置，执行重建后切换前后快照。机制背景：由已提交正文重建派生层；正文单元身份与证据地址保留，FTS行号重新分配。',D16:'目的：理解可演化的结构。范例引导：逐次加入来源笔记与关系入口，观察材料核心保持稳定。机制背景：新问题通过追加记录展开，示例独立于文献管理器。',D11:'目的：区分出版来源、取得原件与衍生关系。范例引导：点击衍生说明，在本页左侧Markdown模板中填写来历与理由。机制背景：右侧示意图保持可点，独立草稿可下载并回查原页。',D15:'目的：区分集合、标签与工作状态的职责。范例引导：分别点击集合与主题标签，在各自侧栏筛选同一书库。机制背景：四篇预置文献各有四至五个标签，共同标签可聚合多篇文献。',D26:'目的：沿原页、OCR、校对和历史回查观察加工链。范例引导：点击各节点进入PDF正文、OCR队列确认、边界框树编辑与历史修订。机制背景：切换节点保留未提交草稿；图始终可点，保存后提交新修订。',D18:'目的：理解筛选、抽取、释义、概括、比较与验证六种阅读任务。范例引导：在聊天输入框旁选择预置提示词，修改并发送，观察不同任务的结果；继续追问并回查引用。机制背景：自由提示、多轮消息与真实配置模型相连；find、fetch、cite采用桌面渐进式探索语义，先浏览题录与目录，再以短词检索局部并取得证据；本机会话和精确原页相连。',D25:'目的：理解SKOS怎样分离概念、名称和关系。范例引导：切换基本思想、编辑词表、力导向预览；补充历史异称或概念后观察图的变化。机制背景：N3解析Turtle；D3从同一RDF构造图；prefLabel每语言至多一个，related不能与上下位范围相冲突。',D27:'目的：区分交换、同步与可恢复备份。范例引导：生成ZIP，在独立空库恢复并核验原件与数据库。机制背景：教学实验复用库操作，SQLite与PDF分别核验。'});
for(const id of ['D17','D19','D20','D22','D23','D24','D28'])revisedNotes[id]='目的：把当前研究步骤落实为可继续的记录。范例引导：在独立Markdown编辑器中填写模板与理由，自由增删栏目，预览、下载并沿有效证据URI回查。机制背景：草稿由本机保存；书库、题录与原文身份继续由真实文献管理操作维护。';
const transitions=JSON.parse(await fs.readFile('../../docs/week04/transitions.json','utf8'));
const design=await fs.readFile('../../docs/week04/design.md','utf8');
const pages=JSON.parse(await fs.readFile('../../docs/week04/page-map.json','utf8'));
const existingHtml=(await fs.readFile('src/index.html','utf8').catch(()=> '')).replace(/<tool-explainer\b[^>]*><\/tool-explainer>/g,'');
const existingSlides=new Map([...existingHtml.matchAll(/<deck-slide slide-id="([^"]+)"[\s\S]*?<\/deck-slide>/g)].map(match=>[match[1],match[0]]));
const existingPageData=JSON.parse(await fs.readFile('src/assets/data/pages.json','utf8').catch(()=> '[]'));
const existingEnrichment=JSON.parse(await fs.readFile('src/assets/data/page-enrichment.json','utf8').catch(()=> '[]'));
const retainedIds=new Set();
const diagramPages=new Set(['D09','D04','D05','D06','D07','D08','D10','D11','D12','D13','D14','D15','D16','D17','D18','D19','D20','D21','D22','D23','D24','D25','D26','D27','D28']);
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const card=(title,text)=>`<article class="concept-card"><h3>${title}</h3><p>${text}</p></article>`;
const grid=(rows)=>`<div class="concept-grid">${rows.map(([t,s])=>card(t,s)).join('')}</div>`;
const table=(head,rows)=>`<table class="concept-table"><thead><tr>${head.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(x=>`<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const quote=(text,source)=>`<blockquote>${text}<cite>${source}</cite></blockquote>`;
const live=tag=>`<${tag}></${tag}>`;
const body={
 D00:`<div class="hero-lab"><div><p class="eyebrow">人工智能赋能历史研究与写作 · 第四讲</p><h2 class="hero-title">文献整理<br>学术阅读<br>个人知识系统</h2><p class="hero-lead">学者的生命有限，而文献无限。<br>如何组织文献与知识，让过去的阅读进入新的问题？</p></div><div class="hero-path"><span>找得到</span><span>辨得清</span><span>引得准</span></div></div>`,
 D01:grid([['发现 · 找得到','从无限的书中筛出少数能用的书。<details><summary>从纸面到数字</summary>目录与索引 → 搜索引擎与检索系统</details>'],['判断 · 辨得清','核对版本、作者与论证位置。<details><summary>从纸面到数字</summary>校雠与辨伪 → 同行评议、版本与引用关系</details>'],['对话 · 引得准','保存原话、位置与材料来历。<details><summary>从纸面到数字</summary>征引与书目 → DOI、证据 URI 与修订记录</details>']])+`<p class="takeaway">AI 改变各环节的成本；材料、理解与关系仍须分别记录。</p>`,
 D02:`<div class="timeline">${[['约前240年','卡利马科斯','《表》：学科分类、字母排序、作者小传。'],['西汉','刘向、刘歆','校雠异本、叙录旨意，辨别讹谬。'],['约987年','伊本·纳迪姆','《群书索引》区分亲见与耳闻。'],['1841年','帕尼齐','91条编目规则：聚合同类、区分相似。'],['1876年','卡特','使读者找到文献、看到馆藏相关文献。'],['1931年','阮冈纳赞','五定律以“用”裁判组织工作。'],['1998年','FRBR','以实体与关系描述书目世界。'],['2016年','FAIR','可发现、可访问、可互操作、可重用。']].map(([date,t,s])=>`<details class="concept-card"><summary><small>${date}</small><h3>${t}</h3></summary><p>${s}</p></details>`).join('')}</div><p class="takeaway">共同需求塑造不同技术：找书、辨书、引书。</p>`,
 D03:`<div class="principles">${[['用户导向','D28','这帮助谁找到什么？'],['内容与载体分离','D09','版本与副本能分别指认吗？'],['实体与关系','D22','关系有类型与理由吗？'],['词汇控制','D25','异称可查、首选名明确吗？'],['标准化与互操作','D12','字段语义与身份能交换吗？'],['充分、必要、简约','D07','每个装置承担什么功能？'],['可演化的结构','D16','新对象能顺利纳入吗？'],['可追溯与可信任','D26','出处、修订和回查还在吗？']].map(([t,id,s])=>`<a class="concept-card" href="#${id}"><h3>${t}</h3><p>${s}</p></a>`).join('')}</div>${quote('Books are for use. · Every reader his book. · Every book its reader.<br>Save the time of the reader. · A library is a growing organism.','Ranganathan, The Five Laws of Library Science, 1931')}`,
 D04:live('library-explorer'), D05:live('metadata-lab'),D06:live('status-machine'),
 D07:live('requirements-lab'),
 D08:grid([['成文时间','材料中的事件、撰写与形成背景。'],['出版时间','使用的是哪一版、哪次刊印。'],['扫描时间','数字副本何时产生，来自哪个原件。'],['修改时间','OCR 与笔记何时修订，旧引用指向哪版。']])+`<uri-resolver></uri-resolver>`,
 D09:'<mermaid-diagram diagram="capital"></mermaid-diagram>',
 D10:table(['工具','一等对象','同一性依据'],[['Zotero','条目＋附件','条目身份与附件关联'],['JabRef','BibTeX记录','引用键与字段'],['Tropy','照片＋项目','图像材料与项目元数据'],['Patchouli','题录／文档实例／文件资产','实体ID、文件哈希与修订']])+live('projection-lab'),
 D11:grid([['出版来源','期刊、书名、出版者：说明材料身份。'],['取得渠道','下载地址、档案平台：帮助再次取得副本。'],['Dublin Core source','记录所描述资源从何种相关资源衍生而来。']])+quote('A related resource from which the described resource is derived.','DCMI Metadata Terms · source；教案1.5')+`<p class="takeaway">共享字段名之前，先共享字段语义。</p>`,
 D12:`<div class="standard-chain"><span>ISBD · 著录内容与秩序</span><span>→ MARC21 · 机器可读交换</span><span>→ CSL · 引文渲染</span></div>`+live('csl-renderer'),
 D13:`<p class="lead">身份回答“它是谁”；路径回答“从哪里访问”。同一对象可以有多个组织入口。</p>`+live('uri-resolver'),
 D14:live('tag-lab'),
 D15:grid([['集合','服务一个明确问题，把相关对象放在一起。'],['主题标签','描述对象谈论什么，支持跨集合发现。'],['工作状态','记录取得、阅读和核验进展。']])+`<p class="takeaway">一装置一功能：先确定职责，再决定字段与界面。</p>${quote('编目规则应围绕目录承担的功能组织。','Lubetzky, Cataloging Rules and Principles, 1953；教案2.2，概述')}`,
 D16:grid([['好客性','新主题进入时，为它留下位置，而非重建整个分类。'],['最小本体承诺','先记录足以服务问题的区分；让未来问题仍有展开空间。'],['开闭原则','为扩展开放，为修改封闭。变化通过新增约定进入。']])+`<structure-lab></structure-lab>`,
 D17:table(['工具','管理对象','适合的下一步'],[['Zotero','文献条目与附件','取得全文、整理引用'],['JabRef','结构化题录','维护引用键与交换字段'],['Tropy','图像史料','组织照片与研究元数据'],['Patchouli','文档树与可回查文本','检索、读取、修订与引用']])+`<queue-lab></queue-lab>`,
 D18:live('reading-agent'),
 D19:grid([['界定输入范围','筛选读摘要；概括读所定范围；验证返回原文。'],['核验与写回','记录采纳、收窄、纠错或暂不判断，以及依据。'],['保存未完成','保存线索、疑问和下一步，让中断可以继续。'],['监控理解','复述主要主张，检查自己哪里仍靠猜测。']])+`<p class="takeaway">AI 建议进入阅读记录时，保留它的任务、输入范围与核验决定。</p>`,
 D20:live('note-markup'),D21:live('zettel-lab'),
 D22:`<p class="lead">导航链接 → 文献引用 → 带类型与理由的关系。关系把“可点击”推进到“为什么相关”。</p>`+live('relation-lab'),
 D23:grid([['反向链接','观察已有关系从哪些问题返回这份材料。'],['未链接提及','发现候选关联，人工决定是否建立关系。'],['问题索引','围绕问题组织入口；证据矩阵把主张连到材料位置。']])+`<p class="takeaway">问题改变时，组织入口可以改变，材料身份与原文位置仍可回查。</p>`+live('uri-resolver'),
 D24:live('refine-lab'),D25:live('vocabulary-lab'),D26:live('revision-ocr-lab'),D27:live('backup-lab'),
 D28:live('quality-lab')+live('library-explorer'),
 D29:`<div class="hero-lab"><div><h2 class="hero-title">组织是为了<br>未来的使用</h2><p class="hero-lead">使过去的阅读能够进入新的问题。</p></div><div class="hero-path"><span>我能再次找到吗？</span><span>我能说明依据吗？</span><span>我能回到原文吗？</span></div></div><p>课后使用教案附录：最小记录约定、八原则检查表。</p>`,
 D30:live('glossary-view'),
};
const enrichment=JSON.parse(await fs.readFile('../../docs/week04/page-enrichment.json','utf8'));
for(const extra of enrichment){const p=pages.find(p=>p.id===extra.id);Object.assign(extra,{section:p.section,original:p.original_action||p.action});if(extra.tool)body[extra.id]=`<library-workbench page-id="${extra.id}"></library-workbench>`;}
body.D04='<metadata-split navigation="layers"></metadata-split>';
body.D05=live('metadata-split');
for(const id of ["D06","D07","D08","D10","D11","D12","D13","D14","D15","D16","D17","D18","D19","D20","D21","D22","D23","D24","D25","D26","D27","D28"])body[id]=`<metadata-split navigation="concepts" concept-page="${id}"></metadata-split>`;
for(const id of ["D17","D19","D20","D22","D23","D24","D28"])body[id]='<markdown-lab page-id="'+id+'"></markdown-lab>';
for(const id of ["D10","D16","D18","D27"])body[id]='<standalone-lab page-id="'+id+'"></standalone-lab>';
body.D25=live('skos-lab');
body.D07=live('requirements-lab');body.D09='<mermaid-diagram diagram="capital"></mermaid-diagram>';
const slides=pages.map(p=>{
 // Preserve authored notes and source blocks when the existing layout already
 // matches. D21 is regenerated for the newly selected physical card-box layout.
 if(existingSlides.has(p.id)&&(!diagramPages.has(p.id)||(p.id!=='D21'&&existingSlides.get(p.id).includes(body[p.id])))){retainedIds.add(p.id);return existingSlides.get(p.id);}
 const block=design.split(new RegExp(`### ${p.id}\\b`))[1]?.split(/\n### /)[0]||'';
 const lesson=enrichment.find(e=>e.id===p.id);if(lesson)lesson.quotations=block.split('\n').filter(line=>line.startsWith('> ')).map(line=>line.slice(2));
 const notes=lesson?.tool?`目的：${lesson.question}\n范例引导：${lesson.task}\n机制背景：${lesson.observe} ${lesson.evidence} ${lesson.boundary}`:block.match(/- \*\*演讲者备注草稿\*\*：([\s\S]*?)(?=\n- \*\*)/)?.[1]?.trim()||`目的：${p.title}。\n范例引导：让学生观察当前页真实输入与结果。\n机制背景：${p.evidence}`;
 let footer=block.match(/- \*\*页脚\*\*：([^\n]+)/)?.[1]||`${p.id} · ${p.mode}；${p.section}`;
 if(enrichment.find(e=>e.id===p.id)?.tool)footer=`${p.id} · Patchouli · 点击示意图切换对应操作`;
 if(p.id==='D04')footer='D04 · 点击三层柱体，切换书库、PDF工作台与检索';
 if(p.id==='D05')footer='D05 · 点击右侧实体，查看左侧对应内容';
 if(p.id==='D07')footer='D07 · 悬停字段看充分性/必要性；点击字段定位表单';
 if(["D17","D19","D20","D22","D23","D24","D28"].includes(p.id))footer=p.id+' · 自由填写 Markdown 模板 · 预览与下载';
 if(["D10","D16","D18","D27"].includes(p.id))footer=p.id+' · 独立教学实验 · 观察输入与结果';
 if(p.id==='D25')footer='D25 · 基本思想 → 编辑历史词表 → 力导向预览';
 if(p.id==='D21')footer='D21 · 取出、书写与放回卡片；点击示意图高亮对应内容';
 const quotations=block.split('\n').filter(line=>line.startsWith('> ')).map(line=>esc(line.slice(2))).join('<br>');
 const original=quotations&&!enrichment.find(e=>e.id===p.id)?.tool&&p.id!=='D03'?`<details class="source-quote"><summary>原文与出处 · 教案 ${esc(p.section)}</summary><blockquote>${quotations}</blockquote></details>`:'';
 return `<deck-slide slide-id="${p.id}" header-title="${esc(p.title)}" kicker="${p.id} / ${esc(p.section)}" theme="${['D00','D29'].includes(p.id)?'dark':'light'}" notes="${esc(notes)}">${body[p.id]}${original}<div slot="footer">${footer}</div></deck-slide>`;
});
for(let i=0;i<slides.length;i++){const id=pages[i].id;slides[i]=slides[i].replace(/(<deck-slide\b[^>]*)(>)/,(_,opening,close)=>opening.replace(/ header-title="[^"]*"/,' header-title="'+esc(pages[i].title)+'"').replace(/ transition="[^"]*"/g,'')+' transition="'+esc(transitions[id]||'')+'"'+close);if(revisedNotes[id])slides[i]=slides[i].replace(/ notes="[^"]*"/,' notes="'+esc(revisedNotes[id])+'"');if(id==='D09')slides[i]=slides[i].replace(/<details class="source-quote">[\s\S]*?<\/details>/,'').replace(/<div slot="footer">[\s\S]*?<\/div>/,'<div slot="footer">D09 · 作品 → 表达 → 载体表现 → 单件</div>');}
const glossary=JSON.parse(await fs.readFile('src/assets/data/glossary.json','utf8'));
const first={
 '题录':'D05','元数据':'D05','条目':'D05','附件':'D05','受控词汇':'D25','持久标识符':'D13',
 '集合':'D14','标签':'D14','版本':'D08','引用':'D08','来源笔记':'D20','永久笔记':'D21',
 'Dublin Core':'D11','ISBD':'D12','MARC21':'D12','CSL':'D12','FRBR':'D09','FRBR/LRM':'D09','SKOS':'D25','RDF':'D22','FAIR':'D26','ISO 25964':'D25',
 'Zotero':'D10','JabRef':'D10','Tropy':'D10','patchouli':'D04','OpenRefine':'D24','DocuSky':'D24','Obsidian':'D23','SQLite FTS5':'D04','MCP':'D27',
 '卡片盒笔记法':'D21','图书馆学五定律':'D03','开闭原则':'D16','最小本体承诺':'D16','实体–关系模型':'D22',
 '收藏':'D14','叙词表':'D25','引文':'D08','校勘':'D26','目录学':'D02','字段映射':'D11','阅读队列':'D17','集合说明':'D17','问题索引':'D23','证据矩阵':'D23','反向链接':'D23','名字空间':'D13','来源':'D08','个人知识管理':'D01','引文样式语言':'D12','BibTeX':'D10','IFLA 图书馆参考模型':'D09','FAIR 原则':'D26','DOI':'D13','ISBN':'D09','ORCID':'D13','SQLite':'D04','光学字符识别':'D26','模型上下文协议':'D27','Plan 9':'D13','WebAssembly':'D06','RapidOCR':'D26','冒号分类法':'D16','分面分类':'D24',
};
for(const c of glossary.categories)for(const t of c.terms){
 const matched=Object.keys(body).find(id=>body[id].includes(t.term));
 t.first_slide=first[t.term]||matched||null;
}
await fs.writeFile('src/assets/data/page-enrichment.json',JSON.stringify(enrichment.map(record=>retainedIds.has(record.id)&&!revisedNotes[record.id]?existingEnrichment.find(previous=>previous.id===record.id)||record:record),null,2)+'\n');
await fs.writeFile('src/assets/data/glossary.json',JSON.stringify(glossary,null,1)+'\n');
await fs.writeFile('src/index.html',`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>第四讲 · 文献整理、学术阅读与个人知识系统</title><link rel="stylesheet" href="build/week04.css"><script src="bootstrap.js" defer></script><script type="module" src="build/week04.esm.js"></script></head><body><div id="app"></div><template id="deck-template"><deck-container>${slides.join('\n')}<model-connection></model-connection></deck-container></template></body></html>`);
console.log('Assembled',slides.length,'slides from approved page map');
await fs.writeFile('src/assets/data/pages.json',JSON.stringify(pages.map(p=>{
 if(retainedIds.has(p.id)&&existingPageData.some(previous=>previous.id===p.id))return {...existingPageData.find(previous=>previous.id===p.id),...p,notes:revisedNotes[p.id]||existingPageData.find(previous=>previous.id===p.id).notes};
 const block=design.split(new RegExp(`### ${p.id}\\b`))[1]?.split(/\n### /)[0]||'';
 return {...p,notes:revisedNotes[p.id]||block.match(/- \*\*演讲者备注草稿\*\*：([\s\S]*?)(?=\n- \*\*)/)?.[1]?.trim()};
}),null,2));
