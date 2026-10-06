import fs from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const site = path.join(root, "site");
const html = await fs.readFile(path.join(site, "week03/index.html"), "utf8");
const pages = JSON.parse(await fs.readFile(path.join(site, 'week03/assets/data/pages.json')));
const pageMap = JSON.parse(await fs.readFile(path.join(root, 'docs/week03/page-map.json')));
const slideIDs = [...html.matchAll(/<deck-slide\b[^>]*slide-id="([^"]+)"/g)].map(m => m[1]);
assert.equal(slideIDs.length, 29);
assert.equal(new Set(slideIDs).size, slideIDs.length);
assert.deepEqual(slideIDs, pages.map(p => p.id));
assert.deepEqual(slideIDs, pageMap.map(p => p.id));
assert.deepEqual([...html.matchAll(/<tool-family demo-id="([^"]+)"/g)].map(m => m[1]), ['D14', 'D15', 'D18']);
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
  if (/\.(json|html|md|mjs|ts|tsx)$/.test(row.path)) {
    const s = await fs.readFile(path.join(site, row.path), "utf8");
    assert(!s.includes("/Users/"), `private path in ${row.path}`);
  }
}
for (const d of [...c.records, ...m.pages.items, ...m.kuzushi.items])
  if (d.image) await fs.access(path.join(site, "week03", d.image));
console.log(
  "29 pages, matching maps, source locators, vector dimensions, assets and public paths checked",
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
const manifest4=JSON.parse(await fs.readFile(path.join(site,'release-manifest.json')));
if (manifest4.weeks?.includes('week04')) {
  const html4=await fs.readFile(path.join(site,'week04/index.html'),'utf8');
  const map4=JSON.parse(await fs.readFile(path.join(root,'docs/week04/page-map.json'),'utf8'));
  const ids4=[...html4.matchAll(/slide-id="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(ids4,map4.map(p=>p.id));
  assert.equal(ids4.length,31);
  for(const name of ['patchouli-LICENSE.txt','patchouli-manifest.json','SOURCE.txt','corresponding-source/core-probe/Program.cs'])
    assert((await fs.readFile(path.join(site,'week04/assets/licenses',name))).length>0);
  const seed4=JSON.parse(await fs.readFile(path.join(site,'week04/assets/seed/native-seed.json')));
  assert.equal(seed4.rows.items,4);assert.equal(seed4.rows.pages,353);assert.equal(seed4.pdfs.length,4);
  const {createHash}=await import('node:crypto');
  for(const e of [seed4.database,...seed4.pdfs]) {
    const bytes=await fs.readFile(path.join(site,'week04/assets/seed',e.path));
    assert.equal(bytes.length,e.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),e.sha256);
  }
  const ocr=JSON.parse(await fs.readFile(path.join(site,'week04/assets/ocr/models.json')));
  assert.deepEqual(manifest4.files.map(f=>f.path.replaceAll('\\','/')).filter(p=>/\.onnx$/i.test(p)).sort(),ocr.models.map(m=>'week04/assets/ocr/'+m.file).sort());
  for(const model of ocr.models)assert.equal(createHash('sha256').update(await fs.readFile(path.join(site,'week04/assets/ocr',model.file))).digest('hex'),model.sha256);
  const seedPaths=['native-seed.json',seed4.database.path,...seed4.pdfs.map(p=>p.path)].map(p=>'week04/assets/seed/'+p).sort();
  assert.deepEqual(manifest4.files.map(f=>f.path.replaceAll('\\','/')).filter(p=>p.startsWith('week04/assets/seed/')).sort(),seedPaths);
  assert.deepEqual(manifest4.files.map(f=>f.path.replaceAll('\\','/')).filter(p=>/\.pdf$/i.test(p)).sort(),seed4.pdfs.map(p=>'week04/assets/seed/'+p.path).sort());
  console.log('Week04: native SQLite, 353 pages and four verified PDFs');
}
