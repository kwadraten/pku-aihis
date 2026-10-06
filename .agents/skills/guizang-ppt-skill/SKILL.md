---
name: guizang-ppt-skill
description: 基于 Stencil 与 Web Components 构建的高密度技术培训课件系统（支持 pnpm 脚手架一键生成项目）。摒弃长篇纯文本念稿，强调在网页中嵌入真实可交互的 UI 范例（如 Tokenizer 探针、参数采样滑块、五层推断状态机、高维余弦几何）。在设计过程中强制针对复杂机制提出多个交互范例方案供用户决策选择。支持双屏演讲者视图同步、瑞士高密度网格与无衬线设计。
---

# High-Density Technical Courseware (高密度技术培训课件系统)

> 架构基石: 基于原 guizang-ppt-skill 精致版式与演讲者同步协议，已彻底重构为**基于 Stencil 与标准 Web Components 的工程化课件脚手架**。本项目全面使用 `pnpm` 进行工程管理。

## 这个 Skill 做什么

将传统演讲 PPT 转型为**高信息密度、强交互性、工程化可复用**的技术培训课件系统：

### 核心四大转变

1. **从手写单文件 HTML 跃迁为 Stencil & Web Components 架构**：
   - 彻底摆脱在单个巨型 HTML 中手动复制粘贴脆弱 CSS 的模式。
   - 采用现代标准 Web Components：`<deck-container>`、`<deck-slide>`、`<layout-split>`、`<deck-presenter>`。
   - 强类型 Props、Shadow/Scoped CSS 隔离、插槽组合与组件级生命周期。
2. **拒绝死板文字，偏好真实可操作的网页 UI 范例（Show & Interact）**：
   - 复杂的技术机制（如 Transformer 矩阵乘法、BPE 词元编码、Softmax 温度采样、高维向量空间）**严禁堆砌长篇文字要点**。
   - 每一处难点均嵌入**浏览器内可直接操作、带实时计算与状态透视的 Web Component**。
3. **作者 HTML 模板全量改写为 Stencil 脚手架（Scaffold Starter）**：
   - 内置在 `assets/scaffold/`，包含完整的构建工具链、双屏广播同步协议、Swiss 瑞士高密度设计系统。
   - 提供 `scripts/create-deck-project.mjs`，一键通过 `pnpm` 创建全新的课件工程。
4. **针对每个复杂机制强制提供多套范例方案供用户选择**：
   - 在课件设计过程中，针对课程中出现的每一个抽象概念，智能体**必须提出 2~3 个不同交互形态与教学侧重点的方案**。
   - 向用户清晰呈现方案对比表，由用户决断或组合后再行编码实现。

---

## 何时使用

**核心适用场景**：
- **高密度技术培训课件**：如大模型架构与底层推断、操作系统内核、微服务与网络协议栈。
- **高校与科研学术深度研讨**：如历史文献量化分析、计算人文、高维空间几何、神经网络实证。
- **现场实操 Workshop 与技术分享**：讲师需要在台上直接拖拽参数滑块、切换状态机，直观演示底层变化。
- **需要双屏演讲者提词与学员屏自动同步**的高水准教学演讲。

**严禁行为（Anti-Patterns）**：
- ❌ **严禁制作长篇大论、满屏 Bullet Points 的文字墙**。
- ❌ **严禁在未向用户提议交互方案的情况下直接单方面写死复杂内容的展现形式**。
- ❌ **严禁使用不可交互的假截图来解释动态参数或流式逻辑**。

---

## 工作流

### Step 0 · 环境检查（使用 pnpm）

确保当前系统已配置 Node.js (>= 18) 与 `pnpm`：

```bash
pnpm -v
node -v
```

如果未安装 pnpm，提示用户运行 `npm install -g pnpm` 或 `corepack enable`。

### Step 1 · 课程需求澄清与抽象机制梳理

不要一开始就写代码。首先与用户梳理课程的骨架与关键难点：

1. **课程主题与受众定位**：受众的技术背景是初学者、算法工程师还是跨学科研究者？
2. **核心抽象难点清单**：找出本堂课中最晦涩、最需要具象化交互展示的概念（例如：“一次请求的五层路径”、“BPE 分词”、“温度与核采样 Top-P”、“高维嵌入向量余弦距离”）。
3. **授课时长与页数预算**：45 分钟课程建议规划 12~18 页高密度 Slide，预留课堂动手演练时间。

### Step 2 · 初始化课件工程（基于 Stencil 脚手架与 pnpm）

使用内置脚本在指定目录初始化课件工程：

```bash
node "<SKILL_ROOT>/scripts/create-deck-project.mjs" "目标课件目录路径"
```

该脚本将完成：
1. 从 `<SKILL_ROOT>/assets/scaffold/` 拷贝完整的工程模板；
2. 自动在目标工程目录下运行 `pnpm install` 安装 Stencil 与 TypeScript 依赖；
3. 输出就绪提示与开发指令。

### Step 3 · 针对每个复杂机制提出多个交互方案（★ 核心硬规则）

这是本 Skill 的核心工作范式。在规划或编写涉及复杂机制的 Slide 时，**必须先停下来，为该知识点构思 2~3 套可操作的交互方案，并向用户展示方案对比，征询选择**：

#### 方案生成标准结构

向用户输出如下结构的选择题：

