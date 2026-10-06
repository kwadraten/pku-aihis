import * as ort from 'onnxruntime-web/wasm';
export const engine = 'RapidOCR models / PP-OCRv4 · ONNX Runtime Web';
const url=(p:string)=>new URL('assets/ocr/'+p,document.baseURI).href;
let sessions: {det:ort.InferenceSession;rec:ort.InferenceSession;cls:ort.InferenceSession;keys:string[];versions:any};
let pending:Promise<void>;
export const isOcrReady=()=>!!sessions;
export const ocrModelVersions=()=>sessions?.versions||null;
export function preloadOcr(){return pending ||= load().catch(e=>{pending=null;throw e;});}
async function load(){
 ort.env.wasm.wasmPaths=url(''); ort.env.wasm.numThreads=1; ort.env.wasm.proxy=false;
 const manifest=await (await fetch(url('models.json'))).json();
 const get=async(kind:string)=>{
  const m=manifest.models.find((x:any)=>x.kind===kind),r=await fetch(url(m.file));
  if(!r.ok)throw Error(`OCR ${kind}: HTTP ${r.status}`);
  const bytes=await r.arrayBuffer(),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
  if(digest!==m.sha256)throw Error('OCR 模型校验失败：'+kind);
  return ort.InferenceSession.create(bytes,{executionProviders:['wasm']});
 };
 const [det,rec,cls,keys]=await Promise.all([get('det'),get('rec'),get('cls'),fetch(url('keys.json')).then(r=>r.json())]);
 sessions={det,rec,cls,keys:['',...keys,' '],versions:Object.fromEntries(manifest.models.map((m:any)=>[m.kind,m.sha256]))};
 window.dispatchEvent(new CustomEvent('ocr-ready'));
}
function tensor(image:HTMLCanvasElement,w:number,h:number,det=false){
 const c=document.createElement('canvas');c.width=w;c.height=h;
 const g=c.getContext('2d');g.fillStyle='white';g.fillRect(0,0,w,h);g.drawImage(image,0,0,w,h);
 const a=g.getImageData(0,0,w,h).data,out=new Float32Array(3*w*h);
 const mean=det?[.485,.456,.406]:[.5,.5,.5],std=det?[.229,.224,.225]:[.5,.5,.5];
 for(let i=0;i<w*h;i++)for(let ch=0;ch<3;ch++)out[ch*w*h+i]=(a[4*i+ch]/255-mean[ch])/std[ch];
 return new ort.Tensor('float32',out,[1,3,h,w]);
}
async function run(s:ort.InferenceSession,t:ort.Tensor){return (await s.run({[s.inputNames[0]]:t}))[s.outputNames[0]];}
export async function ocrImage(image:HTMLCanvasElement|ImageData,opts:{signal?:AbortSignal;onProgress?:(message:string)=>void}={}){
 await preloadOcr();opts.signal?.throwIfAborted();
 let canvas:HTMLCanvasElement;
 if(image instanceof ImageData){canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d').putImageData(image,0,0);}else canvas=image;
 const scale=Math.min(1,960/Math.max(canvas.width,canvas.height));
 const w=Math.max(32,Math.round(canvas.width*scale/32)*32),h=Math.max(32,Math.round(canvas.height*scale/32)*32);
 const prob=await run(sessions.det,tensor(canvas,w,h,true)),pw=Number(prob.dims.at(-1)),ph=Number(prob.dims.at(-2)),data=prob.data as Float32Array;
 // Connected components of the DB probability mask; axis-aligned boxes and
 // proportional expansion. This browser adaptation does not claim upstream
 // polygon/unclip equivalence and exposes its geometry as normalized bboxes.
 const seen=new Uint8Array(pw*ph),boxes:number[][]=[];
 for(let i=0;i<seen.length;i++){
  if(seen[i]||data[i]<.3)continue;
  const q=[i];seen[i]=1;let n=0,sum=0,x0=pw,y0=ph,x1=0,y1=0;
  for(let k=0;k<q.length;k++){const at=q[k],x=at%pw,y=Math.floor(at/pw);n++;sum+=data[at];x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
   for(const j of [x>0?at-1:-1,x<pw-1?at+1:-1,y>0?at-pw:-1,y<ph-1?at+pw:-1])if(j>=0&&!seen[j]&&data[j]>=.3){seen[j]=1;q.push(j);}
  }
  if(n<6||sum/n<.5)continue;
  const margin=Math.max(2,(y1-y0)*.5);
  boxes.push([Math.max(0,(x0-margin)/pw),Math.max(0,(y0-margin)/ph),Math.min(1,(x1+margin+1)/pw),Math.min(1,(y1+margin+1)/ph)]);
 }
 boxes.sort((a,b)=>Math.abs(a[1]-b[1])<.01?a[0]-b[0]:a[1]-b[1]);
 opts.onProgress?.(`检测到 ${boxes.length} 个候选区域，逐行识别中…`);
 const lines=[];
 for(const b of boxes.slice(0,300)){
  // Yield to browser input between inference steps so Cancel can be delivered.
  await new Promise<void>(resolve=>setTimeout(resolve,0));
  opts.signal?.throwIfAborted();
  const crop=document.createElement('canvas');crop.width=Math.max(1,Math.round((b[2]-b[0])*canvas.width));crop.height=Math.max(1,Math.round((b[3]-b[1])*canvas.height));
  const g=crop.getContext('2d');g.drawImage(canvas,b[0]*canvas.width,b[1]*canvas.height,crop.width,crop.height,0,0,crop.width,crop.height);
  const cls=await run(sessions.cls,tensor(crop,192,48)),cl=cls.data as Float32Array;
  if(cl[1]>.9&&cl[1]>cl[0]){g.translate(crop.width,crop.height);g.rotate(Math.PI);g.drawImage(crop,0,0);g.setTransform(1,0,0,1,0,0);}
  const rw=Math.max(16,Math.min(2048,Math.ceil(48*crop.width/crop.height)));
  const rec=await run(sessions.rec,tensor(crop,rw,48)),scores=rec.data as Float32Array,C=Number(rec.dims.at(-1)),T=Number(rec.dims.at(-2));
  let text='',confidence=0,count=0,last=-1;
  for(let t=0;t<T;t++){let best=0;for(let c=1;c<C;c++)if(scores[t*C+c]>scores[t*C+best])best=c;
   if(best!==0&&best!==last){text+=sessions.keys[best]||'';confidence+=scores[t*C+best];count++;}last=best;
  }
  if(text.trim())lines.push({text,bbox:[b[0],b[1],b[2]-b[0],b[3]-b[1]] as [number,number,number,number],confidence:count?confidence/count:0});
  opts.onProgress?.(`已识别 ${lines.length} 行，处理区域 ${boxes.indexOf(b)+1}/${Math.min(300,boxes.length)}`);
 }
 return {lines,engine,model_versions:sessions.versions};
}
