# 第四讲 Stencil 课件：真实 patchouli 全链路 + 旧移植实验拆除

## 背景与已确认事实

- 教案：`第四讲材料/02_第四讲授课教案_知识组织原则版.md`（导言+八章+结语+附录二检查表，9 个演示锚点）。
- `apps/week03` 是已发布的 Stencil 4.45 课件工程（namespace week03、baseUrl `/pku-aihis/week03/`、coi-serviceworker、bootstrap.js、deck-container/deck-slide/deck-presenter/layout-split、lesson-lab 按 demo-id 渲染、page-map.json 三处互锁）。
- `apps/week04` 现状：Vite 移植实验。可复用模块：`src/library.js`（内存 SQLite+41 迁移+CRUD+修订+FTS+证据 URI+备份恢复）、`src/pdf-ocr.js`（PDF.js 部分）、`src/storage.js`、`src/bibliography.js`、`src/styles.js`、`core-probe/`（Blazor WASM：ValidateTree/CompilePage/NormalizeTags/RenderCsl）、`scripts/import-patchouli.mjs`、`scripts/prepare-assets.mjs`、`native-probe/`。不可复用：`src/main.js`（DOM 胶水）、Vite 专有语法（`import.meta.glob`、`?url`）。
- **OCR 决策（已实测）**：MinerU 云 API 预检 405 且无 ACAO → 浏览器跨域不可用 → **只用 RapidOCR（onnxruntime-web + PP-OCR 系列 ONNX 模型，本地资产离线运行）**；移除 tesseract.js 链路，不保留两套 OCR。
- 用户已确认：完整版约 24-28 页；共享活体库+全链路实时演示；种子数据用本地 patchouli 库（MCP `http://localhost:4536/mcp`，本环境 `mcp__patchouli__*` 工具同源可用，库 206 条题录）真实文献 + WPS 云盘 PDF 书库对应文件；week04 同步纳入全站构建（不实际部署）。
- 本地库候选种子史料：如「布哇条約一件」系列、「哇国往復書翰」等日文档案（体积小、扫描件）；执行时按"OCR 完整、页数少、PDF < ~20MB、无乱码"标准筛 2-4 种。

## 工程形态

把 `apps/week04` 从 Vite 实验改造为 Stencil 课件工程（复刻 week03 骨架，非脚手架从零生成）：

1. **package.json**：`@stencil/core 4.45.0` + `typescript`；保留 `@sqlite.org/sqlite-wasm`、`fflate`、`@noble/hashes`、`@citation-js/*`、`pdfjs-dist`、`playwright`、`pdf-lib`（测试合成 PDF）；新增 `onnxruntime-web` + RapidOCR 模型资产；**移除 `vite`、`tesseract.js`**。scripts 对齐 week03（`start`/`build`/`check`/`test`）+ 保留 `build:core`、`prepare:assets`、`import-patchouli`。
2. **stencil.config.ts**：namespace `week04`，baseUrl `/pku-aihis/week04/`，www 输出，copy 资产（core/、ocr/、seed/、vendor wasm、coi-serviceworker.js、bootstrap.js）。
3. **外壳组件复刻自 week03**：`deck-container`、`deck-slide`、`deck-presenter`、`layout-split`、`global/app.css`、`bootstrap.js`、`coi-serviceworker.js`（sessionStorage key 改 `week04-` 前缀）。其中 `deck-container` 顶栏的"模型接入"按钮（dispatch `open-model-settings`）一并复刻，作为配置面板入口；**顶栏同时新增"导出 SQLite"按钮**：调用活体库的整库序列化，下载 `.sqlite` 文件。交接方式已对照 `D:/code/patchouli` 核实——桌面端无多库合并（导入不存在），正确路径是**整库打开**：UI 的"打开数据库"（`MainWindowViewModel.OpenDatabaseCommand` + `RuntimeDatabasePath`）直接打开导出文件，schema 相同（同一套 41 迁移、schema epoch 2）；PDF 源文件不入库，桌面端按 BLAKE3 哈希从文件搜索根重新绑定（浏览器侧 `rebind` 已实现同逻辑）。README 与相关页脚写明"打开而非导入"的交接步骤；导出产物由 `native-probe` 做完整性与迁移复核。
4. **模块移植** `src/` → `src/lib/`：
   - `library.ts`：`import.meta.glob` 41 个 SQL → 构建脚本 `scripts/gen-migrations.mjs` 从 `vendor/patchouli` 生成 `src/lib/migrations.generated.ts`；`sqlite3.wasm?url` → copy 资产 + `locateFile`。
   - `pdf.ts`：保留 openPdf/inspectPdf/renderPdf/extractText；worker 走静态资产 URL。
   - `ocr.ts`（新）：RapidOCR 封装——惰性加载 onnxruntime-web WASM 与 det/cls/rec ONNX 模型（`prepare-assets.mjs` 固定版本+SHA-256 下载到 `src/assets/ocr/`，写入 `models.json`），输出与原 `ocrPages` 相同形状（行级 bbox+置信度、AbortSignal），直接喂给 `Library.commitPages`。
   - `core-bridge.ts`：抽自 main.js 的 bootCore（隐藏 iframe 加载 Blazor、轮询 coreReady、挂 window.DotNet）。
   - `storage.ts`/`bibliography.ts`/`styles.ts` 近乎原样。
   - `live-library.ts`（新）：共享单例——启动 CoreProbe+SQLite+迁移，加载 `assets/seed/seed.json`，真实走 `importPdf`（BLAKE3）→ `commitPages`（重放种子页文本为真实修订）→ `reindex`；向各演示组件暴露查询 API；首个演示页惰性启动并显示真实启动进度。
