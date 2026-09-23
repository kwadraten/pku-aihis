# Milvus Lite｜D20

本说明对应 2026-09-23 的实际安装与运行。教师本机的应用数据、源代码、模型与日志位于“第三周（9月24日）/本地应用与服务”及本周既有本地模型目录。点击“启动完整课堂.command”，保持窗口开启；进入 http://127.0.0.1:8767/week03/ 。公开网页只发布课堂片段、脱敏运行结果和截图，不包含密钥、模型权重或完整史料。

“本地重跑”调用真实服务，失败时保留错误；不会用保存结果冒充本轮响应。页面的步骤按钮只切换解释。外部API接入在“模型接入”面板中设置，适用于独立模型实验；各应用使用其自身配置的本地模型。

## 当前部署

用集合组织向量、文档ID与来源元数据；向量由兼容编码器产生。

本课使用本地轻量运行；公开网页保留运行记录与重跑入口。

实际运行时间：2026-09-22T20:34:19+0800。版本：3.0.2。查询：宗教。

## 记录与向量

将真实段落向量和来源字段一并写入。

```text
id / text / vector[384] / source_id / pdf_page
模型与revision、池化及归一化另存manifest。
```

观察：不把补零或哈希向量当兼容模型向量。

## 集合与搜索

执行该库的写入、近邻及过滤接口。

```text
client = MilvusClient("./week03.db")
client.create_collection("week03", dimension=384, metric_type="L2")
client.insert("week03", data=records)
client.search("week03", data=[query_vector], limit=5)
```

观察：Cosine越大越近；L2距离越小越近，依本库返回约定标识。

## 过滤与回查

在同一模型与同一候选范围下比较结果，再读原文。

```text
python local/runtime.py --tool milvus
```

观察：本地轻量模式不代表分布式性能；记录数据规模与依赖版本。

## 原项目

[Milvus Lite 原代码库](https://github.com/milvus-io/milvus-lite)
