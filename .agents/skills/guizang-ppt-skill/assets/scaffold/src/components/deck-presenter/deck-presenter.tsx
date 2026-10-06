import { Component, h, State, Prop } from '@stencil/core';

@Component({
  tag: 'deck-presenter',
  styleUrl: 'deck-presenter.css',
  shadow: false,
})
export class DeckPresenter {
  @Prop() targetMinutes: number = 45;

  @State() currentIndex: number = 0;
  @State() totalSlides: number = 1;
  @State() currentTitle: string = '';
  @State() currentNotes: string = '';
  @State() nextTitle: string = '';

  @State() elapsedSeconds: number = 0;
  @State() isTimerRunning: boolean = false;

  private channel: BroadcastChannel | null = null;
  private timerInterval: any = null;

  componentWillLoad() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('courseware_channel');
      this.channel.onmessage = (event) => {
        if (event.data && event.data.type === 'NAVIGATE') {
          this.currentIndex = event.data.index;
          this.totalSlides = event.data.total;
        }
      };
    }
  }

  componentDidLoad() {
    this.startTimer();
    this.fetchSlideMetadata();
  }

  disconnectedCallback() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.channel) this.channel.close();
  }

  private fetchSlideMetadata() {
    // Attempt to inspect parent/opener slides if accessible
    if (window.opener && window.opener.document) {
      const doc = window.opener.document;
      const slides = doc.querySelectorAll('deck-slide');
      this.totalSlides = slides.length;
      const current = slides[this.currentIndex];
      const next = slides[this.currentIndex + 1];

      if (current) {
        this.currentTitle = current.getAttribute('header-title') || `Slide #${this.currentIndex + 1}`;
        this.currentNotes = current.getAttribute('notes') || '（无演讲备注）';
      }
      if (next) {
        this.nextTitle = next.getAttribute('header-title') || `Slide #${this.currentIndex + 2}`;
      } else {
        this.nextTitle = '（演讲结束）';
      }
    }
  }

  private startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.isTimerRunning = true;
    this.timerInterval = setInterval(() => {
      this.elapsedSeconds++;
    }, 1000);
  }

  private toggleTimer() {
    if (this.isTimerRunning) {
      clearInterval(this.timerInterval);
      this.isTimerRunning = false;
    } else {
      this.startTimer();
    }
  }

  private resetTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.elapsedSeconds = 0;
    this.isTimerRunning = false;
  }

  private sendNavigate(index: number) {
    if (index < 0 || index >= this.totalSlides) return;
    this.currentIndex = index;
    if (this.channel) {
      this.channel.postMessage({
        type: 'NAVIGATE',
        index: this.currentIndex,
        total: this.totalSlides,
      });
    }
    this.fetchSlideMetadata();
  }

  private formatTime(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  render() {
    const targetSecs = this.targetMinutes * 60;
    const isOvertime = this.elapsedSeconds > targetSecs;

    return (
      <div class="presenter-shell">
        <header class="presenter-topbar">
          <div class="brand-zone mono">
            <strong>PKU-AIHIS</strong> 演讲者监控台
          </div>

          <div class="timer-zone mono">
            <span class={{ 'timer-display': true, 'overtime': isOvertime }}>
              ⏱ {this.formatTime(this.elapsedSeconds)} / {this.targetMinutes}:00
            </span>
            <button class="action-btn" onClick={() => this.toggleTimer()}>
              {this.isTimerRunning ? '暂停' : '继续'}
            </button>
            <button class="action-btn" onClick={() => this.resetTimer()}>重置</button>
          </div>

          <div class="nav-zone mono">
            <button class="nav-btn" onClick={() => this.sendNavigate(this.currentIndex - 1)} disabled={this.currentIndex === 0}>
              上一页 (←)
            </button>
            <span class="slide-indicator">
              {String(this.currentIndex + 1).padStart(2, '0')} / {String(this.totalSlides).padStart(2, '0')}
            </span>
            <button class="nav-btn" onClick={() => this.sendNavigate(this.currentIndex + 1)} disabled={this.currentIndex >= this.totalSlides - 1}>
              下一页 (→)
            </button>
          </div>
        </header>

        <main class="presenter-grid">
          {/* Main Left: Current Slide Notes & Outline */}
          <section class="notes-panel">
            <div class="panel-header mono">
              <span>当前演讲提词 & 备注</span>
              <span class="badge badge-accent">第 {this.currentIndex + 1} 页</span>
            </div>
            <h2 class="current-slide-heading">{this.currentTitle || `Slide ${this.currentIndex + 1}`}</h2>
            <div class="notes-body">
              {this.currentNotes ? (
                <div class="notes-content">{this.currentNotes}</div>
              ) : (
                <div class="empty-notes">当前页面未配置讲稿备注（可在 deck-slide notes 属性中添加）。</div>
              )}
            </div>
          </section>

          {/* Right Column: Next Slide preview & Pacing hints */}
          <aside class="side-panel">
            <div class="preview-box">
              <div class="panel-header mono">下一页预告</div>
              <div class="next-title-preview">{this.nextTitle || '无下一页'}</div>
            </div>

            <div class="pacing-box">
              <div class="panel-header mono">节奏提醒</div>
              <ul class="pacing-tips">
                <li>本课件强调<strong>真实可交互范例</strong>，避免长篇念稿。</li>
                <li>引导学生在浏览器中操作参数滑块或步进器观察状态变迁。</li>
                <li>注意预留 3-5 分钟供随堂提问与范例讨论。</li>
              </ul>
            </div>
          </aside>
        </main>
      </div>
    );
  }
}
