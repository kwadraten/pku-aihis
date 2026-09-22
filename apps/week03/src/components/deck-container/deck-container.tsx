import { Component, h, State, Element, Listen } from "@stencil/core";
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
    if (
      e.isComposing ||
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
    return (
      <div class="deck-shell">
        <div class="deck-top">
          <a href="../">PKU / AI × HISTORY</a>
          <span>第三周 · 检索与证据</span>
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
      </div>
    );
  }
}
