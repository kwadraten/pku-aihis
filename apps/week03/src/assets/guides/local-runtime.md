# 同源本地课堂与模型桥接

公开 Pages 上的正则、教学 BM25、Lucivy、EdgeVec 和已存向量排序不需要模型密钥。生成、模型选择工具以及服务型数据库需要本机运行环境。

在仓库根目录，用 Python 3.12 建立环境：

```sh
python3.12 -m venv .venv
.venv/bin/pip install -r local/requirements.txt
cd apps/week03
pnpm install --frozen-lockfile
pnpm build
cd ../..
node scripts/build-site.mjs
.venv/bin/python local/runtime.py
```

打开 http://127.0.0.1:8767/week03/ 。服务仅监听回环地址，提供跨源隔离响应头；默认静态范围只有 site/。

## 生成模型

桥接默认连接本机 Ollama 的 OpenAI 兼容端点 http://127.0.0.1:11434/v1 ，模型 qwen2.5:3b。先单独安装 Ollama 并下载该模型，然后启动上述服务。本次交付未预置或运行此生成模型，因此网页初始没有生成答案。

也可在启动服务的终端中设置 `AI_BASE_URL`、`AI_MODEL`、`AI_API_KEY`，使用有权调用的 OpenAI 兼容服务。密钥只由 Python 进程读取，不粘贴网页、不进入浏览器存储、不写仓库。远程模型会收到所选上下文；需要只在本机处理时使用本地端点。

D13 逐步操作：检索 → 选择片段 → 生成实际请求 → 调用模型 → 对照原文检查引用。D24 的模型输出必须是 search/read/finish 的 JSON，由执行器校验，只读已检索ID，最多4轮；达到预算或服务失败会停止并保留日志。界面日志是可观察事件。

## 数据库重跑

```sh
.venv/bin/python local/retrieval.py chroma --query '宗教'
.venv/bin/python local/retrieval.py qdrant --query '宗教'
.venv/bin/python local/retrieval.py milvus --query '宗教'
.venv/bin/python local/retrieval.py tantivy --query '宗教'
```

前三项使用随片段提供的384维模型向量与预存查询；自由查询需要同配置重新编码。后者使用字符双字词项。Chroma使用余弦距离（小为近），Qdrant与本例Milvus使用余弦相似度（大为近）。Milvus响应字段名 distance 不改变本例的度量含义。本例采用单机临时库，不代表集群性能。

Pages 连接本地服务可能受浏览器本地网络权限限制；遇到失败直接使用上述同源本地入口，不关闭浏览器安全设置。
