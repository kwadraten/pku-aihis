import {Library} from './library';
import {bootCore} from './core-bridge';
import {blake3} from '@noble/hashes/blake3.js';
import {bytesToHex} from '@noble/hashes/utils.js';
import {pdfWorkflow} from './pdf-workflow';
import classroomTags from '../assets/data/classroom-tags.json';

export type LiveLibraryState='idle'|'booting'|'seeding'|'ready'|'error';
type Listener=(state:LiveLibraryState,detail:string)=>void;
const asset=(p:string)=>new URL('assets/seed/'+p,document.baseURI).href;
async function checkedBytes(path:string,expected:string){
 const r=await fetch(asset(path));if(!r.ok)throw Error(`预置资源读取失败：${path} HTTP ${r.status}`);
 const data=new Uint8Array(await r.arrayBuffer());
 const sha=bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256',data)));
 if(sha!==expected)throw Error('预置资源SHA-256不一致：'+path);return data;
}
class LiveLibrary{
 private library:Library=null;
 private state:LiveLibraryState='idle';private detail='';private manifest:any;
 private pending:Promise<void>;private release=()=>{};
 private listeners=new Set<Listener>();
 constructor(){window.addEventListener('week04-library-change',()=>{if(this.state==='ready')this.ready();});}
 subscribe(fn:Listener){this.listeners.add(fn);fn(this.state,this.detail);return()=>this.listeners.delete(fn);}
 getState(){return this.state;}getDetail(){return this.detail;}getLibrary(){return this.library;}
 getSeedSource(){return this.manifest;}
 exportSqlite(){if(!this.library)throw Error('书库尚未就绪');return this.library.bytes();}
 boot(){return this.pending ||= this.start().catch(e=>{this.setState('error',e.message||String(e));this.release();this.pending=null;throw e;});}
 private setState(state:LiveLibraryState,detail=''){this.state=state;this.detail=detail;for(const fn of this.listeners)fn(state,detail);}
 private ready(){
  const lib=this.library,files=Object.keys(lib.files).length,pages=lib.rows('select count(*) n from pages')[0].n;
  this.setState('ready',`${lib.items().length}题录 · ${files}份PDF · ${pages}页`);
 }
 private async start(){
  if(navigator.locks){
   let resolve;const acquired=new Promise<boolean>(r=>resolve=r),held=new Promise<void>(r=>this.release=r);
   navigator.locks.request('week04-patchouli-writer',{ifAvailable:true},lock=>{resolve(!!lock);return lock?held:undefined;});
   if(!await acquired)throw Error('另一标签页已打开课堂书库，请关闭另一页后刷新');
   window.addEventListener('pagehide',this.release,{once:true});
  }
  this.setState('booting','原核心与SQLite启动中');await bootCore();
  const r=await fetch(asset('native-seed.json'));if(!r.ok)throw Error('缺少原生子集；请运行 pnpm seed');
  this.manifest=await r.json();
  if(this.manifest.format!=='patchouli-native-classroom-subset-v1')throw Error('预置子集格式不匹配');
  this.library=await new Library().init({libraryId:this.manifest.library_id,load:async()=>{
   this.setState('seeding','加载原始SQLite子集与对应PDF');
   const bytes=await checkedBytes(this.manifest.database.path,this.manifest.database.sha256),files:Library['files']={};
   for(const pdf of this.manifest.pdfs){
    this.setState('seeding',`加载PDF：${pdf.name}`);
    const data=await checkedBytes(pdf.path,pdf.sha256);
    if(bytesToHex(blake3(data))!==pdf.blake3)throw Error('PDF与源数据库BLAKE3不一致：'+pdf.name);
    files[pdf.file_asset_id]={name:pdf.name,data,hash:pdf.blake3};
   }
   return {bytes,files};
  }});
  // Upgrade previously opened classroom subsets, preserving user-edited nonempty labels.
  const tagUpgrade='week04-classroom-tags-v1:'+this.manifest.library_id;
  if(!localStorage.getItem(tagUpgrade)){
   const updates=this.library.items().filter(item=>Object.hasOwn(classroomTags,item.item_id)&&(!JSON.parse(item.tags_json||'[]').length||(item.item_id==='1e5d7930-c7ed-4208-9086-fd2423c71f91'&&JSON.parse(item.tags_json||'[]').length===12&&JSON.parse(item.tags_json).includes('0477:Environmental Studies'))));
   if(updates.length)await this.library.mutate(()=>{for(const item of updates)this.library.run('update items set tags_json=? where item_id=?',[JSON.stringify(classroomTags[item.item_id]),item.item_id]);});
   localStorage.setItem(tagUpgrade,'done');
  }
  this.ready();
 }
 async openSqlite(file:File){
  if(!this.library)throw Error('书库尚未启动');
  if(pdfWorkflow.state.busy)throw Error('请先完成或取消PDF处理，再打开其他数据库');
  await this.library.restore(new Uint8Array(await file.arrayBuffer()),false);
  this.ready();
 }
}
export const liveLibrary=new LiveLibrary();
