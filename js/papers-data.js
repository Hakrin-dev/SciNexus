/**
 * papers-data.js
 * 5 篇经典 AI/ML 论文完整数据集，挂载到 window.PAPERS_DATA
 * 供论文阅读页面（reading.html / reading.js / reading-enhanced.js）使用
 *
 * 字段结构：
 *   - meta：标题、作者、会议、引用、关键词、中文摘要
 *   - ai：右侧 AI 面板数据（一句话总结、贡献、数据卡片、研读建议、
 *         对比表、实验表、消融柱、建议提问）
 *   - sections：论文章节正文（英文原文核心段落 + 公式占位）
 *   - formulas：公式数据库（逐步解读、变量、物理意义、相关公式）
 *   - translations：中英对照翻译
 */
(function (global) {
  'use strict';

  const PAPERS_DATA = {

    // ============================================================
    // 论文 1：Attention Is All You Need (Transformer)
    // ============================================================
    p1: {
      id: 'p1',
      title: 'Attention Is All You Need',
      authors: 'Ashish Vaswani et al.',
      venue: 'NeurIPS 2017',
      year: 2017,
      ccf: 'A',
      citations: '98,700+',
      keywords: ['NLP', 'Transformer', '注意力机制', '机器翻译', '序列建模'],
      abstract:
        '本文提出 Transformer，一种完全基于注意力机制、完全摒弃循环与卷积的序列转换架构。' +
        '通过多头自注意力（Multi-Head Self-Attention）与位置编码，模型能够并行计算序列中任意两个位置之间的依赖，' +
        '显著提升训练效率。在 WMT 2014 英德翻译任务上达到 28.4 BLEU，英法翻译达到 41.0 BLEU，' +
        '均超越当时最优结果，且训练成本仅为现有模型的一小部分。Transformer 奠定了现代大语言模型的基础。',

      ai: {
        oneLineSummary:
          '用纯注意力机制替代 RNN/CNN 的 Transformer 架构，开启了大模型时代。',
        contributions: [
          '首次提出完全基于注意力机制的编解码架构 Transformer，摒弃了循环与卷积，支持高度并行化训练。',
          '设计缩放点积注意力（Scaled Dot-Product Attention）与多头注意力（Multi-Head Attention），让模型在多个子空间共同关注信息。',
          '引入正弦/余弦位置编码，在不引入递归的前提下注入序列位置信息。',
          '在 WMT 2014 英德/英法翻译任务上同时取得 SOTA，训练成本仅为当时最优模型的一小部分。',
          '证明了自注意力在长距离依赖建模上的优越性，为后续 BERT、GPT 等预训练模型奠定基础。'
        ],
        dataCards: [
          { value: '28.4', label: '英德 BLEU' },
          { value: '41.0', label: '英法 BLEU' },
          { value: '2.3×10¹⁸', label: '训练 FLOPs' },
          { value: '8', label: '注意力头数 (Base)' }
        ],
        readingTip:
          '建议按"问题动机 → 自注意力公式 → 多头机制 → 位置编码 → 编解码堆叠 → 实验对比"的顺序阅读；' +
          '重点理解 Q/K/V 的含义以及为何需要 √d_k 缩放，并对照 Figure 1 把整体架构图与公式对应起来。',
        comparisonTable: {
          headers: ['模型', '核心结构', '层数/参数', '英德 BLEU', '训练成本 (FLOPs)'],
          rows: [
            { values: ['GNMT + RL', '深度 LSTM + 注意力', '8 层', '24.6', '1.0×10²⁰'], highlight: false },
            { values: ['ConvS2S', '全卷积 + 注意力', '15 层', '25.16', '1.55×10²⁰'], highlight: false },
            { values: ['MoE', '专家混合 + 注意力', '—', '26.03', '2.29×10¹⁹'], highlight: false },
            { values: ['Transformer (Base)', '纯自注意力', '6 层 / 65M', '27.3', '3.3×10¹⁸'], highlight: false },
            { values: ['Transformer (Big)', '纯自注意力', '6 层 / 213M', '28.4', '2.3×10¹⁹'], highlight: true }
          ]
        },
        experimentTable: {
          headers: ['任务 / 数据集', '指标', '此前 SOTA', 'Transformer', '提升'],
          rows: [
            { values: ['WMT14 英德翻译', 'BLEU', '26.03 (MoE)', '28.4', '+2.37'] },
            { values: ['WMT14 英法翻译', 'BLEU', '40.4 (ConvS2S)', '41.0', '+0.6'] },
            { values: ['英德训练速度', 'tokens/sec', '12K (ConvS2S)', '38K', '~3×'] },
            { values: ['英语成分句法分析', 'F1', '—', '≈ SOTA', '—'] }
          ]
        },
        ablationBars: [
          { label: '单层注意力 (h=1, d=512)', value: 55, display: '17.3 BLEU' },
          { label: '多头注意力 (h=8, d=512)', value: 85, display: '27.3 BLEU' },
          { label: '去掉位置编码', value: 70, display: '24.1 BLEU' },
          { label: '学习式位置编码', value: 86, display: '27.5 BLEU' },
          { label: '正弦位置编码 (Big)', value: 95, display: '28.4 BLEU' }
        ],
        suggestedQuestions: [
          '为什么 Transformer 可以完全抛弃 RNN 和 CNN？',
          '缩放点积注意力中除以 √d_k 的目的是什么？',
          '多头注意力相比单头注意力有什么优势？',
          '位置编码有哪些方式？为什么可以用正弦函数？',
          'Transformer 在训练和推理上的复杂度分别是多少？'
        ]
      },

      sections: [
        {
          id: 'abstract',
          title: 'Abstract',
          level: 2,
          content: [
            {
              type: 'p',
              text:
                'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.'
            },
            {
              type: 'p',
              text:
                'Experiments on two machine translation tasks show these models to be superior in quality while being more parallelizable and requiring significantly less time to train. Our model achieves 28.4 BLEU on the WMT 2014 English-to-German translation task, improving over the existing best results including ensembles by over 2 BLEU. On the WMT 2014 English-to-French translation task, our model establishes a new single-model state-of-the-art BLEU score of 41.0 after training for 3.5 days on eight GPUs, a small fraction of the training costs of the best models from the literature.'
            },
            {
              type: 'p',
              text:
                'We show that the Transformer generalizes well to other tasks by applying it successfully to English constituency parsing both with large and limited training data.'
            }
          ]
        },
        {
          id: 'intro',
          title: '1. Introduction',
          level: 2,
          content: [
            {
              type: 'p',
              text:
                'Recurrent neural networks, long short-term memory and gated recurrent neural networks in particular, have been firmly established as state-of-the-art approaches in sequence modeling and transduction problems such as language modeling and machine translation. Numerous efforts have since continued to push the boundaries of recurrent language models and encoder-decoder architectures.'
            },
            {
              type: 'p',
              text:
                'Recurrent models typically factor computation along the symbol positions of the input and output sequences. Aligning the positions to steps in computation time, they generate a sequence of hidden states h_t, as a function of the previous hidden state h_{t−1} and the input for position t. This inherently sequential nature precludes parallelization within training examples, which becomes critical at longer sequence lengths, as memory constraints limit batching across examples.'
            },
            {
              type: 'p',
              text:
                'Attention mechanisms have become an integral part of compelling sequence modeling and transduction models in various tasks, allowing modeling of dependencies without regard to their distance in the input or output sequences. In all but a few cases, however, such attention mechanisms are used in conjunction with a recurrent network.'
            },
            {
              type: 'p',
              text:
                'In this work we propose the Transformer, a model architecture eschewing recurrence and instead relying entirely on an attention mechanism to draw global dependencies between input and output. The Transformer allows for significantly more parallelization and can reach a new state of the art in translation quality after being trained for as little as twelve hours on eight P100 GPUs.'
            }
          ]
        },
        {
          id: 'background',
          title: '2. Background',
          level: 2,
          content: [
            {
              type: 'p',
              text:
                'The goal of reducing sequential computation also forms the foundation of the Extended Neural GPU, ByteNet and ConvS2S, all of which use convolutional neural networks as basic building block, computing hidden representations in parallel for all input and output positions. In these models, the number of operations required to relate signals from two arbitrary input or output positions grows with the distance between positions, linearly for ConvS2S and logarithmically for ByteNet. This makes it more difficult to learn dependencies between distant positions.'
            },
            {
              type: 'p',
              text:
                'In the Transformer, this is reduced to a constant number of operations, albeit at the cost of reduced effective resolution due to averaging attention-weighted positions, an effect we counteract with Multi-Head Attention.'
            },
            {
              type: 'p',
              text:
                'Self-attention, sometimes called intra-attention, is an attention mechanism relating different positions of a single sequence in order to compute a representation of the sequence. Self-attention has been used successfully in a variety of tasks including reading comprehension, abstractive summarization, textual entailment and learning task-independent sentence representations.'
            },
            {
              type: 'p',
              text:
                'End-to-end memory networks are based on a recurrent attention mechanism instead of sequence-aligned recurrence and have been shown to perform well on simple-language question answering and language modeling tasks. To the best of our knowledge, however, the Transformer is the first transduction model relying entirely on self-attention to compute representations of its input and output without using sequence-aligned RNNs or convolution.'
            }
          ]
        },
        {
          id: 'model-arch',
          title: '3. Model Architecture',
          level: 2,
          content: [
            {
              type: 'p',
              text:
                'Most competitive neural sequence transduction models have an encoder-decoder structure. Here, the encoder maps an input sequence of symbol representations (x_1, ..., x_n) to a sequence of continuous representations z = (z_1, ..., z_n). Given z, the decoder then generates an output sequence (y_1, ..., y_m) of symbols one element at a time. At each step the model is auto-regressive, consuming the previously generated symbols as additional input when generating the next.'
            }
          ]
        },
        {
          id: 'encoder-decoder',
          title: '3.1 Encoder and Decoder Stacks',
          level: 3,
          content: [
            {
              type: 'p',
              text:
                'Encoder: The encoder is composed of a stack of N = 6 identical layers. Each layer has two sub-layers. The first is a multi-head self-attention mechanism, and the second is a simple, position-wise fully connected feed-forward network. We employ a residual connection around each of the two sub-layers, followed by layer normalization. That is, the output of each sub-layer is LayerNorm(x + Sublayer(x)), where Sublayer(x) is the function implemented by the sub-layer itself.'
            },
            {
              type: 'p',
              text:
                'Decoder: The decoder is also composed of a stack of N = 6 identical layers. In addition to the two sub-layers in each encoder layer, the decoder inserts a third sub-layer, which performs multi-head attention over the output of the encoder stack. Similar to the encoder, we employ residual connections around each of the sub-layers, followed by layer normalization. We also modify the self-attention sub-layer in the decoder stack to prevent positions from attending to subsequent positions. This masking, combined with fact that the output embeddings are offset by one position, ensures that the predictions for position i can depend only on the known outputs at positions less than i.'
            }
          ]
        },
        {
          id: 'attention',
          title: '3.2 Attention',
          level: 3,
          content: [
            {
              type: 'p',
              text:
                'An attention function can be described as mapping a query and a set of key-value pairs to an output, where the query, keys, values, and output are all vectors. The output is computed as a weighted sum of the values, where the weight assigned to each value is computed by a compatibility function of the query with the corresponding key.'
            },
            { type: 'formula', ref: 'attention', display: 'Attention(Q,K,V) = softmax(QKᵀ / √d_k) V' },
            {
              type: 'p',
              text:
                'We call our particular attention "Scaled Dot-Product Attention". The input consists of queries and keys of dimension d_k, and values of dimension d_v. We compute the dot products of the query with all keys, divide each by √d_k, and apply a softmax function to obtain the weights on the values.'
            },
            {
              type: 'p',
              text:
                'Multi-head attention allows the model to jointly attend to information from different representation subspaces at different positions. With a single attention head, averaging inhibits this.'
            },
            { type: 'formula', ref: 'multihead', display: 'MultiHead(Q,K,V) = Concat(head_1,...,head_h) W^O' },
            { type: 'formula', ref: 'head', display: 'head_i = Attention(QW_i^Q, KW_i^K, VW_i^V)' },
            {
              type: 'p',
              text:
                'In this work we employ h = 8 parallel attention layers, or heads. For each of these we use d_k = d_v = d_model / h = 64. Due to the reduced dimension of each head, the total computational cost is similar to that of single-head attention with full dimensionality.'
            }
          ]
        },
        {
          id: 'ffn',
          title: '3.3 Position-wise Feed-Forward Networks',
          level: 3,
          content: [
            {
              type: 'p',
              text:
                'In addition to attention sub-layers, each of the layers in our encoder and decoder contains a fully connected feed-forward network, which is applied to each position separately and identically. This consists of two linear transformations with a ReLU activation in between.'
            },
            {
              type: 'p',
              text:
                'FFN(x) = max(0, xW_1 + b_1)W_2 + b_2. While the linear transformations are the same across different positions, they use different parameters from layer to layer. The inner dimension d_ff = 2048 for the base model, four times the model dimension d_model = 512.'
            }
          ]
        },
        {
          id: 'pos-enc',
          title: '3.4 Embeddings and Positional Encoding',
          level: 3,
          content: [
            {
              type: 'p',
              text:
                'Similarly to other sequence transduction models, we use learned embeddings to convert the input tokens and output tokens to vectors of dimension d_model. We also use the usual learned linear transformation and softmax function to convert the decoder output to predicted next-token probabilities.'
            },
            {
              type: 'p',
              text:
                'Since our model contains no recurrence and no convolution, in order for the model to make use of the order of the sequence, we must inject some information about the relative or absolute position of the tokens in the sequence. To this end, we add "positional encodings" to the input embeddings at the bottoms of the encoder and decoder stacks.'
            },
            { type: 'formula', ref: 'embedding', display: 'PE(pos,2i)=sin(pos/10000^{2i/d}), PE(pos,2i+1)=cos(...)' },
            {
              type: 'p',
              text:
                'We chose the sinusoidal version because it may allow the model to extrapolate to sequence lengths longer than the ones encountered during training. For any fixed offset k, PE(pos+k) can be represented as a linear function of PE(pos), making it easy for the model to learn relative positional relationships.'
            }
          ]
        },
        {
          id: 'why-self-attn',
          title: '4. Why Self-Attention',
          level: 2,
          content: [
            {
              type: 'p',
              text:
                'In this section we compare various aspects of self-attention layers to the recurrent and convolutional layers commonly used for mapping one variable-length sequence of symbol representations to another sequence of equal length. We compare the three operations on the following dimensions: total computational complexity per layer, amount of computation that can be parallelized, and the path length between long-range dependencies in the network.'
            },
            {
              type: 'p',
              text:
                'Learning long-range dependencies is a key challenge in many sequence transduction tasks. One key factor affecting the ability to learn such dependencies is the length of the forward and backward paths that signals have to traverse in the network. The shorter these paths between any combination of positions in the input and output sequences, the easier it is to learn long-range dependencies.'
            },
            {
              type: 'p',
              text:
                'A self-attention layer connects all positions with a constant number of sequentially executed operations, whereas a recurrent layer requires O(n) sequential operations. In terms of computational complexity, self-attention layers are faster than recurrent layers when the sequence length n is smaller than the representation dimensionality d, which is often the case with most state-of-the-art models in modern NLP.'
            }
          ]
        },
        {
          id: 'training',
          title: '5. Training',
          level: 2,
          content: [
            {
              type: 'p',
              text:
                'This section describes the training regime for our models. We trained on the standard WMT 2014 English-German dataset consisting of about 4.5 million sentence pairs. Sentences were encoded using byte-pair encoding, which has a shared source-target vocabulary of about 37,000 tokens. For English-French, we used the significantly larger WMT 2014 English-French dataset consisting of 36 million sentences and split tokens into a 32,000 word-piece vocabulary.'
            },
            {
              type: 'p',
              text:
                'We trained our models on one machine with 8 NVIDIA P100 GPUs. For our base model using the hyperparameters described throughout the paper, each training step took about 0.4 seconds. We trained the base model for a total of 100,000 steps or 12 hours. For our big model, step time was 1.0 second and the model was trained for 300,000 steps, which corresponds to 3.5 days.'
            },
            {
              type: 'p',
              text:
                'We used the Adam optimizer with β_1 = 0.9, β_2 = 0.98 and ε = 10⁻⁹. We varied the learning rate over the course of training, increasing it linearly for the first warmup steps, and decreasing it thereafter proportionally to the inverse square root of the step number. We used regularization during training: residual dropout (P_drop = 0.1) applied to the output of each sub-layer before it is added to the sub-layer input and normalized, and label smoothing with value ε_ls = 0.1.'
            }
          ]
        },
        {
          id: 'results',
          title: '6. Results',
          level: 2,
          content: [
            {
              type: 'p',
              text:
                'On the WMT 2014 English-to-German task, the Transformer (big) model outperforms the best previously reported models (including ensembles) by more than 2.0 BLEU, establishing a new state-of-the-art BLEU score of 28.4. The base model even outperforms all previously published models and ensembles, at a fraction of the training cost of any of the competitive models.'
            },
            {
              type: 'p',
              text:
                'On the WMT 2014 English-to-French translation task, the big model achieves a BLEU score of 41.0, outperforming all of the previously published single models, at less than 1/4 the training cost of the previous state-of-the-art model. The Transformer (big) model trained for English-to-French used dropout P_drop = 0.1 rather than 0.3.'
            },
            {
              type: 'p',
              text:
                'We also report results on English constituency parsing, to explore whether the Transformer can generalize to other tasks. The Transformer generalizes well to English constituency parsing even with limited training data, yielding results competitive with or better than previously reported models despite no task-specific tuning.'
            }
          ]
        },
        {
          id: 'conclusion',
          title: '7. Conclusion',
          level: 2,
          content: [
            {
              type: 'p',
              text:
                'In this work, we presented the Transformer, the first sequence transduction model based entirely on attention, replacing the recurrent layers most commonly used in encoder-decoder architectures with multi-headed self-attention.'
            },
            {
              type: 'p',
              text:
                'For translation tasks, the Transformer can be trained significantly faster than architectures based on recurrent or convolutional layers. On both WMT 2014 English-to-German and WMT 2014 English-to-French translation tasks, we achieved a new state of the art. We are excited about the future of attention-based models and plan to apply them to other tasks, including those involving input and output modalities other than text.'
            }
          ]
        }
      ],

      formulas: {
        attention: {
          title: '缩放点积注意力 (Scaled Dot-Product Attention)',
          latex:
            '\\text{Attention}(Q,K,V)=\\text{softmax}\\!\\left(\\frac{QK^{T}}{\\sqrt{d_k}}\\right)V',
          steps: [
            { num: 1, text: '计算 Q 与 K 的点积 QK^T，得到每个查询对所有键的相似度分数矩阵。' },
            { num: 2, text: '将相似度矩阵除以 √d_k 进行缩放，避免点积过大使 softmax 进入饱和区导致梯度消失。' },
            { num: 3, text: '对缩放后的分数逐行做 softmax，得到和为 1 的注意力权重。' },
            { num: 4, text: '用注意力权重对 V 进行加权求和，得到该查询对应的输出向量。' }
          ],
          variables: [
            { symbol: 'Q', desc: '查询矩阵 (Queries)，形状 n × d_k' },
            { symbol: 'K', desc: '键矩阵 (Keys)，形状 m × d_k' },
            { symbol: 'V', desc: '值矩阵 (Values)，形状 m × d_v' },
            { symbol: 'd_k', desc: '键/查询向量维度，Base 模型中为 64' },
            { symbol: 'd_v', desc: '值向量维度，通常与 d_k 相同' }
          ],
          meaning:
            '注意力机制的核心运算单元。通过 Q 与 K 的相似度决定从 V 中"看"哪里以及"看多少"，' +
            '缩放因子 √d_k 稳定了 softmax 的梯度。该公式是 Transformer 所有注意力子层的基础。',
          related: ['multihead', 'head']
        },
        multihead: {
          title: '多头注意力 (Multi-Head Attention)',
          latex:
            '\\text{MultiHead}(Q,K,V)=\\text{Concat}(\\text{head}_1,\\ldots,\\text{head}_h)W^{O}',
          steps: [
            { num: 1, text: '将 Q、K、V 分别通过 h 组不同的线性投影 W_i^Q、W_i^K、W_i^V 映射到低维子空间。' },
            { num: 2, text: '在每个子空间并行执行缩放点积注意力，得到 h 个 head 的输出。' },
            { num: 3, text: '把 h 个 head 的输出在最后一维拼接 (Concat)。' },
            { num: 4, text: '再通过一次线性映射 W^O 投影回 d_model 维。' }
          ],
          variables: [
            { symbol: 'h', desc: '注意力头数，Base 模型 h = 8' },
            { symbol: 'head_i', desc: '第 i 个注意力头的输出，维度 d_v = d_model / h' },
            { symbol: 'W_i^Q / W_i^K / W_i^V', desc: '每个头的查询/键/值投影矩阵' },
            { symbol: 'W^O', desc: '输出投影矩阵，形状 h·d_v × d_model' }
          ],
          meaning:
            '多头机制让模型在不同表示子空间中共同关注不同位置的信息，' +
            '相比单头注意力能够捕捉更丰富的语义关系，且通过低维子空间保持总计算量相近。',
          related: ['attention', 'head']
        },
        head: {
          title: '单头注意力 (head_i)',
          latex:
            '\\text{head}_i=\\text{Attention}(QW_i^{Q},KW_i^{K},VW_i^{V})',
          steps: [
            { num: 1, text: '对原始 Q、K、V 分别用该头的投影矩阵 W_i^Q、W_i^K、W_i^V 做线性变换。' },
            { num: 2, text: '将变换后的三元组送入缩放点积注意力。' },
            { num: 3, text: '得到该头在子空间中的注意力输出。' }
          ],
          variables: [
            { symbol: 'QW_i^Q', desc: '第 i 个头投影后的查询' },
            { symbol: 'KW_i^K', desc: '第 i 个头投影后的键' },
            { symbol: 'VW_i^V', desc: '第 i 个头投影后的值' }
          ],
          meaning: '每个 head 在独立的低维子空间内执行注意力，使模型可以并行地从不同角度建模依赖关系。',
          related: ['attention', 'multihead']
        },
        embedding: {
          title: '正弦位置编码 (Sinusoidal Positional Encoding)',
          latex:
            'PE_{(pos,2i)}=\\sin\\!\\left(pos/10000^{2i/d_{\\text{model}}}\\right),\\quad PE_{(pos,2i+1)}=\\cos\\!\\left(pos/10000^{2i/d_{\\text{model}}}\\right)',
          steps: [
            { num: 1, text: '对每个位置 pos 和每一维 i，分别使用 sin 与 cos 函数进行编码。' },
            { num: 2, text: '不同维度使用不同频率：低维频率高，高维频率低，覆盖不同尺度的位置关系。' },
            { num: 3, text: '将位置编码与词嵌入按位相加，注入到编码器/解码器底部。' },
            { num: 4, text: '由于 sin(a+b)、cos(a+b) 可由 sin a、cos a 线性表示，模型可轻易学到相对位置关系。' }
          ],
          variables: [
            { symbol: 'pos', desc: 'token 在序列中的位置 (0, 1, 2, ...)' },
            { symbol: 'i', desc: '维度索引' },
            { symbol: 'd_model', desc: '模型隐层维度，Base 模型为 512' },
            { symbol: '10000', desc: '控制频率衰减的基数' }
          ],
          meaning:
            '在没有任何循环/卷积的情况下，向自注意力网络注入序列顺序信息。' +
            '正弦形式使模型具备向更长序列外推的潜力，并天然编码相对位置。',
          related: ['attention']
        }
      },

      translations: [
        {
          en: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder.',
          zh: '主流的序列转换模型都是基于复杂的循环或卷积神经网络构建的，这些网络通常包含编码器和解码器。'
        },
        {
          en: 'We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.',
          zh: '我们提出一种全新的简单网络架构 Transformer，它完全基于注意力机制，彻底摒弃了循环和卷积。'
        },
        {
          en: 'An attention function can be described as mapping a query and a set of key-value pairs to an output.',
          zh: '注意力函数可以被描述为：将一个查询以及一组键值对映射为一个输出。'
        },
        {
          en: 'Multi-head attention allows the model to jointly attend to information from different representation subspaces at different positions.',
          zh: '多头注意力使模型能够在不同位置上，共同关注来自不同表示子空间的信息。'
        },
        {
          en: 'Since our model contains no recurrence and no convolution, we must inject some information about the position of tokens in the sequence.',
          zh: '由于我们的模型既没有循环也没有卷积，因此必须向其中注入 token 在序列中位置的相关信息。'
        },
        {
          en: 'The Transformer allows for significantly more parallelization and can reach a new state of the art after being trained for as little as twelve hours on eight P100 GPUs.',
          zh: 'Transformer 允许进行显著更高程度的并行计算，仅需在 8 块 P100 GPU 上训练 12 小时，即可达到新的 SOTA。'
        }
      ]
    },

    // ============================================================
    // 论文 2：BERT
    // ============================================================
    p2: {
      id: 'p2',
      title: 'BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding',
      authors: 'Jacob Devlin et al.',
      venue: 'NAACL 2019',
      year: 2019,
      ccf: 'A',
      citations: '65,200+',
      keywords: ['NLP', '预训练', 'BERT', '双向 Transformer', '微调'],
      abstract:
        '本文提出 BERT（Bidirectional Encoder Representations from Transformers），' +
        '一种通过掩码语言模型（Masked Language Model, MLM）和下一句预测（Next Sentence Prediction, NSP）' +
        '进行深度双向预训练的语言表示模型。与此前单向的 GPT 不同，BERT 在所有层中联合左右上下文，' +
        '仅需一个额外输出层即可在 11 项 NLP 任务上取得 SOTA，包括 GLUE（80.5%）、SQuAD v1.1（F1 88.5）和 MNLI（86.7%）。',

      ai: {
        oneLineSummary:
          '用掩码语言模型预训练出深度双向 Transformer 编码器，开启 NLP "预训练-微调" 范式。',
        contributions: [
          '提出基于 MLM 的双向预训练任务，克服了 GPT 等单向语言模型无法同时看到左右文的限制。',
          '引入下一句预测（NSP）任务，使模型学习句子间关系，显著提升问答和自然语言推理任务。',
          '统一了不同任务的输入表示（<[BOS_never_used_51bce0c785ca2f68081bfa7d91973934]>、[SEP]、段嵌入、位置嵌入），让同一份预训练模型可快速适配多种下游任务。',
          '在 GLUE、SQuAD v1.1/v2.0、MNLI、SWAG 等 11 项基准上全部取得 SOTA。',
          '开源 BERT Base / Large 两种规模模型，推动整个 NLP 社区进入"预训练 + 微调"时代。'
        ],
        dataCards: [
          { value: '80.5%', label: 'GLUE 平均分' },
          { value: '88.5', label: 'SQuAD v1.1 F1' },
          { value: '86.7%', label: 'MNLI 准确率' },
          { value: '340M', label: 'BERT Large 参数量' }
        ],
        readingTip:
          '重点对比 BERT 与 OpenAI GPT、ELMo 的架构差异（双向 vs 单向 vs 浅层拼接）；' +
          '阅读 3.1 节时弄清 MLM 中 [MASK] 与非掩码 token 的训练比例（80/10/10）；' +
          '结合 4 节实验表格理解为什么 NSP 和双向性在句子级任务上效果显著。',
        comparisonTable: {
          headers: ['模型', '架构', '预训练任务', '参数量', 'GLUE'],
          rows: [
            { values: ['ELMo', '双向 LSTM 拼接', '双向 LM (浅层)', '93M', '71.7'], highlight: false },
            { values: ['OpenAI GPT', '单向 Transformer 解码器', '从左到右 LM', '110M', '72.8'], highlight: false },
            { values: ['BERT Base', '双向 Transformer 编码器', 'MLM + NSP', '110M', '82.3'], highlight: false },
            { values: ['BERT Large', '双向 Transformer 编码器', 'MLM + NSP', '340M', '80.5 (test)'], highlight: true }
          ]
        },
        experimentTable: {
          headers: ['任务 / 数据集', '指标', '此前 SOTA', 'BERT', '提升'],
          rows: [
            { values: ['GLUE 基准', 'Avg', '—', '80.5', '+7.7'] },
            { values: ['MNLI', 'Acc', '86.7 (BERT Large)', '86.7', '持平'] },
            { values: ['SQuAD v1.1', 'F1', '86.0 (ELMo+MT)', '88.5', '+2.5'] },
            { values: ['SQuAD v2.0', 'F1', '—', '86.7', 'SOTA'] },
            { values: ['SWAG', 'Acc', '—', '86.3', '+2.6'] }
          ]
        },
        ablationBars: [
          { label: '无 NSP', value: 80, display: '79.8 GLUE' },
          { label: '单向 LTR', value: 70, display: '75.1 GLUE' },
          { label: '仅 NSP', value: 75, display: '77.2 GLUE' },
          { label: 'BERT Base (MLM+NSP)', value: 90, display: '82.3 GLUE' },
          { label: 'BERT Large (MLM+NSP)', value: 98, display: '80.5 (test) / 86.7 MNLI' }
        ],
        suggestedQuestions: [
          'MLM 相比传统从左到右语言模型有什么优势？',
          '为什么要在预训练中加入 NSP 任务？它对哪些下游任务有帮助？',
          'BERT 的输入表示由哪些部分构成？<[BOS_never_used_51bce0c785ca2f68081bfa7d91973934]>、[SEP] 各自的作用？',
          'BERT Base 与 BERT Large 的层数、隐层维度、注意力头数分别是多少？',
          'BERT 与 GPT、ELMo 在架构和训练目标上有什么本质区别？'
        ]
      },

      sections: [
        {
          id: 'abstract',
          title: 'Abstract',
          level: 2,
          content: [
            {
              type: 'p',
              text:
                'We introduce a new language representation model called BERT, which stands for Bidirectional Encoder Representations from Transformers. Unlike recent language representation models, BERT is designed to pre-train deep bidirectional representations from unlabeled text by jointly conditioning on both left and right context in all layers.'
            },
            {
              type: 'p',
              text:
                'As a result, the pre-trained BERT model can be fine-tuned with just one additional output layer to create state-of-the-art models for a wide range of tasks, such as question answering and language inference, without substantial task-specific architecture modifications.'
            },
            {
              type: 'p',
              text:
                'BERT is conceptually simple and empirically powerful. It obtains new state-of-the-art results on eleven natural language processing tasks, including pushing the GLUE score to 80.5%, MultiNLI accuracy to 86.7%, SQuAD v1.1 question answering Test F1 to 93.2 and SQuAD v2.0 Test F1 to 83.1.'
            }
          ]
        },
        {
          id: 'intro',
          title: '1. Introduction',
          level: 2,
          content: [
            {
              type: 'p',
              text:
                'Language model pre-training has been shown to be effective for improving many natural language processing tasks. These include sentence-level tasks such as natural language inference and paraphrasing, which aim to predict the relationships between sentences, as well as token-level tasks such as named entity recognition and question answering, where models are required to produce fine-grained output at the token level.'
            },
            {
              type: 'p',
              text:
                'There are two existing strategies for applying pre-trained language representations to downstream tasks: feature-based and fine-tuning. The feature-based approach, such as ELMo, uses task-specific architectures that include the pre-trained representations as additional features. The fine-tuning approach, such as the Generative Pre-trained Transformer (OpenAI GPT), introduces minimal task-specific parameters and is trained on the downstream tasks by simply fine-tuning all pre-trained parameters.'
            },
            {
              type: 'p',
              text:
                'We argue that current techniques restrict the power of the pre-trained representations, especially for the fine-tuning approaches. The major limitation is that standard language models are unidirectional, and this limits the architectures that can be used during pre-training. For example, in OpenAI GPT, the left-to-right architecture means every token can only attend to previous tokens, which is sub-optimal for sentence-level tasks and can be very harmful when applying token-level approaches such as question answering.'
            },
            {
              type: 'p',
              text:
                'In this paper, we improve the fine-tuning based approaches by proposing BERT: Bidirectional Encoder Representations from Transformers. BERT alleviates the previously mentioned unidirectionality constraint by using a "masked language model" (MLM) pre-training objective. The masked language model randomly masks some of the tokens from the input, and the objective is to predict the original vocabulary id of the masked word based only on its context.'
            },
            {
              type: 'p',
              text:
                'In addition to the masked language model, we also use a "next sentence prediction" task that jointly pre-trains text-pair representations. We show that BERT is conceptually simple and empirically powerful, obtaining new state-of-the-art results on eleven NLP tasks.'
            }
          ]
        },
        {
          id: 'related',
          title: '2. Related Work',
          level: 2,
          content: [
            {
              type: 'p',
              text:
                'There is a long history of pre-training general language representations, and we briefly review the most widely-used approaches in this section.'
            },
            {
              type: 'p',
              text:
                'Unsupervised feature-based approaches include ELMo, which uses a bidirectional LSTM trained on a language modeling objective. ELMo extracts contextual features from multiple layers and concatenates them for downstream tasks. However, ELMo is a "shallow" concatenation of independently trained left-to-right and right-to-left LSTMs rather than a truly deep bidirectional model.'
            },
            {
              type: 'p',
              text:
                'Unsupervised fine-tuning approaches include ULMFiT and OpenAI GPT. These models pre-train a unidirectional language model on a large text corpus, then fine-tune the same parameters on downstream tasks. The left-to-right constraint still prevents these models from fully exploiting bidirectional context.'
            },
            {
              type: 'p',
              text:
                'Supervised data-transfer learning has also been shown effective, e.g. using large-scale natural language inference datasets for sentence representation. Our work shows that unsupervised bidirectional pre-training can be even more powerful and broadly applicable.'
            }
          ]
        },
        {
          id: 'bert',
          title: '3. BERT',
          level: 2,
          content: [
            {
              type: 'p',
              text:
                'We introduce BERT and its detailed implementation in this section. There are two steps in our framework: pre-training and fine-tuning. During pre-training, the model is trained on unlabeled data over different pre-training tasks. For fine-tuning, the BERT model is first initialized with the pre-trained parameters, and all of the parameters are fine-tuned using labeled data from the downstream tasks.'
            },
            {
              type: 'p',
              text:
                'A key feature of BERT is its unified architecture across different tasks. There is minimal difference between the architecture for pre-training and the architecture for the final downstream tasks. The model architecture is a multi-layer bidirectional Transformer encoder, exactly as described in Vaswani et al. (2017). We implement two model sizes: BERT Base (L=12, H=768, A=12, total parameters 110M) and BERT Large (L=24, H=1024, A=16, total parameters 340M).'
            }
          ]
        },
        {
          id: 'pretrain',
          title: '3.1 Pre-training BERT',
          level: 3,
          content: [
            {
              type: 'p',
              text:
                'The first pre-training task is Masked Language Model (MLM). Intuitively, it is reasonable to believe that a deep bidirectional model is strictly more powerful than either a left-to-right model or the shallow concatenation of a left-to-right and a right-to-left model. Unfortunately, standard conditional language models can only be trained left-to-right or right-to-left, since bidirectional conditioning would allow each word to indirectly "see itself" across layers.'
            },
            {
              type: 'p',
              text:
                'In order to train a deep bidirectional representation, we simply mask some percentage of the input tokens at random, and then predict those masked tokens. We refer to this procedure as a "masked LM" (MLM). In our experiments, we mask 15% of all WordPiece tokens at random. The final hidden vectors corresponding to the mask tokens are fed into an output softmax over the vocabulary, as in a standard language model.'
            },
            {
              type: 'p',
              text:
                'Although this allows us to obtain a bidirectional pre-trained model, a downside is that we are creating a mismatch between pre-training and fine-tuning, since the [MASK] token does not appear during fine-tuning. To mitigate this, we do not always replace "masked" words with the actual [MASK] token. The training data generator chooses 15% of tokens and: 80% of the time replaces with [MASK]; 10% of the time replaces with a random token; 10% of the time keeps the original token unchanged.'
            },
            { type: 'formula', ref: 'mlm', display: 'L_MLM = -∑ log P(x_masked | x_unmasked)' },
            {
              type: 'p',
              text:
                'The second pre-training task is Next Sentence Prediction (NSP). Many important downstream tasks such as Question Answering and Natural Language Inference are based on understanding the relationship between two sentences, which is not directly captured by language modeling. In order to train a model that understands sentence relationships, we pre-train for a binarized next sentence prediction task that can be trivially generated from any monolingual corpus. Specifically, when choosing the sentences A and B for each pre-training example, 50% of the time B is the actual next sentence that follows A, and 50% of the time it is a random sentence from the corpus.'
            },
            { type: 'formula', ref: 'nsp', display: 'L_NSP = -∑ log P(IsNext | A, B)' },
            {
              type: 'p',
              text:
                'For input representation, we use a token sequence that can unambiguously represent both a single sentence and a pair of sentences in one token sequence. We use WordPiece embeddings with a 30,000 token vocabulary. The first token of every sequence is always a special classification token <[BOS_never_used_51bce0c785ca2f68081bfa7d91973934]>, whose final hidden state is used as the aggregate sequence representation for classification. Sentence pairs are separated by a special [SEP] token, and we add learned segment embeddings A/B to indicate which sentence each token belongs to.'
            }
          ]
        },
        {
          id: 'finetune',
          title: '3.2 Fine-tuning BERT',
          level: 3,
          content: [
            {
              type: 'p',
              text:
                'For sequence-level classification tasks, such as MNLI or SST-2, we take the final hidden state of the first token <[BOS_never_used_51bce0c785ca2f68081bfa7d91973934]> as the representation of the entire sequence, and add a classification layer on top. The model is fine-tuned end-to-end with cross-entropy loss.'
            },
            {
              type: 'p',
              text:
                'For token-level tasks such as NER and SQuAD question answering, we feed the final hidden vectors of tokens into a task-specific output layer. For example, in SQuAD, we predict the start and end position of the answer span by applying two learnable vectors to each token\'s final hidden state. Because only a few parameters need to be added, fine-tuning is typically inexpensive compared to pre-training.'
            }
          ]
        },
        {
          id: 'experiments',
          title: '4. Experiments',
          level: 2,
          content: [
            {
              type: 'p',
              text:
                'We present BERT results on 11 NLP tasks. On the GLUE benchmark, BERT Large achieves a score of 80.5, a 7.7 point absolute improvement over the previous state of the art. On MultiNLI, BERT Large obtains 86.7% accuracy, a 4.6% absolute improvement. On SQuAD v1.1, BERT Large achieves an F1 score of 93.2, and on SQuAD v2.0 it obtains F1 = 83.1.'
            },
            {
              type: 'p',
              text:
                'Notably, BERT Large outperforms BERT Base across all tasks in a consistent manner, confirming that scaling the model brings reliable gains when combined with bidirectional pre-training. The models are fine-tuned for typically 2-4 epochs with very small hyperparameter search, in contrast to the elaborate task-specific architectures used in prior work.'
            }
          ]
        },
        {
          id: 'ablation',
          title: '5. Ablation Studies',
          level: 2,
          content: [
            {
              type: 'p',
              text:
                'We perform a number of ablation studies to understand the effect of each component of BERT. We find that MLM is crucial: removing bidirectional attention (i.e. training a left-to-right model) hurts performance significantly on token-level tasks, especially SQuAD.'
            },
            {
              type: 'p',
              text:
                'We also find that NSP brings consistent improvement on cross-sentence tasks such as QQP, MNLI and SQuAD v2.0. Removing NSP leads to drops in these tasks but has little impact on single-sentence tasks such as CoLA and SST-2. Model size ablations confirm that larger models provide steady improvements across all four selected tasks, even when the downstream datasets are very small.'
            }
          ]
        },
        {
          id: 'conclusion',
          title: '6. Conclusion',
          level: 2,
          content: [
            {
              type: 'p',
              text:
                'We have presented BERT, a simple and powerful new model for language representation that uses deep bidirectional pre-training. With the MLM and NSP pre-training objectives, BERT learns rich contextual representations that require only a small additional output layer and a short fine-tuning period to achieve state-of-the-art results on a wide range of NLP tasks.'
            },
            {
              type: 'p',
              text:
                'We release both BERT Base and BERT Large along with the code and pre-trained checkpoints, which we hope will be a useful foundation for the community. Recent contributions have shown that BERT can be successfully adapted to multilingual modeling, text summarization, information retrieval and other applications, and we expect bidirectional pre-training to remain a cornerstone of NLP research.'
            }
          ]
        }
      ],

      formulas: {
        mlm: {
          title: '掩码语言模型损失 (Masked LM Loss)',
          latex:
            '\\mathcal{L}_{\\mathrm{MLM}}=-\\sum_{\\tilde{x}\\in\\mathcal{M}}\\log P\\!\\left(\\tilde{x}\\mid x_{\\backslash\\mathcal{M}};\\theta\\right)',
          steps: [
            { num: 1, text: '随机选择输入中约 15% 的 token 作为被掩码集合 M。' },
            { num: 2, text: '按 80%/10%/10% 的比例将这些 token 分别替换为 [MASK]、随机 token、保留原 token。' },
            { num: 3, text: '将这些位置的最终隐向量送入输出 softmax，预测原始 token id。' },
            { num: 4, text: '对所有被掩码位置的交叉熵求和，作为 MLM 损失。' }
          ],
          variables: [
            { symbol: 'M', desc: '被随机掩码的位置集合' },
            { symbol: 'x̃', desc: '原始被掩码 token' },
            { symbol: 'x_{\\M}', desc: '未被掩码的上下文 token' },
            { symbol: 'θ', desc: 'BERT 模型参数' },
            { symbol: '15%', desc: '每序列中被掩码 token 的比例' }
          ],
          meaning:
            'MLM 通过让模型利用左右两侧上下文还原被遮挡词，迫使每一层都学习真正的双向表示。' +
            '80/10/10 的替换策略缓解了预训练与微调之间 <[BOS_never_used_51bce0c785ca2f68081bfa7d91973934]> 与真实 token 分布不一致的问题。',
          related: ['nsp']
        },
        nsp: {
          title: '下一句预测损失 (Next Sentence Prediction Loss)',
          latex:
            '\\mathcal{L}_{\\mathrm{NSP}}=-\\left[y\\log \\hat{y}+(1-y)\\log(1-\\hat{y})\\right]',
          steps: [
            { num: 1, text: '对每个训练样本构造句子对 (A, B)，其中 50% 的 B 是 A 的真实下一句，50% 是语料中随机抽取的句子。' },
            { num: 2, text: '用 <[BOS_never_used_51bce0c785ca2f68081bfa7d91973934]> 位置的最终隐向量预测二分类标签 IsNext / NotNext。' },
            { num: 3, text: '用二元交叉熵计算损失，与 MLM 损失相加作为总预训练目标。' }
          ],
          variables: [
            { symbol: 'y', desc: '真实标签 (1 表示 B 是 A 的下一句，0 表示不是)' },
            { symbol: 'ŷ', desc: '模型预测的 IsNext 概率' },
            { symbol: '<[BOS_never_used_51bce0c785ca2f68081bfa7d91973934]>', desc: '用于聚合整句对表示的特殊 token' },
            { symbol: '[SEP]', desc: '分隔两个句子的特殊 token' }
          ],
          meaning:
            'NSP 让 BERT 在预训练阶段就学习句子间的语义关系，从而更好地服务于问答、自然语言推理等句子对任务。' +
            '后续工作（如 RoBERTa）对其有效性有争议，但在 BERT 原论文中它带来了稳定收益。',
          related: ['mlm']
        }
      },

      translations: [
        {
          en: 'We introduce a new language representation model called BERT, which stands for Bidirectional Encoder Representations from Transformers.',
          zh: '我们提出一种新的语言表示模型 BERT，其全称为"来自 Transformer 的双向编码器表示"。'
        },
        {
          en: 'BERT is designed to pre-train deep bidirectional representations from unlabeled text by jointly conditioning on both left and right context in all layers.',
          zh: 'BERT 旨在从未标注文本中预训练深度双向表示，方法是在所有层中同时利用左侧和右侧上下文。'
        },
        {
          en: 'The masked language model randomly masks some of the tokens from the input, and the objective is to predict the original vocabulary id of the masked word based only on its context.',
          zh: '掩码语言模型随机遮蔽输入中的部分 token，目标是仅根据上下文预测被遮蔽词在词表中的原始 id。'
        },
        {
          en: 'We also use a "next sentence prediction" task that jointly pre-trains text-pair representations.',
          zh: '我们还使用"下一句预测"任务，联合预训练文本对的表示。'
        },
        {
          en: 'The first token of every sequence is always a special classification token <[BOS_never_used_51bce0c785ca2f68081bfa7d91973934]>.',
          zh: '每个序列的第一个 token 始终是一个特殊的分类标记 <[BOS_never_used_51bce0c785ca2f68081bfa7d91973934]>。'
        },
        {
          en: 'BERT obtains new state-of-the-art results on eleven natural language processing tasks.',
          zh: 'BERT 在 11 项自然语言处理任务上取得了新的 SOTA 结果。'
        }
      ]
    },

    // ============================================================
    // 论文 3：Deep Residual Learning (ResNet)
    // ============================================================
    p19: {
      id: 'p19',
      title: 'Deep Residual Learning for Image Recognition',
      authors: 'Kaiming He et al.',
      venue: 'CVPR 2016',
      year: 2016,
      ccf: 'A',
      citations: '178,000+',
      keywords: ['CV', '深度学习', '残差网络', 'ImageNet', 'CNN'],
      abstract:
        '本文针对深度神经网络"层数越深越难训练"的退化问题，提出残差学习框架（Residual Learning）。' +
        '在堆叠的非线性层中，不显式拟合目标映射 H(x)，而是拟合残差 F(x) = H(x) − x，再通过快捷恒等映射（shortcut / skip connection）得到 H(x) = F(x) + x。' +
        '残差网络使上百甚至上千层网络易于优化，并在 ImageNet 上将 152 层网络的 top-5 错误率降至 3.57%，赢得 ILSVRC 2015 分类任务冠军，并深刻影响了此后几乎所有深度模型的设计。',

      ai: {
        oneLineSummary:
          '用残差连接 F(x)+x 解决深层网络退化问题，使上百层网络可训练并横扫 ImageNet。',
        contributions: [
          '揭示并实证了"深层网络退化"现象：层数增加后训练误差反而上升，且并非由梯度消失导致。',
          '提出残差学习：让堆叠层拟合残差 F(x) = H(x) − x，再用恒等 shortcut 连接回输入。',
          '证明残差网络在 ImageNet、CIFAR-10 上都更容易优化，且深度增加时精度持续提升。',
          '在 ImageNet 上用 152 层 ResNet 取得 3.57% top-5 错误率，赢得 ILSVRC 2015 分类冠军。',
          '把残差块作为即插即用的模块推广到目标检测、语义分割等任务，深度影响后续网络设计。'
        ],
        dataCards: [
          { value: '3.57%', label: 'ImageNet top-5 错误率' },
          { value: '152', label: '网络层数' },
          { value: '8×', label: '比 VGG 深的倍数' },
          { value: '1st', label: 'ILSVRC 2015 冠军' }
        ],
        readingTip:
          '先看图 1 的退化现象，理解为什么"更深但不是过拟合"；再读 2.1 节残差公式，' +
          '思考 F(x)+x 为什么让优化更简单；最后对照 Table 1、Table 2 看 plain 网络与 residual 网络在 ImageNet/CIFAR 上的对比。',
        comparisonTable: {
          headers: ['网络', '层数', '核心结构', 'Top-1 错误率', 'Top-5 错误率'],
          rows: [
            { values: ['VGG-19', '19', '纯卷积堆叠', '28.7%', '9.99%'], highlight: false },
            { values: ['Plain-34', '34', '无残差连接', '27.7%', '9.17%'], highlight: false },
            { values: ['ResNet-18', '18', '残差块', '27.9%', '9.05%'], highlight: false },
            { values: ['ResNet-34', '34', '残差块', '24.5%', '7.46%'], highlight: false },
            { values: ['ResNet-152', '152', '瓶颈残差块', '19.4%', '4.49%'], highlight: true },
            { values: ['ResNet (集成)', '—', '多模型集成', '—', '3.57%'], highlight: true }
          ]
        },
        experimentTable: {
          headers: ['数据集 / 任务', '指标', '基线', 'ResNet', '提升'],
          rows: [
            { values: ['ImageNet 分类 (single)', 'top-5 err', 'VGG 9.99%', '4.49%', '−5.5%'] },
            { values: ['ImageNet 分类 (ensemble)', 'top-5 err', 'GoogLeNet 6.67%', '3.57%', '−3.1%'] },
            { values: ['CIFAR-10', 'error', 'plain 13.6%', '6.43% (1202 层)', '~2×'] },
            { values: ['COCO 目标检测 (Faster R-CNN)', 'mAP@[.5,.95]', '28.9', '34.9', '+6.0'] },
            { values: ['ILSVRC 2015', '1st place', '—', '冠军', '—'] }
          ]
        },
        ablationBars: [
          { label: 'Plain-18', value: 60, display: '9.05% top-5' },
          { label: 'Plain-34 (退化)', value: 55, display: '9.17% top-5' },
          { label: 'ResNet-18', value: 70, display: '9.05% top-5' },
          { label: 'ResNet-34', value: 82, display: '7.46% top-5' },
          { label: 'ResNet-152', value: 95, display: '4.49% top-5' }
        ],
        suggestedQuestions: [
          '什么是"退化现象"？为什么深层网络的训练误差会比浅层更高？',
          '残差映射 F(x) = H(x) − x 相比直接学习 H(x) 为什么更容易优化？',
          '恒等 shortcut 与投影 shortcut 有什么区别？分别在什么情况下使用？',
          'ResNet 为什么可以训练上千层？它解决了梯度消失问题吗？',
          '瓶颈结构（1×1-3×3-1×1）为什么能在加深网络时控制计算量？'
        ]
      },

      sections: [
        {
          id: 'abstract',
          title: 'Abstract',
          level: 2,
          content: [
            {
              type: 'p',
              text:
                'Deeper neural networks are more difficult to train. We present a residual learning framework to ease the training of networks that are substantially deeper than those used previously. We explicitly reformulate the layers as learning residual functions with reference to the layer inputs, instead of learning unreferenced functions.'
            },
            {
              type: 'p',
              text:
                'We provide comprehensive empirical evidence showing that these residual networks are easier to optimize, and can gain accuracy from considerably increased depth. On the ImageNet dataset we evaluate residual nets with a depth of up to 152 layers—8× deeper than VGG nets but still having lower complexity. An ensemble of these residual nets achieves 3.57% error on the ImageNet test set.'
            },
            {
              type: 'p',
              text:
                'This result won the 1st place on the ILSVRC 2015 classification task. We also present analysis on CIFAR-10 with 100 and 1000 layers. The depth of representations is of central importance for many visual recognition tasks. Solely due to our extremely deep representations, we obtain a 28% relative improvement on the COCO object detection dataset.'
            }
          ]
        },
        {
          id: 'intro',
          title: '1. Introduction',
          level: 2,
          content: [
            {
              type: 'p',
              text:
                'Deep convolutional neural networks have led to a series of breakthroughs for image classification. Deep networks naturally integrate low/mid/high-level features and classifiers in an end-to-end multilayer fashion, and the "levels" of features can be enriched by the number of stacked layers (depth).'
            },
            {
              type: 'p',
              text:
                'Driven by the significance of network depth, a question arises: Is learning better networks as easy as stacking more layers? An obstacle to answering this question was the notorious problem of vanishing/exploding gradients, which hamper convergence from the beginning. This problem, however, has been largely addressed by normalized initialization and intermediate normalization layers, which enable networks with tens of layers to start converging for stochastic gradient descent (SGD) with backpropagation.'
            },
            {
              type: 'p',
              text:
                'When deeper networks are able to start converging, a degradation problem has been exposed: with the network depth increasing, accuracy gets saturated (which might be unsurprising) and then degrades rapidly. Unexpectedly, such degradation is not caused by overfitting, and adding more layers to a suitably deep model leads to higher training error. Figure 1 shows a typical example.'
            },
            {
              type: 'p',
              text:
                'The degradation problem indicates that not all systems are similarly easy to optimize. To address it, we introduce a "deep residual learning" framework. Rather than expecting every few stacked layers to directly fit a desired underlying mapping, we explicitly let these layers fit a residual mapping. Formally, denoting the desired underlying mapping as H(x), we let the stacked nonlinear layers fit another mapping of F(x) = H(x) − x. The original mapping is then recast into F(x) + x.'
            },
            {
              type: 'p',
              text:
                'We hypothesize that it is easier to optimize the residual mapping than to optimize the original, unreferenced mapping. To the extreme, if an identity mapping were optimal, it would be easier to push the residual to zero than to fit an identity mapping by a stack of nonlinear layers.'
            }
          ]
        },
        {
          id: 'residual-learning',
          title: '2. Deep Residual Learning',
          level: 2,
          content: [
            {
              type: 'p',
              text:
                'Let us consider H(x) as an underlying mapping to be fit by a few stacked layers (not necessarily the entire network), with x denoting the inputs to the first of these layers. If one hypothesizes that multiple nonlinear layers can asymptotically approximate complicated functions, then it is equivalent to hypothesizing that they can asymptotically approximate the residual functions, i.e., H(x) − x (assuming that the input and output are of the same dimensions).'
            }
          ]
        },
        {
          id: 'residual-repr',
          title: '2.1 Residual Representation',
          level: 3,
          content: [
            {
              type: 'p',
              text:
                'Rather than expecting each stack of layers to fit H(x), we explicitly let these layers fit a residual function F(x) = H(x) − x. So the expected function becomes F(x) + x. Although both forms should be able to asymptotically approximate the desired functions, the ease of learning might differ.'
            },
            {
              type: 'p',
              text:
                'This reformulation is motivated by the counterintuitive phenomena about the degradation problem. As discussed in the introduction, if the added layers can be constructed as identity mappings, the training error of a deeper model should not be greater than its shallower counterpart. The degradation problem suggests that the solvers might have difficulties in approximating identity mappings by multiple nonlinear layers. With the residual learning reformulation, if identity mappings are optimal, the solver may simply drive the weights of the multiple nonlinear layers toward zero to approach identity mappings.'
            },
            { type: 'formula', ref: 'residual', display: 'y = F(x, {W_i}) + x' }
          ]
        },
        {
          id: 'identity',
          title: '2.2 Identity Mapping by Shortcuts',
          level: 3,
          content: [
            {
              type: 'p',
              text:
                'We adopt residual learning to every few stacked layers. A building block is shown in Figure 2. Formally, a building block is defined as y = F(x, {W_i}) + x, where x and y are the input and output vectors of the layers considered. The function F(x, {W_i}) is the residual mapping to be learned.'
            },
            {
              type: 'p',
              text:
                'The operation F + x is performed by a shortcut connection and element-wise addition. This shortcut connection neither introduces extra parameter nor computation complexity, which is not only attractive in practice but also important for us to compare plain and residual networks fairly. The dimensions of x and F must be equal. If this is not the case, we can perform a linear projection W_s by the shortcut connections to match dimensions: y = F(x, {W_i}) + W_s x.'
            },
            {
              type: 'p',
              text:
                'The residual function F can take a flexible form. To simplify notation, the examples in this paper involve two or three layers, but more layers are possible. If F has only a single layer, the equation is similar to a plain layer y = W_1 x + x, for which we have not observed advantages.'
            }
          ]
        },
        {
          id: 'architectures',
          title: '2.3 Network Architectures',
          level: 3,
          content: [
            {
              type: 'p',
              text:
                'We test plain and residual networks of various depths, mainly based on the VGG-style philosophy. Our plain networks follow two simple design rules: (i) for the same output feature map size, the layers have the same number of filters; (ii) if the feature map size is halved, the number of filters is doubled so as to preserve the time complexity per layer. We perform downsampling directly by convolutional layers that have a stride of 2.'
            },
            {
              type: 'p',
              text:
                'For ResNet, we then insert shortcut connections which turn the plain network into its counterpart. When the input and output are of the same dimensions, the identity shortcut can be directly used. When the dimensions increase, we consider two options: (A) still perform identity mapping with extra zero entries padded for increasing dimensions, and (B) use projection shortcuts to match dimensions (done by 1×1 convolutions). We show that both options are comparably effective, while identity shortcuts are particularly important for very deep networks.'
            },
            {
              type: 'p',
              text:
                'For ResNet-50/101/152 we adopt a "bottleneck" building block: for each residual function F, we use a stack of three layers (1×1, 3×3, 1×1). The 1×1 layers are responsible for reducing and then increasing dimensions, leaving the 3×3 layer a bottleneck with smaller input/output dimensions, reducing computation while preserving accuracy.'
            }
          ]
        },
        {
          id: 'imagenet',
          title: '3. Experiments — ImageNet Classification',
          level: 3,
          content: [
            {
              type: 'p',
              text:
                'We conduct our experiments on the ImageNet 2012 classification dataset, which consists of 1000 classes and is split into 1.28 million training images, 50k validation images and 100k test images. We evaluate top-1 and top-5 error rates. Training follows the standard practice of random cropping and horizontal flipping, and uses SGD with a mini-batch size of 256.'
            },
            {
              type: 'p',
              text:
                'Plain networks show the degradation problem: the 34-layer plain net has higher training error than the 18-layer plain net throughout training. In contrast, the 34-layer residual network outperforms the 18-layer residual network, reducing top-1 error by roughly 3.5%. This confirms that the degradation problem is well addressed in this setting, and that additional depth can bring better accuracy.'
            },
            {
              type: 'p',
              text:
                'Bottleneck architectures (ResNet-50/101/152) further improve accuracy with manageable complexity. The 152-layer ResNet achieves a single-model top-5 validation error of 4.49%, and the ensemble achieves 3.57% top-5 test error, winning the 1st place in ILSVRC 2015.'
            }
          ]
        },
        {
          id: 'cifar',
          title: '3.2 CIFAR-10 and Analysis',
          level: 3,
          content: [
            {
              type: 'p',
              text:
                'We conduct further studies on the CIFAR-10 dataset, which consists of 50k training images and 10k test images in 10 classes. We explore networks of depth n = {18, 34, 50, ..., 1202}. The network inputs are 32×32 images, and we follow simple data augmentation commonly used. The residual networks with depth > 100 layers can still converge well and achieve competitive accuracy, whereas their plain counterparts suffer from degradation even with batch normalization.'
            },
            {
              type: 'p',
              text:
                'On CIFAR-10, a 1202-layer ResNet is able to achieve 6.43% error (median of 5 runs), showing no optimization difficulty. Although its test error is slightly higher than the shallower ResNet-110 (likely due to overfitting on the small dataset), the fact that such an extremely deep network can be trained at all demonstrates the strength of the residual framework.'
            }
          ]
        },
        {
          id: 'detection',
          title: '3.3 Object Detection on PASCAL VOC and COCO',
          level: 3,
          content: [
            {
              type: 'p',
              text:
                'Our residual network serves as a backbone for object detection. We plug ResNet-101 into the Faster R-CNN pipeline on PASCAL VOC and COCO. The stronger representation leads to substantial gains: on COCO we obtain a 28% relative improvement over the VGG-16 based counterpart, and on PASCAL VOC 2007 test we achieve mAP 73.8.'
            }
          ]
        },
        {
          id: 'conclusion',
          title: '4. Conclusion',
          level: 2,
          content: [
            {
              type: 'p',
              text:
                'We have presented deep residual learning for training substantially deeper networks that are easier to optimize. The key behavior is that residual networks avoid the degradation problem, and gain accuracy from greatly increased depth, producing substantially better results on ImageNet and a wide variety of downstream tasks.'
            },
            {
              type: 'p',
              text:
                'The residual principle suggests that many solvers that function well for shallow networks may not be the optimal choice when networks become deeper. Identity mappings, shortcut connections and residual reformulations provide a simple yet powerful inductive bias that has since become a standard building block for deep neural networks.'
            }
          ]
        }
      ],

      formulas: {
        residual: {
          title: '残差块 (Residual Block)',
          latex:
            '\\mathbf{y}=\\mathcal{F}(\\mathbf{x},\\{W_i\\})+\\mathbf{x},\\qquad \\mathcal{F}(\\mathbf{x},\\{W_i\\})=W_2\\,\\sigma(W_1\\mathbf{x})',
          steps: [
            { num: 1, text: '输入 x 经过两层（或多层）带激活函数的卷积，得到残差特征 F(x)。' },
            { num: 2, text: '通过 shortcut 把原始输入 x 直接传到残差块输出端。' },
            { num: 3, text: '对 F(x) 与 x 做逐元素相加，得到 y = F(x) + x。' },
            { num: 4, text: '如维度不一致，使用 1×1 卷积 W_s 对 x 做投影后再相加。' },
            { num: 5, text: '对相加后的 y 再施加激活函数（如 ReLU），作为下一层的输入。' }
          ],
          variables: [
            { symbol: 'x', desc: '残差块输入特征图' },
            { symbol: 'y', desc: '残差块输出特征图' },
            { symbol: 'F', desc: '由堆叠卷积层学习到的残差映射 H(x) − x' },
            { symbol: 'W_1, W_2', desc: '残差块中两层卷积的权重' },
            { symbol: 'W_s', desc: '当维度不匹配时使用的线性投影矩阵' }
          ],
          meaning:
            '残差公式把"直接学习 H(x)"转化为"学习残差 F(x) = H(x) − x"。当网络已经足够好时，' +
            '最优解接近恒等映射，此时只需把 F(x) 推向 0 即可，比把一堆非线性层学成恒等映射容易得多。' +
            'shortcut 还提供了近恒等的梯度通路，显著缓解深层网络退化。',
          related: []
        }
      },

      translations: [
        {
          en: 'Deeper neural networks are more difficult to train.',
          zh: '更深的神经网络更难训练。'
        },
        {
          en: 'We present a residual learning framework to ease the training of networks that are substantially deeper than those used previously.',
          zh: '我们提出一种残差学习框架，以简化比以往深得多的网络的训练。'
        },
        {
          en: 'When the network depth increases, accuracy gets saturated and then degrades rapidly. This degradation is not caused by overfitting.',
          zh: '当网络深度增加时，精度会先达到饱和，然后迅速下降。这种退化并不是由过拟合导致的。'
        },
        {
          en: 'We explicitly let these stacked layers fit a residual mapping F(x) = H(x) − x, rather than directly fit H(x).',
          zh: '我们显式地让这些堆叠层拟合残差映射 F(x) = H(x) − x，而不是直接拟合 H(x)。'
        },
        {
          en: 'The shortcut connection F + x neither introduces extra parameters nor computational complexity.',
          zh: 'F + x 这条 shortcut 连接既不引入额外参数，也不增加计算复杂度。'
        },
        {
          en: 'An ensemble of these residual nets achieves 3.57% error on the ImageNet test set and won the 1st place on ILSVRC 2015.',
          zh: '这些残差网络的集成在 ImageNet 测试集上达到 3.57% 的错误率，赢得了 ILSVRC 2015 的第一名。'
        }
      ]
    },

    // ============================================================
    // 论文 4：Generative Adversarial Nets (GAN)
    // ============================================================
    p31: {
      id: 'p31',
      title: 'Generative Adversarial Nets',
      authors: 'Ian J. Goodfellow et al.',
      venue: 'NeurIPS 2014',
      year: 2014,
      ccf: 'A',
      citations: '58,000+',
      keywords: ['ML', '生成模型', 'GAN', '对抗训练', '无监督学习'],
      abstract:
        '本文提出生成对抗网络（GAN）框架：同时训练一个生成模型 G 和一个判别模型 D，' +
        'G 试图从随机噪声中合成以假乱真的样本欺骗 D，D 则判断输入是真实数据还是 G 生成的数据，' +
        '二者构成一个 minimax 博弈。作者证明在足够容量下该博弈存在全局最优解 p_g = p_data，即生成分布与真实数据分布重合。' +
        'GAN 不需要复杂的马尔可夫链或近似推断，仅用反向传播即可训练，在 MNIST、TFD、CIFAR-10 等数据集上展示了优秀的生成效果，开创了生成式 AI 的重要分支。',

      ai: {
        oneLineSummary:
          '用生成器与判别器的 minimax 对抗博弈，让神经网络学习真实数据分布。',
        contributions: [
          '提出 GAN 框架，将生成问题转化为生成器 G 与判别器 D 之间的二人零和博弈。',
          '证明对于固定的最优判别器 D*，训练生成器等价于最小化 p_data 与 p_g 之间的 JS 散度。',
          '给出全局最优性证明：当且仅当 p_g = p_data 时博弈达到均衡，此时 D* 恒等于 1/2。',
          '提出实用的交替训练过程：先 k 步更新 D，再一步更新 G，避免 G 在早期被压制。',
          '在 MNIST、TFD、CIFAR-10 上验证了纯反向传播即可训练生成模型，启发了此后整个 GAN 家族（DCGAN、WGAN、StyleGAN 等）。'
        ],
               dataCards: [
          { value: '0.5', label: '最优判别器输出' },
          { value: '3', label: '实验数据集' },
          { value: '−', label: '无需马尔可夫链' },
          { value: '2014', label: 'GAN 元年' }
        ],
        readingTip:
          '先看懂 Figure 1 中 D 和 G 的博弈示意；再读 4.1、4.2 节两个定理，' +
          '理解最优判别器公式以及全局最优为何对应 JS 散度为 0；最后对照算法 1 把训练流程和实验部分串起来。',
        comparisonTable: {
          headers: ['方法', '训练信号', '是否需要 MCMC', '是否显式 p(x)', 'Parzen 对数似然 (MNIST)'],
          rows: [
            { values: ['DBN', '对比散度 + MCMC', '是', '是', '138 ± 2'], highlight: false },
            { values: ['Stacked CAE', '重构误差', '部分', '否', '210 ± 2'], highlight: false },
            { values: ['Deep GSN', '去噪 + MCMC', '是', '否', '214 ± 1'], highlight: false },
            { values: ['Adversarial nets', '判别器对抗信号', '否', '否', '225 ± 2'], highlight: true }
          ]
        },
        experimentTable: {
          headers: ['数据集', '样本维度', ' ' + '训练 epoch', '评价方式', '结果'],
          rows: [
            { values: ['MNIST', '28×28 灰度', '~100', 'Parzen 窗 log-likelihood', '225 ± 2'] },
            { values: ['TFD (多伦多人脸)', '48×48 灰度', '~200', 'Parzen 窗 log-likelihood', '2057 ± 27'] },
            { values: ['CIFAR-10', '32×32 彩色', '—', 'Parzen 窗 log-likelihood', '3830 ± 30'] },
            { values: ['对比基线 (MNIST DBN)', '28×28', '—', 'Parzen 窗 log-likelihood', '138 ± 2'] }
          ]
        },
        ablationBars: [
          { label: '仅训练 D（无生成器）', value: 20, display: '无法生成样本' },
          { label: 'G 更新过频 / D 过弱', value: 50, display: '模式坍塌风险' },
          { label: '标准交替 (k=1)', value: 80, display: '可生成较清晰样本' },
          { label: 'k 步 D + 1 步 G', value: 92, display: '论文推荐方案' },
          { label: '理论最优 p_g = p_data', value: 100, display: 'D(x) ≡ 1/2' }
        ],
        suggestedQuestions: [
          'GAN 的生成器和判别器各自的目标是什么？为什么是 minimax 博弈？',
          '为什么当判别器最优时，生成器的目标等价于最小化 JS 散度？',
          'GAN 的全局最优解是什么？此时判别器的输出是什么？',
          '实际训练 GAN 时为什么要交替更新 D 和 G，而不是一次把 D 训到最优？',
          'GAN 与 VAE、DBN 等生成模型相比有何优劣？'
        ]
      },

      sections: [
        {
          id: 'abstract',
          title: 'Abstract',
          level: 2,
          content: [
            {
              type: 'p',
              text:
                'We propose a new framework for estimating generative models via an adversarial process, in which we simultaneously train two models: a generative model G that captures the data distribution, and a discriminative model D that estimates the probability that a sample came from the training data rather than G.'
            },
            {
              type: 'p',
              text:
                'The training procedure for G is to maximize the probability of D making a mistake. This framework corresponds to a minimax two-player game. In the space of arbitrary functions G and D, a unique solution exists, with G recovering the training data distribution and D equal to 1/2 everywhere.'
            },
            {
              type: 'p',
              text:
                'In the case where G and D are defined by multilayer perceptrons, the entire system can be trained with backpropagation. There is no need for any Markov chains or unrolled approximate inference networks during either training or generation of samples. Experiments demonstrate the potential of the framework through qualitative and quantitative evaluation of the generated samples.'
            }
          ]
        },
        {
          id: 'intro',
          title: '1. Introduction',
          level: 2,
          content: [
            {
              type: 'p',
              text:
                'The promise of deep learning is to discover rich, hierarchical models that represent probability distributions over the kinds of data encountered in artificial intelligence applications, such as natural images, audio waveforms containing speech, and symbols in natural language corpora. So far, the most striking successes in deep learning have involved discriminative models, usually those that map a high-dimensional, rich sensory input to a class label.'
            },
            {
              type: 'p',
              text:
                'These striking successes have primarily been based on the backpropagation and dropout algorithms, using piecewise linear units which have a particularly well-behaved gradient. Deep generative models have had less of an impact, due to the difficulty of approximating many intractable probabilistic computations that arise in maximum likelihood estimation and related strategies, and due to difficulty of leveraging the benefits of piecewise linear units in the generative context.'
            },
            {
              type: 'p',
              text:
                'We propose a new generative model estimation procedure that sidesteps these difficulties. In the proposed adversarial nets framework, the generative model is pitted against an adversary: a discriminative model that learns to determine whether a sample is from the model distribution or the data distribution. The generative model can be thought of as analogous to a team of counterfeiters, trying to produce fake currency and use it without detection, while the discriminative model is analogous to the police, trying to detect the counterfeit currency. Competition in this game drives both teams to improve their methods until the counterfeits are indistinguishable from the genuine articles.'
            }
          ]
        },
        {
          id: 'adversarial',
          title: '2. Adversarial Nets',
          level: 2,
          content: [
            {
              type: 'p',
              text:
                'The adversarial modeling framework is most straightforward to apply when the models are both multilayer perceptrons. To learn the generator\'s distribution p_g over data x, we define a prior on input noise variables p_z(z), then represent a mapping to data space as G(z; θ_g), where G is a differentiable function represented by a multilayer perceptron with parameters θ_g.'
            },
            {
              type: 'p',
              text:
                'We also define a second multilayer perceptron D(x; θ_d) that outputs a single scalar. D(x) represents the probability that x came from the data rather than the generator\'s distribution p_g. We train D to maximize the probability of assigning the correct label to both training examples and samples from G. We simultaneously train G to minimize log(1 − D(G(z))). In other words, D and G play the following two-player minimax game with value function V(G, D):'
            },
            { type: 'formula', ref: 'gan', display: 'min_G max_D V(D,G) = E_{x~p_data}[log D(x)] + E_{z~p_z}[log(1−D(G(z)))]' },
            {
              type: 'p',
              text:
                'In practice, training G to minimize log(1 − D(G(z))) may not provide sufficient gradient early in learning, when G is poor and D can confidently reject samples because they are clearly different from training data. In this case, training G to maximize log D(G(z)) often results in stronger gradients. This alternative objective does not change the fixed point of the dynamics but provides much better gradients early on.'
            },
            {
              type: 'p',
              text:
                'We train D and G by alternating: k steps of optimizing D to completion, followed by one step of optimizing G. This ensures that D is maintained near its optimal solution given a slowly changing G. In practice, we use SGD with minibatches and train for a fixed number of epochs After training, samples can be drawn by passing noise z through G without any inference procedure.'
            }
          ]
        },
        {
          id: 'theory',
          title: '3. Theoretical Results',
          level: 2,
          content: [
            {
              type: 'p',
              text:
                'We first show that for G fixed, the optimal discriminator is D*_G(x) = p_data(x) / (p_data(x) + p_g(x)). This follows from the fact that the training objective for D is just the standard binary cross-entropy between the label "real" and the label "fake", so its minimizer is the ratio of the two class densities.'
            },
            { type: 'formula', ref: 'optimal-d', display: 'D*_G(x) = p_data(x) / (p_data(x) + p_g(x))' },
            {
              type: 'p',
              text:
                'The objective for G when D is optimal can then be reformulated as C(G) = E_{x~p_data}[log D*_G(x)] + E_{x~p_g}[log(1 − D*_G(x))], which equals 2·JSD(p_data || p_g) − 2 log 2. Since the Jensen–Shannon divergence is always non-negative and zero iff the two distributions are equal, the global minimum of C(G) is achieved iff p_g = p_data, in which case C(G) = −log 4 and D*_G(x) = 1/2 everywhere.'
            },
            { type: 'formula', ref: 'global-opt', display: 'C(G) = 2·JSD(p_data || p_g) − 2 log 2 ≥ −log 4' },
            {
              type: 'p',
              text:
                'We then show that the proposed iterative training procedure converges in the limit: if both G and D have enough capacity, and at each step D is allowed to reach its optimum given G, then p_g converges to p_data. In practice, the networks may not have sufficient capacity and G is updated only after k D steps, but this result provides a theoretical justification for the approach.'
            }
          ]
        },
        {
          id: 'experiments',
          title: '4. Experiments',
          level: 2,
          content: [
            {
              type: 'p',
              text:
                'We trained adversarial nets on a range of datasets, including MNIST, the Toronto Face Database (TFD) and CIFAR-10. The generator uses a mixture of rectifier linear activations and sigmoid activations, while the discriminator uses maxout activations. Dropout is applied in training the discriminator. While our theoretical framework permits the use of dropout and intermediate noise for generator training, we use dropout only for the discriminator in these experiments.'
            },
            {
              type: 'p',
              text:
                'We estimate the probability of test set data under p_g by fitting a Gaussian Parzen window to samples produced by G. We report the log-likelihood estimate on MNIST, TFD and CIFAR-10. On MNIST, the adversarial net obtains a Parzen-window estimate of 225 ± 2, which is better than the previously reported estimates based on DBNs, stacked CAEs and deep GSNs on this benchmark.'
            },
            {
              type: 'p',
              text:
                'Qualitatively, samples produced by the generator appear sharp and coherent on MNIST and TFD. On CIFAR-10, generated samples are recognizable but still show the limitations of the model. The samples and quantitative results suggest that the framework is a viable alternative to established generative modeling pipelines, and can be improved by using better architectures and larger models.'
            }
          ]
        },
        {
          id: 'advantages',
          title: '5. Advantages and Disadvantages',
          level: 2,
          content: [
            {
              type: 'p',
              text:
                'The main advantages of the framework are: no Markov chains are needed, only backpropagation is used; no approximate inference is required; a wide variety of functions can be incorporated into the model; and G can be updated directly with gradients obtained from D. The generator network is not updated directly with examples from data but only with gradients flowing through the discriminator, which means it never "sees" the true data distribution directly.'
            },
            {
              type: 'p',
              text:
                'The main disadvantages are that there is no explicit representation of p_g(x), and that D must be synchronized well with G during training — in particular, G must not be trained too much without updating D, in order to avoid "the Helvetica scenario" in which G collapses too many z values to the same x to produce enough diversity. In practice, the visual quality of samples may be good even before strict convergence is reached.'
            }
          ]
        },
        {
          id: 'conclusion',
          title: '6. Conclusion',
          level: 2,
          content: [
            {
              type: 'p',
              text:
                'We have presented a framework for generative models that uses an adversarial training process, with a generator and a discriminator playing a minimax game. We showed that the framework has a well-defined global optimum where the generator recovers the data distribution, and that backpropagation alone is sufficient for training.'
            },
            {
              type: 'p',
              text:
                'We are excited about future work, including conditional generative models by conditioning on labels, partially supervised / semi-supervised learning using the learned features from D, and efficiency improvements in training. The framework offers a new way to leverage the power of deep neural networks for generative tasks and has since spawned a vast family of follow-up models.'
            }
          ]
        }
      ],

      formulas: {
        gan: {
          title: 'GAN 目标函数 (Min-Max Objective)',
          latex:
            '\\min_{G}\\max_{D}V(D,G)=\\mathbb{E}_{x\\sim p_{\\text{data}}}[\\log D(x)]+\\mathbb{E}_{z\\sim p_z}[\\log(1-D(G(z)))]',
          steps: [
            { num: 1, text: '判别器 D 对真实样本 x 输出概率 D(x)，并对生成样本 G(z) 输出概率 D(G(z))。' },
            { num: 2, text: '最大化 V：让 D 对真实样本给出高概率，对生成样本给出低概率。' },
            { num: 3, text: '最小化 V：让 G 生成的样本使 D(G(z)) 尽可能接近 1，即"骗过"判别器。' },
            { num: 4, text: '实践中用最大化 log D(G(z)) 替代最小化 log(1−D(G(z)))，以获得更强梯度。' }
          ],
          variables: [
            { symbol: 'G', desc: '生成器，把先验噪声 z 映射为数据样本 G(z)' },
            { symbol: 'D', desc: '判别器，输出输入为真实样本的概率' },
            { symbol: 'p_data', desc: '真实数据分布' },
            { symbol: 'p_g', desc: '生成器诱导的样本分布' },
            { symbol: 'p_z', desc: '输入噪声的先验分布（通常为均匀或高斯分布）' },
            { symbol: 'z', desc: '从 p_z 中采样的随机噪声向量' }
          ],
          meaning:
            '这是 GAN 的核心 minimax 博弈：D 想最大化对真假样本的判别准确率，G 想最小化 D 区分真伪的能力。' +
          '两个网络在对抗中共同进化，最终达到纳什均衡。',
          related: ['optimal-d', 'global-opt']
        },
        'optimal-d': {
          title: '最优判别器 (Optimal Discriminator)',
          latex:
            'D^{*}_{G}(x)=\\frac{p_{\\text{data}}(x)}{p_{\\text{data}}(x)+p_g(x)}',
          steps: [
            { num: 1, text: '固定生成器 G，将 D 的目标视为关于 D(x) 的二元交叉熵。' },
            { num: 2, text: '对每个 x 单独优化 V，对 D(x) 求导并令其为 0。' },
            { num: 3, text: '解出最优判别器为两类密度之比 p_data / (p_data + p_g)。' },
            { num: 4, text: '当 p_g = p_data 时，该比值恒为 1/2。' }
          ],
          variables: [
            { symbol: 'D*_G(x)', desc: '在固定 G 下判别器的最优输出' },
            { symbol: 'p_data(x)', desc: '真实样本在 x 处的密度' },
            { symbol: 'p_g(x)', desc: '生成样本在 x 处的密度' }
          ],
          meaning:
            '该公式说明：给定一个生成器，最优判别器的输出只取决于真实密度与生成密度的比值。' +
            '它把 GAN 的训练目标与两个分布的差异直接联系起来，为后续的 JS 散度解释奠定基础。',
          related: ['gan', 'global-opt']
        },
        'global-opt': {
          title: '全局最优 (Global Optimum)',
          latex:
            'C(G)=\\mathbb{E}_{x\\sim p_{\\text{data}}}[\\log D^{*}_{G}(x)]+\\mathbb{E}_{x\\sim p_g}[\\log(1-D^{*}_{G}(x))]=2\\,\\mathrm{JSD}(p_{\\text{data}}\\|p_g)-2\\log 2',
          steps: [
            { num: 1, text: '将最优判别器 D*_G 代入 V，得到仅关于 G 的目标 C(G)。' },
            { num: 2, text: '把期望项重写为关于 p_data 与 p_g 的函数。' },
            { num: 3, text: '整理后证明 C(G) = 2·JSD(p_data || p_g) − 2 log 2。' },
            { num: 4, text: 'JSD ≥ 0 且当且仅当 p_g = p_data 时取 0，故全局最小 C(G) = −log 4，此时 D*_G ≡ 1/2。' }
          ],
          variables: [
            { symbol: 'C(G)', desc: '固定 D 为最优判别器时 G 的目标函数' },
            { symbol: 'JSD', desc: 'Jensen–Shannon 散度，对称且非负' },
            { symbol: '−log 4', desc: '全局最优对应的目标值（约 −1.386）' }
          ],
          meaning:
            'GAN 的训练目标在数学上等价于最小化真实分布与生成分布之间的 JS 散度。' +
            '全局最优唯一地出现在两分布完全重合时，此时判别器无法区分真伪，只能输出 1/2。' +
            '这是 GAN 能够学习真实数据分布的理论保证。',
          related: ['gan', 'optimal-d']
        }
      },

      translations: [
        {
          en: 'We simultaneously train two models: a generative model G that captures the data distribution, and a discriminative model D that estimates the probability that a sample came from the training data rather than G.',
          zh: '我们同时训练两个模型：生成模型 G 用于刻画数据分布，判别模型 D 用于估计一个样本来自训练数据而非 G 的概率。'
        },
        {
          en: 'The training procedure for G is to maximize the probability of D making a mistake.',
          zh: 'G 的训练目标是最大化 D 犯错的概率。'
        },
        {
          en: 'There is no need for any Markov chains or unrolled approximate inference networks during training or generation.',
          zh: '在训练和生成阶段都不需要任何马尔可夫链，也不需要展开的近似推断网络。'
        },
        {
          en: 'For G fixed, the optimal discriminator is D*_G(x) = p_data(x) / (p_data(x) + p_g(x)).',
          zh: '当 G 固定时，最优判别器为 D*_G(x) = p_data(x) / (p_data(x) + p_g(x))。'
        },
        {
          en: 'The global minimum is achieved if and only if p_g = p_data, in which case D*_G(x) = 1/2 everywhere.',
          zh: '当且仅当 p_g = p_data 时达到全局最小，此时 D*_G(x) 在所有位置均为 1/2。'
        },
        {
          en: 'Competition in this game drives both teams to improve their methods until the counterfeits are indistinguishable from the genuine articles.',
          zh: '这场博弈中的竞争驱使双方不断改进方法，直到伪造品与真品无法区分。'
        }
      ]
    },

    // ============================================================
    // 论文 5：Adam Optimizer
    // ============================================================
    p32: {
      id: 'p32',
      title: 'Adam: A Method for Stochastic Optimization',
      authors: 'Diederik P. Kingma, Jimmy Ba',
      venue: 'ICLR 2015',
      year: 2015,
      ccf: 'A',
      citations: '136,000+',
      keywords: ['ML', '优化器', 'Adam', '随机梯度下降', '自适应学习率'],
      abstract:
        '本文提出 Adam（Adaptive Moment Estimation），一种面向随机目标函数的一阶梯度优化算法。' +
        'Adam 同时利用梯度的一阶矩（均值）和二阶矩（未中心化方差）的指数移动平均，为每个参数计算自适应学习率；' +
        '并通过偏差修正抵消初始时刻矩估计偏向零的问题。Adam 结合了 AdaGrad 与 RMSProp 的优点，实现简单、计算高效、对内存需求小，' +
        '对角缩放不变、适合大规模数据 / 高维参数空间，并在 MNIST 逻辑回归、IMDb 情感分析等实验上稳定优于 SGD、SGD-Momentum、RMSProp、AdaGrad 等方法。',

      ai: {
        oneLineSummary:
          '用梯度一阶矩与二阶矩的指数滑动平均自适应调节学习率，成为深度学习最常用的优化器之一。',
        contributions: [
          '提出 Adam 算法，将动量（一阶矩）与自适应学习率（二阶矩）统一到一个更新规则中。',
          '加入偏差修正项，解决早期训练时刻 m、v 偏向 0 的问题，使更新在小步长下依然稳定。',
          '对梯度对角缩放不变，适合高维稀疏梯度和非稳态目标，超参数少且默认值鲁棒。',
          '给出凸目标下 O(√T) 的 regret bound，从理论上保证算法收敛性。',
          '在 MNIST 逻辑回归、IMDb 情感分析及深度网络实验中，相比 SGD、SGD-Momentum、AdaGrad、RMSProp 收敛更快、更稳定。'
        ],
        dataCards: [
          { value: 'β₁=0.9', label: '一阶矩衰减' },
          { value: 'β₂=0.999', label: '二阶矩衰减' },
          { value: 'ε=10⁻⁸', label: '数值稳定项' },
          { value: 'α=0.001', label: '默认学习率' }
        ],
        readingTip:
          '建议先看 Algorithm 1 把 Adam 的更新步骤顺一遍，再回到 2.1 节理解为什么要做偏差修正；' +
          '阅读第 3 节收敛性证明时主要看 regret bound 的思想，不必逐行推公式；最后对照实验图理解 Adam 在不同任务上的稳定性。',
        comparisonTable: {
          headers: ['优化器', '一阶矩 / 动量', '二阶矩 / 自适应', '偏差修正', '典型适用场景'],
          rows: [
            { values: ['SGD', '无', '无', '—', '简单凸问题 / 精细调参'], highlight: false },
            { values: ['SGD + Momentum', '指数平均梯度', '无', '—', 'CV 大batch训练'], highlight: false },
            { values: ['AdaGrad', '无', '历史梯度平方和', '无', '稀疏特征'], highlight: false },
            { values: ['RMSProp', '无', '指数平均梯度平方', '无', 'RNN / 非稳态目标'], highlight: false },
            { values: ['Adam (本文)', '指数平均梯度 m', '指数平均梯度平方 v', '有', '通用深度学习'], highlight: true }
          ]
        },
        experimentTable: {
          headers: ['实验任务', '模型', '对比优化器', '指标', 'Adam 表现'],
          rows: [
            { values: ['MNIST', '逻辑回归', 'SGD, SGD-Mom, RMSProp, AdaGrad', '训练损失', '下降最快、最稳'] },
            { values: ['MNIST', '多层神经网络', 'SGD+Momentum', '测试错误率', '更低错误率、更快收敛'] },
            { values: ['IMDb 情感分析', '逻辑回归 (BoW)', 'SGD, AdaGrad, RMSProp', '训练/测试损失', '训练更平滑、泛化更好'] }
          ]
        },
        ablationBars: [
          { label: 'SGD (固定 lr)', value: 40, display: '收敛慢、需手工调 lr' },
          { label: 'SGD + Momentum', value: 65, display: '加速明显但 lr 敏感' },
          { label: 'AdaGrad', value: 60, display: 'lr 单调递减、后期停滞' },
          { label: 'RMSProp', value: 80, display: '自适应但无偏差修正' },
          { label: 'Adam (β1=0.9, β2=0.999)', value: 95, display: '默认配置下稳定快速' }
        ],
        suggestedQuestions: [
          'Adam 中 m_t 和 v_t 分别是什么？对应梯度的哪些矩估计？',
          '为什么需要偏差修正 m̂_t、v̂_t？如果不做会有什么后果？',
          'Adam 与 RMSProp 的本质区别是什么？',
          'β1、β2、ε、α 分别控制什么？默认值为何这样选取？',
          'Adam 为什么对梯度的对角缩放具有不变性？'
        ]
      },

      sections: [
        {
          id: 'abstract',
          title: 'Abstract',
          level: 2,
          content: [
            {
              type: 'p',
              text:
                'We introduce Adam, an algorithm for first-order gradient-based optimization of stochastic objective functions, based on adaptive estimates of lower-order moments. The method is straightforward to implement, is computationally efficient, has little memory requirements, is invariant to diagonal rescaling of the gradients, and is well suited for problems that are large in terms of data and/or parameters.'
            },
            {
              type: 'p',
              text:
                'The method is also appropriate for non-stationary objectives and problems with very noisy and/or sparse gradients. The hyper-parameters have intuitive interpretations and typically require little tuning. Some of the hyper-parameters are comparable to those used by related methods, and we discuss the connections to AdaGrad and RMSProp. We also analyze the theoretical convergence properties of the algorithm and provide a regret bound on the convergence rate under some assumptions about the first and second moments of the gradient.'
            },
            {
              type: 'p',
              text:
                'We show experimentally that Adam works well in practice and compares favorably to other stochastic optimization methods on a variety of tasks, including logistic regression on MNIST and sentiment analysis on the IMDb dataset. Finally, we investigate the properties of the algorithm by applying it to train deep neural networks on image classification and language modeling problems.'
            }
          ]
        },
        {
          id: 'intro',
          title: '1. Introduction',
          level: 2,
          content: [
            {
              type: 'p',
              text:
                'Stochastic gradient descent (SGD) and many variants have become the method of choice for optimizing objectives in many machine learning problems. SGD maintains a single learning rate for all weight updates and the learning rate is rarely changed during training in a per-parameter way. A growing number of works have developed "adaptive learning rate" methods, such as AdaGrad and RMSProp, which tune individual learning rates from statistics of recent gradients.'
            },
            {
              type: 'p',
              text:
                'In this paper, we aim to combine the advantages of two recently popular methods: AdaGrad, which works well with sparse gradients, and RMSProp, which works well in on-line and non-stationary settings. The proposed algorithm, Adam, derives benefits from both by keeping an exponential moving average of the gradients (first moment) and an exponential moving average of the squared gradients (second raw moment), while using a bias correction that makes these estimates unbiased in early iterations.'
            },
            {
              type: 'p',
              text:
                'The name Adam is derived from "adaptive moment estimation". We show that Adam has a regret bound under convex settings, is invariant to diagonal rescaling of the gradients, and is well suited for non-convex optimization in deep neural networks. Across our experiments, Adam is more robust to hyper-parameter choice and converges faster than the baselines.'
            }
          ]
        },
        {
          id: 'algorithm',
          title: '2. Algorithm',
          level: 2,
          content: [
            {
              type: 'p',
              text:
                'Adam is presented in Algorithm 1. Let f(θ) be the noisy objective function, i.e. a stochastic scalar function that is differentiable w.r.t. parameters θ. We are interested in minimizing the expected value of f over its noise distribution E[f(θ)]. We initialize θ_0, first moment vector m_0 = 0, second moment vector v_0 = 0 and time step t = 0.'
            },
            {
              type: 'p',
              text:
                'At each time step, we sample a minibatch and compute the stochastic gradient g_t. We then update biased first and second moment estimates: m_t = β_1 · m_{t−1} + (1 − β_1) · g_t, and v_t = β_2 · v_{t−1} + (1 − β_2) · g_t². Since these moving averages are initialized as vectors of zeros, they are biased towards zero, especially during the initial time steps and especially when β_1, β_2 are close to 1.'
            }
          ]
        },
        {
          id: 'update',
          title: "2.1 Adam's Update Rule",
          level: 3,
          content: [
            {
              type: 'p',
              text:
                'To counteract these biases, we compute bias-corrected first and second moment estimates: m̂_t = m_t / (1 − β_1^t) and v̂_t = v_t / (1 − β_2^t). We then perform the parameter update using:'
            },
            { type: 'formula', ref: 'adam-update', display: 'θ_t = θ_{t−1} − α · m̂_t / (√v̂_t + ε)' },
            {
              type: 'p',
              text:
                'The proposed default values of the hyper-parameters are α = 0.001, β_1 = 0.9, β_2 = 0.999 and ε = 10⁻⁸. We find these values to be robust and require little tuning on most problems. We also discuss that Adam generalizes RMSProp in the limit when β_1 → 0 (no momentum), while adding an explicit first-moment term as well as bias correction when β_1 > 0.'
            },
            { type: 'formula', ref: 'bias-correction', display: 'm̂_t = m_t / (1 − β_1^t), v̂_t = v_t / (1 − β_2^t)' },
            {
              type: 'p',
              text:
                'Notably, the update magnitude |Δ_t| is approximately bounded by the step size α: each step size is approximately ±α for every parameter, since the denominator scales by the same magnitude as m̂_t. This makes α easy to interpret as an absolute upper bound on the step size, rather than a learning rate that depends on the scale of the gradients.'
            }
          ]
        },
        {
          id: 'convergence',
          title: '3. Convergence Analysis',
          level: 2,
          content: [
            {
              type: 'p',
              text:
                'We analyze Adam using the online learning framework. We prove a regret bound showing that, for convex objectives, the average regret of Adam is O(√T), where T is the number of time steps, under standard assumptions that the gradients have bounded first and second moments. This rate is comparable to that of RMSProp and AdaGrad under the same assumptions.'
            },
            {
              type: 'p',
              text:
                'The proof relies on the fact that the bias-corrected moments m̂_t and v̂_t are good estimates of the true first and second moments of the gradients. The key quantities β_1 and β_2 control the memory of these running averages: β_1 controls the exponential decay rate for the first moment estimate (momentum), and β_2 controls the exponential decay rate for the second moment estimate (adaptive learning rate).'
            }
          ]
        },
        {
          id: 'experiments',
          title: '4. Experiments',
          level: 2,
          content: [
            {
              type: 'p',
              text:
                'We compare Adam with SGD (with and without Nesterov momentum), AdaGrad and RMSProp on logistic regression over MNIST, using mini-batches of 128 examples. We find that Adam gives the fastest decrease of training error and provides the lowest final test error, while being relatively insensitive to changes in α. SGD with momentum converges more slowly and requires careful learning rate tuning to avoid oscillations.'
            },
            {
              type: 'p',
              text:
                'On the IMDb sentiment classification dataset, we train logistic regression over bag-of-words features. The gradients are quite sparse, so AdaGrad also does well initially, but its effective learning rate decreases monotonically and eventually stalls. Adam keeps progressing throughout training due to its exponential average over recent gradients, and generalizes as well as or better than the baselines.'
            },
            {
              type: 'p',
              text:
                'We also train a multi-layer neural network on MNIST and a character-level language model. Adam consistently provides fast convergence and stable results across these deeper models, whereas RMSProp sometimes exhibits unstable behavior with certain hyper-parameter choices. The experiments suggest that Adam is a strong default optimizer for a broad class of deep learning tasks.'
            }
          ]
        },
        {
          id: 'conclusion',
          title: '5. Conclusion',
          level: 2,
          content: [
            {
              type: 'p',
              text:
                'We introduced Adam, a simple, computationally efficient, and widely applicable stochastic optimization algorithm that uses adaptive estimates of both first and second moments of gradients. The method has few hyper-parameters with intuitive interpretations, works well with little tuning, and combines the strengths of AdaGrad (for sparse gradients) and RMSProp (for non-stationary settings).'
            },
            {
              type: 'p',
              text:
                'A theoretical analysis provides a regret bound in the convex setting, and empirical results on image classification and language modeling demonstrate strong performance. Adam has since been adopted as a default optimizer across deep learning frameworks and applied to problems ranging from computer vision and natural language processing to reinforcement learning and generative modeling.'
            }
          ]
        }
      ],

      formulas: {
        'adam-update': {
          title: 'Adam 参数更新规则',
          latex:
            '\\theta_t=\\theta_{t-1}-\\alpha\\cdot\\frac{\\hat{m}_t}{\\sqrt{\\hat{v}_t}+\\varepsilon}',
          steps: [
            { num: 1, text: '在第 t 步用小批量计算随机梯度 g_t。' },
            { num: 2, text: '用指数移动平均更新一阶矩 m_t = β_1 m_{t−1} + (1 − β_1) g_t。' },
            { num: 3, text: '更新二阶矩 v_t = β_2 v_{t−1} + (1 − β_2) g_t ⊙ g_t（逐元素平方）。' },
            { num: 4, text: '对 m_t、v_t 做偏差修正，得到 m̂_t 和 v̂_t。' },
            { num: 5, text: '用 m̂_t 作为更新方向，√v̂_t + ε 作为每个参数的自适应步长缩放，对 θ 做更新。' }
          ],
          variables: [
            { symbol: 'θ_t', desc: '第 t 步后的参数' },
            { symbol: 'α', desc: '学习率，默认 0.001' },
            { symbol: 'm_t / m̂_t', desc: '一阶矩（梯度均值）及其偏差修正' },
            { symbol: 'v_t / v̂_t', desc: '二阶矩（梯度平方均值）及其偏差修正' },
            { symbol: 'ε', desc: '防止除零的常数，默认 10⁻⁸' }
          ],
          meaning:
            'Adam 用一阶矩估计梯度方向（动量），用二阶矩为每个参数自适应缩放学习率。' +
            '更新量大小大致被 α 约束，使 α 可以解释为"单步最大更新幅度"，' +
            '同时算法对梯度的对角重缩放不变，非常适合稀疏/噪声梯度。',
          related: ['bias-correction']
        },
        'bias-correction': {
          title: '偏差修正 (Bias Correction)',
          latex:
            '\\hat{m}_t=\\frac{m_t}{1-\\beta_1^{t}},\\qquad \\hat{v}_t=\\frac{v_t}{1-\\beta_2^{t}}',
          steps: [
            { num: 1, text: '由于 m_0 = 0、v_0 = 0，指数移动平均在训练初期会被拉向 0。' },
            { num: 2, text: '由递推式可得 E[m_t] = (1 − β_1^t)·E[g_t] + 历史项的偏差。' },
            { num: 3, text: '将 m_t 除以 (1 − β_1^t)，即可修正这个由初始化引入的偏差。' },
            { num: 4, text: '对 v_t 同理除以 (1 − β_2^t)。当 t 增大时修正因子趋近 1，影响自然消失。' }
          ],
          variables: [
            { symbol: 'β_1', desc: '一阶矩衰减率，默认 0.9' },
            { symbol: 'β_2', desc: '二阶矩衰减率，默认 0.999' },
            { symbol: 't', desc: '当前迭代步数' },
            { symbol: 'm_t', desc: '带偏差的一阶矩估计' },
            { symbol: 'v_t', desc: '带偏差的二阶矩估计' }
          ],
          meaning:
            '偏差修正是 Adam 与 RMSProp 最关键的区别之一。它保证了训练初期（尤其是 β_2 = 0.999 这种慢衰减配置下）' +
            '梯度矩估计不会被零初始化"拉低"，使第一次更新就具有合理尺度，' +
            '也是 Adam 在小学习率 / 稀疏梯度下仍稳定的重要原因。',
          related: ['adam-update']
        }
      },

      translations: [
        {
          en: 'We introduce Adam, an algorithm for first-order gradient-based optimization of stochastic objective functions, based on adaptive estimates of lower-order moments.',
          zh: '我们提出 Adam，一种基于低阶矩自适应估计的一阶随机目标函数梯度优化算法。'
        },
        {
          en: 'The method is straightforward to implement, is computationally efficient, has little memory requirements, and is invariant to diagonal rescaling of the gradients.',
          zh: '该方法实现简单、计算高效、内存占用小，并且对梯度的对角缩放具有不变性。'
        },
        {
          en: 'We keep an exponential moving average of the gradients and an exponential moving average of the squared gradients.',
          zh: '我们维护梯度的指数移动平均，以及梯度平方的指数移动平均。'
        },
        {
          en: 'Bias correction makes the moment estimates unbiased in early time steps.',
          zh: '偏差修正使得矩估计在训练早期是无偏的。'
        },
        {
          en: 'The default hyper-parameters are α = 0.001, β_1 = 0.9, β_2 = 0.999 and ε = 10⁻⁸.',
          zh: '默认超参数为 α = 0.001，β_1 = 0.9，β_2 = 0.999，ε = 10⁻⁸。'
        },
        {
          en: 'Adam combines the advantages of AdaGrad, which works well with sparse gradients, and RMSProp, which works well in non-stationary settings.',
          zh: 'Adam 结合了 AdaGrad（适合稀疏梯度）和 RMSProp（适合非稳态目标）两者的优点。'
        }
      ]
    }
  };

  // 挂载到全局
  global.PAPERS_DATA = PAPERS_DATA;
})(typeof window !== 'undefined' ? window : this);
