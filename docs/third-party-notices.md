# 来源与许可说明

课程展示基础组件来自教师授权使用的助教 slides-src 工程，导入时原样保存文件哈希，详见 ta-source-baseline.json。输入工程未附独立 LICENSE；本仓库不擅自为其授予新的通用开源许可。课程制作适配和助教原版分别记录。

制作过程应用 guizang-ppt-skill 的 Stencil 工作流。该 skill 原包声明 AGPL-3.0；本次未将整个 skill 包及其模型、素材复制入公开站点。后续若引入其中受许可约束的代码或素材，应连同相应许可和来源记录一起保留。

Lucivy（MIT）、EdgeVec（MIT/Apache，以发行包为准）、OpenCC（Apache-2.0）、Transformers.js（Apache-2.0）等依赖按锁文件及各发行包许可使用。构建时复制到网站的依赖附带许可证。完整史料 PDF 与整卷 OCR 不随公开仓库发布。

D06正则结构图参考[LZL工具的RegexVisualizer](https://lzltool.cn/RegexVisualizer)所用的Regulex/Raphaël方案；实际嵌入的是[Regulex 0.0.5上游发行包](https://github.com/CJex/regulex)而非该网站的整站脚本。Regulex、其捆绑的Raphaël及Almond按发行包中的MIT等许可声明使用，构建时随图示脚本复制Regulex许可证。图示器与本页JavaScript `/gu` 匹配器相互独立，旧图示器不支持的语法会提示，不能把结构图当作匹配实测结果。

## 本次使用的数据与适配

- Lucivy 4.3.0 的发行包 package.json 声明 MIT，包内未附独立LICENSE；构建保留package.json与README并附原仓库MIT许可文本（docs/licenses/lucivy-MIT.txt），从worker移除可连接调试服务器执行eval的可选子系统。检索核心未替换。
- 图文向量使用 Xenova CLIP；文本使用 multilingual MiniLM。只发布已计算向量，模型修订与权重校验值见 local/models.json。
- 崩字样本：東京大学史料編纂所 HI Lab（https://lab.hi.u-tokyo.ac.jp/datasets/kuzushiji），由 kwadraten/hi-utokyo-kuzushi 整理；数据卡声明 CC BY 4.0（https://creativecommons.org/licenses/by/4.0/）。公开48项来自八处固定行号；只作JPEG转换，保留字种标签。特征按助教所用Shikiji模型实际计算；该模型license=other，权重不再分发。未复制其GPL应用代码。
- 教师提供的史料仅公开27条课堂短篇节录与7张正文区域图，用于讲解和原页回查；原PDF、整卷OCR、完整教师论文及私人路径不在仓库。整理者文字与原作者正文分列。

- D05实际权重来自[OpenSearch多语神经稀疏编码器](https://huggingface.co/opensearch-project/opensearch-neural-sparse-encoding-multilingual-v1)，修订1e0f096c2b51c234f1d20725c793e1b5b6d556db；公开推理结果与复现脚本，不再分发模型权重。原SPLADE代码作为机制来源，未把本模型冒称为NAVER原checkpoint。
- 本地应用源代码与依赖仅安装于教师第三周目录；公开仓库包含独立适配器、短篇运行结果与AnythingLLM界面截图，不打包上游整库或容器镜像。具体版本见本地deployment-lock.json和网页工具记录。

## 跨领域公开语料（2026-09-23）

[独立语料目录](../data/week03/cross-domain/README.md)收录6篇可再分发论文及4部经典著作的电子版，包含原件和带来源字段的提取文本。这些公开来源与上文教师提供的私人史料分开，不随默认站点资源发布。

- M87及双黑洞引力波论文采用PDF所载CC BY 3.0；GW170817、手稿年代测定及《Can BERT Dig It?》正式发表版采用CC BY 4.0。
- Reagan等的情感弧线论文采用CC BY-NC-SA 4.0，派生TXT/JSONL及其整理贡献沿用该许可，仅供非商业使用。
- Project Gutenberg #1497、#1228、#11、#1661保留完整原件及PG许可、美国公版与地域说明；不把该标注扩张为全球公版。Jowett导论单独标示。
- 完整作者、题名、版本、论文DOI、来源网址、处理方法和每文件许可见[sources.json](../data/week03/cross-domain/sources.json)，三种CC许可原文随包保存。不同材料保留各自许可，仓库未为整包重新指定统一许可。
- 其余10篇论文未核得第三方全文再分发依据；Leymore推荐帖及补抓回复未核得许可，故公开仓库仅保存出处核验元数据，不上传其正文或原始HTML。


## 第四讲（2026-10-06）

- Patchouli核心与41条SQL迁移来自5ad3455cf602e05fd84ce2416b17c030ee9a5276，逐文件散列见week04/patchouli-source-manifest.json。按GPL-3.0保留LICENSE、manifest与对应源码；本地构建在assets/licenses/corresponding-source附原核心、浏览器适配和构建说明。没有改写原核心校验器。
- RapidOCR采用上游v3.9.2分发的PP-OCRv4 ONNX模型；本机下载逐项SHA-256与上游清单核对。模型来自PaddleOCR（Apache-2.0），浏览器几何后处理为本工程轴对齐连通域适配，未声称与原多边形算法完全等价。三份锁定权重进入本地课件与整站构建白名单，不进入Git，本轮未部署。ONNX Runtime Web 1.23.2为MIT。
- PDF.js 6.4.299为Apache-2.0；同时复制扫描图解码WASM、CMaps和标准字体，保留分项许可证。SQLite WASM包声明Apache-2.0，SQLite引擎为公有领域。其余包版本以pnpm-lock.yaml为准。
- 按用户最新指令，第四讲仅使用真实桌面数据库的4题录、353页OCR与四份PDF原生子集，筛选与验证见week04/native-subset.md。课堂与整站本地构建均包含这些资源；不加入Git，本轮未部署。来源核验与再分发许可分别记录。

- Patchouli徽标原样取自该项目logo/icon.png，出处与SHA-256见apps/week04/src/assets/branding/manifest.json；与原项目来源及许可记录一同保留。
- MLA第9版、APA第7版与Chicago第18版CSL来自[citation-style-language/styles](https://github.com/citation-style-language/styles)，《世界历史》CSL来自[Zotero中文样式库](https://zotero-chinese.com/styles/世界历史/)。四个样式文件都保留上游作者、来源与CC BY-SA 3.0声明；实际版本、下载地址与SHA-256见apps/week04/src/assets/csl/manifest.json。

- 第四讲独立编辑器与历史词表实验使用CodeMirror 6（MIT）、N3 1.26.0（MIT）、D3 7.9.0（ISC）和marked 16.4.1（MIT）。所有浏览器工具离线打包，无运行时CDN；各包版本、上游仓库、许可全文与SHA-256见apps/week04/src/assets/skos/manifest.json及LICENSES.txt。Mermaid 11.13.0（MIT）仅用于生成本地SVG，保留.mmd源与散列清单。SKOS语义依据[W3C Reference](https://www.w3.org/TR/skos-reference/)。

- 浏览器索引分析器依据Patchouli.Infrastructure/Search/SearchTextAnalyzer.cs移植，采用同一GPL-3.0来源；对应源码包含src/lib/search-text.ts，原分析器随infrastructure-sources保留。

- D09的四张封面／卷首图来自Google Books对应版本，非生成图片；卷ID、来源页、图片地址与SHA-256见apps/week04/src/assets/covers/manifest.json。教学页面的藏本说明沿用用户提供的图，图片作为对应出版版本的视觉入口。
