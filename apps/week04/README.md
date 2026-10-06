# 第四讲：文献整理、学术阅读与个人知识系统

31页（D00—D30），对应教案v1.9与[已确认任务文档](../../docs/week04/metamorpho-aquaman-bishop.md)。使用项目内guizang-ppt-skill与第三周Stencil外壳，没有运行初始化器覆盖输入工程。

工具页本身就是Patchouli浏览器工作台，参照原AXAML三栏布局；不存在教学／工具双模式。31页理念通过右侧示意图与对应操作呈现。逐页充实见[工作台复核](../../docs/week04/workbench-review.md)。

共享书库使用原Patchouli文档树核心、41条SQL迁移、SQLite WASM与原生数据库子集。CSL由Fsharp.Citeproc WASM运行；检索由SQLite FTS5／中文子串查询运行；OCR使用RapidOCR PP-OCRv4模型和ONNX Runtime Web。D18通过OpenAI兼容API运行find／fetch工具循环，检查引用是否来自本轮上下文。无配置时禁用生成，提示打开顶栏「模型接入」。

## 本机准备

需要Node24、pnpm11.19.0、.NET SDK10。Patchouli源码作为只读输入；版本与散列见vendor/patchouli/manifest.json和docs/week04/patchouli-source-manifest.json。

```powershell
cd apps/week04
pnpm install --frozen-lockfile --ignore-scripts
node scripts/import-patchouli.mjs /path/to/patchouli
dotnet restore core-probe/CoreProbe.csproj -p:Configuration=Release --locked-mode
pnpm build:core
pnpm prepare:core
pnpm prepare:ocr
# 从桌面配置指向的真实数据库与WPS PDF书库抽取原生子集：
pnpm seed
pnpm build
pnpm preview
```

打开 http://127.0.0.1:8774/week04/ 。方向键翻页，课程地图选页，P打开演讲者窗口，B静态模式。中文输入和文本框内的方向键保持编辑操作。

网页只加载一份原生SQLite子集：4题录、4文档、353页、4份PDF。原始UUID、完整OCR修订、索引和schema保留；数据直接读取本地数据库，不经BibLaTeX／Markdown重建。旧试验库与题录降级路径已删除，浏览器旧试验存储会在首次加载新版时替换。缺资源时明确报错。整站组装包含同一数据库、OCR正文与对应PDF；三份哈希固定的ONNX权重同时进入本地整站包，以便扫描PDF处理能够实际运行；不加入Git。D09、D21、D25分别采用独立四层实体图、卡片盒和历史词表实验。

顶栏「导出SQLite」下载当前库；在桌面Patchouli选「打开数据库」，设置文件搜索根，以BLAKE3重新绑定PDF。网页顶栏「打开SQLite」可回读桌面修改后的同格式数据库，已有PDF按BLAKE3绑定。SQLite不包含PDF字节。D27的ZIP备份包含数据库和PDF，并在独立空库恢复、核验哈希与外键。

## 检查与分发

```powershell
pnpm test
pnpm run check
pnpm build
# preview已经启动时：
pnpm check:browser
dotnet run --project native-probe/NativeProbe.csproj -c Release -- artifacts/export.sqlite
cd ../..
node scripts/build-site.mjs
node scripts/check-public.mjs
```

实际检查见[接续验收](../../docs/week04/completion.md)。截图、完整日志、SQLite和ZIP只留本机artifacts/，不入公开仓库。

构建附Patchouli GPL-3.0许可证、来源manifest、对应源码及构建说明。依赖按NuGet/npm锁文件恢复。RapidOCR模型下载地址和SHA-256见src/assets/ocr/models.json。旧Vite/Tesseract入口已撤除；core-probe和native-probe是同一课件的验证工具。

原生双向验收（整站已组装时）：另起终端运行 `node scripts/serve-static.mjs 8776 ../../../site/week04`，随后运行 `pnpm check:native`。此检查逐表对比浏览器导出，用桌面Microsoft.Data.Sqlite及原核心验证并修改独立副本，再回读网页；同时验证旧试验库替换与PDF页跳转。

## 持续使用

