# pku-aihis

《人工智能赋能历史研究与写作》的网页演示源码与协作仓库。第三周包含33页可操作的“检索与证据”演示，教案、完整OCR与私人原件保留在课程文件夹。

课堂入口部署到 **[第三周](https://lyzhackjp.github.io/pku-aihis/week03/)**；实际发布提交和检查范围见 [交接与运行状态](docs/week03/handoff.md)。

## 本地使用

使用 `.node-version` 中的 Node 24.19.0 和 pnpm 11.19.0：

```sh
cd apps/week03
pnpm install --frozen-lockfile --ignore-scripts
pnpm test
pnpm run check
pnpm build
cd ../..
node scripts/build-site.mjs
python3 local/runtime.py
```

打开 http://127.0.0.1:8767/week03/ 。Python标准库即可提供静态预览；数据库重跑需要 Python 3.12 安装 `local/requirements.txt`。生成模型及服务配置见 [本地课堂说明](apps/week03/src/assets/guides/local-runtime.md)。

方向键翻页，课程地图选择页面，P打开演讲者窗口，B关闭动效。文字框内方向键正常编辑；按钮空格保持激活操作。D01可在本机导入带records的JSON或JSONL，完整OCR包可按卷导入。自由查询的浏览器嵌入会首次下载约118MB模型；已存查询与向量排序无需下载模型。

## 实际功能与边界

- 浏览器真实执行：OpenCC、正则Worker、教学BM25、精确余弦、RRF、人工判断指标、Lucivy全文、EdgeVec近邻。
- 已在本机计算：27条史料片段与9条文本查询的384维嵌入；7张原页和4条CLIP查询；48张崩字图的768维特征。模型、数据与预计算程序见 [local/PRECOMPUTE.md](local/PRECOMPUTE.md)。
- 已在本机运行并保存结果：Tantivy、Chroma、Qdrant、Milvus Lite。网页可通过本地桥接重跑。
- 已实现但需另接模型：RAG生成、模型选工具循环。未配置模型时显示明确失败，不返回预设答案。
- 单独提供部署指南：AnythingLLM、Elasticsearch、OpenSearch、PaSa、PaperQA2、deep-research及研究评测框架；不把步骤切换当作后台执行。

公开的27条节录含已核片段和明确标为待核的OCR；它们不是全库，也不是独立评测集。模型分数不是史实置信度。教师论文只保存两条有页码的书目引用关系。

## 助教接续

[逐页设计](docs/week03/page-map.json) · [开发方案](docs/week03/design.md) · [课程制作skill](.agents/skills/history-demo-courseware/SKILL.md) · [贡献流程](CONTRIBUTING.md) · [发布流程](docs/ci-and-release.md) · [来源许可](docs/third-party-notices.md)

短期分支 → PR → `build-week03`检查 → Squash合并 → 主线手动发布。发布周次由published-weeks.json维护，组装全站，不能覆盖掉旧周次。助教加入后再根据实际账号配置审阅职责，不预填虚构CODEOWNERS。
