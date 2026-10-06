import { Component, h, State } from "@stencil/core";
import { liveLibrary } from "../../lib/live-library";
import {selectedItem,selectItem} from '../../lib/research-context';

interface CloudTag {
  tag: string;
  item_count: number;
  kind?: string;
  reason?: string;
  picked?: string;
}

const STATUS_RE = /^(待|未|已|要|翻訳|読|一時|保留|toread|todo|done|pending|in[- ]?progress)/i;
const NDC_RE = /^[0-9]{2,4}(\.[0-9]+)*(:.+)?$/;

function classify(tag: string): { kind: string; reason: string } {
  const isNdc = NDC_RE.test(tag);
  const isStatus = STATUS_RE.test(tag);
  if (isNdc && isStatus)
    return { kind: "职责含混", reason: "形如类号又带状态词——两种职责挤在一个标签上" };
  if (isNdc)
    return {
      kind: "分类号",
      reason: "形如分类／学科代码；须回查原体系（部分带冒号的代码来自ProQuest），本页仅作规则提示。",
    };
  if (isStatus)
    return { kind: "工作状态", reason: "指向处理阻碍（待核/待读类），价值在下一步动作而非数量" };
  return { kind: "主题", reason: "描述材料涉及什么——跨组筛选入口" };
}

// D14 演示3①：标签云指认（教师库截面）+ 活体库加标签 + 筛选＝查询派生投影表。
@Component({ tag: "tag-lab", shadow: false })
export class TagLab {
  @State() cloud: CloudTag[] = [];
  @State() items: any[] = [];
  @State() selected: string = "";
  @State() newTag = "";
  @State() liveTags: string[] = [];
  @State() filterTag = "";
  @State() filterResult: any[] = [];
  @State() projection = { rows: 0, rebuilt: false, log: "" };
  @State() notice = "";
  @State() collections:any[]=[];
  @State() collectionName='';
  @State() memberships:string[]=[];
  private unsubscribe: () => void;
  private selection=()=>{if(this.items.some(i=>i.item_id===selectedItem())){this.selected=selectedItem();this.refreshLiveTags();}};

  componentWillLoad() {
    window.addEventListener('research-selection',this.selection);
    this.unsubscribe = liveLibrary.subscribe((state) => {
      if (state !== "ready") return;
      const lib = liveLibrary.getLibrary();
      this.items = lib.items();
      if (!this.selected) this.selected = this.items.find(i=>i.item_id===selectedItem())?.item_id || this.items[0]?.item_id || "";
      this.refreshLiveTags();
    });
  }
  disconnectedCallback() {
    this.unsubscribe?.();
    window.removeEventListener('research-selection',this.selection);
  }

  private refreshLiveTags() {
    const lib = liveLibrary.getLibrary();
    if (!lib) return;
    const tags = new Set<string>();
    for (const i of lib.items()) for (const t of JSON.parse(i.tags_json || "[]")) tags.add(t);
    this.liveTags = [...tags];
    this.cloud=lib.rows('select tag,count(*) item_count from item_tag_memberships where is_active=1 group by tag order by tag');
    this.projection.rows = lib.rows("select count(*) n from item_tag_memberships where is_active=1")[0].n;
    this.collections=lib.collections();
    this.memberships=lib.rows('select collection_id from item_collections where item_id=?',[this.selected]).map(r=>r.collection_id);
  }

  private pick(tag: CloudTag, choice: string) {
    const answer = classify(tag.tag);
    this.cloud = this.cloud.map((t) =>
      t.tag === tag.tag ? { ...t, picked: choice, kind: answer.kind, reason: answer.reason } : t,
    );
  }

  private async addTag() {
    const lib = liveLibrary.getLibrary();
    if (!lib || !this.newTag.trim() || !this.selected) return;
    const item = lib.rows("select * from items where item_id=?", [this.selected])[0];
    const tags = [...new Set([...JSON.parse(item.tags_json || "[]"), this.newTag.trim()])];
    const normalized=await window.DotNet.invokeMethodAsync('CoreProbe','NormalizeTags',tags);
    await lib.mutate(()=>lib.run('update items set tags_json=?,updated_at=? where item_id=?',[JSON.stringify(normalized),new Date().toISOString(),this.selected]));
    this.notice = `已把「${this.newTag.trim()}」写入题录（NormalizeTags：修剪空格、序数去重、保留大小写）`;
    this.newTag = "";
    this.refreshLiveTags();
  }

  private filter(tag: string) {
    const lib = liveLibrary.getLibrary();
    if (!lib) return;
    this.filterTag = tag;
    // 筛选＝查询派生投影表 item_tag_memberships，而不是扫权威数据。
    this.filterResult = lib.rows(
      "select i.item_id, i.title from item_tag_memberships m join items i on i.item_id=m.item_id where m.tag=? and m.is_active=1 and i.deleted_at is null",
      [tag],
    );
  }

