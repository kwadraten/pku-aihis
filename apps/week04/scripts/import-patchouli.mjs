import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

// Explicit source allowlist: no user databases, .env, private inputs or models.
const root = path.resolve(import.meta.dirname, '..');
const source = path.resolve(process.argv[2] || 'D:/code/patchouli');
const dest = path.join(root, 'vendor/patchouli');
const reusable = ['DocumentTreeValidator', 'DocumentMarkdownCompiler', 'DocumentBoxProjection', 'DocumentBoxPayloadSerializer', 'MarkdigMarkdownEngine'].map(name => `src/Patchouli.Infrastructure/Documents/${name}.cs`);
const tracked = execFileSync('git', ['ls-files', 'src/Patchouli.Core', 'src/Patchouli.Infrastructure/migrations', 'src/Patchouli.Infrastructure/Csl/FsharpCiteprocProcessor.cs', ...reusable, 'LICENSE'], {cwd: source, encoding: 'utf8'}).trim().split(/\r?\n/);
const files = [];
for (const name of tracked) {
  if (!(name.endsWith('.cs') || name.endsWith('.sql') || name === 'LICENSE')) continue;
  const data = await fs.readFile(path.join(source, name));
  const target = path.join(dest, name);
  await fs.mkdir(path.dirname(target), {recursive: true});
  await fs.writeFile(target, data);
  files.push({path: name, sha256: createHash('sha256').update(data).digest('hex')});
}
const manifest = {
  source_commit: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: source, encoding: 'utf8'}).trim(),
  source_mode: 'tracked files from working tree; hashes identify actual inputs',
  selected_files_modified: execFileSync('git', ['diff', '--name-only', 'HEAD', '--', ...tracked], {cwd: source, encoding: 'utf8'}).trim().split(/\r?\n/).filter(Boolean),
  files
};
await fs.writeFile(path.join(dest, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Copied ${files.length} allowlisted files; source ${manifest.source_commit}`);
