import { Component, h, State } from '@stencil/core';

const ENTRIES = [
  {
    date: '约前 240 年', name: '卡利马科斯', tagline: '亚历山大图书馆',
    find:  '将书目组织成可导航结构——学科分类加字母排序，首次让读者能在数十万卷中定向查找。',
    judge: '每条条目附作者小传，使读者能辨别真伪与不同版本的来历。',
    cite:  '《表》（Pinakes）本身即书目记录的规范形式，被后世编目者反复援引。',
  },
  {
    date: '西汉', name: '刘向 · 刘歆', tagline: '汉宫秘府校书',
    find:  '以六略分类，将散乱异本归入有序结构，形成中国最早的系统性书目。',
    judge: '校雠异本：逐字比对、辨别讹谬，确认文本身份；叙录记录校书依据与判断过程。',
    cite:  '叙录旨意为每书撰述内容与价值，是引用时说明材料性质的范式。',
  },
  {
    date: '约 987 年', name: '伊本·纳迪姆', tagline: '巴格达书市',
    find:  '《群书索引》涵盖阿拉伯与外来文献，构建跨文化、跨语言的统一目录。',
    judge: '明确区分"亲见原本"与"耳闻传说"——最早的文献来源批评意识，直接影响后世引用规范。',
    cite:  '记录抄本所在地与流传路径，使引用能追溯到具体物理来源。',
  },
  {
    date: '1841 年', name: '帕尼齐', tagline: '大英博物馆 91 条规则',
    find:  '91 条规则规范入口词，使读者能从责任者、题名、机构等不同线索找到同一文献。',
    judge: '聚合同类、区分相似版本：将"版本"与"责任者"作为独立的辨别维度处理。',
    cite:  '首次将编目规则建立在功能而非惯例之上，为后世以原则统摄规则奠定基础。',
  },
  {
    date: '1876 年', name: '卡特', tagline: '《字典式目录规则》',
    find:  '明确目录功能：帮助读者找到特定文献；让读者看到馆藏中相关版本与形式。',
    judge: '关联目录：将读者引向同一作品的不同版本，使辨别成为目录结构的内置功能。',
    cite:  '将"读者能用"写入规则目标——以用户导向评价组织工作，影响至今。',
  },
  {
    date: '1931 年', name: '阮冈纳赞', tagline: '图书馆学五定律',
    find:  '每本书都有其读者；节省读者时间——把"找到"的效率置于组织工作的核心。',
    judge: '每位读者都有其书——以"用"裁判组织决策，而非以来源或形式裁判。',
    cite:  '图书馆是有机体：强调可演化性，使引用系统能容纳新类型材料。',
  },
  {
    date: '1998 年', name: 'FRBR', tagline: 'IFLA 书目功能需求',
    find:  '以实体关系模型统一不同目录系统的查询语义，使跨库查找成为可能。',
    judge: 'Work / Expression / Manifestation / Item 四层——精确说明"这是哪一版"和"我用的是哪个副本"。',
    cite:  '为书目数据的交换与互操作提供共同概念基础，是现代引用标准的理论骨架。',
  },
  {
    date: '2016 年', name: 'FAIR 原则', tagline: '研究数据管理',
    find:  'Findable：持久标识符（DOI / URI）与可检索元数据，使机器也能定位研究材料。',
    judge: 'Accessible + Interoperable：授权协议与开放标准格式，使材料来源和版本可核验。',
    cite:  'Reusable：完整溯源与使用条款——将引用责任从"格式规范"提升为数据治理。',
  },
];

const PROBLEM_LABELS = { find: '找书', judge: '辨书', cite: '引书' } as const;
type Problem = keyof typeof PROBLEM_LABELS;

@Component({ tag: 'history-timeline', styleUrl: 'history-timeline.css', shadow: false })
export class HistoryTimeline {
  @State() active = 0;
  @State() view: Problem = 'find';

  private go(i: number) {
    if (i < 0 || i >= ENTRIES.length) return;
    this.active = i;
  }

  render() {
    const e = ENTRIES[this.active];
    return (
      <div class="htl">
        {/* Timeline rail */}
        <div class="htl-rail" role="tablist" aria-label="历史时间轴">
          <div class="htl-track-line" />
          {ENTRIES.map((entry, i) => (
            <button
              class={{ 'htl-node': true, 'is-active': i === this.active }}
              role="tab"
              aria-selected={i === this.active}
              onClick={() => this.go(i)}
              title={entry.name}
            >
              <span class="htl-dot" />
              <span class="htl-node-label">
                <span class="htl-node-date">{entry.date}</span>
                <span class="htl-node-name">{entry.name}</span>
              </span>
            </button>
          ))}
        </div>

        {/* Detail panel */}
        <div class="htl-panel" key={String(this.active)}>
          <header class="htl-panel-head">
            <div class="htl-panel-meta">
              <span class="htl-panel-date">{e.date}</span>
              <span class="htl-panel-tagline">{e.tagline}</span>
            </div>
            <h2 class="htl-panel-name">{e.name}</h2>
          </header>

          <div class="htl-tabs" role="tablist">
            {(Object.keys(PROBLEM_LABELS) as Problem[]).map(v => (
              <button
                class={{ 'htl-tab': true, 'is-active': this.view === v }}
                role="tab"
                aria-selected={this.view === v}
                onClick={() => { this.view = v; }}
              >
                {PROBLEM_LABELS[v]}
              </button>
            ))}
          </div>

          <p class="htl-panel-body" key={`${this.active}-${this.view}`}>
            {this.view === 'find' ? e.find : this.view === 'judge' ? e.judge : e.cite}
          </p>
        </div>

        {/* Prev / Next */}
        <div class="htl-footer">
          <button class="htl-arrow" disabled={this.active === 0} onClick={() => this.go(this.active - 1)} aria-label="上一个">
            ←
          </button>
          <span class="htl-progress">
            {ENTRIES.map((_, i) => (
              <span class={{ 'htl-pip': true, 'is-active': i === this.active }} onClick={() => this.go(i)} />
            ))}
          </span>
          <button class="htl-arrow" disabled={this.active === ENTRIES.length - 1} onClick={() => this.go(this.active + 1)} aria-label="下一个">
            →
          </button>
        </div>
      </div>
    );
  }
}
