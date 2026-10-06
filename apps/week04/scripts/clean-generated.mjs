import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
// These three directories contain only generated outputs, never library data or source.
for (const relative of ['core-probe/publish', 'public/core', 'dist']) {
  const target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep) || target === root) throw new Error('Generated path escaped project');
  const info = await fs.lstat(target).catch(error => {if (error.code === 'ENOENT') return null; throw error;});
  if (info?.isSymbolicLink()) throw new Error(`Refusing to remove linked output: ${target}`);
  await fs.rm(target, {recursive: true, force: true});
}
console.log('Cleared generated publish/static outputs; browser library and source untouched');
