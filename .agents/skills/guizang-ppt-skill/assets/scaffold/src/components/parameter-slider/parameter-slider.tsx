import { Component, h, State, Prop } from '@stencil/core';

interface CandidateToken {
  word: string;
  logit: number;
  prob: number;
}

@Component({
  tag: 'parameter-slider',
  styleUrl: 'parameter-slider.css',
  shadow: false,
})
export class ParameterSlider {
  @Prop() contextText: string = '晚清学者章太炎主张以佛法之齐物以破除近代之……';

  @State() temperature: number = 0.7;
  @State() topP: number = 0.9;
  @State() topK: number = 5;

  private rawCandidates: { word: string; logit: number }[] = [
    { word: '名学迷执', logit: 3.8 },
    { word: '西学神话', logit: 3.2 },
    { word: '进化论观点', logit: 2.5 },
    { word: '国家主义', logit: 1.8 },
    { word: '理性独断', logit: 1.1 },
    { word: '科技万能', logit: 0.5 },
  ];

  @State() candidates: CandidateToken[] = [];

  componentWillLoad() {
    this.recomputeProbabilities();
  }

  private recomputeProbabilities() {
    const T = Math.max(0.01, this.temperature);

    // 1. Softmax with Temperature
    const expValues = this.rawCandidates.map(c => Math.exp(c.logit / T));
    const sumExp = expValues.reduce((a, b) => a + b, 0);
    let computed = this.rawCandidates.map((c, i) => ({
      word: c.word,
      logit: c.logit,
      prob: expValues[i] / sumExp,
    }));

    // 2. Sort descending
    computed.sort((a, b) => b.prob - a.prob);

    // 3. Top-K cutoff
    computed = computed.slice(0, this.topK);

    // 4. Top-P cumulative cutoff
    let cumSum = 0;
    const filtered: CandidateToken[] = [];
    for (const item of computed) {
      filtered.push(item);
      cumSum += item.prob;
      if (cumSum >= this.topP) break;
    }

    // Renormalize probabilities within nucleus
    const totalMass = filtered.reduce((acc, cur) => acc + cur.prob, 0);
    this.candidates = filtered.map(f => ({
      ...f,
      prob: f.prob / totalMass,
    }));
  }

  private handleTempChange(ev: Event) {
    const val = parseFloat((ev.target as HTMLInputElement).value);
    this.temperature = val;
    this.recomputeProbabilities();
  }

  private handleTopPChange(ev: Event) {
    const val = parseFloat((ev.target as HTMLInputElement).value);
    this.topP = val;
    this.recomputeProbabilities();
  }

  private handleTopKChange(ev: Event) {
    const val = parseInt((ev.target as HTMLInputElement).value, 10);
    this.topK = val;
    this.recomputeProbabilities();
  }

  private getRegimeDescription(): { tag: string; desc: string; colorClass: string } {
    if (this.temperature <= 0.2) {
      return {
        tag: '贪心确定性 (Greedy / Argmax)',
        desc: '分布极度陡峭，首位 Token 概率逼近 100%，适合代码补全、数学解题与严格事实输出。',
        colorClass: 'mode-greedy',
      };
    } else if (this.temperature <= 0.8) {
      return {
        tag: '标准平衡区 (Balanced)',
        desc: '兼顾语义连贯与词汇丰富度，兼顾逻辑性与自然语感。',
        colorClass: 'mode-balanced',
      };
    } else {
      return {
        tag: '高散度发散 (High Entropy)',
        desc: '分布扁平化，低频词概率大幅提升，富于跳跃性与诗意，但幻觉与语法失常风险激增。',
        colorClass: 'mode-creative',
      };
    }
  }

  render() {
    const regime = this.getRegimeDescription();

    return (
      <div class="parameter-shell">
        {/* Context Prompt display */}
        <div class="context-banner">
          <span class="banner-lbl mono">上文上下文 (Context Window):</span>
          <span class="banner-text">"{this.contextText}"</span>
        </div>

        {/* Controls Panel */}
        <div class="controls-panel">
          <div class="slider-control">
            <div class="control-header">
              <label class="mono">温度 Temperature (T): <strong>{this.temperature.toFixed(2)}</strong></label>
              <span class="control-hint">平滑/锐化 Logits 分布</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="1.5"
              step="0.05"
              value={this.temperature}
              onInput={(e) => this.handleTempChange(e)}
            />
            <div class="slider-ticks mono">
              <span>0.1 (冷/确定)</span>
              <span>0.7 (平衡)</span>
              <span>1.5 (热/发散)</span>
            </div>
          </div>

          <div class="slider-control">
            <div class="control-header">
              <label class="mono">核采样 Top-P: <strong>{this.topP.toFixed(2)}</strong></label>
              <span class="control-hint">动态截断累积概率</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="1.0"
              step="0.05"
              value={this.topP}
              onInput={(e) => this.handleTopPChange(e)}
            />
            <div class="slider-ticks mono">
              <span>0.2 (保守)</span>
              <span>0.9 (标准)</span>
              <span>1.0 (全量)</span>
            </div>
          </div>

          <div class="slider-control">
            <div class="control-header">
              <label class="mono">候选集 Top-K: <strong>{this.topK}</strong></label>
              <span class="control-hint">保留前 K 个最高分词</span>
            </div>
            <input
              type="range"
              min="1"
              max="6"
              step="1"
              value={this.topK}
              onInput={(e) => this.handleTopKChange(e)}
            />
            <div class="slider-ticks mono">
              <span>1</span>
              <span>3</span>
              <span>6</span>
            </div>
          </div>
        </div>

        {/* Regime Status Banner */}
        <div class={`regime-bar ${regime.colorClass}`}>
          <span class="regime-tag mono">{regime.tag}</span>
          <span class="regime-desc">{regime.desc}</span>
        </div>

        {/* Candidate Probability Distribution Visualization */}
        <div class="distribution-view">
          <div class="view-header mono">
            <span>候选词元采样概率分布 P(w | Context)</span>
            <span>Softmax(z_i / T)</span>
          </div>

          <div class="prob-list">
            {this.candidates.map((cand, idx) => {
              const pct = (cand.prob * 100).toFixed(1);
              return (
                <div class="prob-row">
                  <div class="prob-meta mono">
                    <span class="rank-badge">#{idx + 1}</span>
                    <span class="token-name">{cand.word}</span>
                    <span class="raw-logit">logit={cand.logit.toFixed(1)}</span>
                  </div>

                  <div class="prob-bar-track">
                    <div
                      class="prob-bar-fill"
                      style={{ width: `${pct}%` }}
                    ></div>
                    <span class="prob-percent mono">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
}
