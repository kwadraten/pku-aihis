import { Component, h, State, Prop } from '@stencil/core';

interface StepData {
  title: string;
  subtitle: string;
  desc: string;
  codeOrState: string;
  tag: string;
}

@Component({
  tag: 'interactive-stepper',
  styleUrl: 'interactive-stepper.css',
  shadow: false,
})
export class InteractiveStepper {
  @Prop() stepsData: string = '';

  @State() activeIndex: number = 0;
  @State() steps: StepData[] = [
    {
      title: '第一层：DNS 解析与边缘网关接入',
      subtitle: 'Client -> Edge Gateway (TLS / HTTP2 / Keep-Alive)',
      desc: '用户在 Web 页面或终端提交 Prompt。客户端发起 HTTPS 请求，经由全球 Anycast DNS 解析至最近的反向代理网关。网关负责鉴权 Token 校验、限流防刷 (Rate Limit) 及 Session 路由。',
      codeOrState: `POST /v1/chat/completions HTTP/2
Host: api.pku-aihis.org
Authorization: Bearer sk-antigravity-live-token
Content-Type: application/json

{ "model": "qwen2.5-72b", "stream": true, "temperature": 0.7 }`,
      tag: 'I/O 传输层',
    },
    {
      title: '第二层：分词器预处理与 Token ID 映射',
      subtitle: 'Raw String -> BPE Subwords -> Vocabulary Tensor',
      desc: '文本进入服务端引擎。Tokenizer 依据预训练词表对字符序列进行最长贪心匹配，切分为 Token 序列，并转换为稠密整形张量 (Input IDs & Attention Mask)。',
      codeOrState: `Input Text: "章太炎在《齐物论释》中"
Tokens:     ["章太炎", "在", "《", "齐物论", "释", "》", "中"]
Input IDs:  [104921, 238, 1205, 89342, 1042, 1206, 312]
Tensor:     torch.tensor([[104921, 238, 1205, 89342, 1042, 1206, 312]])`,
      tag: '分词映射层',
    },
    {
      title: '第三层：嵌入向量查找与位置编码注入',
      subtitle: 'Token IDs -> d_model Embedding Matrix + RoPE',
      desc: '利用 Input IDs 检索模型的静态权重矩阵 $W_{embed} \\in \\mathbb{R}^{V \\times d}$，将每个 Token 投影至 4096 维的高维向量空间，并叠加旋转位置编码 (RoPE) 以注入词序几何信息。',
      codeOrState: `X_0 = EmbeddingLookup(Input_IDs, W_embed)  # [1, 7, 4096]
X_pos = ApplyRotaryPositionalEmbedding(X_0)
Norm: RMSNorm(X_pos, eps=1e-6)
Hidden Dimension: d_model = 4096, n_heads = 32`,
      tag: '几何表征层',
    },
    {
      title: '第四层：Transformer 多层自注意力与 FFN 计算',
      subtitle: 'N Layers of Self-Attention (Q, K, V) + SwiGLU FFN',
      desc: '向量序列逐层流经数十个 Transformer Decoder 模块。通过自注意力矩阵 $Softmax(QK^T / \\sqrt{d_k})V$ 聚合全局历史上下文，再由门控前馈网络 (FFN) 激活非线性高阶语义知识。',
      codeOrState: `for layer in range(num_layers): # Layer 1..64
    Q, K, V = compute_qkv(h_norm)
    attn_weights = causal_mask(Q @ K.T / sqrt(head_dim))
    h = h + dropout(attn_weights @ V)
    h = h + ffn_swiglu(rmsnorm(h))
Final Output: hidden_states[-1]  # [1, 7, 4096]`,
      tag: '前向推断层',
    },
    {
      title: '第五层：Logits 投影、采样解码与流式推流',
      subtitle: 'Final Norm -> LM Head -> Softmax / Temperature -> SSE Stream',
      desc: '最后一层隐状态投影至全局词表空间生成数十万维的 Logits 向量。经 Temperature / Top-P 缩放后随机采样出下一个 Token，并通过 Server-Sent Events (SSE) 逐字推回给客户端。',
      codeOrState: `logits = h[-1] @ W_lm_head.T    # Shape: [151643]
probs = softmax(logits / 0.7)
next_token = sample_nucleus(probs, top_p=0.9)
SSE Event:
data: {"id":"chat-99","choices":[{"delta":{"content":"指出"}}]}`,
      tag: '生成推流层',
    },
  ];

  componentWillLoad() {
    if (this.stepsData) {
      try {
        const parsed = JSON.parse(this.stepsData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.steps = parsed;
        }
      } catch (e) {
        console.error('Invalid stepsData JSON', e);
      }
    }
  }

  private goToStep(index: number) {
    if (index >= 0 && index < this.steps.length) {
      this.activeIndex = index;
    }
  }

  render() {
    const activeStep = this.steps[this.activeIndex] || this.steps[0];

    return (
      <div class="stepper-shell">
        {/* Navigation Step Pipeline Bar */}
        <div class="pipeline-bar">
          {this.steps.map((step, idx) => (
            <div
              class={{
                'pipeline-node': true,
                'is-active': idx === this.activeIndex,
                'is-passed': idx < this.activeIndex,
              }}
              onClick={() => this.goToStep(idx)}
            >
              <div class="node-badge mono">0{idx + 1}</div>
              <div class="node-label">
                <div class="node-tag mono">{step.tag}</div>
                <div class="node-name">{step.title.split('：')[0]}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Step Content Main Card */}
        <div class="step-card">
          <div class="card-header-bar">
            <div>
              <div class="step-meta mono">
                <span class="badge badge-accent">STAGE {this.activeIndex + 1} OF {this.steps.length}</span>
                <span class="sub-meta">{activeStep.subtitle}</span>
              </div>
              <h3 class="step-main-title">{activeStep.title}</h3>
            </div>

            <div class="step-nav-actions">
              <button
                class="stepper-btn"
                disabled={this.activeIndex === 0}
                onClick={() => this.goToStep(this.activeIndex - 1)}
              >
                ← 上一步
              </button>
              <button
                class="stepper-btn primary"
                disabled={this.activeIndex === this.steps.length - 1}
                onClick={() => this.goToStep(this.activeIndex + 1)}
              >
                下一步 (观察状态转换) →
              </button>
            </div>
          </div>

          <div class="step-grid">
            <div class="step-explanation">
              <h4>运行原理解析</h4>
              <p>{activeStep.desc}</p>
            </div>

            <div class="step-inspector">
              <div class="inspector-tab mono">
                <span>实时状态透视 / 协议与张量 (Live Inspector)</span>
                <span>STATE_OK</span>
              </div>
              <pre><code>{activeStep.codeOrState}</code></pre>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
