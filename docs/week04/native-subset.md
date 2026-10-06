> 真实文献操作统一使用Patchouli组件，研究记录使用独立Markdown示例；最新逐页改进、完整PDF处理与检查见[workbench-review.md](workbench-review.md)。本页记录原生预置子集的基线。

# 第四讲原生数据库子集验收

2026-10-06，按用户最新要求，撤除旧试验库和题录降级实现，网页只使用当前四份材料的原生SQLite子集。此要求取代旧方案的单PDF 15MB限制、重复题录演示及公开构建仅题录设计。

数据从桌面Patchouli配置指向的实际数据库以只读事务抽取，PDF从用户指定的WPS PDF书库读取。未改动桌面正在使用的数据库。抽取脚本为`apps/week04/scripts/export-native-seed.py`，入口`pnpm seed`；没有MCP文本重放、手工造树或重新生成UUID。

| 材料 | 原始题录ID | PDF页数 |
|---|---|---:|
| Can the Subaltern Speak? | ef26f586-3974-42d9-8b0c-94b0a605df73 | 23 |
| A Dancing Bear… | a6b3ba05-1989-454e-a583-97672d2a488a | 29 |
| 元文元年の貨幣改鋳思想 | bd70fce9-6c47-4da5-a894-c2b1f7141255 | 22 |
| Milk Is Gold（正式题录） | 1e5d7930-c7ed-4208-9086-fd2423c71f91 | 279 |

子集保持library_id `c20f45e1-5432-48a4-bca4-c4bc91844120`、library_revision 5076、schema epoch 2。共4题录、4文档、353页、378条文档树修订、3199个文本块、1636条FTS记录，数据库9,461,760字节。保留原提交链、修订状态、OCR来源、结构化题录、收藏、标签和索引；无关材料、凭据和设备操作日志不复制。

原库已应用42条迁移，其中包含历史009；当前上游源码附41份SQL文件。子集保留真实42条应用记录及原库完整schema，浏览器跳过已应用迁移。不能把42改写为41。SQL对象与每张复制表的所有列值均与来源逐项对照，原FTS rowid保留。四份PDF的BLAKE3等于原file_assets记录，SHA-256与长度另载于`native-seed.json`。

运行资产仅有`native-library.sqlite`、`native-seed.json`及四份以原file_asset_id命名的PDF。旧seed.json、seed-public.json、export-seed.mjs和重复PDF删除。网页启动只加载这一格式；缺资源直接报错。旧IndexedDB试验库在首次新版启动时替换，已改过的兼容原生子集刷新后保留，不另存旧库。

整站`site/week04`包含同一SQLite、原OCR正文及四份PDF。题录附件可直接打开PDF；OCR命中回查支持打开对应PDF页。SQLite本身不携带PDF字节，浏览器另按原file_asset_id和BLAKE3保存，ZIP备份同时携带数据库与PDF。桌面导出的相同材料数据库回到网页时沿用已校验的PDF。新增附件仍须按哈希重新绑定。

实际验证：

- TypeScript、三项工程检查及Stencil生产构建通过。
- 原版Patchouli C#校验器／编译器及Microsoft.Data.Sqlite读取原生子集：完整性、外键、356个已提交修订通过。
- 整站HTTP入口运行；浏览器首次导出的SQLite与预置子集所有SQL对象和所有表行一致。
- 英文`collectivization`的FTS及日文`金銀`子串检索实际命中，PDF原件以`%PDF-`识别，命中链接带真实页序。
- Microsoft.Data.Sqlite在独立导出副本中修改笔记，网页「打开SQLite」成功回读，PDF保持绑定。桌面活动原库未参与写入。
- 浏览器旧试验库存储替换测试通过；替换后无browser_seed_imports表，仅一份原生库。对原生库的桌面修改刷新后保留。
- 全流程浏览器检查：4题录、4PDF、353页启动，实际重建索引、CSL、标签归并、RapidOCR新修订、旧URI回查、不可变触发器、ZIP独立恢复、SQLite导出、演讲者同步均通过；31页外层溢出为0，无pageerror或外部请求。
- 流程写入后的导出再次经原版C#校验：357个已提交修订、42条迁移、4题录，完整性和外键通过。

机器日志、导出数据库与截图位于忽略的`apps/week04/artifacts/`；数据与PDF不加入Git。仅完成本地整站组装，没有部署。兼容结论针对当前来源版本和本子集；未实测其他Patchouli版本。未配置模型生成端点，LLM生成未运行。

2026-10-07课堂标签修订：按用户要求，仅在导出的子集中为四篇文献配置4—5个主题标签；源桌面库保持只读。相应原生tags_json、item_tag_memberships和library_revision同步更新，当前种子修订为5077。新native-seed.json保留source_database_sha256，并更新受影响行、数据库的SHA-256；其余身份、原件、文档树与FTS保留。prepare-classroom-tags.py与classroom-tags.json固定配置，再次导出原生子集后自动执行。已打开的旧课堂子集仅首次升级未改的预置标签；后续用户删除或更改标签不会被刷新覆盖。

本次增验通过实际扫描PDF的导入题录校验、RapidOCR边界框、索引、取消/重试、修订回查及原生校验器回读；D26切换图节点保留未提交草稿。SQLite保持原生格式；PDF字节仍须随ZIP备份或原文件一同交接。
