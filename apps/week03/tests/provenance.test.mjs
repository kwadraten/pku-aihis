import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sourceLocation, sourceLabel, sourceWebURL, localOriginalURL} from '../src/lib/provenance.ts';

test('ebook and forum locators do not become missing PDF pages',()=>{
  const book={title:'Republic',author:'Plato',locator:'Book II'};
  assert.equal(sourceLabel(book),'Republic · Book II · Plato');
  assert.equal(sourceLocation({locator:'上游第 8 条'}),'上游第 8 条');
  assert.equal(sourceLocation({pdf_page:12,printed_page:'九'}),'PDF 第 12 页 / 原书 九');
});
test('source links allow web schemes and local originals only on loopback',()=>{
  assert.equal(sourceWebURL({source_url:'javascript:alert(1)'}),null);
  assert.equal(sourceWebURL({source_url:'https://key@example.org/'}),null);
  assert.equal(sourceWebURL({source_url:'https://example.org/book'}),'https://example.org/book');
  assert.equal(localOriginalURL({raw_file:'originals/paper.pdf',pdf_page:3},'127.0.0.1'),'/api/corpus-source/originals%2Fpaper.pdf#page=3');
  assert.equal(localOriginalURL({raw_file:'originals/paper.pdf'},'lyzhackjp.github.io'),null);
  assert.equal(localOriginalURL({raw_file:'originals/../secret.txt'},'localhost'),null);
});
