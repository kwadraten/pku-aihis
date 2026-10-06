> 历史选品记录：旧74页试验库已经删除；当前使用正式Milk Is Gold记录、353页和四份完整PDF，见[native-subset.md](native-subset.md)。本页不再描述活动实现。

# 第四讲课件种子文献选品记录

- 任务：为 week04 课件挑选真实种子文献，供浏览器内重放「建题录 → 导入 PDF → 提交页文本修订 → 建 FTS 索引」。
- 数据源：本机 patchouli 文献管理器 MCP（`http://localhost:4536/mcp`，Patchouli.Net 0.3.6）实时读取 + 本机 PDF 书库拷贝。
- 导出产物：`apps/week04/src/assets/seed/seed.json` + `apps/week04/src/assets/seed/pdfs/`。
- 导出脚本：`apps/week04/scripts/export-seed.mjs`（重跑幂等覆盖；全部数据实时取自 MCP/书库，无手工编造）。
- 导出时图书馆版本：`lib:5075`（library_id `c20f45e1-5432-48a4-bca4-c4bc91844120`）。该库是活的，revision 会随写入增长；本记录定稿时抽查区间为 `lib:5072`–`lib:5075`。

## 一、入选清单（4 题录 / 4 文档 / 74 页）

| key | 题录 | 文档 | 语言 | 页数 | 集合 | PDF |
| --- | --- | --- | --- | --- | --- | --- |
| i1 | Can the Subaltern Speak?（Spivak 1988 章节，`ef26f586-3974-42d9-8b0c-94b0a605df73`） | `10a8f257-14d2-44cc-a253-5ac5e3c21528` | 英 | 23 | 亚非拉近现代史研究 | ✅ 2.64MB |
| i2 | A Dancing Bear, a Colleague, or a Sharpened Toolbox?（Ma/Dedema/Cox 2024, arXiv:2404.12458，`a6b3ba05-1989-454e-a583-97672d2a488a`） | `3520c3f0-5daf-4527-9231-d76f6fd237b3` | 英 | 29 | 人工智能赋能历史研究与写作 | ✅ 0.97MB |
| i3 | 元文元年の貨幣改鋳思想（藤井定義 1984，《商経学叢》30 卷 79 号，`bd70fce9-6c47-4da5-a894-c2b1f7141255`） | `08b4f303-d6d5-41c0-a395-48cd79940bfd` | 日 | 22 | （无集合，真实未归类状态） | ❌ `pdf:null`，原因见下 |
| i4 | Milk Is Gold（重复题录，`c7319a59-094d-41a8-8db3-d2b4a13abe8c`） | `f8e565ef-6941-4ce2-b4be-9933142a4370` | 英 | 0 | 亚非拉近现代史研究 | ❌ `pdf:null`，原因见下 |

- 语言覆盖：英 ×3 + 日 ×1，满足「中/日/英至少两种」。中文题录全部因页数或 PDF 体积超限未入选（见第三节），这是真实约束而非遗漏。
- 两个 `pdf:null` 都是真实状态，且原因不同，各有教学价值：
  - i3 `oversize_pdf`：书库中存在对应文件「元文元年の貨幣改鋳思想.pdf」，但实测 **19,973,695 字节 ≈ 19.97MB**，超过单文件 15MB 上限，故不带文件、只导出 22 页已提交文本。
  - i4 `duplicate_no_file`：该题录是 Milk Is Gold 学位论文的**重复记录**（其 biblatex 备注原文：「与本库已著录的同一著作（@thesis，1e5d7930）重复，建议合并。」）。书库里的 `Milk_Is_Gold_An_Environmental.pdf`（1.79MB）属于另一条题录 `1e5d7930`，本条重复记录没有自己的文件，也没有已提交文本树（0 页）。用它演示「查到重复题录、无文本可修订」的支路。
- i3 的 page-22 原文即空页（MCP 返回空字符串，page-23 为 NOT_FOUND），如实保留为空串。

## 二、抽查记录（每个入选文档首/中/尾 ≥5 页）

抽查方式：`patchouli_fetch` 逐页拉取原文，人工阅读确认文字连贯、无大面积乱码。以下为各页摘录片段（原文照抄，个别长段截断以 … 表示）。

### i1 Can the Subaltern Speak?（10a8f257，23 页）

- p1：`# 4 □ Can the Subaltern Speak? / # Gayatri Chakravorty Spivak … Some of the most radical criticism coming out of the West today is the result of an interested desire to conserve the subject of the West, or the West as Subject.`
- p8：`The task of research' projected here is 'to investigate, identify and measure the specific nature and degree of the deviation … Yet a curious methodological imperative is at work.`
- p15：`Whether this observation is correct or not, what interests me is that the protection of woman (today the 'third-world woman') becomes a signifier for the establishment of a good society …`
- p22：`47. This violence in the general sense that is the possibility of an episteme is what Derrida calls 'writing' in the general sense. …`
- p23（末页）：`'Some widows, however, had not the courage to go through the fiery ordeal; nor had they suffi…`

