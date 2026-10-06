import { isCoreReady, bootCore } from "../../lib/core-bridge";
import { Component, h, State, Listen } from "@stencil/core";
import {
  getModelSettings,
  setModelSettings,
  isModelReady,
} from "../shared/model-settings";
import { depInfo, probeOcr, DepInfo } from "../shared/deps";
import { liveLibrary } from "../../lib/live-library";

@Component({ tag: "model-connection", shadow: false })
export class ModelConnection {
  @State() open = false;
  @State() c = getModelSettings();
  @State() assets: DepInfo[] = [];
  @State() ocrDetail = "";
  @State() preloading = "";
  @State() status = "";
  private unsubscribe: () => void;

  @Listen("open-model-settings", { target: "window" })
  show() {
    this.c = getModelSettings();
    this.refreshAssets();
    this.open = true;
  }
  @Listen('ocr-ready',{target:'window'}) ocrReady(){probeOcr().then(()=>this.refreshAssets());}
  @Listen("keydown", { target: "window" })
  key(e: KeyboardEvent) {
    if (this.open && e.key === "Escape") {
      e.stopImmediatePropagation();
      this.open = false;
    }
  }
  componentWillLoad() {
    this.unsubscribe = liveLibrary.subscribe(() => this.refreshAssets());
  }
  disconnectedCallback() {
    this.unsubscribe?.();
  }
  private refreshAssets() {
    this.assets = [depInfo("core"), depInfo("library"), depInfo("ocr")];
  }
  private update(p: any) {
    setModelSettings(p);
    this.c = getModelSettings();
    this.status = "已应用；端点与模型保存在本机，Key 仅存当前页面内存。";
  }
  private async preload(kind: string) {
    this.preloading = kind;
    this.status = "";
    try {
      if (kind === "ocr") {
        const r = await probeOcr();
        this.ocrDetail = r.detail;
        this.status = r.ready ? "OCR 模型预载完成。" : `OCR 预载失败：${r.detail}`;
      } else if (kind === "library") {
        await liveLibrary.boot();
        this.status = "活体书库启动完成。";
      } else {
        await bootCore();
        this.status = isCoreReady()
          ? `CoreProbe WASM 已就绪：${await (window as any).DotNet?.invokeMethodAsync?.("CoreProbe", "Identity")}`
          : "CoreProbe 未启动：请确认已运行 pnpm build:core 与 pnpm prepare:core。";
      }
    } catch (e: any) {
      this.status = `预载失败：${e?.message || e}`;
    } finally {
      this.preloading = "";
      this.refreshAssets();
    }
  }
  render() {
    if (!this.open) return null;
    return (
      <div
        class="model-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="模型接入设置"
      >
        <section class="model-dialog">
          <div class="lab-toolbar">
            <h2>模型接入</h2>
            <button onClick={() => (this.open = false)}>完成设置 ×</button>
          </div>
          <p class="lab-note">
            端点与模型保存在本机；Key 仅存当前页面内存（只发往所填端点）。D18 的生成环节在配置后真实调用；检索与引文解析不依赖本配置。
          </p>
          <h3>一、LLM API 配置（OpenAI 兼容 chat/completions）</h3>
          <div class="model-fields">
            <label>
              API 基础地址（https://…，可含路径）
              <input
                aria-label="API基础地址"
                placeholder="https://api.deepseek.com"
                value={this.c.baseUrl}
                onInput={(e: any) => this.update({ baseUrl: e.target.value })}
              />
            </label>
            <label>
              模型名称
              <input
                aria-label="API模型名称"
                placeholder="deepseek-chat"
                value={this.c.model}
                onInput={(e: any) => this.update({ model: e.target.value })}
              />
            </label>
            <label>
              API Key
              <input
                type="password"
                autoComplete="off"
                aria-label="API Key"
                value={this.c.apiKey}
                onInput={(e: any) => this.update({ apiKey: e.target.value })}
              />
            </label>
            <div class="lab-toolbar">
              <button onClick={() => this.update({ apiKey: "" })}>
                清除 Key
              </button>
              <span class="mode">
                {isModelReady() ? "配置完整，可发起实际请求" : "请填端点、模型与Key（本机无认证端点可不填Key）"}
              </span>
            </div>
          </div>
          <h3>二、资产与书库状态</h3>
          <div class="model-fields">
            {this.assets.map((a) => (
              <div class="w04-asset-row" data-kind={a.kind}>
                <span class={{ "w04-lamp": true, on: a.ready }} />
                <div>
                  <strong>{a.label}</strong>
                  <p class="lab-note">{a.detail}</p>
                </div>
                <button
                  disabled={!!this.preloading}
                  onClick={() => this.preload(a.kind)}
                >
                  {this.preloading === a.kind ? "预载中…" : "手动预载"}
                </button>
              </div>
            ))}
          </div>
          {this.ocrDetail && <p class="source-line">OCR 探测：{this.ocrDetail}</p>}
          <p class="mode" aria-live="polite">
            {this.status || "资产状态为真实探测结果；失败原因如实显示。"}
          </p>
        </section>
      </div>
    );
  }
}
