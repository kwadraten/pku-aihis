import {displayCreator} from '../../lib/creator-name';
import {Component,h,State,Element,Prop,Watch} from '@stencil/core';
import {CONCEPT_NAVIGATION,ConceptNode} from '../../lib/concept-navigation';
import {PatchouliPage,PatchouliRequest,PatchouliState,pageFromSlide,PATCHOULI_ITEM_TYPES as types} from '../../lib/patchouli-pages';
type Entity='item'|'field'|'metadata'|'attachment';
@Component({tag:'metadata-split',styleUrl:'metadata-split.css',shadow:false})
export class MetadataSplit {
 @Element() el:HTMLElement;
 @Prop() navigation:'entities'|'layers'|'concepts'='entities';@Prop() conceptPage='';@Prop() active=false;
 @State() standaloneSection='';@State() started=false;@State() conceptIndex=0;@State() request:PatchouliRequest={page:'editor'};
 @State() entity:Entity='metadata';@State() view:PatchouliPage='editor';@State() focusField='';
 @State() item:any=null;@State() items:any[]=[];@State() docs:any[]=[];@State() fields:Record<string,string>={};@State() creators:any[]=[];@State() issued='';
 @State() editing=false;@State() bound=0;@State() totals={items:0,documents:0,searchUnits:0};
 componentWillLoad(){this.started=this.active;if(this.navigation==='layers')this.request={page:'library'};if(this.navigation==='concepts'&&this.conceptPage!=='D21'){const nodes=CONCEPT_NAVIGATION[this.conceptPage]?.nodes;if(nodes){this.conceptIndex=this.conceptPage==='D26'?0:Math.max(0,nodes.findIndex(node=>node.target!=='reader'));this.request=this.nodeRequest(nodes[this.conceptIndex]);}}}
 @Watch('active') activate(){if(this.active)this.started=true;}
 private stateChanged=(event:CustomEvent<PatchouliState>)=>{const state=event.detail;this.editing=state.editing;this.view=state.page;this.item=state.item;this.items=state.items;this.docs=state.docs;this.fields=state.fields;this.creators=state.creators;this.issued=state.issued;this.focusField=state.focusField;this.entity=state.page==='library'?'item':state.page==='attachments'?'attachment':state.focusKind||'metadata';this.bound=state.boundDocuments;this.totals=state.totals;};
 private nodeRequest(node:ConceptNode):PatchouliRequest {return {page:node.label==='集合'?'collections':node.label==='主题标签'?'tags':node.target==='panel'?pageFromSlide(node.page):node.target,keepDraft:true,field:node.field,selector:node.selector,notePart:this.conceptPage==='D20'&&['原话','释义','推断','机器候选'].includes(node.label)?node.label:undefined,readerSection:node.label==='原始页影'?'正文':node.label.includes('校对')?'校对':/历史|修订/.test(node.label)?'历史':undefined,readerEditing:this.conceptPage==='D26'&&node.label==='校对修订',ocrConfirm:this.conceptPage==='D26'&&node.label==='提取与识别',revisionId:node.label==='原始页影'||node.label==='校对修订'?'':undefined};}
 private show(request:PatchouliRequest){this.request=request;}
 private selectConcept(index:number){const node=CONCEPT_NAVIGATION[this.conceptPage]?.nodes[index];if(node){if(this.conceptPage==='D11'&&node.label==='衍生说明'){this.conceptIndex=index;this.standaloneSection='D11';return;}this.standaloneSection='';if(node.target==='panel'&&["D17","D19","D20","D22","D23","D24","D28","D10","D16","D18","D27","D25","D09","D21"].includes(node.page)){location.hash=node.page;return;}this.conceptIndex=index;this.show(this.nodeRequest(node));}}
 private pick(entity:Entity,key=''){this.entity=entity;this.focusField=key;this.show({page:entity==='item'?'library':entity==='attachment'?'attachments':'editor',field:key,focusKind:entity});}
  private conceptDiagram(){return <concept-map pageId={this.conceptPage} config={CONCEPT_NAVIGATION[this.conceptPage]} selectedIndex={this.conceptIndex} disabled={false} currentTitle={this.item?.title||''} onDiagramPick={event=>this.selectConcept(event.detail)}/>;}
  private layerStack() {
    const searchable = this.totals.searchUnits;
    return <aside class="mds-layer-navigation" aria-label="文献库的三层视图">
      <h2>文献库的三层</h2>
      <div class="mds-layer-stack">
        <button class={{ 'mds-layer': true, 'mds-layer-search': true, 'is-active': this.view === 'search' }} aria-label="正文检索层：检索" aria-pressed={String(this.view === 'search')} onClick={() => this.show({page:'search'})}><span class="mds-layer-front"><small>03</small><strong>正文检索层</strong><span>检索 · 词语命中与原文定位</span></span></button>
        <button class={{ 'mds-layer': true, 'mds-layer-pdf': true, 'is-active': this.view === 'reader' }} aria-label="附件层：PDF工作台" aria-pressed={String(this.view === 'reader')} onClick={() => { this.show({page:'reader'}); }}><span class="mds-layer-front"><small>02</small><strong>附件层</strong><span>PDF工作台 · 原页与正文</span></span></button>
        <button class={{ 'mds-layer': true, 'mds-layer-library': true, 'is-active': this.view === 'library' }} aria-label="题录层：书库" aria-pressed={String(this.view === 'library')} onClick={() => this.show({page:'library'})}><span class="mds-layer-front"><small>01</small><strong>题录层</strong><span>书库 · 题名与出版信息</span></span></button>
      </div>
      <p class="mds-layer-hint">点击柱体切换对应页面</p>
      <p class="mds-layer-current">当前文献：{this.item.title}</p>
      <p class="mds-layer-counts">全库 {this.items.length} 条题录 · {this.totals.documents} 份附件 · {searchable} 个检索单元</p>
    </aside>;
  }

