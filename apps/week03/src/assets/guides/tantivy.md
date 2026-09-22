# Tantivy 本地实践

来源：https://github.com/quickwit-oss/tantivy

应用内全文索引库，不自带完整聊天客户端。

适用范围：网页展示库处理步骤；真实索引在本机Python/Rust运行。

## 模式与写入

定义存储字段，写入检索文本和source_id。

```text
schema = SchemaBuilder().add_text_field("body", stored=True)
index = Index(schema)
writer.add_document(...)
```

观察：字段如何切词？原文与检索字段怎样分开？

## 提交与读取

提交后取得已刷新reader的searcher，再查询。

```text
writer.commit()
index.reload()
searcher = index.searcher()
query = index.parse_query("宗教", ["body"])
hits = searcher.search(query, 5)
```

观察：searcher是快照，空结果可能来自未刷新。

## 本课重跑

使用随仓库提供的实际Python适配器与同一语料。

```text
python local/runtime.py --tool tantivy
```

观察：查看库版本、查询、文档ID和原页。

## 运行与验证口径

网页步骤展示不是执行日志。仅在页面明确出现带版本和时间的运行结果时记为实跑。服务型工具在本地启动，GitHub Pages只提供前端。真实语料使用同一份带页码记录的JSON；模型及向量配置须兼容。完整OCR保留本机。
