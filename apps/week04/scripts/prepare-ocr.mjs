import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const dir=path.resolve('src/assets/ocr');
await fs.mkdir(dir,{recursive:true});
const base='https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.9.2/onnx/PP-OCRv4/';
const models=[
 ['det','det/ch_PP-OCRv4_det_mobile.onnx','d2a7720d45a54257208b1e13e36a8479894cb74155a5efe29462512d42f49da9'],
 ['rec','rec/ch_PP-OCRv4_rec_mobile.onnx','48fc40f24f6d2a207a2b1091d3437eb3cc3eb6b676dc3ef9c37384005483683b'],
 ['cls','cls/ch_ppocr_mobile_v2.0_cls_mobile.onnx','e47acedf663230f8863ff1ab0e64dd2d82b838fceb5957146dab185a89d6215c'],
];
const records=[];
const dictionary=await fs.readFile(path.join(dir,'keys.json'));
if(createHash('sha256').update(dictionary).digest('hex')!=='38a33dd2f1248709fd769a115956e8b9e8e86b6c9af36d4d9cf0120bdac16311')throw Error('OCR dictionary differs from fixed recognition model metadata');
for(const [kind,relative,sha256] of models){
 const file=kind+'.onnx',url=base+relative;
 let bytes=await fs.readFile(path.join(dir,file)).catch(()=>null);
 if(!bytes||createHash('sha256').update(bytes).digest('hex')!==sha256){
  const r=await fetch(url);if(!r.ok)throw Error(`${r.status}: ${url}`);
  bytes=Buffer.from(await r.arrayBuffer());
  if(createHash('sha256').update(bytes).digest('hex')!==sha256)throw Error('Model hash mismatch: '+kind);
  await fs.writeFile(path.join(dir,file),bytes);
 }
 records.push({kind,file,url,sha256,bytes:bytes.length});
 console.log(kind,bytes.length,sha256);
}
for(const file of ['ort-wasm-simd-threaded.wasm','ort-wasm-simd-threaded.mjs'])
 await fs.copyFile('node_modules/onnxruntime-web/dist/'+file,path.join(dir,file));
await fs.writeFile(path.join(dir,'models.json'),JSON.stringify({runtime:'onnxruntime-web 1.23.2',source:'RapidAI/RapidOCR v3.9.2',dictionary:{file:'keys.json',sha256:'38a33dd2f1248709fd769a115956e8b9e8e86b6c9af36d4d9cf0120bdac16311',source:'character metadata of the pinned rec ONNX model'},models:records},null,2));
