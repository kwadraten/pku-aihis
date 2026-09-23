# 第三周应用部署与课堂启动

在第三周的“本地应用与服务”文件夹双击的“启动完整课堂.command”。它使用当前 pku-aihis 仓库，启动三项独立应用容器、研究适配服务、本地模型与课堂网页。Docker Desktop 须处于运行状态。关闭终端会停止本次启动的课堂进程；容器用“停止应用服务.command”关闭。不会修改其他项目的 Ollama 或容器。

- 课堂：http://127.0.0.1:8767/week03/
- AnythingLLM：http://127.0.0.1:3301/ ，工作区“第三周史料检索课堂”
- Elasticsearch：http://127.0.0.1:19200/
- OpenSearch：http://127.0.0.1:19201/
- 研究工具适配：http://127.0.0.1:8870/health
- 课堂专用 Ollama：http://127.0.0.1:11435/ （与其他项目的11434分开）

应用配置、持久化数据和启动入口在本文件夹。Docker 镜像层由已有 Docker Desktop 虚拟机管理，并非直接保存在本目录。27条课堂记录已写入两个索引和AnythingLLM工作区。测试索引保留500MB洪水阈值，不影响其他集群。

## 实际部署范围

| 页面 | 实现 | 实际情况 |
|---|---|---|
| D05 | OpenSearch多语神经稀疏模型 | 官方固定修订，167M参数，真实27文档及9查询权重 |
| D14 | AnythingLLM 1.16.2 | 官方容器，LanceDB，Qwen3 4B Instruct＋0.6B嵌入；已有界面问答截图 |
| D15 | Elasticsearch 8.18.0 | 独立单节点，CJK分析器与真实BM25查询 |
| D16 | OpenSearch 3.2.0 | 独立单节点，外部真实编码＋原生neural_sparse查询 |
| D17–20 | Tantivy、Chroma、Qdrant、Milvus Lite | 本地库模式实际运行；不是分布式集群性能基准 |
| D23 | dzhng/deep-research | 原查询/递归/简答代码；搜索适配为课堂BM25、模型为4B；不冒称互联网研究 |
| D25 | PaSa | 原PaperAgent调度，本地模型/史料适配；未安装原CUDA两套7B推理环境；无已核实引文边时扩展为空 |
| D26 | paper-qa 2026.8.12 | 原Docs检索、摘要、回答流程；5条课堂片段；非完整在线论文发现流程 |
| D27 | RAGChecker 0.1.9、DeepResearch Bench | 原评价代码＋4B模型；自拟单题RACE；未运行官方全量榜单或FACT联网核验 |

## 本地模型

默认实时生成使用 qwen3:4b-instruct-2507-q4_K_M。原 qwen3:4b 标签此次实际对应 Thinking-2507，旧示例保留其原始digest，不重贴Instruct标签。另有DeepSeek-R1 8.2B、Gemma3 4.3B、Qwen3-VL 4.4B；新增Qwen3 Embedding 0.6B用于应用。所有课堂模型总参数均不超过10B。模型权重沿用本周“修订与演示开发_20260922/本地模型/ollama-models”。

## 运行与核查

runs 下的JSON是实际运行记录；console文件包含本机路径，只用于本机排查。AnythingLLM密钥位于anythingllm/private.json，不复制到网页或Git。deployment-lock.json和container-images.lock.json保存来源和版本；research-requirements.lock.txt保存研究环境依赖。

运行失败时先检查Docker与11435，再检查课堂8767和研究8870。公开Pages若被浏览器阻止访问本机网络，直接使用本地课堂入口，保存示例仍可在公开页阅读。

## 本轮实际发现

AnythingLLM重录兼容汉字时出现过 `<tool_call>` 异常；保留截图用于原文核对。PaperQA首次宽泛查询筛得0条证据，收窄问题后留下1条。deep-research中间学习记录出现人物音译和推论越界，最终简答显示证据不足。PaSa适配的选择器排除了全部候选。RAGChecker识别出人为设置的“废除所有神社”无根据断言，但其论断抽取措辞仍有误差。这些是模型实际表现，不是可靠史学结论。

## 助教在另一台机器复现

先建立独立Python 3.12环境，安装`local/research-requirements.txt`；检索库使用另一环境安装`local/requirements.txt`。调用`local/setup-services.py`时指定自己的应用目录，脚本只创建`pku-week03-*`独立容器。`local/setup-anythingllm.py`创建工作区与导入课堂短篇。在`local-only/machine.json`配置`applications`、`node`、模型和嵌入目录；此文件不入Git。

原项目固定源代码修订：deep-research `1f8f3e285bbc23e80b98a66a64effab9069f3ad4`；PaSa `2aaa6a9b1e48d24a2b7e21e8551f863dad9eeb84`；PaperQA源码参考 `57e89f7223b0960d5ee5ea048c69e3c47e088572`（实跑Python包2026.8.12）；RAGChecker源码参考 `6091f08c00e676e87a970f2aeb4a23a484746348`（实跑包0.1.9）；DeepResearch Bench `852f4022d1f98fb707222e395405136e8f0e8d52`。

在应用目录`source`中放置对应项目；deep-research按其锁文件安装依赖，将`local/deep-research-classroom.ts`复制为项目中的`classroom-run.ts`。`local/research-gateway.py`提供本地模型与课堂搜索适配，`local/research-run.py`执行其余原库工作流。复现后应重新记录运行时间、模型摘要和实际结果，不直接把教师电脑的保存结果改标为自己的运行。
