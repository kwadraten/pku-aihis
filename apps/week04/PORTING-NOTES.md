> 历史移植记录，以下seed.json重放及ready-empty设计已经撤除。当前唯一实现见README与docs/week04/native-subset.md。

# 第四周 Stencil 移植说明（工程骨架与数据层）

2026-10-06。本文件记录把 Vite 移植实验改造为 Stencil 课件工程骨架的过程，供后续幻灯片任务接续。
约束遵守：未改 `apps/week03/`、仓库根、`core-probe/`、`native-probe/`、`vendor/`、`docs/`；未提交 git。

## 文件树变化

新增/重写：

- `package.json`：移除 `vite`、`tesseract.js` 及 `dev/preview/prepare:assets/test:native` 脚本；加入 `@stencil/core 4.45.0`、`typescript 5.9.3`（保留 `@sqlite.org/sqlite-wasm`、`fflate`、`@noble/hashes`、`@citation-js/core`、`@citation-js/plugin-bibtex`、`pdfjs-dist`、`pdf-lib`、`playwright`）。脚本对齐 week03：`start`/`build`（前置 `copy-vendor` + `gen:migrations`）、`check`（tsc --noEmit）、`test`（node --test tests/*.test.mjs）；保留 `prepare:patchouli`、`build:core`；新增 `gen:migrations`、`prepare:core`。
- `pnpm-workspace.yaml`（仿 week03，单包工作区）、`stencil.config.ts`（namespace `week04`、baseUrl `/pku-aihis/week04/`、devServer 3334、serviceWorker null、copy assets/bootstrap/coi）、`tsconfig.json`（照搬 week03）。
- `scripts/copy-vendor.mjs`：把 `sqlite3.wasm`、`pdf.worker.min.mjs` 拷入 `src/assets/vendor/`，pdfjs LICENSE 与 sqlite-wasm 说明拷入 `src/assets/licenses/`。
- `scripts/gen-migrations.mjs`：读 `vendor/patchouli/.../migrations/*.sql`（41 个，按文件名排序）生成 `src/lib/migrations.generated.ts`（`MIGRATIONS` + `PATCHOULI_MANIFEST`）。
- `scripts/prepare-core.mjs`：`core-probe/publish/wwwroot` → `src/assets/core/`（滤 .br/.gz），`vendor/patchouli` 的 LICENSE 与 manifest.json → `src/assets/licenses/`。
- `src/index.html`：Stencil 外壳（#app + template#deck-template + deck-container），3 个占位 deck-slide（D00/D01/D02，含 header-title/kicker/notes/theme），后续任务重写全部 31 页。
- `src/components/`：`deck-container`（适配）、`deck-slide`、`deck-presenter`（适配）、`layout-split`（后两者 CSS 照搬 week03）。
- `src/lib/`：`library.ts`、`pdf.ts`、`storage.ts`、`bibliography.ts`、`styles.ts`、`core-bridge.ts`、`live-library.ts`（新）、`migrations.generated.ts`（生成物，gitignored）。
- `tests/migrations.test.mjs`：校验生成物覆盖全部 41 条迁移与 manifest。
- `src/components.d.ts`：Stencil 生成物，按任务要求保留。

删除（旧 Vite 入口，均已移植）：根 `index.html`、`vite.config.mjs`、`src/{main,style.css,pdf-ocr,bibliography,library,storage,styles}.js`（含 `src/styles.js`）、`scripts/prepare-assets.mjs`、生成的 `public/`（core/ocr）与 `dist/`。

暂保留待后续任务处理：`tests/browser.mjs`（旧 Vite 流程的 Playwright 验证，依赖已不存在的 `window.lab` 与 8768 端口）、`scripts/serve-static.mjs`、`scripts/clean-generated.mjs`、`scripts/write-verification-summary.mjs`（引用已删除的 `public/ocr/models.json`）。`README.md` 暂不动。

## 逐文件适配点

- `library.ts` ← `src/library.js`：
  - `import.meta.glob('.../migrations/*.sql')` → `import { MIGRATIONS } from './migrations.generated'`；manifest glob → 生成物中的 `PATCHOULI_MANIFEST`（`backup()` 的来源字段保持原语义）。
  - `sqlite3.wasm?url` → `new URL('assets/vendor/sqlite3.wasm', document.baseURI).href`（经 `locateFile`）。
  - `startOcr` 的 `engine_id` 由 `tesseract-wasm` 改为 `browser-ocr`、预设名改「浏览器 OCR」（schema 无 CHECK 约束；OCR 实现本身由后续任务以 `src/lib/ocr.ts` 提供，接口：页图像数据进、行级 `{text, bbox, confidence}[]` 出、支持 AbortSignal）。其余 API（importPdf/commitPages/search/fetch/backup/restore/reindex/tags/collections/csl/merge/trash 等）原样保留。
  - TS 化时仅加宽松类型；上游类型缺口处用 `as any` 并注明（sqlite3InitModule 的 locateFile、citation-js 的 `get`、pdfjs 的 `isEvalSupported`）。
- `pdf.ts` ← `src/pdf-ocr.js` 的 PDF 部分（openPdf/inspectPdf/renderPdf/extractText）：worker 地址改为 `assets/vendor/pdf.worker.min.mjs`；`ocrPages`（tesseract）删除，注释标明后续 `ocr.ts` 契约。
- `storage.ts` / `bibliography.ts` / `styles.ts`：直搬，仅类型化。
- `core-bridge.ts` ← `main.js` 的 `bootCore()`：隐藏 iframe 指向 `assets/core/index.html`，轮询 `coreReady`，挂 `window.DotNet`；导出 `bootCore(): Promise<void>` 与 `isCoreReady()`；超时提示改为 `pnpm build:core` + `pnpm prepare:core`。
- `live-library.ts`（新）：共享单例。状态机 `idle→booting→seeding→ready / ready-empty / error`；boot = Blazor 核心 + SQLite + 41 迁移（含 `navigator.locks` 单写者锁与旧版一致）；seed 严格按契约真实调用 Library。listener 模式订阅（`subscribe(listener)` 返回取消函数），`exportSqlite()` 返回整库 `Uint8Array`。seed 适配（依据 `src/assets/seed/seed.json` 头部说明，导出任务已定稿）：
  - `items[].csl` 可缺省：缺失时用 `@citation-js` 解析 `biblatex` 原文转 CSL-JSON，再 `importCsl`（即"按 CSL 建题录"的路径；`createItem` 本身只接受题名+扩展列，不适用）。
  - tags 与集合：合并 `csl.keyword` 与 `tags[]` 写回 `tags_json`（触发器同步成员表）；集合按名 find-or-create 后 `setCollection`。
  - `pdf` 非空：fetch 真实字节 → `File` → `inspectPdf` → `importPdf`（BLAKE3 去重由库抛错，不静默）。
  - 无 PDF 的文档：建 `instance_type='transcript'`、`file_asset_id=null` 的文档实例 + 页行，不伪造文件。
  - 每页 markdown 以整页 bbox 的 `payloadJson={markdown}` 经 `commitPages`（CoreProbe `ValidateTree` 校验）提交，`reindex` 随之建立 FTS。
  - `documents[].page_index` 为 1 -based（与 patchouli 页资源一致），落库前减 1。
  - `seed.json` 404 → `ready-empty`，UI 显示「种子数据未生成：请先运行 pnpm seed」；任何一步失败 → `error` 状态显示真实信息，不造假数据。
- `deck-container.tsx`：去 week03 语料库管理；顶栏加书库状态指示（订阅 live-library）、保留「模型接入」（派发 `open-model-settings`）、新增「导出 SQLite」（派发 `export-sqlite`，下载逻辑后续任务接，当前仅事件就位）；频道名 `pku-aihis-week04-20261006`；presenter 窗口名 `week04-presenter`；标题「第四周 · 文献管理器实验室」；移除 week03 的 D16–D20 别名表；`componentDidLoad` 触发 `liveLibrary.boot()`。`model-connection` 组件按要求未建（后续任务）。
- `deck-presenter.tsx`：`pages.json` 尚不存在时退化为频道同步（fetch 失败/404 → 空表，翻页按钮禁用）；其余 week03→week04 字样适配。
- `bootstrap.js`：sessionStorage key 与 presenter 逻辑改 `week04`；`coi-serviceworker.js`、`global/app.css` 照搬。

## 构建与验证结果（本机实测）

- `pnpm install --ignore-scripts`：通过（旧锁文件含 vite 传递依赖被供应链策略拒绝，已重解析生成新 `pnpm-lock.yaml`，策略不再触发）。
- `node scripts/gen-migrations.mjs`：通过，41 条迁移 + manifest 嵌入。
- `pnpm check`（tsc --noEmit）：0 错误。
- `pnpm test`：1/1 通过（生成物覆盖 41 条迁移）。
- `pnpm build`：通过（约 25s；copy 236 文件含 core 资产；产物 `www/pku-aihis/week04/`，index.html 引用 build/week04.css、build/week04.esm.js）。`src/components.d.ts` 已生成保留。
- `pnpm start`：dev server 起于 `http://localhost:3334/pku-aihis/week04/`；`/`、`/build/week04.esm.js`、`/build/week04.css`、`/bootstrap.js`、`/assets/vendor/sqlite3.wasm`、`/assets/vendor/pdf.worker.min.mjs`、`/assets/core/index.html`、`/assets/licenses/patchouli-manifest.json` 全部 HTTP 200，随后关闭。
- 浏览器冒烟（Playwright/Edge，一次性脚本 `artifacts/smoke.mjs`，已 gitignore）：页面 3 张占位 slide 渲染；书库走通 核心→SQLite→41 迁移→种子 真实链路，状态「书库就绪 · 4 条题录已载入」（种子文件由导出任务并行产出）；无 pageerror。种子缺失路径在开发期曾实测进入 `ready-empty` 并显示「请先运行 pnpm seed」（修复页序换算前）。

## 遗留问题（交后续任务）

1. `tests/browser.mjs` 与 `scripts/serve-static.mjs`、`write-verification-summary.mjs` 仍是旧 Vite 流程写法，需随幻灯片任务重写（`window.lab`、8768 端口、`public/ocr/models.json` 均已不存在）。
2. OCR（`src/lib/ocr.ts`）、model-connection 组件、导出 SQLite 的下载逻辑、31 页幻灯片内容均未做（本任务范围外）。
3. seed 的 PDF 路径（importPdf + BLAKE3 去重）本轮未被真实种子触发（4 条题录 `pdf` 均为 null，原因已在 seed.json 注明：oversize/duplicate）；待导出任务补充 PDF 后需实跑一轮。
4. Stencil dev server 对 `/assets/seed/seed.json` 返回 200（文件存在）；不存在时为 404 → ready-empty，路径已验证。
5. 顶栏书库状态在 presenter 窗口不显示（presenter 无 deck-container，符合设计）。
