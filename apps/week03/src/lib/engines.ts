import { getModelConfig, bridgeEndpoint } from "./model-client";
import { state } from "./store";
let lucivy: any,
  index: any,
  indexVersion = -1,
  edge: any,
  edgeVersion = -1,
  edgeIds = new Map();
const dyn = (url: string) => import(/* @vite-ignore */ url);
let fulltextQueue: Promise<any> = Promise.resolve();
export function fulltext(query: string, regex = false) {
  const docs = state.docs,
    version = state.version;
  const job = fulltextQueue
    .catch(() => {})
    .then(() => fulltextOnce(query, regex, docs, version));
  fulltextQueue = job;
  return job;
}
async function fulltextOnce(
  query: string,
  regex: boolean,
  docs: any[],
  version: number,
) {
  if (version !== state.version) throw Error("语料已切换，旧查询已取消");
  if (!crossOriginIsolated)
    throw Error(
      "浏览器尚未进入跨源隔离。请刷新一次，或使用附带隔离响应头的本地服务。",
    );
  if (indexVersion !== version) {
    if (lucivy) lucivy.terminate();
    const { Lucivy } = await dyn(
      new URL("assets/vendor/lucivy-wasm/js/lucivy.js", document.baseURI).href,
    );
    lucivy = new Lucivy(
      new URL("assets/vendor/lucivy-wasm/js/lucivy-worker.js", document.baseURI)
        .href,
    );
    await lucivy.ready;
    index = await lucivy.create(`/week03-${Date.now()}`, {
      fields: [
        { name: "body", type: "text" },
        { name: "title", type: "text" },
      ],
      shards: 1,
    });
    for (let i = 0; i < docs.length; i++) {
      await index.add(i + 1, {
        body: docs[i].text,
        title: docs[i].title,
      });
      if (i % 500 === 499) await index.commit();
    }
    await index.commit();
    if (version !== state.version)
      throw Error("语料已切换，旧建库结果不用于新语料");
    indexVersion = version;
  }
  const results = await index.search(
    { type: "contains", field: "body", value: query, regex },
    { highlights: true, fields: true, limit: 20 },
  );
  return results
    .map((r: any) => ({
      ...r,
      id: docs[Number(r.docId) - 1]?.id,
      score: r.score,
    }))
    .filter((r: any) => r.id);
}
export async function vectorSearch(q: number[]) {
  const version = state.version;
  const docs = state.docs.filter((d) => d.vector?.length === q.length);
  if (!docs.length) throw Error("没有与查询维数兼容的向量；请导入配套向量包。");
  if (edgeVersion !== version) {
    if (edge) edge.free();
    edgeIds.clear();
    const mod = await dyn(
      new URL("assets/vendor/edgevec/edgevec.js", document.baseURI).href,
    );
    await mod.default({
      module_or_path: new URL(
        "assets/vendor/edgevec/edgevec_bg.wasm",
        document.baseURI,
      ).href,
    });
    const cfg = new mod.EdgeVecConfig(q.length);
    cfg.metric = "l2";
    edge = new mod.EdgeVec(cfg);
    docs.forEach((d) => {
      const id = edge.insertWithMetadata(new Float32Array(d.vector), {
        source_id: d.id,
      });
      edgeIds.set(id, d.id);
    });
    edgeVersion = version;
  }
  if (version !== state.version) throw Error("语料已切换，旧向量查询已取消");
  return edge
    .search(new Float32Array(q), Math.min(20, docs.length))
    .map((r: any) => ({
      id: edgeIds.get(r.id),
      score: r.score,
      metric: "L2²，越小越近",
    }));
}
const extractors = new Map<string, Promise<any>>();
export async function embed(text: string, onProgress?: (s: string) => void) {
  const manifest = state.manifest.embedding;
  if (
    manifest?.pooling !== "mean" ||
    manifest?.dtype !== "q8" ||
    manifest?.normalize !== true
  )
    throw Error(
      "浏览器自由查询仅支持当前mean/q8/L2配置；请先用原模型生成配套查询向量",
    );
  if (!manifest?.model || !manifest?.revision)
    throw Error("语料没有完整嵌入配置，不能生成兼容查询");
  if (
    manifest.model !== "Xenova/paraphrase-multilingual-MiniLM-L12-v2" ||
    manifest.revision !== "2c4055b12046f11709e9df2c122e59ffbdc2f900" ||
    manifest.dimensions !== 384 ||
    manifest.max_tokens !== 512
  )
    throw Error(
      "自由编码仅开放本课堂已核对的MiniLM固定版本；其他模型请使用配套预计算查询",
    );
  const key = JSON.stringify(manifest);
  if (!extractors.has(key)) {
    const pending = (async () => {
      const { pipeline, env } = await dyn(
        new URL(
          "assets/vendor/transformers/transformers.min.js",
          document.baseURI,
        ).href,
      );
      let localAssets = false;
      const bridge = getModelConfig().bridge;
      try {
        const r = await fetch(bridgeEndpoint(bridge, "/api/model-assets"), {
          signal: AbortSignal.timeout(2500),
        });
        localAssets = r.ok && (await r.json()).available;
      } catch {}
      env.allowLocalModels = localAssets;
      env.allowRemoteModels = !localAssets;
      if (localAssets) {
        env.localModelPath = bridgeEndpoint(bridge, "/models/");
        onProgress?.("使用本机已下载的MiniLM编码器");
      } else onProgress?.("本机编码器未连接；首次下载到浏览器后执行");
      env.backends.onnx.wasm.numThreads = 1;
      env.backends.onnx.wasm.wasmPaths = new URL(
        "assets/vendor/transformers/",
        document.baseURI,
      ).href;
      return pipeline("feature-extraction", manifest.model, {
        revision: manifest.revision,
        dtype: "q8",
        device: "wasm",
        progress_callback: (p: any) =>
          onProgress?.(
            `${p.status} ${p.file || ""} ${Math.round(p.progress || 0)}%`,
          ),
      });
    })();
    extractors.set(key, pending);
    pending.catch(() => {
      if (extractors.get(key) === pending) extractors.delete(key);
    });
  }
  const instance = await extractors.get(key);
  const x = await instance(text, {
    pooling: "mean",
    normalize: true,
    truncation: true,
    max_length: manifest.max_tokens || 512,
  });
  return Array.from(x.data) as number[];
}
