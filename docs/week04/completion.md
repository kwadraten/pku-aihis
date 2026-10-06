> 最新版本为同一套Patchouli工作台上讲解理念，31页逐页充实及实际检查见[workbench-review.md](workbench-review.md)。原生子集基线见[native-subset.md](native-subset.md)。下文保留早期阶段记录。

> 当前验收以[native-subset.md](native-subset.md)为准：唯一原生子集、4题录、353页、4PDF，原schema与行逐项一致，双向回读已实测。以下保留原生抽取前的阶段检查记录，其中74页重放、2PDF和题录-only构建已被撤除，不代表当前实现。

# 第四讲接续与验收

2026-10-06。接续Kimi会话`session_9e69262c-fc5d-45ab-9943-a8463c40ed79`；执行基线为[metamorpho-aquaman-bishop.md](metamorpho-aquaman-bishop.md)、教案v1.8、[逐页设计](design.md)与[页面表](page-map.json)。原会话因额度耗尽中断，已落盘部分工程、设计稿和真实种子。本次在原`feat/week04-slides`工作区接续，保留原输入与修改，没有覆盖其他分支或强推。

## 交付范围

- 31页D00—D30：稳定页面ID、教案节号、三段讲解备注、来源／模式页脚，三份页面清单互锁。
- 第三周Stencil外壳、课程地图、表单键盘保护、演讲者窗口与课程专用BroadcastChannel；31页页面清单补齐，首页／尾页、选页、计时、备注保存与观众屏恢复入口可用。
- 同一个Patchouli活体书库：原文档树核心、41条原迁移、真实题录与74页种子重放、FTS5／子串检索、CSL渲染、URI解析、投影重建、标签／收藏、修订与导出。
- RapidOCR PP-OCRv4的det／cls／rec模型在浏览器ONNX Runtime Web推断；模型哈希固定、预载状态与失败原因显示。浏览器后处理使用轴对齐连通域，未声称完整复现上游多边形／unclip算法。取消在推断步骤间检查，已经开始的单次WASM推断不能即时中断。
- D18六种阅读任务、真实find／fetch工具循环、上下文引用白名单与点击回查；顶栏API配置和资产预载面板。端点／模型保存在localStorage，Key仅在当前页面内存。本机无认证端点允许空Key。
- 顶栏SQLite下载及桌面“打开数据库”交接；D27的ZIP备份在独立空库恢复并验证哈希与外键，不覆盖当前课堂库。
- 旧Vite入口、main.js、pdf-ocr.js、Tesseract依赖／资源与旧浏览器验收入口撤除。core-probe/native-probe属于新课件的运行与验证工具；旧模块级验收保留为历史记录。

## 实际运行记录

| 对象 | 实际结果 |
|---|---|
| Node／pnpm | 本次Node24.5.0；工程锁定pnpm11.19.0。Node与仓库24.19.0要求有小版本差异，如实保留 |
| 单元检查 | 3项通过：41条迁移覆盖、31页ID／备注／组件一致、公开种子只有真实题录 |
| TypeScript／Stencil | `pnpm run check`与`pnpm build`通过 |
| 真实浏览器 | Microsoft Edge 154.0.4258.53，1440×900；HTTP子路径`/week04/`，无服务器隔离头，由本周service worker启用隔离 |
| 共享库与检索 | 4条真实题录，3个文档实例，74页；题录无文件状态真实保留；FTS检索与旧修订URI回查运行 |
| 派生索引 | 74个索引条目重建；`subaltern`查询16命中保持，题录／标签／笔记／修订计数对账不变 |
| CSL | 原Fsharp.Citeproc WASM渲染真实种子题录；两种课堂自制CSL样式如实标注，不冒称APA／Chicago |
| 标签 | 原NormalizeTags输出`["History","history"]`，保留大小写；真实改名将两标签归并。加标签只修改tags_json，不改作者等其他字段 |
| 真实扫描页OCR | 《Can the Subaltern Speak?》第一PDF页（图中原书页66—67），检测78区域，识别73行并提交新修订；旧URI仍返回原文本 |
| 不可变内容 | 对旧修订的document_boxes.payload_json真实UPDATE被原触发器拒绝，SQLite错误1811：`committed document tree revisions are immutable`。本结论限于已提交文本块；不扩张为所有修订元数据都禁止修改 |
| 合成扫描测试 | 实际输出`ARCHIVEEVIDENCE2026`、`力史研究保存原文与版本`。测试夹具不作为史料。后一行将“历”误认作“力”，如实记录识别失败例 |
| ZIP恢复 | 4题录、2PDF在独立空库恢复，最后受测耗时0.70秒；数据库／PDF BLAKE3、完整性和外键通过 |
| SQLite与原生复核 | 本轮课件导出4题录、75条修订，schema epoch2、41迁移、完整性／外键通过；75条修订由未修改的原C#校验器／编译器复核 |
| 词汇表 | 61词、四类；SKOS即时过滤运行。Wikipedia链接沿用原会话构建期逐条存在性核验；没有条目的词不挂链接 |
| 双屏与布局 | 演讲者D04→D05导航同步；31页1440×900逐页截图与测量，外层滚动溢出均为0，长列表在页内滚动 |
| 网络 | 核心验收页面无远端请求、无pageerror。浏览器ONNX CPU识别警告仅作运行日志保留；模型未退化为伪结果 |
| 模型生成 | 未运行：本机11434／11435和课堂模型桥未监听，未提供可调用的外部API配置。实际验证未配置降级、面板入口与禁用行为；工具循环与模型引用回跳不能写成已实测 |
| 全站 | week03＋week04组装及check-public通过；第三周29页保留，第四周31页ID与页面表一致；未提交、推送或部署 |

可公开的机器摘要见[courseware-verification.json](courseware-verification.json)。完整机器日志、31页截图、合成图、SQLite与ZIP保留在本机`apps/week04/artifacts/`，不进入公开仓库。上述数字来自当前受测版本；旧`browser-verification.json`只证明原移植实验。

## 适配与可回查边界

MinerU的CORS选择沿用原会话实际预检：OPTIONS返回405且缺少Access-Control-Allow-Origin，按用户选择只保留RapidOCR链路；本次没有用真实付费MinerU请求重测。

补齐PDF.js的JBIG2／JPEG2000／色彩解码WASM、CMaps与标准字体，修复扫描页渲染成白页的问题。OCR提交使用原schema允许的`ocr_adopted`来源枚举。D20引文已与种子i2第一页摘要逐字核对；其释义、推断和“机器候选”明确为教学构造，机器候选未运行模型。

标签云来自教师全库的导出截面，与入选4题录分开。标签类别由简易规则提示，不能当作经人工核定的真值；带冒号的学科代码可能来自ProQuest，不一概称作NDC。D10只重建FTS等派生层，题录、笔记和标签作为持久知识保留。

公开全站白名单只包含4条真实题录，不包含教师PDF、完整页文本或ONNX权重。教师完整课堂入口是本地`apps/week04/www/pku-aihis/week04/`，运行地址见README。公開产物附Patchouli许可证、manifest、对应源码与构建说明；权重和原件不随Git入库。`published-weeks.json`本轮加入week04表示参与组装，不能据此声称已发布到Pages。

原skill副本保持原样；新页面／演讲者／布局检查由本项目浏览器脚本完成。旧`section.slide`校验器不适用于`deck-slide`，没有将其跳过或不适用记成通过。本次为AI自检，没有冒称教师或助教独立审阅。
