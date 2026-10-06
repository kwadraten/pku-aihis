import { Component, h, Prop } from '@stencil/core';

@Component({
  tag: 'layout-kpi-grid',
  styleUrl: 'layout-kpi-grid.css',
  shadow: false,
})
export class LayoutKpiGrid {
  @Prop() columns: number = 3;

  render() {
    return (
      <div class="kpi-grid-container" style={{ gridTemplateColumns: `repeat(${this.columns}, 1fr)` }}>
        <slot></slot>
      </div>
    );
  }
}
