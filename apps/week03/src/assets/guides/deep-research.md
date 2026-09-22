# deep-research 本地实践

来源：https://github.com/dzhng/deep-research

多轮搜索、阅读和问题分解的一个开源实现；不是独立的史学裁判。

适用范围：依赖外部搜索与模型服务；网页展示框架和本地部署方案，不宣称已完成原库实跑。

## 部署与服务

克隆原库并遵循其README安装；检索和模型API在本机环境变量配置。

```text
git clone https://github.com/dzhng/deep-research.git
cd deep-research
npm install
# 按仓库 .env.example 配置模型和搜索服务；不提交 .env
```

观察：记录实际commit、模型、搜索服务与费用预算。

## 多轮研究

观察 breadth/depth 设置与本轮搜索、发现、下一轮问题。

```text
输入问题 → search → learnings → follow-up questions
后续轮次不得丢掉原问题和资料限制。
```

观察：更多轮次不自动增加证据；应比较新增材料。

## 接入本课材料

原库侧重在线搜索；要限定本地语料，需要明确替换搜索适配器。

```text
原search接口 → 本课source_id / text / locator结果
完成适配前标记：本地史料接入尚未运行。
```

观察：不能把本课固定步骤动画当原库正在运行。

## 运行与验证口径

网页步骤展示不是执行日志。仅在页面明确出现带版本和时间的运行结果时记为实跑。服务型工具在本地启动，GitHub Pages只提供前端。真实语料使用同一份带页码记录的JSON；模型及向量配置须兼容。完整OCR保留本机。

## 可复现的启动入口

```sh
git clone https://github.com/dzhng/deep-research.git
cd deep-research
git rev-parse HEAD
npm install
# 在本地.env.local配置FIRECRAWL_KEY及模型端点
npm start
```

原库支持本地模型端点 `OPENAI_ENDPOINT`、`OPENAI_MODEL`，或其指定的模型服务key。首次教学把广度设2、深度设1并记录预算，依次保存生成的查询、抓取页面、新增发现与report.md/answer.md。Firecrawl处理的是网络页面；本地历史语料不能自动出现在其中，须另写适配器或与D21本地检索比较。原仓库支持的环境变量见[官方说明](https://github.com/dzhng/deep-research)。本次仅提供部署方案。