  private async rebuildProjection() {
    const lib = liveLibrary.getLibrary();
    if (!lib) return;
    await lib.mutate(() => {
      lib.run("delete from item_tag_memberships");
      lib.run(`insert into item_tag_memberships
        select i.item_id, cast(t.key as integer), t.value, i.library_id,
               i.deleted_at is null and i.merged_into_item_id is null
        from items i, json_each(case when json_valid(i.tags_json) then i.tags_json else '[]' end) t
        where json_type(case when json_valid(i.tags_json) then i.tags_json else '[]' end) = 'array' and t.type = 'text'`);
    });
    const after = liveLibrary.getLibrary().rows("select count(*) n from item_tag_memberships where is_active=1")[0].n;
    this.projection = {
      ...this.projection,
      rebuilt: true,
      log: `投影已删除并按 items.tags_json 重建：${this.projection.rows} → ${after} 行；权威数据（tags_json）全程未动。`,
    };
  }

  render() {
    const max = Math.max(1, ...this.cloud.map((t) => t.item_count));
    const picked = this.cloud.filter((t) => t.picked).length;
    return (
      <div class="lab w14-lab">
        <div class="flow-grid">
          <section class="flow-col">
            <header>
              标签云 · 逐个点认 <b>{picked}/{this.cloud.length}</b>
            </header>
            <p class="flow-why">
              这是当前真实数据库子集的标签投影。点一个标签，判断它是主题、状态还是学科代码。
            </p>
            <div class="w14-cloud">
              {this.cloud.map((t) => {
                const size = 11 + Math.sqrt(t.item_count / max) * 13;
                return (
                  <span class="w14-cloud-item">
                    <button
                      style={{ fontSize: `${size}px` }}
                      class={{ picked: !!t.picked, right: t.picked === t.kind, wrong: t.picked && t.picked !== t.kind }}
                      onClick={() => this.pick(t, t.picked || "")}
                      title={`${t.item_count} 条`}
                    >
                      {t.tag}
                    </button>
                    <span class="w14-pick-row">
                      {["主题", "工作状态", "分类号", "职责含混"].map((c) => (
                        <button
                          class={{ mini: true, on: t.picked === c }}
                          onClick={() => this.pick(t, c)}
                        >
                          {c}
                        </button>
                      ))}
                    </span>
                    {t.kind && (
                      <p class={{ "w14-verdict": true, ok: t.picked === t.kind }}>
                        {t.picked ? `你的判断：${t.picked}；规则提示` : "规则提示"}：{t.kind}——{t.reason}
                      </p>
                    )}
                  </span>
                );
              })}
            </div>
          </section>
          <section class="flow-col">
            <header>
              活体库标签区 <b>{this.liveTags.length} 个真实标签</b>
            </header>
            <p class="flow-why">现有标签直接取自源数据库；下面的操作真实写入当前库。</p>
            <div class="lab-toolbar">
              <select
                aria-label="选择题录"
                onChange={(e: any) => {this.selected = e.target.value;selectItem(this.selected);this.refreshLiveTags();}}
              >
                {this.items.map((i: any) => (
                  <option value={i.item_id} selected={i.item_id === this.selected}>{i.title.slice(0, 36)}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="新标签，如 待核 或 蒙古史"
                value={this.newTag}
                onInput={(e: any) => (this.newTag = e.target.value)}
                onKeyDown={(e: any) => e.key === "Enter" && this.addTag()}
              />
              <button disabled={!this.newTag.trim()} onClick={() => this.addTag()}>
                加标签（真实写库）
              </button>
            </div>
            {this.liveTags.length ? (
              <p>
                {this.liveTags.map((t) => (
                  <button class="tag w14-live-tag" onClick={() => this.filter(t)}>
                    {t}
                  </button>
                ))}
              </p>
            ) : (
              <p class="w04-empty">活体库当前没有任何标签——点上面按钮写入第一个。</p>
            )}
            {this.filterTag && (
              <div class="evidence-card">
                <strong>筛选「{this.filterTag}」＝查询派生投影表</strong>
                <p class="lab-note">
                  命中 {this.filterResult.length} 条题录（数据来自 item_tag_memberships 投影，不是权威表本身）
                </p>
                {this.filterResult.map((r: any) => (
                  <p class="source-line">· {r.title}</p>
                ))}
              </div>
            )}
            <button onClick={() => this.rebuildProjection()} disabled={!this.liveTags.length}>
              删除并重建投影表
            </button>
            {this.projection.log && <p class="mode">{this.projection.log}</p>}
            {this.notice && <p class="source-line">{this.notice}</p>}
            <p class="flow-try">
              权威数据只有一处（items.tags_json），投影表可以推倒重来——这是「权威存储＋派生投影」的第二次出现（D10 索引重建之后）。
            </p>
            <h3>同一条目，多个收藏</h3>
            <div class="lab-toolbar"><input aria-label="新收藏" placeholder="收藏名称" value={this.collectionName} onInput={(e:any)=>this.collectionName=e.target.value}/><button disabled={!this.collectionName.trim()} onClick={async()=>{try{await liveLibrary.getLibrary().createCollection(this.collectionName);this.collectionName='';this.refreshLiveTags();}catch(e:any){this.notice=e.message;}}}>创建收藏</button></div>
            {this.collections.map(c=><label class="collection-choice"><input type="checkbox" checked={this.memberships.includes(c.collection_id)} onChange={async(e:any)=>{await liveLibrary.getLibrary().setCollection(this.selected,c.collection_id,e.target.checked);this.refreshLiveTags();}}/>{c.name}</label>)}
            <p class="lab-note">只增加关系指针，文件字节与哈希保持原状。</p>
          </section>
        </div>
        <config-hint needs="library" label="标签实验在活体种子库真实执行" />
      </div>
    );
  }
}
