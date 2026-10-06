# 第四讲模块复用与接续验证

2026-10-06：当前入口已改为31页Stencil课件，旧Vite/Tesseract入口撤除。当前实际测试对象与范围见[接续验收](completion.md)，制作按[任务文档](metamorpho-aquaman-bishop.md)执行。

原实验提供可复用的SQLite迁移、文档树校验／编译、修订／检索／备份模块；CoreProbe与NativeProbe继续作为同一课件的运行和验证工具。OCR改为RapidOCR模型的浏览器适配，PDF.js补齐扫描解码WASM、CMap和字体资产。原有实验结果仅证明其受测版本，不能作为新课件全链路通过的证明。

## 旧移植验证（历史记录）

# 第四讲文献管理器浏览器移植验证

2026-10-06。本轮范围是可运行性准备，不制作 PPT，不定稿教案，不发布网站。

## 输入与结论范围

已阅读《02_第四讲授课教案_知识组织原则版.md》v1.4。该文件仍是用户指定的未完成稿，
只用于辨认需要的研究操作：三层材料身份、集合/标签、来源笔记、不可变修订、页级证据和导出恢复。
没有将其具体文字、演示顺序或页数写进课件。
教案在本轮期间仍有编辑；后续再次读取时的 SHA-256 为
`abd8ef28cff7294c174404100943588ec9f838a768cb1404699bfca99b271df7`。
这个散列只定位该次读到的草稿，不能作为教案已经定稿的证明。
其中关于“题录投影可推倒重建”的措辞需要后续与源码核对：Patchouli 的
`ItemMetadata` 按当前领域文档是持久的用户知识，不能像 FTS 索引一样机械重建。
本原型据此保存题录、笔记和标签，索引重建不丢弃它们；没有直接修改草稿。

Patchouli 只读基线：`D:/code/patchouli`，提交 `5ad3455cf602e05fd84ce2416b17c030ee9a5276`，
应用 0.3.6，schema epoch 2。原工作区有大量未提交开发，未切换分支、修改、清理或提交其中任何文件。
本轮选中的 185 个受跟踪输入文件与该提交一致；其内容哈希另列来源清单。
未纳入尚未提交的 Agent/Workflow 扩展作为已完成能力。

结论：能够在纯浏览器完成本轮受测的文献管理与证据链，不需要桌面后端代执行 PDF、OCR 或数据库读写。
这不是“整个桌面后端原样移植”或“全部功能已等价”的结论；未完成的功能见后表。

## 运行组成

| 层 | 实际实现 | 复用/适配边界 |
|---|---|---|
| 领域与文档处理 | .NET 10 / Blazor WebAssembly | 原 Core 源码；原 DocumentTreeValidator、DocumentMarkdownRenderer、DocumentBoxProjection、DocumentBoxPayloadSerializer、MarkdigMarkdownEngine |
| 引文 | 原 FsharpCiteprocProcessor + Fsharp.Citeproc 1.1.0 | C# 原实现实际在 WASM 中渲染，不用预存引文 |
| 数据库 | SQLite 官方 WASM 3.53.4 | 原 41 个迁移、外键和不可变触发器；数据库连接/操作编排为 JS 浏览器适配 |
| PDF | PDF.js 6.4.299 | 替代原生 PDFium；文字层提取与 OCR 分开标注 |
| OCR | Tesseract.js 7.0.0 / Tesseract LSTM WASM | 实时识别；替代原生/远端 OCR，不冒称 MinerU、RapidOCR 或 NDL 的结果 |
| 文件身份 | 真正 BLAKE3 | 文件名/浏览器位置不是身份；重新绑定必须与已存哈希一致 |
| 持久化 | IndexedDB + 单写入 Web Lock | SQLite 在内存运行，每次成功变更保存完整映像；PDF 为独立文件副本 |
| 题录交换 | CSL JSON + Citation.js 0.9.0 BibLaTeX 适配器 | 替代桌面 Rust helper；已测基础书目往返，复杂 TeX/自定义档案字段没有全量等价证明 |

