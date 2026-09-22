# Skill 装载与后续使用

## 已装载的助教 skill

名称：`guizang-ppt-skill`。源文件：助教提供的同名 ZIP，散列见 [基线记录](repository-baseline.md)。

本机安装位置为 `~/.codex/skills/guizang-ppt-skill/`，并建立 `~/.agents/skills/guizang-ppt-skill` 指向它的发现入口。已核验 72 个原始文件的内容，另附 `INSTALLATION_MANIFEST.json` 记录逐项散列；排除了 605 个依赖、缓存和构建文件，未执行初始化脚本或依赖安装。原始 ZIP 保持不变。

当前任务已阅读全文；下一轮可由技能发现机制加载。其他团队成员不会因克隆此仓库而自动获得本机 skill，应按同一 ZIP 和散列安装。若以后要随项目分发，可将经过核对的版本放入项目 `.agents/skills/`，保留来源和原有声明，再单独审阅入库范围。用户级与项目级同名副本应避免长期并存造成版本混淆。[官方 skill 位置与结构说明](https://learn.chatgpt.com/docs/build-skills)

## 本项目使用时的解释规则

| 实际观察 | 使用约定 |
|---|---|
| 主文档前半采用 Stencil / Web Components，后半仍保留旧单文件流程 | 复用助教工程时以 Stencil 路径为准；旧模板仅供视觉及交互参考 |
| 有一处 `file:///D:/.../interactive-schemes.md` | 阅读 skill 根目录下的 `references/interactive-schemes.md`；原文未被改写 |
| 初始化器复制脚手架后调用 `pnpm install` | 新建工程时才使用；不在已有助教工程目录运行 |
| 旧演讲者校验器寻找 `<section class="slide">` 和 `SPEAKER_NOTES` | 不直接用于认定 `<deck-slide>` 工程通过；后续需适配检查或浏览器验收 |
| 旧流程称可以直接打开单个 HTML，新流程使用开发服务器 | Stencil、模块、WASM 等通过 HTTP 预览；离线能力另测 |
| 文档中存在“零外部依赖”等概括 | 以实际网络请求、资源清单和断网测试为准 |
| skill 要求复杂机制提供 2–3 个交互备选 | 后续内容设计时落实；已经由教师选定的形式直接按选择实施 |

本轮只装载和记录兼容问题，没有改写助教 skill 的教学内容，也没有修复或运行演示工程。

## 检索到的 GitHub 相关 skill

| 候选 | 适用阶段 | 本轮处理 |
|---|---|---|
| `gh-fix-ci` | PR 的 GitHub Actions 检查失败时，读取日志并定位问题 | 已查看官方 skill 页面，登记备用；当前没有 CI 失败，未安装或调用 |
| `gh-address-comments` | PR 已有审阅意见，需要逐项处理时 | 搜索发现官方 GitHub 插件中的候选条目；本轮全文获取失败，未作为已核实可用能力 |
| `yeet` | 用户明确要求一次完成暂存、提交、推送和创建 PR | 已查看官方说明；包含全量暂存等与本项目习惯不同的步骤，暂不作为默认流程，未安装或调用 |

参考：[gh-fix-ci 官方说明](https://github.com/openai/skills/blob/main/skills/.curated/gh-fix-ci/SKILL.md)、[gh-address-comments 检索入口](https://github.com/openai/plugins/blob/main/plugins/github/skills/gh-address-comments/SKILL.md)、[yeet 官方说明](https://github.com/openai/skills/blob/main/skills/.curated/yeet/SKILL.md)。安装前再次核对文件及版本。

现有 GitHub 连接器已足够进行仓库读取和未来授权范围内的常规操作。流程的持久约定放在 `AGENTS.md`、`CONTRIBUTING.md` 与 PR 模板中；不必为了本轮规范设计额外安装一组功能重叠的工具。
