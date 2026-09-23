import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {validateCorpus} from '../apps/week03/src/lib/math.ts';

const root = new URL('../data/week03/cross-domain/', import.meta.url);
const summary = JSON.parse(readFileSync(new URL('audit/summary.json', root), 'utf8'));
let total = 0;
for (const file of readdirSync(new URL('imports/', root)).sort()) {
  const text = readFileSync(new URL(`imports/${file}`, root), 'utf8');
  // Same JSONL parsing and validator as D01's importFile / replaceCorpus.
  const records = text.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  const imported = validateCorpus({records});
  assert.equal(imported.length, records.length);
  for (const doc of imported) {
    assert(doc.title && doc.author && doc.source_url && doc.locator && doc.status);
    assert(!doc.vector, 'Imported text must not claim embeddings from the default corpus');
  }
  total += imported.length;
}
assert.equal(total, summary.included_records);
console.log(`D01 import validation passed: ${summary.included_sources} files, ${total} records.`);
