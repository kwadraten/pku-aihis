import fs from "node:fs/promises";
import path from "node:path";

// Publishes the Blazor WASM core into src/assets/core and keeps the Patchouli
// license and import manifest next to the other third-party notices.
const root = path.resolve(import.meta.dirname, "..");
const publish = path.join(root, "core-probe/publish/wwwroot");
const assets = path.join(root, "src/assets");
const core = path.join(assets, "core");
await fs.rm(core, { recursive: true, force: true });
await fs.cp(publish, core, {
  recursive: true,
  dereference: true,
  filter: (file) => !/\.(br|gz)$/.test(file),
});
await fs.mkdir(path.join(assets, "licenses"), { recursive: true });
await fs.copyFile(
  path.join(root, "vendor/patchouli/LICENSE"),
  path.join(assets, "licenses", "patchouli-LICENSE.txt"),
);
await fs.copyFile(
  path.join(root, "vendor/patchouli/manifest.json"),
  path.join(assets, "licenses", "patchouli-manifest.json"),
);
console.log("Published Blazor core to src/assets/core with Patchouli license/manifest");
