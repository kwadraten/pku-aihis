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
  @State() synced = false;
  @State() lastSync = 0;
  @State() overview=false;
  async componentDidLoad() {
    this.pages = await fetch("assets/data/pages.json")
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);
    const id = location.hash.slice(1) || "D00";
    this.update(this.pages.find((p) => p.id === id) || { id });
    this.channel = new BroadcastChannel("pku-aihis-week04-20261006");
    this.channel.onmessage = (e) => {
      if (e.data.type === "STATE") {this.update(e.data);this.synced=true;this.lastSync=Date.now();}
    };
    this.channel.postMessage({ type: "REQUEST" });
    this.timer = setInterval(() => {
      if (this.running) this.seconds++;
      if(Date.now()-this.lastSync>5000){this.synced=false;this.channel.postMessage({type:'REQUEST'});}
    }, 1000);
  }
  disconnectedCallback() {
    clearInterval(this.timer);
    this.channel?.close();
  }
  update(p: any) {
    this.data = p;
    this.notes =
      sessionStorage.getItem("week04-notes-" + p.id) ||
      p.notes ||
      (p.title ? `目的：${p.title}` : "等待观众窗口同步当前页。");
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
          <span>第四周 / 教师视图</span>
          <span role="status">{this.synced?'已同步':'等待观众屏连接'}</span>
          <a target="week04-audience" href={"./#" + (this.data.id || "D00")}>
            打开／恢复观众窗口 ↗
          </a>
        </header>
        <p class="eyebrow">当前 {this.data.id}</p>
        <h1>{this.data.title || "（等待同步）"}</h1>
        <div class="presenter-grid">
          <section>
            <h2>讲解备注</h2>
            <textarea
              aria-label="讲解备注"
              value={this.notes}
              onInput={(e: any) => {
                this.notes = e.target.value;
                sessionStorage.setItem("week04-notes-" + this.data.id, this.notes);
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
            <button onClick={()=>{this.channel.postMessage({type:'NAV',id:'D00'});this.update(this.pages[0]);}}>首页</button>
            <button onClick={()=>{this.channel.postMessage({type:'NAV',id:'D30'});this.update(this.pages.at(-1));}}>尾页</button>
            <button onClick={()=>this.overview=!this.overview}>宫格选页</button>
            {this.overview&&<div class="presenter-pages">{this.pages.map(p=><button onClick={()=>{this.channel.postMessage({type:'NAV',id:p.id});this.update(p);this.overview=false;}}>{p.id} {p.title}</button>)}</div>}
            <h2>下一页</h2>
            <p>
              {this.data.next?.title ||
                this.pages[
                  this.pages.findIndex((p) => p.id === this.data.id) + 1
                ]?.title ||
                "课程结束"}
            </p>
            <button disabled={!this.pages.length} onClick={() => this.move(-1)}>
              ← 上一页
            </button>{" "}
            <button disabled={!this.pages.length} onClick={() => this.move(1)}>
              下一页 →
            </button>
            <p>双屏状态通过当前课程专用频道同步。</p>
          </section>
        </div>
      </main>
    );
  }
}
