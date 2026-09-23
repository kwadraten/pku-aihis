import { Fragment, Component, h, Prop, State, Watch } from '@stencil/core';
import { explanations } from '../../lib/explanations';
import { cosine, chunks, metrics } from '../../lib/math';
const n = (x:number, digits=3) => Number.isFinite(x) ? x.toFixed(digits) : '—';
const norm = (v:number[]) => Math.sqrt(v.reduce((s,x)=>s+x*x,0));
@Component({tag:'process-explainer',shadow:false})
export class ProcessExplainer {
 @Prop() demoId:string;
 @Prop() snapshot:any = {};
 @State() step=0;
 @State() angle=35;
 @State() magnitude=1;
 @State() sandbox=false;
 @Watch('demoId') reset(){this.step=0;this.sandbox=false;}
 private bars(items:{label:string;value:number;note?:string}[], max?:number){
  const top=max || Math.max(...items.map(x=>Math.abs(x.value)),0.0001);
  return <div class="ex-bars">{items.map(x=><div class="ex-bar-row"><span>{x.label}</span><span class="ex-track"><i style={{width:`${Math.min(100,100*Math.abs(x.value)/top)}%`}}/></span><b>{n(x.value)}</b>{x.note&&<small>{x.note}</small>}</div>)}</div>;
 }
 private geometry(){
  const s=this.snapshot,q=s.qvector,d=s.doc?.vector;
  let cos:number, a:number, b:number;
  if(this.sandbox){cos=Math.cos(this.angle*Math.PI/180);a=1;b=this.magnitude;}
  else if(q?.length&&d?.length===q.length){cos=Math.max(-1,Math.min(1,cosine(q,d)));a=norm(q);b=norm(d);}
  else return <p>先运行一次精确余弦或EdgeVec，再点击候选；图形将读取该查询和该片段的完整向量。也可先打开几何沙盘。</p>;
  const dot=a*b*cos, dist2=a*a+b*b-2*dot, scale=90/Math.max(a,b,1),ox=135,oy=145;
  const x=ox+b*cos*scale,y=oy-b*Math.sqrt(Math.max(0,1-cos*cos))*scale;
  return <div class="ex-split"><svg viewBox="0 0 340 180" role="img" aria-label="由完整向量夹角和长度构造的二维几何图">
   <line x1="15" x2="325" y1={oy} y2={oy} stroke="#d8d6cd"/><line x1={ox} x2={ox} y1="12" y2="168" stroke="#d8d6cd"/>
   <line x1={ox} y1={oy} x2={ox+a*scale} y2={oy} stroke="#164ec7" stroke-width="4"/>
   <circle cx={ox+a*scale} cy={oy} r="5" fill="#164ec7"/><text x={ox+a*scale-25} y={oy+22}>查询 q</text>
   <line x1={ox} y1={oy} x2={x} y2={y} stroke="#b05618" stroke-width="4"/>
   <circle cx={x} cy={y} r="5" fill="#b05618"/><text x={x+6} y={Math.max(14,y-6)}>文档 d</text>
   <line x1={x} y1={y} x2={ox+a*scale} y2={oy} stroke="#647269" stroke-width="2" stroke-dasharray="5 4"/>
   <text x="12" y="22">夹角 {n(Math.acos(cos)*180/Math.PI,1)}°</text><text x="12" y="44">虚线 = 两端距离</text>
  </svg><div><div class="ex-formula">点积 q·d = |q| × |d| × cosθ = {n(dot)}</div><div class="ex-formula">余弦 = (q·d) / (|q| |d|) = {n(cos)}</div><div class="ex-formula">L2 = √(|q|² + |d|² − 2q·d) = {n(Math.sqrt(Math.max(0,dist2)))}</div><p>L2² = {n(dist2)}；|q| = {n(a)}，|d| = {n(b)}。{this.sandbox?'只拉长d时，余弦不变；点积还取决于长度（垂直时始终为0），L2看两端相距多远。':'本库向量已归一化；cos越大与L2²越小给出同一排序。'}</p><small>{this.sandbox?'可调几何构造：用于分离夹角和长度的影响，不是史料模型的新输出。':`当前${q.length}维向量的长度与夹角构成此平面，未用前两维冒充整体，也不是全库降维图。`}</small></div></div>;
 }
 private bm25(){
  const s=this.snapshot,r=s.results?.find(x=>x.id===s.doc?.id),p=r?.parts?.find(x=>x.tf>0);
  if(!p)return <p>先运行BM25，再选择命中项。曲线将以当前片段的长度和第一个命中词项计算。</p>;
  const len=r.length/(r.avg||1), f=(tf:number,k1=s.k1,b=s.b)=>p.idf*tf*(k1+1)/(tf+k1*(1-b+b*len));
  // Keep the vertical scale fixed while k1/b change, so a score change is visible.
  const ymax=Math.max(p.idf*4,.001), xmax=Math.max(12,p.tf+2);
  const points=(k1:number,b:number)=>Array.from({length:81},(_,i)=>{const tf=i*xmax/80;return `${38+tf/xmax*270},${135-f(tf,k1,b)/ymax*110}`}).join(' ');
  return <div class="ex-split"><div><svg viewBox="0 0 340 173" role="img" aria-label="当前词项的BM25词频饱和曲线"><line x1="38" y1="135" x2="315" y2="135" stroke="#999"/><line x1="38" y1="135" x2="38" y2="20" stroke="#999"/><polyline points={points(1.2,.75)} fill="none" stroke="#888" stroke-dasharray="5 4" stroke-width="2"/><polyline points={points(s.k1,s.b)} fill="none" stroke="#164ec7" stroke-width="3"/><circle cx={38+p.tf/xmax*270} cy={135-f(p.tf)/ymax*110} r="6" fill="#b05618"/><text x="42" y="16">词项“{p.term}”的分数贡献</text><text x="0" y="28">{n(ymax,1)}</text><text x="20" y="139">0</text><text x="100" y="166">词频 tf →（0至{xmax}）</text><text x="42" y="151">橙点：当前 tf={p.tf}</text></svg><small>蓝线：当前参数；灰虚线：k1=1.2、b=0.75。纵轴固定，便于看出分数变化。</small></div><div><div class="ex-formula">IDF × tf(k1+1) / [tf + k1(1−b+b·L/avgL)]</div><p>{n(p.idf)} × {p.tf} × ({n(s.k1,1)}+1) / [{p.tf}+{n(s.k1,1)}×(1−{n(s.b,2)}+{n(s.b,2)}×{r.length}/{n(r.avg,1)})] = <b>{n(p.value)}</b></p><p>tf是这个词出现几次，L是本段词项数，avgL是库内平均词项数。长度比 L/avgL={n(len,2)}：{len>1?'本段比平均更长；增大b会加大长度惩罚。':len<1?'本段比平均更短；增大b会给予短段更多补偿。':'本段恰好等于平均长度，改变b对这一段没有影响。'}</p><p>k1越小，曲线越早变平：多重复几次的额外收益越小。下面把各个命中词的贡献相加，才得到本段总分。</p>{this.bars(r.parts.map(x=>({label:x.term,value:x.value})))}</div></div>;
 }
 private agentTimeline(){
  const s=this.snapshot,logs=s.logs||[],proposals=logs.filter(e=>e.event==='model_proposal'),results=logs.filter(e=>e.event==='tool_result');
  return <div><div class="ex-runtime" aria-live="polite"><span class={s.busy?'running':''}>模型提议 {proposals.length}次</span><b>→</b><span>实际工具返回 {results.length}次</span><b>↺</b><span>{s.answer?'已给出最终回答':s.busy?'正在等待下一次模型响应':'尚未完成回答'}</span></div><ol class="ex-event-list">{logs.map(e=><li><b>{Number.isInteger(e.turn)?`第${e.turn+1}轮 · `:''}{({model_proposal:'模型提出动作',tool_result:'工具实际返回',stopped:'执行器接受结束',budget_exhausted:'轮数用尽，停止',failed:'本轮失败'} as any)[e.event]||e.event}</b>{e.event==='model_proposal'&&<span> → {e.action.tool}{e.action.query?`（查询：${e.action.query}）`:e.action.id?`（片段：${e.action.id}）`:''}</span>}{e.event==='tool_result'&&<span> → {e.tool==='search'?`检索到${e.result.length}条：${e.result.map(r=>r.id).join('、')}`:`读到${e.result.id}的正文（${[...(e.result.text||'')].length}字符）`}</span>}{e.event==='failed'&&<span> → {e.error}</span>}</li>)}</ol>{!logs.length&&<p>运行后，每一条实际动作和返回会按顺序排在这里；点击上方教学环节不会触发模型。</p>}<small>此时间线来自实际事件日志。它展示程序与工具做了什么，不是模型内部思维链。</small></div>;
 }
 private detail(){
  const s=this.snapshot,id=this.demoId;
  if(['D08','D12'].includes(id))return <div><div class="lab-toolbar"><button class={!this.sandbox?'selected':''} onClick={()=>this.sandbox=false}>当前查询与所选片段</button><button class={this.sandbox?'selected':''} onClick={()=>this.sandbox=true}>可调几何沙盘</button>{this.sandbox&&<><label>夹角 {this.angle}° <input aria-label="几何夹角" type="range" min="0" max="180" value={this.angle} onInput={(e:any)=>this.angle=+e.target.value}/></label><label>文档向量长度 {this.magnitude}<input aria-label="几何长度" type="range" min="0.2" max="2" step="0.1" value={this.magnitude} onInput={(e:any)=>this.magnitude=+e.target.value}/></label></>}</div>{this.geometry()}{s.output?.exact&&<p class="ex-callout">EdgeVec前5项与精确前5项重合 {s.output.overlap}/5。精确排序为 {s.output.exact.slice(0,5).map(x=>x.id).join(' → ')}。这是本次结果比较，不是内部访问轨迹。</p>}</div>;
  if(id==='D07')return this.bm25();
  if(id==='D03'){
   const len=[...(s.text||'')].length,parts=chunks(s.text||'',s.size,s.overlap);
   return <div><p class="ex-formula">每次前进 = 块长 − 重叠 = {s.size} − {s.overlap} = {s.size-s.overlap} 字符；{len}字符 → {parts.length}块</p><svg viewBox={`0 0 700 ${Math.min(5,parts.length)*25+20}`} role="img" aria-label="实际切块区间与重叠"><text x="0" y="14">原文字符位置：0 → {len}</text>{parts.slice(0,5).map((p,i)=><g><rect x={80+p.start/(len||1)*580} y={23+i*25} width={(p.end-p.start)/(len||1)*580} height="16" fill="#cad8f4"/>{i>0&&<rect x={80+p.start/(len||1)*580} y={23+i*25} width={Math.min(s.overlap,p.end-p.start)/(len||1)*580} height="16" fill="#b05618"/>}<text x="0" y={35+i*25}>{p.start}–{p.end}</text></g>)}</svg><small>蓝色为完整块，橙色为与上一块重复的部分；仅画前5块，区间右端不含。分词选择改变检索词项，块长改变文本窗口。</small></div>;
  }
  if(id==='D02'&&s.normalized){const before=[...(s.text||'')],after=[...s.normalized];return <div class="ex-split"><div><b>转换前</b><p class="ex-preview">{before.map((c,i)=><span class={after[i]!==c?'ex-changed':''}>{c}</span>)}</p></div><div><b>转换后 · {s.config}</b><p class="ex-preview">{after.map((c,i)=><span class={before[i]!==c?'ex-changed':''}>{c}</span>)}</p><small>按字符位置标出不同；发生合并或长度变化后，后续高亮是位置差异，不能逐项理解成替换对应。</small></div></div>;}
  if(id==='D04'&&s.output){const o=s.output;return <div><p class="ex-formula">词“{o.word}”：TF-IDF = 次数 × [ln((3+1)/(df+1))+1]；df={o.counts.filter(x=>x>0).length}，IDF={n(o.idf)}</p><div class="ex-runtime">{o.one_hot.map((v,i)=><span class={v?'done':''}><small>{o.terms?.[i]}</small><br/><b>{v}</b></span>)}</div><small>上行是这个词的one-hot位置；下行按文档数词，再乘IDF。</small>{this.bars(o.counts.map((tf,i)=>({label:o.documents?.[i]||`D${i+1}`,value:tf*o.idf,note:`出现${tf}次 × ${n(o.idf)} → TF-IDF`})))}<p>词袋不保存先后顺序。把句中词顺序交换，计数仍可能完全一样。</p></div>;}

  if(id==='D09'&&s.results?.length){const top=s.results.slice(0,3),max=Math.max(...top.flatMap(r=>[r.parts?.[0]||0,r.parts?.[1]||0]),.0001);return <div><p class="ex-formula">RRF(d) = Σ 1/({s.c}+名次)；缺席一路记0，不把BM25与余弦原分数相加。</p>{top.map((r,i)=><div class="ex-fusion"><b>#{i+1} {r.id}</b>{this.bars([0,1].map(j=>({label:j?'向量':'关键词',value:r.parts?.[j]||0,note:r.ranks?.[j]?`名次${r.ranks[j]} → 1/(${s.c}+${r.ranks[j]})`:'未出现在这一路 → 贡献0'})),max)}<strong>→ 合计 {n(r.score,5)}</strong></div>)}<p>三张卡片使用同一横轴尺度。c越大，第一名与第二名的贡献差越小；重复出现于两路的文档可累计两份贡献。</p></div>;}
  if(id==='D10'){
   const top=(s.results||[]).slice(0,5),m=metrics(top.map(x=>x.id),s.qrels||{},5);
   return <div class="ex-split"><div>{this.bars(top.map((r,i)=>({label:`#${i+1} ${r.id}`,value:(2**(s.qrels[r.id]||0)-1)/Math.log2(i+2),note:`等级${s.qrels[r.id]??'未判断'}：增益 / log₂(${i+2})`})))}{!top.length&&<p>取得待判断结果后，这里显示每个位置的折扣贡献。</p>}</div><div class="ex-formula">P@5 = 前5项相关数 / 5 = {n(Number(m.precision),2)}<br/>DCG = 各条贡献之和 = {n(Number(m.dcg))}<br/>IDCG = 判断池理想顺序的DCG = {n(Number(m.ideal))}<br/>nDCG = {m.ndcg===null?'分母为0，暂不可算':n(Number(m.ndcg))}<p>未判断{m.unjudged}项。位置越后，分母越大，相同等级贡献越小。</p></div></div>;
  }
  if(id==='D21'&&s.output?.before)return <div>{['alpha','beta','gamma'].some(k=>s[k]!==s.output[k])&&<p class="ex-callout">参数已改变，下面仍是上次执行的结果；点击“更新查询并重新检索”应用新参数。</p>}<p class="ex-formula">q′=unit({s.output.alpha}q + {s.output.beta}相关均值 − {s.output.gamma}不相关均值)</p><p>范围：{s.output.scope==='all'?'全部材料':s.output.scope}，{s.output.corpus_size}条记录。新旧查询夹角 {n(s.output.angle,2)}°；相关{s.output.positive}条，不相关{s.output.negative}条。未标记记录没有被当作负例。</p><div class="ex-split"><div><b>更新前</b>{s.output.before.slice(0,5).map((r,i)=><p>#{i+1} {r.id} · {n(r.score)}</p>)}</div><div><b>更新后</b>{s.results.slice(0,5).map((r,i)=><p>#{i+1} {r.id} · {n(r.score)} ← 原#{s.output.before.findIndex(x=>x.id===r.id)+1}</p>)}</div></div></div>;
  if(id==='D24')return this.agentTimeline();
  if(id==='D13')return <div><div class="ex-runtime" aria-live="polite">{id==='D13'?<><span class={s.phase>=1?'done':''}>候选 {s.results?.length||0}</span><b>→</b><span class={s.phase>=2?'done':''}>选择 {s.contextIds?.length||0}片段</span><b>→</b><span class={s.phase>=3?'done':''}>请求 {s.output?.messages?.length||0}消息</span><b>→</b><span class={s.answer?'done':s.busy?'running':''}>{s.answer?'已返回回答':s.busy?'正在执行':'待生成'}</span></>:<><span>问题</span><b>→</b><span class={s.busy?'running':''}>行动 {s.logs?.length||0}条</span><b>→</b><span>工具返回</span><b>↺</b><span>{s.answer?'最终回答':'等待结束'}</span></>}</div><small>上行是当前页面状态；下方行动日志才记录每次模型动作及实际工具返回。动画只表示等待，不表示模型内部推理路径。</small></div>;
  if(id==='D22'&&s.output?.edges)return <div class="ex-network">{s.output.edges.map(e=><div><span>{e.from}</span><b> ──引用→ </b><span>{e.to}</span><small>{e.note||e.locator||e.evidence||'定位见下方来源记录'}</small></div>)}</div>;
  if(['D30','D31','D32'].includes(id))return <div class="ex-runtime"><span>{id==='D32'?`查询图块 #${s.imageIndex+1}`:id==='D31'?'选择已有文字查询':`原图 #${s.imageIndex+1}`}</span><b>→</b><span>{id==='D30'?`派生文本：${s.captionMode}`:id==='D31'?'CLIP文本塔 ↔ 图像塔':'Shikiji视觉特征'}</span><b>→</b><span>{id==='D30'?`逐词命中：“${s.query}”`:'cos(q,d) = q·d / (|q||d|)'}</span><b>→</b><span>{id==='D30'?'检查描述有无漏写':'按模型相似度排序'}</span></div>;
  if(id==='D01')return <div class="ex-runtime"><span>{s.doc?.title}</span><b>→</b><span>PDF页 {s.doc?.pdf_page??'待核'}</span><b>→</b><span>片段 {s.doc?.id}</span><b>→</b><span>{[...(s.text||'')].length}字符</span></div>;
  if(id==='D11')return <p class="ex-callout">本次查询“{s.query}” → Lucivy索引 → 当前返回{s.results?.length||0}条。选中 {s.doc?.id}，核对右侧原段。执行状态：{s.busy?'进行中':s.results?.length?'已取得结果':'尚无命中结果'}。</p>;
  if(['D28','D29'].includes(id))return <div class="ex-runtime"><span>问题：{s.query}</span><b>→</b><span>范围：{s.author==='all'?'全部':s.author}</span><b>→</b><span>当前片段：{s.doc?.id}</span><b>→</b><span>已记录{s.logs?.length||0}轮判断</span></div>;
  return null;
 }
 render(){
  const e=explanations[this.demoId];if(!e)return null;
  return <details class="process-explainer" open><summary>{e.question}<small>教学拆解：点击环节换解释；实际运行状态另列</small></summary><div class="ex-scroll"><div class="ex-steps">{e.steps.map((x,i)=><span><button class={i===this.step?'active':''} aria-pressed={i===this.step} onClick={()=>this.step=i}>{String(i+1).padStart(2,'0')} · {x}</button>{i<e.steps.length-1&&<b aria-hidden="true"> → </b>}</span>)}</div><p class="ex-why"><b>{e.steps[this.step]}：</b>{e.why[this.step]}</p>{this.detail()}<p class="ex-try">动手观察：{e.try}</p></div></details>;
 }
}