  private entityBox(entity: Entity, title: string, rows: [string, string, string][]) {
    return <section class={{ 'mds-entity': true, [`mds-entity-${entity}`]: true, 'is-selected': this.entity === entity }}>
      <button class="mds-entity-title" aria-label={`查看${title}`} aria-pressed={String(this.entity === entity)} onClick={() => this.pick(entity)}><strong>{title}</strong><span>{entity.toUpperCase()}</span></button>
      {rows.map(([key, label, value]) => <button class={{ 'mds-entity-row': true, 'is-selected': !!key && this.focusField === key }} title={value} aria-label={`${title}：${label}`} onClick={() => this.pick(entity, key)}><span>{label}</span><code>{value}</code></button>)}
    </section>;
  }

 render(){if(!this.started)return <div class="workbench-sleep"/>;if(this.conceptPage==='D21')return <zettel-lab active={this.active}/>;
 const missing=[!this.fields.title?.trim()&&'题名',!this.creators.length&&'责任者',!this.issued&&'日期',!this.fields.publisher&&!this.fields.publication_title&&'出版来源'].filter(Boolean);
 const bound=this.bound,name=displayCreator(this.creators[0])||'未填写',currentType=this.fields.item_type||'book';
 return <div class="mds-container">{this.standaloneSection?<markdown-lab pageId={this.standaloneSection} active={this.active} showDiagram={false}/>:<patchouli-app initialPage={this.request.page} request={this.request} active={this.active} onPatchouliStateChange={this.stateChanged}/>}{!this.item?<p class="mds-loading">书库启动中…</p>:this.navigation==='concepts'?this.conceptDiagram():this.navigation==='layers'?this.layerStack():<aside class="mds-model" aria-label="条目关系图">
        <div class="mds-diagram">
          <svg class="mds-connections" viewBox="0 0 400 520" preserveAspectRatio="none" aria-hidden="true"><path d="M205 115 L205 155 L98 155 L98 212 M205 155 L305 155 L305 212 M305 290 L305 455" /></svg>
          <span class="mds-relation mds-relation-attachment">关联</span><span class="mds-relation mds-relation-field">设有字段</span><span class="mds-relation mds-relation-value">承载值</span>
          {this.entityBox('item', '条目', [['item_type', '文献类型', types[currentType] || currentType], ['', '条目身份', this.item.item_id.slice(0, 8)], ['status', '工作进度', this.fields.status || '未标注']])}
          {this.entityBox('attachment', '附件', [['', '关联文件', `${this.docs.length} 份`], ['', '原件绑定', `${bound} 份`], ['', '文件类型', 'PDF']])}
          {this.entityBox('field', '字段', [['title', '题名', 'title'], ['creators', '责任者', 'creator'], ['issued', '日期', 'issued']])}
          {this.entityBox('metadata', '元数据', [['title', '题名值', this.fields.title || '未填写'], ['creators', '责任者值', name], ['issued', '日期值', this.issued || '未填写']])}
        </div>
        <p class="mds-diagram-hint">点击图内实体查看对应表示</p>
        <div class="mds-states" aria-label="材料的三种状态"><p><b>题录</b><span>{missing.length ? `待补${missing.join('、')}` : '主要字段已填写'}</span></p><p><b>附件</b><span>{this.docs.length ? `${this.docs.length} 份关联，${bound} 份已绑定` : '尚未关联'}</span></p><p><b>阅读</b><span>{this.fields.status || '尚未记录'}</span></p></div>
        <p class="mds-takeaway">题录完整、附件存在、正文读过，需要分别判断。</p>
      </aside>}</div>;
 }
}
