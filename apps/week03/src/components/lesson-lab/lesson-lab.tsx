import { Component, h, Prop, State, Listen } from "@stencil/core";
import {
  state,
  loadCorpus,
  replaceCorpus,
  sourceLabel,
  saveFile,
  Doc,
} from "../../lib/store";
import {
  bm25,
  tokenize,
  count,
  cosine,
  rankVectors,
  rrf,
  metrics,
  chunks,
  rocchio,
} from "../../lib/math";
import { fulltext, vectorSearch, embed } from "../../lib/engines";
@Component({ tag: "lesson-lab", shadow: false })
export class LessonLab {
  private epoch = 0;
  @State() lastSearch: any = null;
  @Prop() demoId: string;
  @State() ready = false;
  @State() selected = 0;
  @State() query = "宗教";
  @State() text = "";
  @State() output: any = null;
  @State() results: any[] = [];
  @State() busy = false;
  @State() message = "";
  @State() phase = 0;
  @State() k1 = 1.2;
  @State() b = 0.75;
  @State() size = 180;
  @State() overlap = 30;
  @State() tokMode = "bigram";
  @State() c = 60;
  @State() qrels: any = {};
  @State() normalized = "";
  @State() config = "NFKC";
  @State() replacement = "$1";
  @State() savedQuery = 0;
  @State() tool: any = null;
  @State() logs: any[] = [];
  @State() bridge = "http://127.0.0.1:8767";
  @State() answer = "";
  @State() contextIds: string[] = [];
  @State() author = "all";
  @State() feedback: string[] = [];
  @State() images: any = null;
  @State() imageIndex = 0;
  @State() presetIndex = 0;
  @State() stages: any[] = [];
  async componentWillLoad() {
    try {
      await loadCorpus();
      this.text = state.docs[0]?.text || "";
      if (
        [
          "D14",
          "D15",
          "D16",
          "D17",
          "D18",
          "D19",
          "D20",
          "D23",
          "D25",
          "D26",
          "D27",
        ].includes(this.demoId)
      ) {
        const tools = await (await fetch("assets/data/tools.json")).json();
        this.tool = tools[this.demoId];
      }
      if (["D30", "D31", "D32"].includes(this.demoId))
        this.images = await (await fetch("assets/data/multimodal.json")).json();
      if (this.demoId === "D22")
        this.output = await (await fetch("assets/data/citations.json")).json();
      this.ready = true;
    } catch (e) {
      this.message = String(e);
    }
  }
  @Listen("corpus-change", { target: "window" }) reset() {
    this.epoch++;
    this.busy = false;
    this.selected = 0;
    this.lastSearch = null;
    this.text = state.docs[0]?.text || "";
    this.results = [];
    this.output = null;
    this.contextIds = [];
    this.logs = [];
    this.qrels = {};
    this.feedback = [];
    this.phase = 0;
    this.answer = "";
    this.normalized = "";
    this.message = `已切换语料：${state.docs.length}条。本机导入内容不上传。`;
  }
  private doc() {
    return state.docs[this.selected] || state.docs[0];
  }
  private select(d: Doc) {
    this.selected = state.docs.indexOf(d);
    this.text = d.text;
    this.normalized = "";
  }
  private invalidateFlow() {
    this.results = [];
    this.output = null;
    this.qrels = {};
    this.feedback = [];
    this.lastSearch = null;
    this.epoch++;
    this.busy = false;
    if (["D13", "D24"].includes(this.demoId)) {
      this.phase = 0;
      this.answer = "";
      this.output = null;
      this.logs = [];
      this.results = [];
      this.contextIds = [];
    }
  }
  private async run(fn: () => Promise<any>) {
    if (this.busy) return;
    const epoch = this.epoch;
    this.busy = true;
    this.message = "";
    try {
      await fn();
    } catch (e) {
      if (epoch !== this.epoch) return;
      this.message = String(e);
      if (["D13", "D24"].includes(this.demoId))
        this.logs = [...this.logs, { event: "failed", error: String(e) }];
    } finally {
      if (epoch === this.epoch) this.busy = false;
    }
  }
  private chooser() {
    return (
      <select
        aria-label="选择史料片段"
        ref={(el) => {
          if (el) el.value = String(this.doc()?.id);
        }}
        onChange={(e: any) =>
          this.select(state.docs.find((d) => d.id === e.target.value))
        }
      >
        {state.docs.map((d) => (
          <option value={d.id}>
            {d.id} · {d.title} · PDF{d.pdf_page}
          </option>
        ))}
      </select>
    );
  }
  private source(d = this.doc()) {
    return (
      d && (
        <div class="panel">
          <div class="source-line">{sourceLabel(d)}</div>
          <span class="mode">{d.status || "工作转录待核"}</span>
          {d.date_note && <p class="source-line">{d.date_note}</p>}
          <p class="paper-text">{d.text}</p>
          {d.image && (
            <details>
              <summary>查看原页节录</summary>
              <img
                class="page-image"
                src={d.image}
                alt={`${d.title} PDF第${d.pdf_page}页节录`}
              />
            </details>
          )}
          <details>
            <summary>出处与处理记录</summary>
            <pre>
              {JSON.stringify(
                {
                  ...d,
                  text: undefined,
                  vector: d.vector
                    ? `${d.vector.length}维，详见向量页`
                    : undefined,
                },
                null,
                2,
              )}
            </pre>
          </details>
        </div>
      )
    );
  }
  private list(hits = this.results) {
    return (
      <div>
        {!hits.length && (
          <p class="lab-note">尚无命中。可修改查询，空结果也保留。</p>
        )}
        {hits.slice(0, 12).map((r, i) => {
          const d = state.docs.find((d) => d.id === r.id);
          return (
            d && (
              <button
                class={"result " + (d === this.doc() ? "selected" : "")}
                onClick={() => this.select(d)}
              >
                <strong>
                  {i + 1}. {d.title}
                </strong>
                <span class="tag">{r.score?.toFixed(4)}</span>
                <div class="source-line">
                  {d.id} · PDF {d.pdf_page} · 原书 {d.printed_page ?? "待核"}
                </div>
                <p>{d.text.slice(0, 125)}…</p>
              </button>
            )
          );
        })}
      </div>
    );
  }
  private async importFile(file: File) {
    if (!file) return;
    await this.run(async () => {
      if (file.size > 130 * 1024 * 1024)
        throw Error("当前课堂入口限制130MB；请按卷分包。");
      const txt = await file.text();
      let data;
      try {
        data = JSON.parse(txt);
      } catch {
        data = {
          records: txt
            .split(/\r?\n/)
            .filter(Boolean)
            .map((s) => JSON.parse(s)),
        };
      }
      replaceCorpus(data);
    });
  }
  private async normalize() {
    await this.run(async () => {
      if (this.config === "NFC" || this.config === "NFKC")
        this.normalized = this.text.normalize(this.config as any);
      else {
        const mod = await import(
          new URL("assets/vendor/opencc-js/dist/esm/full.js", document.baseURI)
            .href
        );
        const convert = mod.Converter({
          from: this.config === "s2t" ? "cn" : "tw",
          to: this.config === "s2t" ? "tw" : "cn",
        });
        this.normalized = convert(this.text);
      }
      this.output = {
        rule: this.config,
        before: [...this.text].length,
        after: [...this.normalized].length,
        offset_mapping: "未生成逐字映射；仅保留原片段与页定位。",
      };
    });
  }
  private async regex() {
    await this.run(async () => {
      const worker = new Worker(
        new URL("assets/regex-worker.js", document.baseURI),
      );
      this.output = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          worker.terminate();
          reject(Error("正则运行超过1秒，已中止。请缩短输入或简化模式。"));
        }, 1000);
        worker.onmessage = (e) => {
          clearTimeout(timer);
          worker.terminate();
          e.data.error ? reject(Error(e.data.error)) : resolve(e.data);
        };
        worker.postMessage({
          text: this.text.slice(0, 20000),
          pattern: this.query,
          replacement: this.replacement,
        });
      });
    });
  }
  private async qvector() {
    const q = state.queries.find((x) => x.text === this.query);
    if (q?.vector) return q.vector;
    return await embed(this.query, (s) => (this.message = s));
  }
  private search(kind = "bm25") {
    return this.run(async () => {
      const epoch = this.epoch,
        version = state.version,
        docs = state.docs;
      let results = [],
        output;
      const start = performance.now();
      if (kind === "lucivy") results = await fulltext(this.query, false);
      else if (kind === "lucivy-regex")
        results = await fulltext(this.query, true);
      else if (kind === "edgevec")
        results = await vectorSearch(await this.qvector());
      else if (kind === "vector")
        results = rankVectors(docs, await this.qvector());
      else if (kind === "rrf") {
        const a = bm25(docs, this.query),
          b = rankVectors(docs, await this.qvector());
        results = rrf([a, b], this.c);
        output = {
          bm25: a.slice(0, 6),
          vector: b.slice(0, 6),
          fusion: results.slice(0, 6),
          reranker: "未运行模型重排",
        };
      } else
        results = bm25(
          docs.filter(
            (d) =>
              this.author === "all" || d.source_id?.startsWith(this.author),
          ),
          this.query,
          { k1: this.k1, b: this.b, mode: this.tokMode },
        );
      if (epoch !== this.epoch || version !== state.version) return;
      this.results = results;
      this.lastSearch = { query: this.query, scope: this.author, version };
      if (output) this.output = output;
      this.message = `${kind} 已完成 · ${(performance.now() - start).toFixed(0)} ms · ${results.length} 条候选`;
      if (results[0]) this.select(docs.find((d) => d.id === results[0].id));
    });
  }
  private querybar(buttons: any) {
    return (
      <div class="lab-toolbar">
        <input
          type="text"
          aria-label="检索问题"
          disabled={this.busy}
          value={this.query}
          onInput={(e: any) => {
            this.query = e.target.value;
            this.invalidateFlow();
          }}
        />
        {buttons}
      </div>
    );
  }
  private preset() {
    return (
      <select
        aria-label="已预计算的查询"
        disabled={this.busy}
        ref={(el) => {
          if (el) el.value = String(this.query);
        }}
        onChange={(e: any) => {
          this.query = e.target.value;
          this.invalidateFlow();
        }}
      >
        <option value="">选择已预计算查询</option>
        {state.queries.map((q) => (
          <option value={q.text}>{q.text}</option>
        ))}
      </select>
    );
  }
  private async flowStep() {
    const epoch = this.epoch,
      version = state.version;
    await this.run(async () => {
      if (this.phase === 0) {
        this.results = bm25(state.docs, this.query);
        this.contextIds = this.results.slice(0, 3).map((x) => x.id);
        this.logs = [
          {
            event: "retrieved",
            query: this.query,
            ids: this.results.map((x) => x.id),
          },
        ];
        this.phase = 1;
      } else if (this.phase === 1) {
        if (!this.contextIds.length) throw Error("请先选择至少一条上下文");
        this.logs = [
          ...this.logs,
          { event: "context_selected", ids: this.contextIds },
        ];
        this.phase = 2;
      } else if (this.phase === 2) {
        this.output = {
          messages: [
            {
              role: "system",
              content:
                "只根据给定材料回答。逐项引用片段ID。材料不足时说明缺口，不根据常识补写史实。",
            },
            {
              role: "user",
              content:
                this.query +
                "\n\n" +
                this.contextIds
                  .map((id) => {
                    const d = state.docs.find((d) => d.id === id);
                    return `[${id}] ${sourceLabel(d)}\n${d.text}`;
                  })
                  .join("\n\n"),
            },
          ],
        };
        this.phase = 3;
      } else {
        if (!this.output?.messages) throw Error("请先构建本轮生成请求");
        const r = await fetch(this.bridge + "/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(this.output),
          signal: AbortSignal.timeout(120000),
        });
        if (!r.ok) throw Error(await r.text());
        const d = await r.json();
        if (epoch !== this.epoch || version !== state.version) return;
        this.answer = d.text;
        this.logs = [
          ...this.logs,
          {
            event: "generated",
            model: d.model,
            request_id: d.request_id,
            text: d.text,
          },
        ];
        this.phase = 4;
      }
    });
  }
  private async agent() {
    const epoch = this.epoch,
      version = state.version,
      docs = state.docs,
      query = this.query;
    await this.run(async () => {
      const runId = crypto.randomUUID();
      let observations = [];
      this.logs = [];
      this.answer = "";
      this.output = { query: query, maximum_turns: 4 };
      for (let turn = 0; turn < 4; turn++) {
        const payload = {
          query: query,
          observations,
          allowed_tools: ["search", "read", "finish"],
          instruction:
            "选择下一步工具。search需要query；read需要id；finish需要answer并引用已经读到的ID。",
        };
        const r = await fetch(this.bridge + "/api/agent-step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(120000),
        });
        if (!r.ok) throw Error(await r.text());
        const { action, model } = await r.json();
        if (epoch !== this.epoch || version !== state.version) return;
        this.logs = [
          ...this.logs,
          { runId, turn, event: "model_proposal", model, action },
        ];
        if (!["search", "read", "finish"].includes(action.tool))
          throw Error("模型给出未获准工具，执行器已拒绝。");
        if (action.tool === "finish") {
          const readIds = observations
            .filter((o) => o.action.tool === "read")
            .map((o) => o.result.id);
          if (!readIds.length) throw Error("模型尚未读取证据，不能完成回答");
          this.answer = String(action.answer || "");
          this.logs = [...this.logs, { runId, turn, event: "stopped" }];
          return;
        }
        let result;
        if (action.tool === "search") {
          if (typeof action.query !== "string") throw Error("缺少query");
          result = bm25(docs, action.query)
            .slice(0, 5)
            .map((x) => ({
              id: x.id,
              score: x.score,
              title: docs.find((d) => d.id === x.id)?.title,
            }));
        } else {
          const d = docs.find((d) => d.id === action.id);
          if (!d) throw Error("read的ID不存在");
          if (
            !observations.some(
              (o) =>
                o.action.tool === "search" &&
                o.result.some((x) => x.id === d.id),
            )
          )
            throw Error("read的ID尚未被检索发现");
          result = { id: d.id, text: d.text, source: sourceLabel(d) };
        }
        observations.push({ action, result });
        this.logs = [
          ...this.logs,
          { runId, turn, event: "tool_result", tool: action.tool, result },
        ];
      }
      this.logs = [
        ...this.logs,
        { runId, event: "budget_exhausted", maximum_turns: 4 },
      ];
      this.message = "达到4轮预算，已停止；不把未完成工作写成答案。";
    });
  }
  private async toolRun() {
    await this.run(async () => {
      const r = await fetch(this.bridge + "/api/tool/" + this.tool.slug, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: this.query }),
        signal: AbortSignal.timeout(60000),
      });
      if (!r.ok) throw Error(await r.text());
      this.output = await r.json();
    });
  }
  private foundation() {
    const id = this.demoId,
      d = this.doc();
    if (id === "D01")
      return (
        <div class="lab-grid">
          <section class="lab-column">
            <h2>原页与转录并存</h2>
            {this.chooser()}
            {d?.image ? (
              <img class="page-image" src={d.image} alt="史料原页节录" />
            ) : (
              <p class="lab-note">
                本条保留PDF页序；完整原页在教师本地文件中。
              </p>
            )}
            <div class="panel">
              <h3>导入整卷语料</h3>
              <input
                type="file"
                accept=".json,.jsonl"
                onChange={(e: any) => this.importFile(e.target.files[0])}
              />
              <p class="lab-note">
                当前 {state.docs.length} 条 ·{" "}
                {state.local ? "本机导入" : "公开课堂节录"}
                。导入内容在本浏览器内处理。
              </p>
            </div>
          </section>
          <section class="lab-column">
            {this.source()}
            <p class="lab-note">
              正文、编注、转引分别记录；PDF页序不等于原书页码。
            </p>
          </section>
        </div>
      );
    if (id === "D02")
      return (
        <div class="lab-grid">
          <section class="lab-column">
            {this.chooser()}
            <textarea
              aria-label="待规范化原文"
              rows={8}
              value={this.text}
              onInput={(e: any) => (this.text = e.target.value)}
            />
            <div class="lab-toolbar">
              <select
                aria-label="规范化规则"
                ref={(el) => {
                  if (el) el.value = String(this.config);
                }}
                onChange={(e: any) => (this.config = e.target.value)}
              >
                {["NFC", "NFKC", "s2t", "t2s"].map((x) => (
                  <option>{x}</option>
                ))}
              </select>
              <button onClick={() => this.normalize()}>处理副本 →</button>
            </div>
            <p class="lab-note">
              s2t/t2s分别使用OpenCC-js cn→tw/tw→cn。不是日文旧字体通用转换。
            </p>
          </section>
          <section class="lab-column">
            <h2>处理后的检索字段</h2>
            <p class="paper-text">{this.normalized || "选择规则后运行。"}</p>
            {this.output && <pre>{JSON.stringify(this.output, null, 2)}</pre>}
            <p class="lab-note">
              原记录保持不变。没有跨度映射时，只返回片段和页，不能沿用旧字符偏移高亮。
            </p>
          </section>
        </div>
      );
    if (id === "D03") {
      const toks = tokenize(this.text, this.tokMode),
        pieces = chunks(
          this.text,
          this.size,
          Math.min(this.overlap, this.size - 1),
        );
      return (
        <div class="lab-grid">
          <section class="lab-column">
            {this.chooser()}
            <div class="controls">
              <label>
                词项划分{" "}
                <select
                  ref={(el) => {
                    if (el) el.value = String(this.tokMode);
                  }}
                  onChange={(e: any) => (this.tokMode = e.target.value)}
                >
                  <option value="char">单字</option>
                  <option value="bigram">连续双字</option>
                  <option value="word">Intl词切分</option>
                </select>
              </label>
              <label>
                块长 {this.size}{" "}
                <input
                  type="range"
                  min="60"
                  max="300"
                  step="20"
                  value={this.size}
                  onInput={(e: any) => (this.size = +e.target.value)}
                />
              </label>
              <label>
                重叠 {this.overlap}{" "}
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="10"
                  value={this.overlap}
                  onInput={(e: any) => (this.overlap = +e.target.value)}
                />
              </label>
            </div>
            <p class="lab-note">
              这是检索词项划分，不是某个大模型tokenizer。停用词不能一概删除否定与称谓。
            </p>
            {toks.slice(0, 50).map((t) => (
              <span class="chip">{t}</span>
            ))}
          </section>
          <section class="lab-column">
            <h2>{pieces.length} 个块 · 保留同一来源</h2>
            {pieces.map((p) => (
              <div class="evidence-card">
                <div class="source-line">
                  字符 {p.start}—{p.end} · PDF {d.pdf_page}
                </div>
                <p>{p.text}</p>
              </div>
            ))}
          </section>
        </div>
      );
    }
    if (id === "D04") {
      const docs = [d, ...state.docs.filter((x) => x.id !== d.id).slice(0, 2)],
        bags = docs.map((x) => count(tokenize(x.text, "word"))),
        terms = Object.keys(bags[0]).slice(0, 14);
      return (
        <div class="lab-grid">
          <section class="lab-column">
            {this.chooser()}
            <p class="lab-note">
              one-hot：一个词占一个位置；词袋：按位置累加次数；TF-IDF：再乘集合中的区分权重。
            </p>
            <div class="panel">
              {terms.map((t, i) => (
                <button
                  class="chip"
                  onClick={() =>
                    (this.output = {
                      word: t,
                      one_hot: terms.map((_, j) => (j === i ? 1 : 0)),
                      counts: bags.map((x) => x[t] || 0),
                      idf:
                        Math.log(4 / (1 + bags.filter((x) => x[t]).length)) + 1,
                    })
                  }
                >
                  {t}
                </button>
              ))}
            </div>
            {this.output && <pre>{JSON.stringify(this.output, null, 2)}</pre>}
          </section>
          <section class="lab-column">
            <table>
              <thead>
                <tr>
                  <th>词项</th>
                  <th>D1次数</th>
                  <th>D2次数</th>
                  <th>D3次数</th>
                  <th>平滑IDF</th>
                </tr>
              </thead>
              <tbody>
                {terms.map((t) => (
                  <tr>
                    <td>{t}</td>
                    {bags.map((b) => (
                      <td>{b[t] || 0}</td>
                    ))}
                    <td>
                      {(
                        Math.log(4 / (1 + bags.filter((x) => x[t]).length)) + 1
                      ).toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p class="lab-note">
              N=3；idf=ln((1+N)/(1+df))+1。仅当前三条组成教学集合，不代表全卷统计。
            </p>
          </section>
        </div>
      );
    }
    if (id === "D05") {
      const tokens = tokenize(this.text, "word").slice(0, 16),
        center = Math.min(this.phase, tokens.length - 1),
        v = d.vector || [];
      return (
        <div class="lab-grid">
          <section class="lab-column">
            {this.chooser()}
            <h2>从预测任务到文本表示</h2>
            <div class="panel">
              {tokens.map((t, i) => (
                <button
                  class={"chip " + (i === center ? "selected" : "")}
                  onClick={() => (this.phase = i)}
                >
                  {t}
                </button>
              ))}
            </div>
            <p>
              CBOW：周围词 → <b>{tokens[center]}</b>
            </p>
            <p>
              Skip-gram：<b>{tokens[center]}</b> → 周围词
            </p>
            <p class="lab-note">
              点击词改变中心位置。这是训练任务的构造示意，未在本页训练Word2vec。负例来自噪声抽样，不是反义词或历史反证。
            </p>
            <div class="panel">
              <button
                onClick={() =>
                  (this.output = {
                    type: "SPLADE机制构造",
                    weights: { 宗教: 2.3, 佛教: 1.2, 神道: 0.4 },
                    note: "数字为教学构造；真实SPLADE权重须运行模型取得。",
                  })
                }
              >
                看神经稀疏表示
              </button>
              {this.output && <pre>{JSON.stringify(this.output, null, 2)}</pre>}
            </div>
          </section>
          <section class="lab-column">
            <h2>实际段落的稠密向量</h2>
            <span class="mode">
              {v.length
                ? `${state.local ? "导入向量（配置由文件声明）" : "真实模型离线预计算"} · ${v.length}维`
                : "本条尚无向量"}
            </span>
            <svg viewBox="0 0 500 190" role="img" aria-label="向量坐标值">
              <line x1="0" y1="95" x2="500" y2="95" stroke="#aaa" />
              {v.slice(0, 100).map((x, i) => (
                <line
                  x1={i * 5}
                  x2={i * 5}
                  y1="95"
                  y2={95 - x * 500}
                  stroke="#164ec7"
                  stroke-width="3"
                />
              ))}
            </svg>
            <pre>{JSON.stringify(state.manifest.embedding, null, 2)}</pre>
            <p class="lab-note">
              一维不对应一个固定历史概念；双塔可预计算文档，交叉编码器则逐对联合读取问题与候选。
            </p>
          </section>
        </div>
      );
    }
    return null;
  }
  private retrieval() {
    const id = this.demoId;
    if (id === "D06")
      return (
        <div class="lab-grid">
          <section class="lab-column">
            {this.chooser()}
            <textarea
              rows={7}
              value={this.text}
              aria-label="正则测试原文"
              onInput={(e: any) => (this.text = e.target.value)}
            />
            <div class="lab-toolbar">
              <input
                aria-label="正则表达式"
                value={this.query}
                onInput={(e: any) => (this.query = e.target.value)}
              />
              <button onClick={() => this.regex()}>匹配</button>
            </div>
            <div class="lab-toolbar">
              <label>
                替换为{" "}
                <input
                  aria-label="替换表达式"
                  value={this.replacement}
                  onInput={(e: any) => (this.replacement = e.target.value)}
                />
              </label>
            </div>
            <a
              class="help-link"
              href="https://lzltool.cn/regex"
              target="_blank"
              rel="noreferrer"
            >
              助教推荐：表达式结构可视化 ↗
            </a>
            <p class="lab-note">
              本页是JavaScript
              /gu引擎。先试“宗[教敎]”，再试“(宗[教敎]).&#123;0,12&#125;”。替换只生成预览。
            </p>
            <p class="lab-note">
              布尔与正则分工：AND/OR/NOT组合条件；正则描述字符结构。Rust
              regex不支持全部JS语法。
            </p>
          </section>
          <section class="lab-column">
            <h2>命中、捕获与替换预览</h2>
            {this.output ? (
              <pre>{JSON.stringify(this.output, null, 2)}</pre>
            ) : (
              <p>等待运行</p>
            )}
          </section>
        </div>
      );
    const modes =
      id === "D11"
        ? ["lucivy", "lucivy-regex"]
        : id === "D12"
          ? ["edgevec"]
          : id === "D09"
            ? ["rrf"]
            : id === "D08"
              ? ["vector", "edgevec"]
              : ["bm25"];
    return (
      <div class="lab">
        <div class="lab-toolbar">
          {["D08", "D09", "D12"].includes(id) && this.preset()}
          <span class="mode">
            {id === "D11"
              ? "Lucivy 4.3.0 · WASM"
              : id === "D12"
                ? "EdgeVec 0.9.0 · WASM"
                : id === "D09"
                  ? "RRF实时融合 · 模型重排未运行"
                  : "浏览器实时计算"}
          </span>
        </div>
        {this.querybar(
          modes.map((m) => (
            <button
              disabled={this.busy || !this.query}
              onClick={() => this.search(m)}
            >
              {
                {
                  bm25: "BM25排序",
                  vector: "精确余弦",
                  edgevec: "运行EdgeVec",
                  lucivy: "全文命中",
                  "lucivy-regex": "Rust正则",
                  rrf: "混合检索",
                }[m]
              }
            </button>
          )),
        )}
        <div class="lab-grid">
          <section class="lab-column">
            {id === "D07" && (
              <div class="controls">
                <label>
                  k1={this.k1}
                  <input
                    type="range"
                    min=".1"
                    max="3"
                    step=".1"
                    value={this.k1}
                    onInput={(e: any) => {
                      this.k1 = +e.target.value;
                      this.search();
                    }}
                  />
                </label>
                <label>
                  b={this.b}
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step=".05"
                    value={this.b}
                    onInput={(e: any) => {
                      this.b = +e.target.value;
                      this.search();
                    }}
                  />
                </label>
                <p class="lab-note">
                  教学BM25：Lucene
                  IDF＋含(k1+1)的教材词频项；不是Lucene原始分值逐位复现。默认连续双字词项。
                </p>
              </div>
            )}
            {id === "D09" && (
              <label>
                RRF c={this.c}
                <input
                  aria-label="RRF参数"
                  type="range"
                  min="1"
                  max="100"
                  value={this.c}
                  onInput={(e: any) => (this.c = +e.target.value)}
                />
              </label>
            )}
            {id === "D11" && (
              <p class="lab-note">
                跨源隔离：{String(crossOriginIsolated)}
                。首次建立本机索引后查询；无结果时不切换其他引擎冒充。导入语料见D01。
              </p>
            )}
            {["D08", "D12"].includes(id) && (
              <p class="lab-note">
                已存查询无需模型下载；自由输入会加载同一模型。余弦越大越近；EdgeVec采用单位向量的L2平方距离，越小越近。近似结果不是库内部路径可视化。
              </p>
            )}
            {this.list()}
          </section>
          <section class="lab-column">
            {this.source()}
            {id === "D07" && this.results.length > 0 && (
              <details open>
                <summary>各词项贡献</summary>
                <pre>
                  {JSON.stringify(
                    this.results.find((x) => x.id === this.doc()?.id),
                    null,
                    2,
                  )}
                </pre>
              </details>
            )}
            {id === "D09" && this.output && (
              <details open>
                <summary>候选名次与融合贡献</summary>
                <pre>{JSON.stringify(this.output, null, 2)}</pre>
              </details>
            )}
            {id === "D08" && (
              <details open>
                <summary>L2归一化与HNSW的边界</summary>
                <p class="lab-note">
                  单位向量满足L2²=2−2cos。HNSW用分层邻接图减少比较；M影响连接数，efConstruction影响建图探索，efSearch影响保留候选规模，不等于访问点数。本页不把数据库未暴露的访问量画成实测轨迹。
                </p>
              </details>
            )}
          </section>
        </div>
      </div>
    );
  }
  private evaluation() {
    const hits = this.results;
    const m = metrics(
      hits.map((x) => x.id),
      this.qrels,
      5,
    );
    return (
      <div class="lab-grid">
        <section class="lab-column">
          {this.querybar(
            <button onClick={() => this.search()}>取得待判断结果</button>,
          )}
          <p class="lab-note">
            判断池固定为全部当前片段；可给未检索到的项高等级，观察nDCG下降。未判断暂按0计算，只是开发观察。
          </p>
          {state.docs.map((d) => (
            <div class="result">
              <strong>
                {d.id} · {d.title}
              </strong>
              <select
                aria-label={`相关判断${d.id}`}
                ref={(el) => {
                  if (el) el.value = String(this.qrels[d.id] ?? "");
                }}
                onChange={(e: any) => {
                  const next = { ...this.qrels };
                  e.target.value === ""
                    ? delete next[d.id]
                    : (next[d.id] = +e.target.value);
                  this.qrels = next;
                }}
              >
                <option value="">未判断</option>
                <option value="0">0 不相关</option>
                <option value="1">1 部分相关</option>
                <option value="2">2 直接相关</option>
              </select>
              <p>{d.text.slice(0, 90)}</p>
            </div>
          ))}
        </section>
        <section class="lab-column">
          <h2>前5项的开发观察</h2>
          <p class="metric">P@5 {m.precision.toFixed(2)}</p>
          <p class="metric">
            nDCG@5 {m.ndcg === null ? "无理想增益" : m.ndcg.toFixed(3)}
          </p>
          <p class="lab-note">
            前5项未判断：{m.unjudged}。未完成全库判断，不报告全库真实召回率。
          </p>
          <pre>
            {JSON.stringify(
              {
                ranking: hits.slice(0, 5).map((x) => x.id),
                gain: "2^rel−1",
                DCG: m.dcg,
                IDCG: m.ideal,
                judged: Object.keys(this.qrels).length,
              },
              null,
              2,
            )}
          </pre>
          <button
            onClick={() =>
              saveFile("qrels-development.json", {
                query: this.query,
                qrels: this.qrels,
                scope: state.docs.map((d) => d.id),
                status: "开发判断，非冻结测试集",
              })
            }
          >
            导出判断
          </button>
        </section>
      </div>
    );
  }
  private flow() {
    const agent = this.demoId === "D24";
    return (
      <div class="lab">
        <button
          onClick={() => {
            this.invalidateFlow();
            this.phase = 0;
            this.results = [];
            this.output = null;
            this.answer = "";
            this.logs = [];
            this.contextIds = [];
          }}
        >
          重新开始本轮
        </button>
        {this.querybar(
          <button
            onClick={() => (agent ? this.agent() : this.flowStep())}
            disabled={this.busy}
          >
            {agent
              ? "运行模型工具循环"
              : this.phase === 0
                ? "1 检索"
                : this.phase === 1
                  ? "2 确认上下文"
                  : this.phase === 2
                    ? "3 构建请求"
                    : "4 调用生成"}
          </button>,
        )}
        <div class="step-row">
          {(agent
            ? ["提出调用", "校验参数", "执行工具", "观察结果", "继续／停止"]
            : ["查询", "候选", "上下文", "生成请求", "回答核验"]
          ).map((x, i) => (
            <button
              class={i === this.phase ? "active" : ""}
              disabled={i > this.phase}
              onClick={() => {}}
            >
              {i + 1} {x}
            </button>
          ))}
        </div>
        <div class="lab-grid">
          <section class="lab-column">
            <span class="mode">
              检索：实时教学BM25 · 生成：
              {this.answer ? "真实本地桥接响应" : "尚未运行"}
            </span>
            <div class="panel">
              <label>
                本地桥接{" "}
                <input
                  aria-label="本地桥接地址"
                  value={this.bridge}
                  onInput={(e: any) => (this.bridge = e.target.value)}
                />
              </label>
              <p class="lab-note">
                公开页面不保存密钥。本机服务未启动、浏览器拒绝连接或模型不可用时显示错误；可用同源本地课堂入口。
                <a href="assets/guides/local-runtime.md" target="_blank">
                  运行说明 ↗
                </a>
              </p>
            </div>
            {!agent &&
              this.results.slice(0, 8).map((r) => {
                const d = state.docs.find((d) => d.id === r.id);
                return (
                  <label class="result">
                    <input
                      type="checkbox"
                      checked={this.contextIds.includes(r.id)}
                      disabled={this.busy}
                      onChange={(e: any) => {
                        this.contextIds = e.target.checked
                          ? [...this.contextIds, r.id]
                          : this.contextIds.filter((x) => x !== r.id);
                        this.phase = 1;
                        this.output = null;
                        this.answer = "";
                      }}
                    />{" "}
                    {r.id} · {d.title}
                    <p>{d.text.slice(0, 110)}</p>
                  </label>
                );
              })}
            <p class="paper-text">
              {this.answer ||
                "尚无生成答案。可以先查看检索和实际选入的上下文。"}
            </p>
            <button
              onClick={() =>
                saveFile("retrieval-run.json", {
                  query: this.query,
                  contextIds: this.contextIds,
                  logs: this.logs,
                  answer: this.answer,
                })
              }
            >
              导出运行记录
            </button>
          </section>
          <section class="lab-column">
            <h2>可观察记录</h2>
            {this.output && (
              <details open>
                <summary>实际请求</summary>
                <pre>{JSON.stringify(this.output, null, 2)}</pre>
              </details>
            )}
            <pre>{JSON.stringify(this.logs, null, 2)}</pre>
            <p class="lab-note">
              模型选择工具才是模型驱动；程序预设步骤仍标为规则流程。日志不是模型内部思维。
            </p>
          </section>
        </div>
      </div>
    );
  }
  private tools() {
    const t = this.tool;
    if (!t) return <p>该工具说明未载入。</p>;
    const step = t.steps[this.phase % t.steps.length];
    return (
      <div class="lab">
        <div class="lab-toolbar">
          <span class="mode">{t.mode}</span>
          <a href={t.url} target="_blank" rel="noreferrer">
            原代码库 ↗
          </a>
          <a href={"assets/guides/" + t.slug + ".md"} target="_blank">
            本地部署与重跑 ↗
          </a>
        </div>
        <p class="lab-note">{t.role}</p>
        <div class="step-row">
          {t.steps.map((s, i) => (
            <button
              class={i === this.phase ? "active" : ""}
              onClick={() => (this.phase = i)}
            >
              {i + 1} {s.title}
            </button>
          ))}
        </div>
        <div class="lab-grid">
          <section class="lab-column">
            <h2>{step.title}</h2>
            <div class="panel">
              <p>{step.explanation}</p>
              <pre>{step.code}</pre>
            </div>
            <p class="lab-note">{t.limit}</p>
            {t.runnable && (
              <div class="panel">
                <label>
                  桥接地址{" "}
                  <input
                    value={this.bridge}
                    onInput={(e: any) => (this.bridge = e.target.value)}
                  />
                </label>
                {this.querybar(
                  <button onClick={() => this.toolRun()}>本地重跑</button>,
                )}
              </div>
            )}
          </section>
          <section class="lab-column">
            <h2>检查输入与输出</h2>
            <p>{step.observe}</p>
            {this.output ? (
              <pre>{JSON.stringify(this.output, null, 2)}</pre>
            ) : t.result ? (
              <pre>{JSON.stringify(t.result, null, 2)}</pre>
            ) : (
              <div class="evidence-card">
                本工具此处提供部署方案和接口讲解，未伪造运行输出。完成本地安装后，可按指南实际操作。
              </div>
            )}
            <p class="lab-note">
              保存结果明确记录运行时间、版本和语料；点击步骤仅切换讲解，不表示后台已经执行。
            </p>
          </section>
        </div>
      </div>
    );
  }
  private research() {
    const id = this.demoId;
    if (id === "D22")
      return (
        <div class="lab-grid">
          <section class="lab-column">
            <h2>引用边必须有出处</h2>
            <p class="panel">
              已载入教师两篇研究对《国民思想の矛盾》的实际脚注关系。沿箭头看参考文献，反向看哪些研究引用了它。相似度不能自动生成引用边。
            </p>
            <input
              type="file"
              accept=".json"
              onChange={(e: any) =>
                this.run(async () => {
                  const data = JSON.parse(await e.target.files[0].text());
                  if (
                    !Array.isArray(data.edges) ||
                    data.edges.some((x) => !x.from || !x.to || !x.source)
                  )
                    throw Error("每条边必须含from、to、source");
                  this.output = data;
                })
              }
            />
            <p class="lab-note">
              格式：edges数组，每项含from、to、source（关系来源）。无真实关系时保留空白。
            </p>
            <a
              href="https://api.semanticscholar.org/api-docs/graph"
              target="_blank"
            >
              Semantic Scholar 原始API ↗
            </a>
          </section>
          <section class="lab-column">
            <h2>可核查的引用方向</h2>
            {this.output?.edges?.map((e) => (
              <div class="evidence-card">
                <strong>
                  {e.from} → {e.to}
                </strong>
                <p>{e.source}</p>
                <small>{e.cited_pages}</small>
              </div>
            ))}
            <p class="lab-note">
              JP21、JP22 是教师研究，JP13
              是1913年原始论说。已知引用只能证明文献使用，不能自动证明思想影响。
            </p>
            <h2>关系记录</h2>
            <pre>
              {JSON.stringify(
                this.output || { edges: [], status: "尚未导入引文数据" },
                null,
                2,
              )}
            </pre>
          </section>
        </div>
      );
    const compare = id === "D29";
    return (
      <div class="lab">
        {this.querybar(
          <button onClick={() => this.search()}>检索当前材料</button>,
        )}
        <div class="lab-toolbar">
          <select
            aria-label="语料范围"
            ref={(el) => {
              if (el) el.value = String(this.author);
            }}
            onChange={(e: any) => {
              this.author = e.target.value;
              this.invalidateFlow();
            }}
          >
            <option value="all">全部材料</option>
            <option value="JP">井上相关材料</option>
            <option value="ZT">章太炎卷册</option>
          </select>
          <button
            disabled={!this.lastSearch || this.busy}
            onClick={() => {
              this.logs = [
                ...this.logs,
                {
                  round: this.logs.length + 1,
                  query: this.lastSearch.query,
                  scope: this.lastSearch.scope,
                  corpus_version: this.lastSearch.version,
                  ids: this.results.slice(0, 5).map((x) => x.id),
                  note: this.answer,
                },
              ];
              this.answer = "";
            }}
          >
            保存本轮观察
          </button>
          <button
            onClick={() =>
              saveFile("research-notes.json", {
                question: this.query,
                rounds: this.logs,
              })
            }
          >
            导出
          </button>
        </div>
        <div class="lab-grid">
          <section class="lab-column">
            <h2>{compare ? "字面相同之后" : "从问题到证据"}</h2>
            <p class="lab-note">
              {id === "D21"
                ? "保留每轮查询与新增证据。相关反馈与大模型改写不是同一算法。"
                : compare
                  ? "相同汉字、近邻分数、概念等值与影响关系分别判断。不能凭结果列表推断传播。"
                  : "接续教师《井上哲次郎論》PDF9—10、19（注56—60）与《国民国家与民主主义》PDF16：先问个人、君主与民主如何被表述，再检索宗教、神道与国家秩序之间的关联。保留不支持预期解释的段落。"}
            </p>
            {this.list()}
            {id === "D21" && (
              <div>
                {this.preset()}
                {this.results.slice(0, 6).map((r) => (
                  <label class="result">
                    <input
                      type="checkbox"
                      checked={this.feedback.includes(r.id)}
                      onChange={(e: any) =>
                        (this.feedback = e.target.checked
                          ? [...this.feedback, r.id]
                          : this.feedback.filter((x) => x !== r.id))
                      }
                    />
                    {r.id} 人工判断相关
                  </label>
                ))}
              </div>
            )}
            {id === "D21" && (
              <button
                disabled={!state.queries[0]?.vector}
                onClick={() => {
                  const q = state.queries.find(
                    (x) => x.text === this.query,
                  )?.vector;
                  if (!q) {
                    this.message = "请选择已有向量的查询";
                    return;
                  }
                  const pos = this.feedback
                    .map((id) => state.docs.find((d) => d.id === id)?.vector)
                    .filter(Boolean);
                  this.output = {
                    method: "Rocchio",
                    note: "人工勾选相关片段后更新查询表示；未勾选则不改变方向。",
                    query_vector: rocchio(q, pos, []).slice(0, 12),
                  };
                }}
              >
                查看Rocchio表示更新
              </button>
            )}
          </section>
          <section class="lab-column">
            {this.source()}
            <textarea
              rows={4}
              aria-label="史学判断笔记"
              value={this.answer}
              onInput={(e: any) => (this.answer = e.target.value)}
              placeholder="这一段支持什么？有哪些条件、否定或不能证明的部分？"
            />
            <div class="panel">
              <h3>本轮检查顺序</h3>
              <p class="lab-note">
                字是否读对 → 说话者与文体 → 言说/刊载日期 → 正文或编注 →
                相邻段落 → 反例与支持范围
              </p>
            </div>
            {this.output && <pre>{JSON.stringify(this.output, null, 2)}</pre>}
            <details>
              <summary>{this.logs.length} 轮研究记录</summary>
              <pre>{JSON.stringify(this.logs, null, 2)}</pre>
            </details>
          </section>
        </div>
      </div>
    );
  }
  private multimodal() {
    const data = this.images;
    if (!data) return <p>多模态材料尚未载入。</p>;
    const mode = this.demoId;
    const set = mode === "D32" ? data.kuzushi : data.pages;
    const selected = set?.items?.[this.imageIndex] || set?.items?.[0];
    if (!set?.items?.length)
      return (
        <div class="panel">
          <h2>准备中的实际模型与数据</h2>
          <p>{set?.status || "本组尚未生成可核验数据。"}</p>
          <a href="assets/guides/multimodal.md" target="_blank">
            查看本地部署方案
          </a>
        </div>
      );
    const q =
      mode === "D31"
        ? data.text_queries?.[this.presetIndex]?.vector
        : selected.vector;
    const hits = (
      mode === "D30"
        ? set.items.map((x, i) => ({
            item: x,
            score: tokenize(this.query, "word").filter((t) =>
              (x.caption || x.ocr || "").includes(t),
            ).length,
          }))
        : set.items
            .filter(
              (x) => x.vector && q && (mode !== "D32" || x.id !== selected.id),
            )
            .map((x) => ({ item: x, score: cosine(q, x.vector) }))
    )
      .filter((r) => mode !== "D30" || r.score > 0)
      .sort((a, b) => b.score - a.score);
    return (
      <div class="lab">
        <span class="mode">
          {mode === "D30"
            ? "派生文本检索"
            : mode === "D31"
              ? "共同图文空间 · 预计算查询"
              : "图像特征 · 实时近邻排序"}{" "}
          · {set.model || set.status}
        </span>
        <div class="lab-grid">
          <section class="lab-column">
            {mode === "D31" ? (
              <select
                aria-label="多模态查询"
                ref={(el) => {
                  if (el) el.value = String(this.presetIndex);
                }}
                onChange={(e: any) => (this.presetIndex = +e.target.value)}
              >
                {data.text_queries?.map((q, i) => (
                  <option value={i}>{q.text}</option>
                ))}
              </select>
            ) : mode === "D30" ? (
              this.querybar(
                <button
                  onClick={() =>
                    (this.output = {
                      query: this.query,
                      mode: "对已存OCR/描述作字面检索",
                    })
                  }
                >
                  查看命中
                </button>,
              )
            ) : (
              <h2>选择查询图块</h2>
            )}
            <div class="image-grid">
              {set.items.map((x, i) => (
                <button
                  class={i === this.imageIndex ? "selected" : ""}
                  onClick={() => (this.imageIndex = i)}
                >
                  <img src={x.image} alt={x.label || x.title} />
                  <small>{x.label || x.id}</small>
                </button>
              ))}
            </div>
            {selected && (
              <div class="panel">
                <h3>{selected.title || selected.label}</h3>
                <p class="source-line">{selected.source}</p>
                <p>{selected.caption || selected.ocr}</p>
              </div>
            )}
            <p class="lab-note">
              {mode === "D31"
                ? "离线只选择已有查询向量；自由输入须运行兼容编码器。模型图文共同空间不可替换为普通文本向量。"
                : mode === "D32"
                  ? "特征与图块来自助教demo所用模型/数据。近邻不等于同字；显示原标签并保留错误邻居。"
                  : "人工描述、OCR、视觉模型描述分别标注。检索不到模型描述中遗漏的细节。"}
            </p>
          </section>
          <section class="lab-column">
            <h2>最近邻与原始材料</h2>
            {hits.slice(0, 6).map((r, i) => (
              <div class="result">
                <div class="lab-toolbar">
                  <img
                    src={r.item.image}
                    width="70"
                    height="70"
                    style={{ objectFit: "contain" }}
                    alt={r.item.label || r.item.title}
                  />
                  <div>
                    <strong>
                      {i + 1}. {r.item.label || r.item.title}
                    </strong>
                    <div>{r.score.toFixed(4)}</div>
                    <p class="source-line">{r.item.source}</p>
                  </div>
                </div>
              </div>
            ))}
            <a href="assets/guides/multimodal.md" target="_blank">
              模型、数据与本地重跑说明 ↗
            </a>
          </section>
        </div>
      </div>
    );
  }
  render() {
    if (!this.ready) return <p>{this.message || "载入可核验的课堂片段…"}</p>;
    let body;
    if (this.demoId === "D00")
      body = (
        <div class="hero-lab">
          <div>
            <p class="eyebrow">WEEK 03 / RETRIEVAL & EVIDENCE</p>
            <div class="hero-title">
              找到一段文字，
              <br />
              还没有找到答案。
            </div>
            <p class="hero-lead">
              从材料进入机器，到证据进入论证。
              <br />
              每一步都留下可以回查的中间结果。
            </p>
            <span class="mode">真实语料 · 可操作的检索 · 逐页来源</span>
          </div>
          <div>
            {[
              "材料怎样变成数据",
              "为什么这一段排在前面",
              "一次检索怎样接到回答",
              "多轮研究与工具选择",
              "史学判断与多模态",
            ].map((x, i) => (
              <div class="hero-path">
                {x}
                <span>0{i + 1} →</span>
              </div>
            ))}
          </div>
        </div>
      );
    else if (["D01", "D02", "D03", "D04", "D05"].includes(this.demoId))
      body = this.foundation();
    else if (["D06", "D07", "D08", "D09", "D11", "D12"].includes(this.demoId))
      body = this.retrieval();
    else if (this.demoId === "D10") body = this.evaluation();
    else if (["D13", "D24"].includes(this.demoId)) body = this.flow();
    else if (["D21", "D22", "D28", "D29"].includes(this.demoId))
      body = this.research();
    else if (["D30", "D31", "D32"].includes(this.demoId))
      body = this.multimodal();
    else body = this.tools();
    return (
      <div class="lab">
        {this.busy && <span class="mode">正在执行，请稍候…</span>}
        {this.message && (
          <div
            class={
              "mode " +
              (/Error|错误|失败/.test(this.message) ? "status-error" : "")
            }
          >
            {this.message}
          </div>
        )}
        {body}
      </div>
    );
  }
}