5. **种子数据** `scripts/export-seed.mjs`：经 MCP HTTP 选 2-4 种文献（标准：OCR 完整、页数少、无乱码、PDF 体积小），取回题录 bib、页级文本、修订元信息、标签；按题名在 `C:\Users\squaresum\WPSDrive\615704893\WPS云盘\PDF书库` 定位并复制 PDF；产出 `src/assets/seed/seed.json`+PDF+来源记录（patchouli URI、库修订号、PDF SHA-256）。MCP 不可达即失败，不造数据。

## 幻灯片页面规划（31 页 D00–D30，D 编号 ↔ 教案节号 ↔ 演示锚点；两个附录不进课件）

外壳与节奏：D00 dark hero 封面，章节转场用 dark 页，正文 light；每页 `notes` 按"目的/范例引导/机制背景"三段写（skill Step 4.P）；页脚标数据来源与实际运行模式（实时/预置）。

| 页 | 教案 | 内容与交互（live=真实调用活体库/CoreProbe） |
|---|---|---|
| D00 | — | 封面（dark hero） |
| D01 | 导言 | 找得到·辨得清·引得准：三重需求与今天的数字重演 |
| D02 | 导言 | 目录学时间线（卡利马科斯→刘向→Fihrist→Panizzi→Cutter→阮冈纳赞→FRBR→FAIR），横向 timeline |
| D03 | 导言 | 八原则总览（8 卡 grid，原则一裁判其余） |
| D04 | 演示1 | **live** 三层视图：题录列表/附件与笔记/全文检索命中——真实种子库；课堂提问锚点 |
| D05 | 1.1 | 元数据·条目·附件；"条目完整/附件存在/正文读过"三状态 |
| D06 | 演示2① | **live** patchouli 状态字段机：题录/文档/源文件/索引/可引用各司其职，"有题录无文件"能做什么不能做什么 |
| D07 | 1.2 | 充分且必要：最小字段集；标签数≈题录数反例 |
| D08 | 1.3 | 版本与引用定位：成文/出版/扫描/修改四时间分层 |
| D09 | 1.4 | FRBR WEMI 四层 + 《资本论》实例（stepper 逐层展开属性归属） |
| D10 | 1.4/演示2② | 四工具"同一文献是谁"对照；**live** patchouli 投影重建（重建 FTS 索引，原数据不动） |
| D11 | 1.5 | 字段语义：Dublin Core source 引文与误配风险 |
| D12 | 1.6/演示2③ | 标准化链 ISBD/MARC21/CSL；**live** RenderCsl：同一题录换样式双语渲染（Fsharp.Citeproc 真跑） |
| D13 | 1.6 | 标识符与 Plan 9 名字空间；**live** `patchouli://` URI 解析到页/修订/文本块 |
| D14 | 2.1/演示3① | **live** 收藏与标签云：主题标签 vs 状态标签指认；权威存储+派生投影 |
| D15 | 2.2 | 简约原则：一装置一功能；Lubetzky 1953 批评 |
| D16 | 2.3 | 可演化结构：冒号分类法/好客性/SKOS 不过度承诺/开闭原则 |
| D17 | 2.4-2.6/演示3②③ | 四工具管理对象表；阅读队列诊断；集合说明现场起草模板 |
| D18 | 3.1/演示4① | **live 嵌入式 agent**：六种任务（筛选/抽取/释义/概括/比较/验证）真实调用 LLM API；agent 在浏览器内实时检索活体库（FTS5），命中返回 `patchouli://` vfs 引用；回答中每条引文是可点击 URI 芯片，在侧栏解析回页/修订/文本块；agent 循环可见（检索词→命中→上下文→回答）；引文校验复用 week03 `model-client.ts`（引用必须来自已提供上下文 ID）；模型接入复用 week03 模式（顶栏"模型接入"按钮+弹出面板，OpenAI 兼容端点/本地课堂桥）；未配置 API 或模型未就绪时控件禁用并浮出 tooltip 引导打开面板，绝不用预存输出冒充生成 |
| D19 | 3.2-3.5 | 输入范围服从任务；核验写回；未完成保存；元认知监控（含 Fu/Kreijkes 证据边界） |
| D20 | 4.1/演示5 | 笔记职责五分；阿伦斯四类笔记；**live-ish** 来源笔记四成分标出练习（真实种子文献文本） |
| D21 | 4.2 | 卢曼卡片盒四机制（固定地址/未来相关性/选择性引用/稀疏索引）：分支编号插入为纯前端真实算法演示 |
| D22 | 5.1-5.2/演示6 | 三层链接；RDF 三元组；关系光谱；**live** patchouli 引用解析"宁可不知道也不猜" |
| D23 | 5.3-5.5 | 反向链接/未链接提及/问题索引/证据矩阵衔接第三周 |
| D24 | 6.1-6.2 | OpenRefine 分面与聚类；一行代表什么；原值/规范值/判定依据 |
| D25 | 6.3/演示7 | 词汇控制 SKOS；**live** NormalizeTags 大小写实验 + 改名即归并；太平天国异称词表记录（prefLabel/altLabel/scopeNote） |
| D26 | 7.2/演示8① | 可追溯四点解剖：**live** RapidOCR 真跑一页种子扫描件→提交新修订→不可变触发器拒绝改写旧修订→旧引用 URI 仍解析到旧版 |
| D27 | 7.3-7.5/演示8③④ | 同步/导出/备份/恢复四职责三工具对照；**live** find—fetch—cite 最小链 + ZIP 备份/恢复 roundtrip |
| D28 | 8.1-8.2/演示9 | 六方面质量验收自己的系统；基础/应用/扩展分层；回到 D04 三层视图重新提问 |
| D29 | 结语 | "使过去的阅读能够进入新的问题"：八原则收敛为"组织是为了未来的使用"（不含两个附录，附录不进课件） |
| D30 | 词汇表（新增页，教案外） | 仿 aihero.dev/ai-coding-dictionary 形态：左侧搜索栏+术语标题列表（客户端真实过滤），右侧按四类分表——基本概念（题录、元数据、条目、附件、受控词汇、持久标识符…）、标准（Dublin Core、ISBD、MARC21、CSL、FRBR/LRM、SKOS、RDF、FAIR、ISO 25964…）、技术实现（Zotero、JabRef、Tropy、patchouli、OpenRefine、DocuSky、Obsidian、SQLite FTS5、MCP…）、理念方法（卡片盒笔记法、图书馆学五定律、开闭原则、最小本体承诺、实体–关系模型…）；点击术语跳转对应 Wikipedia 条目（zh/en，构建期逐条 HEAD 验证存在性，无条目者不挂链接），数据为 `src/assets/data/glossary.json` 真实清单 |