结论：全书页英文连贯，脚注编号完整，无乱码。✅

### i2 A Dancing Bear…（3520c3f0，29 页）

- p1：`# A dancing bear, a colleague, or a sharpened toolbox? … Rongqian Ma^{1*}, Meredith Dedema^{1}, Andrew Cox^{2}`
- p7：`As a field shaped by layered technological, institutional, and intellectual entanglements, the development of DH exemplifies the socio-material assemblages that ANT seeks to theorize.`
- p14：`# 4.3 Perceptions of GenAI among DH Communities … Survey data (Figure 4) show that 78% of DH scholars (n = 29) anticipate "mistakes or inaccuracies" in AI-generated texts`
- p21：`From an ANT perspective, this emergent, reconfigured network holds the power to transform how DH knowledge is produced.`
- p28：`Reif, J. A., Larrick, R. P., & Soll, J. B. (2025). Evidence of a social evaluation penalty for using AI. Proceedings of the National Academy of Sciences, 122(19), e2426766122.`

结论：arXiv 排版文本干净，含图表说明与完整参考文献。✅

### i3 元文元年の貨幣改鋳思想（08b4f303，22 页）

- p1：`ISSN 0450—2825 / 近畿大学 / # 商經学叢 / # 竹中靖一博士退任記念論文集 / 第30卷特别号（通卷第79号）1984年3月`
- p5：`「今金銀半分の内に減り，慶長の昔に返れども，世界の奢り風俗の常と成たる所は，慶長の比と遙に別也，ふへたる竈も昔に復らざれば，…`
- p10：`次に春台の金銀改鋳思想をみると，まず「元禄の悪金の如きは，堅く禁止して世に行はしむまじき物也」…`
- p15：`次に大阪の両替商であり，町人学者としても著名な山片蟠桃の元文改鋳と米価関係をその著「夢の代」（享和2年（1802年）刊行）から，…`
- p22（末页）：空页（MCP 原文为空字符串）。

结论：现代排版的日语学术论文，连贯无乱码。✅

### i4 Milk Is Gold 重复题录（f8e565ef，0 页）

- page-1 即 NOT_FOUND：该文档只有目录壳，没有已提交文本树。0 页如实导出为空 `pages: []`。✅（作为「无文本树」真实案例入选）

## 三、PDF 来源与哈希

| key | 产物路径 | 书库源路径 | 字节数 | sha256 |
| --- | --- | --- | --- | --- |
| i1 | `pdfs/can-the-subaltern-speak.pdf` | `C:/Users/squaresum/WPSDrive/615704893/WPS云盘/PDF书库/Can-the-subaltern-speak-by-Gayatri-Spivak.pdf` | 2,639,109 | `72792342e7720b6fd9f4a08a48afc6f2b23c596d795588a5b22192cfb7e47700` |
| i2 | `pdfs/2404.12458v4-dancing-bear.pdf` | `C:/Users/squaresum/WPSDrive/615704893/WPS云盘/PDF书库/2404.12458v4.pdf` | 974,319 | `1f194be16fc66f70e35251b345fd795b529b58871a7ac3c37ab3ba0fe70f9a3f` |
| i3 | `null` | （书库「元文元年の貨幣改鋳思想.pdf」19,973,695 字节，超限） | — | — |
| i4 | `null` | （无自有文件；同名 PDF 属于 1e5d7930） | — | — |

- 哈希校验：导出后已重算产物文件 sha256，与书库源文件一致（`sha256sum` 复核通过）。
- 页内容校验：seed.json 内 74 页 Markdown 与 MCP 实时原文逐字比对，全部一致。

## 四、标签与集合说明（词表混杂是教学素材）