原数据库使用 Microsoft.Data.Sqlite/Dapper，原 PDF/OCR 包使用 PDFium、Skia、ONNX 原生运行时；
不能靠换宿主将这些依赖自动变成浏览器能力。当前复用纯托管机制和 SQL，分别替换平台依赖。
Blazor 支持范围以 [Microsoft 文档](https://learn.microsoft.com/en-us/aspnet/core/blazor/supported-platforms)为准；
SQLite 浏览器存储选项见 [SQLite 官方说明](https://www.sqlite.org/wasm/doc/trunk/persistence.md)。
后续同模型 OCR 适配可采用 [ONNX Runtime Web](https://onnxruntime.ai/docs/get-started/with-javascript/web.html)，
但本轮没有把其存在当作原生 OCR 已移植的证据。

模型在准备阶段下载；页面运行均从本地静态资源加载。
语言模型固定取 `tesseract-ocr/tessdata_fast` 的 `4.1.0` 版本：eng 4,113,088 字节，
chi_sim 2,469,156 字节，chi_tra 2,366,642 字节；SHA-256 见 `public/ocr/models.json`。
实测为简体中文+英文；繁体模型已下载、可选，尚无独立繁体质量验收。
OCR 分数只描述识别输出，不表示史实可信度。

## 本轮受测功能与剩余范围

| 本地能力 | 浏览器原型情况 | 实测/限制 |
|---|---|---|
| PDF 导入和渲染 | 已实现、已测 | 文件/题录/文档/页原子写入；坏 PDF 在解析阶段拒绝；未复刻桌面 20% 坏页容错 |
| 一个题录多个文档实例 | 已实现 | 独立文档和文件身份；本轮测试主流程为单文档，添加实例有入口 |
| OCR 当前页、全文 | 已实现、已测全文 | 中英扫描页真实识别；空白页保留占位；非历史版面精度基准 |
| OCR 停止/运行状态 | 已实现、已测 | 停止不改变已提交文本；记录 cancelled；失败原子保全当前历史 |
| PDF 已有文字层提取 | 已实现、已测 | 明确标为非 OCR；无文字层不能伪装成已识别 |
| 题录新增、修改、笔记、处理状态 | 已实现、已测 | 当前表单为常用字段；CSL 导入保留扩展变量；非完整桌面类型感知编辑器 |
| CSL/BibLaTeX 交换 | 已实现、已测基础往返 | 结构化作者、日期进入原表；未经全量特殊字段测试 |
| 切换引文体例 | 已实现、已测 | 原 C# 引擎渲染两种课堂 CSL 样式；可载入自选样式，不冒称 APA/Chicago |
| 集合多对多、移除、解散 | 已实现、已测 | 解散不删除题录，集合不嵌套 |
| 标签筛选、大小写、归并 | 已实现、已测 | 原 TagNormalizer 在 WASM 执行；文本不会随标签改名被替换 |
| 回收站/恢复/题录合并 | 已实现、已测 | 文档身份和证据保留；合并保留目标题录字段，没有桌面逐字段冲突预览 |
| 页级文本校正与排除检索 | 已实现、已测校正 | 原文档树校验；新增/提交/历史/恢复；拖拽 bbox、区域 OCR 尚未移植 |
| Markdown 编译/全书阅读 | 已实现、已测页编译 | 原 C# 编译器；全书按页显示文本，未复刻原生阅读器的窗口加载/排版 |
| 不可变修订和历史恢复 | 已实现、已测 | 原 SQL 触发器拒绝改写；恢复追加修订 |
| 全文检索 | 已实现、已测 | SQLite FTS5 词项与明确标注的中文子串检索；未移植 OpenCC 搜索改写/高级查询计划 |
| 证据 URI 回查 | 已实现、已测 | 页序 URI 为 1-based；rev+box 定位历史文本；合并不改变文档身份 |
| SQLite 导出/导入 | 已实现、已测自生成往返 | 保留原 schema；原生 .NET 校验通过；未对教师完整真实书库或桌面 UI做验收 |
| 完整备份/恢复 | 已实现、已测 | 含 PDF 的专用 ZIP，恢复校验数据库/PDF哈希；损坏输入不替换当前库 |
| 文件重新绑定 | 已实现 | 必须匹配 BLAKE3；不扫描任意本机目录，不自动取得桌面路径权限 |
| 大型库性能 | 未验收 | 完整映像保存、内存数据库与 PDF 副本不适于未经评估的大型库 |
| 桌面原生 OCR/远端 MinerU | 未移植 | Tesseract 不等价于 RapidOCR/NDL/MinerU，尤其古籍竖排、表格和布局 |
| 桌面快照分片/网盘同步/冲突仲裁 | 未移植 | 当前 ZIP 只是可恢复备份，不能标成桌面 Snapshot |
| MCP/CLI 监听服务和虚拟文件系统 | 未移植 | 浏览器不能监听本机 HTTP 端口或接管本机 CLI；目前只是 UI 与内部证据读写 |
| 本地 .fsx/Agent、译文工作流 | 未移植 | 原仓库未提交扩展未纳入基线，也未伪造浏览器实际模型输出 |
| 永久销毁及依赖预览 | 未提供 UI | 已有回收站、合并；未复刻桌面复杂级联清除/资产 GC |

因此不能在目前写“支持本地版绝大部分功能且完全等价”。可以写“受测的主要文献整理与证据演示链
已经在浏览器真实运行”，并附这个功能范围。若要把原管理器作为全功能桌面替代，需要继续完成剩余适配。

## 验收证据

Node 24.5.0、pnpm 10.10.0、.NET SDK 10.0.204、Edge 154.0.4258.53，1440×1000。
仓库推荐 Node/pnpm 固定版本另见根 README；上述是本次实际环境，不冒称已在其他环境运行。

自动测试使用真实浏览器、真正扫描 PDF 和实际 OCR。样本为自生成公开测试文本，不是教师私有文献或史料事实。
已测扫描页的文字层数为 0；识别得到“历史研究需要保存原文和版本”及“ARCHIVE EVIDENCE 2026”。
OCR 用时仅是本机小样本运行记录，不能外推全书速度或准确率。

测试覆盖：原 C# 验证/编译/CSL、41 个 SQL 迁移、PDF 导入、OCR 和空白页、停止 OCR、
FTS5/中文子串、触发器保护、校正/旧引用/恢复、集合和标签、回收站/合并、事务失败回滚、
浏览器重载、数据库及含 PDF 备份的恢复、损坏恢复拒绝、BibLaTeX/CSL 往返、文字层提取、
BLAKE3 重复拒绝、第二写入标签页拒绝、无远端请求。

静态生产包另在 `/week04/` 子路径、不添加 COOP/COEP 的本地 HTTP 服务器跑相同测试，
用于检查未来嵌入与 Pages 路径。它仍需要 HTTP，不支持双击 `file://`，也没有浏览器完全离线缓存服务。
本轮未做真实 GitHub Pages 发布、未运行 PPT 旧校验器、未测演讲者/33页课件行为。

原生验收程序以只读 Microsoft.Data.Sqlite（依赖与原仓库一致的新版 SQLite bundle）打开浏览器导出文件：
完整性、外键、schema epoch、41 个迁移均通过；每个已提交修订通过未修改的原 C# DocumentTreeValidator，
再由原 DocumentMarkdownRenderer 编译。本结论限于受测数据库，不等于已经在桌面 UI 导入真实教师书库。
Blazor 包锁按 Release 配置生成；冻结恢复必须同时传 `-p:Configuration=Release`，
避免 Debug 自动加入 HotReload 包而与发布依赖清单不一致。pnpm 冻结锁文件和两个 .NET 锁文件已检查。

详细机器记录保留于 `apps/week04/artifacts/browser-report.json`、`static-browser-report.json`，
截图、合成 PDF、导出 SQLite 和 ZIP 同目录保留且忽略入库。公开摘要和源码版本清单可放此目录；
个人数据库、教案原文、模型权重不进 Git，也不进全站发布清单。
精简的可审阅结果见 [browser-verification.json](browser-verification.json)，
源文件散列见 [patchouli-source-manifest.json](patchouli-source-manifest.json)，
模型定位见 [ocr-models.json](ocr-models.json)。

## 后续课件接续

在教案完成、用户选择交互方案后，按项目内 `guizang-ppt-skill` 与 `docs/skill-integration.md`
将这个独立实验入口接入 Stencil 课件。可用独立 iframe 或组件包装；保持独立存储和实际运行状态，
避免幻灯片键盘导航截获表单输入，不在本目录运行初始化器覆盖现有验证源码。
本轮只准备机制和可验收的操作，不确定最终页数、版式或教学顺序。
