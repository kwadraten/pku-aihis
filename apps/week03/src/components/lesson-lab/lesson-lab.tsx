import { Fragment, Component, h, Prop, State, Listen, Element } from "@stencil/core";
import {
  state,
  loadCorpus,
  importCorpusFile,
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
  tfidfForTerm,
  metrics,
  chunks,
  rocchio,
  parseStopwords,
  filterStopwords,
} from "../../lib/math";
import { fulltext, vectorSearch, embed } from "../../lib/engines";
import { sourceLocation, sourceWebURL, localOriginalURL } from "../../lib/provenance";
import { evidenceMessages } from "../../lib/model-tasks";
import { explanations, regexPresets } from "../../lib/explanations";
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
  @Element() host: HTMLElement;
  private regexDiagramPattern: string | null = null;
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
  componentDidRender() {
    if (this.demoId === "D06") {
      this.updateRegexDiagram();
      this.syncRegexInputScroll();
    }
  }
  private updateRegexDiagram(force = false) {
    if (!force && this.regexDiagramPattern === this.query) return;
    const frame = this.host.querySelector<HTMLIFrameElement>(".regex-diagram");
    if (!frame?.contentWindow) return;
    this.regexDiagramPattern = this.query;
    frame.contentWindow.postMessage({ type: "regex-diagram", pattern: this.query, flags: "gu" }, location.origin);
  }
  private syncRegexInputScroll() {
    const input = this.host.querySelector<HTMLTextAreaElement>(".regex-input textarea");
    const mirror = this.host.querySelector<HTMLElement>(".regex-input-mirror");
    if (!input || !mirror) return;
    mirror.style.width = `${input.clientWidth}px`;
    mirror.scrollTop = input.scrollTop;
    mirror.scrollLeft = input.scrollLeft;
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
  @State() stopwords = "の、に、を、は、と、が";
  @State() dropStopwords = true;
  @State() c = 60;
  @State() qrels: any = {};
  @State() normalized = "";
  @State() sourceView: "form" | "json" = "form";
  @State() reviewSource = false;
  @State() chunkView: "chart" | "cards" = "chart";
  @State() tfidfShowAll = false;
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
  private d04BagVersion = -1;
  private d04Bags: Record<string, number>[] = [];
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
    this.reviewSource = false;
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
    this.d04BagVersion = -1;
    this.tfidfShowAll = false;
    this.message = `语料已更新：${state.docs.length}条。修改只在当前页面内存中生效；选择API运行时会发送选中的片段。`;
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
            {d.id} · {d.title} · {sourceLocation(d)}
          </option>
        ))}
      </select>
    );
  }
  private source(d = this.doc()) {
    return (
      d && (
        <div class="panel source-evidence" data-source-id={d.id}>
          <div class="source-line">{sourceLabel(d)}</div>
          <p class="source-line">片段编号：{d.id}</p>
          <span class="mode">{d.status || "工作转录待核"}</span>
          {d.date_note && <p class="source-line">{d.date_note}</p>}
          <div class="lab-toolbar">
            {sourceWebURL(d) && <a href={sourceWebURL(d)} target="_blank" rel="noreferrer">来源页面 ↗</a>}
            {localOriginalURL(d, location.hostname) && <a href={localOriginalURL(d, location.hostname)} target="_blank" rel="noreferrer">打开本地核验原件 ↗</a>}
          </div>
          {d.source_url_note && <p class="lab-note">{d.source_url_note}</p>}
          {d.text_file && <p class="source-line">转录定位：{d.text_file} · 字符 {d.start_char}–{d.end_char}（从 0 起，右端不含；Unicode 字符）</p>}
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
  private sourceRecord(d = this.doc()) {
    if (!d) return <p class="lab-note">当前没有可显示的来源记录。</p>;
    const fields = [
      { label: "片段编号", value: d.id },
      { label: "篇名", value: d.title },
      { label: "作者", value: d.author || "作者待核" },
      { label: "来源编号", value: d.source_id },
      { label: "页码／可靠定位", value: sourceLocation(d) },
      { label: "年份（原记录字段）", value: d.year },
      { label: "日期与版本说明", value: d.date_note, multiline: true },
      { label: "文本角色", value: d.text_role || d.role },
      { label: "核对状态", value: d.status, multiline: true },
      { label: "原始文件", value: d.source_file || d.raw_file },
      { label: "转录文件", value: d.text_file },
      { label: "转录字符区间", value: d.start_char != null && d.end_char != null ? `${d.start_char}–${d.end_char}（右端不含）` : "" },
      { label: "OCR方式", value: d.ocr_engine },
      { label: "节录范围", value: d.selection, multiline: true },
      { label: "来源网址说明", value: d.source_url_note, multiline: true },
      { label: "向量状态", value: d.vector?.length ? `${d.vector.length}维，详见向量页` : "未附向量" },
    ].filter((f) => f.value !== undefined && f.value !== null && f.value !== "");
    const raw = { ...d, text: undefined, vector: d.vector ? `${d.vector.length}维，详见向量页` : undefined };
    return (
      <div class="source-record" data-source-id={d.id}>
        <div class="lab-toolbar source-view-switch" role="group" aria-label="来源记录显示方式">
          <button aria-pressed={this.sourceView === "form"} onClick={() => (this.sourceView = "form")}>表单</button>
          <button aria-pressed={this.sourceView === "json"} onClick={() => (this.sourceView = "json")}>JSON</button>
        </div>
        {this.sourceView === "form" ? (
          <div class="flow-field" role="group" aria-label="出处与处理记录表单">
            {fields.map((f) => (
              <label class="flow-field-row">
                <span>{f.label}</span>
                {f.multiline ? <textarea readOnly rows={3} value={String(f.value)} /> : <input readOnly value={String(f.value)} />}
              </label>
            ))}
            {sourceWebURL(d) && <a href={sourceWebURL(d)} target="_blank" rel="noreferrer">打开来源页面 ↗</a>}
            {localOriginalURL(d, location.hostname) && <a href={localOriginalURL(d, location.hostname)} target="_blank" rel="noreferrer">打开本地核验原件 ↗</a>}
          </div>
        ) : <pre class="source-json">{JSON.stringify(raw, null, 2)}</pre>}
      </div>
    );
  }
  private wordBags() {
    if (this.d04BagVersion !== state.version) {
      this.d04Bags = state.docs.map((doc) => count(tokenize(doc.text, "word")));
      this.d04BagVersion = state.version;
    }
    return this.d04Bags;
  }
  private list(hits = this.results) {
    return (
      <div>
        {hits.length > 0 && hits === this.results && ["D07", "D08", "D09", "D12", "D21"].includes(this.demoId) && (
          <details class="retrieval-source" open={this.reviewSource} onToggle={(e: any) => { this.reviewSource = e.target.open; }}>
            <summary>回查所选片段原文与出处：{this.doc()?.id}</summary>
            {this.source()}
          </details>
        )}
        {!hits.length && (
          <p class="lab-note">尚无命中。可修改查询，空结果也保留。</p>
        )}
        {hits.slice(0, 12).map((r, i) => {
          const d = state.docs.find((d) => d.id === r.id);
          return (
            d && (
              <div class="candidate-item"><button
                class={"result " + (d === this.doc() ? "selected" : "")}
                onClick={() => { this.select(d); this.reviewSource = true; }}
              >
                <strong>
                  {i + 1}. {d.title}
                </strong>
                <span class="tag">{r.score?.toFixed(4)}</span>
                <div class="source-line">
                  {d.id} · {sourceLocation(d)}
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
    await this.run(() => importCorpusFile(file));
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
    return <div><p class="ex-preview">{nodes}</p><p>命中 {this.output.matches.length} 处{this.output.truncated?'（达到300条显示上限）':''}。黄色是整个匹配；捕获组见第3列。</p>{this.output.matches.slice(0,8).map((m,i)=><div class="ex-capture"><b>#{i+1} {m.text || '空匹配'}</b><span> → {m.captures.length?m.captures.map((c,j)=>`$${j+1}=${c}`).join('；'):'没有捕获组'}</span></div>)}<h3>替换后的副本</h3><p class="ex-preview">{this.output.replacement_preview}</p></div>;
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
      this.message='已用更新后的完整查询向量重新检索；同页第4列可比较前后排名。';
    });
  }
  private async qvector() {
    if (!state.docs.some(d => d.vector?.length))
      throw Error("当前导入的是纯文本包；请在语料库管理中导入配套向量JSON，再运行向量、混合或近邻检索。");
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
      return this.flowShell([
        {
          title: "原页图像 · 当前片段",
          why: "保留一处原页图像供对照；转录和出处跟随同一片段编号。",
          body: (
            <div>
              {this.chooser()}
              <p class="source-line">当前片段：{d?.id || "待选择"} · {sourceLocation(d || {})}</p>
              {d?.image ? (
                <img class="page-image" src={d.image} alt={`${d.title}原页节录`} />
              ) : (
                <p class="lab-note">当前记录未附原页图像，可按来源定位回查原件。</p>
              )}
              <p class="lab-note">
                当前 {state.docs.length} 条 ·{" "}
                {state.local ? "本机导入" : "公开课堂节录"}
                。整卷语料请在顶部“语料库管理”中导入；本页用于对照原页、转录与出处。
              </p>
            </div>
          ),
        },
        {
          title: "OCR转录 · 转录文本与状态",
          why: "OCR把像素识别成字符，也会识错、漏行。",
          body: (
            <div>
              {d ? (
                <div class="panel">
                  <span class="mode">{d.status || "工作转录待核"}</span>
                  <p class="paper-text">{d.text}</p>
                </div>
              ) : (
                <p class="lab-note">尚无片段。</p>
              )}
              <p class="lab-note">
                正文、编注、转引分别记录；本条定位：{sourceLocation(d || {})}。可在右侧回查来源与本地核验原件。
              </p>
            </div>
          ),
        },
        {
          title: "片段编号 · 出处与处理记录",
          why: "表单与原始JSON呈现同一条记录，可直接切换核对字段。",
          body: this.sourceRecord(d),
        },
        {
          title: "出处回查 · 定位状态链",
          why: "从篇名、定位和片段编号回查文本；工作转录尚不是定本。",
          body: (
            <div>
              <div class="ex-runtime">
                <span>{d?.title}</span>
                <b>→</b>
                <span>{sourceLocation(d || {})}</span>
                <b>→</b>
                <span>片段 {d?.id}</span>
                <b>→</b>
                <span>{[...(this.text || "")].length}字符</span>
              </div>
              <p class="lab-note">
                片段编号连回篇名、来源定位与字符数；对照第1列图像检查转录，必要时再打开完整原件。
              </p>
            </div>
          ),
        },
      ]);
    if (id === "D02") {
      const before = [...(this.text || "")],
        after = [...this.normalized];
      const ruleExplanation = {
        NFC: "NFC 把规范等价的字符合成为标准形式，例如可组合的基字与附加符号；不会把全角字母一概折成半角。",
        NFKC: "NFKC 除规范等价外，还会折叠全角、圈号等兼容形式；检索可能更容易匹配，但版式差异可能丢失。",
        s2t: "s2t 使用 OpenCC-js 的 cn→tw 规则，把简体字词转换为繁体副本；它不负责日文旧字体通用转换。",
        t2s: "t2s 使用 OpenCC-js 的 tw→cn 规则，把繁体字词转换为简体副本；原记录仍保持不变。",
      }[this.config] || "选择规则，查看它如何处理当前文本的副本。";
      return this.flowShell([
        {
          title: "原文 · 待规范化输入",
          why: "全角、组合字符和兼容字符可能占不同码位。",
          body: (
            <div>
              {this.chooser()}
              <textarea
                aria-label="待规范化原文"
                rows={8}
                value={this.text}
                onInput={(e: any) => {this.text = e.target.value; this.output = null; this.normalized = "";}}
              />
            </div>
          ),
        },
        {
          title: "Unicode规范化与字形转换 · 规则配置",
          why: "选定一种规则，只处理原文副本；下方说明随当前规则改变。",
          body: (
            <div>
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
                <button onClick={() => this.normalize()}>选择副本 →</button>
              </div>
              <p class="lab-note">
                当前选择：{this.config}。{ruleExplanation} 点击「选择副本」后在右侧查看处理结果。
              </p>
            </div>
          ),
        },
        {
          title: "处理结果 · 副本文本",
          why: "当前规则只写入处理后的副本；原文仍保留在左侧。",
          body: (
            <div>
              <p class="paper-text">{this.normalized || "请点击「选择副本」生成当前规则的处理结果。"}</p>
              {this.output && <p class="source-line">已按 {this.output.rule} 生成副本：原文 {this.output.before} 字，副本 {this.output.after} 字。{this.output.offset_mapping}</p>}
              <p class="lab-note">
                原记录保持不变。没有跨度映射时，只返回片段和页，不能沿用旧字符偏移高亮。
              </p>
            </div>
          ),
        },
        {
          title: "保留对照 · 转换前后差异",
          why: "原文保留，转换结果另存；不要把处理后的字形当作原刊字形。",
          body: (
            <div>
              {this.normalized ? (
                <div>
                  <div>
                    <b>转换前</b>
                    <p class="ex-preview">
                      {before.map((c, i) => (
                        <span class={after[i] !== c ? "ex-changed" : ""}>{c}</span>
                      ))}
                    </p>
                  </div>
                  <div>
                    <b>转换后 · {this.config}</b>
                    <p class="ex-preview">
                      {after.map((c, i) => (
                        <span class={before[i] !== c ? "ex-changed" : ""}>{c}</span>
                      ))}
                    </p>
                    <small>
                      按字符位置标出不同；发生合并或长度变化后，后续高亮是位置差异，不能逐项理解成替换对应。
                    </small>
                  </div>
                </div>
              ) : (
                <p class="lab-note">
                  请点击「选择副本」；这里会按字符位置标出处理前后的差异。
                </p>
              )}
            </div>
          ),
        },
      ]);
    }
    if (id === "D03") {
      const stops = parseStopwords(this.stopwords),
        rawToks = tokenize(this.text, this.tokMode),
        filtered = filterStopwords(rawToks, stops, this.dropStopwords),
        toks = filtered.kept,
        removedUnique = [...new Set(filtered.removed)],
        len = [...this.text].length,
        pieces = chunks(
          this.text,
          this.size,
          Math.min(this.overlap, this.size - 1),
        );
      return this.flowShell([
        {
          title: "连续文字 · 文本输入",
          why: "检索器不能直接把整本书当一个词。",
          body: (
            <div>
              {this.chooser()}
              <textarea
                aria-label="待切分原文"
                rows={9}
                value={this.text}
                onInput={(e: any) => (this.text = e.target.value)}
              />
              <p class="lab-note">
                当前 {len} 字符；编辑原文后，右侧词项、区间图与块卡片实时重算。
              </p>
            </div>
          ),
        },
        {
          title: "停用词表",
          why: "停用词不能一概删除否定与称谓；先确认表内词在史料中的功能。",
          body: (
            <div>
              <textarea
                aria-label="停用词表，用空格、顿号或换行分隔"
                rows={6}
                value={this.stopwords}
                onInput={(e: any) => (this.stopwords = e.target.value)}
              />
              <label class="flow-check">
                <input
                  type="checkbox"
                  checked={this.dropStopwords}
                  onChange={(e: any) => (this.dropStopwords = e.target.checked)}
                />{" "}
                从词项中删除表内词
              </label>
              <p class="lab-note">
                原 {rawToks.length} 项 → 保留 {toks.length} 项，移除{" "}
                {filtered.removed.length} 项。匹配依赖分词方式：单字逐字命中，Intl词切分按词命中，连续双字只命中两字组合。
              </p>
              {this.dropStopwords && removedUnique.length > 0 && (
                <div>
                  <p class="lab-note">实际被移除的词项：</p>
                  {removedUnique.slice(0, 30).map((t) => (
                    <span class="chip removed">{t}</span>
                  ))}
                </div>
              )}
            </div>
          ),
        },
        {
          title: "分词面板与词项效果",
          why: "切分方式改变词项边界，右侧数量和词项随选择实时变化。",
          body: (
            <div>
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
              </div>
              <p class="lab-note">
                当前 {toks.length} 项，下示前 {Math.min(50, toks.length)} 项。
              </p>
              {toks.slice(0, 50).map((t) => (
                <span class="chip">{t}</span>
              ))}
            </div>
          ),
        },
        {
          title: "分块与重叠",
          why: "块长决定每次检索和生成能看到多少上下文；重叠减轻边界截断，也增加重复片段和索引体积。",
          body: (
            <div>
              <div class="controls">
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
              <p class="ex-formula">
                每次前进 = 块长 − 重叠 = {this.size} − {this.overlap} ={" "}
                {this.size - this.overlap} 字符；{len}字符 → {pieces.length}块
              </p>
              <div class="lab-toolbar flow-view-switch" role="group" aria-label="分块结果显示方式">
                <button aria-pressed={this.chunkView === "chart"} onClick={() => (this.chunkView = "chart")}>区间图</button>
                <button aria-pressed={this.chunkView === "cards"} onClick={() => (this.chunkView = "cards")}>分块结果</button>
              </div>
              {this.chunkView === "chart" ? <div>
              <svg
                viewBox={`0 0 700 ${Math.min(5, pieces.length) * 25 + 20}`}
                role="img"
                aria-label="实际切块区间与重叠"
              >
                <text x="0" y="14">
                  原文字符位置：0 → {len}
                </text>
                {pieces.slice(0, 5).map((p, i) => (
                  <g>
                    <rect
                      x={80 + (p.start / (len || 1)) * 580}
                      y={23 + i * 25}
                      width={((p.end - p.start) / (len || 1)) * 580}
                      height="16"
                      fill="#cad8f4"
                    />
                    {i > 0 && (
                      <rect
                        x={80 + (p.start / (len || 1)) * 580}
                        y={23 + i * 25}
                        width={
                          (Math.min(this.overlap, p.end - p.start) /
                            (len || 1)) *
                          580
                        }
                        height="16"
                        fill="#b05618"
                      />
                    )}
                    <text x="0" y={35 + i * 25}>
                      {p.start}–{p.end}
                    </text>
                  </g>
                ))}
              </svg>
              <small>
                蓝色为完整块，橙色为与上一块重复的部分；仅画前5块，区间右端不含。
              </small>
              </div> : <div>
              <h2>{pieces.length} 个块 · 保留同一来源</h2>
              {pieces.map((p) => (
                <div class="evidence-card">
                  <div class="source-line">
                    字符 {p.start}—{p.end} · {sourceLocation(d)}
                  </div>
                  <p>{p.text}</p>
                </div>
              ))}
              </div>}
            </div>
          ),
        },
      ]);
    }
    if (id === "D04") {
      const docs = [d, ...state.docs.filter((x) => x.id !== d.id).slice(0, 2)],
        allBags = this.wordBags(),
        bags = docs.map((x) => allBags[state.docs.indexOf(x)]),
        terms = Object.keys(bags[0]).slice(0, 14);
      return this.flowShell([
        {
          title: "选词",
          why: "词表是一排固定格子。",
          body: (
            <div>
              {this.chooser()}
              <p class="lab-note">
                one-hot：一个词占一个位置；词袋：按位置累加次数；TF-IDF：再乘集合中的区分权重。
              </p>
              <div class="panel">
                {terms.map((t, i) => (
                  <button
                    class="chip"
                    onClick={() => {
                      this.tfidfShowAll = false;
                      this.output = {
                        word: t,
                        terms,
                        documents: docs.map(d=>d.id),
                        one_hot: terms.map((_, j) => (j === i ? 1 : 0)),
                        counts: bags.map((x) => x[t] || 0),
                        ...tfidfForTerm(state.docs, allBags, t),
                      };
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {this.output && <details><summary>查看词项与向量原始数据</summary><pre>{JSON.stringify(this.output, null, 2)}</pre></details>}
            </div>
          ),
        },
        {
          title: "是否出现 · one-hot位置",
          why: "One-hot只选一个词的位置；文档多热表示可亮多个格。",
          body: (
            <div>
              {this.output ? (
                <div class="ex-runtime">
                  {this.output.one_hot.map((v, i) => (
                    <span class={v ? "done" : ""}>
                      <small>{this.output.terms?.[i]}</small>
                      <br />
                      <b>{v}</b>
                    </span>
                  ))}
                </div>
              ) : (
                <p class="lab-note">点击左列任一词，这里亮出它在词表中的唯一位置。</p>
              )}
              <small>这个词只占一格；换一个词，亮格随之移动到另一个位置。</small>
            </div>
          ),
        },
        {
          title: "计数 · 三篇词袋次数",
          why: "词袋把词序丢掉，只留下各词次数。",
          body: (
            <div>
              {this.output ? (
                this.flowBars(
                  this.output.counts.map((tf, i) => ({
                    label: this.output.documents?.[i] || `D${i + 1}`,
                    value: tf,
                    note: `出现${tf}次`,
                  })),
                )
              ) : (
                <p class="lab-note">点击左列任一词，这里显示它在三篇文档中的词袋次数。</p>
              )}
              <p>词袋不保存先后顺序。把句中词顺序交换，计数仍可能完全一样。</p>
            </div>
          ),
        },
        {
          title: "全库逆文档频率 · TF-IDF",
          why: "IDF和每条记录的TF-IDF均按当前载入的全部语料计算；删减语料后重新选词会重算。",
          body: (
            <div>
              {this.output ? (
                <div>
                  <p class="ex-formula">
                    词“{this.output.word}”：N={this.output.n}，df={this.output.df}；IDF = ln((1+N)/(1+df))+1 = {this.output.idf.toFixed(3)}；每条 TF-IDF = 该条词频 × IDF。
                  </p>
                  {this.flowBars(
                    this.output.rows.slice(0, 8).map((row) => ({
                      label: row.id,
                      value: row.value,
                      note: `${row.tf}次 × ${this.output.idf.toFixed(3)}`,
                    })),
                  )}
                  <p class="lab-note">当前语料 {this.output.n} 条中，{this.output.df} 条含该词；按 TF-IDF 从高到低显示命中记录，零分记录未列出。这里使用 Intl 词切分后的次数，不做文长归一化。</p>
                  <table class="flow-table">
                    <thead><tr><th>记录</th><th>词频</th><th>TF-IDF</th></tr></thead>
                    <tbody>
                      {this.output.rows.slice(0, this.tfidfShowAll ? undefined : 12).map((row) => (
                        <tr><td>{row.id} · {row.title}</td><td>{row.tf}</td><td>{row.value.toFixed(3)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  {this.output.rows.length > 12 && <button onClick={() => (this.tfidfShowAll = !this.tfidfShowAll)}>{this.tfidfShowAll ? "只看前12条" : `查看全部${this.output.rows.length}条命中`}</button>}
                </div>
              ) : (
                <p class="lab-note">点击左列任一词，这里按当前载入的全部 {state.docs.length} 条记录计算IDF与每条TF-IDF。</p>
              )}
            </div>
          ),
        },
      ]);
    }
    if (id === "D05") {
      const tokens = tokenize(this.text, "word").slice(0, 16),
        center = Math.min(this.phase, tokens.length - 1),
        v = d.vector || [];
      return this.flowShell([
        {
          title: "预测训练任务",
          why: "CBOW由上下文猜中心词；Skip-gram由中心词猜上下文。本页只展示任务关系。",
          body: (
            <div>
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
            </div>
          ),
        },
        {
          title: "编码当前片段 · 稠密向量",
          why: "本列384维是MiniLM实际编码；各维没有固定历史概念名称。",
          body: (
            <div>
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
            </div>
          ),
        },
        {
          title: "词表权重 · 神经稀疏表示",
          why: "此处采用OpenSearch多语言稀疏编码器，按词表输出模型权重，允许扩展原文没有的词项。",
          body: (
            <div class="panel">
              <button onClick={() => (this.sparseOpen = !this.sparseOpen)}>看神经稀疏表示</button>
              {this.sparse && (
                <p class="lab-note">
                  SPLADE式稀疏聚合机制的多语言实现 · {this.sparse.model} · {(this.sparse.parameters/1e6).toFixed(1)}M参数 · {this.sparse.vocabulary_size}维词表。文档权重由本机模型预计算，未用手工数值；剪枝与点积在页面实时计算。
                </p>
              )}
            </div>
          ),
        },
        {
          title: "剪枝保留 · 阈值与点积",
          why: "提高阈值会删除小权重；留下的词项参与稀疏点积。模型权重不是出现次数。",
          body: (
            <div>
              {this.sparseOpen ? (
                this.sparseView()
              ) : (
                <p class="lab-note">
                  点击左列「看神经稀疏表示」，在这里展开当前片段的词表权重；调节剪枝比例，观察扩展词项是否被删去。
                </p>
              )}
            </div>
          ),
        },
      ]);
    }
    return null;
  }
  @State() geoSandbox = false;
  @State() geoAngle = 35;
  @State() geoMagnitude = 1;
  private flowGeometryParts() {
    const q = this.queryVector,
      d = this.doc()?.vector;
    let cos: number, a: number, b: number;
    if (this.geoSandbox) {
      cos = Math.cos((this.geoAngle * Math.PI) / 180);
      a = 1;
      b = this.geoMagnitude;
    } else if (q?.length && d?.length === q.length) {
      cos = Math.max(-1, Math.min(1, cosine(q, d)));
      a = Math.sqrt(q.reduce((s, x) => s + x * x, 0));
      b = Math.sqrt(d.reduce((s, x) => s + x * x, 0));
    } else
      return {
        svg: (
          <p>
            先运行一次精确余弦或EdgeVec，再点击候选；图形将读取该查询和该片段的完整向量。也可先打开几何沙盘。
          </p>
        ),
        math: null,
      };
    const fmt = (x: number, digits = 3) =>
        Number.isFinite(x) ? x.toFixed(digits) : "—",
      dot = a * b * cos,
      dist2 = a * a + b * b - 2 * dot,
      scale = 90 / Math.max(a, b, 1),
      ox = 135,
      oy = 145,
      x = ox + b * cos * scale,
      y = oy - b * Math.sqrt(Math.max(0, 1 - cos * cos)) * scale;
    return {
      svg: (
        <svg
          viewBox="0 0 340 180"
          role="img"
          aria-label="由完整向量夹角和长度构造的二维几何图"
        >
          <line x1="15" x2="325" y1={oy} y2={oy} stroke="#d8d6cd" />
          <line x1={ox} x2={ox} y1="12" y2="168" stroke="#d8d6cd" />
          <line
            x1={ox}
            y1={oy}
            x2={ox + a * scale}
            y2={oy}
            stroke="#164ec7"
            stroke-width="4"
          />
          <circle cx={ox + a * scale} cy={oy} r="5" fill="#164ec7" />
          <text x={ox + a * scale - 25} y={oy + 22}>
            查询 q
          </text>
          <line x1={ox} y1={oy} x2={x} y2={y} stroke="#b05618" stroke-width="4" />
          <circle cx={x} cy={y} r="5" fill="#b05618" />
          <text x={x + 6} y={Math.max(14, y - 6)}>
            文档 d
          </text>
          <line
            x1={x}
            y1={y}
            x2={ox + a * scale}
            y2={oy}
            stroke="#647269"
            stroke-width="2"
            stroke-dasharray="5 4"
          />
          <text x="12" y="22">
            夹角 {fmt((Math.acos(cos) * 180) / Math.PI, 1)}°
          </text>
          <text x="12" y="44">
            虚线 = 两端距离
          </text>
        </svg>
      ),
      math: (
        <div>
          <div class="ex-formula">点积 q·d = |q| × |d| × cosθ = {fmt(dot)}</div>
          <div class="ex-formula">余弦 = (q·d) / (|q| |d|) = {fmt(cos)}</div>
          <div class="ex-formula">
            L2 = √(|q|² + |d|² − 2q·d) = {fmt(Math.sqrt(Math.max(0, dist2)))}
          </div>
          <p>
            L2² = {fmt(dist2)}；|q| = {fmt(a)}，|d| = {fmt(b)}。
            {this.geoSandbox
              ? "只拉长d时，余弦不变；点积还取决于长度（垂直时始终为0），L2看两端相距多远。"
              : "本库向量已归一化；cos越大与L2²越小给出同一排序。"}
          </p>
          <small>
            {this.geoSandbox
              ? "可调几何构造：用于分离夹角和长度的影响，不是史料模型的新输出。"
              : `当前${q.length}维向量的长度与夹角构成此平面，未用前两维冒充整体，也不是全库降维图。`}
          </small>
        </div>
      ),
    };
  }
  private regexInputNodes() {
    if (!this.output?.matches) return this.text;
    const nodes = [];
    let at = 0;
    for (const m of this.output.matches) {
      nodes.push(this.text.slice(at, m.index));
      if (m.text) nodes.push(<mark>{m.text}</mark>);
      at = m.index + m.text.length;
    }
    nodes.push(this.text.slice(at));
    return nodes;
  }
  private regexMatchView() {
    if (!this.output?.matches)
      return <p>点击“运行匹配与替换”后，命中处会直接在输入框内高亮。</p>;
    return <div>
      <p>命中 {this.output.matches.length} 处{this.output.truncated ? "（达到300条显示上限）" : ""}。黄色是整个匹配。</p>
      {!this.output.matches.length && <p>命中 0 处：当前表达式没有匹配到原文。检查方括号、转义与全半角写法。</p>}
    </div>;
  }
  private regexCaptureView() {
    if (!this.output?.matches)
      return <p>运行匹配后，这里逐条列出每个匹配保存的捕获组。</p>;
    if (!this.output.matches.length) return <p>命中 0 处，没有可列出的捕获组。</p>;
    return (
      <div>
        {this.output.matches.slice(0, 8).map((m, i) => (
          <div class="ex-capture">
            <b>
              #{i + 1} {m.text || "空匹配"}
            </b>
            <span>
              {" → "}
              {m.captures.length
                ? m.captures.map((c, j) => `$${j + 1}=${c}`).join("；")
                : "没有捕获组"}
            </span>
          </div>
        ))}
      </div>
    );
  }
  private regexReplaceView() {
    if (!this.output?.matches)
      return <p>运行匹配后，这里显示替换后的副本预览。</p>;
    return (
      <div>
        <p class="ex-preview">{this.output.replacement_spans?.map((part) => part.changed ? <mark>{part.text || "∅"}</mark> : part.text) || this.output.replacement_preview}</p>
        {!this.output.matches.length && <p>命中 0 处，副本与原文一致。</p>}
      </div>
    );
  }
  private retrieval() {
    const id = this.demoId;
    if (id === "D06")
      return <div class="regex-lab">
        <div class="regex-intro">
          <h2>字符规则工作台</h2>
          <p>布尔 AND／OR／NOT 组合检索条件；这里用正则表达式逐处匹配字符结构，并预览替换后的副本。</p>
        </div>
        <div class="regex-controls">
          <label>表达式范例
            <select aria-label="正则预设" ref={el=>{if(el)el.value=String(this.regexIndex)}} onChange={(e:any)=>this.useRegex(+e.target.value)}>
              {regexPresets.map((p,i)=><option value={i}>{p.name}</option>)}
            </select>
          </label>
          <label>匹配什么
            <input aria-label="正则表达式" maxLength={500} value={this.query} onInput={(e:any)=>{this.query=e.target.value;this.output=null;}} />
          </label>
          <label>替换什么
            <input aria-label="替换表达式" value={this.replacement} onInput={(e:any)=>{this.replacement=e.target.value;this.output=null;}} />
          </label>
          <button disabled={this.busy} onClick={()=>this.regex()}>运行匹配与替换</button>
        </div>
        <div class="lab-toolbar">
          <button onClick={()=>this.useRegex((this.regexIndex+1+Math.floor(Math.random()*(regexPresets.length-1)))%regexPresets.length)}>随机换一个范例</button>
          <button onClick={()=>navigator.clipboard.writeText(this.query).then(()=>this.message='已复制当前表达式').catch(()=>this.message='复制未获浏览器允许；可选中文本框手动复制')}>复制当前表达式</button>
        </div>
        <p class="regex-rule-note">{regexPresets[this.regexIndex].pattern===this.query?regexPresets[this.regexIndex].why:"当前是自定义表达式；图示随规则变化。"} <span class="mode">JavaScript /gu · 浏览器实时</span></p>
        <div class="regex-display-grid">
          <section class="regex-panel">
            <h3>输入内容 <small>黄色＝匹配处</small></h3>
            {this.chooser()}
            <div class="regex-input">
              <div class="regex-input-mirror" aria-hidden="true">{this.regexInputNodes()}</div>
              <textarea value={this.text} aria-label="正则测试原文" onInput={(e:any)=>{this.text=e.target.value;this.output=null;}} onScroll={()=>this.syncRegexInputScroll()} />
            </div>
            {this.regexMatchView()}
          </section>
          <section class="regex-panel">
            <h3>匹配示意图 <small>表达式结构</small></h3>
            <iframe class="regex-diagram" title="正则表达式结构图" src="assets/regex-diagram.html" onLoad={()=>this.updateRegexDiagram(true)} />
            <p class="lab-note">图示使用 <a href="https://github.com/CJex/regulex" target="_blank" rel="noreferrer">Regulex</a>；参考 <a href="https://lzltool.cn/RegexVisualizer" target="_blank" rel="noreferrer">LZL工具页面</a>。匹配由独立的 JavaScript /gu 引擎执行；旧版图示器不支持的语法会明确提示，不影响匹配。</p>
            {this.regexCaptureView()}
          </section>
          <section class="regex-panel">
            <h3>输出内容 <small>黄色＝替换处</small></h3>
            {this.regexReplaceView()}
            <p class="lab-note">替换只生成副本，不改动左侧原文。未设捕获组时不要使用 $1。</p>
          </section>
        </div>
      </div>;
    if (id === "D07") {
      const fmt = (x: number, digits = 3) =>
          Number.isFinite(x) ? x.toFixed(digits) : "—",
        r = this.results.find((x) => x.id === this.doc()?.id),
        p = r?.parts?.find((x) => x.tf > 0),
        len = r ? r.length / (r.avg || 1) : 1,
        curve = (tf: number, k1 = this.k1, b = this.b) =>
          (p.idf * tf * (k1 + 1)) / (tf + k1 * (1 - b + b * len)),
        ymax = p ? Math.max(p.idf * 4, 0.001) : 1,
        xmax = p ? Math.max(12, p.tf + 2) : 12,
        pts = (k1: number, b: number) =>
          Array.from({ length: 81 }, (_, i) => {
            const tf = (i * xmax) / 80;
            return `${38 + (tf / xmax) * 270},${135 - (curve(tf, k1, b) / ymax) * 110}`;
          }).join(" ");
      return this.flowShell([
        {
          title: "查询与命中",
          why: "没有命中的词项贡献为0。",
          body: (
            <div>
              <span class="mode">浏览器实时计算 · 教学BM25</span>
              {this.querybar(
                <button
                  disabled={this.busy || !this.query}
                  onClick={() => this.search()}
                >
                  BM25排序
                </button>,
              )}
              {this.list()}
            </div>
          ),
        },
        {
          title: "IDF 与得分明细",
          why: "IDF衡量词项在当前库中有多稀少。",
          body: (
            <div>
              {!r && (
                <p>运行BM25并点击一个命中项，这里分解每个查询词项的稀有度与贡献。</p>
              )}
              {r && (
                <div>
                  <p class="ex-formula">
                    总分 {fmt(r.score)} = Σ 各词项贡献（{r.parts.map((x) => x.term).join("、")}）
                  </p>
                  {this.flowBars(
                    r.parts.map((x) => ({
                      label: x.term,
                      value: x.value,
                      note: `IDF ${fmt(x.idf)} × tf ${x.tf}（df ${x.df}）`,
                    })),
                  )}
                  <p class="lab-note">
                    只列查询词项；未命中词项贡献为0，不显示为条。选中项 {r.id} ·
                    本段词项数 L={r.length} · 库均 avgL={fmt(r.avg, 1)}。
                  </p>
                  <details>
                    <summary>选中项原始分值数据</summary>
                    <pre>{JSON.stringify(r, null, 2)}</pre>
                  </details>
                </div>
              )}
            </div>
          ),
        },
        {
          title: "词频饱和",
          why: "k1决定饱和的快慢；k1小，第一次命中就占较大比重。",
          body: (
            <div>
              <div class="controls">
                <label>
                  k1 = {this.k1}{" "}
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
              </div>
              {p ? (
                <div>
                  <svg
                    viewBox="0 0 340 173"
                    role="img"
                    aria-label="当前词项的BM25词频饱和曲线"
                  >
                    <line x1="38" y1="135" x2="315" y2="135" stroke="#999" />
                    <line x1="38" y1="135" x2="38" y2="20" stroke="#999" />
                    <polyline
                      points={pts(1.2, 0.75)}
                      fill="none"
                      stroke="#888"
                      stroke-dasharray="5 4"
                      stroke-width="2"
                    />
                    <polyline
                      points={pts(this.k1, this.b)}
                      fill="none"
                      stroke="#164ec7"
                      stroke-width="3"
                    />
                    <circle
                      cx={38 + (p.tf / xmax) * 270}
                      cy={135 - (curve(p.tf) / ymax) * 110}
                      r="6"
                      fill="#b05618"
                    />
                    <text x="42" y="16">
                      词项“{p.term}”的分数贡献
                    </text>
                    <text x="0" y="28">{fmt(ymax, 1)}</text>
                    <text x="20" y="139">0</text>
                    <text x="100" y="166">词频 tf →（0至{xmax}）</text>
                    <text x="42" y="151">橙点：当前 tf={p.tf}</text>
                  </svg>
                  <small>
                    蓝线：当前参数；灰虚线：k1=1.2、b=0.75。纵轴固定，便于看出分数变化。
                  </small>
                </div>
              ) : (
                <p>先运行BM25，再选择命中项。曲线将以当前片段的长度和第一个命中词项计算。</p>
              )}
              <p class="lab-note">k1越小，曲线越早变平：多重复几次的额外收益越小。</p>
            </div>
          ),
        },
        {
          title: "长度校正",
          why: "b=0不校正长度；b=1充分按相对长度校正，同词频的长文会受更大惩罚。",
          body: (
            <div>
              <div class="controls">
                <label>
                  b = {this.b}{" "}
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
              </div>
              {p && r ? (
                <div>
                  <div class="ex-formula">
                    IDF × tf(k1+1) / [tf + k1(1−b+b·L/avgL)]
                  </div>
                  <p>
                    {fmt(p.idf)} × {p.tf} × ({fmt(this.k1, 1)}+1) / [{p.tf}+
                    {fmt(this.k1, 1)}×(1−{fmt(this.b, 2)}+{fmt(this.b, 2)}×
                    {r.length}/{fmt(r.avg, 1)})] = <b>{fmt(p.value)}</b>
                  </p>
                  <p>
                    tf是这个词出现几次，L是本段词项数，avgL是库内平均词项数。长度比
                    L/avgL={fmt(len, 2)}：
                    {len > 1
                      ? "本段比平均更长；增大b会加大长度惩罚。"
                      : len < 1
                        ? "本段比平均更短；增大b会给予短段更多补偿。"
                        : "本段恰好等于平均长度，改变b对这一段没有影响。"}
                  </p>
                  <p>下面把各个命中词的贡献相加，才得到本段总分。</p>
                  {this.flowBars(
                    r.parts.map((x) => ({ label: x.term, value: x.value })),
                  )}
                </div>
              ) : (
                <p>先运行BM25，再选择命中项；这里显示公式代入、长度比与各词贡献。</p>
              )}
              <p class="lab-note">
                教学BM25：Lucene
                IDF＋含(k1+1)的教材词频项；不是Lucene原始分值逐位复现。默认连续双字词项。
              </p>
            </div>
          ),
        },
      ]);
    }
    if (id === "D08") {
      const geo = this.flowGeometryParts();
      return this.flowShell([
        {
          title: "同一模型编码",
          why: "查询与文档必须使用同一兼容编码配置。",
          body: (
            <div>
              {this.preset()}
              <span class="mode">
                {this.queryVector.length
                  ? `查询向量 ${this.queryVector.length}维 · 与文档同一配置`
                  : "选择查询并运行精确余弦"}
              </span>
              {this.querybar(
                <>
                  <button
                    disabled={this.busy || !this.query}
                    onClick={() => this.search("vector")}
                  >
                    精确余弦
                  </button>
                  <button
                    disabled={this.busy || !this.query}
                    onClick={() => this.search("edgevec")}
                  >
                    运行EdgeVec
                  </button>
                </>,
              )}
              <p class="lab-note">
                已存查询无需模型下载；自由输入会加载同一模型。余弦越大越近；EdgeVec采用单位向量的L2平方距离，越小越近。近似结果不是库内部路径可视化。
              </p>
              <details>
                <summary>嵌入模型与配置</summary>
                <pre>{JSON.stringify(state.manifest.embedding, null, 2)}</pre>
              </details>
            </div>
          ),
        },
        {
          title: "几何对照",
          why: "点积同时受夹角和长度影响。",
          body: (
            <div>
              <div class="lab-toolbar">
                <button
                  class={!this.geoSandbox ? "selected" : ""}
                  onClick={() => (this.geoSandbox = false)}
                >
                  当前查询与所选片段
                </button>
                <button
                  class={this.geoSandbox ? "selected" : ""}
                  onClick={() => (this.geoSandbox = true)}
                >
                  可调几何沙盘
                </button>
                {this.geoSandbox && (
                  <>
                    <label>
                      夹角 {this.geoAngle}°{" "}
                      <input
                        aria-label="几何夹角"
                        type="range"
                        min="0"
                        max="180"
                        value={this.geoAngle}
                        onInput={(e: any) => (this.geoAngle = +e.target.value)}
                      />
                    </label>
                    <label>
                      文档向量长度 {this.geoMagnitude}{" "}
                      <input
                        aria-label="几何长度"
                        type="range"
                        min="0.2"
                        max="2"
                        step="0.1"
                        value={this.geoMagnitude}
                        onInput={(e: any) => (this.geoMagnitude = +e.target.value)}
                      />
                    </label>
                  </>
                )}
              </div>
              {geo.svg}
            </div>
          ),
        },
        {
          title: "三种度量",
          why: "余弦只比较方向；L2比较端点距离。归一化后长度都为1。",
          body: (
            <div>
              {geo.math || (
                <p>运行一次检索后，这里代入点积、余弦与L2的当前数值。</p>
              )}
              <p class="lab-note">
                单位向量满足L2²=2−2cos。HNSW用分层邻接图减少比较；M影响连接数，efConstruction影响建图探索，efSearch影响保留候选规模，不等于访问点数。本页不把数据库未暴露的访问量画成实测轨迹。
              </p>
            </div>
          ),
        },
        {
          title: "候选排序",
          why: "单位向量满足L2²=2−2cos，所以两者排序等价；分值不是相关概率。",
          body: (
            <div>
              {this.list()}
              {this.output?.exact && (
                <p class="ex-callout">
                  EdgeVec前5项与精确前5项重合 {this.output.overlap}/5。精确排序为{" "}
                  {this.output.exact.slice(0, 5).map((x) => x.id).join(" → ")}
                  。这是本次结果比较，不是内部访问轨迹。
                </p>
              )}
            </div>
          ),
        },
      ]);
    }
    if (id === "D09") {
      const fmt = (x: number, digits = 3) =>
          Number.isFinite(x) ? x.toFixed(digits) : "—",
        top = this.results.slice(0, 3),
        max = top.length
          ? Math.max(
              ...top.flatMap((r) => [r.parts?.[0] || 0, r.parts?.[1] || 0]),
              0.0001,
            )
          : 1;
      return this.flowShell([
        {
          title: "关键词候选",
          why: "BM25分数由词频、稀有程度、长度共同决定。",
          body: (
            <div>
              {this.preset()}
              <span class="mode">RRF实时融合 · 模型重排未运行</span>
              {this.querybar(
                <button
                  disabled={this.busy || !this.query}
                  onClick={() => this.search("rrf")}
                >
                  混合检索
                </button>,
              )}
              {!this.output?.bm25 && (
                <p class="lab-note">
                  尚未运行混合检索；运行后这里显示BM25一路的候选与名次。
                </p>
              )}
              {this.list(this.output?.bm25 || [])}
            </div>
          ),
        },
        {
          title: "向量候选",
          why: "向量分数衡量表示空间的接近程度。",
          body: (
            <div>
              {!this.output?.vector && (
                <p class="lab-note">
                  尚未运行混合检索；运行后这里显示向量一路的候选与名次。余弦越大越近。
                </p>
              )}
              {this.list(this.output?.vector || [])}
            </div>
          ),
        },
        {
          title: "倒数名次贡献",
          why: "RRF只读取名次：每路贡献1/(c+rank)，缺席贡献0。",
          body: (
            <div>
              <label>
                RRF c={this.c}{" "}
                <input
                  aria-label="RRF参数"
                  type="range"
                  min="1"
                  max="100"
                  value={this.c}
                  onInput={(e: any) => {
                    this.c = +e.target.value;
                    if (this.output?.bm25) {
                      this.results = rrf(
                        [this.output.bm25, this.output.vector],
                        this.c,
                      );
                      this.output = {
                        ...this.output,
                        fusion: this.results.slice(0, 6),
                        c: this.c,
                      };
                    }
                  }}
                />
              </label>
              <p class="ex-formula">
                RRF(d) = Σ 1/({this.c}+名次)；缺席一路记0，不把BM25与余弦原分数相加。
              </p>
              {top.length ? (
                top.map((r, i) => (
                  <div>
                    <b>
                      #{i + 1} {r.id}
                    </b>
                    {this.flowBars(
                      [0, 1].map((j) => ({
                        label: j ? "向量" : "关键词",
                        value: r.parts?.[j] || 0,
                        note: r.ranks?.[j]
                          ? `名次${r.ranks[j]} → 1/(${this.c}+${r.ranks[j]})`
                          : "未出现在这一路 → 贡献0",
                      })),
                      max,
                    )}
                    <strong>→ 合计 {fmt(r.score, 5)}</strong>
                  </div>
                ))
              ) : (
                <p>运行混合检索后，这里显示各文档在两路中的倒数名次贡献。</p>
              )}
              <p class="lab-note">
                各卡片使用同一横轴尺度。c越大，第一名与第二名的贡献差越小；重复出现于两路的文档可累计两份贡献。
              </p>
            </div>
          ),
        },
        {
          title: "求和排序",
          why: "c大时前后名次的差距变小；它不是语义模型重排。",
          body: (
            <div>
              {this.list()}
              {this.output?.reranker && (
                <p class="lab-note">{this.output.reranker}。</p>
              )}
              {this.output && (
                <details>
                  <summary>候选名次与融合贡献原始数据</summary>
                  <pre>{JSON.stringify(this.output, null, 2)}</pre>
                </details>
              )}
            </div>
          ),
        },
      ]);
    }
    if (id === "D11") {
      return this.flowShell([
        {
          title: "导入与建索引",
          why: "Lucivy在浏览器WASM中建立真实索引。",
          body: (
            <div>
              <span class="mode">Lucivy 4.3.0 · WASM</span>
              <div class="panel">
                <h3>导入语料（JSONL）</h3>
                <input
                  type="file"
                  accept=".json,.jsonl"
                  onChange={(e: any) => this.importFile(e.target.files[0])}
                />
                <p class="lab-note">
                  当前 {state.docs.length} 条 · {state.local ? "本机导入" : "公开课堂节录"}
                  。导入内容在本浏览器内处理，首次建立本机索引后查询。
                </p>
              </div>
              <p class="lab-note">
                跨源隔离：{String(crossOriginIsolated)}
                。无结果时不切换其他引擎冒充。导入语料见“语料库管理”。
              </p>
              {this.busy && <p class="lab-note">正在执行，请稍候…</p>}
              {this.message && <p class="lab-note">最近执行：{this.message}</p>}
            </div>
          ),
        },
        {
          title: "提交查询",
          why: "contains或Rust正则核对字面条件，不执行语义理解。",
          body: (
            <div>
              {this.querybar(
                <>
                  <button
                    disabled={this.busy || !this.query}
                    onClick={() => this.search("lucivy")}
                  >
                    全文命中
                  </button>
                  <button
                    disabled={this.busy || !this.query}
                    onClick={() => this.search("lucivy-regex")}
                  >
                    Rust正则
                  </button>
                </>,
              )}
              <p class="lab-note">
                “全文命中”按词项查询；“Rust正则”用索引支持的正则放宽字形，如
                宗[教敎]。先试字面词，再放宽字形，对照命中变化。
              </p>
            </div>
          ),
        },
        {
          title: "候选定位",
          why: "索引帮助定位可能满足条件的记录；内部访问路径本页没有记录。",
          body: (
            <div>
              {this.list()}
              <p class="ex-callout">
                本次查询“{this.query}” → Lucivy索引 → 当前返回
                {this.results?.length || 0}条。选中 {this.doc()?.id}
                ，核对右列原段。执行状态：
                {this.busy ? "进行中" : this.results?.length ? "已取得结果" : "尚无命中结果"}
                。
              </p>
            </div>
          ),
        },
        {
          title: "返回原段",
          why: "选中命中项回到完整片段，检查误命中。",
          body: <div>{this.source()}</div>,
        },
      ]);
    }
    if (id === "D12") {
      const geo = this.flowGeometryParts();
      return this.flowShell([
        {
          title: "向量建图",
          why: "HNSW把近邻连成多层图。M影响连接规模。",
          body: (
            <div>
              <span class="mode">EdgeVec 0.9.0 · WASM</span>
              <div class="panel">
                <h3>导入向量（JSONL）</h3>
                <input
                  type="file"
                  accept=".json,.jsonl"
                  onChange={(e: any) => this.importFile(e.target.files[0])}
                />
                <p class="lab-note">
                  当前 {state.docs.filter((d) => d.vector?.length).length} 条带向量 ·{" "}
                  {state.local ? "本机导入" : "公开课堂节录"}。导入内容在本浏览器内处理。
                </p>
              </div>
              <div class="controls">
                <label>
                  M（高层连接上限） = {this.hnswM}
                  <input
                    aria-label="hnswM"
                    type="range"
                    min="4"
                    max="32"
                    step="4"
                    value={this.hnswM}
                    disabled={this.busy}
                    onInput={(e: any) => {
                      this.hnswM = +e.target.value;
                      if (this.hnswBuild < this.hnswM)
                        this.hnswBuild = Math.ceil(this.hnswM / 10) * 10;
                      this.output = null;
                      this.results = [];
                    }}
                  />
                </label>
                <label>
                  efConstruction（建图探索） = {this.hnswBuild}
                  <input
                    aria-label="hnswBuild"
                    type="range"
                    min={String(Math.max(20, Math.ceil(this.hnswM / 10) * 10))}
                    max="200"
                    step="10"
                    value={this.hnswBuild}
                    disabled={this.busy}
                    onInput={(e: any) => {
                      this.hnswBuild = +e.target.value;
                      this.output = null;
                      this.results = [];
                    }}
                  />
                </label>
              </div>
              <p class="lab-note">
                调节后点击“运行EdgeVec”：本页按新配置重新建图，再查询。耗时包括建图，不是纯查询基准。M0取2M；建图探索规模至少覆盖M，增大M时会同步提高过小的建图值。小库前五名可能完全不变，参数改变不保证排名改变。
              </p>
            </div>
          ),
        },
        {
          title: "候选探索",
          why: "efConstruction影响建图探索；efSearch影响查询候选规模，都不是实际访问点数。",
          body: (
            <div>
              {this.preset()}
              <div class="controls">
                <label>
                  efSearch（查询候选规模） = {this.hnswSearch}
                  <input
                    aria-label="hnswSearch"
                    type="range"
                    min="20"
                    max="200"
                    step="10"
                    value={this.hnswSearch}
                    disabled={this.busy}
                    onInput={(e: any) => {
                      this.hnswSearch = +e.target.value;
                      this.output = null;
                      this.results = [];
                    }}
                  />
                </label>
              </div>
              {this.querybar(
                <button
                  disabled={this.busy || !this.query}
                  onClick={() => this.search("edgevec")}
                >
                  运行EdgeVec
                </button>,
              )}
              <p class="lab-note">
                已存查询无需模型下载；自由输入会加载同一模型。余弦越大越近；EdgeVec采用单位向量的L2平方距离，越小越近。近似结果不是库内部路径可视化。
              </p>
              <div class="lab-toolbar">
                <button
                  class={!this.geoSandbox ? "selected" : ""}
                  onClick={() => (this.geoSandbox = false)}
                >
                  当前查询与所选片段
                </button>
                <button
                  class={this.geoSandbox ? "selected" : ""}
                  onClick={() => (this.geoSandbox = true)}
                >
                  可调几何沙盘
                </button>
                {this.geoSandbox && (
                  <>
                    <label>
                      夹角 {this.geoAngle}°{" "}
                      <input
                        aria-label="几何夹角"
                        type="range"
                        min="0"
                        max="180"
                        value={this.geoAngle}
                        onInput={(e: any) => (this.geoAngle = +e.target.value)}
                      />
                    </label>
                    <label>
                      文档向量长度 {this.geoMagnitude}{" "}
                      <input
                        aria-label="几何长度"
                        type="range"
                        min="0.2"
                        max="2"
                        step="0.1"
                        value={this.geoMagnitude}
                        onInput={(e: any) => (this.geoMagnitude = +e.target.value)}
                      />
                    </label>
                  </>
                )}
              </div>
              {geo.svg}
            </div>
          ),
        },
        {
          title: "近似Top-K",
          why: "EdgeVec实际返回L2平方距离；本页不伪造内部走过的边。",
          body: (
            <div>
              {this.list()}
              {this.output?.hnsw && (
                <p class="lab-note">
                  本次建图参数 M={this.output.hnsw.m} · efConstruction=
                  {this.output.hnsw.efConstruction} · efSearch=
                  {this.output.hnsw.efSearch}。结果为真实 WASM 返回的 L2
                  平方距离，越小越近。
                </p>
              )}
            </div>
          ),
        },
        {
          title: "精确对照",
          why: "将近似Top-5与全库精确Top-5对照；小库相同不代表大库永远无遗漏。",
          body: (
            <div>
              {this.output?.exact ? (
                <div>
                  <p class="ex-callout">
                    EdgeVec前5项与精确前5项重合 {this.output.overlap}/5。精确排序为{" "}
                    {this.output.exact.slice(0, 5).map((x) => x.id).join(" → ")}
                    。这是本次结果比较，不是内部访问轨迹。
                  </p>
                  <b>近似 Top-5 · L2²（越小越近）</b>
                  {this.results.slice(0, 5).map((r, i) => (
                    <p>
                      #{i + 1} {r.id} · {r.score.toFixed(4)}
                    </p>
                  ))}
                  <b>精确 Top-5 · 余弦（越大越近）</b>
                  {this.output.exact.slice(0, 5).map((r, i) => (
                    <p>
                      #{i + 1} {r.id} · {r.score.toFixed(4)}
                    </p>
                  ))}
                </div>
              ) : (
                <p>运行EdgeVec后，这里对照近似Top-5与全库精确Top-5的交集与排序。</p>
              )}
            </div>
          ),
        },
      ]);
    }
    return null;
  }
  private evaluation() {
    const hits = this.results;
    const m = metrics(
      hits.map((x) => x.id),
      this.qrels,
      5,
    );
    const top = hits.slice(0, 5);
    return this.flowShell([
      {
        title: "待判断结果",
        why: "P@5只数前五项有几项相关。",
        body: (
          <div>
            {this.querybar(
              <button onClick={() => this.search()}>取得待判断结果</button>,
            )}
            <span class="mode">检索：实时教学BM25；指标随判断实时重算</span>
            {!top.length && (
              <p class="lab-note">
                取得待判断结果后，这里列出前5项及其判断状态。
              </p>
            )}
            {top.map((r, i) => {
              const d = state.docs.find((x) => x.id === r.id);
              const rel = this.qrels[r.id];
              return (
                <div class="result">
                  <strong>
                    #{i + 1} {r.id} · {d?.title}
                  </strong>{" "}
                  <span class={rel === undefined ? "chip removed" : "chip"}>
                    {rel === undefined ? "未判断" : `等级 ${rel}`}
                  </span>
                  <p>{d?.text.slice(0, 90)}</p>
                </div>
              );
            })}
          </div>
        ),
      },
      {
        title: "人工判断",
        why: "先明确问题，判断0/1/2级相关；未判断不等于确认不相关。",
        body: (
          <div>
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
          </div>
        ),
      },
      {
        title: "位置折扣",
        why: "DCG让靠前的相关结果贡献更大；增益为2^rel−1。",
        body: (
          <div>
            <p class="ex-formula">
              第 i 位贡献 = (2^rel − 1) / log₂(i + 2)；位置越后，分母越大，相同等级贡献越小。
            </p>
            {this.flowBars(
              top.map((r, i) => ({
                label: `#${i + 1} ${r.id}`,
                value: (2 ** (this.qrels[r.id] || 0) - 1) / Math.log2(i + 2),
                note: `等级${this.qrels[r.id] ?? "未判断"}：增益 / log₂(${i + 2})`,
              })),
            )}
            {!top.length && (
              <p>取得待判断结果后，这里显示每个位置的折扣贡献。</p>
            )}
          </div>
        ),
      },
      {
        title: "理想排序与指标",
        why: "nDCG=当前DCG/判断池的理想DCG；判断池不全时不能当最终质量。",
        body: (
          <div>
            <p class="ex-formula">
              P@5 = 前5项相关数 / 5 = {m.precision.toFixed(2)}
              <br />
              DCG = 各条贡献之和 = {m.dcg.toFixed(3)}
              <br />
              IDCG = 判断池理想顺序的DCG = {Number(m.ideal).toFixed(3)}
              <br />
              nDCG ={" "}
              {m.ndcg === null ? "分母为0，暂不可算" : m.ndcg.toFixed(3)}
            </p>
            <p class="lab-note">
              前5项未判断：{m.unjudged}。未完成全库判断，不报告全库真实召回率。
            </p>
            <p class="source-line">当前排序：{top.length ? top.map((x) => x.id).join(" → ") : "尚未检索"}。已判断 {Object.keys(this.qrels).length} / {state.docs.length} 条；增益按 2^rel−1 计算。</p>
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
          </div>
        ),
      },
    ]);
  }
  private flow() {
    const agent = this.demoId === "D24",
      proposals = this.logs.filter((e) => e.event === "model_proposal"),
      toolResults = this.logs.filter((e) => e.event === "tool_result"),
      lastEvent = this.logs.length
        ? this.logs[this.logs.length - 1].event
        : "",
      rail = agent
        ? this.answer || lastEvent === "stopped"
          ? { done: 4, active: 4 }
          : lastEvent === "tool_result" || lastEvent === "budget_exhausted"
            ? { done: 3, active: 3 }
            : lastEvent === "model_proposal"
              ? { done: 1, active: 1 }
              : lastEvent === "failed"
                ? { done: Math.min(this.phase, 4), active: Math.min(this.phase, 3) }
                : { done: 0, active: this.busy ? 0 : undefined }
        : { active: Math.min(this.phase, 3), done: this.phase },
      restart = () => {
        this.invalidateFlow();
        this.phase = 0;
        this.results = [];
        this.output = null;
        this.answer = "";
        this.logs = [];
        this.contextIds = [];
      },
      runButton = (
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
        </button>
      ),
      modeBadge = (
        <span class="mode">
          检索：实时教学BM25 · 生成：
          {this.answer
            ? `${this.responseMeta?.provider === "api" ? "API" : "本地"}实际响应 · ${this.responseMeta?.model}`
            : "尚未运行"}
        </span>
      ),
      modelPanel = (
        <div class="panel">
          <span class="mode">{this.modelName}</span>
          <button onClick={() => openModelSettings()}>
            设置本地模型／API Key
          </button>
          <p class="lab-note">
            本地模型不需Key；API接入可选DeepSeek等兼容服务。保存示例见本页顶部“模型实跑与示例”。
          </p>
        </div>
      ),
      controls = (
        <div>
          {runButton} <button onClick={restart}>重新开始本轮</button>
        </div>
      );
    if (agent)
      return this.flowShell(
        [
          {
            title: "模型给动作",
            why: "模型输出search/read/finish结构化动作；不是直接获得外界事实。",
            body: (
              <div>
                {this.querybar(controls)}
                <div class="ex-runtime" aria-live="polite">
                  <span
                    class={this.busy ? "running" : proposals.length ? "done" : ""}
                  >
                    模型提议 {proposals.length}次
                  </span>
                </div>
                {modeBadge}
                {modelPanel}
                <p class="lab-note">
                  每轮模型只输出一个结构化动作（search／read／finish），随后经过右侧三列的校验、执行与回传。
                </p>
              </div>
            ),
          },
          {
            title: "程序校验",
            why: "程序检查动作类型、参数与片段ID。",
            body: (
              <div>
                <p class="lab-note">
                  执行器按程序规则逐项检查，任何一步不通过即拒绝并记入日志：
                </p>
                <p class="lab-note">· 动作类型必须在获准列表 search / read / finish 内；</p>
                <p class="lab-note">· search 必须带 query 字符串；</p>
                <p class="lab-note">
                  · read 必须带存在的片段 id，且该 id 已被本轮 search 检索发现；
                </p>
                <p class="lab-note">
                  · finish 前必须已读取证据，回答须引用已读片段编号，引用未读材料会被拒绝。
                </p>
                {proposals.length > 0 && (
                  <p class="lab-note">
                    最近一次待校验动作：{proposals[proposals.length - 1].action.tool}
                    {proposals[proposals.length - 1].action.query
                      ? `（查询：${proposals[proposals.length - 1].action.query}）`
                      : proposals[proposals.length - 1].action.id
                        ? `（片段：${proposals[proposals.length - 1].action.id}）`
                        : ""}
                  </p>
                )}
                {lastEvent === "failed" && (
                  <p class="lab-note">
                    本轮被拒绝：{this.logs[this.logs.length - 1].error}
                  </p>
                )}
                <p class="lab-note">
                  模型选择工具才是模型驱动；程序预设步骤仍标为规则流程。
                </p>
              </div>
            ),
          },
          {
            title: "执行工具",
            why: "只有实际调用后的返回才算工具结果。",
            body: (
              <div>
                {toolResults.map((e) => (
                  <div class="result">
                    <strong>
                      {Number.isInteger(e.turn) ? `第${e.turn + 1}轮 · ` : ""}
                      {e.tool === "search" ? "search 检索" : "read 读取"}
                    </strong>
                    <p>
                      {e.tool === "search"
                        ? `检索到${e.result.length}条：${e.result.map((r) => r.id).join("、")}`
                        : `读到${e.result.id}的正文（${[...(e.result.text || "")].length}字符）`}
                    </p>
                  </div>
                ))}
                {!toolResults.length && (
                  <p class="lab-note">
                    运行后，每次实际工具返回按顺序列在这里；没有被实际调用的工具不产生结果。
                  </p>
                )}
              </div>
            ),
          },
          {
            title: "结果回模型",
            why: "下一轮根据已有观察继续；页面显示行动记录，不展示或伪造内部思维链。",
            body: (
              <div>
                <div class="ex-runtime" aria-live="polite">
                  <span class={this.busy ? "running" : ""}>
                    模型提议 {proposals.length}次
                  </span>
                  <b>→</b>
                  <span>实际工具返回 {toolResults.length}次</span>
                  <b>↺</b>
                  <span>
                    {this.answer
                      ? "已给出最终回答"
                      : this.busy
                        ? "正在等待下一次模型响应"
                        : "尚未完成回答"}
                  </span>
                </div>
                <ol class="ex-event-list">
                  {this.logs.map((e) => (
                    <li>
                      <b>
                        {Number.isInteger(e.turn) ? `第${e.turn + 1}轮 · ` : ""}
                        {({ model_proposal: "模型提出动作", tool_result: "工具实际返回", stopped: "执行器接受结束", budget_exhausted: "轮数用尽，停止", failed: "本轮失败" } as any)[e.event] || e.event}
                      </b>
                      {e.event === "model_proposal" && (
                        <span>
                          {" "}
                          → {e.action.tool}
                          {e.action.query
                            ? `（查询：${e.action.query}）`
                            : e.action.id
                              ? `（片段：${e.action.id}）`
                              : ""}
                        </span>
                      )}
                      {e.event === "tool_result" && (
                        <span>
                          {" "}
                          →{" "}
                          {e.tool === "search"
                            ? `检索到${e.result.length}条：${e.result.map((r) => r.id).join("、")}`
                            : `读到${e.result.id}的正文（${[...(e.result.text || "")].length}字符）`}
                        </span>
                      )}
                      {e.event === "failed" && <span> → {e.error}</span>}
                    </li>
                  ))}
                </ol>
                {!this.logs.length && (
                  <p>运行后，每一条实际动作和返回会按顺序排在这里。</p>
                )}
                <p class="model-answer">
                  {this.answer ||
                    "尚无最终回答。模型需读取证据、给出带已读ID引用的回答后，执行器才接受结束。"}
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
                <small>
                  此时间线来自实际事件日志。它展示程序与工具做了什么，不是模型内部思维链。
                </small>
              </div>
            ),
          },
        ],
        rail,
      );
    return this.flowShell(
      [
        {
          title: "检索候选",
          why: "先查找与问题有关的片段。",
          body: (
            <div>
              {this.querybar(controls)}
              <div class="ex-runtime" aria-live="polite">
                <span class={this.phase >= 1 ? "done" : ""}>
                  候选 {this.results.length}
                </span>
                <b>→</b>
                <span class={this.phase >= 2 ? "done" : ""}>
                  选择 {this.contextIds.length}片段
                </span>
                <b>→</b>
                <span class={this.phase >= 3 ? "done" : ""}>
                  请求 {this.output?.messages?.length || 0}消息
                </span>
                <b>→</b>
                <span class={this.answer ? "done" : this.busy ? "running" : ""}>
                  {this.answer ? "已返回回答" : this.busy ? "正在执行" : "待生成"}
                </span>
              </div>
              <small>
                本行是当前页面状态；各列下方记录对应环节的中间结果。动画只表示等待，不表示模型内部推理路径。
              </small>
              {modeBadge}
              {modelPanel}
              {this.results.slice(0, 8).map((r, i) => {
                const d = state.docs.find((d) => d.id === r.id);
                return (
                  d && (
                    <div class="result">
                      <strong>
                        {i + 1}. {r.id} · {d.title}
                      </strong>
                      <p>{d.text.slice(0, 110)}</p>
                    </div>
                  )
                );
              })}
              {!this.results.length && (
                <p class="lab-note">
                  尚无候选。输入问题后点击「1 检索」，空结果也保留。
                </p>
              )}
            </div>
          ),
        },
        {
          title: "选择上下文",
          why: "只有勾选片段进入上下文；候选不等于模型已读。",
          body: (
            <div>
              {this.results.slice(0, 8).map((r, i) => {
                const d = state.docs.find((d) => d.id === r.id);
                return (
                  d && (
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
                      {i + 1}. {r.id} · {d.title}
                      <p>{d.text.slice(0, 110)}</p>
                    </label>
                  )
                );
              })}
              {!this.results.length && (
                <p class="lab-note">
                  候选列出后，在这里勾选真正进入上下文的片段。
                </p>
              )}
              <p class="lab-note">已勾选 {this.contextIds.length} 条，进入本轮请求。</p>
            </div>
          ),
        },
        {
          title: "组装请求",
          why: "请求同时包含问题、片段编号和引用要求。",
          body: (
            <div>
              {this.output && (
                <details open>
                  <summary>实际请求</summary>
                  <pre>{JSON.stringify(this.output, null, 2)}</pre>
                </details>
              )}
              {!this.output && (
                <p class="lab-note">
                  确认上下文后点击「3 构建请求」，这里显示实际发送的 messages JSON。
                </p>
              )}
            </div>
          ),
        },
        {
          title: "生成并核对",
          why: "模型给出答案后逐条核对引用；有编号仍可能理解错。",
          body: (
            <div>
              {this.responseMeta?.citation_check && <p class="application-caution citation-status" role="status">
                {this.responseMeta.citation_check.missing_ids ? '引用核验未通过：回答没有引用本轮材料编号。' :
                  this.responseMeta.citation_check.unknown_ids.length ? `引用核验未通过：${this.responseMeta.citation_check.unknown_ids.join('、')} 不在本轮材料中。` :
                  '引用编号与本轮材料匹配；请继续核对原文是否支持回答，编号匹配不等于结论正确。'}
              </p>}
              <p class="model-answer">
                {this.answer ||
                  "尚无生成答案。可以先查看检索和实际选入的上下文。"}
              </p>
              {this.contextIds.length > 0 && <div class="panel">
                <h3>回查本轮引用材料</h3>
                <div class="lab-toolbar">{this.contextIds.map(key => <button onClick={() => this.select(state.docs.find(d => d.id === key))}>核对 {key}</button>)}</div>
                {this.source(state.docs.find(d => d.id === (this.contextIds.includes(this.doc()?.id) ? this.doc().id : this.contextIds[0])))}
              </div>}
              {this.responseMeta && (
                <pre class="model-meta">{JSON.stringify(this.responseMeta, null, 2)}</pre>
              )}
              {this.logs.length > 0 && (
                <details>
                  <summary>本轮事件日志</summary>
                  <pre>{JSON.stringify(this.logs, null, 2)}</pre>
                </details>
              )}
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
            </div>
          ),
        },
      ],
      rail,
    );
  }
  private tools() {
    const t = this.tool;
    if (!t) return <p>该工具说明未载入。</p>;
    const id = this.demoId;
    const e = explanations[id];
    const observed = this.output || t.result;
    const ranked = Array.isArray(observed?.results) ? observed.results : [];
    const colTitle = (i: number, fallback: string) => e?.steps?.[i] || fallback;
    const colWhy = (i: number) => e?.why?.[i];
    const stepPanel = (i: number) =>
      t.steps[i] && (
        <div class="panel">
          <p>{t.steps[i].explanation}</p>
          <pre>{t.steps[i].code}</pre>
        </div>
      );
    const stepObserve = (i: number) =>
      t.steps[i]?.observe ? <p class="lab-note">{t.steps[i].observe}</p> : null;
    const links = (
      <div class="lab-toolbar">
        <span class="mode">{t.mode}</span>
        {t.application_url && (
          <a href={t.application_url} target="_blank" rel="noreferrer">
            打开本机应用 ↗
          </a>
        )}
        <a href={t.url} target="_blank" rel="noreferrer">
          原代码库 ↗
        </a>
        <a href={"assets/guides/" + t.slug + ".md"} target="_blank">
          本地部署与重跑 ↗
        </a>
      </div>
    );
    const runState =
      observed && (
        <p class="source-line">
          {observed.status ? `状态：${observed.status} · ` : ""}
          {observed.version ? `版本 ${observed.version} · ` : ""}
          {observed.records != null ? `${observed.records} 条记录 · ` : ""}
          {Number.isFinite(observed.seconds) ? `耗时 ${observed.seconds}s · ` : ""}
          {observed.engine_took_ms != null ? `引擎耗时 ${observed.engine_took_ms}ms` : ""}
        </p>
      );
    const consolePanel = t.runnable && (
      <div class="panel">
        <label>
          桥接地址{" "}
          <input
            value={this.bridge}
            onInput={(ev: any) => (this.bridge = ev.target.value)}
          />
        </label>
        <p class="lab-note">
          应用使用各自已配置的本地模型；顶部“模型接入”用于独立模型实验。研究工具可能运行数分钟。
        </p>
        {this.querybar(
          <button disabled={this.busy} onClick={() => this.toolRun()}>
            本地重跑
          </button>,
        )}
      </div>
    );
    const requestRecord = observed ? (
      <div class="panel">
        <h3>版本化请求记录</h3>
        <p class="mode">
          {this.output ? "本次实际返回" : "保存的本机实跑结果"} ·{" "}
          {observed.tool || t.name} {observed.version || ""}
        </p>
        <p>
          查询“{observed.query || "见记录"}”
          {Number.isFinite(observed.seconds) ? ` · 耗时 ${observed.seconds}s` : ""}
          {observed.run_at ? ` · 实跑时间 ${observed.run_at}` : ""}
        </p>
        {observed.model && (
          <p class="source-line">生成／评价模型：{observed.model}</p>
        )}
        {observed.embedding_model && (
          <p class="source-line">嵌入模型：{observed.embedding_model}</p>
        )}
        {observed.corpus && <p class="source-line">语料：{observed.corpus}</p>}
      </div>
    ) : null;
    const resultCards = ranked.length > 0 && (
      <div>
        <p>
          查询“{observed.query || "见记录"}” →{" "}
          {observed.records ?? "见记录"}条入库材料 → 返回{ranked.length}条候选
        </p>
        <p class="lab-note">
          度量：{observed.metric || "见原始响应"}
          。下面按服务返回顺序排列；分数不直接换成正确概率。
        </p>
        {ranked.slice(0, 8).map((r, i) => {
          const d = state.docs.find((d) => d.id === r.id);
          return (
            <div class="evidence-card">
              <b>
                #{i + 1} {d?.title || r.title || r.id}
              </b>
              <p>
                {r.id} ·{" "}
                {Number.isFinite(r.score) ? `分值 ${r.score.toFixed(4)}` : ""}
              </p>
              {d ? (
                <>
                  <p class="source-line">{sourceLabel(d)}</p>
                  <p>
                    {d.text.slice(0, 140)}
                    {d.text.length > 140 ? "…" : ""}
                  </p>
                </>
              ) : (
                r.text && (
                  <>
                    {r.pdf_page != null && (
                      <p class="source-line">PDF页序 {r.pdf_page}</p>
                    )}
                    <p>
                      {r.text.slice(0, 140)}
                      {r.text.length > 140 ? "…" : ""}
                    </p>
                  </>
                )
              )}
            </div>
          );
        })}
      </div>
    );
    const reviewNotes = t.review_notes?.map((note) => (
      <p class="application-caution">{note}</p>
    ));
    const rawDetails = (
      <details>
        <summary>版本、请求与完整响应</summary>
        <pre>{JSON.stringify(observed, null, 2)}</pre>
      </details>
    );
    const notRun = (
      <div class="evidence-card">
        本工具此处提供部署方案和接口讲解，未伪造运行输出。完成本地安装后，可按指南实际操作。
      </div>
    );
    const confCol = (extra?: any) => ({
      title: colTitle(0, t.steps[0]?.title),
      why: colWhy(0),
      body: (
        <div>
          {state.local && <p class="application-caution">本页的保存案例与本机外部应用使用原有课堂语料，语料库管理导入不会自动重建它们的数据库。检索本次导入的新语料，请使用 D07–D13。</p>}
          {links}
          <p class="lab-note">{t.role}</p>
          {stepPanel(0)}
          {stepObserve(0)}
          {t.default_query && (
            <div class="panel">
              <h3>研究问题</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>{t.default_query}</p>
            </div>
          )}
          {extra}
          <p class="lab-note">{t.limit}</p>
          <p class="lab-note">
            保存结果明确记录运行时间、版本和语料；只有点击“本地重跑”才会实际请求本机服务。
          </p>
        </div>
      ),
    });
    if (id === "D14")
      return this.flowShell([
        confCol(),
        {
          title: colTitle(1, "文档解析/分块"),
          why: colWhy(1),
          body: (
            <div>
              {stepPanel(1)}
              {stepObserve(1)}
              {runState}
              {observed?.scope && (
                <p class="source-line">边界：{observed.scope}</p>
              )}
              {observed?.embedding_model && (
                <p class="source-line">
                  嵌入模型：{observed.embedding_model}
                </p>
              )}
            </div>
          ),
        },
        {
          title: colTitle(2, "嵌入/检索"),
          why: colWhy(2),
          body: (
            <div>
              {consolePanel}
              {requestRecord}
              {t.steps[2]?.code && <pre>{t.steps[2].code}</pre>}
            </div>
          ),
        },
        {
          title: colTitle(3, "Ollama回答"),
          why: colWhy(3),
          body: (
            <div>
              <p class="lab-note">{t.steps[2]?.explanation}</p>
              {stepObserve(2)}
              {observed ? (
                <div>
                  {observed.answer && (
                    <div class="model-answer">
                      <h3>模型实际回答（待核查）</h3>
                      <p style={{ whiteSpace: "pre-wrap" }}>{observed.answer}</p>
                    </div>
                  )}
                  {observed.sources?.length > 0 && (
                    <div>
                      <h3>送入回答环节的材料</h3>
                      {observed.sources.slice(0, 5).map((s) => (
                        <div class="evidence-card">
                          <strong>{s.title}</strong>
                          <p>{s.text}</p>
                          {s.score != null && (
                            <p class="lab-note">检索分值:{s.score}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {reviewNotes}
                  {observed.model && (
                    <p class="source-line">
                      生成模型:{observed.model} · 实跑时间:{observed.run_at}
                    </p>
                  )}
                  {t.screenshot && (
                    <details>
                      <summary>查看真实应用运行截图</summary>
                      <img
                        class="application-screenshot"
                        src={t.screenshot}
                        alt={t.name + "本机实际运行截图"}
                      />
                    </details>
                  )}
                  {rawDetails}
                </div>
              ) : (
                notRun
              )}
            </div>
          ),
        },
      ]);
    if (id === "D15" || id === "D16")
      return this.flowShell([
        confCol(runState),
        {
          title: colTitle(1, "分析词项"),
          why: colWhy(1),
          body: (
            <div>
              {stepPanel(1)}
              {stepObserve(1)}
              {id === "D16" && observed?.analysis?.query_tokens?.length > 0 && (
                <div>
                  <p class="lab-note">
                    查询侧实际权重（保存结果，模型 {observed.analysis.model}）：
                  </p>
                  {this.flowBars(
                    observed.analysis.query_tokens.map((x) => ({
                      label: x.token,
                      value: x.weight,
                      note: `词表ID ${x.token_id}`,
                    })),
                  )}
                  <p class="lab-note">
                    剪枝比例 {observed.analysis.prune_ratio}
                    ；同一词项的查询权重×文档权重再求和，不是余弦，也不是普通BM25。
                  </p>
                </div>
              )}
              {id === "D15" &&
                (observed?.analysis?.tokens?.length > 0 ? (
                  <div>
                    <p class="lab-note">
                      保存结果的实际分析输出（查询“{observed.query}”）：
                    </p>
                    {observed.analysis.tokens.map((tk) => (
                      <span class="chip">
                        {tk.token}
                        <small>
                          {" "}
                          {tk.start_offset}–{tk.end_offset} · {tk.type}
                        </small>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p class="lab-note">
                    保存结果未含分析输出；本地重跑后此处显示服务端实际词项。
                  </p>
                ))}
            </div>
          ),
        },
        {
          title: colTitle(2, id === "D16" ? "查询词项加权" : "倒排候选"),
          why: colWhy(2),
          body: (
            <div>
              <p class="lab-note">{t.steps[2]?.explanation}</p>
              {consolePanel}
              {requestRecord}
              {observed?.request ? (
                <div>
                  <p class="lab-note">实际发送到服务的请求：</p>
                  <pre>{JSON.stringify(observed.request, null, 2)}</pre>
                </div>
              ) : (
                <p class="lab-note">尚无保存的请求记录。</p>
              )}
            </div>
          ),
        },
        {
          title: colTitle(3, id === "D16" ? "稀疏点积" : "排序与高亮"),
          why: colWhy(3),
          body: (
            <div>
              {observed ? (
                <div>
                  {resultCards}
                  {rawDetails}
                </div>
              ) : (
                notRun
              )}
            </div>
          ),
        },
      ]);
    if (id === "D17")
      return this.flowShell([
        confCol(),
        {
          title: colTitle(1, "写入/提交"),
          why: colWhy(1),
          body: (
            <div>
              {stepPanel(1)}
              {stepObserve(1)}
              {runState}
              {observed?.scope && (
                <p class="source-line">边界:{observed.scope}</p>
              )}
            </div>
          ),
        },
        {
          title: colTitle(2, "解析查询"),
          why: colWhy(2),
          body: (
            <div>
              {consolePanel}
              {requestRecord}
              {stepPanel(2)}
              {stepObserve(2)}
              {observed?.metric && (
                <p class="lab-note">度量：{observed.metric}。</p>
              )}
            </div>
          ),
        },
        {
          title: colTitle(3, "读取命中"),
          why: colWhy(3),
          body: (
            <div>
              {observed ? (
                <div>
                  {resultCards}
                  {rawDetails}
                </div>
              ) : (
                notRun
              )}
            </div>
          ),
        },
      ]);
    if (["D18", "D19", "D20"].includes(id))
      return this.flowShell([
        confCol(),
        {
          title: colTitle(1, "向量/元数据"),
          why: colWhy(1),
          body: (
            <div>
              {stepPanel(1)}
              {stepObserve(1)}
              {runState}
              {observed?.scope && (
                <p class="source-line">边界:{observed.scope}</p>
              )}
              {observed?.embedding?.model && (
                <p class="source-line">
                  嵌入 {observed.embedding.model} ·{" "}
                  {observed.embedding.dimensions}维 ·{" "}
                  {observed.embedding.pooling}池化 · 归一化
                  {observed.embedding.normalize ? "是" : "否"} ·{" "}
                  {observed.embedding.runtime}
                </p>
              )}
            </div>
          ),
        },
        {
          title: colTitle(2, "相似查询"),
          why: colWhy(2),
          body: (
            <div>
              {consolePanel}
              {requestRecord}
              {stepPanel(2)}
              {stepObserve(2)}
              {id === "D19" && (
                <p class="lab-note">
                  过滤例子须修改本地请求的条件；当前“本地重跑”按钮默认查询全部材料。
                </p>
              )}
              {observed?.metric && (
                <p class="lab-note">度量：{observed.metric}。</p>
              )}
            </div>
          ),
        },
        {
          title: colTitle(3, "按ID回原文"),
          why: colWhy(3),
          body: (
            <div>
              {id === "D20" && (
                <p class="lab-note">
                  标量条件用于约束年代、作者后再回查文本；示例命令见本地部署指南。
                </p>
              )}
              {observed ? (
                <div>
                  {resultCards}
                  {rawDetails}
                </div>
              ) : (
                notRun
              )}
            </div>
          ),
        },
      ]);
    if (id === "D23")
      return this.flowShell([
        confCol(),
        {
          title: colTitle(1, "检索/阅读"),
          why: colWhy(1),
          body: (
            <div>
              {stepPanel(1)}
              {stepObserve(1)}
              {observed?.trace?.length > 0 ? (
                <div>
                  <p class="lab-note">
                    保存结果的实际执行轨迹（{observed.trace.length}条进度记录）：
                  </p>
                  <div class="application-timeline">
                    {observed.trace.map((ev2, i) => (
                      <div class="evidence-card">
                        <b>
                          {i + 1} →{" "}
                          {ev2.currentQuery
                            ? `研究查询 · 深度 ${ev2.currentDepth}/${ev2.totalDepth} · 广度 ${ev2.currentBreadth}/${ev2.totalBreadth}`
                            : "进度更新"}
                        </b>
                        {ev2.currentQuery && <p>{ev2.currentQuery}</p>}
                        {ev2.totalQueries != null && (
                          <small>
                            已完成 {ev2.completedQueries}/{ev2.totalQueries}{" "}
                            条查询
                          </small>
                        )}
                        {!ev2.currentQuery && <p>{JSON.stringify(ev2)}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p class="lab-note">
                  尚无执行轨迹；只有实际运行才会产生进度记录。
                </p>
              )}
            </div>
          ),
        },
        {
          title: colTitle(2, "记录缺口"),
          why: colWhy(2),
          body: (
            <div>
              {stepPanel(2)}
              {stepObserve(2)}
              {observed?.learnings?.length > 0 && (
                <div>
                  <h3>学习记录（{observed.learnings.length}条）</h3>
                  <ol class="ex-event-list">
                    {observed.learnings.map((l) => (
                      <li>{l}</li>
                    ))}
                  </ol>
                </div>
              )}
              {reviewNotes}
              {observed?.visitedUrls?.length > 0 && (
                <div>
                  <h3>本轮阅读的材料（{observed.visitedUrls.length}条）</h3>
                  {observed.visitedUrls.map((u) => (
                    <p class="source-line">{u}</p>
                  ))}
                </div>
              )}
            </div>
          ),
        },
        {
          title: colTitle(3, "继续或停止"),
          why: colWhy(3),
          body: (
            <div>
              {observed ? (
                <div>
                  {observed.answer && (
                    <div class="model-answer">
                      <h3>最终简答（待核查）</h3>
                      <p style={{ whiteSpace: "pre-wrap" }}>{observed.answer}</p>
                    </div>
                  )}
                  {observed.scope && (
                    <p class="lab-note">范围:{observed.scope}</p>
                  )}
                  {observed.model && (
                    <p class="source-line">
                      模型:{observed.model} · 实跑时间:{observed.run_at} · 耗时{" "}
                      {observed.seconds}s
                    </p>
                  )}
                  {rawDetails}
                </div>
              ) : (
                notRun
              )}
            </div>
          ),
        },
      ]);
    if (id === "D25")
      return this.flowShell([
        confCol(),
        {
          title: colTitle(1, "寻找候选"),
          why: colWhy(1),
          body: (
            <div>
              {stepPanel(1)}
              {stepObserve(1)}
              {observed?.trace?.length > 0 ? (
                <div>
                  <p class="lab-note">保存结果的实际调度轨迹：</p>
                  {observed.trace
                    .filter((x) => x.action)
                    .map((x) => (
                      <div class="evidence-card">
                        <b>
                          {x.action}：{x.query}
                        </b>
                        {x.ids?.length > 0 && (
                          <p>
                            返回{x.ids.length}条:
                            {x.ids.map((pid) => (
                              <span class="chip">{pid}</span>
                            ))}
                          </p>
                        )}
                      </div>
                    ))}
                  {observed.trace.some(
                    (x) => !x.action && x.output?.includes("[Search]"),
                  ) && (
                    <details>
                      <summary>
                        模型提出的查询（
                        {
                          observed.trace.filter(
                            (x) => !x.action && x.output?.includes("[Search]"),
                          ).length
                        }
                        条）
                      </summary>
                      {observed.trace
                        .filter(
                          (x) => !x.action && x.output?.includes("[Search]"),
                        )
                        .map((x) => (
                          <pre>{x.output}</pre>
                        ))}
                    </details>
                  )}
                </div>
              ) : (
                <p class="lab-note">
                  尚无保存的调度轨迹；未执行的步骤保持未执行。
                </p>
              )}
            </div>
          ),
        },
        {
          title: colTitle(2, "阅读/选择"),
          why: colWhy(2),
          body: (
            <div>
              {stepPanel(2)}
              {stepObserve(2)}
              {observed?.trace?.filter((x) =>
                x.output?.includes("Decision:"),
              ).length > 0 && (
                <p class="source-line">
                  选择器判定{" "}
                  {
                    observed.trace.filter((x) =>
                      x.output?.includes("Decision:"),
                    ).length
                  }{" "}
                  次;True/False 不是原选择器训练得到的概率。
                </p>
              )}
              {observed?.tree && (
                <div class="panel">
                  <h3>发现 → 判断 → 保留</h3>
                  <p>
                    {observed.tree.extra?.touch_ids?.length || 0} 条被发现 →{" "}
                    {observed.tree.extra?.crawler_recall_papers?.length || 0}{" "}
                    条进入选择器 →{" "}
                    {observed.tree.extra?.recall_papers?.length || 0} 条被保留
                  </p>
                  <p>
                    零条保留也是一次真实结果；不能把筛除的候选写成已找到的证据。
                  </p>
                </div>
              )}
            </div>
          ),
        },
        {
          title: colTitle(3, "证据集合"),
          why: colWhy(3),
          body: (
            <div>
              {observed ? (
                <div>
                  {observed.scope && (
                    <p class="lab-note">边界:{observed.scope}</p>
                  )}
                  {reviewNotes}
                  {observed.model && (
                    <p class="source-line">
                      模型:{observed.model} · 版本 {observed.version} ·
                      实跑时间:{observed.run_at}
                    </p>
                  )}
                  {rawDetails}
                </div>
              ) : (
                notRun
              )}
            </div>
          ),
        },
      ]);
    if (id === "D26")
      return this.flowShell([
        confCol(),
        {
          title: colTitle(1, "寻找相关段"),
          why: colWhy(1),
          body: (
            <div>
              {stepPanel(1)}
              {stepObserve(1)}
              {runState}
              {observed?.scope && (
                <p class="source-line">边界:{observed.scope}</p>
              )}
            </div>
          ),
        },
        {
          title: colTitle(2, "证据摘要"),
          why: colWhy(2),
          body: (
            <div>
              {stepPanel(2)}
              {stepObserve(2)}
              {observed?.sources?.length > 0 ? (
                <div>
                  <h3>送入回答环节的材料</h3>
                  {observed.sources.slice(0, 5).map((s) => (
                    <div class="evidence-card">
                      <strong>{s.title}</strong>
                      <p>{s.text}</p>
                      {s.summary && (
                        <p class="lab-note">模型摘要：{s.summary}</p>
                      )}
                      {s.score != null && (
                        <p class="lab-note">证据分值:{s.score}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p class="lab-note">保存结果未含证据材料。</p>
              )}
            </div>
          ),
        },
        {
          title: colTitle(3, "带引文回答"),
          why: colWhy(3),
          body: (
            <div>
              {observed ? (
                <div>
                  {observed.answer && (
                    <div class="model-answer">
                      <h3>模型实际回答（待核查）</h3>
                      <p style={{ whiteSpace: "pre-wrap" }}>{observed.answer}</p>
                    </div>
                  )}
                  {reviewNotes}
                  {observed.model && (
                    <p class="source-line">
                      生成模型:{observed.model} · 版本 {observed.version} ·
                      实跑时间:{observed.run_at}
                    </p>
                  )}
                  {rawDetails}
                </div>
              ) : (
                notRun
              )}
            </div>
          ),
        },
      ]);
    if (id === "D27")
      return this.flowShell([
        confCol(),
        {
          title: colTitle(1, "检索覆盖"),
          why: colWhy(1),
          body: (
            <div>
              {observed?.input ? (
                <div>
                  <p class="source-line">
                    评估题 {observed.input.query_id} · 参照答案：
                    {observed.input.gt_answer}
                  </p>
                  {Array.isArray(observed.input.retrieved_context) &&
                  observed.input.retrieved_context.length > 0 ? (
                    <div>
                      <h3>
                        送入的检索材料（
                        {observed.input.retrieved_context.length}条）
                      </h3>
                      {observed.input.retrieved_context.map((c) => (
                        <div class="evidence-card">
                          <strong>{c.doc_id}</strong>
                          <p>{c.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p class="lab-note">
                      没有检索材料记录；相关证据没找到是检索环节的缺口。
                    </p>
                  )}
                </div>
              ) : (
                <p class="lab-note">保存结果未含固定输入。</p>
              )}
            </div>
          ),
        },
        {
          title: colTitle(2, "回答主张"),
          why: colWhy(2),
          body: (
            <div>
              {stepPanel(1)}
              {stepObserve(1)}
              {observed?.input?.response && (
                <p class="application-caution">
                  下面回答含人为设置的错误，专用于评价演示：“
                  {observed.input.response}”
                </p>
              )}
              {observed?.results_detail?.results?.[0]?.response_claims?.length >
                0 && (
                <div>
                  <h3>抽取的主张与原文核查</h3>
                  {observed.results_detail.results[0].response_claims.map(
                    (claim, i) => (
                      <div class="evidence-card">
                        <b>{claim.join(" → ")}</b>
                        <p>
                          原文核查：
                          {observed.results_detail.results[0].retrieved2response?.[
                            i
                          ]?.join(", ")}
                        </p>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          ),
        },
        {
          title: colTitle(3, "逐项核对"),
          why: colWhy(3),
          body: (
            <div>
              {stepPanel(2)}
              {stepObserve(2)}
              {observed ? (
                <div>
                  {observed.results_detail?.metrics?.overall_metrics && (
                    <div>
                      <h3>本次模型判定指标</h3>
                      <div class="metric-bars">
                        {Object.entries(
                          observed.results_detail.metrics.overall_metrics,
                        ).map(([k, v]) => (
                          <div>
                            <span>
                              {k}:{Number(v).toFixed(1)}%
                            </span>
                            <progress max="100" value={Number(v)} />
                          </div>
                        ))}
                      </div>
                      <p class="lab-note">
                        这些是本次小样本的模型判定；要复核抽取出的论断是否准确。Neutral表示证据不足以推出该断言。
                      </p>
                    </div>
                  )}
                  {observed.benchmark && (
                    <div class="panel">
                      <h3>DeepResearch Bench：单题 RACE 对照</h3>
                      <p>
                        四维加权后，待评答案相对得分 = 待评总分 ÷（待评总分 +
                        参照总分）。本次为{" "}
                        {observed.benchmark.evaluation?.overall_score?.toFixed(
                          3,
                        )}
                        。
                      </p>
                      <p>
                        这是自拟单题＋4B评价模型，不是官方全套基准排名；FACT联网核验未接入。
                      </p>
                    </div>
                  )}
                  {reviewNotes}
                  {observed.model && (
                    <p class="source-line">
                      评价模型:{observed.model} · 实跑时间:{observed.run_at}
                    </p>
                  )}
                  {rawDetails}
                </div>
              ) : (
                notRun
              )}
            </div>
          ),
        },
      ]);
    return this.flowShell([
      confCol(),
      {
        title: colTitle(1, t.steps[1]?.title || "索引/写入"),
        why: colWhy(1),
        body: (
          <div>
            {stepPanel(1)}
            {stepObserve(1)}
            {runState}
          </div>
        ),
      },
      {
        title: colTitle(2, t.steps[2]?.title || "查询请求"),
        why: colWhy(2),
        body: (
          <div>
            {consolePanel}
            {requestRecord}
          </div>
        ),
      },
      {
        title: colTitle(3, "返回与回查"),
        why: colWhy(3),
        body: (
          <div>
            {observed ? (
              <div>
                {resultCards}
                {rawDetails}
              </div>
            ) : (
              notRun
            )}
          </div>
        ),
      },
    ]);
  }
  @State() edgeSel = 0;
  private research() {
    const id = this.demoId;
    if (id === "D21") {
      const fmt = (x: number, d = 3) =>
        Number.isFinite(x) ? x.toFixed(d) : "—";
      return this.flowShell(
        [
          {
            title: "初始查询",
            why: "先保存原查询与原排名。",
            body: (
              <div>
                {this.querybar(
                  <button
                    disabled={this.busy || !this.query.trim()}
                    onClick={() => this.search("vector")}
                  >
                    检索当前材料
                  </button>,
                )}
                {this.preset()}
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
                </div>
                <p class="lab-note">
                  先按余弦取得初始排名，再标记反馈。更新前后均在所选语料范围内用同一余弦度量比较；相关反馈与大模型改写不是同一算法。
                </p>
                <p class="lab-note">
                  查询向量来自语料内预计算查询或所选模型的实时编码；余弦排序在浏览器内实时计算。
                </p>
              </div>
            ),
          },
          {
            title: "标相关/不相关",
            why: "未标记不等于不相关；负反馈必须明确选择。",
            body: (
              <div>
                {this.list()}
                <p class="lab-note">
                  上方每条候选可以标记相关与否；未标记的不作负例。下次运行从原查询重新计算，不在旧结果上反复累计。
                </p>
              </div>
            ),
          },
          {
            title: "移动查询向量",
            why: "q′=αq+β相关均值−γ不相关均值，再归一化。",
            body: (
              <div>
                <div class="controls">
                  {(["alpha", "beta", "gamma"] as const).map((key, i) => (
                    <label>
                      {["α 原查询", "β 相关均值", "γ 不相关均值"][i]} ={" "}
                      {this[key]}
                      <input
                        aria-label={`Rocchio ${key}`}
                        type="range"
                        min={key === "alpha" ? "0.1" : "0"}
                        max="2"
                        step="0.05"
                        value={this[key]}
                        onInput={(e: any) => (this[key] = +e.target.value)}
                      />
                    </label>
                  ))}
                </div>
                <button
                  disabled={
                    this.busy || !this.results.length || !this.query.trim()
                  }
                  onClick={() => this.applyFeedback()}
                >
                  更新查询并重新检索
                </button>
                {this.output?.before && (
                  <div>
                    {(["alpha", "beta", "gamma"] as const).some(
                      (k) => this[k] !== this.output[k],
                    ) && (
                      <p class="ex-callout">
                        参数已改变，下面仍是上次执行的结果；点击“更新查询并重新检索”应用新参数。
                      </p>
                    )}
                    <p class="ex-formula">q′=unit({this.output.alpha}q + {this.output.beta}相关均值 − {this.output.gamma}不相关均值)</p>
                    <p>范围：{this.output.scope==='all'?'全部材料':this.output.scope}，{this.output.corpus_size}条记录。新旧查询夹角 {fmt(this.output.angle,2)}°；相关{this.output.positive}条，不相关{this.output.negative}条。未标记记录没有被当作负例。</p>
                  </div>
                )}
              </div>
            ),
          },
          {
            title: "重新排序",
            why: "更新后的完整向量在选定语料范围内重新排序；前后使用同一余弦度量。",
            body: (
              <div>
                {this.output?.before ? (
                  <div>
                    <div>
                      <b>更新前</b>
                      {this.output.before.slice(0, 5).map((r, i) => (
                        <p>
                          #{i + 1} {r.id} · {fmt(r.score)}
                        </p>
                      ))}
                    </div>
                    <div>
                      <b>更新后</b>
                      {this.results.slice(0, 5).map((r, i) => (
                        <p>
                          #{i + 1} {r.id} · {fmt(r.score)} ← 原#
                          {this.output.before.findIndex((x) => x.id === r.id) +
                            1}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p class="lab-note">
                    在第2列标记反馈并点击“更新查询并重新检索”后，这里按同一余弦尺度对照更新前后的前5名。
                  </p>
                )}
                <textarea
                  rows={4}
                  aria-label="史学判断笔记"
                  value={this.answer}
                  onInput={(e: any) => (this.answer = e.target.value)}
                  placeholder="这一段支持什么？有哪些条件、否定或不能证明的部分？"
                />
                <div class="lab-toolbar">
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
                <details>
                  <summary>{this.logs.length} 轮研究记录</summary>
                  <pre>{JSON.stringify(this.logs, null, 2)}</pre>
                </details>
                {this.output && (
                  <details>
                    <summary>原始输出数据</summary>
                    <pre>{JSON.stringify(this.output, null, 2)}</pre>
                  </details>
                )}
              </div>
            ),
          },
        ],
        {
          done: this.output?.before ? 4 : this.lastSearch ? 1 : 0,
          active: this.output?.before ? 3 : this.lastSearch ? 1 : 0,
        },
      );
    }
    if (id === "D22") {
      const edges = this.output?.edges || [];
      const sel = edges.length
        ? edges[Math.min(this.edgeSel, edges.length - 1)]
        : null;
      const targetDocs = sel
        ? state.docs.filter((d) => d.source_id === sel.to)
        : [];
      return this.flowShell(
        [
          {
            title: "实际引文",
            why: "只用有来源定位的边；目录共现不能算引用。",
            body: (
              <div>
                <p class="lab-note">
                  已载入教师两篇研究对《国民思想の矛盾》的实际脚注关系。沿箭头看参考文献，反向看哪些研究引用了它。相似度不能自动生成引用边。
                </p>
                {edges.length > 0 && (
                  <div class="ex-network">
                    {edges.map((e, i) => (
                      <div
                        onClick={() => (this.edgeSel = i)}
                        style={
                          i === this.edgeSel
                            ? { background: "#eef3fb" }
                            : undefined
                        }
                      >
                        <span>{e.from}</span>
                        <b> ──引用→ </b>
                        <span>{e.to}</span>
                        <small>
                          {e.source}
                          {e.cited_pages ? ` · 原刊页 ${e.cited_pages}` : ""}
                        </small>
                      </div>
                    ))}
                  </div>
                )}
                {!edges.length && (
                  <p class="lab-note">
                    尚无引文数据。载入下方JSON后，有出处的边才会显示；无真实关系时保留空白。
                  </p>
                )}
                {this.output?.scope && (
                  <p class="lab-note">{this.output.scope}</p>
                )}
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
                      this.edgeSel = 0;
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
                <details>
                  <summary>关系记录原文</summary>
                  <pre>
                    {JSON.stringify(
                      this.output || {
                        edges: [],
                        status: "尚未导入引文数据",
                      },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              </div>
            ),
          },
          {
            title: "确定方向",
            why: "A引用B的箭头从A指向B，不能自动反推影响方向。",
            body: (
              <div>
                {this.output?.nodes?.map((n) => (
                  <div class="evidence-card">
                    <b>
                      {n.id} · {n.title}
                    </b>
                    <p>{n.role}</p>
                  </div>
                ))}
                <p class="lab-note">
                  JP21、JP22 是教师研究，JP13
                  是1913年原始论说。已知引用只能证明文献使用，不能自动证明思想影响。
                </p>
                <p class="lab-note">
                  反向名单只说明“谁引用了它”：引用方向 ≠ 影响方向，赞同、批评与传播要分开判断。
                </p>
              </div>
            ),
          },
          {
            title: "连到来源",
            why: "边也要有原文或页码说明。",
            body: (
              <div>
                {sel ? (
                  <div class="evidence-card">
                    <strong>
                      {sel.from} → {sel.to}
                    </strong>
                    {sel.type && <p>关系类型：{sel.type}</p>}
                    <p>{sel.source}</p>
                    <small>{sel.cited_pages}</small>
                    {sel.note && <p>{sel.note}</p>}
                    {sel.locator && <p>{sel.locator}</p>}
                    {sel.evidence && <p>{sel.evidence}</p>}
                  </div>
                ) : (
                  <p class="lab-note">
                    载入引文数据后，点击列1的边，这里显示它的来源定位。
                  </p>
                )}
                <p class="lab-note">
                  每条边由脚注产生，须能回指到PDF页与注号；文本相似度不能补出这条边。
                </p>
              </div>
            ),
          },
          {
            title: "回读上下文",
            why: "引用、赞同、批评和传播是不同判断。",
            body: (
              <div>
                {targetDocs.length > 0 ? (
                  targetDocs.map((d) => (
                    <div class="evidence-card">
                      <div class="source-line">{sourceLabel(d)}</div>
                      <span class="mode">{d.status || "工作转录待核"}</span>
                      {d.date_note && <p class="source-line">{d.date_note}</p>}
                      <p>{d.text}</p>
                    </div>
                  ))
                ) : (
                  <p class="lab-note">
                    当前课堂语料中没有 {sel ? sel.to : "该来源"}
                    的正文；回读需查教师提供PDF。
                  </p>
                )}
                <p class="lab-note">
                  读到原段后回来确认：这条边能证明“引用过”，不能单独证明“影响了”。
                </p>
              </div>
            ),
          },
        ],
        { done: edges.length ? 4 : 0 },
      );
    }
    if (id === "D28") {
      return this.flowShell(
        [
          {
            title: "问题意识",
            why: "将个人、君主、民主与秩序的关系写成可检索的问题。",
            body: (
              <div>
                {this.querybar(null)}
                {this.preset()}
                <p class="lab-note">
                  接续教师《井上哲次郎論》PDF9—10、19（注56—60）与《国民国家与民主主义》PDF16：先问个人、君主与民主如何被表述，再检索宗教、神道与国家秩序之间的关联。保留不支持预期解释的段落。
                </p>
                <p class="lab-note">BM25词项检索在浏览器内实时计算。</p>
              </div>
            ),
          },
          {
            title: "定位材料",
            why: "检索宗教、神道等词只是寻找入口。",
            body: (
              <div>
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
                    disabled={this.busy || !this.query.trim()}
                    onClick={() => this.search("bm25")}
                  >
                    检索当前材料
                  </button>
                </div>
                {this.list()}
              </div>
            ),
          },
          {
            title: "语境与反例",
            why: "分清作者、正文/编注、写作/刊载时间与上下文。",
            body: (
              <div>
                {this.source()}
                <div class="panel">
                  <h3>本轮检查顺序</h3>
                  <p class="lab-note">
                    字是否读对 → 说话者与文体 → 言说/刊载日期 → 正文或编注
                    → 相邻段落 → 反例与支持范围
                  </p>
                </div>
                {this.output && (
                  <details>
                    <summary>原始输出数据</summary>
                    <pre>{JSON.stringify(this.output, null, 2)}</pre>
                  </details>
                )}
              </div>
            ),
          },
          {
            title: "有限论断",
            why: "说明支持范围，保留不符合预期的材料。",
            body: (
              <div>
                <div class="ex-runtime">
                  <span>问题：{this.query}</span>
                  <b>→</b>
                  <span>
                    范围：{this.author === "all" ? "全部" : this.author}
                  </span>
                  <b>→</b>
                  <span>当前片段：{this.doc()?.id}</span>
                  <b>→</b>
                  <span>已记录{this.logs.length}轮判断</span>
                </div>
                <textarea
                  rows={4}
                  aria-label="史学判断笔记"
                  value={this.answer}
                  onInput={(e: any) => (this.answer = e.target.value)}
                  placeholder="这一段支持什么？有哪些条件、否定或不能证明的部分？"
                />
                <div class="lab-toolbar">
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
                <details>
                  <summary>{this.logs.length} 轮研究记录</summary>
                  <pre>{JSON.stringify(this.logs, null, 2)}</pre>
                </details>
              </div>
            ),
          },
        ],
        {
          done: this.logs.length ? 4 : this.lastSearch ? 2 : 0,
          active: this.logs.length ? 3 : this.lastSearch ? 2 : 0,
        },
      );
    }
    const jpDocs = state.docs.filter((d) => d.source_id?.startsWith("JP"));
    const ztDocs = state.docs.filter((d) => d.source_id?.startsWith("ZT"));
    const qv = state.queries.find((q) => q.text === this.query)?.vector;
    const fmt = (x: number) => (Number.isFinite(x) ? x.toFixed(3) : "—");
    const jpLex = bm25(jpDocs, this.query).slice(0, 5);
    const ztLex = bm25(ztDocs, this.query).slice(0, 5);
    const jpVec = qv?.length ? rankVectors(jpDocs, qv).slice(0, 5) : [];
    const ztVec = qv?.length ? rankVectors(ztDocs, qv).slice(0, 5) : [];
    const jpLit = jpDocs.filter((d) => d.text.includes(this.query));
    const ztLit = ztDocs.filter((d) => d.text.includes(this.query));
    const snip = (d: Doc) => {
      const i = d.text.indexOf(this.query);
      return (
        <span>
          …{d.text.slice(Math.max(0, i - 18), i)}
          <mark>{this.query}</mark>
          {d.text.slice(i + this.query.length, i + this.query.length + 38)}…
        </span>
      );
    };
    return this.flowShell(
      [
        {
          title: "分别检索",
          why: "先在各自材料中找到实际用例。",
          body: (
            <div>
              {this.querybar(
                <button
                  disabled={this.busy || !this.query.trim()}
                  onClick={() => this.search("bm25")}
                >
                  检索当前材料
                </button>,
              )}
              {this.preset()}
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
              </div>
              <p class="lab-note">
                相同汉字、近邻分数、概念等值与影响关系分别判断。不能凭结果列表推断传播。
              </p>
              {this.list()}
            </div>
          ),
        },
        {
          title: "各自语境",
          why: "同字词可能承担不同论证功能。",
          body: (
            <div>
              {this.source()}
              <p class="lab-note">
                点击列1候选切换用例；语境要看整段与出处，不看单句。
              </p>
            </div>
          ),
        },
        {
          title: "比较差异",
          why: "比较问题、对象、年代与体裁，不能只比较分数。",
          body: (
            <div>
              <div>
                <b>字面相同</b>
                <p>
                  “{this.query}”字面出现于井上材料 {jpLit.length}{" "}
                  段、章太炎材料 {ztLit.length} 段。
                </p>
                {jpLit.slice(0, 2).map((d) => (
                  <p class="lab-note">
                    {d.id} · PDF {d.pdf_page}：{snip(d)}
                  </p>
                ))}
                {ztLit.slice(0, 2).map((d) => (
                  <p class="lab-note">
                    {d.id} · PDF {d.pdf_page}：{snip(d)}
                  </p>
                ))}
                {jpLit.length === 0 && ztLit.length === 0 && (
                  <p class="lab-note">当前查询在两组材料中均无字面出现。</p>
                )}
              </div>
              <div>
                <b>语义接近 · 余弦近邻</b>
                {qv?.length ? (
                  <div>
                    <p class="lab-note">
                      同一预计算查询向量（{qv.length}维）分别对两组材料实时求余弦。
                    </p>
                    <p>
                      井上材料：
                      {jpVec.map((r, i) => (
                        <span>
                          {" "}
                          #{i + 1} {r.id}·{fmt(r.score)}
                        </span>
                      ))}
                    </p>
                    <p>
                      章太炎材料：
                      {ztVec.map((r, i) => (
                        <span>
                          {" "}
                          #{i + 1} {r.id}·{fmt(r.score)}
                        </span>
                      ))}
                    </p>
                  </div>
                ) : (
                  <p class="lab-note">
                    当前查询没有预计算向量；在列1改选预计算查询后，这里显示两组余弦近邻对照。
                  </p>
                )}
              </div>
              <div>
                <b>近邻分数 · 词项BM25</b>
                <p>
                  井上材料：
                  {jpLex.map((r, i) => (
                    <span>
                      {" "}
                      #{i + 1} {r.id}·{fmt(r.score)}
                    </span>
                  ))}
                </p>
                <p>
                  章太炎材料：
                  {ztLex.map((r, i) => (
                    <span>
                      {" "}
                      #{i + 1} {r.id}·{fmt(r.score)}
                    </span>
                  ))}
                </p>
                <p class="lab-note">
                  分数接近只说明词项共现模式接近，不等于语义或概念相同。
                </p>
              </div>
              <div>
                <b>概念等值</b>
                <p class="lab-note">
                  等值是判断不是分数：以上只列出字面相符与排序近邻。同字可能不同义，同义可能不同字；把等值与否的理由写入列4保存。
                </p>
              </div>
            </div>
          ),
        },
        {
          title: "检查关系证据",
          why: "概念相似不等于借用、引用或影响，需要独立传播证据。",
          body: (
            <div>
              <div class="panel">
                <h3>本轮检查顺序</h3>
                <p class="lab-note">
                  字是否读对 → 说话者与文体 → 言说/刊载日期 → 正文或编注 →
                  相邻段落 → 反例与支持范围
                </p>
              </div>
              <textarea
                rows={4}
                aria-label="史学判断笔记"
                value={this.answer}
                onInput={(e: any) => (this.answer = e.target.value)}
                placeholder="这一段支持什么？有哪些条件、否定或不能证明的部分？"
              />
              <div class="lab-toolbar">
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
              <details>
                <summary>{this.logs.length} 轮研究记录</summary>
                <pre>{JSON.stringify(this.logs, null, 2)}</pre>
              </details>
              {this.output && (
                <details>
                  <summary>原始输出数据</summary>
                  <pre>{JSON.stringify(this.output, null, 2)}</pre>
                </details>
              )}
              <p class="lab-note">
                可比与不可比都记录：影响关系需要版本、译介、征引等独立传播证据，不能由相似分数推出。
              </p>
            </div>
          ),
        },
      ],
      {
        done: this.logs.length ? 4 : this.lastSearch ? 2 : 0,
        active: this.logs.length ? 3 : this.lastSearch ? 2 : 0,
      },
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
    if (mode === "D30") {
      const captionLabel =
        this.captionMode === "ocr"
          ? "OCR工作转录"
          : this.captionMode === "manual"
            ? "人工描述"
            : this.captionMode + " · 预先实际生成";
      return this.flowShell([
        {
          title: "图像 · 原图与来源",
          why: "图像包含字、版面、印章和其他视觉信息。",
          body: (
            <div>
              <div class="ex-runtime">
                <span>原图 #{this.imageIndex + 1}</span>
                <b>→</b>
                <span>派生文本：{this.captionMode}</span>
                <b>→</b>
                <span>逐词命中：“{this.query}”</span>
                <b>→</b>
                <span>检查描述有无漏写</span>
              </div>
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
                </div>
              )}
            </div>
          ),
        },
        {
          title: "OCR/描述 · 派生文本",
          why: "OCR偏向转录字；描述偏向概括内容。二者都会遗漏或生成错误。",
          body: (
            <div>
              <span class="mode">派生文本检索 · {captionLabel}</span>
              <label>
                派生文本来源{" "}
                <select
                  aria-label="派生文本类型"
                  ref={(el) => {
                    if (el) el.value = this.captionMode;
                  }}
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
              {selected && (
                <div class="panel">
                  <p class="model-answer">
                    {derivedText(selected) || "尚无该类型的派生文本"}
                  </p>
                  {!["ocr", "manual"].includes(this.captionMode) && (
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
                人工描述、OCR、视觉模型描述分别标注。检索不到模型描述中遗漏的细节。
              </p>
            </div>
          ),
        },
        {
          title: "字面检索 · 逐词命中",
          why: "本页查的是派生文本，不是像素，也不是图文共同向量。",
          body: (
            <div>
              {this.querybar(
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
              )}
              {!hits.length && (
                <p class="lab-note">
                  当前没有命中。可换派生文本来源或查询，回查原图中是否有未被转写的细节。
                </p>
              )}
              {hits.slice(0, 6).map((r, i) => (
                <div class="result">
                  <strong>
                    {i + 1}. {r.item.label || r.item.title}
                  </strong>
                  <div>
                    <b>命中 {r.score} 个查询词项</b>
                    <p class="lab-note">
                      {[...new Set(tokenize(this.query, "word"))]
                        .filter((t) => derivedText(r.item).includes(t))
                        .map((t) => (
                          <mark>{t} </mark>
                        ))}
                    </p>
                  </div>
                  <p class="source-line">{r.item.source}</p>
                </div>
              ))}
            </div>
          ),
        },
        {
          title: "原图核对 · 漏写与误写检查",
          why: "命中只说明描述里有词；未命中也可能是描述漏写。",
          body: (
            <div>
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
                      <p class="source-line">{r.item.source}</p>
                      <button
                        onClick={() =>
                          (this.imageIndex = Math.max(
                            0,
                            set.items.indexOf(r.item),
                          ))
                        }
                      >
                        回原图核对 →
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <p class="lab-note">
                点击命中回到第1列原图，对照第2列描述检查有无漏写或误写；未命中也可能是描述漏写。
              </p>
              <a href="assets/guides/multimodal.md" target="_blank">
                模型、数据与本地重跑说明 ↗
              </a>
            </div>
          ),
        },
      ]);
    }
    if (mode === "D31") {
      const imageVec = set.items.find((x) => x.vector)?.vector;
      return this.flowShell([
        {
          title: "文本编码器 · 文字查询",
          why: "文本由CLIP文本塔编码，不用MiniLM代替。",
          body: (
            <div>
              <div class="ex-runtime">
                <span>选择已有文字查询</span>
                <b>→</b>
                <span>CLIP文本塔 ↔ 图像塔</span>
                <b>→</b>
                <span>cos(q,d) = q·d / (|q||d|)</span>
                <b>→</b>
                <span>按模型相似度排序</span>
              </div>
              <select
                aria-label="多模态查询"
                ref={(el) => {
                  if (el) el.value = String(this.presetIndex);
                }}
                onChange={(e: any) => (this.presetIndex = +e.target.value)}
              >
                {data.text_queries?.map((qt, i) => (
                  <option value={i}>{qt.text}</option>
                ))}
              </select>
              <p class="lab-note">
                离线只选择已有查询向量；自由输入须运行兼容编码器。
              </p>
            </div>
          ),
        },
        {
          title: "图像编码器 · 图像集",
          why: "图像由配套图像塔编码。",
          body: (
            <div>
              <span class="mode">{set.model || set.status}</span>
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
                  <p class="model-answer">{selected.caption || selected.ocr}</p>
                </div>
              )}
            </div>
          ),
        },
        {
          title: "共同空间 · 同一模型同一维数",
          why: "训练让匹配图文靠近；只凭相同维数不构成共同空间。",
          body: (
            <div>
              <span class="mode">共同图文空间 · 预计算查询</span>
              <p class="ex-formula">cos(q,d) = q·d / (|q||d|)</p>
              <p class="lab-note">
                查询向量 {q?.length || 0} 维 · 图像向量 {imageVec?.length || 0}{" "}
                维；二者来自同一多模态模型的预计算输出，维数一致才可比较。
              </p>
              <p class="lab-note">
                模型图文共同空间不可替换为普通文本向量。
              </p>
            </div>
          ),
        },
        {
          title: "余弦排序 · 相似度结果",
          why: "相似度是模型的对应关系判断，不是OCR逐字准确率。",
          body: (
            <div>
              {!hits.length && (
                <p class="lab-note">
                  当前没有命中。可换派生文本来源或查询，回查原图中是否有未被转写的细节。
                </p>
              )}
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
                      <div class="multimodal-score">
                        <b>余弦 {r.score.toFixed(4)}</b>
                        <span
                          class="similarity-meter"
                          role="img"
                          aria-label={`余弦${r.score.toFixed(4)}；固定尺度负1至1`}
                        >
                          <i
                            style={{
                              left: `${50 + Math.min(0, r.score) * 50}%`,
                              width: `${Math.abs(r.score) * 50}%`,
                            }}
                          />
                        </span>
                        <small>−1 ← 0 → 1；越靠右越相近，不是准确率</small>
                      </div>
                      <p class="source-line">{r.item.source}</p>
                    </div>
                  </div>
                </div>
              ))}
              <a href="assets/guides/multimodal.md" target="_blank">
                模型、数据与本地重跑说明 ↗
              </a>
            </div>
          ),
        },
      ]);
    }
    if (mode === "D32") {
      return this.flowShell([
        {
          title: "查询图块 · 选择",
          why: "选择一张字形图块。",
          body: (
            <div>
              <div class="ex-runtime">
                <span>查询图块 #{this.imageIndex + 1}</span>
                <b>→</b>
                <span>Shikiji视觉特征</span>
                <b>→</b>
                <span>cos(q,d) = q·d / (|q||d|)</span>
                <b>→</b>
                <span>按模型相似度排序</span>
              </div>
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
                  <p class="model-answer">{selected.caption || selected.ocr}</p>
                </div>
              )}
            </div>
          ),
        },
        {
          title: "视觉特征 · Shikiji",
          why: "Shikiji提取实际视觉特征。",
          body: (
            <div>
              <span class="mode">
                图像特征 · 实时近邻排序 · {set.model || set.status}
              </span>
              <p class="ex-formula">cos(q,d) = q·d / (|q||d|)</p>
              <p class="lab-note">
                当前图块特征：
                {selected?.vector
                  ? `${selected.vector.length}维实际向量`
                  : "尚无向量"}
                ；整库图块按特征余弦实时排序。
              </p>
              <p class="lab-note">特征与图块来自助教demo所用模型/数据。</p>
            </div>
          ),
        },
        {
          title: "近邻图块 · 相似度排序",
          why: "余弦排序按特征相近，保留不同字的近邻。",
          body: (
            <div>
              {!hits.length && (
                <p class="lab-note">
                  当前没有命中。可换派生文本来源或查询，回查原图中是否有未被转写的细节。
                </p>
              )}
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
                      <div class="multimodal-score">
                        <b>余弦 {r.score.toFixed(4)}</b>
                        <span
                          class="similarity-meter"
                          role="img"
                          aria-label={`余弦${r.score.toFixed(4)}；固定尺度负1至1`}
                        >
                          <i
                            style={{
                              left: `${50 + Math.min(0, r.score) * 50}%`,
                              width: `${Math.abs(r.score) * 50}%`,
                            }}
                          />
                        </span>
                        <small>−1 ← 0 → 1；越靠右越相近，不是准确率</small>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ),
        },
        {
          title: "原标签核对 · 误差观察",
          why: "原标签帮助观察错误；本页不是重新完成字形分类或释读。",
          body: (
            <div>
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
                      <p class="source-line">{r.item.source}</p>
                      {selected && r.item.label !== selected.label && (
                        <p class="lab-note">
                          标签与查询图块不同：形似不等于同一字，请指出相似处与差异处。
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <p class="lab-note">
                近邻不等于同字；显示原标签并保留错误邻居。
              </p>
              <a href="assets/guides/multimodal.md" target="_blank">
                模型、数据与本地重跑说明 ↗
              </a>
            </div>
          ),
        },
      ]);
    }
    return null;
  }
  private flowBars(
    items: { label: string; value: number; note?: string }[],
    max?: number,
  ) {
    const top =
      max || Math.max(...items.map((x) => Math.abs(x.value)), 0.0001);
    return (
      <div class="ex-bars">
        {items.map((x) => (
          <div class="ex-bar-row">
            <span>{x.label}</span>
            <span class="ex-track">
              <i
                style={{
                  width: `${Math.min(100, (100 * Math.abs(x.value)) / top)}%`,
                }}
              />
            </span>
            <b>{Number.isFinite(x.value) ? x.value.toFixed(3) : "—"}</b>
            {x.note && <small>{x.note}</small>}
          </div>
        ))}
      </div>
    );
  }
  private flowShell(
    columns: { title: string; why?: string; body: any }[],
    rail?: { active?: number; done?: number },
  ) {
    const e = explanations[this.demoId];
    return (
      <div class="flow-shell">
        {e && (
          <div class="flow-head">
            <p class="flow-question">{e.question}</p>
            <div class="flow-rail" aria-label="教学步骤">
              {e.steps.map((s, i) => [
                <span
                  class={
                    rail?.active === i
                      ? "active"
                      : rail?.done !== undefined && i < rail.done
                        ? "done"
                        : ""
                  }
                >
                  {String(i + 1).padStart(2, "0")} · {s}
                </span>,
                i < e.steps.length - 1 && <b aria-hidden="true">→</b>,
              ])}
            </div>
          </div>
        )}
        <div class="flow-grid">
          {columns.map((c, i) => (
            <section class="flow-col">
              <header>
                <b>{String(i + 1).padStart(2, "0")}</b>
                {c.title}
              </header>
              {c.why && <p class="flow-why">{c.why}</p>}
              {c.body}
            </section>
          ))}
        </div>
        {e && <p class="flow-try">动手观察：{e.try}</p>}
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
