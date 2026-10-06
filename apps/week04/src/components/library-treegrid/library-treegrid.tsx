import {displayCreator} from '../../lib/creator-name';
import { Component, h, Prop, State } from '@stencil/core';
import { liveLibrary } from '../../lib/live-library';
import { selectItem } from '../../lib/research-context';

const columns = [
  { key: 'type', label: '题录类型', width: 96 }, { key: 'year', label: '年份', width: 62 },
  { key: 'authors', label: '作者', width: 130 }, { key: 'title', label: '标题', width: 290 },
  { key: 'source', label: '来源', width: 152 }, { key: 'status', label: 'OCR/索引状态', width: 128 },
  { key: 'pages', label: '页数', width: 70 }, { key: 'file', label: '关联文件', width: 180 },
];
const typeNames: Record<string,string> = { book: '图书', chapter: '书中章节', 'article-journal': '期刊论文', journalArticle: '期刊论文', 'paper-conference': '会议论文', thesis: '学位论文', manuscript: '手稿' };

@Component({ tag: 'library-treegrid', styleUrl: 'library-treegrid.css', shadow: false })
export class LibraryTreegrid {
  @Prop() items: any[] = [];
  @Prop() selectedId = '';
  @State() expanded: string[] = [];
  @State() order = columns.map(column => column.key);
  @State() hidden: string[] = [];
  @State() widths: Record<string,number> = {};
  @State() sortKey = '';
  @State() descending = false;
  private dragKey = '';
  private stopResize?: () => void;
  componentWillLoad() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.storageKey()) || '{}');
      if (Array.isArray(saved.order) && saved.order.length === columns.length && new Set(saved.order).size === columns.length && saved.order.every(key => columns.some(column => column.key === key))) this.order = saved.order;
      this.hidden = (saved.hidden || []).filter(key => key !== 'title' && this.order.includes(key));
      this.widths = saved.widths || {};
    } catch { /* Use the desktop column order for a new view. */ }
  }
  disconnectedCallback() { this.stopResize?.(); }
  private storageKey() { return 'week04-treegrid-' + liveLibrary.getLibrary()?.libraryId; }
  private remember() { localStorage.setItem(this.storageKey(), JSON.stringify({ order: this.order, hidden: this.hidden, widths: this.widths })); }
  private toggle(id: string) { this.expanded = this.expanded.includes(id) ? this.expanded.filter(value => value !== id) : [...this.expanded, id]; }
  private resize(event: PointerEvent, key: string) {
    event.preventDefault(); event.stopPropagation();
    const start = event.clientX, initial = this.widths[key] || columns.find(column => column.key === key).width;
    const move = (event: PointerEvent) => this.widths = { ...this.widths, [key]: Math.max(60, initial + event.clientX - start) };
    const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); this.stopResize = undefined; this.remember(); };
    this.stopResize?.(); this.stopResize = stop;
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop, { once: true });
  }
  private documentValues(doc: any) {
    const lib = liveLibrary.getLibrary(), pages = lib.pages(doc.document_instance_id).length;
    const processed = lib.rows("select count(*) n from document_tree_revisions where document_instance_id=? and is_current=1 and status='committed'", [doc.document_instance_id])[0].n;
    const indexed = lib.rows("select count(*) n from search_units where document_instance_id=? and status='current'", [doc.document_instance_id])[0].n;
    const asset = lib.rows('select * from file_assets where file_asset_id=?', [doc.file_asset_id])[0] || {};
    const file = lib.files[doc.file_asset_id];
    return { type: 'PDF', year: '', authors: '', title: doc.file_name || doc.title || file?.name || '', source: '', status: indexed && processed >= pages ? '已识别 / 已索引' : processed ? `${processed}/${pages} 页正文` : '待文字处理', pages, file: asset.original_path || doc.file_name || file?.name || '', detail: `${processed} 页正文，${indexed} 个检索单元`, doc };
  }
  private itemValues(item: any) {
    const lib = liveLibrary.getLibrary(), docs = lib.documents(item.item_id), primary = docs.find(doc => doc.is_primary) || docs[0];
    const file = primary ? this.documentValues(primary) : null;
    const creators = lib.rows("select * from item_creators where item_id=? and role='author' order by sequence_index", [item.item_id]);
    const names = creators.length ? creators : JSON.parse(item.creators_json || '[]');
    const date = lib.rows("select * from item_dates where item_id=? and role='issued'", [item.item_id])[0];
    const year = date ? JSON.parse(date.date_parts_json || '[]')[0]?.[0] || date.literal : item.date?.slice(0,4);
    return { id: item.item_id, type: typeNames[item.item_type] || item.item_type, year: year || '', authors: names.map(name => displayCreator(name)).join('；'), title: item.title, source: item.item_type === 'book' ? item.publisher || item.publication_title || '' : item.publication_title || item.publisher || '', status: file?.status || '无附件', pages: file?.pages || '', file: file?.file || '', detail: file?.detail || '', docs, doc: primary };
  }
  private open(doc: any) {
    if (doc) window.dispatchEvent(new CustomEvent('workbench-open-document', { detail: `patchouli://texts/${doc.document_instance_id}/page-1.md` }));
  }
  private rowKey(event: KeyboardEvent, row: any) {
    if (!['ArrowDown','ArrowUp','ArrowRight','ArrowLeft','Enter',' '].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (event.key === 'ArrowRight' && !this.expanded.includes(row.id)) this.toggle(row.id);
    if (event.key === 'ArrowLeft' && this.expanded.includes(row.id)) this.toggle(row.id);
    if (event.key === 'Enter') this.open(row.doc);
    if (event.key === ' ') selectItem(row.id);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const table = (event.currentTarget as HTMLElement).closest('table');
      const rows = [...table.querySelectorAll('tbody tr[data-item]')] as HTMLElement[];
      const index = rows.indexOf(event.currentTarget as HTMLElement), next = rows[Math.max(0, Math.min(rows.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))];
      next?.focus(); if (next) selectItem(next.dataset.item);
    }
  }
  render() {
    if (!liveLibrary.getLibrary()) return null;
    const visible = this.order.filter(key => !this.hidden.includes(key)).map(key => columns.find(column => column.key === key));
    const rows = this.items.map(item => this.itemValues(item));
    if (this.sortKey) rows.sort((a,b) => String(a[this.sortKey]).localeCompare(String(b[this.sortKey]), 'zh-CN', { numeric: true, sensitivity: 'base' }) * (this.descending ? -1 : 1));
    return <div class="library-treegrid">
      <div class="library-grid-options"><span>{rows.length} 条文献</span><details><summary>列显示</summary><div>{columns.map(column => <label><input type="checkbox" checked={!this.hidden.includes(column.key)} disabled={column.key === 'title'} onChange={(event: any) => { this.hidden = event.target.checked ? this.hidden.filter(key => key !== column.key) : [...this.hidden, column.key]; this.remember(); }} />{column.label}</label>)}</div></details></div>
      <div class="work-table-wrap library-grid-scroll"><table class="work-table library-grid" role="treegrid" aria-label="文献书库列表" aria-colcount={visible.length} style={{ width: visible.reduce((sum,column) => sum + (this.widths[column.key] || column.width),0) + 'px' }}>
        <colgroup>{visible.map(column => <col style={{ width: (this.widths[column.key] || column.width) + 'px' }} />)}</colgroup>
        <thead><tr role="row">{visible.map(column => <th role="columnheader" data-column={column.key} draggable={true} aria-sort={this.sortKey === column.key ? this.descending ? 'descending' : 'ascending' : 'none'} onDragStart={() => this.dragKey = column.key} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const order = this.order.filter(key => key !== this.dragKey); order.splice(order.indexOf(column.key),0,this.dragKey); this.order = order; this.remember(); }}><button onClick={() => { this.descending = this.sortKey === column.key ? !this.descending : false; this.sortKey = column.key; }}>{column.label}{this.sortKey === column.key ? this.descending ? ' ↓' : ' ↑' : ''}</button><span class="library-column-resize" role="separator" aria-label={`调整${column.label}列宽`} aria-orientation="vertical" onPointerDown={event => this.resize(event,column.key)} /></th>)}</tr></thead>
        <tbody>{rows.map(row => [<tr role="row" data-item={row.id} aria-level="1" aria-selected={String(row.id === this.selectedId)} aria-expanded={row.docs.length ? String(this.expanded.includes(row.id)) : undefined} tabIndex={row.id === this.selectedId ? 0 : -1} class={row.id === this.selectedId ? 'on' : ''} onClick={() => selectItem(row.id)} onDblClick={() => this.open(row.doc)} onKeyDown={event => this.rowKey(event,row)}>{visible.map(column => <td role="gridcell" data-column={column.key} title={column.key === 'status' ? row.detail : String(row[column.key])}>{column.key === 'title' ? <div class="library-title-cell"><button class="library-expander" aria-label={`${this.expanded.includes(row.id) ? '收起' : '展开'}附件：${row.title}`} disabled={!row.docs.length} onClick={event => { event.stopPropagation(); this.toggle(row.id); }}>{this.expanded.includes(row.id) ? '▾' : '▸'}</button><button class="grid-title" onClick={() => selectItem(row.id)}>{row.title}</button></div> : row[column.key] || '—'}</td>)}</tr>, ...(this.expanded.includes(row.id) ? row.docs.map(doc => { const child = this.documentValues(doc); return <tr role="row" aria-level="2" class="library-document-row" data-parent={row.id} onClick={() => selectItem(row.id)} onDblClick={() => this.open(doc)}>{visible.map(column => <td role="gridcell" data-column={column.key} title={String(child[column.key])}>{column.key === 'title' ? <button class="grid-document-title" onClick={() => this.open(doc)}>PDF · {child.title}</button> : child[column.key] || '—'}</td>)}</tr>; }) : [])])}</tbody>
      </table></div>
    </div>;
  }
}
