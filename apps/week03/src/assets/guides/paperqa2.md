# PaperQA2 本地实践

来源：https://github.com/Future-House/paper-qa

论文研究工具链。先核对材料可访问性，再观察检索、选择和证据问答。

适用范围：本地代码库运行方案；网页不提供伪造的论文发现或预设智能体成果。

## 安装与配置

在独立环境中按原仓库说明固定commit与依赖；配置本机模型及搜索权限。

```text
git clone https://github.com/Future-House/paper-qa.git
# 进入目录，保存 git rev-parse HEAD
# 按锁定版本README创建虚拟环境并安装依赖
```

观察：原库可能下载模型或要求服务凭据；未执行的步骤保持未执行。

## 工具顺序

查看该系统可调用的工具及停止条件。

```text
PaperSearch / GatherEvidence / GenerateAnswer / CitationTraversal
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

## 最小启动方案

在Python 3.11以上的独立环境安装 `paper-qa>=5`，随后保存实际安装版本；当前上游已采用CalVer，不能仅凭“PaperQA2”名称推断包版本。在只放本次授权材料的目录运行：

```sh
python -m venv .venv
. .venv/bin/activate
pip install 'paper-qa>=5'
pip freeze > requirements-resolved.txt
pqa view
pqa -s fast ask '这些材料怎样区分宗教、信仰与国家？'
```

执行前配置模型与嵌入服务，保存模型名和费用预算。为史料显式提供标题、作者及版本，不让现代论文元数据接口凭标题补造DOI。检查实际context、证据摘要及引用是否能回到原页；清空一篇关键材料后比较回答。此方案尚未安装执行。

依据：[原库安装与CLI说明](https://github.com/Future-House/paper-qa/blob/main/README.md)。
