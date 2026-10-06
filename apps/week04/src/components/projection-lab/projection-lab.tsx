import { Component, h, State, Method } from "@stencil/core";
import { liveLibrary } from "../../lib/live-library";

interface Snapshot {
  libraryRevision: number;
  docs: { id: string; title: string; units: number; fts: number; revisions: number }[];
  items: { id: string; title: string; tags: string; note: string }[];
  probeQuery: string;
  probeHits: number;
  ftsRows: any[];
  mappings: any[];
  inverted: any[];
}

// D10 演示2②：patchouli 格内的 live 派生层重建——索引可推倒重来，题录/笔记/标签保留。
@Component({ tag: "projection-lab", shadow: false })
export class ProjectionLab {
  @State() before: Snapshot | null = null;
  @State() after: Snapshot | null = null;
  @State() log: string[] = [];
  @State() busy = false;
  private unsubscribe: () => void;
  @State() ready = false;
  @State() tableMode = 'fts';
  @State() snapshotMode = 'before';
  @Method() async getSnapshots():Promise<any>{return {before:this.before,after:this.after};}

  componentWillLoad() {
    this.unsubscribe = liveLibrary.subscribe((state) => {
      if (state === "ready" && !this.ready) {
        this.ready = true;
        this.before=this.snapshot(liveLibrary.getLibrary(),'subaltern');
      }
    });
  }
  disconnectedCallback() {
    this.unsubscribe?.();
  }

  private snapshot(lib: any, probeQuery: string): Snapshot {
    const docs = lib
      .rows(
        "select d.document_instance_id id, d.title, (select count(*) from search_units s where s.document_instance_id=d.document_instance_id and s.status='current') units, (select count(*) from fts_row_map f where f.document_instance_id=d.document_instance_id) fts, (select count(*) from document_tree_revisions r where r.document_instance_id=d.document_instance_id and r.status='committed') revisions from document_instances d",
      )
      .map((d: any) => ({
        ...d,
        title: lib.rows("select title from items where item_id=(select item_id from document_instances where document_instance_id=?)", [d.id])[0]?.title || d.title,
      }));
    const items = lib.items().map((i: any) => ({
      id: i.item_id,
      title: i.title,
      tags: i.tags_json,
      note: i.note || "",
    }));
    const probeHits = lib.search(probeQuery).length;
    const ftsRows=lib.rows('select rowid,unit_id,document_instance_id,page_id,resolved_text from search_units_fts order by unit_id limit 8');
    const mappings=lib.rows('select fts_row_id,unit_id,document_instance_id from fts_row_map order by unit_id limit 8');
    // fts5vocab reads SQLite's actual token postings. The temporary view never enters the library file.
    let inverted:any[]=[];
    try {lib.run("CREATE VIRTUAL TABLE temp.week04_fts_postings USING fts5vocab(main,search_units_fts,instance)");inverted=lib.rows("select term,doc,col,offset from temp.week04_fts_postings where col='resolved_text' and term in ('subaltern','history','women','power') order by case term when 'subaltern' then 0 when 'women' then 1 when 'power' then 2 else 3 end,doc,offset limit 16");}
    finally {lib.run('DROP TABLE IF EXISTS temp.week04_fts_postings');}
    return {
      libraryRevision: lib.rows("select library_revision from library_metadata")[0]?.library_revision || 0,
      docs,
      items,
      probeQuery,
      probeHits,
      ftsRows,mappings,inverted,
    };
  }

  private async rebuild() {
    const lib = liveLibrary.getLibrary();
    if (!lib || this.busy) return;
    this.busy = true;
    this.after = null;
    this.log = [];
    const query = "subaltern";
    this.before = this.snapshot(lib, query);
    try {
      this.log.push(`重建前：用「${query}」检索 → ${this.before.probeHits} 命中；索引条目合计 ${this.before.docs.reduce((n, d) => n + d.units, 0)}`);
      const docIds = this.before.docs.map((d) => d.id);
      await lib.mutate(() => {
        for (const id of docIds) {
          lib.reindex(id);
          this.log.push(`reindex(${id.slice(0, 8)}…) 完成`);
        }
      });
      this.after = this.snapshot(liveLibrary.getLibrary(), query);
      this.snapshotMode='after';
      this.log.push(`重建后：用「${query}」检索 → ${this.after.probeHits} 命中；索引条目合计 ${this.after.docs.reduce((n, d) => n + d.units, 0)}`);
    } catch (e: any) {
      this.log.push(`重建失败：${e?.message || e}`);
    } finally {
      this.busy = false;
    }
  }

