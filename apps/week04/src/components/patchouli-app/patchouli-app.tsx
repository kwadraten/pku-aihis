import {displayCreator,editableCreator} from '../../lib/creator-name';
import { Component, h, State, Element, Prop, Watch, Method, Event as StencilEvent, EventEmitter } from '@stencil/core';
import { liveLibrary } from '../../lib/live-library';
import { selectedItem, selectItem } from '../../lib/research-context';
import { pdfWorkflow } from '../../lib/pdf-workflow';
import { downloadBytes } from '../shared/download';
import { PATCHOULI_PAGES, PATCHOULI_ITEM_TYPES as types, PatchouliPage, PatchouliRequest, PatchouliState } from '../../lib/patchouli-pages';
import { patchouliSession, PatchouliSession, MetadataDraft } from '../../lib/patchouli-session';

type Entity = 'item' | 'field' | 'metadata' | 'attachment';
type Section = 'basic' | 'extra' | 'identifiers' | 'attachments';
type View = PatchouliPage;
type Draft = MetadataDraft;
const sections: [Section,string][] = [['basic','基本信息'],['extra','扩展信息'],['identifiers','唯一标识符'],['attachments','文件关联']];
const roles: Record<string,string> = {author:'作者',editor:'编者',translator:'译者',compiler:'编纂者',contributor:'贡献者'};
const fieldLabels: Record<string,string> = {title:'题名',publisher:'出版社／机构',place:'出版地',edition:'版次',publication_title:'书名／期刊名',language:'语言',volume:'卷',issue:'期',pages:'页码',abstract:'摘要',status:'阅读／核验进度'};

@Component({ tag: 'patchouli-app', styleUrl: 'patchouli-app.css', shadow: false })
export class PatchouliApp {
  @Element() el: HTMLElement;
  @Prop() active = false;
  @Prop() initialPage: PatchouliPage = 'library';
  @Prop() request?: PatchouliRequest;
  @Prop() externalReturn = false;
  @Prop() returnLabel = '返回上一界面';
  @StencilEvent() patchouliStateChange: EventEmitter<PatchouliState>;
  @StencilEvent() patchouliReturn: EventEmitter<void>;
  @StencilEvent() patchouliEditChange: EventEmitter<boolean>;
  @State() pdfEditing = false;@State() ocrConfirmToken=0;
  @State() view: View = 'library';
  @State() item: any = null;
  @State() items: any[] = [];
  @State() docs: any[] = [];
  @State() identifiers: any[] = [];
  @State() fields: Record<string,string> = {};
  @State() creators: any[] = [];
  @State() issued = '';
  @State() entity: Entity = 'metadata';
  @State() section: Section = 'basic';
  @State() focusField = '';
  @State() readerDocument = '';
  @State() readerPage = 1;
  @State() readerRevision = '';
  @State() evidenceUri = '';
  @State() busy = false;
  @State() processing = false;
  @State() message = '';
  @State() error = false;
  @State() log = '';
  @State() collections: any[] = [];
  @State() libraryItems: any[] = [];
  @State() filter = '';
  @State() collection = '';
  @State() trash = false;
  @State() query = '';
  @State() mode = 'fts';
  @State() hits: any[] = [];
  @State() searched = false;
  @State() newTitle = '';
  @State() totals = { items:0, documents:0, searchUnits:0 };
  private off: () => void;
  private workflowOff: () => void;
  private loadedDb: any;
  private baseline: Draft;
  private session: PatchouliSession;
  private pendingRequest: PatchouliRequest;
  private pendingFocus: PatchouliRequest;
  private previousView: View = 'library';
  private previousScroll = 0;
  private get drafts() { return this.session.drafts; }
  private get selected() { return this.item?.item_id || ''; }
  private get doc() { return this.docs.find(doc => !!liveLibrary.getLibrary()?.files[doc.file_asset_id])?.document_instance_id || this.docs[0]?.document_instance_id || ''; }

