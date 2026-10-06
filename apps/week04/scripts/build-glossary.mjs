// 构建课件 D30 术语表数据：内置术语清单，逐条用 Wikipedia API 验证条目存在性
// （先 zh 后 en，跟随重定向），产出 src/assets/data/glossary.json。
// 网络不可达 / API 报错时退出且不写文件；确认无条目时 wiki 为 null。
import fs from 'node:fs/promises';
import path from 'node:path';

const SOURCE = '教案第四讲 v1.8';
const OUT = path.resolve(import.meta.dirname, '../src/assets/data/glossary.json');
const REQUEST_DELAY_MS = 400;
const MAX_RETRIES = 5;

const CATEGORIES = [
  {id: 'concept', label: '基本概念'},
  {id: 'standard', label: '标准'},
  {id: 'tool', label: '技术实现'},
  {id: 'method', label: '理念方法'}
];

// wiki 字段为候选标题数组，按 zh → en、数组顺序依次用 API 验证；
// pinnedNull 表示已确认无 Wikipedia 条目（或按课件规则不挂链接），固定 wiki=null，不再请求。
const TERMS = [
  // ── 基本概念 ─────────────────────────────────────────────
  {category: 'concept', term: '题录', en: 'bibliographic record',
    definition: '描述一篇文献的责任者、题名、来源等特征的著录记录。保存一条题录可以表示发现了一条线索；条目完整、附件存在与正文读过是三种不同的状态。',
    wiki: {zh: ['題錄', '书目记录'], en: ['Bibliographic record']}},
  {category: 'concept', term: '元数据', en: 'metadata',
    definition: '描述、识别和管理材料的信息，如题名、作者、发表来源、日期和页码。它让我们知道一个对象是什么、从哪里来、怎样再次找到，却不能代替这个对象的正文。',
    wiki: {zh: ['元数据'], en: ['Metadata']}},
  {category: 'concept', term: '条目', en: 'item',
    definition: '文献管理器中保存页面信息后形成的一条记录，以题录为核心。与条目关联的 PDF、图片或其他文件则是附件。',
    wiki: {zh: ['条目'], en: ['Item']}},
  {category: 'concept', term: '附件', en: 'attachment',
    definition: '与文献条目关联的 PDF、图片或其他文件。附件存在仍须打开核对，确认它就是本次要读的文本。',
    wiki: {zh: [], en: ['Email attachment', 'Attachment']}},
  {category: 'concept', term: '收藏', en: 'collection',
    definition: '围绕一个项目或问题对条目进行的归组。同一条目能够进入多个收藏，而不必为每个问题复制一份材料。',
    wiki: {zh: ['收藏'], en: ['Collection']}},
  {category: 'concept', term: '标签', en: 'tag',
    definition: '提供跨组筛选入口的关键词。主题标签描述材料涉及什么，工作状态标签描述处理到了哪里，两者混放会使整理既不能表达主题也不能帮助决定下一步。',
    wiki: {zh: ['标签'], en: ['Tag (metadata)']}},
  {category: 'concept', term: '受控词汇', en: 'controlled vocabulary',
    definition: '同一概念使用唯一、稳定的标识与首选名称、同义异称归并于首选名称之下、每个概念配以说明用法边界注释的词表。Svenonius 称它为信息组织的必要条件。',
    wiki: {zh: ['受控词表'], en: ['Controlled vocabulary']}},
  {category: 'concept', term: '叙词表', en: 'thesaurus',
    definition: '按受控词汇规范编制、用于标引与检索的主题词表。ISO 25964 两部分规定了叙词表编制及词表间互操作的规范。',
    wiki: {zh: ['主題詞表', '叙词表'], en: ['Thesaurus (information retrieval)']}},
  {category: 'concept', term: '持久标识符', en: 'persistent identifier',
    definition: '不随位置与分类变化、使记录能跨系统与时间保持指认的标识符。DOI、ISBN、ORCID 乃至任意 URI 都是这一回答的不同形态。',
    wiki: {zh: ['永久标识符'], en: ['Persistent identifier']}},
  {category: 'concept', term: '引文', en: 'citation',
    definition: '写作时对前人论述的征引，须保留原话与位置。引用定位说明本次使用文献中的哪一处，是“引得准”的物质保障。',
    wiki: {zh: ['引文', '引用'], en: ['Citation']}},
  {category: 'concept', term: '版本', en: 'edition',
    definition: '说明所用文本的记录信息。文献条目说明研究对象，版本信息说明所用文本，二者相互联系却不能彼此替代。',
    wiki: {zh: ['版本'], en: ['Edition (book)']}},
  {category: 'concept', term: '校勘', en: 'textual criticism',
    definition: '比对异本、校雠文字并留下可复查痕迹的文献整理工作。数字时代的可追溯原则，是校勘传统的工程化。',
    wiki: {zh: [], en: ['Textual criticism']}},
  {category: 'concept', term: '目录学', en: 'bibliography',
    definition: '研究文献著录与分类、服务于“找得到”的学问。从卡利马科斯的《表》到刘向父子的校雠，各文明的目录学传统都由学术阅读的处境塑形。',
    wiki: {zh: ['目录学'], en: ['Bibliography']}},
  {category: 'concept', term: '字段映射', en: 'field mapping',
    definition: '说明原记录中的信息进入新记录的哪个位置、以及含义是否保持一致的约定。它不是把一列换个名字：日期指什么时间、来源指什么关系，都影响后来能否准确使用。',
    wiki: {zh: ['字段映射'], en: ['Data mapping']}},
  {category: 'concept', term: '阅读队列', en: 'reading queue',
    definition: '由工作状态组织起来的、可恢复中断位置的待处理记录序列。只有题录而无正文的条目可以进入获取队列，但不能算作模型已经读到的材料。',
    wiki: {zh: ['阅读队列'], en: ['Reading list']}},
  {category: 'concept', term: '集合说明', en: 'collection description',
    definition: '记录个人材料库主要来源、时间与语言范围、纳入原则、排除项、已知缺口及最近更新时间的说明。它使“一次查找没有结果意味着什么”成为可以判断的问题。',
    wiki: {zh: ['集合說明'], en: ['Collection description']}},
  {category: 'concept', term: '问题索引', en: 'problem index',
    definition: '围绕一个问题汇集已有判断、支持材料、可能反例和未决部分的导航记录，可以持续改写。它不是完整的知识树，结构随问题生长。',
    wiki: {zh: [], en: []}},
  {category: 'concept', term: '证据矩阵', en: 'evidence matrix',
    definition: '整理陈述、依据、限制与缺口的表格化研究记录。本讲把它与问题索引连接，使来源栏能够返回文献与原文位置，下一步能够指向待读材料。',
    wiki: {zh: [], en: []}},
  {category: 'concept', term: '反向链接', en: 'backlink',
    definition: '列出哪些笔记指向当前笔记的链接视图。它与内部链接一起增加进入同一记录的方向，但不会自动说明联系的性质。',
    wiki: {zh: ['反向链接'], en: ['Backlink']}},
  {category: 'concept', term: '名字空间', en: 'namespace',
    definition: '对象在其中按名称寻址的组织层。组织视图与对象身份可以分离：同一批对象可以在不同名字空间下呈现给不同使用者，对象本身不必移动。',
    wiki: {zh: ['命名空间'], en: ['Namespace']}},
  {category: 'concept', term: '来源', en: 'provenance',
    definition: '关于记录从哪来、经历了什么、此刻是否仍如其原貌的信息。FAIR 原则的可重用条款要求（元）数据附有详细的来源信息。',
    wiki: {zh: ['溯源'], en: ['Provenance']}},
  {category: 'concept', term: '个人知识管理', en: 'personal knowledge management',
    definition: '研究者组织材料、保存理解、建立联系并持续修订这些记录的工作方式。系统首先意味着这些工作能够彼此接续，而不必从安装一组复杂工具开始。',
    wiki: {zh: ['个人知识管理'], en: ['Personal knowledge management']}},

  // ── 标准 ────────────────────────────────────────────────
  {category: 'standard', term: 'Dublin Core', en: 'Dublin Core',
    definition: '提供通用元数据术语的标准，帮助约定标识、日期与关系等字段的语义。其 source 定义为“所描述资源由其派生而来的相关资源”，比日常所说的“引用出处”含义更宽。',
    wiki: {zh: ['都柏林核心'], en: ['Dublin Core']}},
  {category: 'standard', term: 'ISBD', en: 'International Standard Bibliographic Description',
    definition: '规定书目记录著录什么、按什么结构著录的内容标准。它与规定机器交换格式的 MARC21 配套，构成近现代图书馆书目记录的基础。',
    wiki: {zh: ['國際標準書目著錄', '国际标准书目著录'], en: ['International Standard Bibliographic Description']}},
  {category: 'standard', term: 'MARC21', en: 'MARC21',
    definition: '规定书目数据如何编码以便机器交换的载体格式标准。它与 ISBD 配套，构成近现代图书馆书目记录的基础。',
    wiki: {zh: ['機讀編目格式規範', 'MARC'], en: ['MARC standards']}},
  {category: 'standard', term: '引文样式语言', en: 'Citation Style Language (CSL)',
    definition: '引文样式语言：同一份结构化的题录数据，换一个样式文件就换一种引文体例。数据是数据、体例是体例，“换体例”成为纯样式问题。',
    wiki: {zh: [], en: ['Citation Style Language']}},
  {category: 'standard', term: 'BibTeX', en: 'BibTeX',
    definition: '以纯文本 .bib 文件存储参考文献条目的格式。JabRef 围绕 BibTeX/biblatex 纯文本库工作，一条记录就是一个条目，文件靠链接挂接。',
    wiki: {zh: ['BibTeX'], en: ['BibTeX']}},
  {category: 'standard', term: 'FRBR', en: 'Functional Requirements for Bibliographic Records',
    definition: 'IFLA 1998 年报告提出的书目世界四层实体模型：作品、表达、载体表现、单件。它是“内容与载体分离”原则的完整理论表述。',
    wiki: {zh: ['書目記錄功能需求', 'FRBR'], en: ['Functional Requirements for Bibliographic Records']}},
  {category: 'standard', term: 'IFLA 图书馆参考模型', en: 'IFLA Library Reference Model (LRM)',
    definition: 'IFLA 2017 年发布的图书馆参考模型，将 FRBR 与配套的 FRAD、FRSAD 整合为单一模型，成为当今编目与元数据建模的基础。',
    wiki: {zh: [], en: ['IFLA Library Reference Model']}},
  {category: 'standard', term: 'SKOS', en: 'Simple Knowledge Organization System',
    definition: 'W3C 2009 年的简单知识组织系统规范，用 prefLabel、altLabel、scopeNote 等属性把受控词汇的经典配方标准化，并对形式约束保持“防过度承诺”的谨慎。',
    wiki: {zh: ['簡單知識組織系統', 'SKOS'], en: ['Simple Knowledge Organization System']}},
  {category: 'standard', term: 'RDF', en: 'Resource Description Framework',
    definition: 'W3C 规范给出的通用关系表达形式，核心结构是由主语、谓语、宾语构成的三元组。词项用 IRI 标识，使关系可以被机器直接消费。',
    wiki: {zh: ['资源描述框架'], en: ['Resource Description Framework']}},
  {category: 'standard', term: 'ISO 25964', en: 'ISO 25964',
    definition: '《信息与文献——叙词表及与其他词表的互操作》国际标准，两部分分别于 2011、2013 年发布，规定叙词表编制及词表间互操作的规范。',
    wiki: {zh: [], en: ['ISO 25964']}},
  {category: 'standard', term: 'CIDOC CRM', en: 'CIDOC Conceptual Reference Model',
    definition: '文化遗产信息交换的参考本体，现行版本为 ISO 21127:2023。',
    wiki: {zh: [], en: ['CIDOC Conceptual Reference Model']}},
  {category: 'standard', term: 'FAIR 原则', en: 'FAIR principles',
    definition: 'Wilkinson 等人 2016 年提出的科学数据管理高层框架，要求数据可发现、可访问、可互操作、可重用。其中 R1.2 要求（元）数据附有详细的来源信息。',
    wiki: {zh: ['FAIR数据', 'FAIR原則'], en: ['FAIR data']}},
  {category: 'standard', term: 'DOI', en: 'Digital Object Identifier',
    definition: '数字对象标识符，让不同系统中的记录指向同一个对象的持久标识符。它使“这条题录与我手里的文件是否同一文献”成为可核对的问题。',
    wiki: {zh: ['数字对象标识符'], en: ['Digital object identifier']}},
  {category: 'standard', term: 'ISBN', en: 'International Standard Book Number',
    definition: '国际标准书号，图书的持久标识符形态之一。它把文献身份与架位、分类号解耦：分类可以改，文件可以搬，身份不变。',
    wiki: {zh: ['国际标准书号'], en: ['ISBN']}},
  {category: 'standard', term: 'ORCID', en: 'Open Researcher and Contributor ID',
    definition: '研究者的持久标识符形态之一，用于标识学术作者身份。它与 DOI、ISBN 同属把对象身份与位置解耦的一类回答。',
    wiki: {zh: ['ORCID'], en: ['ORCID']}},

  // ── 技术实现 ────────────────────────────────────────────
  {category: 'tool', term: 'Zotero', en: 'Zotero',
    definition: '广泛使用的文献管理器，以题录条目及其附件、笔记为组织重心。它的题录模型映射到 CSL 变量，支持按标识符添加条目和官方同步。',
    wiki: {zh: ['Zotero'], en: ['Zotero']}},
  {category: 'tool', term: 'JabRef', en: 'JabRef',
    definition: '围绕 BibTeX/biblatex 纯文本库的开源文献管理器，一条记录就是一个条目，文件靠链接挂接。每条记录以引用键为身份，LaTeX 文稿直接凭键引用。',
    wiki: {zh: ['JabRef'], en: ['JabRef']}},
  {category: 'tool', term: 'Tropy', en: 'Tropy',
    definition: '面向研究照片的文献管理工具，以照片及其材料条目为单位，照片本身即材料。它要求说明一件材料由哪些图片构成、顺序如何、是否完整。',
    wiki: {zh: [], en: ['Tropy']}},
  {category: 'tool', term: 'OpenRefine', en: 'OpenRefine',
    definition: '数据清理工具，其分面使人按字段取值查看分布和筛选记录，聚类提出可能应该归并的相近字符串。两者帮助观察和发现候选，都不替研究者完成同一性判断。',
    wiki: {zh: ['OpenRefine'], en: ['OpenRefine']}},
  {category: 'tool', term: 'DocuSky', en: 'DocuSky',
    definition: '文献集组织与转换工具，帮助从个人文件进入有边界的、可检索的文本集合。使用时仍须说明哪些材料被纳入、一条记录对应什么、字段怎样映射。',
    wiki: {zh: [], en: ['DocuSky']}},
  {category: 'tool', term: 'Obsidian', en: 'Obsidian',
    definition: '以本地 Markdown 文件为基础的笔记软件，内部链接与反向链接提供更多进入记录的方向。它的属性以 YAML 保存，Bases 把文件与属性显示为可编辑的视图。',
    wiki: {zh: ['Obsidian'], en: ['Obsidian (software)']}},
  {category: 'tool', term: 'SQLite', en: 'SQLite',
    definition: '嵌入式关系数据库引擎，整个数据库存储在单个文件中，常被用作桌面与浏览器应用的本地数据存储。',
    wiki: {zh: ['SQLite'], en: ['SQLite']}},
  {category: 'tool', term: '光学字符识别', en: 'Optical Character Recognition (OCR)',
    definition: '把扫描图像中的文字转换为可检索文本的技术。一册有文件而未经文字识别的书，可以进入阅读队列，却不被算作全文检索已覆盖的材料。',
    wiki: {zh: ['光学字符识别'], en: ['Optical character recognition']}},
  {category: 'tool', term: 'Tesseract', en: 'Tesseract OCR',
    definition: '开源的光学字符识别引擎，为扫描图像生成文本。未经识别的扫描件须先经 OCR 才能进入全文检索范围。',
    wiki: {zh: ['Tesseract'], en: ['Tesseract (software)']}},
  {category: 'tool', term: '模型上下文协议', en: 'Model Context Protocol (MCP)',
    definition: '连接 AI 助手与外部工具、数据源的协议，本课程用它向 AI 暴露文献库的只读虚拟文件系统。patchouli 的 MCP 接口只开放 find、fetch、cite、put 四个动作，找取分开、读写分开。',
    wiki: {zh: ['模型上下文协议'], en: ['Model Context Protocol']}},
  {category: 'tool', term: 'Plan 9', en: 'Plan 9 from Bell Labs',
    definition: '贝尔实验室研制的操作系统，把“一切皆文件”推到极端：进程、网络连接与硬件都以文件形态出现在名字空间中，本地与远程资源经同一协议访问。它启示了组织视图与对象身份的分离。',
    wiki: {zh: ['Plan 9', '貝爾實驗室九號計畫'], en: ['Plan 9 from Bell Labs']}},
  {category: 'tool', term: 'WebAssembly', en: 'WebAssembly',
    definition: '在浏览器等沙箱环境中执行字节码的虚拟机技术，使重型计算可以离线运行在本地。',
    wiki: {zh: ['WebAssembly'], en: ['WebAssembly']}},
  {category: 'tool', term: 'patchouli', en: 'patchouli',
    definition: '本课程团队制作的实验性文献管理器，以不可变修订保存OCR文本树，以证据URI回查页与版本。检索索引可由文本树重建；题录、笔记与标签作为持久用户知识保留。通过MCP向AI提供受约束的文献读写操作。',
    pinnedNull: true},
  {category: 'tool', term: 'ZotLit', en: 'ZotLit',
    definition: '连接 Zotero 与 Obsidian 的插件，提供从 Zotero 读取资料并更新 Obsidian 笔记的通路。采用前必须弄清题录、批注、模板和个人解释各自的更新规则，尤其区分自动导入区域与自己书写的内容。',
    pinnedNull: true},
  {category: 'tool', term: 'MinerU', en: 'MinerU',
    definition: '面向 PDF 的版面分析与文本提取工具，能把扫描版文档转换为结构化文本，为进入可检索文本集提供前置处理。',
    pinnedNull: true},
  {category: 'tool', term: 'RapidOCR', en: 'RapidOCR',
    definition: '轻量级的开源光学字符识别引擎，用于为扫描图像快速生成可检索文本。',
    pinnedNull: true},

  // ── 理念方法 ────────────────────────────────────────────
  {category: 'method', term: '卡片盒笔记法', en: 'Zettelkasten',
    definition: '卢曼使用、经阿伦斯系统整理的笔记方法，把笔记分为闪念、文献、永久、项目四类。它自下而上地从永久笔记的聚簇中生长出写作主题——写作是研究、学习与阅读的媒介。',
    wiki: {zh: ['卡片盒筆記法', 'Zettelkasten'], en: ['Zettelkasten']}},
  {category: 'method', term: '图书馆学五定律', en: 'Five Laws of Library Science',
    definition: '阮冈纳赞 1931 年提出的五条原则：书是为了用的、每个读者有其书、每本书有其读者、节省读者的时间、图书馆是生长中的有机体。它把“用”确立为组织工作的最终裁判。',
    wiki: {zh: ['圖書館學五定律', '图书馆学五定律'], en: ['Five Laws of Library Science']}},
  {category: 'method', term: '开闭原则', en: 'open–closed principle',
    definition: 'Bertrand Meyer 1988 年提出的软件设计准则：软件制品应当对扩展开放、对修改关闭。好的结构让新类型、新字段的加入不需要改动核心。',
    wiki: {zh: ['开闭原则'], en: ['Open–closed principle']}},
  {category: 'method', term: '实体–关系模型', en: 'entity–relationship model',
    definition: '把对象各自建成有标识的实体、把联系显式建模为关系的数据建模方法，关系本身是一等公民。FRBR 正是用它取代“记录堆叠”式目录。',
    wiki: {zh: ['实体-关系模型', 'ER模型'], en: ['Entity–relationship model']}},
  {category: 'method', term: '冒号分类法', en: 'Colon Classification',
    definition: '阮冈纳赞设计的分面分类法，1933 年首版。它把主题分析为若干基本范畴再按需合成类号，新主题出现时可以即时组合，无须修订整张类目表。',
    wiki: {zh: ['冒号分类法'], en: ['Colon classification']}},
  {category: 'method', term: '分面分类', en: 'faceted classification',
    definition: '把主题拆成若干独立分面、再组合成类的分类方法。与枚举式分类相比，分面体系对尚未预见的知识具有“好客性”，是可演化动态结构原则的分类学依据。',
    wiki: {zh: ['分面分類法', '分面分类'], en: ['Faceted classification']}},
  {category: 'method', term: '关联数据', en: 'linked data',
    definition: '用同一套可解析词表与 URI 发布数据、使资源彼此连接的实践惯例。它的公认惯例是：用同一套词汇描述的资源才能彼此连接，复用既有标准而不是另造私有术语。',
    wiki: {zh: ['关联数据'], en: ['Linked data']}},
  {category: 'method', term: '语义网', en: 'Semantic Web',
    definition: '让网络上的数据带有机器可消费的语义、按共享词表彼此连接的技术方向。SKOS 与 RDF 正出自这一脉络。',
    wiki: {zh: ['语义网'], en: ['Semantic Web']}}
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchJson(url) {
  let res;
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetch(url, {signal: AbortSignal.timeout(20000)});
    } catch (err) {
      if (attempt < MAX_RETRIES && err.name !== 'TimeoutError') {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      throw new Error(`Wikipedia 网络请求失败（按约定中止，不写 glossary.json）：${url} — ${err.message}`);
    }
    if (res.status === 429 || res.status === 503) {
      if (attempt < MAX_RETRIES) {
        const retryAfter = Number(res.headers.get('retry-after')) || 0;
        await sleep(Math.max(retryAfter * 1000, 3000 * (attempt + 1)));
        continue;
      }
      throw new Error(`Wikipedia 持续返回 HTTP ${res.status}（按约定中止，不写 glossary.json）：${url}`);
    }
    if (!res.ok) throw new Error(`Wikipedia 返回 HTTP ${res.status}（按约定中止，不写 glossary.json）：${url}`);
    return res.json();
  }
}

