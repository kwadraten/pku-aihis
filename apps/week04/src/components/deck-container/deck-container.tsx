import { downloadBytes } from "../shared/download";
import { Component, h, State, Element, Listen } from "@stencil/core";
import { liveLibrary, LiveLibraryState } from "../../lib/live-library";
const CHANNEL = "pku-aihis-week04-20261006";

const LIB_STATUS: Record<LiveLibraryState, string> = {
  idle: "书库：未启动",
  booting: "书库：核心与 SQLite 启动中…",
  seeding: "书库：正在核对种子数据…",
  ready: "书库就绪",
  error: "书库错误",
};

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
  @State() libState: LiveLibraryState = "idle";
  @State() libDetail = "";
  @State() importing = false;
  @State() importRunning = false;
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
    this.go(location.hash.slice(1) || "D04");
    liveLibrary.subscribe((state, detail) => {
      this.libState = state;
      this.libDetail = detail;
    });
    liveLibrary.boot().catch((error) => console.error("书库启动失败", error));
  }
  disconnectedCallback() {
    this.channel?.close();
  }
  private libStatusText() {
    if (this.libState === "ready" && this.libDetail)
      return `${LIB_STATUS.ready} · ${this.libDetail}`;
    if (this.libState === "error" && this.libDetail)
      return `${LIB_STATUS.error}：${this.libDetail}`;
    return LIB_STATUS[this.libState];
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
      const workspace=s.querySelector('metadata-split, library-workbench, patchouli-app, pdf-flow-split, frbr-split, requirements-lab, skos-lab, markdown-lab, standalone-lab') as any;
      if(workspace)workspace.active=i===j;
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
    if(this.importing){if(e.key==='Escape'){e.preventDefault();this.importing=false;}return;}
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
    window.open(url.href, "week04-presenter", "width=1150,height=780");
    setTimeout(() => this.sync(), 800);
  }
  private async openImported(documentId:string) {
    this.importing=false;
    this.go('D04');
    for(let frame=0;frame<60;frame++){
      await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
      const app=this.el.querySelector('deck-slide[slide-id="D04"] patchouli-app') as HTMLPatchouliAppElement;
      if(app?.active){await app.componentOnReady();await app.navigate({page:'reader',documentId,readerSection:'正文',keepDraft:true});return;}
    }
    alert('文献已经入库，请在书库中选择并查看原件。');
  }
  render() {
    return (
      <div class="deck-shell">
        <div class="deck-top">
          <a href="../">PKU / AI × HISTORY</a>
          <span>第四周 · 文献管理器实验室</span>
          <span class="lib-status" role="status">
            {this.libStatusText()}
          </span>
          <button onClick={() => (this.overview = !this.overview)}>
            课程地图
          </button>
          <button
            onClick={() =>
              window.dispatchEvent(new CustomEvent("open-model-settings"))
            }
          >
            模型接入
          </button>
          <button disabled={this.libState !== 'ready'} class={this.importRunning?'pdf-import-running':''} title={this.importRunning?'识别在后台运行，点击查看进度':'导入自己的PDF'} onClick={()=>this.importing=true}>{this.importRunning?'运行中...':'导入 PDF'}</button>
          <button
            disabled={this.libState !== "ready"}
            title={this.libState !== "ready" ? "点击模型接入，加载活体书库" : "在桌面 Patchouli 中打开此数据库"}
            onClick={() =>
              downloadBytes(liveLibrary.exportSqlite(), "week04-library.sqlite")
            }
          >
            导出 SQLite
          </button>
          <label class="sqlite-open">打开 SQLite<input aria-label="打开 SQLite" type="file" accept=".sqlite,.db" disabled={this.libState !== 'ready'} onChange={async e=>{const input=e.target as HTMLInputElement;try{if(input.files?.[0])await liveLibrary.openSqlite(input.files[0]);}catch(error){alert('数据库读取失败：'+error.message);}finally{input.value='';}}}/></label>
          <button onClick={() => this.presenter()}>演讲者视图 ↗</button>
        </div>
        <main>
          <slot />
        </main>
        <pdf-import-wizard hidden={!this.importing} onImportRunningChanged={event=>this.importRunning=event.detail} onImportClosed={()=>this.importing=false} onImportOpenDocument={event=>void this.openImported(event.detail)}/>
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
              <h2>从题录到可回查文本</h2>
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
      </div>
    );
  }
}
