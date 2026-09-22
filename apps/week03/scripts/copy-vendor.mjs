import { cp, mkdir, copyFile, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const root = path.resolve("src/assets/vendor");
await mkdir(root, { recursive: true });
for (const name of ["lucivy-wasm", "edgevec", "opencc-js"]) {
  const pkg = path.resolve("node_modules", name);
  await rm(path.join(root, name), { recursive: true, force: true });
  await cp(pkg, path.join(root, name), {
    recursive: true,
    dereference: true,
    filter: (s) => !s.endsWith(".map") && !s.endsWith(".d.ts"),
  });
}
// Disable the optional upstream debug-server/eval facility in classroom builds.
const worker = path.join(root, "lucivy-wasm/js/lucivy-worker.js");
let w = await readFile(worker, "utf8");
const start = w.indexOf("// ── Diag:");
const end = w.indexOf("// Hook: intercept");
if (start < 0 || end < start)
  throw Error("Lucivy diagnostic patch no longer matches locked version");
w =
  w.slice(0, start) +
  "function diagSendLog() {}\nfunction diagFlush() {}\n" +
  w.slice(end);
await writeFile(worker, w);
const tf = path.dirname(require.resolve("@huggingface/transformers"));
const dest = path.join(root, "transformers");
await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });
for (const f of [
  "transformers.min.js",
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
])
  await copyFile(path.join(tf, f), path.join(dest, f));
await copyFile(
  "node_modules/@huggingface/transformers/LICENSE",
  path.join(dest, "LICENSE"),
);
console.log(
  "Browser dependencies copied; optional Lucivy eval diagnostics disabled",
);

await copyFile("../../docs/licenses/lucivy-MIT.txt",path.join(root,"lucivy-wasm/LICENSE"));
