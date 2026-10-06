import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

// The Stencil bundle consumes the migrations through the generated TypeScript
// module; this test pins that contract without a browser.
const root = path.resolve(import.meta.dirname, "..");
execFileSync(process.execPath, ["scripts/gen-migrations.mjs"], {
  cwd: root,
  stdio: "pipe",
});
const generated = await fs.readFile(
  path.join(root, "src/lib/migrations.generated.ts"),
  "utf8",
);
const dir = path.join(
  root,
  "vendor/patchouli/src/Patchouli.Infrastructure/migrations",
);
const files = (await fs.readdir(dir))
  .filter((f) => f.endsWith(".sql"))
  .sort();
assert.equal(files.length, 41, "Patchouli ships 41 SQL migrations");
for (const file of files) {
  assert(
    generated.includes(JSON.stringify(file)),
    `generated module is missing migration ${file}`,
  );
  const sql = await fs.readFile(path.join(dir, file), "utf8");
  assert(
    generated.includes(JSON.stringify(sql)),
    `generated module has stale SQL for ${file}`,
  );
}
assert(
  generated.includes("PATCHOULI_MANIFEST"),
  "generated module embeds the Patchouli import manifest for backup provenance",
);
console.log(`migrations.generated.ts covers all ${files.length} migrations`);
