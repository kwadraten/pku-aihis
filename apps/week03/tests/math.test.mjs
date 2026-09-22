import test from 'node:test';import assert from 'node:assert/strict';import {bm25,cosine,rrf,metrics,chunks,validateCorpus} from '../src/lib/math.ts';
test('字面检索不为零命中制造结果；参数与长度可解释',()=>{const d=[{id:'a',text:'宗教 宗教'},{id:'b',text:'宗教 国家 道德'}];assert.equal(bm25(d,'不存在').length,0);const r=bm25(d,'宗教',{mode:'word'});assert.equal(r[0].id,'a');assert.ok(r[0].parts[0].idf>0);});
test('余弦约束与零向量',()=>{assert.equal(cosine([1,0],[0,1]),0);assert.equal(cosine([2,0],[1,0]),1);assert.throws(()=>cosine([0,0],[1,2]));assert.throws(()=>cosine([1],[1,2]));});
test('RRF缺席不贡献且使用名次',()=>{const r=rrf([[{id:'a'},{id:'b'}],[{id:'b'}]],60);assert.equal(r[0].id,'b');assert.ok(Math.abs(r[0].score-1/62-1/61)<1e-12);});
test('nDCG理想排序包含检索之外的高相关项',()=>{const r=metrics(['a'],{a:1,b:3},1);assert.equal(r.ndcg,1/7);assert.equal(r.precision,1);assert.equal(r.recall,null);assert.equal(metrics(['z'],{a:1},1).unjudged,1);});
test('分块覆盖与输入检查',()=>{assert.deepEqual(chunks('123456',4,2).map(x=>x.text),['1234','3456']);assert.throws(()=>chunks('abc',2,2));assert.throws(()=>validateCorpus([{id:'a',text:'a'},{id:'a',text:'b'}]));});
