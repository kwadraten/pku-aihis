import { liveLibrary, LiveLibraryState } from "../../lib/live-library";
import { isCoreReady } from "../../lib/core-bridge";
import { isModelReady } from "./model-settings";

export type DepKind = "library" | "model" | "core" | "ocr";

export interface DepInfo {
  kind: DepKind;
  label: string;
  ready: boolean;
  detail: string;
}

// Lazy-load the real browser OCR backend and verify local model hashes.

export interface OcrApi {
  ocrImage: (
    image: HTMLCanvasElement | ImageData,
    opts: { signal?: AbortSignal },
  ) => Promise<{
    lines: { text: string; bbox: [number, number, number, number]; confidence: number }[];
    engine: string;
    model_versions: Record<string, string>;
  }>;
}

let ocrApi: OcrApi | null | undefined;

export async function probeOcr(): Promise<{ ready: boolean; detail: string; api?: OcrApi }> {
  if (ocrApi !== undefined) return { ready: !!ocrApi, detail: ocrApi ? "OCR 引擎已加载" : "src/lib/ocr.ts 尚未提供（并行任务开发中）", api: ocrApi || undefined };
  try {
    const mod: any = await import("../../lib/ocr");
    await mod.preloadOcr();
    if (typeof mod.ocrImage === "function") {
      ocrApi = mod as OcrApi;
      return { ready: true, detail: `OCR 引擎已加载：${mod.engine || mod.ocrImage.name || "已提供"}`, api: ocrApi };
    }
    ocrApi = null;
    return { ready: false, detail: "src/lib/ocr.ts 已存在但未导出 ocrImage", api: undefined };
  } catch (e: any) {
    ocrApi = undefined;
    return { ready: false, detail: `OCR 模块未就绪：${e?.message || String(e)}`, api: undefined };
  }
}

export function libraryState(): { state: LiveLibraryState; detail: string; ready: boolean } {
  const state = liveLibrary.getState(),
    detail = liveLibrary.getDetail();
  return { state, detail, ready: state === "ready" };
}

export function depInfo(kind: DepKind): DepInfo {
  if (kind === "library") {
    const { state, detail } = libraryState();
    const text: Record<LiveLibraryState, string> = {
      idle: "未启动",
      booting: "核心与 SQLite 启动中…",
      seeding: "正在核对种子数据…",
      ready: detail || "就绪",
      error: detail || "启动失败",
    };
    return { kind, label: "活体书库", ready: state === "ready", detail: text[state] };
  }
  if (kind === "model") {
    const ready = isModelReady();
    return {
      kind,
      label: "LLM API",
      ready,
      detail: ready ? "端点 / 模型 / Key 已配置" : "未配置 OpenAI 兼容 API",
    };
  }
  if (kind === "core") {
    const ready = isCoreReady();
    return {
      kind,
      label: "CoreProbe WASM",
      ready,
      detail: ready ? "Blazor 核心已挂载 window.DotNet" : "Blazor 核心未启动",
    };
  }
  // OCR 的同步探测只回已缓存结论；详细结论走 probeOcr()
  const ready = !!ocrApi;
  return {
    kind,
    label: "OCR 模型",
    ready,
    detail: ready ? "已加载" : "未加载（可在「模型接入」里预载探测）",
  };
}

export function parseNeeds(needs: string): DepKind[] {
  return needs
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is DepKind => ["library", "model", "core", "ocr"].includes(s));
}
