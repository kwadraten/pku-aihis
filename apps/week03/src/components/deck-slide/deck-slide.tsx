import { Component, h, Prop, Element } from "@stencil/core";

@Component({
  tag: "deck-slide",
  styleUrl: "deck-slide.css",
  shadow: false,
})
export class DeckSlide {
  @Element() el: HTMLElement;

  @Prop() slideId: string = "";
  @Prop() layout:
    | "hero"
    | "split"
    | "grid"
    | "pipeline"
    | "interactive"
    | "normal" = "normal";
  @Prop() theme: "light" | "dark" | "accent" = "light";
  @Prop() headerTitle: string = "";
  @Prop() kicker: string = "";
  @Prop() notes: string = "";
  @Prop() duration: number = 2; // suggested minutes

  render() {
    return (
      <section
        class={{
          "slide-page": true,
          [`theme-${this.theme}`]: true,
          [`layout-${this.layout}`]: true,
        }}
        data-slide-id={this.slideId}
      >
        <div class="slide-inner">
          {/* Header Zone if title or kicker is provided */}
          {(this.headerTitle || this.kicker) && (
            <header class="slide-header">
              {this.kicker && (
                <div class="slide-kicker mono">{this.kicker}</div>
              )}
              {this.headerTitle && (
                <h1 class="slide-title">{this.headerTitle}</h1>
              )}
              <div class="slide-header-actions">
                <slot name="header-actions"></slot>
              </div>
            </header>
          )}

          {/* Main Slide Body Slot */}
          <div class="slide-body">
            <slot></slot>
          </div>

          {/* Slide Footer / Footnote Slot */}
          <div class="slide-footer">
            <slot name="footer"></slot>
          </div>
        </div>
      </section>
    );
  }
}