// 返回 {exists, lang, title, url, redirects}；missing 即无此条目（允许 wiki=null）。
async function checkTitle(lang, title) {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&titles=${encodeURIComponent(title)}`;
  const data = await fetchJson(url);
  if (data.error) throw new Error(`Wikipedia API 错误 ${data.error.code}（按约定中止，不写 glossary.json）：${url}`);
  const page = Object.values(data.query?.pages ?? {})[0];
  const redirects = (data.query?.redirects ?? []).map(r => `${r.from} → ${r.to}`);
  if (!page || page.missing !== undefined) return {exists: false, redirects};
  return {
    exists: true,
    lang,
    title: page.title,
    url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
    redirects
  };
}

async function resolveWiki(term) {
  if (term.pinnedNull) return {wiki: null, note: '固定 null（已确认无条目 / 按课件规则不挂链接）', redirects: []};
  for (const lang of ['zh', 'en']) {
    for (const candidate of term.wiki[lang]) {
      const result = await checkTitle(lang, candidate);
      if (result.exists) {
        return {wiki: {lang: result.lang, title: result.title, url: result.url}, note: `${result.lang}:${candidate}`, redirects: result.redirects};
      }
      await sleep(REQUEST_DELAY_MS);
    }
  }
  return {wiki: null, note: 'zh/en 均无条目', redirects: []};
}

async function main() {
  const seen = new Set();
  for (const t of TERMS) {
    if (seen.has(t.term)) throw new Error(`术语重复：${t.term}`);
    seen.add(t.term);
  }
  const lines = [];
  let linked = 0;
  let nullCount = 0;
  const categoryStats = Object.fromEntries(CATEGORIES.map(c => [c.id, {total: 0, linked: 0}]));
  const termsByCategory = Object.fromEntries(CATEGORIES.map(c => [c.id, []]));

  for (const t of TERMS) {
    const {wiki, note, redirects} = await resolveWiki(t);
    wiki ? linked++ : nullCount++;
    categoryStats[t.category].total++;
    if (wiki) categoryStats[t.category].linked++;
    termsByCategory[t.category].push({term: t.term, en: t.en, definition: t.definition, wiki});
    const redirectNote = redirects.length ? `（重定向：${redirects.join('；')}）` : '';
    lines.push(`  [${t.category}] ${t.term} → ${wiki ? `${wiki.lang} “${wiki.title}” ✓ ${redirectNote}` : 'wiki=null（' + note + '）'}`);
  }

  const glossary = {
    generated_at: new Date().toISOString(),
    source: SOURCE,
    categories: CATEGORIES.map(c => ({id: c.id, label: c.label, terms: termsByCategory[c.id]}))
  };
  await fs.mkdir(path.dirname(OUT), {recursive: true});
  await fs.writeFile(OUT, JSON.stringify(glossary, null, 1) + '\n');

  console.log(lines.join('\n'));
  console.log('');
  console.log(`术语总数：${TERMS.length}；挂链接：${linked}；wiki=null：${nullCount}`);
  for (const c of CATEGORIES) {
    console.log(`  ${c.label}（${c.id}）：${categoryStats[c.id].linked}/${categoryStats[c.id].total} 有条目`);
  }
  console.log(`已写出 ${OUT}`);
}

main().catch(err => {
  console.error(`生成失败：${err.message}`);
  process.exit(1);
});
