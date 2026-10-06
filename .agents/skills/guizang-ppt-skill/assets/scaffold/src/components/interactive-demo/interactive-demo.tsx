import { Component, h, Prop } from '@stencil/core';

@Component({
  tag: 'interactive-demo',
  styleUrl: 'interactive-demo.css',
  shadow: false,
})
export class InteractiveDemo {
  @Prop() demoTitle: string = '交互范例';
  @Prop() description: string = '';
  @Prop() badgeText: string = '可交互 LIVE';

  render() {
    return (
      <div class="demo-card">
        {/* Header toolbar */}
        <div class="demo-card-header">
          <div class="demo-header-info">
            <span class="badge badge-accent mono">{this.badgeText}</span>
            <h3 class="demo-title">{this.demoTitle}</h3>
          </div>
          {this.description && <p class="demo-description">{this.description}</p>}
        </div>

        {/* Optional top controls bar */}
        <div class="demo-controls-slot">
          <slot name="controls"></slot>
        </div>

        {/* Main interactive visualization canvas */}
        <div class="demo-visual-canvas">
          <slot></slot>
        </div>

        {/* Bottom state / inspection drawer */}
        <div class="demo-inspector-slot">
          <slot name="inspector"></slot>
        </div>
      </div>
    );
  }
}