- 题录库共 200 个标签、101/206 条题录带标签；词表真实混杂 NDC 类号（如 `210.5`、`219.3`）、日语（`日本`、`外国関係`、`江戸時代`）与英语（`History`、`Asian history`）。示例：`1e5d7930` 带 12 个标签（`0332:Asian History` + `Animal history` + `210.x` 类号等）；`31e0877a` 带 `Specx、Jacques、1585?-1645?`、`オランダ`、`GB381` 等 11 个。
- 标签来源：`library.toon` 只暴露全库词表与计数，不暴露逐题录映射；逐题录 tags 由脚本用 MCP 原生 `where: ["tag=…"]` 过滤对全部 200 个标签反查得到，反查结果计数与 library.toon 逐一相符（0 处不一致）。
- **入选 4 题录经反查均未携带任何标签，seed.json 中 `tags: []` 是如实记录**。该库对 MCP 导出 .bib 时会为带标签题录注入 `keywords` 字段（实测例：题录 `1e5d7930` 的 .bib 含 `keywords = {Animal history, Environmental history, Livestock, Mongolia, Nomadism, Socialism, History, Asian history, Environmental studies, 0477:Environmental Studies, 0578:History, 0332:Asian History}`——NDC 类号、日语、英语混排的直观样本）；入选 4 题录的 .bib 均无 keywords，与反查结果互相印证。
- 集合归属同样用 `where: ["collection_id=…"]` 反查：i1、i4 ∈ 亚非拉近现代史研究；i2 ∈ 人工智能赋能历史研究与写作；i3 未归入任何集合（真实未归类）。漂流民送还体制集合的 6 条题录均无干净文本（见下），本批未覆盖该集合。

## 五、未入选候选及原因

| 候选 | 原因 |
| --- | --- |
| 「和魂汉才→和魂洋才」（`827ec9cf`，中文） | 无已提交文本树（用户已确认），page-1 即空 |
| 「和親条約期の幕府外交について」（`f4de99cf`，日文） | 同上，无文本树 |
| 「布哇条約一件」系列（`82347156` 等 4 件，日文） | 草书 OCR 乱码重（用户已确认）；同系列的「通信全覧索引」类小册（`f48735d2` 米国往復書簡目録、`6fddf30d` 哇国往復書翰目録等）抽查 p1/p10/p30 见 `一一一、、、、〇〇`、「人間の人のものである」等填充噪声与 `\2000…` 乱码，不达标 |
| 「対馬 御在国毎日記」（`a4c11fd7`，日文，51 页） | p1 干净，但 p13/25/38/50 大量 `□□□` 替换符与列序错乱（`同三浦御頼 / 之儀御指 / 之儀御願` 碎片），乱码比例过高 |
| 「記録類 3-47-184」（`a919a3ac`，日文，37 页） | 草书 OCR 错误多（`我々蒸葬之如く`、`訓唇答` 等），不达标 |
| 「九州歴史資料館 幕末の城」（`98daecc7`，日文，54 页） | 正文干净但 p30 等页整段草书 OCR 乱码（`於同齊之品《壢棟》申成後我先贄計服懸念款後彼…`） |
| Milk Is Gold 索引版（`1e5d7930` / `ca0d41b6`，279 页） | 单文档 279 页，远超 60 页上限 |
| 「朝鮮通信使および前近代日朝関係史研究目録」（`43b48d0a`，日文，27 页，文本干净） | 文本合格，但书库 PDF 26,228,524 字节 ≈ 26.2MB 超 15MB 上限；与 i3 二选一，保留页数更少的 i3（两本中文书同样因 200-425 页超页数上限未入选：西学东渐 347p、景观社会 259p、日本近现代文化史 425p 等） |
| 「Strangers in a Strange Land」（`9f64e585`，英文，10 页） | 10 页文本全部为空（纯扫描图，无 OCR 文本），无法支撑 FTS 重放 |
| 「元文改鋳」之外的其余 AI 综述（`d215aa42` 59p、`d1b9df76` 58p、`4fe1049e` 37p，均英文干净） | 文本与 PDF 都合格（书库有同名 arXiv PDF）；为控制总页数（≤120 页）未选，可作为后续扩容备选 |
| 漂流民送还体制集合全部 6 条（`31dbf099` 等） | 除 Transpacific Nonencounters 209 页超上限外，其余均无文本树（no_ocr）；该集合本批无法覆盖 |

## 六、seed.json 统计与契约对齐

- 字节数：292,522 字节（导出时；`exported_at` 每次重跑变化，其余内容幂等）。
- 页数：i1=23，i2=29，i3=22，i4=0，合计 74 页；单文档 ≤60 页、总量 ≤120 页达标。
- 契约对齐：
  - `source`：`mcp_url` / `library_id` / `library_revision` / `exported_at` / `note` 齐全；note 说明 csl 缺省原因（MCP 不提供 CSL-JSON，加载端用 @citation-js 解析 biblatex）与两个 `pdf:null` 的原因。
  - `items[]`：`key` `csl`(缺省) `tags` `collections` `pdf` `pdf_sha256` `source_uri` `biblatex`；biblatex 为 `.bib` 资源原文逐字拷贝。
  - `documents[]`：`item_key` `source_text_uri` `title` `pages[]`；`page_index` 从 1 开始，与 patchouli 页资源编号一致。
- 验证记录：页内容逐字比对 MCP 原文 74/74 一致；PDF sha256 与书库源一致；脚本重跑两次（除 `exported_at` 外）输出完全一致。
