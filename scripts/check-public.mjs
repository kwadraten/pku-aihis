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
