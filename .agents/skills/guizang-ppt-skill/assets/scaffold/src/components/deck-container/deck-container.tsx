import { Component, h, State, Element, Listen, Prop } from '@stencil/core';

@Component({
  tag: 'deck-container',
  styleUrl: 'deck-container.css',
  shadow: false,
})
export class DeckContainer {
  @Element() el: HTMLElement;

  @Prop() deckTitle: string = '高密度技术课件';
  @Prop() autoSync: boolean = true;

  @State() currentIndex: number = 0;
  @State() totalSlides: number = 0;
  @State() isOverviewOpen: boolean = false;
  @State() isLowPower: boolean = false;

  private channel: BroadcastChannel | null = null;
  private slides: HTMLElement[] = [];

  componentWillLoad() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window && this.autoSync) {
      this.channel = new BroadcastChannel('courseware_channel');
      this.channel.onmessage = (event) => {
        if (event.data && event.data.type === 'NAVIGATE') {
          this.goToSlide(event.data.index, false);
        }
      };
    }
  }

  componentDidLoad() {
    this.updateSlides();
    this.initFromHash();

    // Check query param for presenter mode
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('presenter') === 'true') {
      this.openPresenterWindow();
    }
  }

  disconnectedCallback() {
    if (this.channel) {
      this.channel.close();
    }
  }

  private updateSlides() {
    this.slides = Array.from(this.el.querySelectorAll('deck-slide'));
    this.totalSlides = this.slides.length;
    this.slides.forEach((slide, index) => {
      slide.setAttribute('data-index', String(index));
      slide.style.display = index === this.currentIndex ? 'block' : 'none';
    });
  }

  private initFromHash() {
    const hash = window.location.hash.replace('#', '');
    const pageNum = parseInt(hash, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= this.totalSlides) {
      this.goToSlide(pageNum - 1, false);
    } else {
      this.goToSlide(0, false);
    }
  }

  private goToSlide(index: number, broadcast: boolean = true) {
    if (index < 0 || index >= this.totalSlides) return;
    this.currentIndex = index;
    window.location.hash = String(index + 1);

    this.slides.forEach((slide, idx) => {
      slide.style.display = idx === index ? 'block' : 'none';
      if (idx === index) {
        slide.dispatchEvent(new CustomEvent('slideActive', { bubbles: true }));
      }
    });

    if (broadcast && this.channel) {
      this.channel.postMessage({
        type: 'NAVIGATE',
        index: this.currentIndex,
        total: this.totalSlides,
        slideId: this.slides[index]?.getAttribute('slide-id') || `slide-${index + 1}`,
      });
    }
  }

  @Listen('keydown', { target: 'window' })
  handleKeyDown(ev: KeyboardEvent) {
    // Ignore when typing inside an input, textarea, or contenteditable
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.getAttribute('contenteditable') === 'true')) {
      return;
    }

    switch (ev.key) {
      case 'ArrowRight':
      case 'PageDown':
      case ' ':
        ev.preventDefault();
        this.goToSlide(this.currentIndex + 1);
        break;
      case 'ArrowLeft':
      case 'PageUp':
        ev.preventDefault();
        this.goToSlide(this.currentIndex - 1);
        break;
      case 'Home':
        ev.preventDefault();
        this.goToSlide(0);
        break;
      case 'End':
        ev.preventDefault();
        this.goToSlide(this.totalSlides - 1);
        break;
      case 'Escape':
      case 'o':
      case 'O':
        ev.preventDefault();
        this.isOverviewOpen = !this.isOverviewOpen;
        break;
      case 'p':
      case 'P':
        ev.preventDefault();
        this.openPresenterWindow();
        break;
      case 'b':
      case 'B':
        ev.preventDefault();
        this.isLowPower = !this.isLowPower;
        document.body.classList.toggle('low-power', this.isLowPower);
        break;
      case 'f':
      case 'F':
        ev.preventDefault();
        this.toggleFullscreen();
        break;
    }
  }

  private toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  private openPresenterWindow() {
    const presenterUrl = `${window.location.pathname}?presenter_view=true#${this.currentIndex + 1}`;
    window.open(presenterUrl, 'deck_presenter_window', 'width=1100,height=750,menubar=no,toolbar=no');
  }

  render() {
    const progress = this.totalSlides > 0 ? ((this.currentIndex + 1) / this.totalSlides) * 100 : 0;
    const currentSlideEl = this.slides[this.currentIndex];
    const currentTitle = currentSlideEl?.getAttribute('header-title') || this.deckTitle;

    return (
      <div class={{ 'deck-wrapper': true, 'low-power-mode': this.isLowPower }}>
        {/* Top Progress Line */}
        <div class="deck-progress-bar">
          <div class="deck-progress-fill" style={{ width: `${progress}%` }}></div>
        </div>

        {/* Main Slide Stage */}
        <main class="deck-stage">
          <slot></slot>
        </main>

        {/* Bottom Control & Status Bar */}
        <footer class="deck-statusbar">
          <div class="status-left">
            <span class="deck-badge mono">PKU-AIHIS</span>
            <span class="deck-title-text">{currentTitle}</span>
          </div>

          <div class="status-center mono">
            <button class="nav-btn" onClick={() => this.goToSlide(this.currentIndex - 1)} disabled={this.currentIndex === 0}>
              ←
            </button>
            <span class="slide-counter">
              {String(this.currentIndex + 1).padStart(2, '0')} / {String(this.totalSlides).padStart(2, '0')}
            </span>
            <button class="nav-btn" onClick={() => this.goToSlide(this.currentIndex + 1)} disabled={this.currentIndex === this.totalSlides - 1}>
              →
            </button>
          </div>

          <div class="status-right">
            <button class="status-tool-btn" title="概览 (ESC)" onClick={() => (this.isOverviewOpen = true)}>
              <span class="mono">[O] 概览</span>
            </button>
            <button class="status-tool-btn" title="演讲者视图 (P)" onClick={() => this.openPresenterWindow()}>
              <span class="mono">[P] 演讲者</span>
            </button>
            <button class="status-tool-btn" title="全屏 (F)" onClick={() => this.toggleFullscreen()}>
              <span class="mono">[F]</span>
            </button>
          </div>
        </footer>

        {/* Overview Grid Overlay */}
        {this.isOverviewOpen && (
          <div class="overview-modal" onClick={() => (this.isOverviewOpen = false)}>
            <div class="overview-header" onClick={(e) => e.stopPropagation()}>
              <h2>课件总览 ({this.totalSlides} 页)</h2>
              <button class="close-btn" onClick={() => (this.isOverviewOpen = false)}>✕</button>
            </div>
            <div class="overview-grid" onClick={(e) => e.stopPropagation()}>
              {this.slides.map((slide, idx) => {
                const title = slide.getAttribute('header-title') || `Slide ${idx + 1}`;
                const layout = slide.getAttribute('layout') || 'normal';
                return (
                  <div
                    class={{ 'overview-card': true, 'active': idx === this.currentIndex }}
                    onClick={() => {
                      this.goToSlide(idx);
                      this.isOverviewOpen = false;
                    }}
                  >
                    <div class="card-meta mono">
                      <span>#{String(idx + 1).padStart(2, '0')}</span>
                      <span class="card-layout-tag">{layout}</span>
                    </div>
                    <div class="card-title">{title}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }
}
