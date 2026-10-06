import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
test('31 approved pages have aligned IDs, titles, notes and actual components',async()=>{
 const map=JSON.parse(await fs.readFile('../../docs/week04/page-map.json'));
 const html=await fs.readFile('src/index.html','utf8');
 const ids=[...html.matchAll(/<deck-slide slide-id="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(ids,map.map(p=>p.id));assert.equal(new Set(ids).size,31);
 assert(!/占位|mock|TODO/.test(html));
 for(const p of map){const block=html.split(`slide-id="${p.id}"`)[1].split('</deck-slide>')[0];assert(block.includes('notes="目的：'));assert(block.includes('机制背景：'));}
 const tags=[...html.matchAll(/<([a-z]+-[a-z-]+)[\s>]/g)].map(m=>m[1]);
 const files=await fs.readdir('src/components',{recursive:true});
 const source=(await Promise.all(files.filter(f=>f.endsWith('.tsx')).map(f=>fs.readFile('src/components/'+f,'utf8')))).join('\n');
 for(const tag of tags)assert(source.includes(`tag: '${tag}'`)||source.includes(`tag:'${tag}'`)||source.includes(`tag: "${tag}"`),`unregistered ${tag}`);
});
test('single native subset includes four verified PDFs',async()=>{
 const seed=JSON.parse(await fs.readFile('src/assets/seed/native-seed.json'));
 assert.equal(seed.rows.items,4);assert.equal(seed.rows.pages,353);assert.equal(seed.pdfs.length,4);
 const {createHash}=await import('node:crypto');
 for(const e of [seed.database,...seed.pdfs])assert.equal(createHash('sha256').update(await fs.readFile('src/assets/seed/'+e.path)).digest('hex'),e.sha256);
 await assert.rejects(fs.access('src/assets/seed/seed.json'));
});
