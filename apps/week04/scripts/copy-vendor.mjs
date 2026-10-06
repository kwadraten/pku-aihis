import { mkdir, copyFile, writeFile, cp } from "node:fs/promises";
import path from "node:path";

// Vendored browser assets for the Stencil build; everything here is a copy of a
// locked npm artifact so the classroom build needs no node_modules at runtime.
const assets = path.resolve("src/assets");
await mkdir(path.join(assets, "vendor"), { recursive: true });
await mkdir(path.join(assets, "licenses"), { recursive: true });

await copyFile(
  "node_modules/@sqlite.org/sqlite-wasm/dist/sqlite3.wasm",
  path.join(assets, "vendor", "sqlite3.wasm"),
);
await copyFile(
  "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
  path.join(assets, "vendor", "pdf.worker.min.mjs"),
);
await copyFile(
  "node_modules/pdfjs-dist/LICENSE",
  path.join(assets, "licenses", "pdfjs-dist-LICENSE.txt"),
);
await writeFile(
  path.join(assets, "licenses", "sqlite-wasm-NOTICE.txt"),
  [
    "@sqlite.org/sqlite-wasm 3.53.4-build2",
    "License: Apache-2.0 (see https://github.com/sqlite/sqlite-wasm)",
    "sqlite3.wasm is copied unmodified from the locked npm package;",
    "the SQLite engine itself remains © SQLite contributors, public domain.",
    "",
  ].join("\n"),
);
console.log("Vendored sqlite3.wasm and pdf.worker.min.mjs into src/assets/vendor");
await cp('node_modules/pdfjs-dist/wasm',path.join(assets,'vendor/pdf-wasm'),{recursive:true});
await cp('node_modules/pdfjs-dist/cmaps',path.join(assets,'vendor/cmaps'),{recursive:true});
await cp('node_modules/pdfjs-dist/standard_fonts',path.join(assets,'vendor/standard_fonts'),{recursive:true});
