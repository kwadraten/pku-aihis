import { Component, Fragment, h, State, Element, Listen } from "@stencil/core";
import { importCorpusFile, loadCorpus, removeCorpusRecord, state } from "../../lib/store";
import { sourceLocation } from "../../lib/provenance";
const CHANNEL = "pku-aihis-week03-20260922";
@Component({
  tag: "deck-container",
  styleUrl: "deck-container.css",
  shadow: false,
})
export class DeckContainer {
  @Element() el: HTMLElement;
  @State() current = 0;
  @State() overview = false;
  @State() total = 0;
  @State() titles: any[] = [];
  @State() corpusOpen = false;
  @State() corpusFilter = "";
  @State() corpusPage = 0;
  @State() corpusReady = false;
  @State() corpusError = "";
  @State() corpusVersion = 0;
  @State() corpusImportBusy = false;
  @State() corpusImportError = "";
  private slides: HTMLElement[] = [];
  private channel: BroadcastChannel;
  componentDidLoad() {
    this.slides = [...this.el.querySelectorAll("deck-slide")] as HTMLElement[];
    this.total = this.slides.length;
    this.titles = this.slides.map((s) => ({
      id: s.getAttribute("slide-id"),
      title: s.getAttribute("header-title"),
      section: s.getAttribute("kicker"),
    }));
    this.channel = new BroadcastChannel(CHANNEL);
    this.channel.onmessage = (e) => {
      if (e.data.type === "REQUEST") this.sync();
      if (e.data.type === "NAV") this.go(e.data.id);
    };
    this.go(location.hash.slice(1) || "D00");
  }
  disconnectedCallback() {
    this.channel?.close();
  }
  @Listen("corpus-change", { target: "window" }) corpusChanged() {
    this.corpusVersion = state.version;
  }
  private async openCorpus() {
    this.corpusOpen = true;
    this.corpusError = "";
    try {
      await loadCorpus();
      this.corpusReady = true;
      this.corpusVersion = state.version;
    } catch (error) {
      this.corpusError = String(error);
    }
  }
  private async importCorpus(file: File) {
    if (!file) return;
    this.corpusImportError = "";
    this.corpusImportBusy = true;
    try {
      await importCorpusFile(file);
      this.corpusVersion = state.version;
    } catch (error) {
      this.corpusImportError = String(error);
    } finally {
      this.corpusImportBusy = false;
    }
  }
  private sync() {
    this.channel?.postMessage({
      type: "STATE",
      index: this.current,
      ...this.titles[this.current],
      next: this.titles[this.current + 1],
      notes: this.slides[this.current]?.getAttribute("notes"),
      total: this.total,
    });
  }
  private go(id: string | number) {
    const i =
      typeof id === "number" ? id : this.titles.findIndex((s) => s.id === id);
    if (i < 0 || i >= this.slides.length) return;
    this.current = i;
    this.slides.forEach((s, j) => {
      s.style.display = i === j ? "block" : "none";
    });
    history.replaceState(null, "", "#" + this.titles[i].id);
    this.overview = false;
    this.sync();
  }
  @Listen("hashchange", { target: "window" }) hash() {
    this.go(location.hash.slice(1));
  }
  @Listen("keydown", { target: "window" }) key(e: KeyboardEvent) {
    if (e.isComposing) return;
    if (this.corpusOpen) {
      if (e.key === "Escape") this.corpusOpen = false;
      return;
    }
    if (
      e
        .composedPath()
        .some((x: any) =>
          x?.matches?.(
            "input,textarea,select,button,a[href],summary,[contenteditable=true]",
          ),
        )
    )
      return;
    if (document.querySelector(".model-overlay")) return;
    if (this.overview && e.key !== "Escape") return;
    const map = {
      ArrowRight: 1,
      PageDown: 1,
      " ": 1,
      ArrowLeft: -1,
      PageUp: -1,
    };
    if (map[e.key]) {
      e.preventDefault();
      this.go(this.current + map[e.key]);
    }
    if (e.key === "Home") this.go(0);
    if (e.key === "End") this.go(this.total - 1);
    if (e.key === "Escape") this.overview = !this.overview;
    if (e.key.toLowerCase() === "p") this.presenter();
    if (e.key.toLowerCase() === "b")
      document.body.classList.toggle("low-power");
  }
  private presenter() {
    const url = new URL(location.href);
    url.searchParams.set("presenter", "1");
    window.open(url.href, "week03-presenter", "width=1150,height=780");
    setTimeout(() => this.sync(), 800);
  }
  render() {
    const filter = this.corpusFilter.trim().toLocaleLowerCase();
    const corpusRows = this.corpusReady
      ? state.docs.filter((d) =>
          [d.id, d.title, d.author, d.source_id, sourceLocation(d)]
            .some((value) => String(value || "").toLocaleLowerCase().includes(filter)),
        )
      : [];
    const pageSize = 50;
    const pageCount = Math.max(1, Math.ceil(corpusRows.length / pageSize));
    const page = Math.min(this.corpusPage, pageCount - 1);
    return (
      <div class="deck-shell">
        <div class="deck-top">
          <a href="../">PKU / AI × HISTORY</a>
          <span>第三周 · 检索与证据</span>
          <button onClick={() => (this.overview = !this.overview)}>
            课程地图
          </button>
          <button onClick={() => this.openCorpus()}>语料库管理</button>
          <button
            onClick={() =>
              window.dispatchEvent(new CustomEvent("open-model-settings"))
            }
          >
            模型接入
          </button>
          <button onClick={() => this.presenter()}>演讲者视图 ↗</button>
        </div>
        <model-connection />
        <main>
          <slot />
        </main>
        <nav class="deck-nav">
          <button
            aria-label="上一页"
            disabled={!this.current}
            onClick={() => this.go(this.current - 1)}
          >
            ← 上一页
          </button>
          <span>
            <b>{this.titles[this.current]?.id}</b>　{this.current + 1} /{" "}
            {this.total}　
            <span class="nav-hint">方向键翻页 · P 备注 · B 静态</span>
          </span>
          <button
            aria-label="下一页"
            disabled={this.current === this.total - 1}
            onClick={() => this.go(this.current + 1)}
          >
            下一页 →
          </button>
        </nav>
        {this.overview && (
          <div class="overview" role="dialog" aria-label="课程地图">
            <div class="overview-top">
              <h2>沿着材料流动的方向</h2>
              <button onClick={() => (this.overview = false)}>关闭 ×</button>
            </div>
            <div class="overview-grid">
              {this.titles.map((s, i) => (
                <button
                  class={i === this.current ? "selected" : ""}
                  onClick={() => this.go(i)}
                >
                  <small>
                    {s.id} · {s.section}
                  </small>
                  <strong>{s.title}</strong>
                </button>
              ))}
            </div>
          </div>
        )}
        {this.corpusOpen && (
          <div class="corpus-overlay" role="dialog" aria-modal="true" aria-label="语料库管理">
            <div class="corpus-dialog">
              <div class="corpus-dialog-head">
                <div>
                  <h2>语料库管理</h2>
                  <p>当前页面内存中的记录；删除后本次课堂立即生效，刷新页面会恢复原始语料。</p>
                </div>
                <button onClick={() => (this.corpusOpen = false)}>关闭 ×</button>
              </div>
              {this.corpusError ? <p role="alert">{this.corpusError}</p> : !this.corpusReady ? <p>正在载入语料…</p> : (
                <>
                  <div class="corpus-dialog-toolbar">
                    <label>查找记录 <input aria-label="查找语料" value={this.corpusFilter} onInput={(e: any) => { this.corpusFilter = e.target.value; this.corpusPage = 0; }} /></label>
                    <span role="status">当前 {state.docs.length} 条；匹配 {corpusRows.length} 条。至少保留一条，以便课堂页面继续运行。</span>
                  </div>
                  <div class="corpus-import">
                    <label>导入整卷语料 <input type="file" accept=".json,.jsonl" aria-label="导入整卷语料" disabled={this.corpusImportBusy} onChange={(e: any) => { const input = e.target as HTMLInputElement; const file = input.files?.[0]; if (file) this.importCorpus(file); input.value = ""; }} /></label>
                    {this.corpusImportError ? <span class="status-error" role="alert">{this.corpusImportError}</span> : <span>{state.local ? "本机导入" : "公开课堂节录"} · {state.docs.some((d) => d.vector?.length) ? "已含配套向量，可用关键词、全文、向量及混合检索。" : "纯文本包：可用关键词与全文检索；向量、混合和近邻检索请导入配套向量 JSON。"} 导入内容在本浏览器内处理，刷新页面恢复原始语料。</span>}
                  </div>
                  <div class="corpus-table-wrap">
                    <table class="corpus-table">
                      <thead><tr><th>编号</th><th>篇名</th><th>作者</th><th>来源定位</th><th>核对状态</th><th>操作</th></tr></thead>
                      <tbody>
                        {corpusRows.slice(page * pageSize, (page + 1) * pageSize).map((d) => (
                          <tr>
                            <td>{d.id}</td><td>{d.title}</td><td>{d.author || "待核"}</td>
                            <td>{sourceLocation(d)}</td><td>{d.status || "未标注"}</td>
                            <td><button aria-label={`删除 ${d.id}`} disabled={state.docs.length <= 1} onClick={() => removeCorpusRecord(d.id)}>删除</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!corpusRows.length && <p>没有匹配的记录。</p>}
                  </div>
                  <div class="corpus-pagination">
                    <button disabled={page === 0} onClick={() => (this.corpusPage = page - 1)}>上一页</button>
                    <span>第 {page + 1} / {pageCount} 页</span>
                    <button disabled={page >= pageCount - 1} onClick={() => (this.corpusPage = page + 1)}>下一页</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
}
