import {Component,h,State,Prop} from '@stencil/core';
import {liveLibrary} from '../../lib/live-library';
import {pdfWorkflow,PdfProgress} from '../../lib/pdf-workflow';
import {isOcrReady} from '../../lib/ocr';
import {selectItem} from '../../lib/research-context';
@Component({tag:'pdf-importer',shadow:false})
export class PdfImporter{
 @Prop() itemId='';@Prop() documentId='';@Prop() preferredMode:'text'|'auto'|'ocr'='text';
 @State() mode:'text'|'auto'|'ocr'='text';@State() target='new';@State() from=1;@State() to=1;@State() replace=false;
 @State() importTitle='';@State() importAuthor='';@State() progress:PdfProgress=pdfWorkflow.state;@State() error='';@State() ocrReady=isOcrReady();
 private off:()=>void;private ready=()=>this.ocrReady=isOcrReady();
 componentWillLoad(){this.mode=this.preferredMode;this.off=pdfWorkflow.subscribe(p=>this.progress={...p});window.addEventListener('ocr-ready',this.ready);}
 disconnectedCallback(){this.off?.();window.removeEventListener('ocr-ready',this.ready);}
 private async import(files:File[]){this.error='';try{const results=await pdfWorkflow.import(files,this.target==='current'?this.itemId:null,{mode:this.mode,metadata:this.target==='new'?files.map(()=>({title:this.importTitle,authors:this.importAuthor.split(/[;；\n]/).filter(name=>name.trim()).map(name=>({role:'author',literal:name.trim()}))})):undefined});if(results.length)selectItem(results.at(-1).item);}catch(e){this.error=pdfWorkflow.state.phase==='cancelled'?'':e.message;}}
 render(){const lib=liveLibrary.getLibrary(),pages=this.documentId&&lib?lib.pages(this.documentId):[];
  return <section class="pdf-import-panel">
   <div class="work-form-row"><label>文字处理<select aria-label="文字处理方式" disabled={this.progress.busy} onChange={(e:any)=>this.mode=e.target.value}><option value="text" selected={this.mode==='text'}>提取PDF文字层</option><option value="auto" selected={this.mode==='auto'}>文字层优先，扫描页OCR</option><option value="ocr" selected={this.mode==='ocr'}>扫描页RapidOCR</option></select></label><label>导入到<select aria-label="PDF归属" disabled={this.progress.busy} onChange={(e:any)=>this.target=e.target.value}><option value="new" selected={this.target==='new'}>新建题录</option><option selected={this.target==='current'} value="current" disabled={!this.itemId}>当前题录的附件</option></select></label></div>
   {this.target==='new'&&<div class="work-form-row"><label>题名<input aria-label="导入题名" value={this.importTitle} onInput={(e:any)=>this.importTitle=e.target.value}/></label><label>作者<input aria-label="导入作者" value={this.importAuthor} onInput={(e:any)=>this.importAuthor=e.target.value}/></label></div>}
   {this.mode!=='text'&&!this.ocrReady&&<p class="work-message">扫描页识别需要加载OCR模型。<button onClick={()=>window.dispatchEvent(new CustomEvent('open-model-settings'))}>加载模型</button></p>}
   <label class="pdf-drop" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!this.progress.busy)this.import(Array.from(e.dataTransfer.files).filter(f=>/\.pdf$/i.test(f.name)));}}>选择或拖入PDF，可多选<input aria-label="导入PDF文件" type="file" multiple accept=".pdf,application/pdf" disabled={this.progress.busy||!lib||this.mode==='ocr'&&!this.ocrReady} onChange={(e:any)=>{const files=Array.from(e.target.files) as File[];if(files.length)this.import(files);e.target.value='';}}/></label>
   <p class="work-hint">全文逐页处理；相同文件按BLAKE3定位到已有题录。未识别的扫描页保留PDF，随后可继续OCR。</p>
   {!!pages.length&&<fieldset><legend>当前附件：继续处理 / 校对后重识别</legend><div class="work-form-row"><label>起始页<input aria-label="处理起始页" type="number" min="1" max={pages.length} value={this.from} onInput={(e:any)=>this.from=Number(e.target.value)}/></label><label>结束页<input aria-label="处理结束页" type="number" min="1" max={pages.length} value={this.to} onInput={(e:any)=>this.to=Number(e.target.value)}/></label><button disabled={this.progress.busy} onClick={()=>{this.from=1;this.to=pages.length;}}>全篇 {pages.length} 页</button></div><label><input type="checkbox" checked={this.replace} onChange={(e:any)=>this.replace=e.target.checked}/>为已处理页提交新修订（旧引用保留）</label><button disabled={this.progress.busy||this.mode==='ocr'&&!this.ocrReady} onClick={async()=>{this.error='';try{await pdfWorkflow.process(this.documentId,{from:this.from,to:this.to,mode:this.mode,replace:this.replace});}catch(e){this.error=pdfWorkflow.state.phase==='cancelled'?'':e.message;}}}>处理所选页</button></fieldset>}
   {this.progress.busy&&<button onClick={()=>pdfWorkflow.cancel()}>取消处理</button>}
   <p role="status" class="work-message">{this.error||this.progress.detail||'等待文件'}{this.progress.total>0&&` · 新提交${this.progress.completed}页 / 保留${this.progress.skipped}页 / 无文字${this.progress.empty}页`}</p>
  </section>;
 }
}
