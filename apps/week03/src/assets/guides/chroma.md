# Chroma 本地实践

来源：https://github.com/chroma-core/chroma

用集合组织向量、文档ID与来源元数据；向量由兼容编码器产生。

适用范围：本课使用本地轻量运行；公开网页保留运行记录与重跑入口。

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
collection.add(ids=ids, documents=texts, embeddings=vectors, metadatas=metadata)
collection.query(query_embeddings=[query_vector], n_results=5)
```

观察：Cosine越大越近；L2距离越小越近，依本库返回约定标识。

## 过滤与回查

在同一模型与同一候选范围下比较结果，再读原文。

```text
python local/runtime.py --tool chroma
```

观察：本地轻量模式不代表分布式性能；记录数据规模与依赖版本。

## 运行与验证口径

网页步骤展示不是执行日志。仅在页面明确出现带版本和时间的运行结果时记为实跑。服务型工具在本地启动，GitHub Pages只提供前端。真实语料使用同一份带页码记录的JSON；模型及向量配置须兼容。完整OCR保留本机。