> 💡 **复杂机制交互方案设计**
>
> 针对知识点 **【知识点名称】**，设计了以下候选交互方案，请选择最符合教学目标的方案：
>
> | 方案 | 交互形态与核心组件 | 核心教学洞察 | 交互控件设计 | 推荐度 |
> | :--- | :--- | :--- | :--- | :--- |
> | **方案 A · 参数滑块与实时概率塑形** | `<parameter-slider>` | 观察超参数如何动态平滑/锐化输出分布 | 滑块 + 实时重算柱状图 + 模式徽标 | ★★★ (推荐) |
> | **方案 B · 分步流程状态机穿透** | `<interactive-stepper>` | 观察数据在各层流转时的协议包与张量形态 | 管道节点 + 上下步按钮 + JSON 透视 | ★★☆ |
> | **方案 C · 双向对照沙盒** | `<layout-split>` + 演练场 | 极端参数生成的直接对照与差异高亮 | 左右双栏 + 运行触发按钮 | ★★☆ |
>
> 请回复您倾向的方案（如“选方案 A”），或提出修改建议。

**详细方案库与设计模式参考**：查阅 [交互方案设计规范与模式库](file:///D:/code/presentation-pku-aihis/.agents/skills/guizang-ppt-skill/references/interactive-schemes.md)。

### Step 4 · 使用 Stencil 组装课件与复用/开发 Web Components

用户确认方案后，在目标工程的 `src/index.html` 中进行组装：

```html
<deck-container deck-title="课程全名">

  <!-- 封面 Slide -->
  <deck-slide slide-id="s01-cover" layout="hero" theme="dark" kicker="PKU-AIHIS" header-title="...">
    ...
  </deck-slide>

  <!-- 经典高密度分屏 Slide：左理论，右实时交互组件 -->
  <deck-slide slide-id="s03-token" layout="split" theme="light" kicker="词元切分" header-title="...">
    <layout-split ratio="1-2">
      <div slot="left">
        <!-- 理论约束、数学公式、核心论点 -->
      </div>
      <div slot="right">
        <!-- 用户选定的交互组件 -->
        <tokenizer-playground></tokenizer-playground>
      </div>
    </layout-split>
  </deck-slide>

</deck-container>
```

#### 内置 Web Components 复用清单

- **`<deck-container>`**：课件舞台、键盘控制、全屏、全景总览（`ESC`/`O`）、低功耗模式（`B`）。
- **`<deck-slide>`**：单页容器，支持 `theme="light|dark|accent"`、`layout="hero|split|grid|interactive"`、`notes`（演讲提词）、`duration`（分钟）。
- **`<deck-presenter>`**：双屏演讲者监控台，包含计时器、进度把控、提词备注与下一页预览。
- **`<layout-split>`**：高密度分栏（`ratio="1-1" | "1-2" | "2-1" | "1-3"`）。
- **`<layout-kpi-grid>`**：工程指标与规格多卡布局。
- **`<interactive-demo>`**：通用交互卡片外壳（带 controls、visual、inspector 三个插槽）。
- **`<interactive-stepper>`**：系统多阶段流转与张量透视器。
- **`<tokenizer-playground>`**：BPE 分词、Token ID 映射与词表统计演练场。
- **`<parameter-slider>`**：温度与核采样 Logits 概率分布塑形器。
- **`<vector-inspector>`**：高维嵌入向量几何距离、夹角与余弦相似度探针。

如果现有组件库无法完全满足特定的教学机制，可在 `src/components/` 下新建 Stencil 组件，利用 TypeScript 与 JSX 快速实现自定义算法交互。

### Step 5 · 本地开发与双屏实测（pnpm start）

在课件工程根目录启动热重载开发服务器：

```bash
pnpm start
```

- 默认在浏览器打开 `http://localhost:3333`；
- **全键盘操作验证**：按 `←` `→` 翻页，按 `ESC` 检查全景卡片，按 `F` 验证全屏投影；
- **双屏演讲者测试**：按 `P` 键，浏览器将弹出演讲者监控窗口。验证在监控窗口中翻页或开始计时时，主讲台与观众屏是否完美同步；
- **交互演练测试**：鼠标拖拽各页的交互滑块与按钮，确认反应敏捷（< 50ms），数值计算准确无误。

### Step 6 · 编译生产静态包（pnpm build）

```bash
pnpm build
```

编译输出至 `www/` 与 `dist/`，生成零外部依赖的原生静态网页与自定义元素包，可直接部署至任一静态 Web 托管或本地离线运行。

---

## 核心设计哲学（高密度培训课件）

1. **范例优于文字 (Interactive over Walls of Text)**：
   讲 10 遍“温度升高增加多样性”，不如让学生直接拖动滑块看到柱状图长尾词概率从 0.1% 跃升到 18%。
2. **组件复用与强类型规范 (Web Components & Stencil Scaffolding)**：
   将复杂的交互状态机封装在自包含的 Web Component 内部，课件主文档通过简洁的 HTML 标签传参调用，彻底告别单文件乱码。
3. **方案先行，尊重用户决策 (Propose Schemes & Let User Choose)**：
   绝不在未征询的情况下自作主张。针对每个复杂知识点，始终提出多种维度的交互原型方案供用户权衡。
4. **瑞士国际主义高密度美学 (Swiss Precision & Academic Density)**：
   克制的克莱因蓝（IKB）与高反差功能高亮，纯正的无衬线排版与 JetBrains Mono 等宽代码标记，极细 Hairline 分割线与直角纯色质感。

---

## 资源与参考文档导览

```
guizang-ppt-skill/
├── SKILL.md                       ← 你正在读的主流程规范
├── assets/
│   ├── scaffold/                  ← ★ Stencil & Web Components 课件工程脚手架（pnpm 就绪）
│   │   ├── package.json           ← 依赖定义（@stencil/core, typescript）
│   │   ├── stencil.config.ts      ← Stencil 编译与打包配置
│   │   └── src/
│   │       ├── index.html         ← 课件主入口与示例文档
│   │       ├── global/            ← 全局设计变量（variables.css / app.css）
│   │       └── components/        ← 自定义 Web Components 源码
│   │           ├── deck-container/   ← 课件外壳与双屏同步
│   │           ├── deck-slide/       ← 单页高密度卡片
│   │           ├── deck-presenter/   ← 演讲者监控台
│   │           ├── layout-split/     ← 高密度双栏布局
│   │           ├── layout-kpi-grid/  ← 指标与规格矩阵
│   │           ├── interactive-demo/ ← 交互范例通用包装卡片
│   │           ├── interactive-stepper/    ← 五层推断路径/多阶段流程透视
│   │           ├── tokenizer-playground/  ← BPE 分词与 Token ID 探针
│   │           ├── parameter-slider/      ← 温度采样与 Logits 概率塑形器
│   │           └── vector-inspector/      ← 高维向量几何与余弦探针
│   ├── template.html              ← 原单文件杂志风模板快照（备用参考）
│   └── template-swiss.html        ← 原单文件瑞士风模板快照（备用参考）
├── scripts/
│   ├── create-deck-project.mjs    ← ★ 一键生成课件工程初始化脚本（集成 pnpm）
│   ├── validate-presenter-mode.mjs← 演讲者模式与数据校验
│   └── validate-swiss-deck.mjs    ← 瑞士风布局测量与合规校验
└── references/
    ├── interactive-schemes.md     ← ★ 复杂内容交互范例设计规范与方案推荐库
    ├── components.md              ← Web Components 属性手册与使用规范
    ├── presenter-mode.md          ← 演讲者提词协议与双屏同步规范
    ├── themes-swiss.md            ← 瑞士风高反差色彩系统
    └── checklist.md               ← 课件交付前 P0~P3 检查清单
```

---

### Step 4.P · 同步生成演讲者提词（正式授课必做）

在 `<deck-slide>` 的 `notes` 属性中，必须同步撰写讲师提词。每页 notes 聚焦于：
1. **本页教学任务（Purpose）**：说明本页要破除的认知误区或传递的核心机理；
2. **范例引导话术（Demo Cue）**：指导讲师在台上如何引导学员观察右侧交互控件的变化（例如：“请大家看我把温度滑块拉高时，低频词概率的变化”）；
3. **关键推导背景（Mechanism）**：补充公式背后的物理或工程意义，而非复述页面上的文字。

---

**两种风格类名互不通用**(再次强调):
- 风格 A 模板里有 `h-hero`(衬线)、`stat-card`、`grid-2-7-5`、`frame` 等
- 风格 B 模板里有 `h-hero`(无衬线)、`kpi-hero`、`accent-block`、`span-N`、`dots`、`grid-12` 等
- 同名 class 在两个模板里**视觉表现完全不同**(例:风格 A 的 `h-hero` 是 Noto Serif SC 衬线,风格 B 的 `h-hero` 是 Inter 无衬线)

**在写任何 slide 代码之前:**

1. **先 Read 当前用的模板**(至少读到 `<style>` 块末尾):
   - 风格 A → `assets/template.html`
   - 风格 B → `assets/template-swiss.html`
2. **对照对应 layouts 文件的 Pre-flight 列表**,确认你要用的每个类都在 `<style>` 里存在
3. 如果某个类缺失:**在模板的 `<style>` 里补上**,不要在每个 slide 里 inline 重写
4. **模板是唯一的类名来源**——不要发明新类名,如需自定义用 `style="..."` inline

**风格 A 常见容易遗漏的类**:
`h-hero` / `h-xl` / `h-sub` / `h-md` / `lead` / `kicker` / `meta-row` / `stat-card` / `stat-label` / `stat-nb` / `stat-unit` / `stat-note` / `pipeline-section` / `pipeline-label` / `pipeline` / `step` / `step-nb` / `step-title` / `step-desc` / `grid-2-7-5` / `grid-2-6-6` / `grid-2-8-4` / `grid-3-3` / `grid-6` / `grid-3` / `grid-4` / `frame` / `frame-img` / `img-cap` / `callout` / `callout-src` / `chrome` / `foot`

**风格 B 常见容易遗漏的类**(2026-05 重构后):
- 画布:`canvas-card` / `chrome-min`
- 排版:`h-hero`(无衬线 7.4vw weight 200) / `h-statement`(9.6vw) / `h-xl` / `h-md` / `t-cat`(SemiBold 600 小标) / `t-meta`(mono uppercase) / `lead` / `num-mega` / `mono`
- 卡片(四类互斥):`card-ink` / `card-accent` / `card-fill` / `card-outlined`
- 网格:`grid-12` / `grid-2-9` / `grid-2-9-5` / `span-N`
- 时间线:`timeline-v` + `tl-node` + `tl-axis` + `dot` / `timeline-h` + `tl-h-node` + `tl-h-axis`
- 图表:`kpi-tower-row` + `bar-tower` / `h-bar-chart` + `bar-row` + `bar-fill` / `spec-bars` + `bar-vert`
- 装饰:`dot-mat`(SVG mask 实心点)/ `ring-mat`(描边圆)/ `cross-mat`(× 网格)/ `hr-hairline`
- 版式专属:`cover-split` / `closing-split` / `duo-compare` + `vrule` / `manifesto-top` + `ink-banner-full` / `three-forces` / `loop-diagram` / `matrix-fill` + `matrix-cell` / `brief-grid` + `brief-card` / `system-diagram` / `why-now-grid` / `four-cards` / `stacked-ledger` + `ledger-row` / `tech-spec` / `image-hero` + `hero-img-wrap` + `hero-overlay-block` + `hero-stats`
- 图片混排:`frame-img` / `fit-contain` / `r-21x9` / `r-16x9` / `r-16x10` / `h-22` / `h-26` / `swiss-img-split` / `swiss-img-grid` / `swiss-img-caption` / `swiss-keyline` / `swiss-lined`
- spacing token:`--sp-3`...`--sp-13`(8/12/16/24/32/40/48/64/80/96/160 px)

#### 3.0.5 · 规划主题节奏（**和类预检同等重要**)

**在挑布局之前**,必须先列出每一页的主题 class(`hero dark` / `hero light` / `light` / `dark`)并写到文档或草稿里对齐。详细规则看 `references/layouts.md` 开头的"主题节奏规划"一节。

**强制规则**:

- 每页 section 必须带 `light` / `dark` / `hero light` / `hero dark` 之一,不要只写 `hero`
- 连续 3 页以上同主题 = 视觉疲劳,不允许
- 8 页以上必须有 ≥1 个 `hero dark` + ≥1 个 `hero light`
- 整个 deck 不能只有 `light` 正文页,必须有 `dark` 正文页制造呼吸
- 每 3-4 页插入 1 个 hero 页(封面/幕封/问题/大引用)

**生成后自检**:`grep 'class="slide' index.html` 列出所有主题,人工确认节奏合理再交付。

#### 3.1 · 挑布局

**不要从零写 slide**。打开对应的 layouts 文件,里面有 10 种现成布局骨架,每种都是完整可粘贴的 `<section>` 代码块。

**风格 A** → `references/layouts.md`:

| Layout | 用途 |
|---|---|
| 1. 开场封面 | 第 1 页 |
| 2. 章节幕封 | 每幕开场 |
| 3. 数据大字报 | 抛硬数据 |
| 4. 左文右图(Quote + Image) | 身份反差 / 故事 |
| 5. 图片网格 | 多图对比 / 截图实证 |
| 6. 两列流水线(Pipeline) | 工作流程 |
| 7. 悬念收束 / 问题页 | 幕末 / 收尾 |
| 8. 大引用页(Big Quote) | 衬线金句 / takeaway |
| 9. 并列对比(Before / After) | 旧模式 vs 新模式 |
| 10. 图文混排(Lead Image + Side Text) | 信息密集的图文页 |

**风格 B** → 先读 `references/swiss-layout-lock.md`,再读 `references/layouts-swiss.md`。

瑞士主题默认进入 **Swiss locked mode**:

- 正文页只能使用原始参考 PPT 登记的 22 个版式 `S01-S22`;新增首页/尾页只能使用 Skill 明确提供的 `SWISS-COVER-ASCII` / `SWISS-CLOSING-ASCII`。
- 每个 `<section class="slide">` 必须写 `data-layout="Sxx"`。没有 `data-layout` 就视为未登记版式。
- 不允许临时发明 `P23/P24`、`Swiss Image Split`、`Evidence Grid` 这类原始 22P 之外的正文结构,除非用户明确要求实验版式。
- 顶部中文标题默认左对齐、处在左上内容轴。不要把小标题放左列、大标题放右列,造成视觉居中;只有原始 statement/split 版式允许强中心叙事。
- SVG 只负责几何图形。不要在 SVG 里写文字标签,所有标签改用 HTML 网格/卡片/caption。
- 地理/历史/城市路线/地点关系页使用 `S08 + Swiss Map Component`:先读 `references/swiss-map-component.md`,仍保留 `data-layout="S08"`。

原始 22 个正文版式如下:

| Layout | 用途 |
|---|---|
| S01 Index Cover | 原始索引封面 |
| S02 Vertical Timeline + KPI | 演化对比 / 年代变迁 |
| S03 Split Statement | 核心论点 / 左右分屏 |
| S04 Six Cells | 6 项概念定义 |
| S05 Three Layers | 三层架构 |
| S06 KPI Tower | 4 项数据视觉化高度差 |
| S07 H-Bar Chart | 5-10 项排名比较 |
| S08 Duo Compare | Before/After 对照 |
| S09 Dot Matrix Statement | 大引述 / statement |
| S10 Split Closing | 收束页 |
| S11 Horizontal Timeline | 4-7 步流程 |
| S12 Manifesto + Ink Banner | 阶段性结论 |
| S13 Three Forces | 3 个对等概念深化 |
| S14 Loop Form | 自学闭环 / 自动化 |
| S15 Matrix + Hero Stat | 8-12 项矩阵 + 总数据 |
| S16 Multi-card Brief | 6 项快讯小卡 |
| S17 System Diagram | 三层架构 / 生态地图 |
| S18 Why Now | 三论点 + 数据支撑 |
| S19 Four Cards | 4 项等权特性 |
| S20 Stacked KPI Ledger | 纵向账单数据 |
| S21 Tech Spec Sheet | 产品规格 / benchmark |
| S22 Image Hero | 21:9 顶图 + 标题块 + 三列 KPI |

**登记扩展**:`S08 + Swiss Map Component` 用于地点、人物住所、路线、城市关系。它不是新 layout,而是 S08 右侧插槽的 MapLibre 地图组件;必须按 `references/swiss-map-component.md` 的点位、连线、卡片和右上角缩放/拖动控制实现。

选对应 layout,粘过去,改文案和图片路径即可。**务必先完成 3.0 预检**。

**风格 B 版式多样性硬规则**:
- 7-8 页 deck 至少使用 **6 个不同 S 编号版式**;10 页以上至少使用 8 个不同版式。
- 如果用户说"测试模板 / 看看效果 / 多一点版式",必须覆盖:一个封面、一个收尾、至少 1 个对比或时间线(S08/S11/S02)、至少 1 个结构图(S14/S17/S15)、至少 1 个图片版式(S22 或 S15/S16 图片格改造)。
- 不允许连续 3 页使用同一种主体结构,例如连续三页 `head + grid + card`。
- 图片页不能偷懒发明新结构。2-3 张图时,用 S15/S16 的原始网格骨架改造成图片格;单张大图用 S22。
- 开写 HTML 前先列一张 `页码 → data-layout → 选用理由 → 图片槽位` 草稿;交付前运行 `node <SKILL_ROOT>/scripts/validate-swiss-deck.mjs index.html`。校验器会先做静态结构检查;如果环境中能解析到 Playwright,还会做真实渲染后的可见边界、底部空白、nav 安全线和标题间距测量。

#### 3.2 · 图片比例规范

永远用**标准比例**,不要用原图奇葩比例(如 `2592/1798`):

| 场景 | 推荐比例 |
|------|---------|
| S22 顶部主图 | **21:9**;照片关键主体放中央安全区 |
| S15/S16 多图格 | 统一 21:9 或统一 16:10,不能混用 |
| 左文右图 主图(风格 A) | 16:10 或 4:3 + `max-height:56vh` |
| 图片网格(风格 A) | **固定 `height:26vh`**,不用 aspect-ratio |
| 左小图 + 右文字 | 1:1 或 3:2 |
| 全屏主视觉 | 16:9 + `max-height:64vh` |
| 图文混排小插图 | 3:2 或 3:4 |

**默认不要让图片 `align-self:end`**——会滑到页面底部,很容易碰到分页组件。用 grid 容器 + `align-items:start`(template 已预设)让图片贴顶即可;如果确实需要图文底对齐,必须先控制图片高度,再使用模板已有安全区类 `.nav-safe-bottom` / `.nav-safe-bottom-tight`,不要让最低处碰到分页组件。

**风格 B 瑞士风额外规则**:
- 单张大图用 S22;多图测试用 S15/S16 的原始卡片网格改造,不要用未登记的 P23/P24
- 生成图片前先写 `data-image-slot`:例如 `s22-hero-21x9` / `s15-grid-21x9` / `s16-brief-21x9`
- S22 配图默认生成 21:9,提示词必须包含 `subject centered in the safe middle area`;照片容器用 `object-position:center 35%`,不要用 `top center`
- 图片容器必须直角、无阴影、无圆角;默认背景用白色 `var(--paper)`,不要用灰底包白底信息图
- 白底 GPT 信息图/流程图/UI 图默认不要加外框描边,不要随手套 `.swiss-keyline`;需要强调时只用 `.swiss-lined` 的顶部 accent 线
- UI/信息图如果是用户原始截图或文字密集图,才用 `.fit-contain`;如果已按 S15/S16 槽位重生成,必须用 `.frame-img.r-21x9` / `.frame-img.r-16x10` 铺满容器,不要固定 `height:18vh` 后把图缩小
- 多图同组必须统一图片槽位、比例和高度,不能混用
- GPT-M 2.0 生成图使用 `image-prompts.md` 的"风格 B:瑞士国际主义配图规则"
- 任何图片、caption、timeline label、footnote 的最低处都不能进入底部分页区域;需要贴底时用 `.nav-safe-bottom` / `.nav-safe-bottom-tight`,不要手写 `bottom:2vh`

#### 3.2.0 · 图文混排决策树（从社交卡片规则迁移）

先判断图片在这一页里的角色,再决定容器、比例和裁切方式:

- **证据截图 / UI / 代码 / dashboard**:保真优先,先读 `references/screenshot-framing.md`;关键文字和数据不能被裁掉。需要统一比例时,优先程序化背景画布 + `.fit-contain`,不要为了铺满而裁掉 UI 内容。
- **已按槽位重生成的信息图 / 插图**:按目标槽位铺满,例如 S22 用 `21:9`,S15/S16 用统一 `21:9` 或 `16:10`;不要再用短高度把图缩小成小贴片。
- **照片 / 产品图 / 人物图**:使用标准比例 + 明确 `object-position`;主体、人脸、产品和关键证据不能被标题、caption 或裁切压住。
- **文字压图 / 全屏主视觉**:先做 quiet-zone 判断,图里至少要有约 30% 低细节区域承载文字;不通过就换图、换裁切或改成图文分栏。只在必要时加局部 tint,不要整页套黑色/白色遮罩。
- **多图组**:同一组统一比例、高度、容器处理和 caption 密度;不要一张 `contain`,另一张 `cover`。
- **生成图是素材,不是整页 slide**:图片内部不要自带页眉、页脚、页码、logo、主标题、装饰边框或署名,避免和 deck chrome 重复。
- **图文呼吸**:标题、图片、caption、正文必须各自留出间距;生成后用 validator 的 `M1/M2` 检查可见边界、底部空白、nav 安全线和标题间距。

#### 3.2.1 · 中文大标题字号分档(风格 B 必做)

中文方块字视觉面积大,不能直接套英文 hero 的 6.8-7vw。写中文大标题前先分档:

| 标题形态 | 推荐字号 |
|---|---|
| 1 行,≤ 8 个中文字符 | `min(6.4vw,11.2vh)` |
| 2 行,每行≤ 8 个中文字符 | `min(5.8vw,10.2vh)` |
| 2 行,任一行 9-12 个中文字符 | `min(5.2vw,9.2vh)` |
| 3 行或更长 | 优先改写标题;不得已用 `min(4.6vw,8.2vh)` |

如果标题挤占了图片或正文区域,先压缩标题文案,再降字号;不要靠把下方内容推到底来硬塞。

#### 3.2.2 · 瑞士风演示最小字号与字重阶梯(风格 B 必做)

瑞士风用于投屏演示时,小字不能按网页注释的 10-12px 写。默认遵守以下下限:

| 文本类型 | 最小字号 |
|---|---|
| 正文段落 / 主要说明 | `18px` |
| 卡片描述 / 列表 / 时间线说明 / caption / 图注 | `16px` |
| meta / kicker / mono label / 图表标签 | `14px` |

如果内容放不下,先删减文案、拆成两页、换更适合的 Sxx 版式,不要把字号压到 10/11/12/13px。尤其是中文 deck,不要为了塞三行解释把 `body-sm`、caption、timeline label 改小。

**字号与字重阶梯(瑞士风核心)** — "越大越细,越小越粗"不是感性描述,而是具体映射:

| 字号区间 | 推荐字重 | 典型场景 |
|---|---|---|
| ≥ 8vw | 200 (ExtraLight) | 封面大字、巨号 KPI、h-statement |
| 4-7.9vw | 200-300 | 章节标题(h-xl/h-xl-zh)、大编号 |
| 1.8-3.9vw | 300-400 | 中型标题、takeaway 标题(≈1.8vw)、中号数字 |
| 1-1.7vw / 16-20px | 400-500 | 正文段落、卡片描述、说明文字 |
| 13-15px(小字) | 500-600 | meta、kicker、角标、图表标签、caption 强调 |

**硬规则:**
- 同一页内,字号越小的元素字重必须 ≥ 字号越大的元素(不允许 16px 正文用 300 而 1.8vw 标题用 500)
- 16px 左右的小字拒绝使用 weight 300(太细不可读),最低 400,推荐 500
- 封面/IkB 反白大标题内强调字用 `italic + weight 300`,不要用 accent 色(蓝压蓝看不见)

组件细节(字体、颜色、网格、图标、callout、stat-card 等)在 `references/components.md`。

### Step 4 · 对照检查清单自检

生成完一定要打开 `references/checklist.md`，逐项对照。里面总结了**真实迭代过程中踩过的所有坑**，P0 级别的问题（emoji、图片撑破、标题换行、字体分工）必须全部通过。

所有正式演讲 deck 先跑演讲者模式校验;如果用户给了目标时长,同时传入分钟数:

```bash
node <SKILL_ROOT>/scripts/validate-presenter-mode.mjs path/to/index.html
node <SKILL_ROOT>/scripts/validate-presenter-mode.mjs path/to/index.html --target-minutes 30
node <SKILL_ROOT>/scripts/check-presenter-runtime-sync.mjs
```

第一个脚本会拦截缺失/重复页面 ID、备注与页面错位、必填字段或可选字段类型错误、完整时间计划超出 90% 预算,以及计时、排练、自动翻页、标注、演前检查和观众屏恢复控件缺失。第二个脚本会拦截两套模板之间的演讲者 CSS / JS 漂移。

#### 4.0.1 · 先量后改:超出 / 空白 / 标题间距

当一页内容超出或显得巨空时,不要先凭感觉大幅删改。先运行:

```bash
node <SKILL_ROOT>/scripts/validate-swiss-deck.mjs path/to/index.html
```

看校验输出里的测量项:

- `M1 DOM/visual overflow`:具体超出多少 px,以及最低/最高问题元素
- `M1 bottom whitespace`:底部空白多少 px,active content height 占比多少
- `M1 nav-safe`:最低内容是否进入底部分页安全线
- `M2 title gap`:标题和下一块内容之间的实际距离

修正阶梯:

- `1-40px` over:只微调,上移内容组或收紧一个 gap/padding,不要删内容。
- `40-90px` over:局部压缩间距或模块高度,仍优先保留内容。
- `90-160px` over:轻微压标题或压缩一段正文,必要时拆页。
- `160px+` over:才考虑换版式、合并模块或删内容。

修完再跑一次 validator。如果 `M1 bottom whitespace` 变大,说明修过头了;恢复部分间距、放大最后一块或把内容组向下回调。

#### 4.0 · 不只看代码:必须打开网页做视觉核对

代码只能证明类名和结构存在,不能证明版式舒服。生成后必须打开网页逐页看:

1. 同时打开当前模板(golden source 快照)或生成页、以及正在迭代的测试 PPT 逐页对照。
2. 截图前等入场动效稳定(约 1-2 秒),不要把动画中间态当成版式问题。
3. 先看视觉:大标题字重、标题与内容间距、图片是否与正文对齐、图片/说明是否碰到底部分页组件。
4. 再看代码:确认该页选用的版式与内容形状匹配,没有把数据专用版式拿来讲概念,也没有把可选组件堆成装饰。
5. 对照原始参考模板时,以实际页面用法为准,不要只看 CSS helper 定义;原始页面的大字实际多为 200/300,不要被 raw CSS 里的 700/800/900 带偏。
6. 如果页面别扭,先判断是版式选错、必选组件缺失、可选组件滥用,还是间距/安全区问题;不要直接靠加 margin 硬救。

#### 风格 A · 电子杂志风必查

1. **大标题必须是衬线字体**——如果显示成非衬线,99% 是 Step 3.0 预检没做,`h-hero` 类在 template.html 里缺失
2. **图片网格里只用 `height:Nvh`,不用 `aspect-ratio`**(会撑破)
3. **图片不能堆到页面底部**——不要用 `align-self:end`,用 grid + `align-items:start`(见 Step 3.2)
4. **图片只能用标准比例**(16:10 / 4:3 / 3:2 / 1:1 / 16:9),不要复制原图的奇葩比例
5. **中文大标题 ≤ 5 字且 `nowrap`**(避免 1 字 1 行)
6. **用 Lucide,不用 emoji**
7. **标题用衬线,正文用非衬线,元数据用等宽**

#### 风格 B · 瑞士国际主义必查

1. **全程无衬线**——任何衬线字体出现都是错的(检查 `font-family` 没用 `--serif` 类变量)
2. **只有一个 accent 色**——一份 deck 不能同时出现 IKB 蓝 + 柠檬黄 + 安全橙等多个高亮色
3. **不允许渐变 / 阴影 / 圆角**——所有色块直角纯色,任何 `box-shadow` / `linear-gradient` / `border-radius` > 0 都要砍掉(rule 横线除外)
4. **极致字号对比**——主标题与正文比例 ≥ 8:1
5. **大字号必须双约束限高**——`font-size:min(Xvw, Yvh)`,只用 vw 在标准 16:9 屏会溢出(吸取 P15/P20/P22 教训)
6. **大字字重 200**(ExtraLight)——字号越大越细,瑞士风灵魂;**禁止** 600/700/800 大字
7. **卡片填充类型互斥**——`card-ink` / `card-accent` / `card-fill` / `card-outlined` 四类**不能混用**(禁止"蓝底+蓝描边"、"灰底+描边"等)
8. **多卡并列时统一样式**——3-12 张卡用同一类(优先 `card-fill` 灰底);只突出一项时单独换 `card-accent`,且**只允许一张**
9. **直角到底**——任何 `border-radius` 都不允许;装饰用 8×8 直角小方块,**不要** 9px 圆形点
10. **图标用 lucide,不自己画 SVG**——`<i data-lucide="name"></i>` + `lucide.createIcons()`,选棱角风格(避免圆胖)
11. **时间线对齐**——axis 列固定 12px + dot 绝对定位,**不要**用 grid `justify-self`(会与虚线错位)
12. **章节级标题与内容间距 ≥ 9vh**——避免拥挤(吸取 P15/P16 教训)
13. **每页一个语义化动效 recipe**——不是统一 fade-up,数字 scale 弹入、bar scaleY 拉起、SVG stroke 描线、节点序列点亮等;**禁止**所有页用同一个 generic 配方
14. **playSlide 入口 reveal 容器**——`[data-anim]` 容器先强制 opacity:1,recipe 内再用 motion `{opacity:[0,1]}` 覆盖,否则有些页会"看不见"
15. **ESC 索引页可见性**——cloned slide 必须有 CSS override 让 `[data-anim]` 在缩略图里 opacity:1
16. **Helvetica/Inter 兜底中文字体**——Windows 用户没有"苹方",必须 fallback 到 `"Microsoft YaHei UI", "Noto Sans SC"`
17. **字体粗细体例**:大字 200 / 正文 300 / `t-cat` SemiBold 600 / `t-meta` mono uppercase
18. **保留低功耗快捷键**——右下角必须提示 `B 静态`;按 `B` 切换 `body.low-power`,停止 WebGL/ASCII canvas RAF 和 Motion 入场动画
19. **装饰元素严格在 grid 内**——bars 矩阵、点阵、ring-mat 不能贴边或溢出页面
20. **底部内容预留 nav 空间**——nav 在 ~97vh,内容收尾不要过 93vh(吸取 P22 KPI 大字溢底教训)
21. **图片容器直角无阴影**——`.frame-img` 不加 `border-radius` / `box-shadow`;边界只用 hairline
22. **S15/S16/S22 图片同组一致**——同一组图片统一比例、高度、边距、线条粗细;信息图/UI 图加 `.fit-contain`
23. **组件角色要正确**——S15/S16 图片格需要 caption 信息锚点;S22 的 KPI/说明是必选;数据专用版式必须有真实数据,不能靠文案硬填
24. **通用/非通用版式要分清**——S03/S08/S11/S19 较通用;S06/S07/S20/S21/S22 是数据/案例专用;S14/S15/S17 是结构专用

### Step 5 · 本地预览

直接在浏览器打开 `index.html` 就行。macOS 下：

```bash
open "项目/XXX/ppt/index.html"
```

不需要本地服务器。图片走相对路径 `images/xxx.png`。

预览时不能只看普通页面。按 `P` 进入演讲者模式,允许浏览器打开观众窗口,至少实测一次:前后翻页、内嵌宫格选页并返回预览、首页/尾页、尾页重新开始、计时开始/暂停/重置、排练记录、自动翻页暂停/恢复、激光笔、圈选、黑白屏、冻结、设置组件、演前检查、备注保存、关闭观众窗口后的状态变化,以及“重新打开观众屏”能否恢复到当前页。

### Step 6 · 迭代

根据用户反馈修改——模板的 CSS 已经高度参数化，90% 的调整都是改 inline style（字号 `font-size:Xvw` / 高度 `height:Yvh` / 间距 `gap:Zvh`）。

---

## 资源文件导览

```
guizang-ppt-skill/
├── SKILL.md                  ← 你正在读
├── assets/
│   ├── template.html         ← 风格 A · 电子杂志风模板（种子文件）
│   ├── template-swiss.html   ← 风格 B · 瑞士国际主义风模板（种子文件）
│   ├── screenshot-backgrounds/ ← 截图美化内置背景(WebP):style-a 5 套 / style-b 4 套
│   └── motion.min.js         ← Motion One 本地副本（离线兜底,约 64KB,共用）
├── scripts/
│   ├── validate-swiss-deck.mjs ← 风格 B 静态校验:登记版式、图片槽位、SVG 文本、标题对齐
│   └── validate-presenter-mode.mjs ← 两种风格共用:页面 ID、演讲备注、时长和演讲者运行时校验
└── references/
    ├── components.md         ← 组件手册（字体、色、网格、图标、callout、stat、pipeline、动效... 风格 A 适用）
    ├── layouts.md            ← 风格 A · 10 种页面布局骨架（可直接粘贴,含动效标记）
    ├── swiss-layout-lock.md  ← 风格 B · 原始 22P 版式锁,正文页必须按这里登记
    ├── layouts-swiss.md      ← 风格 B · 原始 22P 骨架说明 + 少量明确标注的实验区
    ├── swiss-map-component.md ← 风格 B · S08 地图扩展组件(MapLibre 点位/连线/卡片/控制)
    ├── themes.md             ← 风格 A · 5 套主题色预设（只能选不能自定义）
    ├── themes-swiss.md       ← 风格 B · 4 套瑞士风主题色预设（IKB / 柠檬黄 / 柠檬绿 / 安全橙）
    ├── image-prompts.md      ← GPT-M 2.0 配图类型、比例和基础提示词
    ├── screenshot-framing.md ← CleanShot X 式截图适配语义 + 内置背景资产映射
    ├── presenter-mode.md     ← 演讲者 UI、AI 备注结构、观众屏同步与恢复契约
    └── checklist.md          ← 质量检查清单（P0/P1/P2/P3 分级）
```

**加载顺序建议**：
1. 先读完 `SKILL.md`(这个文件)了解整体
2. Step 1 需求澄清**第一问**先确定风格 A 还是 B,然后:
   - 风格 A:读 `themes.md` 帮用户选一套主题色
   - 风格 B:读 `themes-swiss.md` 帮用户选一套主题色
3. **动手前 Read 对应模板的 `<style>` 块**——这是类名的唯一来源,缺类会导致整页样式崩
   - 风格 A → `assets/template.html`
   - 风格 B → `assets/template-swiss.html`
4. 读对应的 layouts 文件挑布局:
   - 风格 A → `layouts.md`(顶部有 Pre-flight 类名清单、主题节奏规划、动效 recipe 决策树)
   - 风格 B → **先读 `swiss-layout-lock.md`**,再读 `layouts-swiss.md`;正文页必须从 S01-S22 选择,每页写 `data-layout`
5. 如果风格 B 需要地点、路线、人物住所或城市关系地图,读 `swiss-map-component.md`
6. 如果在 Codex 中生成配图,读 `image-prompts.md` 挑图片类型、比例和基础提示词;如果是用户原始截图,先读 `screenshot-framing.md`,优先使用 `assets/screenshot-backgrounds/` 的内置背景资产
7. 细节调整时读 `components.md` 查组件(含 Motion 动效系统章节,主要服务风格 A;风格 B 的组件细节在 `layouts-swiss.md` 附录)
8. 正式演讲先读 `presenter-mode.md`,生成稳定页面 ID 和 `SPEAKER_NOTES`
9. 生成后先运行 `validate-presenter-mode.mjs`;风格 B 再运行 `validate-swiss-deck.mjs`,最后读 `checklist.md` 自检

**动效相关**:模板已把 Motion One 的加载和 recipe 逻辑内嵌到底部 module script。你不需要改 JS,只需要按 `layouts.md` / `layouts-swiss.md` 的骨架在 HTML 里加 `data-anim` / `data-animate` 即可。离线演示靠 `assets/motion.min.js`,断网时自动降级为"无动画但内容可读"。风格 B 模板必须保留 `B` 键低功耗模式:切换后停止 WebGL/ASCII canvas RAF,取消正在运行的 Web Animations,并把当前页内容直接 reveal 到静态最终态。

## 核心设计原则（哲学）

### 风格 A · 电子杂志风（5 轮迭代总结）

> 违反其中任何一条，杂志感都会垮。

1. **克制优于炫技** — WebGL 背景只在 hero 页透出，普通页几乎看不见
2. **结构优于装饰** — 不用阴影、不用浮动卡片、不用 padding box，一切信息靠**大字号 + 字体对比 + 网格留白**
3. **内容层级由字号和字体共同定义** — 最大衬线 = 主标题，中衬线 = 副标，大非衬线 = lead，小非衬线 = body，等宽 = 元数据
4. **图片是第一公民** — 图片只裁底部，保证顶部和左右完整；网格用 `height:Nvh` 固定，不要用 `aspect-ratio` 撑
5. **节奏靠 hero 页** — hero 和 non-hero 交替，才不累眼睛
6. **术语统一** — Skills 就是 Skills，不要中英混合翻译

### 风格 B · 瑞士国际主义风

> 违反其中任何一条，画面瞬间从瑞士掉到 PowerPoint。

1. **单一锚点色** — 一份 deck 只用一个 accent，不允许多色高亮拼贴
2. **极致字号对比** — 主标题与正文比例 ≥ 8:1,KPI 必须是"Data Hero"(屏幕宽度的 18-22%)
3. **无衬线只此一家** — Inter / Helvetica / Noto Sans SC,任何衬线都是错的
4. **直角纯色** — 不允许渐变 / 阴影 / 圆角(rule 横线除外)
5. **网格至上** — 所有元素吸附到 12-col grid,左对齐 + 大幅留白做非对称美学
6. **Hairline 是手术刀** — 1px 的极细分割线就够,不要加粗、不要加阴影
7. **点阵装饰只在 hero 页透出** — 正文页保持纯净底色

## 参考作品

本 skill 的两种风格分别参考了：

**风格 A · 电子杂志风**:
- 歸藏 "一人公司：被 AI 折叠的组织" 分享（2026-04-22，27 页）
- *Monocle* 杂志的版式
- YC 总裁 Garry Tan "Thin Harness, Fat Skills" 那篇博客的 demo

**风格 B · 瑞士国际主义风**:
- Massimo Vignelli 的 NYC Subway / Unimark 系统
- *Helvetica Forever* 的字体设计语言
- Josef Müller-Brockmann 的网格系统经典著作
- 当代设计:Acne Studios / Off-White / IKEA / Beck Design

可以把它们当做风格锚点。
