import { Fragment, Component, h, Prop, State, Listen } from "@stencil/core";
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
import { evidenceMessages } from "../../lib/model-tasks";
import { regexPresets } from "../../lib/explanations";
import {
  generate,
  getModelConfig,
  modelLabel,
  openModelSettings,
  agentMessages,
  parseAction,
  citationCheck,
} from "../../lib/model-client";
@Component({ tag: "lesson-lab", shadow: false })
export class LessonLab {
  private epoch = 0;
  private modelAbort: AbortController;
  @State() modelView = false;
  @State() modelName = modelLabel();
  @State() responseMeta: any = null;
  @Listen("model-config-change", { target: "window" }) modelChanged() {
    this.modelName = modelLabel();
    if (["D13", "D24"].includes(this.demoId)) this.invalidateFlow();
  }
  disconnectedCallback() {
    this.modelAbort?.abort();
  }
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
  @State() bridge = getModelConfig().bridge;
  @State() answer = "";
  @State() contextIds: string[] = [];
  @State() author = "all";
  @State() feedback: string[] = [];
  @State() images: any = null;
  @State() captionMode = "ocr";
  @State() visionExamples: any[] = [];
  @State() imageIndex = 0;
  @State() presetIndex = 0;
  @State() stages: any[] = [];
  @State() queryVector: number[] = [];
  @State() sparse: any = null;
  @State() sparseOpen = false;
  @State() prune = 0.1;
  @State() regexIndex = 0;
  @State() negative: string[] = [];
  @State() alpha = 1;
  @State() beta = 0.75;
  @State() gamma = 0.15;
  @State() hnswM = 16;
  @State() hnswBuild = 100;
  @State() hnswSearch = 50;
  async componentWillLoad() {
    try {
      await loadCorpus();
      this.text = state.docs[0]?.text || "";
      if (this.demoId === "D06") this.useRegex(0);
      if (this.demoId === "D05") this.sparse = await (await fetch("assets/data/neural-sparse.json")).json();
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
        if (this.tool.default_query) this.query = this.tool.default_query;
      }
      if (["D30", "D31", "D32"].includes(this.demoId))
        this.images = await (await fetch("assets/data/multimodal.json")).json();
      if (this.demoId === "D30")
        this.visionExamples = (
          await (await fetch("assets/data/model-examples.json")).json()
        ).examples.filter((x) => x.demo_id === "D30");
      if (this.demoId === "D22")
        this.output = await (await fetch("assets/data/citations.json")).json();
      this.ready = true;
    } catch (e) {
      this.message = String(e);
    }
  }
  @Listen("corpus-change", { target: "window" }) reset() {
    this.modelAbort?.abort();
    this.responseMeta = null;
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
    this.negative = [];
    this.queryVector = [];
    this.sparseOpen = false;
    this.phase = 0;
    this.answer = "";
    this.normalized = "";
    this.message = `已切换语料：${state.docs.length}条。导入时不上传；选择API运行时会发送选中的片段。`;
  }
  private doc() {
    return state.docs[this.selected] || state.docs[0];
  }
  private select(d: Doc) {
    this.selected = state.docs.indexOf(d);
    this.text = d.text;
    this.normalized = "";
    if (["D02", "D04", "D06"].includes(this.demoId)) this.output = null;
  }
  private invalidateFlow() {
    this.modelAbort?.abort();
    this.responseMeta = null;
    this.results = [];
    this.output = null;
    this.qrels = {};
    this.feedback = [];
    this.negative = [];
    this.queryVector = [];
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
              <div class="candidate-item"><button
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
              </button>{this.demoId === "D21" && <label class="feedback-choice">读过这段后标记：<select aria-label={`反馈${r.id}`} ref={el=>{if(el)el.value=this.feedback.includes(r.id)?'positive':this.negative.includes(r.id)?'negative':'';}} onChange={(e:any)=>{
                this.feedback=this.feedback.filter(x=>x!==r.id);this.negative=this.negative.filter(x=>x!==r.id);
                if(e.target.value==='positive')this.feedback=[...this.feedback,r.id];
                if(e.target.value==='negative')this.negative=[...this.negative,r.id];
              }}><option value="">未判断</option><option value="positive">相关（向它靠近）</option><option value="negative">不相关（远离它）</option></select></label>}</div>
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
  private useRegex(index: number) {
    this.regexIndex = index;
    const p = regexPresets[index];
    this.query = p.pattern;
    this.replacement = p.replacement;
    this.output = null;
  }
  private regexResult() {
    if (!this.output?.matches) return <p>选择规则后点击“匹配”。原文命中的部分将在这里高亮。</p>;
    const nodes = []; let at = 0;
    for (const m of this.output.matches) {
      nodes.push(this.text.slice(at, m.index));
      nodes.push(<mark title={`UTF-16偏移${m.index}；捕获组：${m.captures.join(' / ') || '无'}`}>{m.text || '∅'}</mark>);
      at = m.index + m.text.length;
    }
    nodes.push(this.text.slice(at));
    return <div><p class="ex-preview">{nodes}</p><p>命中 {this.output.matches.length} 处{this.output.truncated?'（达到300条显示上限）':''}。黄色是整个匹配；下方单列捕获组。</p>{this.output.matches.slice(0,8).map((m,i)=><div class="ex-capture"><b>#{i+1} {m.text || '空匹配'}</b><span> → {m.captures.length?m.captures.map((c,j)=>`$${j+1}=${c}`).join('；'):'没有捕获组'}</span></div>)}<h3>替换后的副本</h3><p class="ex-preview">{this.output.replacement_preview}</p></div>;
  }
  private sparseView() {
    const d=this.doc(), record=this.sparse?.records.find(x=>x.id===d.id&&x.input_text===this.text);
    if(!record)return <p>当前文本没有配套的真实稀疏输出；请切回原始课堂片段，或用附带脚本重新编码。</p>;
    const max=record.weights[0]?.weight||1, kept=record.weights.filter(x=>x.weight>max*this.prune);
    const q=this.sparse.queries.find(x=>x.text===this.query)||this.sparse.queries[0];
    const products=q.weights.map(x=>({...x,document_weight:kept.find(y=>y.token_id===x.token_id)?.weight||0}));
    return <div class="sparse-live"><label>剪枝比例 {this.prune.toFixed(2)} <input aria-label="稀疏剪枝阈值" type="range" min="0" max="0.9" step="0.05" value={this.prune} onInput={(e:any)=>this.prune=+e.target.value}/></label><p class="ex-formula">保留条件：权重 &gt; 最大权重 × 比例 = {max.toFixed(3)} × {this.prune.toFixed(2)} = {(max*this.prune).toFixed(3)}</p><p>{record.weights.length} 个非零词项 → {kept.length} 个保留（其中{kept.filter(x=>!x.in_input).length}个不在输入token序列）。展示权重最高的16项。</p><div class="ex-bars">{record.weights.slice(0,16).map(x=><div class={'ex-bar-row '+(x.weight<=max*this.prune?'pruned':'')}><span>{x.token}<small>{x.in_input?'原文词项':'模型扩展'}</small></span><span class="ex-track"><i style={{width:`${100*x.weight/max}%`}}/></span><b>{x.weight.toFixed(3)}</b></div>)}</div><label>点积查询 <select aria-label="稀疏查询" onChange={(e:any)=>this.query=e.target.value}>{this.sparse.queries.map(x=><option value={x.text} selected={x.text===q.text}>{x.text}</option>)}</select></label><p class="ex-formula">稀疏点积 = Σ 查询IDF × 文档模型权重 = {products.reduce((sum,x)=>sum+x.weight*x.document_weight,0).toFixed(4)}</p>{products.map(x=><span class="ex-chip">{x.token}：{x.weight.toFixed(2)} × {x.document_weight.toFixed(3)}</span>)}<p class="lab-note">doc-only模型：文档经过神经网络；查询使用上游配套IDF。剪枝和点积在页面实时计算，文档权重由本机模型预计算，未用手工数值。</p><details><summary>模型、版本与计算来源</summary><p>{this.sparse.model} · {(this.sparse.parameters/1e6).toFixed(1)}M · {this.sparse.revision}</p><p>log(1+ReLU(max位置(logit)))；{this.sparse.vocabulary_size}维词表。PyTorch {this.sparse.torch} / Transformers {this.sparse.transformers} / CPU float32。</p><a href={this.sparse.source} target="_blank" rel="noreferrer">原模型与实现 ↗</a><p>这是SPLADE式稀疏聚合机制的多语言实现，不是NAVER SPLADE检查点；权重不是史学概念重要性的人工标注。</p></details></div>;
  }
  private updateBM25() {
    this.results=bm25(state.docs,this.query,{k1:this.k1,b:this.b,mode:this.tokMode});
    this.lastSearch={query:this.query,scope:this.author,version:state.version};
    if(!this.results.some(x=>x.id===this.doc()?.id)&&this.results[0])this.select(state.docs.find(d=>d.id===this.results[0].id));
  }
  private applyFeedback() {
    return this.run(async()=>{
      const q=await this.qvector();
      const vectors=(ids:string[])=>ids.map(id=>state.docs.find(d=>d.id===id)?.vector).filter(Boolean);
      const updated=rocchio(q,vectors(this.feedback),vectors(this.negative),this.alpha,this.beta,this.gamma);
      const scoped=state.docs.filter(d=>this.author==='all'||d.source_id?.startsWith(this.author));
      const before=rankVectors(scoped,q);
      this.results=rankVectors(scoped,updated);
      this.output={method:'Rocchio',scope:this.author,corpus_size:scoped.length,alpha:this.alpha,beta:this.beta,gamma:this.gamma,positive:this.feedback.length,negative:this.negative.length,angle:Math.acos(Math.max(-1,Math.min(1,cosine(q,updated))))*180/Math.PI,before};
      this.lastSearch={query:this.query,scope:this.author,version:state.version};
      this.message='已用更新后的完整查询向量重新检索；上方可比较前后排名。';
    });
  }
  private async qvector() {
    const epoch=this.epoch,version=state.version;
    const q = state.queries.find((x) => x.text === this.query);
    const result = q?.vector || await embed(this.query, (s) => (this.message = s));
    if(epoch!==this.epoch||version!==state.version)throw Error("查询或语料已更改，旧编码结果已丢弃。");
    this.queryVector = result;
    return result;
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
      else if (kind === "edgevec") {
        const q = await this.qvector();
        results = await vectorSearch(q,{m:this.hnswM,efConstruction:this.hnswBuild,efSearch:this.hnswSearch});
        const exact = rankVectors(docs, q);
        output = { exact, overlap: results.slice(0,5).filter(x=>exact.slice(0,5).some(y=>y.id===x.id)).length, hnsw:{m:this.hnswM,efConstruction:this.hnswBuild,efSearch:this.hnswSearch} };
      }
      else if (kind === "vector")
        results = rankVectors(docs.filter(d=>this.demoId!=="D21"||this.author==="all"||d.source_id?.startsWith(this.author)), await this.qvector());
      else if (kind === "rrf") {
        const a = bm25(docs, this.query),
          b = rankVectors(docs, await this.qvector());
        results = rrf([a, b], this.c);
        output = {
          bm25: a,
          vector: b,
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
      this.output = output || null;
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
          messages: evidenceMessages(
            this.query,
            this.contextIds.map((id) => state.docs.find((d) => d.id === id)),
          ),
        };
        this.phase = 3;
      } else {
        if (!this.output?.messages) throw Error("请先构建本轮生成请求");
        this.modelAbort = new AbortController();
        const d = await generate(this.output.messages, {
          signal: this.modelAbort.signal,
        });
        if (epoch !== this.epoch || version !== state.version) return;
        this.answer = d.text;
        this.responseMeta = {
          ...d,
          text: undefined,
          citation_check: citationCheck(d.text, this.contextIds),
        };
        this.logs = [
          ...this.logs,
          {
            event: "generated",
            ...this.responseMeta,
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
      this.modelAbort = new AbortController();
      this.output = { query: query, maximum_turns: 4 };
      for (let turn = 0; turn < 4; turn++) {
        this.phase = 0;
        const payload = {
          query: query,
          observations,
          allowed_tools: ["search", "read", "finish"],
          instruction:
            "选择下一步工具。search需要query；read需要id；finish需要answer并引用已经读到的ID。",
        };
        const response = await generate(agentMessages(payload), {
          json: true,
          signal: this.modelAbort.signal,
        });
        this.phase = 1;
        const action = parseAction(response.text),
          model = response.model;
        if (epoch !== this.epoch || version !== state.version) return;
        this.logs = [
          ...this.logs,
          { runId, turn, event: "model_proposal", model, action, response },
        ];
        if (!["search", "read", "finish"].includes(action.tool))
          throw Error("模型给出未获准工具，执行器已拒绝。");
        if (action.tool === "finish") {
          const readIds = observations
            .filter((o) => o.action.tool === "read")
            .map((o) => o.result.id);
          if (!readIds.length) throw Error("模型尚未读取证据，不能完成回答");
          const cited = [
            ...String(action.answer).matchAll(/\[((?:JP|ZT)[\w-]+)\]/g),
          ].map((x) => x[1]);
          if (!cited.length || cited.some((id) => !readIds.includes(id)))
            throw Error("回答缺少已读ID引用或引用了未读材料；请检查模型输出。");
          this.answer = String(action.answer || "");
          this.responseMeta = { ...response, text: undefined };
          this.logs = [...this.logs, { runId, turn, event: "stopped" }];
          this.phase = 4;
          return;
        }
        this.phase = 2;
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
        this.phase = 3;
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
        signal: AbortSignal.timeout(660000),
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
              onInput={(e: any) => {this.text = e.target.value; this.output = null; this.normalized = "";}}
            />
            <div class="lab-toolbar">
              <select
                aria-label="规范化规则"
                ref={(el) => {
                  if (el) el.value = String(this.config);
                }}
                onChange={(e: any) => {this.config = e.target.value; this.normalized="";this.output=null;}}
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
                      terms,
                      documents: docs.map(d=>d.id),
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
            {this.output && <details><summary>查看词项与向量原始数据</summary><pre>{JSON.stringify(this.output, null, 2)}</pre></details>}
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
            <div class="ex-runtime"><b>CBOW</b><span>{tokens.slice(Math.max(0,center-2),center).concat(tokens.slice(center+1,center+3)).join(' / ')}</span><b>→</b><span>预测中心：{tokens[center]}</span></div>
            <div class="ex-runtime"><b>Skip-gram</b><span>中心：{tokens[center]}</span><b>→</b><span>分别预测：{tokens.slice(Math.max(0,center-2),center).concat(tokens.slice(center+1,center+3)).join(' / ')}</span></div>
            <p class="lab-note">
              点击词改变中心位置。这是训练任务的构造示意，未在本页训练Word2vec。负例来自噪声抽样，不是反义词或历史反证。
            </p>
            <div class="panel">
              <button onClick={() => this.sparseOpen = !this.sparseOpen}>看神经稀疏表示</button>
              {this.sparseOpen && this.sparseView()}
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
            <p class="lab-note">图中仅画前{Math.min(100,v.length)}个坐标：横向是维度序号，竖线向上为正、向下为负；余弦计算会使用全部{v.length}维。</p>
            <details><summary>嵌入模型与配置</summary><pre>{JSON.stringify(state.manifest.embedding, null, 2)}</pre></details>
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
            <div class="regex-presets">
              <label>可复制的表达式范例 <select aria-label="正则预设" ref={el=>{if(el)el.value=String(this.regexIndex)}} onChange={(e:any)=>this.useRegex(+e.target.value)}>
                {regexPresets.map((p,i)=><option value={i}>{p.name}</option>)}
              </select></label>
              <div class="lab-toolbar"><button onClick={()=>this.useRegex(this.regexIndex)}>应用此范例</button><button onClick={()=>this.useRegex((this.regexIndex+1+Math.floor(Math.random()*(regexPresets.length-1)))%regexPresets.length)}>随机换一个范例</button><button onClick={()=>navigator.clipboard.writeText(this.query).then(()=>this.message='已复制当前表达式').catch(()=>this.message='复制未获浏览器允许；可选中文本框手动复制')}>复制当前表达式</button></div>
              <p>{regexPresets[this.regexIndex].pattern===this.query?regexPresets[this.regexIndex].why:'当前为自定义规则；范例说明仅在应用对应范例后显示。'}</p>
            </div>
            <textarea
              rows={7}
              value={this.text}
              aria-label="正则测试原文"
              onInput={(e: any) => {this.text = e.target.value; this.output = null; this.normalized = "";}}
            />
            <div class="lab-toolbar">
              <input
                aria-label="正则表达式"
                value={this.query}
                onInput={(e: any) => {this.query = e.target.value; this.output = null;}}
              />
              <button onClick={() => this.regex()}>匹配</button>
            </div>
            <div class="lab-toolbar">
              <label>
                替换为{" "}
                <input
                  aria-label="替换表达式"
                  value={this.replacement}
                  onInput={(e: any) => {this.replacement = e.target.value; this.output = null;}}
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
            {this.regexResult()}
            {this.output && <details><summary>原始匹配数据</summary><pre>{JSON.stringify(this.output,null,2)}</pre></details>}
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
                      this.updateBM25();
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
                      this.updateBM25();
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
                  onInput={(e: any) => {
                    this.c = +e.target.value;
                    if(this.output?.bm25) { this.results=rrf([this.output.bm25,this.output.vector],this.c); this.output={...this.output,fusion:this.results.slice(0,6),c:this.c}; }
                  }}
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
            {id === "D12" && <div class="controls">{(['hnswM','hnswBuild','hnswSearch'] as const).map((key,i)=><label>{['M（高层连接上限）','efConstruction（建图探索）','efSearch（查询候选规模）'][i]} = {this[key]}<input aria-label={key} type="range" min={i===0?'4':i===1?String(Math.max(20,Math.ceil(this.hnswM/10)*10)):'20'} max={i===0?'32':'200'} step={i===0?'4':'10'} value={this[key]} disabled={this.busy} onInput={(e:any)=>{this[key]=+e.target.value;if(this.hnswBuild<this.hnswM)this.hnswBuild=Math.ceil(this.hnswM/10)*10;this.output=null;this.results=[];}}/></label>)}<p class="lab-note">调节后点击“运行EdgeVec”：本页按新配置重新建图，再查询。耗时包括建图，不是纯查询基准。M0取2M；建图探索规模至少覆盖M，增大M时会同步提高过小的建图值。小库前五名可能完全不变，参数改变不保证排名改变。</p></div>}
            {this.list()}
          </section>
          <section class="lab-column">
            {this.source()}
            {id === "D07" && this.results.length > 0 && (
              <details>
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
              <details>
                <summary>候选名次与融合贡献</summary>
                <pre>{JSON.stringify(this.output, null, 2)}</pre>
              </details>
            )}
            {id === "D08" && (
              <details>
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
              {this.answer
                ? `${this.responseMeta?.provider === "api" ? "API" : "本地"}实际响应 · ${this.responseMeta?.model}`
                : "尚未运行"}
            </span>
            <div class="panel">
              <span class="mode">{this.modelName}</span>
              <button onClick={() => openModelSettings()}>
                设置本地模型／API Key
              </button>
              <p class="lab-note">
                本地模型不需Key；API接入可选DeepSeek等兼容服务。保存示例见本页顶部“模型实跑与示例”。
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
            <p class="model-answer">
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
                  model: this.responseMeta,
                })
              }
            >
              导出运行记录
            </button>
          </section>
          <section class="lab-column">
            <h2>可观察记录</h2>
            {this.responseMeta && (
              <pre>{JSON.stringify(this.responseMeta, null, 2)}</pre>
            )}
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
    const observed=this.output || t.result;
    const ranked=Array.isArray(observed?.results)?observed.results:[];
    return (
      <div class="lab">
        <div class="lab-toolbar">
          <span class="mode">{t.mode}</span>
          {t.application_url && <a href={t.application_url} target="_blank" rel="noreferrer">打开本机应用 ↗</a>}
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
                <p class="lab-note">应用使用各自已配置的本地模型；顶部“模型接入”用于独立模型实验。研究工具可能运行数分钟。</p>
                {this.querybar(
                  <button disabled={this.busy} onClick={() => this.toolRun()}>本地重跑</button>,
                )}
              </div>
            )}
          </section>
          <section class="lab-column">
            <h2>检查输入与输出</h2>
            <p>{step.observe}</p>
            {observed ? (
              <div>
                <p class="mode">{this.output ? "本次实际返回" : "保存的本机实跑结果"} · {observed.tool || t.name} {observed.version || ""}</p>
                {ranked.length>0&&<div><p>查询“{observed.query || "见记录"}” → {observed.records ?? "见记录"}条入库材料 → 返回{ranked.length}条候选</p><p class="lab-note">度量：{observed.metric || "见原始响应"}。下面按服务返回顺序排列；分数不直接换成正确概率。</p>{ranked.slice(0,8).map((r,i)=>{const d=state.docs.find(d=>d.id===r.id);return <div class="evidence-card"><b>#{i+1} {d?.title || r.id}</b><p>{r.id} · {Number.isFinite(r.score)?`分值 ${r.score.toFixed(4)}`:''}</p>{d&&<><p class="source-line">{sourceLabel(d)}</p><p>{d.text.slice(0,140)}{d.text.length>140?'…':''}</p></>}</div>;})}</div>}
                {t.review_notes?.map(note=><p class="application-caution">{note}</p>)}
                {observed.model&&<p class="source-line">生成／评价模型：{observed.model} · 实跑时间：{observed.run_at}</p>}
                {observed.answer&&<div class="model-answer"><h3>模型实际回答（待核查）</h3><p style={{whiteSpace:'pre-wrap'}}>{observed.answer}</p></div>}
                {observed.sources?.length>0&&<div><h3>送入回答环节的材料</h3>{observed.sources.slice(0,5).map(s=><div class="evidence-card"><strong>{s.title}</strong><p>{s.text}</p>{s.summary&&<p class="lab-note">模型摘要：{s.summary}</p>}</div>)}</div>}
                {observed.trace?.length>0&&<details><summary>展开实际执行轨迹（{observed.trace.length}条）</summary><div class="application-timeline">{observed.trace.map((e,i)=><div class="evidence-card"><b>{i+1} → {e.action || (e.currentQuery ? '研究查询' : e.output ? '模型返回' : '进度更新')}</b><p>{e.query || e.currentQuery || e.output || JSON.stringify(e)}</p>{e.ids&&<small>{e.ids.join(' → ')}</small>}</div>)}</div></details>}
                {observed.tree&&<div class="panel"><h3>发现 → 判断 → 保留</h3><p>{observed.tree.extra?.touch_ids?.length || 0} 条被发现 → {observed.tree.extra?.crawler_recall_papers?.length || 0} 条进入选择器 → {observed.tree.extra?.recall_papers?.length || 0} 条被保留</p><p>零条保留也是一次真实结果；不能把筛除的候选写成已找到的证据。</p></div>}
                {observed.results_detail&&<div><h3>逐条判断回答能否由原文支持</h3><p class="application-caution">下面回答含人为设置的错误，专用于评价演示：“{observed.input.response}”</p>{observed.results_detail.results?.[0]?.response_claims?.map((claim,i)=><div class="evidence-card"><b>{claim.join(' → ')}</b><p>原文核查：{observed.results_detail.results[0].retrieved2response?.[i]?.join(', ')}</p></div>)}<div class="metric-bars">{Object.entries(observed.results_detail.metrics.overall_metrics).map(([k,v])=><div><span>{k}：{Number(v).toFixed(1)}%</span><progress max="100" value={Number(v)} /></div>)}</div><p class="lab-note">这些是本次小样本的模型判定；要复核抽取出的论断是否准确。Neutral表示证据不足以推出该断言。</p>{observed.benchmark&&<div class="panel"><h3>DeepResearch Bench：单题 RACE 对照</h3><p>四维加权后，待评答案相对得分 = 待评总分 ÷（待评总分 + 参照总分）。本次为 {observed.benchmark.evaluation?.overall_score?.toFixed(3)}。</p><p>这是自拟单题＋4B评价模型，不是官方全套基准排名；FACT联网核验未接入。</p></div>}</div>}
                {t.screenshot&&<details><summary>查看真实应用运行截图</summary><img class="application-screenshot" src={t.screenshot} alt={t.name+'本机实际运行截图'} /></details>}
                <details><summary>版本、请求与完整响应</summary><pre>{JSON.stringify(observed, null, 2)}</pre></details>
              </div>
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
          <button disabled={this.busy || !this.query.trim()} onClick={() => this.search(id === "D21" ? "vector" : "bm25")}>检索当前材料</button>,
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
                ? "先按余弦取得初始排名，再标记反馈。更新前后均在所选语料范围内用同一余弦度量比较；相关反馈与大模型改写不是同一算法。"
                : compare
                  ? "相同汉字、近邻分数、概念等值与影响关系分别判断。不能凭结果列表推断传播。"
                  : "接续教师《井上哲次郎論》PDF9—10、19（注56—60）与《国民国家与民主主义》PDF16：先问个人、君主与民主如何被表述，再检索宗教、神道与国家秩序之间的关联。保留不支持预期解释的段落。"}
            </p>
            {id === "D21" && (
              <div>
                {this.preset()}
                <div class="controls">{(['alpha','beta','gamma'] as const).map((key,i)=><label>{['α 原查询','β 相关均值','γ 不相关均值'][i]} = {this[key]}<input aria-label={`Rocchio ${key}`} type="range" min={key==='alpha'?'0.1':'0'} max="2" step="0.05" value={this[key]} onInput={(e:any)=>this[key]=+e.target.value}/></label>)}</div>
                <button disabled={this.busy || !this.results.length || !this.query.trim()} onClick={()=>this.applyFeedback()}>更新查询并重新检索</button>
                <p class="lab-note">下方每条候选可以标记相关与否；未标记的不作负例。下次运行从原查询重新计算，不在旧结果上反复累计。</p>
              </div>
            )}
            {this.list()}
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
    const derivedText = (x: any) =>
      this.captionMode === "ocr"
        ? x.ocr || ""
        : this.captionMode === "manual"
          ? x.caption || ""
          : this.visionExamples.find(
              (e) =>
                e.image_id === x.id && e.response.model === this.captionMode,
            )?.response.text || "";
    const q =
      mode === "D31"
        ? data.text_queries?.[this.presetIndex]?.vector
        : selected.vector;
    const hits = (
      mode === "D30"
        ? set.items.map((x, i) => ({
            item: x,
            score: [...new Set(tokenize(this.query, "word"))].filter((t) =>
              derivedText(x).includes(t),
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
          ·{" "}
          {mode === "D30"
            ? this.captionMode === "ocr"
              ? "OCR工作转录"
              : this.captionMode === "manual"
                ? "人工描述"
                : this.captionMode + " · 预先实际生成"
            : set.model || set.status}
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
                      mode: `对${this.captionMode}派生文本作字面检索`,
                    })
                  }
                >
                  查看命中
                </button>,
              )
            ) : (
              <h2>选择查询图块</h2>
            )}
            {mode === "D30" && (
              <label>
                派生文本来源{" "}
                <select
                  aria-label="派生文本类型"
                  onChange={(e: any) => (this.captionMode = e.target.value)}
                >
                  <option value="ocr">原OCR转录</option>
                  <option value="manual">人工描述</option>
                  <option value="qwen3-vl:4b-instruct-q4_K_M">
                    Qwen3-VL本机模型描述
                  </option>
                  <option value="gemma3:4b">Gemma3本机模型描述</option>
                </select>
              </label>
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
                <p class="model-answer">
                  {mode === "D30"
                    ? derivedText(selected) || "尚无该类型的派生文本"
                    : selected.caption || selected.ocr}
                </p>
                {mode === "D30" &&
                  !["ocr", "manual"].includes(this.captionMode) && (
                    <p class="lab-note">
                      {
                        this.visionExamples.find(
                          (e) =>
                            e.image_id === selected.id &&
                            e.response.model === this.captionMode,
                        )?.response.model
                      }{" "}
                      · 预先实际生成。
                      {
                        this.visionExamples.find(
                          (e) =>
                            e.image_id === selected.id &&
                            e.response.model === this.captionMode,
                        )?.review_note
                      }{" "}
                      选择本页“模型实跑与示例”可重新生成。
                    </p>
                  )}
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
            <h2>{mode === "D30" ? "派生文本的命中与原图" : "最近邻与原始材料"}</h2>
            {!hits.length&&<p class="lab-note">当前没有命中。可换派生文本来源或查询，回查原图中是否有未被转写的细节。</p>}
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
                    {mode === "D30" ? <div><b>命中 {r.score} 个查询词项</b><p class="lab-note">{[...new Set(tokenize(this.query,"word"))].filter(t=>derivedText(r.item).includes(t)).map(t=><mark>{t} </mark>)}</p></div> : <div class="multimodal-score"><b>余弦 {r.score.toFixed(4)}</b><span class="similarity-meter" role="img" aria-label={`余弦${r.score.toFixed(4)}；固定尺度负1至1`}><i style={{left:`${50+Math.min(0,r.score)*50}%`,width:`${Math.abs(r.score)*50}%`}}/></span><small>−1 ← 0 → 1；越靠右越相近，不是准确率</small></div>}
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
        {this.demoId !== 'D00' && <process-explainer demoId={this.demoId} snapshot={{doc:this.doc(),text:this.text,normalized:this.normalized,config:this.config,query:this.query,qvector:this.queryVector,results:this.results,output:this.output,k1:this.k1,b:this.b,c:this.c,size:this.size,overlap:this.overlap,qrels:this.qrels,phase:this.phase,contextIds:this.contextIds,answer:this.answer,logs:this.logs,busy:this.busy,author:this.author,imageIndex:this.imageIndex,captionMode:this.captionMode,tool:this.tool,alpha:this.alpha,beta:this.beta,gamma:this.gamma}}/>}
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
        {[
          "D13",
          "D14",
          "D21",
          "D23",
          "D24",
          "D25",
          "D26",
          "D27",
          "D28",
          "D29",
          "D30",
        ].includes(this.demoId) ? (
          <>
            <div class="lab-toolbar">
              <button
                class={!this.modelView ? "selected" : ""}
                onClick={() => (this.modelView = false)}
              >
                步骤与原材料
              </button>
              <button
                class={this.modelView ? "selected" : ""}
                onClick={() => (this.modelView = true)}
              >
                模型实跑与示例
              </button>
            </div>
            {this.modelView ? (
              <model-experiment
                demoId={this.demoId}
                examplesOnly={["D13", "D24"].includes(this.demoId)}
              />
            ) : (
              body
            )}
          </>
        ) : (
          body
        )}
      </div>
    );
  }
}
