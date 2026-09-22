import {
  pipeline,
  env,
  AutoTokenizer,
  AutoProcessor,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  RawImage,
} from "../apps/week03/node_modules/@huggingface/transformers/dist/transformers.node.mjs";
import fs from "node:fs/promises";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "../apps/week03/src");
env.allowRemoteModels = false;
env.localModelPath = path.resolve(process.argv[2] || "models") + "/";
env.backends.onnx.wasm.numThreads = 2;
const cp = path.join(root, "assets/data/corpus.json");
const c = JSON.parse(await fs.readFile(cp));
const extract = await pipeline(
  "feature-extraction",
  "paraphrase-multilingual-MiniLM-L12-v2",
  { dtype: "q8", device: "cpu" },
);
for (const d of [...c.records, ...c.queries]) {
  const v = await extract(d.text, { pooling: "mean", normalize: true });
  d.vector = Array.from(v.data);
}
c.manifest.embedding.max_tokens = 512;
c.manifest.embedding.actual_dimension = c.records[0].vector.length;
c.manifest.embedding.computed_at = new Date().toISOString();
await fs.writeFile(cp, JSON.stringify(c));
console.log(
  "text vectors",
  c.records.length,
  c.queries.length,
  c.records[0].vector.length,
);
const mp = path.join(root, "assets/data/multimodal.json"),
  m = JSON.parse(await fs.readFile(mp));
const name = "clip-vit-base-patch32";
const tokenizer = await AutoTokenizer.from_pretrained(name);
const processor = await AutoProcessor.from_pretrained(name);
const vm = await CLIPVisionModelWithProjection.from_pretrained(name, {
  dtype: "q8",
  device: "cpu",
});
const tm = await CLIPTextModelWithProjection.from_pretrained(name, {
  dtype: "q8",
  device: "cpu",
});
const unit = (a) => {
  const n = Math.sqrt(a.reduce((s, x) => s + x * x, 0));
  return a.map((x) => x / n);
};
for (const item of m.pages.items) {
  const input = await processor(
    await RawImage.read(path.join(root, item.image)),
  );
  const out = await vm(input);
  item.vector = unit(Array.from(out.image_embeds.data));
}
m.text_queries = [];
for (const [text, prompt] of [
  ["带黄色标注的书页", "a scanned book page with yellow highlighted text"],
  ["横排中文印刷书页", "a page of printed Chinese text in horizontal lines"],
  [
    "日文竖排双页扫描",
    "a scanned Japanese book with vertical text in two pages",
  ],
  ["佛教与宗教论说（检验模型局限）", "a page discussing Buddhism and religion"],
]) {
  const out = await tm(tokenizer(prompt, { padding: true, truncation: true }));
  m.text_queries.push({
    text,
    prompt,
    language: "en",
    vector: unit(Array.from(out.text_embeds.data)),
  });
}
m.pages.model = "Xenova/clip-vit-base-patch32 · q8 · 512维共同空间";
m.pages.revision = "d15189d7028b43f1d3e65039190477f6af591c2a";
m.pages.preprocessing = "Transformers.js 3.8.1 AutoProcessor, L2 normalize";
m.pages.computed_at = new Date().toISOString();
await fs.writeFile(mp, JSON.stringify(m));
console.log("CLIP", m.pages.items.length, m.text_queries.length);
