# 检查、发布与恢复

2026-09-22实施版本。旧流程准备阶段已结束；本文件描述当前工程。

## 检查

`.github/workflows/check.yml`在PR及main更新时执行稳定作业`build-week03`：锁定Node与pnpm、冻结锁文件安装、数值测试、TypeScript检查、Stencil构建、全站组装及公开包检查。普通检查仅`contents: read`，不接收模型密钥。

浏览器验收另记实际浏览器、窗口尺寸与操作。课堂截图证明布局，算法测试证明受测数值行为，两者不能替代史料核读。最近记录见`docs/week03/handoff.md`。

## 发布

`Publish classroom`只接受`workflow_dispatch`且分支必须为main。构建绑定触发时的`github.sha`，通过同一检查后上传`site/`，独立部署作业才获得`pages: write`与`id-token: write`。GitHub官方Actions按完整SHA固定；Pages来源设为Actions，github-pages环境仅允许main。

```sh
gh workflow run pages.yml --ref main
gh run list --workflow pages.yml --limit 3
```

`published-weeks.json`列出全体已发布周次。Stencil本身按`/pku-aihis/week03/`生成子目录，组装脚本把每周的入口、构建资源与assets放到`site/weekXX/`。仅上传这个白名单站点，不上传源码仓库、私人原件、完整OCR、模型权重、教案或密钥。每次生成release-manifest.json，记录逐文件SHA-256。

GitHub Pages不能设置自定义隔离头；第三周使用限定本周作用域的service worker添加COOP/COEP，首次控制后刷新。它不提供离线缓存。Lucivy需要crossOriginIsolated=true。完整离线备用请使用本地HTTP服务，或本次打包的静态产物；自由查询模型及外部服务不在离线包。

## 协作与恢复

日常修改经短期分支和PR。主线应要求实际成功过的`build-week03`检查，禁止强推/删除；助教尚未加入前不设置无人可履行的指定审阅人。新增协作者与通知由教师决定，AI独立检查不冒充教师或助教审批。

故障时先用本地已验证课堂包。在修复分支做最小修复或`git revert`，经过PR检查合入main，再手动发布全站；保留旧标签和历史，不移动主线标签或强推。发布记录注明提交、Actions运行、地址及不能离线使用的功能。

设计依据：[GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow)、[Pages自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[部署环境](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)。
