# RAGChecker / DeepResearch Bench 本地实践

来源：https://github.com/amazon-science/RAGChecker

前者细分RAG的检索与生成错误；后者评测深度研究系统，不是另一个检索客户端。

适用范围：模型评测需本地配置和评判服务；当前页提供可审计的输入结构和部署入口。

## 固定输入

保存问题、参照答案、上下文、生成结果与来源。

```text
query / ground_truth / retrieved_context / response
每个主张单独回到支持片段。
```

观察：参照答案也需核验，不以教师论文结论自动充当金标准。

## 主张与证据

人工先标支持、反对、不足，再看模型评判。

```text
主张：……
证据ID：……
支持范围：……
人工判定：支持 / 限制 / 反对 / 待核
```

观察：不要将评判模型的一致意见当成史实认证。

## 框架重跑

按原库固定版本运行，保留模型与预算。

```text
RAGChecker: https://github.com/amazon-science/RAGChecker
DeepResearch Bench: https://github.com/Ayanami0730/deep_research_bench
```

观察：开发集与测试集分开；缺失全文和接口失败纳入记录。

## 运行与验证口径

网页步骤展示不是执行日志。仅在页面明确出现带版本和时间的运行结果时记为实跑。服务型工具在本地启动，GitHub Pages只提供前端。真实语料使用同一份带页码记录的JSON；模型及向量配置须兼容。完整OCR保留本机。

## RAGChecker本地启动与数据准备

在独立环境执行 `pip install ragchecker` 和 `python -m spacy download en_core_web_sm`；复制原库 `examples/checking_inputs.json` 的结构，把本次实际query、response、retrieved_context及人工参考答案写入副本，再运行 `ragchecker-cli --help` 核对extractor/checker模型配置。模型服务尚未配置时不要生成分数。原工具的英文处理组件与中文日文史料之间还需验证，抽样人工核对先于大批自动评测。参见[原库教程](https://github.com/amazon-science/RAGChecker/blob/main/tutorial/ragchecker_tutorial_en.md)。

DeepResearch Bench是报告评测，参见[原代码库](https://github.com/Ayanami0730/deep_research_bench)。原仓库的评审模型与版本会变化，重跑时固定commit、模型及提示；不同评审版本所得分数不能直接混表。课堂先用D10的人工判断池学习指标，再决定是否接入这些外部裁判模型。
