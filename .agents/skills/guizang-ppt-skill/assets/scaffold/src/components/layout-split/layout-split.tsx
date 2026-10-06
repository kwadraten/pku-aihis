import { Component, h, Prop } from '@stencil/core';

@Component({
  tag: 'layout-split',
  styleUrl: 'layout-split.css',
  shadow: false,
})
export class LayoutSplit {
  @Prop() ratio: '1-1' | '1-2' | '2-1' | '1-3' | '3-1' = '1-1';

  render() {
    return (
      <div class={`split-container ratio-${this.ratio}`}>
        <div class="split-left">
          <slot name="left"></slot>
        </div>
        <div class="split-right">
          <slot name="right"></slot>
        </div>
      </div>
    );
  }
}
