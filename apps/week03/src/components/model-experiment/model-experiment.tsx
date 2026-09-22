import { Fragment, Component, h, Prop, State, Listen } from "@stencil/core";
import { state, sourceLabel, saveFile } from "../../lib/store";
import { bm25 } from "../../lib/math";
import {
  generate,
  modelLabel,
  openModelSettings,
  setModelConfig,
  citationCheck,
} from "../../lib/model-client";
import {
  loadTasks,
  loadExamples,
  evidenceMessages,
} from "../../lib/model-tasks";
@Component({ tag: "model-experiment", shadow: false })
export class ModelExperiment {
  @Prop() demoId: string;
  @Prop() examplesOnly = false;
  @State() task: any;
  @State() imageOptions: any[] = [];
  @State() imageId = "";
  @State() examples: any[] = [];
  @State() index = 0;
  @State() question = "";
  @State() output: any = null;
  @State() error = "";
  @State() busy = false;
  @State() label = modelLabel();
  @State() request: any = null;
  private controller: AbortController;
  private generation = 0;
  async componentWillLoad() {
    try {
      this.task = (await loadTasks())[this.demoId];
      this.question = this.task?.question || "";
      if (this.task?.kind === "vision") {
        this.imageOptions = (
          await (await fetch("assets/data/multimodal.json")).json()
        ).pages.items;
        this.imageId = this.imageOptions.some(
          (x) => x.id === this.task.image_id,
        )
          ? this.task.image_id
          : this.imageOptions[0]?.id;
      }
      this.examples = (await loadExamples()).examples.filter(
        (x) => x.demo_id === this.demoId,
      );
    } catch (e) {
      this.error = String(e);
    }
  }
  disconnectedCallback() {
    this.controller?.abort();
  }
  @Listen("model-config-change", { target: "window" }) settings() {
    this.label = modelLabel();
    this.clear();
  }
  @Listen("corpus-change", { target: "window" }) corpus() {
    this.clear();
  }
  private clear() {
    this.generation++;
    this.controller?.abort();
    this.busy = false;
    this.output = null;
    this.request = null;
    this.error = "";
  }
  private async run() {
    this.clear();
    const generation = this.generation;
    this.controller = new AbortController();
    this.busy = true;
    try {
      let messages: any[],
        ids: string[] = [];
      if (this.task.kind === "vision") {
        const chosen = this.imageOptions.find((x) => x.id === this.imageId);
        const blob = await (await fetch(chosen.image)).blob();
        const url = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = reject;
          r.readAsDataURL(blob);
        });
        messages = [
          {
            role: "user",
            content: [
              { type: "text", text: this.question },
              { type: "image_url", image_url: { url } },
            ],
          },
        ];
        this.request = {
          question: this.question,
          image: chosen.image,
          image_id: chosen.id,
        };
      } else {
        const docs = state.local
          ? bm25(state.docs, this.question)
              .slice(0, 4)
              .map((x) => state.docs.find((d) => d.id === x.id))
          : this.task.ids
              .map((id) => state.docs.find((d) => d.id === id))
              .filter(Boolean);
        if (!docs.length)
          throw Error("当前语料没有匹配上下文，请修改问题或切回课堂语料。");
        ids = docs.map((d) => d.id);
        messages = evidenceMessages(this.question, docs);
        this.request = {
          messages,
          context_ids: ids,
          corpus: state.manifest.id,
        };
      }
      const r = await generate(messages, { signal: this.controller.signal });
      if (generation !== this.generation) return;
      this.output = {
        ...r,
        citation_check: citationCheck(r.text, ids),
        question: this.question,
        context_ids: ids,
        kind: this.task.kind || "evidence",
        mode: "本轮实际运行",
      };
    } catch (e) {
      if (generation === this.generation) this.error = String(e);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }
  render() {
    if (!this.task) return null;
    const ex = this.examples[this.index];
    return (
      <details class="model-samples" open={true}>
        <summary>
          {this.examplesOnly
            ? "已运行示例 · 可离线对照"
            : "模型实验 · " + this.task.title}
        </summary>
        <p class="lab-note">
          {this.task.scope ||
            "保存示例基于公共课堂节录；模型回答仍须回查原页。"}
        </p>
        <div class="lab-toolbar">
          <span class="mode">{this.label}</span>
          <button onClick={() => openModelSettings()}>
            设置本地模型／API Key
          </button>
        </div>
        {this.task.kind === "vision" && (
          <div class="lab-toolbar">
            <select
              aria-label="模型描述原页"
              onChange={(e: any) => {
                this.clear();
                this.imageId = e.target.value;
              }}
            >
              {this.imageOptions.map((x) => (
                <option value={x.id} selected={x.id === this.imageId}>
                  {x.title || x.id}
                </option>
              ))}
            </select>
            <button
              onClick={() =>
                setModelConfig({
                  mode: "local",
                  localModel: "qwen3-vl:4b-instruct-q4_K_M",
                })
              }
            >
              使用本机Qwen3-VL 4B
            </button>
          </div>
        )}
        {!this.examplesOnly && (
          <>
            <label class="model-question">
              本轮问题
              <textarea
                rows={2}
                aria-label="模型实验问题"
                value={this.question}
                onInput={(e: any) => {
                  this.clear();
                  this.question = e.target.value;
                }}
              />
            </label>
            <div class="lab-toolbar">
              <button disabled={this.busy} onClick={() => this.run()}>
                {this.busy ? "模型运行中…" : "运行当前模型"}
              </button>
              {this.busy && (
                <button onClick={() => this.clear()}>取消本轮</button>
              )}
            </div>
          </>
        )}
        {this.error && (
          <p class="mode status-error" role="alert">
            {this.error}
          </p>
        )}
        {this.output && (
          <div class="panel">
            <span class="mode">
              本轮实际运行 · {this.output.model} ·{" "}
              {this.output.quantization || this.output.provider}
            </span>
            <p class="model-answer">{this.output.text}</p>
            {(this.output.citation_check?.missing_ids ||
              this.output.citation_check?.unknown_ids.length > 0) && (
              <p class="mode status-error">
                引用检查：
                {this.output.citation_check.missing_ids
                  ? "没有使用要求的片段ID"
                  : "出现不属于本轮上下文的ID：" +
                    this.output.citation_check.unknown_ids.join(", ")}
              </p>
            )}
            <p class="lab-note">
              结束原因：{this.output.finish_reason}；
              {this.output.finish_reason === "length"
                ? "达到长度限制，答案可能不完整。"
                : ""}
            </p>
            <details>
              <summary>本轮请求、版本与用量</summary>
              <pre>
                {JSON.stringify(
                  { request: this.request, response: this.output },
                  null,
                  2,
                )}
              </pre>
            </details>
            <button
              onClick={() =>
                saveFile("model-run.json", {
                  request: this.request,
                  response: this.output,
                })
              }
            >
              导出本轮记录
            </button>
          </div>
        )}
        <div class="panel">
          <div class="lab-toolbar">
            <strong>保存示例</strong>
            <select
              aria-label="已运行示例模型"
              onChange={(e: any) => (this.index = +e.target.value)}
            >
              {this.examples.map((x, i) => (
                <option value={i} selected={i === this.index}>
                  {x.response.model} · {x.response.quantization} ·{" "}
                  {x.response.parameter_size} {x.image_id || ""}
                </option>
              ))}
            </select>
          </div>
          {ex ? (
            <>
              <span class="mode">预先在本机实际运行 · 非当前问题的新答案</span>
              <p class="source-line">
                {ex.response.model} · {ex.response.quantization} ·{" "}
                {ex.response.runner} {ex.response.runner_version} ·{" "}
                {ex.response.created_at}
              </p>
              <p class="source-line">版本：{ex.response.digest}</p>
              <p>
                <strong>示例问题：</strong>
                {ex.question}
              </p>
              <p class="model-answer">{ex.response.text}</p>
              <p class="lab-note">
                {ex.review_note ||
                  "未经教师判定的模型原始答案，保留错误供回查。"}
              </p>
              <details>
                <summary>示例的实际请求、上下文与完整执行记录</summary>
                <pre>{JSON.stringify(ex, null, 2)}</pre>
              </details>
              <button onClick={() => saveFile("saved-model-example.json", ex)}>
                下载示例记录
              </button>
            </>
          ) : (
            <p>尚无已完成的实际运行示例。</p>
          )}
        </div>
      </details>
    );
  }
}