打开网页即为D04书库。共享应用菜单只显示书库、题录编辑、文件关联、全文检索、PDF阅读、文字处理、引文样式、证据地址和标签等实际能力。来源笔记、阅读安排、人工核验、关系、问题索引、清理与维护使用独立Markdown编辑器；D21使用实体卡片盒。

1. 导入PDF：在D06选择新建题录或当前条目，多选文件。默认提取全部页的文字层；重复文件按BLAKE3进入已有题录。扫描空页保留原件。
2. 识别与核对：D26选附件与页范围，加载RapidOCR模型后运行。默认跳过已有正文，勾选重新处理才提交新修订。取消或失败保留已完成页，重启任务可续做。右侧可以打开原件、核对正文、校对并提交新修订、回查历史、复制引用。
3. 保存研究：元数据、阅读状态、题录笔记写入原表；集合说明、摘录／判断／核验／下一步、关系、词汇约定和维护记录写入原生条目自定义字段，刷新后保留。研究表单可继续编辑并保留先前记录，支持Markdown导出。
4. 交换与恢复：D27下载完整ZIP备份或实际打开备份；顶栏SQLite支持桌面整库打开和网页回读；CSL JSON支持题录交换。SQLite不含PDF字节，ZIP携带原件。

书库数据保存在同一来源的IndexedDB，独立Markdown及Turtle草稿保存在localStorage并可单独下载；迁移这些草稿时使用下载文件。

验收：`pnpm check:browser`检查全文PDF导入、持久保存、去重、恢复及31页导航；`pnpm check:ocr`用实际扫描PDF检查OCR、旧修订、取消与续做；`pnpm check:native`逐表比较原生子集并验证桌面双向回读。使用整站服务时设置`WEEK04_URL=http://127.0.0.1:8776/week04/`。

D05按题录编辑器与实体关系图联动：点击条目显示书库，点击字段与元数据显示编辑题录，点击附件显示文件关联；查看原件在当前页进入PDF工作台，可退出回到上一界面，结构化责任者、日期及其他字段一次保存，题录切换保留编辑草稿。`pnpm check:d05`验证实体与键盘操作、草稿、保存与刷新、原有ID及附件关系，以及三种投影尺寸。

D04以三层3D堆叠柱体导航书库、PDF工作台与检索。检索命中进入对应原页；退出阅读后恢复查询、结果与书库筛选。`pnpm check:d04`验证层级导航、实际检索、页级回查、返回状态和D05共享选择。

真实文献管理操作复用同一个patchouli-app组件，共用原项目图标、44px单行顶栏、书库与PDF阅读。独立示例不套用应用导航。D07用Mermaid连接元需求、子需求、字段名与独立表单元素；D10展示真实FTS内容、行号映射与倒排词项，并可切换重建前后快照。D16用可逐层追加的3D结构表达可演化原则。D17/D19/D20/D22/D23/D24/D28复用Markdown编辑器及对应模板。D25以基本思想、Turtle编辑和D3力导向图三种模式展示同一历史词表。

所有页面已移除讲解标注按钮与弹出内容，构建脚本不再生成该组件。

D21采用木质3D卡片盒：点击问题标题取卡，返回图标放回；创建新卡可写Markdown、选出处、说明理由，取消时焚毁草稿。右侧示意图分别荧光高亮地址、问题和理由，意外关联不触发操作。六张预置卡片按现有语料制作，每张使用固定的patchouli://notes/{uuid}.md入口，新卡单独保存在浏览器并可下载Markdown，不写入SQLite。文档引用定位到真实PDF页序、修订与文本块，可同区域回查并返回原卡。详见[卡片盒说明](../../docs/week04/card-box.md)，检查运行pnpm check:d21。

## 统一应用组件与引用样式

patchouli-app拥有应用外壳、语义页面路由、题录草稿、书库筛选、检索结果和工具状态。metadata-split只负责右侧示意图；library-workbench、pdf-flow-split与frbr-split是兼容入口。D21回查卡片出处时也使用同一个应用组件。徽标图片原样取自Patchouli的logo/icon.png。