  private diffRows() {
    if (!this.before || !this.after) return [];
    const rows = this.after.docs.map((d) => {
      const b = this.before.docs.find((x) => x.id === d.id);
      return {
        id: d.id.slice(0, 8),
        title: d.title.slice(0, 26),
        before: b,
        after: d,
        same:
          b && b.revisions === d.revisions,
      };
    });
    return rows;
  }

  render() {
    const knowledgeIntact =
      this.before &&
      this.after &&
      this.before.items.length === this.after.items.length &&
      this.after.items.every(
        (a) =>
          this.before.items.find((b) => b.id === a.id)?.title === a.title &&
          this.before.items.find((b) => b.id === a.id)?.tags === a.tags &&
          this.before.items.find((b) => b.id === a.id)?.note === a.note,
      );
    return (
      <div class="w10-lab">
        <div class="lab-toolbar">
          <strong>SQLite 派生索引</strong>
          <button disabled={this.busy || !this.ready} onClick={() => this.rebuild()}>
            {this.busy ? "重建中…" : "重建派生层（reindex）"}
          </button>
          {this.before && this.after && (
            <span class="mode">
              题录 / 标签 / 修订保留：{knowledgeIntact ? "逐项核对不变 ✓" : "有变化（见对账）"}
            </span>
          )}
        </div>
        {this.before&&<section class={'index-table-view '+(this.snapshotMode==='after'?'is-rebuilt':'')} aria-label="真实索引表内容"><div class="lab-toolbar">{[['fts','FTS 内容表'],['map','行号映射表'],['inverted','倒排索引']].map(([mode,label])=><button aria-pressed={String(this.tableMode===mode)} onClick={()=>this.tableMode=mode}>{label}</button>)}<select aria-label="索引快照" onChange={(e:any)=>this.snapshotMode=e.target.value}><option value="before" selected={this.snapshotMode==='before'}>重建前</option><option value="after" selected={this.snapshotMode==='after'} disabled={!this.after}>重建后</option></select></div><p>{this.tableMode==='fts'?<span><code>search_units_fts</code>：进入全文检索的真实正文行</span>:this.tableMode==='map'?<span><code>fts_row_map</code>：FTS 行号对应哪个原文单元</span>:<span><code>fts5vocab(instance)</code>：词项 → 文档行号 → 字段 → 词项位置</span>}</p>{this.indexTable(this.snapshotMode==='after'?this.after:this.before)}</section>}
        {this.before && this.after && (
          <table class="flow-table">
            <thead>
              <tr>
                <th>文档</th>
                <th>题录（投影源不动）</th>
                <th>索引条目 前→后</th>
                <th>已提交修订 前→后</th>
              </tr>
            </thead>
            <tbody>
              {this.diffRows().map((r) => (
                <tr>
                  <td class="mono">{r.id}</td>
                  <td>{r.title}{r.same ? "" : " ⚠"}</td>
                  <td>
                    {r.before?.units} → {r.after.units}
                  </td>
                  <td>
                    {r.before?.revisions} → {r.after.revisions}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {this.log.length > 0 && (
          <pre class="source-json w10-log">
            {this.log.join("\n")}
          </pre>
        )}
        {!this.before && (
          <p class="lab-note">
            点击重建：快照（题录 / 标签 / 笔记 / 修订计数 / 一次真实检索的命中数）→ 删除并重建索引等派生层 → 再次快照逐项对账。
          </p>
        )}
        <p class="source-line">索引从已提交正文重建；上方展示当前 SQLite 的行与词项位置。重建后文本和词项应相同，FTS 行号重新分配。</p>
      </div>
    );
  }
  private indexTable(snapshot:Snapshot){if(!snapshot)return null;const keys=this.tableMode==='fts'?['rowid','unit_id','document_instance_id','page_id','resolved_text']:this.tableMode==='map'?['fts_row_id','unit_id','document_instance_id']:['term','doc','col','offset'],rows=this.tableMode==='fts'?snapshot.ftsRows:this.tableMode==='map'?snapshot.mappings:snapshot.inverted;return <div class="index-table-scroll"><table><thead><tr>{keys.map(key=><th>{key}</th>)}</tr></thead><tbody>{rows.map(row=><tr>{keys.map(key=><td title={String(row[key])}><code>{key==='resolved_text'?String(row[key]).slice(0,110):String(row[key])}</code></td>)}</tr>)}</tbody></table></div>;}
}
