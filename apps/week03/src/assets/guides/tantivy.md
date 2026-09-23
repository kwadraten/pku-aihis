# Tantivy｜D17

本说明对应 2026-09-23 的实际安装与运行。教师本机的应用数据、源代码、模型与日志位于“第三周（9月24日）/本地应用与服务”及本周既有本地模型目录。点击“启动完整课堂.command”，保持窗口开启；进入 http://127.0.0.1:8767/week03/ 。公开网页只发布课堂片段、脱敏运行结果和截图，不包含密钥、模型权重或完整史料。

“本地重跑”调用真实服务，失败时保留错误；不会用保存结果冒充本轮响应。页面的步骤按钮只切换解释。外部API接入在“模型接入”面板中设置，适用于独立模型实验；各应用使用其自身配置的本地模型。

## 当前部署

应用内全文索引库，不自带完整聊天客户端。

网页展示库处理步骤；真实索引在本机Python/Rust运行。

实际运行时间：2026-09-22T20:34:18+0800。版本：0.25.1。查询：宗教。

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

## 原项目

[Tantivy 原代码库](https://github.com/quickwit-oss/tantivy)
