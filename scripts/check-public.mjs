import fs from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const site = path.join(root, "site");
const html = await fs.readFile(path.join(site, "week03/index.html"), "utf8");
assert.equal((html.match(/<deck-slide /g) || []).length, 33);
const c = JSON.parse(
  await fs.readFile(path.join(site, "week03/assets/data/corpus.json")),
);
assert.equal(c.records.length, 27);
assert(
  c.records.every(
    (x) => x.vector.length === 384 && x.vector.every(Number.isFinite),
  ),
);
assert(c.queries.every((x) => x.vector.length === 384));
const m = JSON.parse(
  await fs.readFile(path.join(site, "week03/assets/data/multimodal.json")),
);
assert.equal(m.kuzushi.items.length, 48);
assert(m.kuzushi.items.every((x) => x.vector.length === 768));
assert.equal(m.pages.items.length, 7);
assert(m.pages.items.every((x) => x.vector.length === 512));
assert(new Set(m.kuzushi.items.map((x) => x.label)).size > 2);
const manifest = JSON.parse(
  await fs.readFile(path.join(site, "release-manifest.json")),
);
assert(
  manifest.files.every(
    (x) =>
      !x.path.includes("node_modules") &&
      !x.path.includes("model_quantized") &&
      !x.path.endsWith(".map"),
  ),
);
for (const row of manifest.files) {
  if (/\.(json|html|md)$/.test(row.path)) {
    const s = await fs.readFile(path.join(site, row.path), "utf8");
    assert(!s.includes("/Users/"), `private path in ${row.path}`);
  }
}
for (const d of [...c.records, ...m.pages.items, ...m.kuzushi.items])
  if (d.image) await fs.access(path.join(site, "week03", d.image));
console.log(
  "33 pages, source locators, vector dimensions, assets and public paths checked",
);
const examples = JSON.parse(
  await fs.readFile(
    path.join(site, "week03/assets/data/model-examples.json"),
    "utf8",
  ),
);
const required = [
  "D13",
  "D14",
  "D21",
  "D23",
  "D24",
  "D25",
  "D26",
  "D27",
  "D28",
  "D29",
  "D30",
];
for (const id of required)
  assert(
    examples.examples.some((e) => e.demo_id === id),
    `Missing actual model example ${id}`,
  );
for (const model of ["gemma3:4b", "qwen3-vl:4b-instruct-q4_K_M"]) {
  const images = examples.examples.filter(e => e.demo_id === "D30" && e.response.model === model);
  assert.equal(images.length, 7);
  assert.equal(new Set(images.map(e => e.image_id)).size, 7);
}
for (const e of examples.examples) {
  assert(
    e.response.provider === "local" && e.response.parameters <= 10_000_000_000,
  );
  assert(
    e.response.digest &&
      e.response.finish_reason === "stop" &&
      e.response.text.trim(),
  );
  assert(e.corpus_sha256 === examples.corpus_sha256);
  assert(e.context_ids.every((id) => c.records.some((d) => d.id === id)));
  assert(!JSON.stringify(e).includes("TEST_ONLY_"));
  if (e.demo_id === "D24")
    assert(e.trace.some((t) => t.event === "tool_result" && t.tool === "read"));
}
console.log(
  "Actual local model examples, <=10B parameters, seven image descriptions and trace provenance checked",
);
