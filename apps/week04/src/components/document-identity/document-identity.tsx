import {Component,h,State} from '@stencil/core';
import {liveLibrary} from '../../lib/live-library';
@Component({tag:'document-identity',styleUrl:'document-identity.css',shadow:false})
export class DocumentIdentity {
 @State() selected=0;
 @State() ready=false;private off:()=>void;
 componentWillLoad(){this.off=liveLibrary.subscribe(state=>this.ready=state==='ready');}
 disconnectedCallback(){this.off?.();}
 private cases=[
  {name:'复制同一个 PDF',same:[true,true,true,false],result:'字节完全相同 → 文件哈希相同。复制到另一文件夹没有产生新版本；可复用文件资产。',detail:'文件路径变了，文件身份没有变。'},
  {name:'重新扫描同一版本',same:[true,false,false,false],result:'题录仍对应同一出版版本；新的扫描文件具有新哈希，作为另一文档实例关联到原题录。',detail:'同一版本，可以有多份扫描件。'},
  {name:'换成另一出版版本',same:[false,false,false,false],result:'作品可能相同，但出版年代、版次或译者不同 → 建立另一题录，保留版本之间的关系。',detail:'同题名并不足以判定同一版本。'},
  {name:'校对识别文字',same:[true,true,true,true],result:'题录、文档实例和 PDF 原件不变；边界框树产生新修订，全文索引据此重建。',detail:'修订 ID 改变；旧修订仍可回查。'}
 ];
 render(){const lib=liveLibrary.getLibrary(),item=lib?.items().find(i=>i.item_id==='1e5d7930-c7ed-4208-9086-fd2423c71f91'),doc=item&&lib.rows('select * from document_instances where item_id=?',[item.item_id])[0],file=doc&&lib.rows('select full_blake3 from file_assets where file_asset_id=?',[doc.file_asset_id])[0];const scenario=this.cases[this.selected];return <section class="identity-example" aria-label="同一文献的身份示意图"><header><h3>“同一文献”要先说明：同的是哪一层？</h3><p>以《Milk Is Gold》为例，题名是描述，身份由相应层的标识确定。</p></header><div class="identity-layout"><div class="identity-diagram">{[['题录：这个出版版本',item?.item_id,'记录题名、作者、年代；出版版本改变时另建题录'],['文档实例：这份数字文档',doc?.document_instance_id,'将一次扫描、识别与修订关联到题录'],['文件资产：这份 PDF 的字节',file?.full_blake3,'以 BLAKE3 判断文件是否完全相同'],['内容修订：这一次校对结果','rev → 页 → box','修订变化，原始 PDF 与文档身份仍可保留']].map(([name,id,reason],i)=><div class={'identity-level level-'+i} style={{'--motion-index':String(i)}}><strong>{name}</strong><code title={id}>{id?.slice(0,20)}{id?.length>20?'…':''}</code><small>{reason}</small></div>)}</div><div class="identity-cases"><span>选择一种变化</span><nav>{this.cases.map((s,i)=><button aria-pressed={String(this.selected===i)} onClick={()=>this.selected=i}>{s.name}</button>)}</nav><article key={this.selected}><h4>{scenario.name}</h4><div class="identity-verdict">{['题录','文档','PDF'].map((name,i)=><span class={scenario.same[i]?'same':'changed'}>{name} {scenario.same[i]?'保持':'另建'}</span>)}<span class="revision">{scenario.same[3]?'新修订':'修订另计'}</span></div><p>{scenario.result}</p><small>{scenario.detail}</small></article><p class="identity-takeaway">检索命中须回到具体文档与修订；相同题名、相似正文和相同文件不是同一个判断。</p></div></div></section>;}
}
