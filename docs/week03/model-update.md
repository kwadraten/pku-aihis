# 2026-09-23 模型接入更新（早期阶段记录）

后续直观化、应用安装及默认Instruct模型更新见[当前更新记录](visual-update.md)。本文件保留当时的实际范围，不作为当前应用未安装的说明。

本轮响应教师要求：适用环节优先使用10B及以下本机模型；网页提供输入API Key和查看本机预跑示例的入口。

## 模型与运行

选用Qwen3 4B、DeepSeek-R1-0528-Qwen3 8B蒸馏版、Gemma3 4B及Qwen3-VL 4B Instruct，均为Q4_K_M。本机Ollama 0.22.1；运行时通过模型元数据检查总参数不超过10B，而非仅看量化文件大小或MoE激活参数。精确版本见每条运行的digest以及assets/data/local-models.json。DeepSeek蒸馏模型不等同于DeepSeek在线API模型。

Qwen3用于RAG、检索读取工具循环及研究任务；DeepSeek用于同问题对照；Gemma3用于文本对照；Gemma3与Qwen3-VL用同一提示分别描述7张原页。生成过程保留模型原始答案，评议另列；不以模型写出引用ID就证明其解释正确。原始OCR和教案PDF未修改。

## 页面入口

- 顶部“模型接入”：共用本地模型或API配置，支持检测本机模型。Key只保留于内存，刷新清除，不进入日志、导出或Git。
- D13、D24原步骤真正调用所选模型；切换模型、语料或输入后取消旧轮并丢弃旧响应。
- D13、D14、D21、D23—D30的相关生成页有“模型实跑与示例”。D22引文关系页不需要生成模型，保持原始引用边。
- D30按OCR、人工描述、Gemma和Qwen3-VL模型描述分别检索，也可选择原页现场重新生成。模型描述未校核，不能替代NDLOCR/RapidOCR。
- PaSa、PaperQA2、deep-research、AnythingLLM及评测页只单独运行相应模型环节，保留完整工具链的独立部署说明，不把通用模型回答改标成整套产品已执行。

## 本机部署和复现

使用local/start-classroom.py，独立模型端口11435、课堂端口8767；模型目录和本机Ollama路径只存local-only/machine.json。既有27B、31B模型保持不变。local/setup-models.py用于其他电脑下载相同标签；标签可能更新，复现时比较记录中的digest。

MiniLM/CLIP/Shikiji文件已从临时准备位置转入教师本地模型目录；本地桥接仅按local/models.json的白名单提供模型文件。Python检索依赖另建持久本地环境，不依赖临时准备目录。网页自由查询优先使用已下载MiniLM，再在浏览器内实际编码。原有固定向量和模型配置不变。

local/generate-examples.mjs保存实际模型回复、请求、上下文、工具事件与参数。推理模型使用原生API分离最终答案，预留8192生成token；网页不展示或储存内部推理文本。长度截断、模型无正文、无效工具参数、超预算均保留为失败，不当成完整示例。固定seed也不保证跨平台逐字相同。

## API边界

DeepSeek默认地址https://api.deepseek.com、模型deepseek-flash，来自本轮查阅的官方文档；可修改为其他OpenAI兼容模型。用户点击运行才发送所选资料。服务不支持浏览器跨域时可经本机桥接。远程API账户未提供，因此本轮仅用测试替身验证远程请求结构、Key传递和结果处理，不声称已用真实付费API完成生成。

参考：[Ollama API](https://docs.ollama.com/api/chat)、[Qwen3](https://github.com/QwenLM/Qwen3)、[DeepSeek API](https://api-docs.deepseek.com/zh-cn/)。

本轮新增行为由主任务作代码、浏览器与真实模型验收；09-22三份独立报告只覆盖其当时的版本，不扩称为本轮独立复核。

## 本轮验收记录

已保存27条本地模型实际输出：Qwen3 10条、DeepSeek-R1蒸馏版2条、Gemma3文本1条与图像7条、Qwen3-VL图像7条。每条有模型标签、完整digest、量化、Ollama版本、时间、实际问题与来源ID；7张图片另记录图片SHA-256。原始回答不作润色，内容误读与错误引用另列核查提示。这是教学例，不是模型准确率基准。

- 8项浏览器端逻辑测试与5项Python端点测试通过，类型检查和生产构建通过。
- 浏览器实跑：阻断远程模型下载后，用本机MiniLM完成自由文本编码；Qwen3完成D13的RAG和D24的检索／读取／结束循环。
- 持久Python环境中Tantivy、Chroma、Qdrant、Milvus Lite均再次返回实际检索结果。模型与Python依赖置于课程本机目录，未提交Git。
- API接入以明确测试替身验证：Key进入请求头、不进入页面存储或导出，模型切换清除旧结果，刷新清除Key。未使用真实账户调用付费API。

全部33页及11个模型实验页已在Chrome实测；D30现场传入原页并调用Qwen3-VL成功。390像素窗口检查通过。模型检测显示4个实际模型，正式启动器使用11435独立端口。
