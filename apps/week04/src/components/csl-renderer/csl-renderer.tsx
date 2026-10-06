import {Component,h,State} from '@stencil/core';
import {liveLibrary} from '../../lib/live-library';
import {CSL_STYLES,loadCslStyle,cslChoice} from '../../lib/styles';
import {selectedItem} from '../../lib/research-context';

@Component({tag:'csl-renderer',shadow:false})
export class CslRenderer {
 @State() styleId='mla';@State() locale='en-US';@State() record:any;@State() rendered='';@State() error='';@State() busy=false;
 private off:()=>void;private generation=0;private loadedDb:any;
 private selection=()=>void this.renderCsl();
 componentWillLoad(){window.addEventListener('research-selection',this.selection);this.off=liveLibrary.subscribe(state=>{if(state!=='ready')return;const lib=liveLibrary.getLibrary();if(this.loadedDb!==lib.db){this.loadedDb=lib.db;Object.assign(this,cslChoice(lib.db));}void this.renderCsl();});}
 disconnectedCallback(){this.generation++;this.off?.();window.removeEventListener('research-selection',this.selection);}
 private async renderCsl(){const lib=liveLibrary.getLibrary();if(!lib)return;const token=++this.generation;this.record=lib.csl().find(record=>record.id===selectedItem())||lib.csl()[0];if(!this.record)return;Object.assign(cslChoice(lib.db),{styleId:this.styleId,locale:this.locale});this.busy=true;this.error='';try{const xml=await loadCslStyle(this.styleId);const result=await window.DotNet.invokeMethodAsync('CoreProbe','RenderCsl',xml,JSON.stringify([this.record]),this.locale);if(token===this.generation)this.rendered=result;}catch(error){if(token===this.generation){this.error=error.message;this.rendered='';}}finally{if(token===this.generation)this.busy=false;}}
 render(){const choice=CSL_STYLES.find(style=>style.id===this.styleId);return <div class="w12-lab"><div class="w12-controls lab-toolbar"><label>CSL样式<select aria-label="选择样式" onChange={(event:any)=>{this.styleId=event.target.value;this.locale=CSL_STYLES.find(style=>style.id===this.styleId).locale;void this.renderCsl();}}>{CSL_STYLES.map(style=><option value={style.id} selected={style.id===this.styleId}>{style.label}</option>)}</select></label><label>语言环境<select aria-label="选择语言环境" onChange={(event:any)=>{this.locale=event.target.value;void this.renderCsl();}}><option value="en-US" selected={this.locale==='en-US'}>英文（en-US）</option><option value="zh-CN" selected={this.locale==='zh-CN'}>中文（zh-CN）</option></select></label><button disabled={this.busy} onClick={()=>void this.renderCsl()}>{this.busy?'渲染中…':'重新渲染'}</button></div><section class="w12-output"><h3>渲染引文</h3>{this.error?<p class="error" role="alert">{this.error}</p>:<p class="paper-text w12-rendered" aria-live="polite">{this.rendered||'正在渲染…'}</p>}</section><p class="csl-source"><a href={choice.source} target="_blank" rel="noopener noreferrer">样式来源</a> · <a href={`assets/csl/${this.styleId}.csl`} download>下载CSL</a></p><details class="w12-source"><summary>CSL JSON</summary><pre class="source-json">{this.record?JSON.stringify(this.record,null,2):''}</pre></details></div>;}
}
