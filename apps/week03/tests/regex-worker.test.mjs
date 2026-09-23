import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const source = readFileSync(new URL('../src/assets/regex-worker.js', import.meta.url), 'utf8');
function run(text, pattern, replacement) {
  let result;
  const self = { postMessage: message => { result = message; } };
  runInNewContext(source, { self, RegExp, Math, Error, String });
  self.onmessage({ data: { text, pattern, replacement } });
  return result;
}

test('正则匹配与替换副本的高亮跨度相符', () => {
  const result = run('宗教、宗敎', '宗[教敎]', '【$&】');
  assert.equal(result.matches.length, 2);
  assert.equal(result.replacement_preview, '【宗教】、【宗敎】');
  assert.equal(result.replacement_spans.map(part => part.text).join(''), result.replacement_preview);
  assert.equal(result.replacement_spans.filter(part => part.changed).length, 2);
});

test('零命中与无效表达式明确返回', () => {
  const empty = run('宗教', '佛教', 'X');
  assert.equal(empty.matches.length, 0);
  assert.equal(empty.replacement_preview, '宗教');
  assert.equal(empty.replacement_spans.some(part => part.changed), false);
  assert.match(run('宗教', '(', 'X').error, /SyntaxError/);
});
