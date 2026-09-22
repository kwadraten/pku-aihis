import { Component, h, State } from "@stencil/core";
@Component({
  tag: "deck-presenter",
  styleUrl: "deck-presenter.css",
  shadow: false,
})
export class DeckPresenter {
  @State() data: any = {};
  @State() pages: any[] = [];
  @State() seconds = 0;
  @State() running = false;
  @State() notes = "";
  private channel: BroadcastChannel;
  private timer: any;
  async componentDidLoad() {
    this.pages = await (await fetch("assets/data/pages.json")).json();
    const id = location.hash.slice(1) || "D00";
    this.update(this.pages.find((p) => p.id === id) || this.pages[0]);
    this.channel = new BroadcastChannel("pku-aihis-week03-20260922");
    this.channel.onmessage = (e) => {
      if (e.data.type === "STATE") this.update(e.data);
    };
    this.channel.postMessage({ type: "REQUEST" });
    this.timer = setInterval(() => {
      if (this.running) this.seconds++;
    }, 1000);
  }
  disconnectedCallback() {
    clearInterval(this.timer);
    this.channel?.close();
  }
  update(p: any) {
    this.data = p;
    this.notes =
      sessionStorage.getItem("notes-" + p.id) ||
      p.notes ||
      `目的：${p.title}\n操作：${p.action || ""}\n观察：${p.evidence || ""}`;
  }
  move(delta: number) {
    const i = this.pages.findIndex((p) => p.id === this.data.id) + delta;
    if (i >= 0 && i < this.pages.length) {
      this.channel.postMessage({ type: "NAV", id: this.pages[i].id });
      this.update(this.pages[i]);
    }
  }
  render() {
    return (
      <main class="presenter">
        <header>
          <span>第三周 / 教师视图</span>
          <a target="week03-audience" href={"./#" + (this.data.id || "D00")}>
            打开／恢复观众窗口 ↗
          </a>
        </header>
        <p class="eyebrow">当前 {this.data.id}</p>
        <h1>{this.data.title}</h1>
        <div class="presenter-grid">
          <section>
            <h2>讲解备注</h2>
            <textarea
              aria-label="讲解备注"
              value={this.notes}
              onInput={(e: any) => {
                this.notes = e.target.value;
                sessionStorage.setItem("notes-" + this.data.id, this.notes);
              }}
            />
            <p>备注仅存当前浏览器会话；不修改教案。</p>
          </section>
          <section>
            <p class="timer">
              {Math.floor(this.seconds / 60)
                .toString()
                .padStart(2, "0")}
              :{(this.seconds % 60).toString().padStart(2, "0")}
            </p>
            <button onClick={() => (this.running = !this.running)}>
              {this.running ? "暂停" : "开始"}计时
            </button>{" "}
            <button onClick={() => (this.seconds = 0)}>重置</button>
            <h2>下一页</h2>
            <p>
              {this.data.next?.title ||
                this.pages[
                  this.pages.findIndex((p) => p.id === this.data.id) + 1
                ]?.title ||
                "课程结束"}
            </p>
            <button onClick={() => this.move(-1)}>← 上一页</button>{" "}
            <button onClick={() => this.move(1)}>下一页 →</button>
            <p>双屏状态通过当前课程专用频道同步。</p>
          </section>
        </div>
      </main>
    );
  }
}
