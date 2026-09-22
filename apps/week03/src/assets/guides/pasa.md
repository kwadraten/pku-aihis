# PaSa 本地实践

来源：https://github.com/bytedance/pasa

论文研究工具链。先核对材料可访问性，再观察检索、选择和证据问答。

适用范围：本地代码库运行方案；网页不提供伪造的论文发现或预设智能体成果。

## 安装与配置

在独立环境中按原仓库说明固定commit与依赖；配置本机模型及搜索权限。

```text
git clone https://github.com/bytedance/pasa.git
# 进入目录，保存 git rev-parse HEAD
# 按锁定版本README创建虚拟环境并安装依赖
```

观察：原库可能下载模型或要求服务凭据；未执行的步骤保持未执行。

## 工具顺序

查看该系统可调用的工具及停止条件。

```text
search / crawl / select
```

观察：工具名称、参数、返回、成功或失败需各自可见。

## 历史语料适配

用本地材料时先准备清晰的文本与来源，再按原库文档接入。

```text
query → candidate papers → full text → evidence
记录未取得全文、OCR待核、年份/文体缺失。
```

观察：PaSa论文搜索、PaperQA2证据问答职责不同；原论文评测不能外推历史准确率。

## 运行与验证口径

网页步骤展示不是执行日志。仅在页面明确出现带版本和时间的运行结果时记为实跑。服务型工具在本地启动，GitHub Pages只提供前端。真实语料使用同一份带页码记录的JSON；模型及向量配置须兼容。完整OCR保留本机。

## 原库可落实的准备顺序（2026-09-22核对）

原版需要两个7B模型（Crawler与Selector）、paper_database及Serper搜索权限，宜使用另备的GPU环境，不承诺本机Mac直接运行。

```sh
git clone https://github.com/bytedance/pasa.git
cd pasa
git rev-parse HEAD
python -m venv .venv
. .venv/bin/activate
git clone https://github.com/hyc2026/transformers.git
pip install -e ./transformers
pip install -r requirements.txt
# 按原库链接下载pasa-dataset到data，两个模型到checkpoints
# utils.py的搜索凭据读取改为本地环境变量；不把密钥提交Git
python run_paper_agent.py
```

运行前检查脚本中的数据、模型路径与查询输入。先用原库示例验证工具调用，再尝试课程研究问题；原库的AI论文数据库不是井上/章太炎史料库。把历史语料接入需要另写检索适配器，不能仅改提问文字便宣称完成迁移。网页D25用于展示Crawler搜索/扩展与Selector判定的职责分离；本次未执行这组模型。

依据：[PaSa原仓库本地说明](https://github.com/bytedance/pasa#run-locally)。
