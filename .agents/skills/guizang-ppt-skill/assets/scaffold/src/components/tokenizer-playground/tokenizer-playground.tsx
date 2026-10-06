import { Component, h, State, Prop } from '@stencil/core';

interface TokenItem {
  id: number;
  text: string;
  bytes: number;
  colorIdx: number;
}

@Component({
  tag: 'tokenizer-playground',
  styleUrl: 'tokenizer-playground.css',
  shadow: false,
})
export class TokenizerPlayground {
  @Prop() initialText: string = '章太炎在《齐物论释》中对佛学与名学的综合辨析';

  @State() inputText: string = '';
  @State() tokens: TokenItem[] = [];
  @State() selectedToken: TokenItem | null = null;

  componentWillLoad() {
    this.inputText = this.initialText;
    this.tokenize(this.inputText);
  }

  // Simplified realistic subword / character-BPE simulator for demonstration
  private tokenize(text: string) {
    if (!text) {
      this.tokens = [];
      this.selectedToken = null;
      return;
    }

    // Split Chinese words / characters & English words
    const regex = /[\u4e00-\u9fa5]{1,2}|[a-zA-Z]+|[0-9]+|[^\s\w]/g;
    const matches = text.match(regex) || [];
    
    let baseId = 18420;
    this.tokens = matches.map((m, i) => {
      // Deterministic pseudo hash for realistic token IDs
      let hash = 0;
      for (let j = 0; j < m.length; j++) {
        hash = (hash * 31 + m.charCodeAt(j)) & 0xfffff;
      }
      return {
        id: (baseId + hash) % 100000 + 100,
        text: m,
        bytes: new TextEncoder().encode(m).length,
        colorIdx: i % 6,
      };
    });

    if (this.tokens.length > 0) {
      this.selectedToken = this.tokens[0];
    }
  }

  private handleInput(ev: Event) {
    const input = ev.target as HTMLTextAreaElement;
    this.inputText = input.value;
    this.tokenize(this.inputText);
  }

  private setPreset(text: string) {
    this.inputText = text;
    this.tokenize(text);
  }

  render() {
    const charCount = this.inputText.length;
    const tokenCount = this.tokens.length;
    const ratio = tokenCount > 0 ? (charCount / tokenCount).toFixed(2) : '0';

    return (
      <div class="tokenizer-shell">
        {/* Preset quick buttons */}
        <div class="preset-bar">
          <span class="preset-label mono">历史/课程示例:</span>
          <button class="preset-btn" onClick={() => this.setPreset('章太炎在《齐物论释》中对佛学与名学的综合辨析')}>
            章太炎文献
          </button>
          <button class="preset-btn" onClick={() => this.setPreset('一次请求的五层路径：从网关到自回归生成')}>
            五层路径
          </button>
          <button class="preset-btn" onClick={() => this.setPreset('Transformer Multi-Head Self-Attention Layer')}>
            Attention
          </button>
          <button class="preset-btn" onClick={() => this.setPreset('天地不仁，以万物为刍狗。')}>
            道德经
          </button>
        </div>

        {/* Input textarea */}
        <div class="input-container">
          <textarea
            class="text-input"
            rows={2}
            value={this.inputText}
            onInput={(e) => this.handleInput(e)}
            placeholder="输入待分词文本..."
          ></textarea>
        </div>

        {/* Real-time stats header */}
        <div class="stats-row mono">
          <div class="stat-pill">
            <span class="stat-lbl">字符数</span>
            <span class="stat-val">{charCount}</span>
          </div>
          <div class="stat-pill">
            <span class="stat-lbl">词元数 (Tokens)</span>
            <span class="stat-val accent">{tokenCount}</span>
          </div>
          <div class="stat-pill">
            <span class="stat-lbl">压缩比 (Char/Token)</span>
            <span class="stat-val">{ratio}</span>
          </div>
          <div class="stat-pill">
            <span class="stat-lbl">词表映射空间</span>
            <span class="stat-val">151,643 (BPE)</span>
          </div>
        </div>

        {/* Visual Token Output Grid */}
        <div class="tokens-display">
          <div class="tokens-flow">
            {this.tokens.map((tok) => (
              <span
                class={{
                  'token-chip': true,
                  [`color-${tok.colorIdx}`]: true,
                  'is-selected': this.selectedToken?.id === tok.id && this.selectedToken?.text === tok.text,
                }}
                onClick={() => (this.selectedToken = tok)}
                title={`Token ID: ${tok.id} (${tok.bytes} bytes)`}
              >
                <span class="token-text">{tok.text}</span>
                <span class="token-id mono">#{tok.id}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Inspector Detail drawer */}
        {this.selectedToken && (
          <div class="token-inspector mono">
            <span class="inspector-badge">Token 详情探针:</span>
            <span>原始文本: <strong>"{this.selectedToken.text}"</strong></span>
            <span>词元 ID: <strong>{this.selectedToken.id}</strong></span>
            <span>UTF-8 字节长: <strong>{this.selectedToken.bytes} B</strong></span>
            <span>向量索引槽位: <strong>d_model[0..4095]</strong></span>
          </div>
        )}
      </div>
    );
  }
}
