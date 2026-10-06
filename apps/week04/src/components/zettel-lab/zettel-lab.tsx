import { Component, h, State, Prop, Element } from '@stencil/core';
import { liveLibrary } from '../../lib/live-library';
import { CARD_SOURCES, SEED_CARDS, ReadingCard, noteUri, cardMarkdown, isExactEvidence } from '../../lib/card-box';
import { cardMarkdownView, markdownInline } from '../shared/card-markdown';
import {PatchouliRequest} from '../../lib/patchouli-pages';

type Phase = 'box' | 'taking' | 'card' | 'returning' | 'filing' | 'burning';
type Highlight = '' | 'address' | 'question' | 'reason';
const STORAGE = 'week04-cardbox-v1';
const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

@Component({ tag: 'zettel-lab', styleUrl: 'zettel-lab.css', shadow: false })
export class ZettelLab {
  @Element() el: HTMLElement;
  @Prop() active = true;
  @State() cards: ReadingCard[] = [...SEED_CARDS];
  @State() current: ReadingCard;
  @State() phase: Phase = 'box';
  @State() highlight: Highlight = '';
  @State() isDraft = false;
  @State() editing = false;
  @State() message = '';
  @State() sourceUri = '';
  @State() sourceEditing = false;
  @State() sourceText = '';
  @State() sourceDocument = '';
  @State() sourcePage = 1;
  @State() sourceRevision = '';
  @State() libraryReady = false;
  @State() rackPage = 0;
  private off: () => void;
  private timer: ReturnType<typeof setTimeout>;
  private originId = '';
  private sourceRequest:PatchouliRequest;
  private get visibleCards() { return this.cards.slice(this.rackPage * 8, this.rackPage * 8 + 8); }
  private get animating() { return ['taking', 'returning', 'filing', 'burning'].includes(this.phase); }
  private duration(ms: number) { return matchMedia('(prefers-reduced-motion: reduce)').matches || document.body.classList.contains('low-power') ? 30 : ms; }
  componentWillLoad() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) || '[]');
      if (Array.isArray(saved)) {
        const ids = new Set(this.cards.map(card => card.id));
        for (const card of saved) {
          if (!validId.test(card.id) || ids.has(card.id) || typeof card.title !== 'string' || typeof card.body !== 'string' || !Array.isArray(card.citations) || !card.citations.length || !card.citations.every(c => typeof c.reason === 'string' && c.reason.trim() && typeof c.label === 'string' && isExactEvidence(c.uri))) continue;
          this.cards = [...this.cards, card]; ids.add(card.id);
        }
      }
    } catch { /* Authored cards remain available if local storage is unavailable. */ }
    this.off = liveLibrary.subscribe(state => this.libraryReady = state === 'ready');
    window.addEventListener('keydown', this.key, true);
  }
  disconnectedCallback() { this.off?.(); clearTimeout(this.timer); window.removeEventListener('keydown', this.key, true); }
  private key = (event: KeyboardEvent) => {
    if (!this.active || event.key !== 'Escape' || this.phase === 'box' || event.isComposing || this.el.closest('deck-slide')?.style.display === 'none') return;
    if(this.sourceUri&&this.sourceEditing)return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (this.animating) return;
    if (this.sourceUri) this.closeSource(); else if (this.isDraft) this.cancel(); else this.putBack();
  };
  private after(ms: number, action: () => void) { clearTimeout(this.timer); this.timer = setTimeout(action, this.duration(ms)); }
  private take(card: ReadingCard) {
    if (this.animating || this.isDraft) return;
    this.rackPage = Math.floor(this.cards.findIndex(item => item.id === card.id) / 8);
    this.originId = card.id; this.current = card; this.isDraft = false; this.highlight = ''; this.message = ''; this.sourceUri = ''; this.phase = 'taking';
    this.after(650, () => { this.phase = 'card'; this.focusReturn(); });
  }
  private focusReturn() { requestAnimationFrame(() => (this.el.querySelector('.cb-return') as HTMLButtonElement)?.focus({ preventScroll: true })); }
  private finish(message = '') {
    this.current = null; this.isDraft = false; this.editing = false; this.highlight = ''; this.sourceUri = ''; this.phase = 'box'; this.message = message;
    requestAnimationFrame(() => (this.el.querySelector(`[data-card-id="${this.originId}"]`) as HTMLButtonElement || this.el.querySelector('.cb-create') as HTMLButtonElement)?.focus({ preventScroll: true }));
  }
  private putBack() { if (this.animating || this.isDraft) return; this.phase = 'returning'; this.after(600, () => this.finish()); }
  private create() {
    if (this.animating || this.isDraft) return;
    this.current = { id: crypto.randomUUID(), title: '', body: '', citations: [{ label: '', uri: '', reason: '' }] };
    this.isDraft = true; this.editing = true; this.highlight = ''; this.message = ''; this.sourceUri = ''; this.phase = 'taking';
    this.after(650, () => { this.phase = 'card'; requestAnimationFrame(() => (this.el.querySelector('input[aria-label="卡片问题"]') as HTMLInputElement)?.focus({ preventScroll: true })); });
  }
  private update(key: 'title' | 'body', value: string) { this.current = { ...this.current, [key]: value }; this.message = ''; }
  private citation(key: 'uri' | 'reason', value: string) {
    const source = CARD_SOURCES.find(source => source.uri === value);
    this.current = { ...this.current, citations: [{ ...this.current.citations[0], [key]: value, ...(key === 'uri' ? { label: source?.label || '文档出处' } : {}) }] }; this.message = '';
  }
  private file() {
    if (this.animating || !this.isDraft) return;
    const card: ReadingCard = { ...this.current, title: this.current.title.trim(), body: this.current.body.trim(), citations: this.current.citations.map(c => ({ ...c, uri: c.uri.trim(), reason: c.reason.trim() })) };
    try {
      if (!card.title || !/[？?]$/.test(card.title)) throw Error('请用一个以问号结尾的问题作标题。');
      if (!card.body) throw Error('请写下卡片内容。');
      if (!card.citations[0].reason) throw Error('请说明为什么引用这份材料。');
      if (!isExactEvidence(card.citations[0].uri)) throw Error('出处需要精确的 texts VFS 链接，包含页序、rev 与 box。');
      if (!this.libraryReady) throw Error('文献库尚未就绪，请稍后核对出处。');
      const lib = liveLibrary.getLibrary();
      if (!lib.fetch(card.citations[0].uri).text.trim()) throw Error('引用定位的段落没有文字。');
      // Notes are stored independently: this code never writes SQLite records.
      for (const match of card.body.matchAll(/\[[^\]]+\]\((patchouli:\/\/[^\s)]+)\)/g)) {
        const uri = new URL(match[1]);
        if (uri.hostname === 'texts') { if (!isExactEvidence(match[1]) || !lib.fetch(match[1]).text.trim()) throw Error('正文中的文档引用也需要精确的页序、rev 与 box。'); }
        else if (uri.hostname === 'notes') { if (!this.cards.some(item => noteUri(item.id) === match[1]) && noteUri(card.id) !== match[1]) throw Error('正文中的卡片地址不在这个卡片盒中。'); }
        else throw Error('卡片引用只接受 texts 或 notes VFS 地址。');
      }
      const next = [...this.cards, card];
      localStorage.setItem(STORAGE, JSON.stringify(next.filter(item => !SEED_CARDS.some(seed => seed.id === item.id))));
      this.current = card; this.cards = next; this.originId = card.id; this.editing = false; this.phase = 'filing';
      this.rackPage = Math.floor((next.length - 1) / 8);
      this.after(700, () => this.finish('新卡片已放入卡片盒'));
    } catch (error) { this.message = error.message; }
  }
  private cancel() { if (this.animating || !this.isDraft) return; this.editing = false; this.highlight = ''; this.phase = 'burning'; this.after(1200, () => this.finish('卡片已丢弃')); }
  private illuminate(part: Highlight) {
    if (this.animating||this.sourceEditing) return;
    if (!this.current) { this.current = this.cards[0]; this.originId = this.current.id; this.phase = 'card'; this.isDraft = false; }
    this.sourceUri = ''; this.highlight = part;
    requestAnimationFrame(() => {
      const paper = this.el.querySelector('.cb-paper-scroll') as HTMLElement, target = this.el.querySelector(`[data-card-part="${part}"]`) as HTMLElement;
      if (paper && target) paper.scrollTop += target.getBoundingClientRect().top - paper.getBoundingClientRect().top - 16;
    });
  }
  private open = (uri: string) => {
    if (this.animating) return;
    if (uri.startsWith('patchouli://notes/')) {
      const card = this.cards.find(card => noteUri(card.id) === uri);
      if (!card) { this.message = '这张卡片尚未放入盒中。'; return; }
      if (card.id === this.current?.id) return;
      if (this.isDraft) { this.message = '请先放入或取消新卡片。'; return; }
      this.phase = 'returning'; this.after(500, () => { this.phase = 'box'; this.take(card); }); return;
    }
    try {
      if (!this.libraryReady) throw Error('文献库尚未就绪。');
      if (!isExactEvidence(uri)) throw Error('引用需要包含页序、rev 与 box。');
      const parsed = new URL(uri), result = liveLibrary.getLibrary().fetch(uri), match = parsed.pathname.match(/^\/([^/]+)\/page-(\d+)\.md$/);
      this.sourceText = result.text; this.sourceDocument = match[1]; this.sourcePage = Number(match[2]); this.sourceRevision = parsed.searchParams.get('rev'); this.sourceRequest={page:'reader',documentId:this.sourceDocument,pageNumber:this.sourcePage,revisionId:this.sourceRevision,evidenceUri:uri};this.sourceUri = uri; this.message = '';
    } catch (error) { this.message = error.message; }
  };
  private closeSource() { this.sourceEditing=false;this.sourceUri = ''; this.focusReturn(); }
  private export() {
    const url = URL.createObjectURL(new Blob([cardMarkdown(this.current)], { type: 'text/markdown;charset=utf-8' })), anchor = document.createElement('a');
    anchor.href = url; anchor.download = this.current.id + '.md'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  private highlighted(part: Highlight, content: any) { return this.highlight === part ? <mark class="cb-marker">{content}</mark> : content; }
  private paper() {
    const card = this.current;
    return <article key={card.id} class={`cb-paper cb-${this.phase}`} aria-label={this.isDraft ? '新卡片' : '阅读卡片'} data-note-uri={noteUri(card.id)}>
      <header class="cb-paper-toolbar">{!this.isDraft ? <button class="cb-return" aria-label="把卡片放回卡片盒" title="放回卡片盒" disabled={this.animating} onClick={() => this.putBack()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5 3 11l6 6M3 11h11a6 6 0 0 1 6 6v2" /></svg><span>放回</span></button> : <span>新卡片</span>}
        <div>{this.isDraft ? <button disabled={this.animating} onClick={() => this.editing = !this.editing}>{this.editing ? '查看卡片' : '继续书写'}</button> : <button disabled={this.animating} onClick={() => this.export()}>下载 Markdown</button>}</div>
      </header>
      <div class="cb-paper-scroll">
        <h2 data-card-part="question">{this.highlighted('question', markdownInline(card.title || '你的问题是什么？', this.open))}</h2>
        <p class="cb-note-address" data-card-part="address">{this.highlighted('address', <a href={noteUri(card.id)} onClick={event => { event.preventDefault(); this.open(noteUri(card.id)); }}>{noteUri(card.id)}</a>)}</p>
        {this.isDraft && this.editing ? <div class="cb-writing">
          <label>问题标题<input aria-label="卡片问题" placeholder="用一个问题作标题……？" value={card.title} onInput={(event: any) => this.update('title', event.target.value)} /></label>
          <label>卡片内容 · Markdown<textarea aria-label="卡片Markdown内容" placeholder="写下自己的理解，可使用 **重点**、列表和链接。" value={card.body} onInput={(event: any) => this.update('body', event.target.value)} /></label>
          <label>引用材料<select aria-label="选择卡片引用材料" onChange={(event: any) => this.citation('uri', event.target.value)}><option value="" selected={!CARD_SOURCES.some(source => source.uri === card.citations[0].uri)}>选择一段预置材料，或填写精确出处</option>{CARD_SOURCES.map(source => <option value={source.uri} selected={source.uri === card.citations[0].uri}>{source.label}</option>)}</select></label>
          <label>文档 VFS 出处<input aria-label="卡片引用VFS" placeholder="patchouli://texts/…/page-….md?rev=…&box=…" value={card.citations[0].uri} onInput={(event: any) => this.citation('uri', event.target.value)} /></label>
          <label>为什么引用？<textarea aria-label="卡片引用理由" class="cb-reason-input" placeholder="这段材料的哪一点回答了你的问题？" value={card.citations[0].reason} onInput={(event: any) => this.citation('reason', event.target.value)} /></label>
        </div> : <div class="cb-markdown">{cardMarkdownView(card.body || '写下一条想法，再为它选择材料。', this.open)}</div>}
        <section class="cb-citations cb-markdown" aria-label="卡片引用"><h3>引用</h3>{card.citations.map(citation => <div><p>{citation.uri ? markdownInline(`[${citation.label}](${citation.uri})`, this.open) : '选择材料后，出处将显示在这里。'}</p><p data-card-part="reason">{this.highlighted('reason', <span><strong>引用理由：</strong>{markdownInline(citation.reason || '这段材料为什么值得放进这张卡片？', this.open)}</span>)}</p></div>)}</section>
        {this.message && <p class="cb-error" role="status">{this.message}</p>}
      </div>
      {this.isDraft && <footer class="cb-draft-actions"><button class="cb-file" disabled={this.animating} onClick={() => this.file()}>放入卡片盒</button><button class="cb-cancel" disabled={this.animating} onClick={() => this.cancel()}>取消</button></footer>}
      {this.phase === 'burning' && <div class="cb-embers" aria-hidden="true">{Array.from({ length: 14 }, (_, index) => <i style={{ '--ember-x': `${7 + index * 6.4}%`, '--ember-drift': `${index % 2 ? 20 : -25}px`, '--ember-delay': `${index * 35}ms` }} />)}</div>}
    </article>;
  }
  private box() {
    return <div class={{ 'cb-box-scene': true, 'has-card-out': !!this.current }} aria-label="三维卡片盒">
      <div class="cb-box"><div class="cb-box-back" /><div class="cb-box-floor" /><div class="cb-box-side" />
        <div class="cb-box-slips">{this.visibleCards.map((card, index) => <button key={card.id} data-card-id={card.id} class={{ 'cb-slip': true, 'is-out': card.id === this.current?.id }} style={{ '--card-index': String(index), '--card-count': String(this.visibleCards.length) }} aria-label={`取出卡片：${card.title}`} disabled={!!this.current || this.animating} onClick={() => this.take(card)}><span class="cb-slip-number">{String(this.rackPage * 8 + index + 1).padStart(2, '0')}</span><strong>{card.title}</strong><span class="cb-slip-lines" aria-hidden="true" /></button>)}</div>
        <div class="cb-box-front"><span class="cb-box-label">问题 · 材料 · 联系</span><span class="cb-box-handle" /></div>
      </div><div class="cb-box-shadow" />
    </div>;
  }
  render() {
    const parts: [string, string, Highlight][] = [['固定地址', '每张卡片保留同一个入口', 'address'], ['选择性引用', '用一个问题选择材料', 'question'], ['意外关联', '回到材料寻找新的线索', ''], ['明确理由', '说明为什么引用这段材料', 'reason']];
    const positions = [[50, 43], [50, 10], [23, 81], [77, 81]];
    return <div class="mds-container cb-container">
      <section class="cb-desk" aria-label="实体卡片盒演示">{!this.sourceUri && <header class="cb-desk-header"><div><h2>我的卡片盒</h2><span>{this.cards.length} 张卡片</span></div><button class="cb-create" disabled={this.animating || this.isDraft || !!this.sourceUri} onClick={() => this.create()}><span aria-hidden="true">＋</span> 创建卡片</button></header>}
        {this.sourceUri ? <section class="cb-source" aria-label="卡片出处阅读模式"><patchouli-app active={this.active} initialPage="reader" request={this.sourceRequest} externalReturn={true} returnLabel="返回当前卡片" onPatchouliReturn={() => this.closeSource()} onPatchouliEditChange={event => this.sourceEditing=event.detail} /></section> : <div class="cb-stage">{this.box()}{this.current && this.paper()}{this.phase === 'burning' && <div class="cb-fire" aria-hidden="true">{Array.from({length:14},(_,index)=><i style={{'--flame-index':String(index),'--flame-height':`${34 + index % 4 * 13}px`,'--flame-delay':`${index % 3 * 40}ms`}} />)}</div>}{!this.current && <p class="cb-desk-hint">点击一张卡片，把它取出来读</p>}{!this.current && this.cards.length > 8 && <nav class="cb-rack-controls" aria-label="浏览盒中卡片"><button disabled={!this.rackPage} onClick={() => this.rackPage--}>前一组</button><span>{this.rackPage + 1} / {Math.ceil(this.cards.length / 8)}</span><button disabled={(this.rackPage + 1) * 8 >= this.cards.length} onClick={() => this.rackPage++}>后一组</button></nav>}</div>}
        {!this.sourceUri && <footer class="cb-desk-status" role="status">{this.current ? this.isDraft ? '新卡片 · 写下问题、想法与引用理由' : '桌面上的卡片 · 阅读后放回原处' : this.message || '为一个问题留下一张卡片'}</footer>}
      </section>
      <aside class="mds-concept-navigation diagram-network cb-concepts" aria-label="D21理念示意图"><h2>卡片与关联的展开</h2><div class="mds-concept-diagram"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{[1, 2, 3].map(index => <line x1="50" y1="43" x2={positions[index][0]} y2={positions[index][1]} />)}</svg>
        {parts.map(([label, detail, part], index) => <button class={{ 'mds-concept-node': true, 'is-active': !!part && this.highlight === part }} aria-label={`查看${label}`} aria-pressed={part ? String(this.highlight === part) : undefined} style={{ left: positions[index][0] + '%', top: positions[index][1] + '%' }} onClick={part ? () => this.illuminate(part) : undefined}><strong>{label}</strong><span>{detail}</span></button>)}
      </div><p class="mds-concept-hint">点击节点，用荧光笔标出卡片中的对应部分</p><p class="mds-layer-current">{this.current?.title ? '当前问题：' + this.current.title : '从问题出发，记录材料与引用理由。'}</p></aside>
    </div>;
  }
}
