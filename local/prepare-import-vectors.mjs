// Local-only preparation. Preserve every imported field and bind vectors to exact text.
import {parseArgs} from 'node:util';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pipeline, env} from '../apps/week03/node_modules/@huggingface/transformers/dist/transformers.node.mjs';
import {validateCorpus} from '../apps/week03/src/lib/math.ts';

const {values} = parseArgs({options:{input:{type:'string',multiple:true},output:{type:'string'},'model-root':{type:'string'}}});
if (!values.input?.length || !values.output || !values['model-root'])
  throw Error('Usage: node local/prepare-import-vectors.mjs --input <JSONL or directory> [--input ...] --output <new directory> --model-root <downloaded models>');
const hash = data => createHash('sha256').update(data).digest('hex');
const model = JSON.parse(await fs.readFile(new URL('./models.json',import.meta.url),'utf8'))[0];
for (const name of model.files) {
  const bytes=await fs.readFile(path.join(values['model-root'],model.directory,name));
  if (hash(bytes)!==model.sha256[name]) throw Error(`Model version mismatch: ${name}`);
}
const files=[];
for (const name of values.input) {
  if ((await fs.stat(name)).isDirectory()) {
    for (const f of (await fs.readdir(name)).sort()) if (f.endsWith('.jsonl')) files.push(path.join(name,f));
  } else files.push(name);
}
const seen=new Set(), names=new Set(), inputs=[];
for(const file of files){
  const bytes=await fs.readFile(file), records=validateCorpus({records:bytes.toString('utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse)});
  const name=path.basename(file,'.jsonl')+'.vectors.json';
  if(names.has(name))throw Error('Duplicate output filename: '+name);
  names.add(name);
  for(const d of records){if(seen.has(d.id))throw Error('Duplicate ID: '+d.id);seen.add(d.id);}
  inputs.push({name,input_sha256:hash(bytes),records});
}
await fs.mkdir(values.output); // Do not overwrite a previous preparation.
env.allowRemoteModels=false;
env.localModelPath=path.resolve(values['model-root'])+'/';
const extract=await pipeline('feature-extraction',model.directory,{dtype:'q8',device:'cpu'});
const embedding={model:model.repo,revision:model.revision,dtype:'q8',pooling:'mean',normalize:true,
  dimensions:384,max_tokens:512,runtime:'Transformers.js 3.8.1',device:'cpu',computed_at:new Date().toISOString()};
let completed=0;
const receipts=[];
for(const input of inputs){
  for(const d of input.records){
    const result=await extract(d.text,{pooling:'mean',normalize:true,truncation:true,max_length:512});
    d.vector=Array.from(result.data);
    d.embedding_text_sha256=hash(d.text);
    if(++completed%100===0)console.log(`Encoded ${completed}/${seen.size}`);
  }
  const corpus={manifest:{embedding,input_sha256:input.input_sha256,scope:'locally computed import; no automatic publication'},records:input.records};
  validateCorpus(corpus);
  const body=JSON.stringify(corpus);
  await fs.writeFile(path.join(values.output,input.name),body,{flag:'wx'});
  receipts.push({file:input.name,input_sha256:input.input_sha256,records:input.records.length,sha256:hash(body)});
  console.log(`Saved ${input.name}: ${input.records.length} records`);
}
await fs.writeFile(path.join(values.output,'preparation.json'),JSON.stringify({embedding,total_records:completed,files:receipts},null,2)+'\n',{flag:'wx'});
console.log(`Completed ${completed} genuine model embeddings; original text retained (model truncates at 512 tokens).`);