  componentWillLoad() {
    this.view = this.request?.page || this.initialPage;
    this.pendingRequest = this.request || { page:this.initialPage };
    this.off = liveLibrary.subscribe(state => { if (state === 'ready' && this.active) { this.refresh(false,true); if(this.pendingRequest){const request=this.pendingRequest;this.pendingRequest=null;void this.navigate(request);} } });
    this.workflowOff = pdfWorkflow.subscribe(state => this.processing=state.busy);
    window.addEventListener('research-selection',this.selection);
    window.addEventListener('workbench-evidence',this.evidence);
    window.addEventListener('workbench-open-document',this.openEvidence);
    window.addEventListener('keydown',this.readerKey,true);
  }
  disconnectedCallback() { this.cacheDraft();this.cacheTools();this.off?.();this.workflowOff?.();window.removeEventListener('research-selection',this.selection);window.removeEventListener('workbench-evidence',this.evidence);window.removeEventListener('workbench-open-document',this.openEvidence);window.removeEventListener('keydown',this.readerKey,true); }
  @Watch('active') activate() {
    if(!this.active){this.cacheDraft();this.cacheTools();return;}
    this.refresh(false,true,true);
    if(this.pendingRequest&&liveLibrary.getLibrary()){const request=this.pendingRequest;this.pendingRequest=null;void this.navigate(request);}
    if(this.view==='reader'&&!this.docs.some(doc=>doc.document_instance_id===this.readerDocument)){this.view=this.previousView;this.readerDocument='';this.pdfEditing=false;}
  }
  @Watch('request') requestChanged() { if(this.request)void this.navigate(this.request); }
  @Watch('fields') @Watch('creators') @Watch('issued') cacheDraft() {
    if(!this.session||!this.item||!this.baseline)return;
    if(this.dirty)this.drafts.set(this.selected,this.snapshot());else this.drafts.delete(this.selected);
  }
  @Watch('filter') @Watch('collection') @Watch('trash') filtersChanged() {
    if(!this.session)return;
    Object.assign(this.session.library,{filter:this.filter,collection:this.collection,trash:this.trash});
    this.libraryItems=liveLibrary.getLibrary().items({...this.session.library,query:this.filter});
  }
  @Watch('query') @Watch('mode') @Watch('hits') @Watch('searched') searchChanged() {
    if(this.session)Object.assign(this.session.search,{query:this.query,mode:this.mode,hits:this.hits,searched:this.searched});
  }
  private cacheTools() {}
  private selection = () => { if(this.active)this.refresh(); };
  private refresh(force=false,restore=false,skipCache=false) {
    const lib=liveLibrary.getLibrary();if(!lib)return;
    const replaced=this.loadedDb!==lib.db;
    if(!replaced&&!skipCache)this.cacheDraft();
    this.session=patchouliSession(lib.db);this.loadedDb=lib.db;
    this.items=lib.items();this.collections=lib.collections();
    const item=this.items.find(item=>item.item_id===selectedItem())||this.items[0];
    const changed=this.item?.item_id!==item?.item_id;
    if(changed&&this.item&&!replaced)this.cacheTools();
    this.item=item||null;
    if(replaced||restore){Object.assign(this,{...this.session.library});Object.assign(this,{...this.session.search});}
    this.libraryItems=lib.items({...this.session.library,query:this.filter});
    this.docs=item?lib.documents(item.item_id):[];
    this.identifiers=item?lib.rows('select * from item_identifiers where item_id=?',[item.item_id]):[];
    this.totals={items:this.items.length,documents:lib.rows('select count(*) n from document_instances')[0].n,searchUnits:lib.rows("select count(*) n from search_units where status='current'")[0].n};
    if(!item)return;
    if(!force&&!restore&&!changed&&!replaced&&(this.dirty||this.busy))return;
    const fields=Object.fromEntries(['item_type',...Object.keys(fieldLabels)].map(key=>[key,item[key]||'']));
    const creators=lib.rows('select * from item_creators where item_id=? order by sequence_index',[item.item_id]);
    if(!creators.length)for(const name of JSON.parse(item.creators_json||'[]'))creators.push({...name,role:'author'});
    const date=lib.rows("select * from item_dates where item_id=? and role='issued'",[item.item_id])[0];
    const parts=date?JSON.parse(date.date_parts_json||'[]')[0]:null;
    const issued=parts?.map((value:number,index:number)=>index?String(value).padStart(2,'0'):String(value)).join('-')||date?.literal||item.date||'';
    this.baseline={fields,creators:creators.map(creator=>({...creator})),issued};
    const draft=!force&&this.drafts.get(item.item_id)||this.baseline;
    this.fields={...draft.fields};this.creators=draft.creators.map(creator=>({...creator}));this.issued=draft.issued;
    if(changed||replaced){this.message='';this.error=false;this.log='';}
  }
  private openEvidence = (event:CustomEvent) => { if(!this.active)return;try{const uri=new URL(event.detail),match=uri.pathname.match(/^\/([^/]+)\/page-(\d+)\.md$/);if(uri.protocol!=='patchouli:'||uri.hostname!=='texts'||!match)return;void this.navigate({page:'reader',documentId:match[1],pageNumber:Number(match[2]),revisionId:uri.searchParams.get('rev')||'',evidenceUri:event.detail});}catch{/* Unrelated events are ignored. */} };
  private evidence = (event:CustomEvent) => { this.openEvidence(event); };
  private readerKey = (event:KeyboardEvent) => {
    if(!this.active||this.view!=='reader'||event.isComposing||event.ctrlKey||event.altKey||event.metaKey)return;
    if(event.composedPath().some((target:any)=>target?.matches?.('input,textarea,select,[contenteditable=true]')))return;
    if(this.pdfEditing){if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();void (this.el.querySelector('pdf-reader') as any)?.cancelEditing();}return;}
    const step={ArrowLeft:-1,ArrowRight:1,PageUp:-1,PageDown:1}[event.key];if(!step&&event.key!=='Escape')return;
    event.preventDefault();event.stopImmediatePropagation();if(event.key==='Escape')this.returnFromReader();else this.movePage(this.readerPage+step);
  };
  @Method() async navigate(request:PatchouliRequest) {
    if(this.pdfEditing){if(request.keepDraft){const reader=this.el.querySelector('pdf-reader') as any;if(!await reader?.suspendEditing()){this.log='修订正在提交，请稍候';return;}this.pdfEditing=false;}else{this.log='请先保存或取消边界框编辑';return;}}
    const lib=liveLibrary.getLibrary();if(!lib){this.pendingRequest=request;this.view=request.page;return;}
    this.cacheTools();
    if(request.page==='reader'){
      const doc=request.documentId?lib.rows('select * from document_instances where document_instance_id=?',[request.documentId])[0]:this.docs.find(doc=>!!lib.files[doc.file_asset_id]);
      if(doc){selectItem(doc.item_id);this.refresh();this.openOriginal(doc);if(request.pageNumber!==undefined)this.readerPage=request.pageNumber;if(request.revisionId!==undefined)this.readerRevision=request.revisionId;this.evidenceUri=request.evidenceUri||'';}else this.pick('attachment');
    }else if(request.page==='editor')this.pick(request.focusKind||'metadata',request.field||'');
    else if(request.page==='attachments')this.pick('attachment');
    else {this.view=request.page;this.focusField='';}
    if(request.page==='ocr'&&request.ocrConfirm)this.ocrConfirmToken++;
    this.pendingFocus=request;
  }
  @Method() async getState():Promise<PatchouliState> { return {page:this.view,item:this.item,items:this.items,docs:this.docs,fields:this.fields,creators:this.creators,issued:this.issued,focusField:this.focusField,focusKind:this.entity,editing:this.pdfEditing,boundDocuments:this.docs.filter(doc=>!!liveLibrary.getLibrary()?.files[doc.file_asset_id]).length,totals:this.totals}; }
  componentDidRender() {
    if(this.active)void this.getState().then(state=>this.patchouliStateChange.emit(state));
    if(!this.pendingFocus||!this.active)return;
    const request=this.pendingFocus;this.pendingFocus=null;
    const components=[...this.el.querySelectorAll('csl-renderer,tag-lab,uri-resolver,pdf-reader,ocr-queue')];
    void Promise.all(components.map((component:any)=>component.componentOnReady?.())).then(()=>requestAnimationFrame(()=>{
      this.el.querySelectorAll('.concept-focus').forEach(element=>element.classList.remove('concept-focus'));
      const pane=this.el.querySelector('.work-main') as HTMLElement,target=request.selector?pane?.querySelector(request.selector) as HTMLElement:null;
      if(pane&&target){target.classList.add('concept-focus');pane.scrollTop+=target.getBoundingClientRect().top-pane.getBoundingClientRect().top-14;}
      if(request.notePart){const select=this.el.querySelector('select[aria-label="笔记成分"]') as HTMLSelectElement;if(select){select.value=request.notePart;select.dispatchEvent(new Event('change',{bubbles:true}));}}
      if(request.ocrConfirm)void (this.el.querySelector('ocr-queue') as any)?.openConfirmation();
      if(request.readerSection){const reader=this.el.querySelector('pdf-reader') as any;void reader?.showSection(request.readerSection==='正文'?'content':request.readerSection==='历史'?'history':'tree',!!request.readerEditing);}
    }));
  }
  private returnFromReader() { if(this.externalReturn){this.patchouliReturn.emit();return;}this.view=this.previousView;this.readerDocument='';this.evidenceUri='';requestAnimationFrame(()=>{const pane=this.el.querySelector('.mds-form-scroll,.work-main') as HTMLElement;if(pane)pane.scrollTop=this.previousScroll;}); }
  private movePage(page:number) { const count=liveLibrary.getLibrary().pages(this.readerDocument).length;this.readerPage=Math.max(1,Math.min(count,Number(page)||1));this.readerRevision=''; }
  private async act(fn:()=>Promise<any>) {this.busy=true;this.log='';try{await fn();this.log='已保存到当前SQLite';this.refresh();}catch(error){this.log=error.message;}finally{this.busy=false;}}
  private async create(){await this.act(async()=>{const id=await liveLibrary.getLibrary().createItem(this.newTitle);this.newTitle='';selectItem(id);});}
  private async copyUri(uri:string){try{await navigator.clipboard.writeText(uri);this.log='证据URI已复制';}catch{this.log='复制失败，请选中列表中的URI复制';}}
  private search(){try{this.hits=liveLibrary.getLibrary().search(this.query,this.mode);this.searched=true;this.log='';}catch(error){this.log=error.message;}}
  private library(){return <section class="mds-library" aria-label="书库页"><main class="work-main"><library-treegrid items={this.libraryItems} selectedId={this.selected}/><details class="pa-library-actions"><summary>新建与回收站</summary><label>题录题名<input aria-label="新建题录题名" value={this.newTitle} onInput={(event:any)=>this.newTitle=event.target.value}/></label><button disabled={this.busy||!this.newTitle.trim()} onClick={()=>this.create()}>新建题录</button><label><input type="checkbox" checked={this.trash} onChange={(event:any)=>this.trash=event.target.checked}/>查看回收站</label><button disabled={!this.selected||this.processing} onClick={()=>this.act(()=>liveLibrary.getLibrary().trash(this.selected,this.trash))}>{this.trash?'恢复所选题录':'移入回收站'}</button></details></main></section>;}
  private searchPage(){return <section class="mds-library" aria-label="检索页"><main class="work-main"><form class="work-search" onSubmit={event=>{event.preventDefault();this.search();}}><input aria-label="全文检索" placeholder="检索正文：subaltern / 貨幣 / 自己的PDF" value={this.query} onInput={(event:any)=>this.query=event.target.value}/><select aria-label="全文检索模式" onChange={(event:any)=>this.mode=event.target.value}><option value="fts" selected={this.mode==='fts'}>FTS5词项</option><option value="substring" selected={this.mode==='substring'}>中文 / 日文子串</option></select><button>检索</button></form>{this.searched?<div class="work-hits"><h3>{this.hits.length} 个命中</h3>{!this.hits.length&&<p>当前正文范围无命中，可检查文字处理状态或更换检索词。</p>}{this.hits.slice(0,60).map(hit=><article class="work-hit" onClick={()=>this.openEvidence(new CustomEvent('workbench-open-document',{detail:hit.uri}))}><button class="work-hit-open"><strong>{hit.title} · 第{hit.page_index+1}页</strong><p>{hit.resolved_text?.slice(0,180)}</p></button><div class="work-hit-footer"><code class="mono">{hit.uri}</code><button class="work-copy-uri" aria-label="复制此结果的URI" onClick={event=>{event.stopPropagation();void this.copyUri(hit.uri);}}>复制URI</button></div></article>)}</div>:<p class="work-search-intro">输入词语，检索已保存的正文。</p>}</main></section>;}
  private pagination(){const count=liveLibrary.getLibrary().pages(this.readerDocument).length;return <nav class="mds-pdf-pagination" aria-label="PDF翻页"><button disabled={this.pdfEditing||this.readerPage<=1} onClick={()=>this.movePage(this.readerPage-1)} aria-label="上一页" title="上一页">‹</button><label><input disabled={this.pdfEditing} aria-label="阅读页码" type="number" min="1" max={count} value={this.readerPage} onChange={(event:any)=>this.movePage(event.target.value)}/></label><span>/ {count}</span><button disabled={this.pdfEditing||this.readerPage>=count} onClick={()=>this.movePage(this.readerPage+1)} aria-label="下一页" title="下一页">›</button>{this.readerRevision&&<button disabled={this.pdfEditing} onClick={()=>this.readerRevision=''} aria-label="回到当前修订" title="回到当前修订">↺</button>}</nav>;}
  private reader(){return <section class="mds-pdf-workspace" aria-label="PDF工作台阅读模式"><pdf-reader documentId={this.readerDocument} pageNumber={this.readerPage} revisionId={this.readerRevision} workspace={true} evidenceUri={this.evidenceUri} onPdfEditChange={event=>{this.pdfEditing=event.detail;this.log='';this.patchouliEditChange.emit(event.detail);}} onPdfTreeCommitted={()=>{this.readerRevision='';this.log='边界框树已提交新修订';}}/></section>;}

  // The editor and tool-page bodies below reuse the original field and native
  // library operations. The single application shell owns all page navigation.
  private snapshot(): Draft {
    return { fields: { ...this.fields }, creators: this.creators.map(c => ({ ...c })), issued: this.issued };
  }
  private get dirty() { return !!this.baseline && JSON.stringify(this.snapshot()) !== JSON.stringify(this.baseline); }
  private update(key: string, value: string) {
    this.fields = { ...this.fields, [key]: value };
    this.message = ''; this.error = false;
  }
  private pickSection(section: Section) {
    this.section = section;
    this.view = section === 'attachments' ? 'attachments' : 'editor';
    requestAnimationFrame(() => {
      const pane = this.el.querySelector('.mds-form-scroll') as HTMLElement;
      const target = this.el.querySelector(`[data-section="${section}"]`) as HTMLElement;
      if (pane && target) pane.scrollTop += target.getBoundingClientRect().top - pane.getBoundingClientRect().top - 8;
    });
  }
  private pick(entity: Entity, key = '') {
    this.entity = entity; this.focusField = key;
    if (entity === 'item') { this.view = 'library'; return; }
    const section: Section = entity === 'attachment' ? 'attachments' : ['language', 'volume', 'issue', 'pages', 'abstract', 'status'].includes(key) ? 'extra' : 'basic';
    this.pickSection(section);
    if (key) requestAnimationFrame(() => {
      const pane = this.el.querySelector('.mds-form-scroll') as HTMLElement;
      const target = this.el.querySelector(`[data-field="${key}"]`) as HTMLElement;
      if (pane && target) pane.scrollTop += target.getBoundingClientRect().top - pane.getBoundingClientRect().top - 12;
    });
  }
  private async save() {
    if (!this.item || !this.dirty || this.busy) return;
    const id = this.item.item_id, draft = this.snapshot();
    const fields = Object.fromEntries(Object.entries(draft.fields).filter(([key, value]) => value !== this.baseline.fields[key]));
    const creators = JSON.stringify(draft.creators) !== JSON.stringify(this.baseline.creators) ? draft.creators : undefined;
    const issued = draft.issued !== this.baseline.issued ? draft.issued : undefined;
    this.busy = true; this.message = ''; this.error = false;
    try {
      await liveLibrary.getLibrary().saveMetadata(id, fields, creators, issued);
      this.drafts.delete(id);
      this.refresh(true);
      this.message = '题录已保存';
    } catch (error) { this.error = true; this.message = error.message; }
    finally { this.busy = false; }
  }
  private discard() {
    this.drafts.delete(this.item.item_id);
    this.refresh(true); this.error = false; this.message = '已恢复保存的内容';
  }
  private input(key: string, multiline = false) {
    return <label class={{ 'mds-field': true, 'is-highlighted': this.focusField === key }} data-field={key}>
      <span onClick={event => { event.preventDefault(); this.entity = 'field'; this.focusField = key; }}>{fieldLabels[key]}</span>
      {multiline ? <textarea aria-label={fieldLabels[key]} disabled={this.busy} value={this.fields[key]} onFocus={() => { this.entity = 'metadata'; this.focusField = key; }} onInput={(e: any) => this.update(key, e.target.value)} /> :
        <input aria-label={fieldLabels[key]} disabled={this.busy} value={this.fields[key]} onFocus={() => { this.entity = 'metadata'; this.focusField = key; }} onInput={(e: any) => this.update(key, e.target.value)} />}
    </label>;
  }
  private openOriginal(doc: any) {
    if (!doc) return;
    const file = liveLibrary.getLibrary().files[doc.file_asset_id];
    if (!file) return;
    selectItem(doc.item_id || this.item.item_id);
    const same = this.view === 'reader' && this.readerDocument === doc.document_instance_id;
    if (this.view !== 'reader') {
      this.previousView = this.view;
      this.previousScroll = (this.el.querySelector('.mds-form-scroll,.work-main') as HTMLElement)?.scrollTop || 0;
    }
    this.readerDocument = doc.document_instance_id;
    if (!same) { this.readerPage = 1; this.readerRevision = ''; }
    this.view = 'reader';
  }

  private editor(){const lib=liveLibrary.getLibrary(),currentType=this.fields.item_type||'book';return <div class="mds-editor-body">
          <nav class="mds-nav" aria-label="题录编辑分区">{sections.map(([key, label]) => <button aria-current={this.section === key ? 'true' : undefined} class={this.section === key ? 'is-current' : ''} onClick={() => { this.focusField = ''; if (key === 'attachments') this.entity = 'attachment'; this.pickSection(key); }}>{label}</button>)}</nav>
          <div class="mds-form-scroll">
            <section class="mds-form-section" data-section="basic" hidden={this.view === 'attachments'}>
              <label class={{ 'mds-field': true, 'is-highlighted': this.entity === 'item' }} data-field="item_type"><span>文献类型</span><select aria-label="文献类型" disabled={this.busy} onFocus={() => { this.entity = 'item'; this.focusField = 'item_type'; }} onChange={(e: any) => this.update('item_type', e.target.value)}>{Object.entries({ ...types, ...(!types[currentType] ? { [currentType]: currentType } : {}) }).map(([value, label]) => <option value={value} selected={value === currentType}>{label}</option>)}</select></label>
              <h3>核心元数据</h3>
              {this.input('title')}
              <div class={{ 'mds-field': true, 'is-highlighted': this.focusField === 'creators' }} data-field="creators"><span>作者／贡献者</span>{this.creators.map((creator, index) => <div class="mds-creator" key={creator.creator_id || index}>
                <select aria-label={`责任者${index + 1}角色`} disabled={this.busy} onChange={(e: any) => this.creators = this.creators.map((c, i) => i === index ? { ...c, role: e.target.value } : c)}>{Object.entries({ ...roles, ...(!roles[creator.role] ? { [creator.role]: creator.role } : {}) }).map(([value, label]) => <option value={value} selected={value === creator.role}>{label}</option>)}</select>
                <input aria-label={`责任者${index + 1}姓名`} value={displayCreator(creator)} disabled={this.busy} onFocus={() => { this.entity = 'metadata'; this.focusField = 'creators'; }} onInput={(e: any) => this.creators = this.creators.map((c, i) => i === index ? { ...c, literal: e.target.value } : c)} />
                <button aria-label={`移除责任者${index + 1}`} disabled={this.busy} onClick={() => this.creators = this.creators.filter((_, i) => i !== index)}>移除</button>
                <details><summary>详情</summary>{[['family', '姓'], ['given', '名'], ['suffix', '后缀'], ['particles', '姓名前缀']].map(([key, label]) => <label>{label}<input aria-label={`责任者${index + 1}${label}`} disabled={this.busy} value={creator[key] || ''} onInput={(e: any) => this.creators = this.creators.map((c, i) => i === index ? { ...c, [key]: e.target.value, literal: '' } : c)} /></label>)}</details>
              </div>)}<button class="mds-add" disabled={this.busy} onClick={() => { this.creators = [...this.creators, { role: 'author', literal: '', family: '', given: '' }]; this.entity = 'metadata'; this.focusField = 'creators'; }}>添加作者／贡献者</button></div>
              <label class={{ 'mds-field': true, 'is-highlighted': this.focusField === 'issued' }} data-field="issued"><span>出版日期</span><input aria-label="出版日期" placeholder="YYYY / YYYY-MM / YYYY-MM-DD" value={this.issued} disabled={this.busy} onFocus={() => { this.entity = 'metadata'; this.focusField = 'issued'; }} onInput={(e: any) => this.issued = e.target.value} /></label>
              {this.input('publisher')}
              <div class="mds-field-pair">{this.input('place')}{this.input('edition')}</div>
              {this.input('publication_title')}
            </section>
            <section class="mds-form-section" data-section="extra" hidden={this.view === 'attachments'}><h3>扩展信息</h3><div class="mds-field-pair">{this.input('language')}{this.input('pages')}{this.input('volume')}{this.input('issue')}</div>{this.input('abstract', true)}
              <label class={{ 'mds-field': true, 'is-highlighted': this.focusField === 'status' }} data-field="status"><span>阅读／核验进度</span><input aria-label="阅读／核验进度" disabled={this.busy} list="mds-progress-options" value={this.fields.status} onFocus={() => { this.entity = 'metadata'; this.focusField = 'status'; }} onInput={(e: any) => this.update('status', e.target.value)} /><datalist id="mds-progress-options">{['待阅读', '已扫读', '已精读', '已引用', '待核验'].map(v => <option value={v} />)}</datalist></label>
            </section>
            <section class="mds-form-section" data-section="identifiers" hidden={this.view === 'attachments'}><h3>唯一标识符</h3><dl class="mds-identifiers"><div><dt>条目 ID</dt><dd>{this.item.item_id}</dd></div>{this.identifiers.map(i => <div><dt>{i.scheme.toUpperCase()}</dt><dd>{i.value}</dd></div>)}</dl></section>
            <section class={{ 'mds-form-section': true, 'is-highlighted': this.entity === 'attachment' }} data-section="attachments"><h3>文件关联</h3>{this.docs.length ? this.docs.map(doc => <div class="mds-attachment"><strong>{doc.file_name || doc.title || 'PDF'}</strong><p>PDF · {lib.pages(doc.document_instance_id).length} 页 · {lib.files[doc.file_asset_id] ? '原件已绑定' : '待取得原件'}</p><button disabled={!lib.files[doc.file_asset_id] || this.busy} onClick={() => this.openOriginal(doc)}>查看原件</button><details><summary>文件身份</summary><dl class="mds-identifiers"><div><dt>文档 ID</dt><dd>{doc.document_instance_id}</dd></div><div><dt>BLAKE3</dt><dd>{doc.full_blake3}</dd></div></dl></details></div>) : <p>当前题录尚无附件。</p>}<a href="#D06">导入或关联 PDF</a></section>
          </div>
        </div>;}


  private content(){
    if(this.view==='library')return this.library();if(this.view==='search')return this.searchPage();
    if(!this.item)return <p class="mds-loading">暂无题录，请先在书库中新建题录。</p>;
    if(this.view==='reader')return this.reader();if(this.view==='editor'||this.view==='attachments')return this.editor();
    const lib=liveLibrary.getLibrary();let body:any;
    switch(this.view){
      case 'processing':body=<pdf-importer itemId={this.selected} documentId={this.doc} preferredMode='text'/>;break;case 'ocr':body=<ocr-queue documentId={this.doc} confirmToken={this.ocrConfirmToken}/>;break;
      case 'history':body=<div><h3>文件身份与修订</h3><dl>{this.docs.map(doc=><div><dt>{doc.file_name}</dt><dd class="mono">BLAKE3 {doc.full_blake3}</dd><dd>文档 {doc.document_instance_id}</dd></div>)}</dl><p>出版年代取自题录；扫描时间仅在有来源记录时填写。提交时间见PDF工作台历史。</p><uri-resolver session={this.session.tools.uri ||= {}}/></div>;break;
      case 'csl':body=<csl-renderer/>;break;case 'uri':body=<uri-resolver session={this.session.tools.uri ||= {}}/>;break;case 'tags':case 'collections':body=<library-browser kind={this.view} selectedId={this.selected} query={this.filter} onOrganizeFeedback={event=>this.log=event.detail}/>;break;
    }
    return <section class="mds-tool" aria-label="Patchouli操作界面"><main class={['ocr','tags','collections'].includes(this.view)?'work-main pa-full-main':'work-main'}>{body}</main></section>;
  }
  private pageIcon(page:string) {const paths={library:'M4 4h4v16H4z M10 4h4v16h-4z M17 4l4 1-3 15-4-1z',editor:'M4 16l-1 5 5-1L21 7l-4-4z M14 6l4 4',attachments:'M8 13l7-7a3 3 0 014 4L9 20a5 5 0 01-7-7L13 2',search:'M20 20l-5-5 M17 10a7 7 0 11-14 0 7 7 0 0114 0',reader:'M5 3h10l4 4v14H5z M14 3v5h5 M8 12h8 M8 16h8',import:'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5',back:'M19 12H5 M11 6l-6 6 6 6'};return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d={paths[page]}/></svg>;}
  render(){
    if(!this.active)return <div class="workbench-sleep"/>;
    const lib=liveLibrary.getLibrary();if(!lib)return <p class="mds-loading">书库启动中…</p>;
    const bound=this.docs.some(doc=>!!lib.files[doc.file_asset_id]);
    const status=this.log||(this.error?this.message:this.pdfEditing?'边界框编辑中':this.dirty?'有未保存的更改':this.message)||(this.processing?'PDF处理进行中':'');
    return <div class="mds-app-pane patchouli-app" data-page={this.view}>
      <header class="mds-editor-header pa-titlebar">
        <nav class="mds-app-bar" aria-label="Patchouli应用导航"><img class="pa-brand-icon" src="assets/branding/patchouli-icon.png" alt="Patchouli" title="Patchouli" width="24" height="24"/>{[['library','书库'],['editor','编辑题录'],['attachments','文件关联'],['search','检索'],['reader','PDF工作台']].map(([page,label])=><button aria-label={label} title={label} class={this.view===page?'is-current':''} disabled={this.pdfEditing||(page==='reader'&&!bound)} onClick={()=>void this.navigate({page:page as PatchouliPage})}>{this.pageIcon(page)}</button>)}</nav>
        <h2 class="pa-page-heading">{PATCHOULI_PAGES[this.view]}</h2>
        <select class="pa-page-picker" disabled={this.pdfEditing} aria-label="工具页面" onChange={(event:any)=>void this.navigate({page:event.target.value})}>{Object.entries(PATCHOULI_PAGES).map(([page,label])=><option value={page} selected={page===this.view}>{label}</option>)}</select>
        {['library','tags','collections'].includes(this.view)&&<div class="pa-library-filter"><input aria-label="筛选题录" value={this.filter} placeholder="筛选题录" onInput={(event:any)=>this.filter=event.target.value}/>{this.view==='library'&&<select aria-label="筛选集合" onChange={(event:any)=>this.collection=event.target.value}><option value="">全部文献</option>{this.collections.map(collection=><option value={collection.collection_id} selected={collection.collection_id===this.collection}>{collection.name}</option>)}</select>}</div>}
        {this.view==='reader'&&<span class="pa-document-title" title={this.docs.find(doc=>doc.document_instance_id===this.readerDocument)?.file_name||this.item?.title}>{this.docs.find(doc=>doc.document_instance_id===this.readerDocument)?.file_name||this.item?.title}</span>}{this.view==='reader'&&this.pagination()}
        {this.view==='reader'&&this.evidenceUri&&<details class="pa-evidence"><summary title="引用的段落">引文</summary><div><p>{lib.fetch(this.evidenceUri).text}</p><code>{this.evidenceUri}</code></div></details>}
        <span class={{'mds-app-status':true,'mds-feedback':true,'is-error':this.error}} role="status" aria-live="polite" title={status}>{status}</span>
        <div class="mds-actions">{(this.view==='reader'||this.externalReturn)&&<button class="pa-return" disabled={this.pdfEditing} aria-label={this.returnLabel} title={this.returnLabel} onClick={()=>this.returnFromReader()}>{this.pageIcon('back')}</button>}{this.view==='editor'&&<span class="pa-editor-actions"><button disabled={!this.dirty||this.busy} onClick={()=>this.discard()}>放弃更改</button><button class="mds-save" disabled={!this.dirty||this.busy} onClick={()=>void this.save()}>{this.busy?'保存中…':'保存题录'}</button></span>}{this.view==='library'&&<button aria-label="编辑所选题录" disabled={!this.item} onClick={()=>this.pick('metadata')}>编辑</button>}</div>
      </header>
      <div class="mds-app-view">{this.content()}</div>
    </div>;
  }
}
