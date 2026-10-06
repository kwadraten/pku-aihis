import { Component, h, Prop, State } from "@stencil/core";
import { liveLibrary } from "../../lib/live-library";
import { depInfo, parseNeeds, probeOcr, DepKind, DepInfo } from "../shared/deps";

@Component({ tag: "config-hint", shadow: false })
export class ConfigHint {
  @Prop() needs: string = "library";
  @Prop() label: string = "";
  @State() deps: DepInfo[] = [];
  @State() visible = false;
  private unsubscribe: () => void;

  componentWillLoad() {
    this.refresh();
    this.unsubscribe = liveLibrary.subscribe(() => this.refresh());
    window.addEventListener("model-settings-change", this.refresh);
    window.addEventListener('ocr-ready',this.refresh);
  }
  disconnectedCallback() {
    this.unsubscribe?.();
    window.removeEventListener("model-settings-change", this.refresh);
    window.removeEventListener('ocr-ready',this.refresh);
  }
  private refresh = () => {
    const kinds = parseNeeds(this.needs);
    this.deps = kinds.map(depInfo);
    this.visible = this.deps.some((d) => !d.ready);
  };

  render() {
    if (!this.visible) return null;
    const modelMissing = this.deps.some((d) => d.kind === "model" && !d.ready);
    const others = this.deps.filter((d) => !d.ready && d.kind !== "model");
    return (
      <div
        class="w04-mask"
        role="button"
        tabIndex={0}
        title="点击右上角模型接入，完成API或模型配置"
        onKeyDown={(e: KeyboardEvent) => {if(e.key==='Enter'||e.key===' ')window.dispatchEvent(new CustomEvent('open-model-settings'));}}
        onClick={() =>
          window.dispatchEvent(new CustomEvent("open-model-settings"))
        }
      >
        <div class="w04-mask-card">
          <strong>
            {this.label || "此演示依赖尚未就绪"}
          </strong>
          <ul>
            {this.deps
              .filter((d) => !d.ready)
              .map((d) => (
                <li>
                  {d.label}：{d.detail}
                </li>
              ))}
          </ul>
          {modelMissing ? (
            <p class="w04-mask-cta">点击右上角「模型接入」完成配置</p>
          ) : (
            <p class="w04-mask-cta">
              {others.every((d) => d.kind === "library")
                ? "等待书库就绪后自动消失"
                : "依赖就绪后自动消失"}
            </p>
          )}
        </div>
      </div>
    );
  }
}
