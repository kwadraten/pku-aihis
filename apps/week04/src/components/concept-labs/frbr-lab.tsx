import {Component,h,State,Prop} from '@stencil/core';
import {liveLibrary} from '../../lib/live-library';

@Component({tag:'frbr-lab',shadow:false})
export class FrbrLab{
 @State() level=0;
 private rows=[['Work · 作品','《资本论》所表达的思想内容','抽象创作'],['Expression · 表达','德语原文与不同汉译本','语言、译者与表达'],['Manifestation · 载体表现','某出版社某年某版的印本','出版者、版次、ISBN'],['Item · 单件','馆藏中的一册，或由它取得的副本','馆藏号、持有者与保存状态']];
 render(){return <div class="lab"><div class="lab-toolbar">{this.rows.map((r,i)=><button class={{on:i===this.level}} onClick={()=>this.level=i}>{r[0]}</button>)}</div><div class="concept-card frbr-card"><h2>{this.rows[this.level][0]}</h2><p class="lead">{this.rows[this.level][1]}</p><p>属性归属：{this.rows[this.level][2]}</p></div><p class="source-line">FRBR, 1998, §3.2.1–3.2.4 · 实例为教案1.4的概念映射，非导入书目。</p></div>;}
}
