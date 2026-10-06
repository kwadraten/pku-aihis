import { Component, h, State, Prop } from '@stencil/core';

@Component({
  tag: 'vector-inspector',
  styleUrl: 'vector-inspector.css',
  shadow: false,
})
export class VectorInspector {
  @Prop() initialConceptA: string = '章太炎 (晚清思想/古文经学)';
  @Prop() initialConceptB: string = '梁启超 (晚清维新/新民说)';

  @State() vecA: number[] = [0.82, 0.55, 0.15];
  @State() vecB: number[] = [0.75, 0.62, 0.22];
  @State() labelA: string = '章太炎';
  @State() labelB: string = '梁启超';

  private setPreset(nameA: string, vA: number[], nameB: string, vB: number[]) {
    this.labelA = nameA;
    this.vecA = [...vA];
    this.labelB = nameB;
    this.vecB = [...vB];
  }

  private handleVecChange(target: 'A' | 'B', index: number, ev: Event) {
    const val = parseFloat((ev.target as HTMLInputElement).value);
    if (target === 'A') {
      const next = [...this.vecA];
      next[index] = val;
      this.vecA = next;
    } else {
      const next = [...this.vecB];
      next[index] = val;
      this.vecB = next;
    }
  }

  private computeMetrics() {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    let euclidDistSq = 0;

    for (let i = 0; i < this.vecA.length; i++) {
      dot += this.vecA[i] * this.vecB[i];
      normA += this.vecA[i] * this.vecA[i];
      normB += this.vecB[i] * this.vecB[i];
      euclidDistSq += Math.pow(this.vecA[i] - this.vecB[i], 2);
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    const cosine = (normA === 0 || normB === 0) ? 0 : dot / (normA * normB);
    const angleRad = Math.acos(Math.max(-1, Math.min(1, cosine)));
    const angleDeg = (angleRad * 180) / Math.PI;

    return {
      dot: dot.toFixed(3),
      normA: normA.toFixed(3),
      normB: normB.toFixed(3),
      cosine: cosine.toFixed(4),
      cosinePct: Math.max(0, cosine * 100).toFixed(1),
      angleDeg: angleDeg.toFixed(1),
      euclidDist: Math.sqrt(euclidDistSq).toFixed(3),
    };
  }

  render() {
    const metrics = this.computeMetrics();

    return (
      <div class="inspector-shell">
        {/* Presets bar */}
        <div class="preset-row">
          <span class="preset-label mono">语义预设对照:</span>
          <button
            class="preset-pill"
            onClick={() => this.setPreset('章太炎', [0.85, 0.52, 0.12], '梁启超', [0.78, 0.60, 0.18])}
          >
            近义思想家 (高相关)
          </button>
          <button
            class="preset-pill"
            onClick={() => this.setPreset('章太炎', [0.85, 0.52, 0.12], '量子力学矩阵', [-0.20, 0.05, 0.88])}
          >
            人文 vs 理工 (正交弱相关)
          </button>
          <button
            class="preset-pill"
            onClick={() => this.setPreset('极度尊崇', [0.95, 0.20, 0.05], '全盘批判', [-0.92, -0.15, 0.02])}
          >
            语义对立反义词 (负余弦)
          </button>
        </div>

        {/* Vector Controls */}
        <div class="vector-controls-grid">
          {/* Vector A */}
          <div class="vec-card">
            <div class="vec-header">
              <span class="badge badge-accent mono">向量 A</span>
              <strong class="vec-title">{this.labelA}</strong>
            </div>
            {['维度 d_1 (历史/文献)', '维度 d_2 (政治/维新)', '维度 d_3 (自然/科技)'].map((dim, i) => (
              <div class="dim-control">
                <div class="dim-label mono">
                  <span>{dim}</span>
                  <strong>{this.vecA[i].toFixed(2)}</strong>
                </div>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.05"
                  value={this.vecA[i]}
                  onInput={(e) => this.handleVecChange('A', i, e)}
                />
              </div>
            ))}
          </div>

          {/* Vector B */}
          <div class="vec-card">
            <div class="vec-header">
              <span class="badge mono">向量 B</span>
              <strong class="vec-title">{this.labelB}</strong>
            </div>
            {['维度 d_1 (历史/文献)', '维度 d_2 (政治/维新)', '维度 d_3 (自然/科技)'].map((dim, i) => (
              <div class="dim-control">
                <div class="dim-label mono">
                  <span>{dim}</span>
                  <strong>{this.vecB[i].toFixed(2)}</strong>
                </div>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.05"
                  value={this.vecB[i]}
                  onInput={(e) => this.handleVecChange('B', i, e)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Metric Output Banner */}
        <div class="metric-output-card">
          <div class="similarity-headline">
            <div class="sim-val-block">
              <span class="sim-lbl mono">余弦相似度 (Cosine Similarity)</span>
              <div class="sim-large-val mono">
                {metrics.cosine} <small>({metrics.cosinePct}%)</small>
              </div>
            </div>

            <div class="sim-angle-block mono">
              <span class="sim-lbl">高维空间夹角 θ</span>
              <div class="angle-val">{metrics.angleDeg}°</div>
            </div>
          </div>

          {/* Progress gauge */}
          <div class="sim-gauge-track">
            <div
              class="sim-gauge-fill"
              style={{ width: `${Math.max(0, Math.min(100, parseFloat(metrics.cosinePct)))}%` }}
            ></div>
          </div>

          {/* Detailed Math Breakdown */}
          <div class="math-breakdown mono">
            <span>点积 A·B = <strong>{metrics.dot}</strong></span>
            <span>模长 ||A|| = <strong>{metrics.normA}</strong></span>
            <span>模长 ||B|| = <strong>{metrics.normB}</strong></span>
            <span>欧氏距离 = <strong>{metrics.euclidDist}</strong></span>
          </div>
        </div>
      </div>
    );
  }
}
