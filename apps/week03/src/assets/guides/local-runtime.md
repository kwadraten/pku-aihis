# 本地模型、API接入与保存示例

2026-09-23。本次使用不超过10B总参数的本机模型：Qwen3 4B Instruct-2507（实时默认）、原Qwen3 4B Thinking标签、DeepSeek-R1-0528-Qwen3 8B蒸馏版、Gemma3 4B、Qwen3-VL 4B Instruct。它们不是DeepSeek线上服务的同一个模型。精确标签、量化、模型散列与Ollama版本显示在每条实际响应和保存示例中。

## 教师本机启动

双击本周“本地应用与服务”或新备用包的“启动完整课堂.command”，或在仓库根目录运行：

```sh
python3 local/start-full-classroom.py
```

启动器为课堂使用独立的Ollama端口11435和模型目录；网页及桥接端口8767。打开 http://127.0.0.1:8767/week03/ ，保持启动窗口开启。右上角“模型接入”选择本机模型并“检测本机模型”。Qwen3用于问答和工具循环，Qwen3-VL与Gemma3用于图片对照。一次只加载一个模型，首次切换需要等待。

其他电脑先安装[Ollama](https://ollama.com/download)，启动上述课堂后，在另一个终端运行 `python3 local/setup-models.py`。它下载五种生成模型及0.6B嵌入模型，下载前请按Ollama显示的实际体积预留空间。教师已下载的权重放在课程材料目录，未放入Git或课堂ZIP；本机私有路径由local-only/machine.json记录，不能上传公开库。

## 页面怎样运行

D13按“检索—确认上下文—构建请求—调用生成”执行；D24由模型选择search/read/finish，程序检查ID、实际执行检索和读取，最多4轮。运行记录保留模型提案、工具结果和最终答案，不把模型内部推理当作工具日志。模型切换、语料切换或重新开始后，旧结果失效。

其他相关页的“模型实跑与示例”提供可编辑问题、当轮实际输入与回答。D30可选择7张原页，用Qwen3-VL或Gemma3生成描述。视觉模型描述保留未校核状态，不替代原OCR与人工描述。工具页上方现已提供真实本地应用或原代码＋课堂适配的重跑；下方独立“模型实跑与示例”仍与应用流程区分。具体实现边界见各页部署说明。

## 输入API Key

右上角“模型接入”选择“输入API Key接入服务”，填写服务地址、模型名和Key。DeepSeek预设为 `https://api.deepseek.com` 和 `deepseek-flash`，以[官方接入说明](https://api-docs.deepseek.com/zh-cn/)为准；也支持其他OpenAI Chat Completions兼容服务。API模型不受本次本地模型10B限制。

默认浏览器直连；供应商不允许浏览器跨域时，选择“经本机桥接”，先运行课堂服务。Key仅在当前页面内存中保留，刷新清除，不进入浏览器存储、URL、仓库或导出记录。点击运行时，问题和选入的文字／图片会发送至填写的服务，费用由该账户承担。没有Key时可使用本地模型或已运行示例。

Pages访问本机可能触发浏览器的本地网络许可。允许当前课堂访问即可；不方便时打开本地同源入口，无需关闭浏览器安全功能。

## 保存示例

每例由本机模型实际生成，显示原问题、上下文ID、运行时间、权重散列、参数规模、量化、采样设置和最终答案。模型回复按原样保留，点评另列；改变现场输入不会改变旧示例，也不会把旧示例改标成新答案。可以切换不同模型的回答进行比较。D24还保存完整工具执行事件。

重算：保持本地服务运行，执行 `node local/generate-examples.mjs qwen3:4b`，DeepSeek、Gemma和Qwen3-VL模型标签同样适用。脚本跳过已有同模型任务；需要重算时先另存旧JSON并移除目标例。模型回复被截断时脚本停止，不将其标为完整示例。浏览器会明确显示长度停止、连接失败和工具校验失败。

默认固定标签 qwen3:4b-instruct-2507-q4_K_M 直接输出答案；原 qwen3:4b 此次实际对应Thinking-2507，旧示例保留原始版本，由原生API分离最终答案；为推理模型预留8192个总生成token，课堂默认temperature=0.6、top_p=0.95、top_k=20、repeat_penalty=1.1、seed=42。固定seed不保证跨平台逐字相同。

## 数据库

Tantivy、Chroma、Qdrant、Milvus的本地重跑另需Python 3.12和local/requirements.txt。这些库与生成模型是不同环节；换生成模型不会重新计算语料嵌入。

依据：[Ollama聊天API](https://docs.ollama.com/api/chat)、[Qwen3官方说明](https://github.com/QwenLM/Qwen3)、[Gemma3模型](https://ollama.com/library/gemma3:4b)、[DeepSeek蒸馏版](https://ollama.com/library/deepseek-r1:8b-0528-qwen3-q4_K_M)。
