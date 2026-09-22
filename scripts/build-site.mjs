import {
  cp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  stat,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
const root = path.resolve(import.meta.dirname, ".."),
  site = path.join(root, "site");
const releases = JSON.parse(
  await readFile(path.join(root, "published-weeks.json")),
);
await rm(site, { recursive: true, force: true });
await mkdir(site, { recursive: true });
for (const week of releases.weeks) {
  if (!/^week\d{2}$/.test(week)) throw Error("Invalid week");
  await cp(
    path.join(root, "apps", week, "www", "pku-aihis", week),
    path.join(site, week),
    { recursive: true, filter: (s) => !s.endsWith(".map") },
  );
}
await writeFile(
  path.join(site, "index.html"),
  `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>人工智能赋能历史研究与写作</title><style>body{max-width:960px;margin:10vh auto;padding:30px;background:#f4f3ee;color:#20272e;font-family:system-ui}small{letter-spacing:.1em;color:#164ec7}h1{font-weight:500;font-size:42px;line-height:1.4}a{color:#164ec7;font-size:24px}p{line-height:1.9}article{border-top:1px solid #aab5be;padding:28px 0}</style><small>PKU / AI × HISTORY</small><h1>人工智能赋能<br>历史研究与写作</h1><p>材料、检索与证据之间的可观察过程。</p>${releases.weeks.map((w) => `<article><a href="${w}/">${w === "week03" ? "第三周 · 检索与证据" : w} →</a><p>可交互课堂演示 · 原页定位 · 演讲者视图</p></article>`).join("")}<p><a style="font-size:14px" href="https://github.com/lyzhackjp/pku-aihis">源码、使用说明与协作记录 ↗</a></p></html>`,
);
const inventory = [];
async function walk(p) {
  for (const e of await readdir(p, { withFileTypes: true })) {
    const f = path.join(p, e.name);
    if (e.isDirectory()) await walk(f);
    else {
      const rel = path.relative(site, f);
      if (/\.(pdf|docx|typ|onnx|safetensors|zip|env|py)$/i.test(rel))
        throw Error("Non-public asset " + rel);
      const b = await readFile(f);
      inventory.push({
        path: rel,
        bytes: b.length,
        sha256: createHash("sha256").update(b).digest("hex"),
      });
    }
  }
}
await walk(site);
await writeFile(
  path.join(site, "release-manifest.json"),
  JSON.stringify({ weeks: releases.weeks, files: inventory }, null, 2),
);
console.log(
  "Public site",
  inventory.length,
  "files",
  inventory.reduce((s, x) => s + x.bytes, 0),
  "bytes",
);
