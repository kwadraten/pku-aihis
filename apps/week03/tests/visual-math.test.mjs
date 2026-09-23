import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {cosine,rocchio,rankVectors,rrf,bm25} from '../src/lib/math.ts';
test('改变长度不改变余弦，但改变点积与端点距离',()=>{
 const q=[1,0],d=[0.6,0.8],long=[1.2,1.6];
 assert.equal(cosine(q,d),cosine(q,long));
 assert.notEqual(q[0]*d[0],q[0]*long[0]);
 assert.ok(Math.abs(d.reduce((s,x,i)=>s+(x-q[i])**2,0)-(2-2*cosine(q,d)))<1e-12);
});
test('Rocchio反馈确实改变完整向量排序；未判断不等于负反馈',()=>{
 const q=[1,0],docs=[{id:'a',vector:[1,0]},{id:'b',vector:[0,1]}];
 assert.equal(rankVectors(docs,q)[0].id,'a');
 assert.equal(rankVectors(docs,rocchio(q,[[0,1]],[],1,2,0))[0].id,'b');
 assert.deepEqual(rocchio(q,[],[]),q);
});
test('RRF较大的c减弱名次优势；BM25 b=0消除同词频文长差异',()=>{
 const gap=c=>{const r=rrf([[{id:'a'},{id:'b'}]],c);return r[0].score-r[1].score};
 assert.ok(gap(60)<gap(1));
 const r=bm25([{id:'a',text:'宗教'},{id:'b',text:'宗教 政治 歴史 学問'}],'宗教',{mode:'word',b:0});
 assert.equal(r[0].score,r[1].score);
});
test('稀疏实例逐条对应当前原文；阈值升高只能减少非零项',()=>{
 const root=new URL('../src/assets/data/',import.meta.url);
 const sparse=JSON.parse(fs.readFileSync(new URL('neural-sparse.json',root)));
 const corpus=JSON.parse(fs.readFileSync(new URL('corpus.json',root)));
 assert.equal(sparse.records.length,corpus.records.length);
 assert.equal(sparse.revision,'1e0f096c2b51c234f1d20725c793e1b5b6d556db');
 assert.ok(sparse.parameters<10e9);
 for(const d of corpus.records){
  const r=sparse.records.find(x=>x.id===d.id);
  assert.equal(r.input_text,d.text);
  assert.equal(r.text_sha256,crypto.createHash('sha256').update(d.text).digest('hex'));
  assert.ok(r.weights.every(x=>Number.isFinite(x.weight)&&x.weight>0));
  const max=r.weights[0].weight;
  assert.ok(r.weights.filter(x=>x.weight>max*.8).length<=r.weights.filter(x=>x.weight>max*.1).length);
 }
});
