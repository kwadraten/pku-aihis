import {ImportMetadata,validateImportMetadata} from './import-metadata';
import {liveLibrary} from './live-library';
import {openPdf,extractText,renderPdf} from './pdf';
import {blake3} from '@noble/hashes/blake3.js';
import {bytesToHex} from '@noble/hashes/utils.js';
import {isOcrReady,ocrImage,ocrModelVersions} from './ocr';

export type PdfProgress={busy:boolean;phase:string;documentId?:string;page:number;total:number;completed:number;skipped:number;empty:number;detail:string};
type Options={mode?:'text'|'auto'|'ocr';from?:number;to?:number;replace?:boolean;signal?:AbortSignal;onProgress?:(p:PdfProgress)=>void;metadata?:ImportMetadata[]};
class PdfWorkflow {
 state:PdfProgress={busy:false,phase:'idle',page:0,total:0,completed:0,skipped:0,empty:0,detail:''};
 private listeners=new Set<(p:PdfProgress)=>void>();
 private controller:AbortController;
 subscribe(fn:(p:PdfProgress)=>void){this.listeners.add(fn);fn(this.state);return()=>this.listeners.delete(fn);}
 private update(p:Partial<PdfProgress>,opts?:Options){this.state={...this.state,...p};for(const fn of this.listeners)fn(this.state);opts?.onProgress?.(this.state);}
 cancel(){this.controller?.abort();}
 private start(){if(this.state.busy)throw Error('已有PDF处理任务在运行');this.controller=new AbortController();this.update({busy:true,phase:'running',page:0,total:0,completed:0,skipped:0,empty:0,detail:'读取PDF…'});}
 async import(files:File[],targetItem:string|null=null,opts:Options={}){
  const lib=liveLibrary.getLibrary();const target=targetItem?lib.items().find(i=>i.item_id===targetItem):null;const metadata=files.map((file,index)=>validateImportMetadata(opts.metadata?.[index]||target&&{title:target.title,authors:lib.rows("select * from item_creators where item_id=? and role='author' order by sequence_index",[targetItem])}));this.start();const results=[];
  try{
   for(const [fileIndex,file]of files.entries()){
    this.controller.signal.throwIfAborted();opts.signal?.throwIfAborted();
    const lib=liveLibrary.getLibrary();if(!lib)throw Error('书库未就绪');
    const bytes=new Uint8Array(await file.arrayBuffer()),hash=bytesToHex(blake3(bytes));
    const existing=lib.rows('select d.document_instance_id,d.item_id,d.file_asset_id from document_instances d join file_assets f on d.file_asset_id=f.file_asset_id where f.full_blake3=?',[hash])[0];
    let doc:string,item:string;
    if(existing){doc=existing.document_instance_id;item=existing.item_id;if(!lib.files[existing.file_asset_id])await lib.rebind(existing.file_asset_id,file);}
    else{
     const pdf=await openPdf(bytes.slice());const infos=[];
     try{for(let n=1;n<=pdf.numPages;n++){this.controller.signal.throwIfAborted();const p=await pdf.getPage(n),v=p.getViewport({scale:1});infos.push({width:v.width,height:v.height,rotation:p.rotate});}}finally{await pdf.destroy();}
     const imported=await lib.importPdf({name:file.name,arrayBuffer:async()=>bytes.buffer as ArrayBuffer},infos,targetItem);doc=imported.document;item=imported.item;
    }
    const meta=metadata[fileIndex];await lib.saveMetadata(item,{...meta.fields,title:meta.title},meta.authors,meta.issued);results.push({document:doc,item,duplicate:!!existing});
    await this.processDocument(doc,opts);
   }
   this.update({phase:'done',detail:`已保存 ${results.length} 份PDF；可检索正文已提交。扫描空页可选范围继续OCR。`},opts);
   return results;
  }catch(error){const cancelled=this.controller.signal.aborted||opts.signal?.aborted||error.name==='AbortError';this.update({phase:cancelled?'cancelled':'error',detail:cancelled?'已取消；已完成页保留，可继续处理。':error.message},opts);throw error;}
  finally{this.update({busy:false},opts);}
 }
 async process(documentId:string,opts:Options={}){
  this.start();try{await this.processDocument(documentId,opts);this.update({phase:'done',detail:`处理完成：${this.state.completed}页新提交、${this.state.skipped}页保留、${this.state.empty}页无文字。`},opts);}
  catch(error){const cancelled=this.controller.signal.aborted||opts.signal?.aborted||error.name==='AbortError';this.update({phase:cancelled?'cancelled':'error',detail:cancelled?'已取消；已完成页保留，可继续处理。':error.message},opts);throw error;}
  finally{this.update({busy:false},opts);}
 }
 private async processDocument(doc:string,opts:Options){
  const lib=liveLibrary.getLibrary(),document=lib.rows('select * from document_instances where document_instance_id=?',[doc])[0];
  const file=document&&lib.files[document.file_asset_id];if(!file)throw Error('PDF未绑定，请按原哈希重新绑定');
  const pages=lib.pages(doc),from=opts.from??1,to=opts.to??pages.length;
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<1||to>pages.length||to<from)throw Error('页码范围无效');
  if(opts.mode==='ocr'&&!isOcrReady())throw Error('先在模型接入中加载OCR模型');
  const pdf=await openPdf(file.data.slice());let run:string=null;
  this.update({documentId:doc,page:from,total:to-from+1,completed:0,skipped:0,empty:0},opts);
  try{
   for(const page of pages.slice(from-1,to)){
    this.controller.signal.throwIfAborted();opts.signal?.throwIfAborted();
    const index=page.page_index+1;this.update({page:index,detail:`${file.name} · 第${index}页`},opts);
    if(!opts.replace&&lib.pageTree(page.page_id).revision){this.update({skipped:this.state.skipped+1},opts);continue;}
    let lines:any[]=opts.mode==='ocr'?[]:await extractText(pdf,page.page_index),source='import',engine='PDF.js embedded text',versions:any=null;
    if(!lines.length&&(opts.mode==='ocr'||opts.mode==='auto'&&isOcrReady())){
     run ||= await lib.startOcr(doc,'PP-OCRv4',{model_versions:ocrModelVersions(),raster_scale:1.5});
     const canvas=window.document.createElement('canvas');await renderPdf(pdf,page.page_index,canvas,1.5);
     const result=await ocrImage(canvas,{signal:this.controller.signal,onProgress:detail=>this.update({detail:`第${index}页 · ${detail}`},opts)});
     lines=result.lines.map(l=>({text:l.text,x:l.bbox[0],y:l.bbox[1],width:l.bbox[2],height:l.bbox[3],confidence:l.confidence}));
     source='ocr_adopted';engine=result.engine;versions=result.model_versions;
    }
    this.controller.signal.throwIfAborted();opts.signal?.throwIfAborted();
    if(lines.length){
     await lib.commitPages(doc,[{pageId:page.page_id,boxes:lines.map(l=>({...l,type:'text'}))}],source,JSON.stringify({engine,models:versions,page:index,mode:opts.mode||'text'}),null,source==='ocr_adopted'?run:null);
     this.update({completed:this.state.completed+1},opts);
    }else this.update({empty:this.state.empty+1,detail:`第${index}页未提取到文字；PDF已保存，未造空修订。`},opts);
    await new Promise(r=>setTimeout(r,0));
   }
  }catch(error){if(run)await lib.failOcr(run,this.controller.signal.aborted||opts.signal?.aborted?new DOMException('已取消','AbortError'):error);throw error;}
  finally{await pdf.destroy();}
 }
}
export const pdfWorkflow=new PdfWorkflow();
