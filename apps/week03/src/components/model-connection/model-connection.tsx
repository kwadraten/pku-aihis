import { Fragment, Component, h, State, Listen } from "@stencil/core";
import {
  getModelConfig,
  setModelConfig,
  bridgeEndpoint,
} from "../../lib/model-client";
@Component({ tag: "model-connection", shadow: false })
export class ModelConnection {
  @State() open = false;
  @State() c = getModelConfig();
  @State() models: any[] = [];
  @State() status = "";
  @State() busy = false;
  @Listen("open-model-settings", { target: "window" }) show() {
    this.c = getModelConfig();
    this.open = true;
  }
  @Listen("keydown", { target: "window" }) key(e: KeyboardEvent) {
    if (this.open && e.key === "Escape") {
      e.stopImmediatePropagation();
      this.open = false;
    }
  }
  private update(p: any) {
    setModelConfig(p);
    this.c = getModelConfig();
    this.status = "已应用，相关页面可直接使用。";
  }
  private async inspect() {
    this.busy = true;
    this.status = "正在读取本机模型…";
    try {
      const r = await fetch(bridgeEndpoint(this.c.bridge, "/api/models"), {
        signal: AbortSignal.timeout(30000),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      this.models = d.models;
      this.status = `发现${d.models.length}个不超过10B的本地模型。`;
    } catch (e) {
      this.status = String(e) + "；请先启动本地课堂。";
    } finally {
      this.busy = false;
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
            配置在本标签页共用。Key只保留在当前页面内存，刷新即清除；点击运行才发送请求。
          </p>
          <div class="model-fields">
            <label>
              运行方式
              <select
                aria-label="模型运行方式"
                onChange={(e: any) => this.update({ mode: e.target.value })}
              >
                <option value="local" selected={this.c.mode === "local"}>
                  本机模型 · 10B及以下
                </option>
                <option value="api" selected={this.c.mode === "api"}>
                  输入API Key接入服务
                </option>
              </select>
            </label>
            {(this.c.mode === "local" || this.c.transport === "bridge") && (
              <label>
                本机课堂桥接
                <input
                  aria-label="模型桥接地址"
                  value={this.c.bridge}
                  onInput={(e: any) => this.update({ bridge: e.target.value })}
                />
              </label>
            )}
            {this.c.mode === "local" ? (
              <>
                <label>
                  本地模型
                  <select
                    aria-label="本地模型"
                    onChange={(e: any) =>
                      this.update({ localModel: e.target.value })
                    }
                  >
                    {[
                      "qwen3:4b-instruct-2507-q4_K_M",
                      "deepseek-r1:8b-0528-qwen3-q4_K_M",
                      "gemma3:4b",
                      "qwen3-vl:4b-instruct-q4_K_M",
                      ...this.models.map((x) => x.model),
                    ]
                      .filter((x, i, a) => a.indexOf(x) === i)
                      .map((x) => (
                        <option value={x} selected={this.c.localModel === x}>
                          {x}
                        </option>
                      ))}
                  </select>
                </label>
                <button disabled={this.busy} onClick={() => this.inspect()}>
                  检测本机模型
                </button>
                <p class="lab-note">
                  Qwen3用于文字和工具循环；DeepSeek-R1蒸馏版用于回答对照；Qwen3-VL与Gemma3用于图片描述对照。模型名称可选不表示已经安装，以检测结果为准。
                </p>
                {this.models.map((m) => (
                  <p class="source-line">
                    {m.model} · {m.parameter_size} · {m.quantization} ·{" "}
                    {m.digest?.slice(0, 20)}
                  </p>
                ))}
              </>
            ) : (
              <>
                <label>
                  服务商预设
                  <select
                    aria-label="API服务商"
                    onChange={(e: any) => {
                      if (e.target.value === "deepseek")
                        this.update({
                          baseUrl: "https://api.deepseek.com",
                          apiModel: "deepseek-flash",
                          apiKey: "",
                        });
                      else
                        this.update({ baseUrl: "", apiModel: "", apiKey: "" });
                    }}
                  >
                    <option
                      value="deepseek"
                      selected={this.c.baseUrl.includes("api.deepseek.com")}
                    >
                      DeepSeek
                    </option>
                    <option
                      value="custom"
                      selected={!this.c.baseUrl.includes("api.deepseek.com")}
                    >
                      其他OpenAI兼容API
                    </option>
                  </select>
                </label>
                <label>
                  API基础地址
                  <input
                    aria-label="API基础地址"
                    value={this.c.baseUrl}
                    onInput={(e: any) =>
                      this.update({ baseUrl: e.target.value })
                    }
                  />
                </label>
                <label>
                  模型名称
                  <input
                    aria-label="API模型名称"
                    value={this.c.apiModel}
                    onInput={(e: any) =>
                      this.update({ apiModel: e.target.value })
                    }
                  />
                </label>
                <label>
                  API Key
                  <input
                    type="password"
                    autoComplete="off"
                    aria-label="API Key"
                    value={this.c.apiKey}
                    onInput={(e: any) =>
                      this.update({ apiKey: e.target.value })
                    }
                  />
                </label>
                <label>
                  连接路径
                  <select
                    aria-label="API连接路径"
                    onChange={(e: any) =>
                      this.update({ transport: e.target.value })
                    }
                  >
                    <option
                      value="direct"
                      selected={this.c.transport === "direct"}
                    >
                      浏览器直接连接
                    </option>
                    <option
                      value="bridge"
                      selected={this.c.transport === "bridge"}
                    >
                      经本机桥接（供应商限制跨域时）
                    </option>
                  </select>
                </label>
                <p class="lab-note">
                  运行会向所填服务发送本次问题与选入的文字／图片，按供应商规则计费。本地运行和已运行示例不需要Key。图片示例须选择支持图像的API模型。
                </p>
                <button onClick={() => this.update({ apiKey: "" })}>
                  清除Key
                </button>
              </>
            )}
          </div>
          <p class="mode" aria-live="polite">
            {this.status || "请选择模型后返回演示页运行。"}
          </p>
          <a href="assets/guides/local-runtime.md" target="_blank">
            启动与接入说明 ↗
          </a>
        </section>
      </div>
    );
  }
}
