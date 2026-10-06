import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const source = path.resolve(process.argv[2] || 'D:/code/presentation-pku-aihis/.agents/skills/guizang-ppt-skill');
const target = path.resolve(import.meta.dirname, '../.agents/skills/guizang-ppt-skill');
try {await fs.access(target); throw new Error('Target already exists; refusing to overwrite');} catch (error) {if (error.code !== 'ENOENT') throw error;}
const records = [], excluded = [];
async function copy(relative = '') {
  for (const entry of await fs.readdir(path.join(source, relative), {withFileTypes: true})) {
    const name = path.join(relative, entry.name), normalized = name.replaceAll('\\', '/');
    if (['node_modules', '.git', '.stencil', 'dist', 'www'].includes(entry.name) || /^\.env/.test(entry.name) || /\.(log|zip|key|pem)$/.test(entry.name) || entry.isSymbolicLink()) {excluded.push(normalized); continue;}
    if (entry.isDirectory()) {await copy(name); continue;}
    const bytes = await fs.readFile(path.join(source, name));
    await fs.mkdir(path.dirname(path.join(target, name)), {recursive: true});
    await fs.copyFile(path.join(source, name), path.join(target, name));
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (createHash('sha256').update(await fs.readFile(path.join(target, name))).digest('hex') !== sha256) throw new Error(`Copy mismatch: ${name}`);
    records.push({path: normalized, sha256});
  }
}
await copy();
await fs.writeFile(path.join(target, 'INSTALLATION_MANIFEST.json'), JSON.stringify({source, copied_at: new Date().toISOString(), method: 'unmodified copies; dependencies/build caches excluded', files: records, excluded}, null, 2) + '\n');
console.log(`Copied and SHA-256 verified ${records.length} files, excluded ${excluded.length} paths`);
