import {Component,h,State,Element,Prop,Watch,Method} from '@stencil/core';
import {downloadBytes} from '../shared/download';
const rows=[
 ['容器体系 / Schema','ConceptScheme · hasTopConcept','声明词表体系和顶层入口。','Bepaalt het schema en zijn topconcepten.'],
 ['基本实体 / Entiteit','Concept','URI 标识概念；名称可以变化，概念仍可指认。','Een kenniseenheid met een eigen URI.'],
 ['层级 / Hiërarchie','broader · narrower','上下位表示范围宽窄，不作严格逻辑继承。','Ruimere en engere begrippen, geen strikte overerving.'],
 ['关联 / Associatie','related','非从属的对称关系：太平天国运动 ↔ 湘军。','Symmetrische, niet-hiërarchische samenhang.'],
 ['首选名称 / Voorkeurslabel','prefLabel','每个语言标记最多一个首选标签。','Maximaal één voorkeurslabel per taal.'],
 ['异称 / Alternatief label','altLabel','保留太平天国、洪杨之乱、粤匪等检索入口。','Alternatieve namen verrijken het zoeken.'],
 ['解释 / Toelichting','definition · scopeNote','说明范围和历史语境；异称的立场在注释中交代。','Definitie en afbakening van het gebruik.'],
];
@Component({tag:'skos-lab',styleUrl:'skos-lab.css',shadow:false})
export class SkosLab {
 @Element() el:HTMLElement;@Prop() active=false;
 @State() mode='ideas';@State() text='';@State() message='正在载入历史词表…';@State() error='';@State() model:any;@State() hover:any;@State() point:any;
 @State() language='zh';@State() filters={hierarchy:true,associative:true,lexical:true,names:false};
 private tools:any;private editor:any;private graph:any;private template='';private timer:any;private version=0;private initializing=false;
 @Watch('active') activate(){if(this.active){void this.init();requestAnimationFrame(()=>this.mount());}else this.graph?.stop();}
 componentDidLoad(){if(this.active)void this.init();}
 disconnectedCallback(){clearTimeout(this.timer);this.editor?.destroy();this.graph?.destroy();}
 private async init(){if(this.tools||this.initializing)return;this.initializing=true;try{const url=new URL('assets/skos/tools.mjs',document.baseURI).href;this.tools=await import(/* webpackIgnore: true */url);this.template=await fetch('assets/skos/history.ttl').then(r=>r.text());this.text=localStorage.getItem('week04-skos-history')??this.template;await this.parse();this.mount();}catch(e){this.error=e.message;}finally{this.initializing=false;}}
 private change=(text:string)=>{this.text=text;localStorage.setItem('week04-skos-history',text);this.error='';this.message='正在解析…';clearTimeout(this.timer);this.timer=setTimeout(()=>void this.parse(),220);};
 private async parse(){const version=++this.version;try{const model=await this.tools.parseTurtle(this.text);if(version!==this.version)return;this.model=model;this.error='';this.message=`${model.schemes} 个体系 · ${model.concepts} 个概念 · ${model.labels} 个标签 · ${model.triples} 条 RDF 陈述`;if(this.mode==='graph')requestAnimationFrame(()=>this.mountGraph());}catch(e){if(version===this.version){this.error=e.message;this.message='请修正 Turtle 后再预览';}}}
 private switchMode(mode:string){this.mode=mode;this.hover=null;requestAnimationFrame(()=>this.mount());}
 componentDidRender(){if(this.active)this.mount();}
 private mount(){if(!this.tools)return;if(this.mode==='code'){const host=this.el.querySelector('.skos-code');if(host&&!host.querySelector('.cm-editor')){this.editor?.destroy();this.editor=this.tools.createEditor(host,this.text,this.change);}}else{this.editor?.destroy();this.editor=null;}if(this.mode==='graph'&&!this.graph&&this.model&&!this.error)this.mountGraph();else if(this.mode!=='graph'||this.error){this.graph?.destroy();this.graph=null;}}
 private mountGraph(){const host=this.el.querySelector('.skos-graph');if(!host||!this.model||this.error||!this.model.nodes.length)return;this.graph?.destroy();this.graph=this.tools.createGraph(host,this.model,(node,point)=>{this.hover=node;this.point=point;},this.language);this.graph.filter(this.filters);}
 @Method() async getModel(){return this.model;}
 @Method() async getGraph(){return this.graph?.snapshot();}
 private toggle(key:string,value:boolean){this.filters={...this.filters,[key]:value};this.graph?.filter(this.filters);}
 render(){return <section class="skos-lab" aria-label="SKOS历史词表实验">
  <header class="example-toolbar"><nav aria-label="SKOS模式">{[['ideas','基本思想'],['code','编辑词表'],['graph','力导向预览']].map(([mode,label])=><button aria-pressed={String(this.mode===mode)} class={this.mode===mode?'selected':''} onClick={()=>this.switchMode(mode)}>{label}</button>)}</nav><span role="status" class={this.error?'example-error':''}>{this.error||this.message}</span>{this.mode==='code'&&<span><button onClick={()=>{this.text=this.template;this.editor?.setText(this.template);this.change(this.template);}}>恢复示例</button><button onClick={()=>downloadBytes(new TextEncoder().encode(this.text),'晚清历史主题词表.ttl','text/turtle')}>下载 .ttl</button></span>}</header>
  {this.mode==='ideas'&&<div class="skos-ideas"><div class="skos-principle"><h3>一个概念，多个语言与历史称谓</h3><div class="skos-schema-chip">近代中国史主题词表 <code>ConceptScheme</code></div><div class="skos-simple-map"><div class="skos-concept-chip"><strong>太平天国运动</strong><code>ex:TaipingMovement</code><small>Concept · URI</small></div><span>→ 标签</span><div class="skos-labels"><p><b>prefLabel</b> 太平天国运动 @zh</p><p><b>prefLabel</b> Taiping Rebellion @en</p><p><b>altLabel</b> 洪杨之乱 / 粤匪 @zh</p></div></div><div class="skos-semantic-map"><span>近代中国史</span><b>narrower ↓</b><span>晚清史</span><b>narrower ↓</b><div><span>太平天国运动</span><b>related ↔</b><span>湘军</span></div></div><p>检索“粤匪”可以抵达同一概念；注释交代该称谓的来源与立场，避免把命名直接当作判断。</p></div><table class="skos-properties"><thead><tr><th>语义维度</th><th>skos: 属性</th><th>结构作用</th></tr></thead><tbody>{rows.map(([dimension,property,meaning,nl])=><tr><td>{dimension}</td><td><code>{property}</code></td><td>{meaning}<small>{nl}</small></td></tr>)}</tbody></table></div>}
  {this.mode==='code'&&<div class="skos-editor-pane"><p>修改首选名、补充异称或增加概念关系，再切换到力导向预览，查看同一份词表的结果。</p><div class="skos-code"/></div>}
  {this.mode==='graph'&&<div class="skos-preview"><div class="skos-filters">{[['hierarchy','上下位'],['associative','关联'],['lexical','词汇标签'],['names','关系名称']].map(([key,label])=><label><input type="checkbox" checked={this.filters[key]} onChange={(e:any)=>this.toggle(key,e.target.checked)}/>{label}</label>)}<select aria-label="图中标签语言" onChange={(e:any)=>{this.language=e.target.value;requestAnimationFrame(()=>this.mountGraph());}}><option value="zh" selected={this.language==='zh'}>中文标签</option><option value="all" selected={this.language==='all'}>全部语言</option></select><button onClick={()=>this.graph?.fit()}>适应画布</button><span>拖动节点 · 滚轮缩放</span></div>{this.error?<p class="example-error">修正编辑器中的词表后即可生成新图。</p>:<div class="skos-graph">{!this.model?.nodes.length&&<p>添加 ConceptScheme 或 Concept，即可在这里查看词表结构。</p>}</div>}<div class="skos-legend"><span class="scheme">● ConceptScheme</span><span class="concept">● Concept</span><span class="literal">● RDF Literal · 词汇标签</span></div></div>}
  {this.hover&&<aside class="skos-tooltip" role="tooltip" style={{left:Math.min(this.point?.x+12,window.innerWidth-355)+'px',top:Math.min(this.point?.y+12,window.innerHeight-210)+'px'}}><strong>{this.hover.name}</strong><code>{this.hover.uri||this.hover.property}</code>{this.hover.labels?.filter(l=>l.property==='altLabel').map(l=><p>异称：{l.value} @{l.language}</p>)}{this.hover.notes?.map(note=><p>{note.property}：{note.value}</p>)}</aside>}
 </section>;}
}
