import {Component,h,State} from '@stencil/core';
import {liveLibrary} from '../../lib/live-library';
import {Library} from '../../lib/library';
import {downloadBytes} from '../shared/download';
@Component({tag:'backup-lab',shadow:false})
export class BackupLab{
 @State() tick=0;private off:()=>void;
 componentWillLoad(){this.off=liveLibrary.subscribe(()=>{this.tick++;});}
 disconnectedCallback(){this.off?.();}
 @State() query='AI';@State() hits:any[]=[];@State() selected:any;@State() text='';@State() log='';@State() busy=false;
 async roundtrip(){this.busy=true;try{const lib=liveLibrary.getLibrary(),bytes=lib.backup(),copy=new Library();copy.sqlite=lib.sqlite;copy.storage=lib.storage;copy.persist=async()=>{};copy.db=copy.openDatabase();copy.migrate();const before=lib.items().length,start=performance.now();try{await copy.restore(bytes,true);if(copy.items().length!==before)throw Error('题录数量不同');copy.checkIntegrity();this.log=`恢复至独立空库：${before}条题录、${Object.keys(copy.files).length}份PDF，${((performance.now()-start)/1000).toFixed(2)}s；数据库/PDF BLAKE3与外键核验通过。`;}finally{copy.db.close();await lib.persist();}downloadBytes(bytes,'week04-backup.zip','application/zip');}catch(e:any){this.log=e.message;}finally{this.busy=false;}}
 render(){const lib=liveLibrary.getLibrary();return <div class="lab"><div class="concept-grid"><article class="concept-card"><h3>同步</h3><p>让多处当前状态保持一致。</p></article><article class="concept-card"><h3>导出</h3><p>交出可交换的当前数据。</p></article><article class="concept-card"><h3>备份与恢复</h3><p>保存可独立恢复的历史状态。</p></article></div><div class="lab-toolbar"><input aria-label="find条件" value={this.query} onInput={(e:any)=>this.query=e.target.value}/><button disabled={!lib} onClick={()=>this.hits=lib.search(this.query,'substring').slice(0,6)}>find · 找候选</button><button disabled={!lib||this.busy} onClick={()=>this.roundtrip()}>ZIP备份 → 独立空库恢复 → 校验</button></div><div class="backup-results">{this.hits.map(hit=><button onClick={()=>{this.selected=hit;this.text=lib.fetch(hit.uri).text;}}>{hit.title} · 第{hit.page_index+1}页 · fetch</button>)}</div>{this.selected&&<section><p class="mono">cite · {this.selected.uri}</p><pre>{this.text}</pre></section>}<p class="mode" role="status">{this.log}</p><p class="source-line">顶栏导出SQLite → 桌面Patchouli“打开数据库”；PDF另存并由文件搜索根按BLAKE3重新绑定。</p></div>;}
}
