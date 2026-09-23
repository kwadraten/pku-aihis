# 重算课堂向量

先按根目录说明安装 `apps/week03` 的锁定 Node 依赖。模型的固定修订及文件散列在 models.json；下载约380MB，权重不进入Git。Python图像程序需要 `requests==2.34.2`、`onnxruntime==1.30.0`、`Pillow==12.3.0`、`numpy==2.5.3`。本次运行环境与模型见数据包内manifest。

```sh
python local/download-models.py models
node local/compute-vectors.mjs models
python local/compute-kuzushi.py --models models
```

第一项下载并核散列；第二项读取公开 corpus.json 的正文，重算27条文本、9条查询及7张图片、4条图文查询；第三项从指定上游数据集八处固定位置取48张图，计算768维特征。该数据是模型训练源，仅作教学近邻示范，不报告独立准确率。上游数据修订、行号与原标签保存在multimodal.json。

仅改变作者/页码元数据不需要重算文本向量；正文、截断、模型或池化改变时须重算全部对应向量。重算后重新运行四种本地检索，将结果写入tools.json，并运行构建/公开包检查。数值因ONNX运行平台不同可能有浮点差异。

完整OCR在课程文件夹“修订与演示开发_20260922/本地语料”中，其脚本带本机输入路径，故不复制到公开库。公开corpus.json本身是经审阅的短篇选段输入，不从完整PDF自动再选取。

## 新导入语料的独立向量包

纯文本 JSONL 不带向量，不能复用默认史料的向量。用已安装依赖和已下载且散列匹配的固定 MiniLM 准备独立文件：

```sh
node local/prepare-import-vectors.mjs \
  --input data/week03/cross-domain/imports \
  --output local-only/cross-domain-vectors \
  --model-root /path/to/downloaded/embedding-and-vision
```

`--input` 可重复，接受 JSONL 文件或目录；输出目录必须尚不存在。脚本核对 `local/models.json` 的模型文件 SHA-256，禁止远程下载。
每条正文实际编码为384维归一化向量，原字段不变，另加 `embedding_text_sha256`；`preparation.json` 记录输入、输出散列和条数。
模型最多读取前512 tokens，不表示已编码所有长段落。不要提交含未获公开许可正文或论坛内容的派生向量包。

启动 `python3 local/start-classroom.py --no-browser` 后，可用已安装的 Playwright 执行浏览器验收：

```sh
node scripts/check-week03-import-browser.mjs \
  --vectors /path/to/prepared-vectors \
  --output local-only/import-browser-check \
  --playwright-module /path/to/playwright/index.mjs --generation
```

该验收还使用本地准备的 `全部公开语料.vectors.json`（将11份公开向量文件的records合并，保留相同manifest.embedding）。
`--forum-text /path/to/reviewed/forum/imports` 可选，要求同一向量目录内有对应239条与3条白名单向量包。
`--generation` 实际调用本机已安装生成模型；另有明确标记的错误引用模拟测试。完整结果见验收报告，不把一次模型答复推广为准确率。
