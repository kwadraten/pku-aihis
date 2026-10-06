import {Component,h,State} from '@stencil/core';
@Component({tag:'glossary-view',shadow:false})
export class GlossaryView{
 @State() categories:any[]=[];@State() query='';@State() selected='';
 async componentWillLoad(){this.categories=(await (await fetch(new URL('assets/data/glossary.json',document.baseURI).href)).json()).categories;}
 render(){const filter=(t:any)=>(t.term+' '+t.en+' '+t.definition).toLowerCase().includes(this.query.toLowerCase());return <div class="glossary"><aside><input aria-label="搜索术语" placeholder="搜索术语 / English" value={this.query} onInput={(e:any)=>this.query=e.target.value}/>{this.categories.flatMap(c=>c.terms.filter(filter)).map(t=><button onClick={()=>{this.selected=t.term;document.getElementById('term-'+t.term)?.scrollIntoView({block:'center'});}}>{t.term}</button>)}</aside><div class="glossary-main">{this.categories.map(c=><section><h3>{c.label}</h3>{c.terms.filter(filter).map(t=><article id={'term-'+t.term} class={{'concept-card':true,on:t.term===this.selected}}><h3>{t.term} <small>{t.en}</small></h3><p>{t.definition}</p>{t.first_slide&&<a href={'#'+t.first_slide}>课程页面 {t.first_slide} · </a>}{t.wiki?.url&&<a target="_blank" rel="noopener noreferrer" href={t.wiki.url}>Wikipedia ↗</a>}</article>)}</section>)}</div></div>;}
}