复杂机制的方案 A/B 记录进 `docs/week04/design.md` 与 `page-map.json`（沿用 week03 字段：id/section/title/action/evidence/mode/option_a/option_b），三处 ID 互锁。

## 执行步骤

1. `pnpm install` 调整依赖；改造 package.json/stencil.config.ts/tsconfig。
2. 复制 week03 外壳组件与全局样式，改 namespace/前缀。
3. `scripts/gen-migrations.mjs` + 移植 src/lib 各模块；`core-bridge` 与 `live-library` 单例。
4. 改 `scripts/prepare-assets.mjs`：保留 `public/core` 组装；删 tesseract；新增 RapidOCR 模型（det/cls/rec ONNX + onnxruntime-web WASM，固定版本+SHA-256 入 `models.json`）。
5. `scripts/export-seed.mjs` 跑通真实种子导出（用 mcp__patchouli 工具先人工筛选候选）。
6. 写演示组件（library-explorer/status-machine/csl-renderer/uri-resolver/tag-lab/revision-ocr-lab/backup-lab/reading-agent/glossary-view 等）与 `src/index.html` 全部 slide + notes；移植 week03 `model-client.ts`/`model-connection` 组件支撑 D18 agent 页：
   - **配置面板**（模仿 week03 顶栏入口）：顶栏"模型接入"按钮 → 弹出面板，内含 LLM API 配置（端点/模型/API Key，OpenAI 兼容+本地课堂桥）与模型/资产加载区（CoreProbe WASM、RapidOCR ONNX 模型、活体库种子的加载状态与手动预载按钮，显示真实进度与失败原因）；
   - **缺配置 tooltip**：演示组件依赖未就绪时（无 API Key、模型未加载、活体库未启动），交互控件禁用并浮出 tooltip 提示"点击右上角'模型接入'完成配置"，tooltip 点击同样 dispatch `open-model-settings` 打开面板；配置完成后组件自动恢复可用。统一实现为 `config-hint` 组件 + `live-library`/model-client 的就绪状态订阅，各演示页复用；
   - 写 `scripts/build-glossary.mjs` 生成 `glossary.json`（术语四类清单 + Wikipedia zh/en 条目 HEAD 存在性验证，无条目不挂链接）。