PDF工作台以原生边界框树编辑正文：选框、拖动与缩放、绘制、改类型和Markdown、调整父逻辑页及顺序、缩进与提升、拆分与合并、抑制、撤销与重做。取消不写数据库；保存经原核心校验后提交manual_edit新修订、更新全文索引，保留旧修订与原框ID。历史修订只读。编辑期间应用导航和翻页停用。

征引页使用MLA第9版、APA第7版、Chicago第18版（注释与书目）与《世界历史》的实际CSL文件，由原Fsharp.Citeproc渲染当前题录。各文件的来源、许可和SHA-256记录在src/assets/csl/manifest.json，页面可下载样式并查看CSL JSON。默认语言随样式切换，语言环境仍可单独选择。

检查：pnpm check:shared-app验证单一图标与状态栏、跨页检索与草稿、四种实际引文和三种尺寸；pnpm check:pdf-tree验证树操作、取消、保存、新旧修订、原ID和检索更新。其余逐节点与卡片盒检查继续保留。

当前题录只通过书库切换，题录下拉菜单已删除。页面入口、状态与保存/返回操作集中于44px顶栏，书库筛选与PDF翻页也在同一栏；应用不再保留独立标题行或底部状态栏。正文与编辑器占据剩余区域。pnpm check:compact验证12个原生页面在1366×768、1600×900和1920×1080下的顶栏控件及内容区域。

2026-10-07复核：31页加入可见的前后衔接；D06以检索复制URI、单框解析与原页高亮串联，D07以需求→子需求→字段→独立表单展示充分性/必要性，D09使用所给《资本论》四层Mermaid图。CJK姓名共用显示函数，完整保留姓氏前缀并按姓前名后显示，CSL中的CJK姓名保持完整字形。PDF文件标题、翻页与返回仍在同一44px栏内。检查运行pnpm check:review。Mermaid源码/SVG/散列见src/assets/diagrams；重新渲染时在临时目录安装mermaid@11.13.0，并向scripts/render-mermaid.mjs传入其dist/mermaid.min.js路径。

独立示例检查：`pnpm check:independent`；Turtle以N3解析，代码编辑用CodeMirror 6，图形使用真实D3力导向算法。工具包在临时目录安装后运行`node scripts/prepare-skos.mjs <临时node_modules>`重建，依赖版本/许可/SHA见src/assets/skos/manifest.json。

Markdown练习保留右侧可点击理念图，编辑、预览与原页回查仅使用左侧工作区。图节点在编辑器或预览中以底色高亮对应段落，返回PDF后恢复草稿；图形布局复用concept-map组件。

最新交互（2026-10-07）：D11衍生说明在本页左侧Markdown编辑；D15标签和集合各有独立侧栏与完整书库列表。四篇原生预置文献各配置4—5个主题标签，共同的研究方法与知识组织用于观察多篇筛选；标签通过原生tags_json及item_tag_memberships保存，seed来源库保持只读。

D10默认身份层示意图，点击复制PDF、重新扫描、换版与校对，比较题录、文档实例、BLAKE3和修订；可切换四种工具对象视角及实际FTS重建。D18标题为理解六种阅读任务，聊天通过浏览器JS的find/fetch/cite逐步发现VFS、浏览题录与文档目录、短词检索、读取原页和渲染引用。协议夹具验收聊天行为，实际回答使用用户配置模型。

幻灯片全局顶栏提供导入PDF，与模型接入并列；填写题录后先校验题名与作者，再保存到原生SQLite并运行RapidOCR，生成边界框树与全文索引，可由桌面回读。D26右侧图在校对模式仍可点击，切换保存未提交草稿，回到校对恢复；确认、取消与提交分别处理。

所有示意图增加进入、连线或层级动画；B静态模式与减少动态设置关闭动画。D09四个单件保留现有封面效果，Google Books地址与图片SHA记录在assets/covers/manifest.json。

PDF导入支持后台识别：全局顶栏在加载／识别期间显示“运行中...”；关闭进度或点击后台运行仅隐藏窗口，保持同一导入任务。再次点击按钮回到当前进度；可继续浏览幻灯片，完成后进入统一PDF工作台或再导入文件。