7. 文档：`docs/week04/design.md`、`page-map.json`；改写 `browser-port.md` 为模块复用与新验证记录（保留原验证结论作为模块级证据）；记录 MinerU CORS 实测与 OCR 引擎决策；更新 `docs/third-party-notices.md`（Patchouli GPL-3.0 分发义务：site 产物附 LICENSE+manifest+源码链接；PaddleOCR 模型 Apache-2.0；onnxruntime MIT）；AGENTS.md 当前阶段补一行 week04 基线。
8. 测试：
   - `node --test` 单元：迁移执行器、URI 解析、种子清单完整性、标签归并逻辑。
   - `scripts/check-week04-browser.mjs`（Playwright 真实浏览器）：活体库启动、种子加载、CSL 渲染断言、标签归并、修订 URI 回查、RapidOCR 真实跑通一页（合成扫描页）、ZIP 备份恢复、顶栏"导出 SQLite"产出非空且头部为 SQLite magic、零远端请求、演讲者模式同步、Pages 子路径、D18 未配置模型时的 tooltip 降级（有本地模型桥则追加真实生成+引文回跳断言）、D30 词汇表搜索过滤与 Wikipedia 链接存在性抽查。
   - `native-probe` 沿用复核导出库。
9. 全站：`published-weeks.json` 加 `week04`；`build-site.mjs` 通则验证产出 `site/week04`；`check-public.mjs` 增加 week04 段（slide-id↔page-map 互锁、GPL LICENSE 在场、无模型权重之外的违禁物等）。不实际部署 Pages。
10. **删除旧移植实验**：`vite.config.mjs`、`src/main.js`、`src/style.css`、旧 `index.html`、旧 `tests/browser.mjs`、tesseract 相关资产与代码路径；重写 `apps/week04/README.md` 为课件工程说明。保留 `core-probe/`、`native-probe/`、`import-patchouli.mjs`（新工程仍依赖）。
11. 交付前按 skill `references/checklist.md` 与 presenter 校验脚本自检；视觉逐页过一遍（真实浏览器），按 M1/M2 阶梯修正。

## 诚实性边界（写入课件页脚与文档）

- 嵌入=浏览器实时（onnxruntime-web PP-OCR，非 MinerU、非桌面 RapidOCRSharp）；检索=实时 FTS5；CSL 渲染=实时 Fsharp.Citeproc WASM；种子数据=本地 patchouli 库真实导出预置（标注库修订号）；D18 生成=实时 LLM 调用（标注实际所连端点与模型；未连接时经 tooltip 引导至顶栏"模型接入"面板，不留预存回答）；D20 成分标出练习为教学构造并明确标注，不冒充模型输出。
- D18 验收：本地课堂模型桥可用时真实跑通"任务→检索→引用解析"全链并在 `docs/week04/` 记录实际模型与结果；桥不可用时只验证降级路径并明确记录"生成环节未运行"。
- CoreProbe WASM 含 GPL-3.0 代码，发布产物须附许可与源码指引。
