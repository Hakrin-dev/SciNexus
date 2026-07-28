/**
 * 研枢 YanShu — 前端核心逻辑
 研枢AI科研平台前端主控脚本，包含：全局错误处理、API通信、
 DeepSeek AI对话、论文搜索渲染、收藏系统、文献库管理、
 投稿分析、阅读面板、引文图谱、PDF渲染、导出工具等全部业务逻辑。

 */

// ============================================================
// 一、全局错误处理与基础工具
// ============================================================

// 全局错误处理器 —— 捕获未处理的 JS 异常，展示恢复提示并阻止浏览器默认报错
window.onerror = function(msg, url, line, col, error) {
  console.error('全局错误:', msg, 'at', url, 'line', line);
  showToast('\u26A0\uFE0F \u9875\u9762\u51FA\u73B0\u5F02\u5E38\uFF0C\u5DF2\u81EA\u52A8\u6062\u590D', 'warning');
  return true; // 阻止浏览器默认错误处理
};
// 未处理的 Promise 拒绝 —— 网络请求失败时自动提示用户重试
window.onunhandledrejection = function(event) {
  console.error('未处理的 Promise 拒绝:', event.reason);
  showToast('\u26A0\uFE0F \u7F51\u7EDC\u8BF7\u6C42\u5931\u8D25\uFF0C\u6B63\u5728\u91CD\u8BD5...', 'warning');
};

// DOM 安全工具函数 —— 避免空引用导致的运行时错误
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);
const safeAddClass = (el, cls) => { if (el) el.classList.add(cls); };
const safeRemoveClass = (el, cls) => { if (el) el.classList.remove(cls); };
const safeHTML = (el, html) => { if (el) el.innerHTML = html; };
const safeText = (el, text) => { if (el) el.textContent = text; };

// ============================================================
// 二、API 通信层
// ============================================================

// 后端 API 基础路径
const API = '/api';
// 请求缓存 —— 键为 "路径+参数序列化"，避免同一会话内重复请求
const apiCache = {};

/**
 * 通用 API 请求封装
 * 自动拼接基础路径、设置 JSON 头、处理错误与缓存
 * @param {string} path - API 路径（如 '/papers?page_size=20'）
 * @param {object} options - fetch 选项，body 会被自动 JSON.stringify
 * @returns {Promise<object|null>} 响应数据，失败时返回 null 并使用降级数据
 */
async function apiFetch(path, options={}) {
  const key = path + JSON.stringify(options);
  if (apiCache[key]) return apiCache[key];
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    apiCache[key] = data;
    return data;
  } catch(e) {
    console.warn('API 请求失败，使用降级数据:', path, e.message);
    return null;
  }
}

// ============================================================
// 三、DeepSeek AI 对话引擎
// ============================================================

// DeepSeek API 配置
const DEEPSEEK_KEY = import.meta.env.VITE_DEEPSEEK_KEY || '';
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';

/**
 * 调用 DeepSeek API 进行真实 AI 对话
 * @param {Array} messages - 消息数组 [{role:'user'|'assistant'|'system', content:'...'}]
 * @param {Boolean} stream - 是否使用 SSE 流式传输
 * @returns {Promise<Object|ReadableStream>} 非流式模式返回回复文本，流式模式返回 ReadableStream
 */
async function deepseekChat(messages, stream = false) {
  const body = {
    model: 'deepseek-v4-pro',
    messages: messages,
    max_tokens: 4096,
    stream: stream
  };

  const res = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + DEEPSEEK_KEY
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Unknown error');
    console.error('DeepSeek API 错误:', res.status, errText);
    const error = new Error(errText);
    error.status = res.status;
    throw error;
  }

  if (stream) {
    return res.body; // 流式模式：返回 ReadableStream 供 SSE 处理
  } else {
    const data = await res.json();
      // 仅取正式回复内容，忽略模型的内部推理过程
      const msg = data.choices[0].message;
      return msg.content || '';
  }
}

/**
 * 构建发送给 DeepSeek 的对话消息数组
 * 将本地 conversation 格式转换为 DeepSeek API 要求的 [{role, content}] 格式
 * @param {Array} convMessages - 当前会话历史消息列表
 * @param {string} userNewMsg - 待发送的新用户消息（可选）
 * @returns {Array} 符合 DeepSeek API 格式的消息数组
 */
function buildDeepseekMessages(convMessages, userNewMsg) {
  const msgs = [
    { role: 'system', content: `你是研枢（YanShu）平台的 AI 科研助手，由 DeepSeek 大语言模型驱动。

## 你的定位
你专门帮助计算机科学、人工智能领域的研究人员完成以下任务：
- 文献综述撰写与文献检索
- 论文润色与学术写作优化
- 实验对比分析与方法评估
- 研究方法设计与实验方案规划
- 投稿选刊建议与格式检查
- 代码实现与算法复现
- 研究趋势分析与前沿追踪

## 回答风格要求
1. **学术严谨**：使用准确的专业术语，中文为主，专业名词保留英文
2. **结构化输出**：使用 Markdown 格式组织内容，善用标题、表格、列表
3. **引用真实**：优先引用顶会顶刊（NeurIPS/ICML/CVPR/ACL等）的真实论文
4. **前置摘要**：较长回答先给一段简短的"核心要点"摘要（3-5条要点）
5. **表格对比**：涉及方法对比时优先使用表格
6. **参考文献**：回答末尾列出引用的关键论文（作者, "标题", 会议/期刊, 年份）

## 格式偏好
- 核心要点用 **加粗** 突出
- 代码用 \`\`\` 代码块包裹
- 方法对比用 Markdown 表格
- 层次分明：## 一级标题，### 二级标题
- 中文回答，英文术语保留不翻译` }
  ];

  // 追加历史对话上下文
  for (const m of convMessages) {
    if (m.type === 'user') {
      msgs.push({ role: 'user', content: m.text });
    } else if (m.type === 'ai') {
      msgs.push({ role: 'assistant', content: m.text });
    }
  }

  // 追加当前用户新消息
  if (userNewMsg) {
    msgs.push({ role: 'user', content: userNewMsg });
  }

  return msgs;
}

// ============================================================
// 四、数据状态与 Fallback 数据
// ============================================================

// 全局数据状态 —— 从 API 加载或使用本地降级数据
let papers = [];
let journals = [];
let conversations = [];
let libraryPapers = [];

// 论文降级数据 —— 当 API 不可用时兜底展示
const fallbackPapers = [
  // ===== NLP / LLM =====
  { id:'p1',title:'Attention Is All You Need',authors:'Vaswani et al.',venue:'NeurIPS 2017',year:2017,ccf:'A',match:'perfect',matchLabel:'Perfect',citations:'98,700+',heat:'Hot',keywords:['NLP','Transformer'],abstract:'提出了革命性的Transformer架构，完全基于自注意力机制替代传统的循环和卷积结构。核心创新包括缩放点积注意力、多头注意力机制和位置编码。在WMT 2014英德翻译任务上取得28.4 BLEU，训练时间大幅缩短。该架构已成为现代深度学习的基础模块。'},
  { id:'p2',title:'BERT: Pre-training of Deep Bidirectional Transformers',authors:'Devlin et al.',venue:'NAACL 2019',year:2019,ccf:'A',match:'perfect',matchLabel:'Perfect',citations:'65,200+',heat:'Hot',keywords:['NLP','预训练','BERT'],abstract:'提出BERT预训练模型，通过掩码语言模型（MLM）和下一句预测（NSP）实现深度双向表征学习。在11项NLP任务上刷新SOTA，包括GLUE基准提升7.7%。开创了"预训练-微调"范式，对NLP领域影响深远。'},
  { id:'p3',title:'Language Models are Few-Shot Learners (GPT-3)',authors:'Brown et al.',venue:'NeurIPS 2020',year:2020,ccf:'A',match:'perfect',matchLabel:'Perfect',citations:'42,500+',heat:'Hot',keywords:['NLP','大语言模型','GPT'],abstract:'提出GPT-3——1750亿参数的自回归语言模型，展示了惊人的少样本学习能力。无需微调即可在翻译、问答、文本生成等任务上达到竞争性表现。首次系统研究了规模与能力的关系，引发了"涌现能力"的研究热潮。'},
  { id:'p4',title:'Efficient Transformers: A Survey',authors:'Tay et al.',venue:'ACM Computing Surveys 2022',year:2022,ccf:'B',match:'partial',matchLabel:'Partial',citations:'2,300+',heat:'Warm',keywords:['NLP','Transformer','效率'],abstract:'系统综述了47种高效Transformer变体，按稀疏注意力、线性注意力、低秩近似、核方法等类别进行分类。详细对比了各方法的复杂度、适用场景和性能权衡，为选择高效Transformer提供了决策框架。'},
  { id:'p12',title:'LoRA: Low-Rank Adaptation of Large Language Models',authors:'Hu et al.',venue:'ICLR 2022',year:2022,ccf:'B',match:'perfect',matchLabel:'Perfect',citations:'15,800+',heat:'Hot',keywords:['NLP','微调','LoRA'],abstract:'提出低秩适应（LoRA）方法用于大语言模型的高效微调。通过在Transformer层中注入可训练的低秩矩阵，将可训练参数量减少了10000倍，GPU显存需求降低3倍，同时保持或超越全参数微调的性能。'},
  { id:'p13',title:'Training language models to follow instructions (InstructGPT)',authors:'Ouyang et al.',venue:'NeurIPS 2022',year:2022,ccf:'A',match:'perfect',matchLabel:'Perfect',citations:'12,400+',heat:'Hot',keywords:['NLP','对齐','RLHF'],abstract:'提出基于人类反馈的强化学习（RLHF）方法对GPT-3进行指令微调。InstructGPT模型在遵循用户意图方面显著优于GPT-3，同时减少了有害输出。是该领域最被广泛引用的方法之一。'},
  { id:'p14',title:'Chain-of-Thought Prompting Elicits Reasoning',authors:'Wei et al.',venue:'NeurIPS 2022',year:2022,ccf:'A',match:'perfect',matchLabel:'Perfect',citations:'9,600+',heat:'Hot',keywords:['NLP','推理','提示工程'],abstract:'提出思维链（Chain-of-Thought）提示技术，通过在提示中提供中间推理步骤来激发大语言模型的推理能力。在算术推理任务上，PaLM 540B的准确率从17%提升至58%。该方法已成为大模型推理的标准范式。'},
  // ===== Computer Vision =====
  { id:'p5',title:'Swin Transformer: Hierarchical Vision Transformer',authors:'Liu et al.',venue:'ICCV 2021',year:2021,ccf:'A',match:'perfect',matchLabel:'Perfect',citations:'18,500+',heat:'Hot',keywords:['CV','Transformer','Swin'],abstract:'提出Swin Transformer——一种层次化视觉Transformer架构。通过移位窗口机制在局部窗口内计算自注意力，实现了线性复杂度。在ImageNet分类、COCO目标检测和ADE20K语义分割三大视觉任务上达到SOTA，获ICCV 2021最佳论文奖。'},
  { id:'p15',title:'An Image is Worth 16x16 Words: Vision Transformer (ViT)',authors:'Dosovitskiy et al.',venue:'ICLR 2021',year:2021,ccf:'A',match:'perfect',matchLabel:'Perfect',citations:'28,300+',heat:'Hot',keywords:['CV','ViT','Transformer'],abstract:'将标准Transformer直接应用于图像分类，将图像分割为固定大小的patches作为输入序列。在大规模预训练（JFT-300M）后，ViT在多个图像识别基准上达到或超越CNN的SOTA性能，证明了纯Transformer架构在视觉领域的可行性。'},
  { id:'p16',title:'Segment Anything (SAM)',authors:'Kirillov et al.',venue:'ICCV 2023',year:2023,ccf:'A',match:'perfect',matchLabel:'Perfect',citations:'11,200+',heat:'Hot',keywords:['CV','分割','基础模型'],abstract:'提出Segment Anything Model（SAM）——面向通用图像分割的基础模型。在1100万图像、10亿掩码的超大规模数据集上训练，支持点、框、文本等多种提示方式，实现了零样本分割能力。被认为是计算机视觉领域的基础模型里程碑。'},
  { id:'p17',title:'YOLOv7: Trainable bag-of-freebies',authors:'Wang et al.',venue:'CVPR 2023',year:2023,ccf:'A',match:'partial',matchLabel:'Partial',citations:'7,800+',heat:'Hot',keywords:['CV','目标检测','YOLO'],abstract:'提出YOLOv7实时目标检测器，通过可训练的免费增强技术（bag-of-freebies）在速度和精度之间取得最优平衡。在MS COCO数据集上达到56.8% AP，推理速度30 FPS，在5-160 FPS范围内全面超越已有检测器。'},
  { id:'p18',title:'Stable Diffusion: High-Resolution Image Synthesis',authors:'Rombach et al.',venue:'CVPR 2022',year:2022,ccf:'A',match:'perfect',matchLabel:'Perfect',citations:'14,600+',heat:'Hot',keywords:['CV','生成模型','扩散模型'],abstract:'提出潜在扩散模型（Latent Diffusion Model/LDM），在压缩的潜在空间中进行扩散过程，大幅降低计算成本。Stable Diffusion基于LDM在LAION-5B数据集上训练，支持文本到图像生成，推动了AI艺术创作的大众化。'},
  // ===== Machine Learning =====
  { id:'p19',title:'Deep Residual Learning for Image Recognition (ResNet)',authors:'He et al.',venue:'CVPR 2016',year:2016,ccf:'A',match:'perfect',matchLabel:'Perfect',citations:'178,000+',heat:'Hot',keywords:['ML','深度学习','残差网络'],abstract:'提出残差学习框架（ResNet），通过跳连接（skip connection）解决了深层网络的退化问题。152层ResNet在ImageNet上达到3.57% top-5错误率，赢得了ILSVRC 2015所有项目的冠军。残差连接已成为深度学习的标准组件。'},
  { id:'p20',title:'Dropout: A Simple Way to Prevent Overfitting',authors:'Srivastava et al.',venue:'JMLR 2014',year:2014,ccf:'A',match:'partial',matchLabel:'Partial',citations:'52,900+',heat:'Warm',keywords:['ML','正则化','Dropout'],abstract:'提出Dropout正则化技术——训练时随机丢弃神经元，测试时使用全部神经元取平均。该简单但有效的方法显著减少了过拟合，在多个视觉和语音任务上提升了1-5%的性能。是现代深度学习中应用最广泛的正则化技术之一。'},
  { id:'p21',title:'Adam: A Method for Stochastic Optimization',authors:'Kingma et al.',venue:'ICLR 2015',year:2015,ccf:'A',match:'perfect',matchLabel:'Perfect',citations:'136,000+',heat:'Hot',keywords:['ML','优化器','Adam'],abstract:'提出Adam优化器，结合动量（Momentum）和自适应学习率（RMSprop）的优点。具有计算高效、内存需求小、超参数鲁棒等特性。已成为深度学习训练中最广泛使用的默认优化器，被PyTorch、TensorFlow等框架内置支持。'},
  // ===== Graph Neural Networks =====
  { id:'p22',title:'Graph Neural Networks for Drug Discovery',authors:'Gilmer et al.',venue:'ICML 2017',year:2017,ccf:'A',match:'perfect',matchLabel:'Perfect',citations:'8,900+',heat:'Warm',keywords:['GNN','药物发现','MPNN'],abstract:'提出消息传递神经网络（MPNN）框架，统一了多种图神经网络变体。将分子结构建模为图，节点为原子、边为化学键，通过迭代消息传递预测分子性质。在QM9数据集上的量子化学性质预测超越传统方法。'},
  { id:'p23',title:'Semi-Supervised Classification with Graph Convolutional Networks',authors:'Kipf et al.',venue:'ICLR 2017',year:2017,ccf:'A',match:'perfect',matchLabel:'Perfect',citations:'29,400+',heat:'Hot',keywords:['GNN','GCN','半监督学习'],abstract:'提出图卷积网络（GCN）——一种在图结构数据上高效进行半监督学习的可扩展方法。通过简化的谱图卷积进行节点级别的特征传播，在Cora、Pubmed等引文网络上的节点分类准确率显著超越传统方法。是目前最广泛使用的GNN架构。'},
  // ===== Reinforcement Learning =====
  { id:'p24',title:'Human-level control through deep RL (DQN)',authors:'Mnih et al.',venue:'Nature 2015',year:2015,ccf:'A',match:'perfect',matchLabel:'Perfect',citations:'31,900+',heat:'Hot',keywords:['RL','DQN','Atari'],abstract:'提出深度Q网络（DQN）——首个直接从高维感官输入学习控制策略的深度学习模型。通过经验回放和目标网络克服了RL中的不稳定问题，在49款Atari游戏中超越人类水平。开创了深度强化学习时代。'},
  { id:'p25',title:'PPO: Proximal Policy Optimization Algorithms',authors:'Schulman et al.',venue:'arXiv 2017',year:2017,ccf:'预印本',match:'partial',matchLabel:'Partial',citations:'18,700+',heat:'Hot',keywords:['RL','PPO','策略优化'],abstract:'提出近端策略优化（PPO）算法，是TRPO的简化改进。通过裁剪替代目标函数限制策略更新幅度，实现稳定高效的在线策略学习。已成为深度强化学习中应用最广泛的算法之一，被用于ChatGPT的RLHF训练。'},
  // ===== Multi-modal & Applications =====
  { id:'p26',title:'CLIP: Learning Transferable Visual Models',authors:'Radford et al.',venue:'ICML 2021',year:2021,ccf:'A',match:'perfect',matchLabel:'Perfect',citations:'21,600+',heat:'Hot',keywords:['多模态','CLIP','视觉语言'],abstract:'提出CLIP（Contrastive Language-Image Pre-training），通过4亿图文对进行对比预训练，学习可迁移的视觉概念。实现了强大的零样本图像分类能力，在30个视觉数据集上无需微调即可达到ResNet-50有监督训练的水平。'},
  { id:'p27',title:'Deep Learning for Protein Structure Prediction (AlphaFold2)',authors:'Jumper et al.',venue:'Nature 2021',year:2021,ccf:'A',match:'perfect',matchLabel:'Perfect',citations:'21,000+',heat:'Hot',keywords:['生物学','AlphaFold','蛋白质'],abstract:'提出AlphaFold2——基于深度学习的蛋白质结构预测模型。通过Evoformer架构处理MSA和pairwise特征，结合结构模块迭代优化三维坐标。在CASP14竞赛中大幅领先传统方法，中位GDT达到92.4，解决了50年的科学难题。'},
  { id:'p28',title:'LLaMA: Open and Efficient Foundation Language Models',authors:'Touvron et al.',venue:'arXiv 2023',year:2023,ccf:'预印本',match:'perfect',matchLabel:'Perfect',citations:'16,300+',heat:'Hot',keywords:['NLP','开源','LLaMA'],abstract:'提出LLaMA系列开源大语言模型（7B-65B参数），仅使用公开数据训练。LLaMA-13B在多数基准上超越GPT-3（175B），LLaMA-65B与Chinchilla和PaLM-540B竞争。推动了开源大语言模型生态的蓬勃发展。'},
  { id:'p29',title:'Diffusion Models Beat GANs on Image Synthesis',authors:'Dhariwal et al.',venue:'NeurIPS 2021',year:2021,ccf:'A',match:'perfect',matchLabel:'Perfect',citations:'7,500+',heat:'Hot',keywords:['CV','扩散模型','生成模型'],abstract:'证明扩散模型在图像生成任务上可以超越GAN。通过改进架构（U-Net + Attention）和分类器引导技术，在ImageNet 256×256上达到2.97 FID，首次在FID指标上全面超越BigGAN-deep。此后扩散模型成为图像生成的主流范式。'},
  { id:'p30',title:'Convolutional Neural Networks for Medical Image Analysis',authors:'Ronneberger et al.',venue:'MICCAI 2015',year:2015,ccf:'B',match:'partial',matchLabel:'Partial',citations:'65,800+',heat:'Warm',keywords:['CV','医学影像','U-Net'],abstract:'提出U-Net——专为生物医学图像分割设计的全卷积网络。通过对称的编码器-解码器结构和跳连接实现精确定位。在有限数据条件下（30张训练图像）仍能取得优异的分割效果，已被广泛应用于医学影像分析领域。'},
];

// 期刊降级数据
const fallbackJournals = [
  { name:'CVPR',ccf:'A',deadline:'2024年11月15日',urgent:false,rate:25.2,matchPct:92,matchClass:'high',submissions:'3,420'},
  { name:'ACL',ccf:'A',deadline:'2025年2月15日',urgent:false,rate:23.8,matchPct:88,matchClass:'high',submissions:'2,860'},
  { name:'EMNLP',ccf:'B',deadline:'2024年12月5日',urgent:true,rate:22.1,matchPct:76,matchClass:'mid',submissions:'2,150'},
  { name:'ICCV',ccf:'A',deadline:'2025年3月10日',urgent:false,rate:30.5,matchPct:65,matchClass:'low',submissions:'3,850'}
];

// 文献库降级数据
const fallbackLibrary = [
  { id:'lp1',title:'Attention Is All You Need',authors:'Vaswani et al.',venue:'NeurIPS 2017',ccf:'A',status:'read',progress:100,tags:['精读','方法论参考'],collected:'2024-09-15'},
  { id:'lp2',title:'BERT: Pre-training of Deep Bidirectional Transformers',authors:'Devlin et al.',venue:'NAACL 2019',ccf:'A',status:'read',progress:100,tags:['精读'],collected:'2024-09-20'},
  { id:'lp3',title:'Language Models are Few-Shot Learners',authors:'Brown et al.',venue:'NeurIPS 2020',ccf:'A',status:'reading',progress:72,tags:['方法论参考'],collected:'2024-10-01'},
  { id:'lp4',title:'Deep Learning for Protein Structure Prediction',authors:'Jumper et al.',venue:'Nature 2021',ccf:'A',status:'reading',progress:45,tags:['待讨论'],collected:'2024-10-05'},
  { id:'lp5',title:'Swin Transformer',authors:'Liu et al.',venue:'ICCV 2021',ccf:'A',status:'read',progress:100,tags:['精读','实验对比'],collected:'2024-10-12'},
  { id:'lp6',title:'Efficient Transformers: A Survey',authors:'Tay et al.',venue:'ACM Computing Surveys 2022',ccf:'B',status:'reading',progress:78,tags:['方法论参考'],collected:'2024-10-18'},
  { id:'lp7',title:'Contrastive Learning in Vision',authors:'Chen et al.',venue:'IJCV 2021',ccf:'A',status:'unread',progress:0,tags:['待讨论'],collected:'2024-11-01'},
  { id:'lp8',title:'Graph Neural Networks for Drug Discovery',authors:'Gilmer et al.',venue:'ICML 2017',ccf:'A',status:'read',progress:100,tags:['实验对比'],collected:'2024-11-05'},
  { id:'lp9',title:'RLHF: From Core Technical to Alignment',authors:'Ouyang et al.',venue:'NeurIPS 2022',ccf:'A',status:'unread',progress:0,tags:['待读列表'],collected:'2024-11-10'},
  { id:'lp10',title:'Federated Learning at the Edge',authors:'Lim et al.',venue:'IEEE COMST 2020',ccf:'C',status:'unread',progress:0,tags:[],collected:'2024-11-15'},
  { id:'lp11',title:'LoRA: Low-Rank Adaptation of LLMs',authors:'Hu et al.',venue:'ICLR 2022',ccf:'B',status:'reading',progress:45,tags:['方法论','精读'],collected:'2024-11-20'},
  { id:'lp12',title:'Chain-of-Thought Prompting',authors:'Wei et al.',venue:'NeurIPS 2022',ccf:'A',status:'unread',progress:0,tags:['待讨论'],collected:'2024-11-25'}
];

// ============================================================
// 五、数据加载与初始化
// ============================================================

/**
 * 从 API 加载全部数据，失败时使用降级数据
 * 加载顺序：论文 -> 期刊 -> 对话 -> 文献库 -> 统计数据
 * 加载完成后执行初始渲染
 */
async function loadData() {
  // 加载论文数据
  const paperData = await apiFetch('/papers?page_size=20');
  papers = (paperData && paperData.data) ? paperData.data : fallbackPapers;
  // 加载期刊数据
  const journalData = await apiFetch('/journals');
  journals = (journalData && journalData.data) ? journalData.data : fallbackJournals;
  // 加载对话数据 —— 逐个获取详情以填充 messages
  const convData = await apiFetch('/conversations');
  if (convData && convData.data) {
    conversations = [];
    for (const c of convData.data) {
      const detail = await apiFetch(`/conversations/${c.id}`);
      conversations.push(detail ? detail.data : c);
    }
  }
  if (!conversations.length) {
    conversations = [
      { id:'c1',title:'AI对话助手',preview:'DeepSeek驱动的科研对话...',messages:[
        {type:'ai',text:'**您好！我是研枢AI科研助手** \uD83D\uDC4B\n\n我由 DeepSeek 大语言模型驱动，可以帮助您：\n\n- \uD83D\uDCC4 **论文检索与阅读** - 搜索学术论文，AI辅助阅读\n- \u270D\uFE0F **科研撰写** - 撰写文献综述、润色论文、生成摘要\n- \uD83D\uDCCA **实验对比分析** - 对比不同方法的实验数据\n- \uD83C\uDFAF **投稿建议** - 推荐最合适的会议/期刊\n\n请告诉我您需要什么帮助？'}
      ]}
    ];
  }
  // 加载文献库数据
  const libData = await apiFetch('/library');
  libraryPapers = (libData && libData.data) ? libData.data : fallbackLibrary;
  // 执行初始渲染
  renderDailyRecs();
  renderPapers(0, 20);
  renderJournals();
  renderLibrary();
  renderConversationsList();
  updateFavBadge();

  // 更新论文数量显示
  const countEl = document.getElementById('paperCountDisplay');
  if (countEl) countEl.textContent = '共 ' + papers.length + ' 篇';

  // 异步更新统计栏数据
  apiFetch('/stats').then(data => {
    if (data && data.data) {
      const stats = document.querySelectorAll('.stat-number');
      if (stats[0]) stats[0].textContent = data.data.papers_today;
      if (stats[1]) stats[1].textContent = data.data.active_users;
      if (stats[2]) stats[2].textContent = data.data.reviews_writing;
      if (stats[3]) stats[3].textContent = data.data.deadline_alerts;
    }
  });
}

/**
 * 渲染侧边栏对话列表
 */
function renderConversationsList() {
  const list = document.getElementById('convList');
  if (!list) return;
  list.innerHTML = conversations.map((c,i) => `
    <div class="ai-conv-item ${i===currentConv?'active':''}" data-conv="${i}" onclick="switchConv(${i})">
      <div class="conv-title">${c.title}</div>
      <div class="conv-preview">${c.preview||''}</div>
      <span class="conv-delete-btn" onclick="event.stopPropagation();deleteConversation(${i})" title="删除对话">&times;</span>
    </div>
  `).join('');
}

/**
 * 处理预设话题点击 —— 构建定制化提示词发送给 DeepSeek
 * @param {string} topic - 预设话题标识符
 */
function pickTopic(topic) {
  const prompts = {
    literature_review: '请帮我撰写一篇关于「Transformer架构在自然语言处理中的应用」的文献综述。请按照以下结构组织：\n\n1. **研究背景与动机** - 简述该领域的发展历程\n2. **核心技术方法** - 分类介绍代表性工作\n3. **关键对比分析** - 用表格对比不同方法的优劣势\n4. **未来研究方向** - 指出当前挑战和趋势\n\n请使用学术风格撰写，引用真实论文。',
    paper_polish: '请帮我润色以下论文段落，使其更符合顶级会议的学术写作标准。请从以下三个维度优化：\n1. **语法与流畅度** - 修正不自然的表达\n2. **学术规范** - 统一术语、增强权威性\n3. **逻辑结构** - 强化论点的递进关系\n\n请先给出优化后的版本，再逐条说明修改理由。以下是我需要润色的内容：...',
    experiment_compare: '请帮我对比分析以下两种方法在某个任务上的表现。请用表格呈现对比结果，包含以下维度：\n\n| 对比维度 | 方法A | 方法B |\n|---------|-------|-------|\n| 核心思路 | | |\n| 参数量 | | |\n| 训练效率 | | |\n| 推理速度 | | |\n| 精度指标 | | |\n| 适用场景 | | |\n| 主要局限 | | |\n\n请基于真实论文数据填写，如果某个维度没有公开数据请注明。',
    paper_explain: '请帮我精读一篇论文，请按以下模板输出：\n\n## 📄 论文信息\n- 标题、作者、发表会议/期刊、年份\n\n## 🎯 核心贡献（3点）\n\n## 🔧 技术方法\n- 用通俗语言解释核心算法\n- 关键公式的含义\n- 与其他方法的本质区别\n\n## 📊 实验分析\n- 主要实验结果\n- 对比baseline的提升幅度\n- 消融实验的关键发现\n\n## 💡 个人思考\n- 该方法的创新点在哪里？\n- 存在哪些局限性？\n- 可以如何改进或扩展？',
    method_design: '请帮我设计一个实验方案。请按以下结构回答：\n\n## 研究问题定义\n## 基线方法\n## 提出的改进\n## 数据集选择\n## 评估指标\n## 实验设置（超参数、硬件等）\n## 预期结果与假设',
    submission_advice: '请根据以下论文信息，推荐最合适的投稿目标。请从以下维度分析：\n\n1. **研究方向匹配度** - 该论文与各会议/期刊主题的契合程度\n2. **录用率与竞争** - 近年录用趋势分析\n3. **时间规划** - 根据截稿日期倒推时间节点\n4. **投稿策略建议** - 主投/备选方案\n\n请给出排名前3的目标并说明理由。',
    code_help: '请帮我实现以下论文中的算法。请提供：\n\n1. **算法伪代码**\n2. **Python/PyTorch实现**（含关键注释）\n3. **使用示例**\n4. **常见注意事项**（数值稳定性、内存优化等）',
    research_trend: '请帮我分析「大语言模型」领域在2024-2025年的最新研究趋势。请包含：\n\n1. **五大热点方向** - 每个方向简述+代表性论文\n2. **技术路线图** - 从2023到2025的演进脉络\n3. **开源生态** - 主流模型和工具链\n4. **未来预测** - 接下来1-2年的可能突破点'
  };
  
  const prompt = prompts[topic] || '请用学术风格回答我的问题。';
  
  // 隐藏欢迎区域
  const welcome = document.getElementById('aiWelcome');
  if (welcome) welcome.style.display = 'none';
  
  // 显示删除按钮
  const delBtn = document.getElementById('aiDeleteBtn');
  if (delBtn) delBtn.style.display = '';
  
  // 设置输入框内容并发送
  const input = document.getElementById('aiInput');
  input.value = prompt;
  sendAiMessage();
}

// ============================================================
// 六、导航与侧边栏
// ============================================================

/**
 * 切换侧边栏折叠状态
 */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

/**
 * 页面导航 —— 切换活动页面并触发对应模块的渲染
 * @param {string} pageId - 目标页面 ID（如 'page-search', 'page-ai'）
 */
function navigateTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(pageId);
  target.classList.add('active');
  // 强制回流以重启动画
  void target.offsetWidth;
  // 通过移除再添加类名重新触发动画
  target.style.animation = 'none';
  void target.offsetWidth;
  target.style.animation = '';
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  if (navItem) navItem.classList.add('active');
  if (pageId === 'page-search') {
    const grid = document.getElementById('paperGrid');
    if (grid) { grid.innerHTML = ''; paperCount = 0; }
    renderDailyRecs();
    renderPapers(0, 20);
    const countEl = document.getElementById('paperCountDisplay');
    if (countEl) countEl.textContent = '共 ' + papers.length + ' 篇';
    updateFavBadge();
  }
  if (pageId === 'page-submit') {
    renderJournals();
    setTimeout(initTrendChart, 100);
    setTimeout(function() {
      var wcs = $('wordCloudSection'), dts = $('detailTrendSection');
      if (wcs) wcs.style.display = '';
      if (dts) dts.style.display = '';
      initWordCloud();
      initDetailTrendChart();
    }, 200);
  }
  if (pageId === 'page-ai') {
    renderConversationsList();
    switchConv(currentConv);
  }
  if (pageId === 'page-library') renderLibrary();
  if (pageId === 'page-favorites') renderFavoritesPage();
  if (pageId === 'page-notifications') renderNotificationsPage();
}

// ============================================================
// 七、搜索与论文渲染
// ============================================================

// 搜索历史本地存储键
const STORAGE_KEY = 'deepknow_search_history';

/**
 * 获取搜索历史记录
 * 首次访问时自动初始化默认历史
 */
function getSearchHistory() {
  let data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    const defaults = ['Transformer 综述', '对比学习 计算机视觉', '大语言模型 对齐', '图神经网络 药物发现', '联邦学习 边缘计算'];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  }
  return JSON.parse(data);
}

/**
 * 保存搜索历史
 */
function saveSearchHistory(history) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

/**
 * 显示搜索历史下拉面板
 */
function showSearchHistory() {
  const panel = document.getElementById('searchHistoryPanel');
  const history = getSearchHistory();
  const list = document.getElementById('searchHistoryList');
  if (!list) return;
  list.innerHTML = '';
  if (history.length === 0) {
    list.innerHTML = '<li class="search-history-empty">暂无搜索记录</li>';
  } else {
    history.forEach((item, i) => {
      const li = document.createElement('li');
      li.className = 'search-history-item';
      li.innerHTML = '<span class="search-history-item-text" onclick="fillSearch(\''+item.replace(/'/g,"\\'")+'\')">'+item+'</span><span class="search-history-item-del" onclick="delSearchHistory('+i+')">&times;</span>';
      list.appendChild(li);
    });
  }
  panel.classList.add('active');
}

/**
 * 隐藏搜索历史下拉面板
 */
function hideSearchHistory() {
  const panel = document.getElementById('searchHistoryPanel');
  if (panel) panel.classList.remove('active');
}

// 点击搜索框外部区域关闭搜索结果面板
document.addEventListener('click', function(e){
  const box = document.querySelector('.search-box');
  const panel = document.getElementById('searchHistoryPanel');
  // 如果点击不在搜索框区域内，关闭面板
  if(!box.contains(e.target)){
    hideSearchHistory();
  }
})

/**
 * 将历史条目文本填入搜索框
 */
function fillSearch(text) {
  document.getElementById('searchInput').value = text;
  hideSearchHistory();
}

/**
 * 将当前搜索输入添加到历史记录（去重，最多保留 10 条）
 */
function addSearchHistory() {
  const input = document.getElementById('searchInput');
  const val = input.value.trim();
  if (!val) return;
  let history = getSearchHistory();
  history = history.filter(h => h !== val);
  history.unshift(val);
  if (history.length > 10) history = history.slice(0, 10);
  saveSearchHistory(history);
  hideSearchHistory();
}

/**
 * 删除指定索引的搜索历史条目
 */
function delSearchHistory(idx) {
  let history = getSearchHistory();
  history.splice(idx, 1);
  saveSearchHistory(history);
  showSearchHistory();
}

/**
 * 清空全部搜索历史
 */
function clearSearchHistory() {
  saveSearchHistory([]);
  showSearchHistory();
}

// 按 Escape 键关闭搜索历史面板
document.addEventListener('keydown', e => { if (e.key === 'Escape') hideSearchHistory(); });

// 过滤器标签指示器动画
function moveFilterIndicator(el) {
  const indicator = document.getElementById('filterIndicator');
  const container = document.getElementById('filterTags');
  if (!indicator || !container) return;
  const containerRect = container.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  indicator.style.left = (elRect.left - containerRect.left) + 'px';
  indicator.style.width = elRect.width + 'px';
}

// 过滤器标签点击切换
document.querySelectorAll('.filter-tag').forEach(tag => {
  tag.addEventListener('click', function() {
    document.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
    this.classList.add('active');
    moveFilterIndicator(this);
  });
});

// 已渲染的论文卡片数量计数器
let paperCount = 0;

/**
 * 渲染论文卡片到页面网格中
 * @param {number} start - 起始索引
 * @param {number} count - 渲染数量
 */
function renderPapers(start, count) {
  const grid = document.getElementById('paperGrid');
  const end = Math.min(start + count, papers.length);
  for (let i = start; i < end; i++) {
    const p = papers[i];
    const card = document.createElement('div');
    card.className = 'paper-card';
    card.style.animationDelay = ((i-start)*0.04)+'s';
    card.innerHTML = '<div class="paper-card-top"><span class="ccf-badge level-'+p.ccf.toLowerCase()+'">CCF-'+p.ccf+'</span><span class="match-badge '+p.match+'">'+p.matchLabel+'</span></div><div class="paper-title" onclick="event.stopPropagation();openReading(\''+p.id+'\')">'+p.title+'</div><div class="paper-meta">'+p.authors+' | '+p.venue+'</div><div class="paper-abstract">'+p.abstract.replace('Transformer','<span class="hl">Transformer</span>').replace('BERT','<span class="hl">BERT</span>')+'</div><div class="paper-stats"><span>&#128202; '+p.citations+'</span><span>&#128293; '+p.heat+'</span></div><div class="paper-actions"><button class="btn-action" onclick="event.stopPropagation();openReading(\''+p.id+'\')">AI阅读</button><button class="btn-action" onclick="event.stopPropagation();openReading(\''+p.id+'\');switchReadingTab(null,\'similar\')">相似论文</button><button class="btn-action fav" data-id="'+p.id+'" data-title="'+p.title.replace(/'/g,"\\'")+'" onclick="event.stopPropagation();toggleFavPopover(this,\''+p.id+'\')">&#9825;</button></div>';
    grid.appendChild(card);
    paperCount++;
  }
  if (paperCount >= papers.length) document.querySelector('.load-more-wrap').style.display = 'none';
}

/**
 * "加载更多"论文 —— 模拟网络延迟后追加渲染
 */
function loadMorePapers() {
  const btn = document.querySelector('.btn-load-more');
  if (btn.classList.contains('loading')) return;
  btn.classList.add('loading');
  setTimeout(() => {
    renderPapers(paperCount, 6);
    btn.classList.remove('loading');
    assignTrends();
  }, 3000);
}

/**
 * 渲染"每日推荐"论文区域 —— 取引用量最高的 8 篇
 */
function renderDailyRecs() {
  const grid = $('dailyRecGrid');
  if (!grid) return;
  grid.innerHTML = '';
  // 按引用量降序排列，取前 8 篇
  const recs = [...papers].sort((a,b) => parseInt(b.citations.replace(/[,+]/g,'')) - parseInt(a.citations.replace(/[,+]/g,''))).slice(0, 8);
  
  recs.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'daily-rec-card';
    card.style.animationDelay = (i * 0.06) + 's';
    card.onclick = function() { openReading(p.id); };
    card.innerHTML = '<div class="daily-rec-rank">#' + (i+1) + '</div>'
      + '<div class="daily-rec-content">'
      + '<div class="daily-rec-title">' + p.title + '</div>'
      + '<div class="daily-rec-meta">' + p.authors + ' · ' + p.venue + '</div>'
      + '<div class="daily-rec-abstract">' + (p.abstract||'').substring(0, 100) + '...</div>'
      + '<div class="daily-rec-stats"><span class="ccf-badge level-' + (p.ccf||'A').toLowerCase() + '">CCF-' + (p.ccf||'A') + '</span><span>' + p.citations + ' 引用</span><span>' + p.heat + '</span></div>'
      + '</div>'
      + '<button class="btn-action" style="position:absolute;bottom:12px;right:12px;" onclick="event.stopPropagation();openReading(\''+p.id+'\')">阅读</button>';
    grid.appendChild(card);
  });
}

/**
 * 渲染过滤后的论文列表（用于迷你过滤器）
 */
function renderPapersFiltered(paperList, start, count) {
  const grid = $('paperGrid');
  const end = Math.min(start + count, paperList.length);
  for (let i = start; i < end; i++) {
    const p = paperList[i];
    const card = document.createElement('div');
    card.className = 'paper-card';
    card.style.animationDelay = ((i-start)*0.04)+'s';
    card.innerHTML = '<div class="paper-card-top"><span class="ccf-badge level-'+p.ccf.toLowerCase()+'">CCF-'+p.ccf+'</span><span class="match-badge '+p.match+'">'+p.matchLabel+'</span></div><div class="paper-title" onclick="event.stopPropagation();openReading(\''+p.id+'\')">'+p.title+'</div><div class="paper-meta">'+p.authors+' | '+p.venue+'</div><div class="paper-abstract">'+p.abstract+'</div><div class="paper-stats"><span>&#128202; '+p.citations+'</span><span>&#128293; '+p.heat+'</span></div><div class="paper-actions"><button class="btn-action" onclick="event.stopPropagation();openReading(\''+p.id+'\')">AI阅读</button><button class="btn-action" onclick="event.stopPropagation();openReading(\''+p.id+'\');switchReadingTab(null,\'similar\')">相似论文</button><button class="btn-action fav" data-id="'+p.id+'" data-title="'+p.title.replace(/'/g,"\\'")+'" onclick="event.stopPropagation();toggleFavPopover(this,\''+p.id+'\')">&#9825;</button></div>';
    grid.appendChild(card);
    paperCount++;
  }
}

// 迷你过滤器点击处理 —— 按 CCF 等级或关键词过滤论文
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('mini-filter')) {
    document.querySelectorAll('.mini-filter').forEach(f => f.classList.remove('active'));
    e.target.classList.add('active');
    const filter = e.target.textContent;
    const filtered = filter === '全部' ? papers : papers.filter(p => {
      if (filter === 'CCF-A') return p.ccf === 'A';
      return (p.keywords || []).some(k => k.toLowerCase().includes(filter.toLowerCase())) || p.venue.toLowerCase().includes(filter.toLowerCase());
    });
    const grid = $('paperGrid');
    if (grid) {
      grid.innerHTML = '';
      paperCount = 0;
      renderPapersFiltered(filtered, 0, 6);
    }
  }
});

// ============================================================
// 八、收藏系统
// ============================================================

// 本地存储键名
const FAV_KEY = 'deepknow_favorites';
const FAV_FOLDER_KEY = 'deepknow_fav_folders';
const FAV_META_KEY = 'deepknow_fav_meta';
// 待收藏目标状态
let favTargetId = null;
let favTargetBtn = null;

/**
 * 获取收藏论文 ID 列表
 */
function getFavorites() {
  return JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
}

/**
 * 获取收藏文件夹列表
 */
function getFavFolders() {
  return JSON.parse(localStorage.getItem(FAV_FOLDER_KEY) || '["毕业设计","综述撰写","待读列表"]');
}

/**
 * 保存收藏文件夹列表
 */
function saveFavFolders(folders) {
  localStorage.setItem(FAV_FOLDER_KEY, JSON.stringify(folders));
}

/**
 * 获取收藏元数据（文件夹、标签、时间）
 */
function getFavMeta() {
  return JSON.parse(localStorage.getItem(FAV_META_KEY) || '{}');
}

/**
 * 保存收藏元数据
 */
function saveFavMeta(meta) {
  localStorage.setItem(FAV_META_KEY, JSON.stringify(meta));
}

/**
 * 更新导航栏收藏徽章数量
 */
function updateFavBadge() {
  const favs = getFavorites();
  const badge = document.getElementById('favBadge');
  if (!badge) return;
  if (favs.length > 0) {
    badge.style.display = 'inline-flex';
    badge.textContent = favs.length;
  } else {
    badge.style.display = 'none';
  }
}

/**
 * 切换收藏弹窗 —— 已收藏则确认取消，未收藏则显示收藏面板
 * @param {HTMLElement} btn - 触发按钮元素
 * @param {string} id - 论文 ID
 */
function toggleFavPopover(btn, id) {
  const favs = getFavorites();
  // 已收藏：确认取消收藏
  if (favs.includes(id)) {
    if (confirm('确定要取消收藏这篇论文吗？')) {
      favs.splice(favs.indexOf(id), 1);
      localStorage.setItem(FAV_KEY, JSON.stringify(favs));
      btn.classList.remove('active');
      btn.innerHTML = '&#9825;';
      updateFavBadge();
    }
    return;
  }
  // 显示收藏弹窗
  favTargetId = id;
  favTargetBtn = btn;
  const paperTitle = btn.getAttribute('data-title') || '论文';
  document.getElementById('favPopoverTitle').textContent = '收藏: ' + (paperTitle.length > 30 ? paperTitle.substring(0,30)+'...' : paperTitle);
  document.getElementById('favTagInput').value = '';
  // 渲染文件夹列表
  const folders = getFavFolders();
  const folderList = document.getElementById('favFolderList');
  folderList.innerHTML = '';
  folders.forEach(f => {
    const div = document.createElement('div');
    div.className = 'fav-folder-item';
    div.dataset.folder = f;
    div.textContent = '\u{1F4C2} ' + f;
    div.onclick = function() { selectFavFolder(this); };
    folderList.appendChild(div);
  });
  // 默认选中第一个文件夹
  if (folderList.firstChild) folderList.firstChild.classList.add('selected');
  // 根据按钮位置定位弹窗
  const popover = document.getElementById('favPopover');
  const rect = btn.getBoundingClientRect();
  popover.style.position = 'fixed';
  popover.style.left = Math.max(10, Math.min(rect.left, window.innerWidth - 280)) + 'px';
  popover.style.top = (rect.bottom + 6) + 'px';
  popover.style.display = 'block';
}

/**
 * 选中收藏文件夹
 */
function selectFavFolder(el) {
  document.querySelectorAll('.fav-folder-item').forEach(f => f.classList.remove('selected'));
  el.classList.add('selected');
}

/**
 * 创建新的收藏文件夹
 */
function createFavFolder() {
  const input = document.getElementById('favNewFolderInput');
  const name = input.value.trim();
  if (!name) return;
  const folders = getFavFolders();
  if (folders.includes(name)) { alert('文件夹已存在'); return; }
  folders.push(name);
  saveFavFolders(folders);
  input.value = '';
  // 刷新文件夹列表，新文件夹默认选中
  const folderList = document.getElementById('favFolderList');
  const div = document.createElement('div');
  div.className = 'fav-folder-item selected';
  div.dataset.folder = name;
  div.textContent = '\u{1F4C2} ' + name;
  div.onclick = function() { selectFavFolder(this); };
  document.querySelectorAll('.fav-folder-item').forEach(f => f.classList.remove('selected'));
  folderList.appendChild(div);
}

/**
 * 确认收藏操作 —— 保存论文 ID、元数据并更新 UI
 */
function confirmFav() {
  if (!favTargetId || !favTargetBtn) return;
  const selectedFolder = document.querySelector('.fav-folder-item.selected');
  const folder = selectedFolder ? selectedFolder.dataset.folder : '默认';
  const tags = document.getElementById('favTagInput').value.trim().split(',').map(t => t.trim()).filter(t => t);
  // 保存收藏 ID
  let favs = getFavorites();
  if (!favs.includes(favTargetId)) {
    favs.push(favTargetId);
    localStorage.setItem(FAV_KEY, JSON.stringify(favs));
  }
  // 保存收藏元数据
  const meta = getFavMeta();
  meta[favTargetId] = { folder: folder, tags: tags, time: new Date().toLocaleDateString() };
  saveFavMeta(meta);
  // 更新按钮状态
  favTargetBtn.classList.add('active');
  favTargetBtn.innerHTML = '&#10084;';
  updateFavBadge();
  cancelFav();
}

/**
 * 取消收藏操作，关闭弹窗
 */
function cancelFav() {
  document.getElementById('favPopover').style.display = 'none';
  favTargetId = null;
  favTargetBtn = null;
}

// 点击弹窗外区域关闭收藏面板
document.addEventListener('click', function(e) {
  const popover = document.getElementById('favPopover');
  if (popover && popover.style.display === 'block') {
    if (!popover.contains(e.target) && !e.target.closest('.btn-action.fav')) {
      cancelFav();
    }
  }
});

// ============================================================
// 九、AI 对话系统
// ============================================================

// 当前激活的对话索引
let currentConv = 0;

/**
 * 切换对话
 * @param {number} idx - 目标对话的索引
 */
function switchConv(idx) {
  currentConv = idx;
  document.querySelectorAll('.ai-conv-item').forEach((el,i) => el.classList.toggle('active',i==idx));
  
  const msgs = conversations[idx].messages;
  const isEmpty = msgs.length <= 1 && (!msgs[0] || !msgs[0].text || msgs[0].text.trim() === '');
  const welcome = document.getElementById('aiWelcome');
  const delBtn = document.getElementById('aiDeleteBtn');
  
  if (isEmpty) {
    if (welcome) welcome.style.display = '';
    if (delBtn) delBtn.style.display = 'none';
    const container = document.getElementById('aiMessages');
    if (container) {
      container.innerHTML = '';
      if (welcome) container.appendChild(welcome);
    }
  } else {
    if (welcome) welcome.style.display = 'none';
    if (delBtn) delBtn.style.display = '';
    renderMessages(msgs);
  }
  
  const titleEl = document.getElementById('aiCurrentTitle');
  if (titleEl) titleEl.textContent = conversations[idx].title !== '新对话' ? conversations[idx].title : '';
}

/**
 * 创建新对话
 */
function newConversation() {
  conversations.unshift({
    id: 'c' + Date.now(),
    title: '新对话',
    preview: '点击开始新的科研对话...',
    messages: [{ type: 'ai', text: '' }]  // 空消息，让欢迎区域显示
  });
  renderConversationsList();
  switchConv(0);
  // 显示欢迎区域
  const welcome = document.getElementById('aiWelcome');
  if (welcome) welcome.style.display = '';
  // 新对话隐藏删除按钮
  const delBtn = document.getElementById('aiDeleteBtn');
  if (delBtn) delBtn.style.display = 'none';
  showToast('已创建新对话', 'success');
}

/**
 * 删除指定对话
 * @param {number} idx - 对话索引
 */
function deleteConversation(idx) {
  if (conversations.length <= 1) return showToast('至少保留一个对话', 'warning');
  if (!confirm('确定要删除对话「' + conversations[idx].title + '」吗？')) return;
  conversations.splice(idx, 1);
  renderConversationsList();
  switchConv(0);
  showToast('对话已删除', 'success');
}

/**
 * 渲染对话消息列表 —— 包含完整的 5 阶段 Markdown 渲染管线
 * 
 * 阶段 1: 提取并保护代码块（%%CODEBLOCK_N%% 占位符）
 * 阶段 2: 规范化换行符
 * 阶段 3: 逐段落处理块级元素（表格 > 引用 > 标题 > 列表 > 普通段落）
 * 阶段 4: 恢复代码块并转义 HTML
 * 阶段 5: 包裹为学术内容容器
 * 
 * @param {Array} msgs - 消息对象数组 [{type:'user'|'ai', text:'...'}]
 */
function renderMessages(msgs) {
  const container = document.getElementById('aiMessages');
  if (!container) return;
  
  // 保留欢迎区域引用再清空容器
  const welcomeEl = document.getElementById('aiWelcome');
  container.innerHTML = '';
  // 重新追加隐藏的欢迎区域，以便后续恢复
  if (welcomeEl) { welcomeEl.style.display = 'none'; container.appendChild(welcomeEl); }
  
  msgs.forEach(m => {
    const div = document.createElement('div');
    div.className = 'ai-msg ' + m.type;

    let content = m.text || '';
    // 加载动画 HTML 直接保留
    if (content.includes('loading-dots')) {
      div.innerHTML = '<div class="ai-msg-avatar" style="background:linear-gradient(135deg,#2563EB,#7C3AED);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;width:32px;height:32px;border-radius:50%;flex-shrink:0;">AI</div><div class="ai-msg-bubble-new">' + content + '</div>';
    } else if (m.type === 'ai') {
      // ===== 生产级 Markdown 渲染管线 =====
      // 阶段 1: 提取并保护代码块
      const codeBlocks = [];
      content = content.replace(/```(\w*)\n([\s\S]*?)```/g, function(m, lang, code) {
        codeBlocks.push(code);
        return '%%CODEBLOCK_' + (codeBlocks.length-1) + '%%';
      });

      // 阶段 2: 规范化换行符
      content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      // 阶段 3: 逐段落处理块级元素
      const paragraphs = content.split(/\n\n+/);
      let html = '';
      let inList = false;
      let listType = '';

      /** 关闭当前列表标签 */
      function closeList() {
        if (inList) { html += '</' + listType + '>'; inList = false; listType = ''; }
      }

      /** 内联格式转换：加粗、斜体、行内代码、链接 */
      function inlineFormat(text) {
        return text
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
          .replace(/`([^`\n]+?)`/g, '<code class="md-inline-code">$1</code>')
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
          .replace(/\n/g, '<br/>');
      }

      for (let p of paragraphs) {
        const lines = p.split('\n');
        const firstLine = lines[0].trim();

        // 检测表格：以 | 开头且首行包含分隔符
        if (firstLine.startsWith('|') && firstLine.includes('|', 1)) {
          closeList();
          const rows = [];
          for (const line of lines) {
            const cells = line.split('|').filter(c => c.trim());
            if (cells.length > 0) rows.push(cells);
          }
          if (rows.length >= 1) {
            const hasHeader = rows.length >= 2 && rows[1].every(c => /^[-:\s]+$/.test(c));
            const startRow = hasHeader ? 2 : 0;
            html += '<table class="md-table"><thead><tr>';
            for (const cell of rows[0]) html += '<th>' + inlineFormat(cell.trim()) + '</th>';
            html += '</tr></thead><tbody>';
            for (let i = startRow; i < rows.length; i++) {
              html += '<tr>';
              for (const cell of rows[i]) html += '<td>' + inlineFormat(cell.trim()) + '</td>';
              html += '</tr>';
            }
            html += '</tbody></table>';
          }
          continue;
        }

        // 检测引用块：以 > 开头
        if (firstLine.startsWith('> ') || firstLine === '>') {
          closeList();
          const quoteLines = lines.map(l => l.replace(/^>\s?/, '')).join('\n');
          html += '<blockquote class="md-blockquote">' + inlineFormat(quoteLines) + '</blockquote>';
          continue;
        }

        // 检测各级标题
        if (firstLine.startsWith('### ')) { closeList(); html += '<h4 class="md-h4">' + inlineFormat(firstLine.slice(4)) + '</h4>'; continue; }
        if (firstLine.startsWith('## ')) { closeList(); html += '<h3 class="md-h3">' + inlineFormat(firstLine.slice(3)) + '</h3>'; continue; }
        if (firstLine.startsWith('# ')) { closeList(); html += '<h2 class="md-h2">' + inlineFormat(firstLine.slice(2)) + '</h2>'; continue; }

        // 检测有序列表：数字 + 分隔符开头
        if (/^\d+[.、）)]\s/.test(firstLine)) {
          if (!inList || listType !== 'ol') { closeList(); html += '<ol class="md-ol">'; inList = true; listType = 'ol'; }
          for (const line of lines) {
            const txt = line.replace(/^\d+[.、）)]\s*/, '');
            if (txt.trim()) html += '<li>' + inlineFormat(txt) + '</li>';
          }
          continue;
        }

        // 检测无序列表：- * 或 • 开头
        if (firstLine.startsWith('- ') || firstLine.startsWith('* ') || firstLine.startsWith('• ')) {
          if (!inList || listType !== 'ul') { closeList(); html += '<ul class="md-ul">'; inList = true; listType = 'ul'; }
          for (const line of lines) {
            const txt = line.replace(/^[-*•]\s*/, '');
            if (txt.trim()) html += '<li>' + inlineFormat(txt) + '</li>';
          }
          continue;
        }

        // 普通段落
        closeList();
        html += '<p class="md-p">' + inlineFormat(p) + '</p>';
      }
      closeList();

      // 阶段 4: 恢复代码块并转义 HTML 特殊字符
      html = html.replace(/%%CODEBLOCK_(\d+)%%/g, function(m, idx) {
        return '<pre class="md-pre"><code>' + codeBlocks[parseInt(idx)].replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</code></pre>';
      });

      // 阶段 5: 包裹为学术内容样式容器
      content = '<div class="ai-academic-content">' + html + '</div>';

      div.innerHTML = '<div class="ai-msg-avatar" style="background:linear-gradient(135deg,#2563EB,#7C3AED);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;width:32px;height:32px;border-radius:50%;flex-shrink:0;">AI</div><div class="ai-msg-bubble-new">' + content + '</div>';
      
      // 追加消息操作按钮
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'msg-actions-new';
      actionsDiv.innerHTML = '<button onclick="copyLastAiMessage()" title="复制回复">&#x1F4CB; 复制</button><button onclick="regenerateLastMessage()" title="重新生成">&#x1F504; 重试</button>';
      div.querySelector('.ai-msg-bubble-new').appendChild(actionsDiv);
    } else {
      // 用户消息：纯文本展示，转义 HTML 防止 XSS
      const escaped = content.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br/>');
      div.innerHTML = '<div class="ai-msg-avatar" style="background:var(--brand-blue);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;width:32px;height:32px;border-radius:50%;flex-shrink:0;">U</div><div class="ai-msg-bubble-new" style="max-width:600px;background:linear-gradient(135deg,#2563EB,#1D4ED8);color:#fff;border:none;padding:14px 18px;font-size:13px;">' + escaped + '</div>';
    }
    container.appendChild(div);
  });
  
  // 自动滚动到底部
  if (container.scrollTop !== undefined) {
    container.scrollTop = container.scrollHeight;
  }
}

/**
 * 发送 AI 消息 —— 优先使用 DeepSeek 流式 API，失败则降级为非流式调用
 * 包含智能错误处理：401/403 密钥错误、429 频率限制、网络错误自动重试
 */
async function sendAiMessage() {
  // 首条消息时隐藏欢迎区域
  const welcome = document.getElementById('aiWelcome');
  if (welcome) welcome.style.display = 'none';
  const delBtn = document.getElementById('aiDeleteBtn');
  if (delBtn) delBtn.style.display = '';
  
  const input = document.getElementById('aiInput');
  const text = input.value.trim();
  if (!text) return;

  const msgs = conversations[currentConv].messages;

  // 添加用户消息
  msgs.push({ type: 'user', text: text });
  // 添加加载占位符
  msgs.push({ type: 'ai', text: '<span class="loading-dots">正在思考<span>.</span><span>.</span><span>.</span></span>' });
  renderMessages(msgs);
  input.value = '';

  // 首条有意义消息时自动生成对话标题
  if ((conversations[currentConv].title === '新对话' || conversations[currentConv].title === 'AI对话助手') && text.length > 3) {
    conversations[currentConv].title = text.length > 25 ? text.substring(0, 25) + '...' : text;
    conversations[currentConv].preview = text.substring(0, 50) + (text.length > 50 ? '...' : '');
    renderConversationsList();
  }

  const aiMsgIdx = msgs.length - 1;

  try {
    // 构建 DeepSeek 格式的消息（排除加载占位符）
    const historyMsgs = msgs.slice(0, -1);
    const deepseekMsgs = buildDeepseekMessages(historyMsgs);

    // 优先尝试流式调用
    try {
      const stream = await deepseekChat(deepseekMsgs, true);
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let fullReply = '';
      let buffer = '';

      const container = document.getElementById('aiMessages');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留不完整的行在缓冲中

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.delta?.content;  // 仅取正式回复，忽略推理
            if (content) {
              fullReply += content;
              msgs[aiMsgIdx].text = fullReply;

              // 实时更新最后一个气泡
              const bubbles = container.querySelectorAll('#aiMessages .ai-msg-bubble-new');
              const lastBubble = bubbles[bubbles.length - 1];
              if (lastBubble) {
                lastBubble.textContent = fullReply;
                container.scrollTop = container.scrollHeight;
              }
            }
          } catch(e) {
            // 跳过格式异常的 JSON 行
          }
        }
      }

      msgs[aiMsgIdx] = { type: 'ai', text: fullReply };
      renderMessages(msgs);

    } catch(streamErr) {
      console.warn('流式调用失败，降级为非流式:', streamErr);
      // 降级为非流式调用
      const reply = await deepseekChat(deepseekMsgs, false);
      msgs[aiMsgIdx] = { type: 'ai', text: reply };
    }

  } catch(err) {
    console.error('DeepSeek API 错误:', err);
    // 根据错误类型进行智能降级回复
    let fallbackMsg = '';
    const status = err.status || 0;

    if (status === 401 || status === 403) {
      fallbackMsg = '**AI科研助手**\n\n\u26A0\uFE0F **API密钥无效**，无法连接DeepSeek服务。请联系管理员检查API密钥配置。';
    } else if (status === 429) {
      fallbackMsg = '**AI科研助手**\n\n\u26A0\uFE0F **请求频率过高**，DeepSeek API暂时限制了请求。请稍后再试。';
    } else if (status === 0 || err.message === 'Failed to fetch' || err.name === 'TypeError') {
      // 网络错误：自动重试一次
      console.log('网络错误，正在重试一次...');
      try {
        const retryReply = await deepseekChat(deepseekMsgs, false);
        msgs[aiMsgIdx] = { type: 'ai', text: retryReply };
        renderMessages(msgs);
        return;
      } catch(retryErr) {
        console.error('重试也失败了:', retryErr);
        fallbackMsg = '**AI科研助手**\n\n\u26A0\uFE0F **网络连接失败**，请检查网络后重试。已自动重试1次仍未成功。';
      }
    } else {
      fallbackMsg = '**AI科研助手**（DeepSeek API 暂时不可用，使用本地回复）\n\n\u2753 您的问题：「' + text + '」\n\n\u26A0\uFE0F **错误提示**：' + (err.message || '未知错误') + '\n\n\uD83D\uDCA1 **建议**：\n- 检查网络连接是否正常\n- 确认API密钥是否有效\n- 稍后重试或切换对话模式';
    }

    msgs[aiMsgIdx] = { type: 'ai', text: fallbackMsg };
  }

  renderMessages(msgs);
}

/**
 * 重新生成最后一条 AI 消息 —— 移除最后一条 AI 和对应的用户消息，重新发送
 */
async function regenerateLastMessage() {
  if (conversations[currentConv].messages.length < 2) return showToast('没有可重新生成的消息', 'warning');
  
  // 移除最后一条 AI 消息
  const msgs = conversations[currentConv].messages;
  const lastMsg = msgs.pop();
  if (lastMsg.type !== 'ai') { msgs.push(lastMsg); return; }
  
  // 同时移除配对的用户消息
  const userMsg = msgs[msgs.length - 1];
  if (userMsg && userMsg.type === 'user') {
    const userText = userMsg.text;
    msgs.pop();
    renderMessages(msgs);
    
    // 重新发送
    document.getElementById('aiInput').value = userText;
    await sendAiMessage();
  } else {
    renderMessages(msgs);
  }
}

/**
 * 复制最后一条 AI 消息到剪贴板
 */
function copyLastAiMessage() {
  const msgs = conversations[currentConv].messages;
  const lastAi = [...msgs].reverse().find(m => m.type === 'ai');
  if (!lastAi) return showToast('没有可复制的内容', 'warning');
  const text = lastAi.text.replace(/<[^>]*>/g, ''); // 去除 HTML 标签
  navigator.clipboard.writeText(text).then(() => showToast('已复制到剪贴板', 'success'));
}

// ============================================================
// 十、投稿分析与期刊渲染
// ============================================================

/**
 * 发送投稿对话消息 —— 流式调用 DeepSeek，实时显示 + Markdown 排版
 */
async function sendSubChat() {
  const input = document.getElementById('subChatInput');
  const text = input.value.trim();
  if (!text) return;

  const container = document.getElementById('subChatMsgs');

  // 添加用户消息气泡
  const userDiv = document.createElement('div');
  userDiv.className = 'ai-msg user';
  userDiv.style.maxWidth = '95%';
  const escapedText = text.replace(/</g,'&lt;').replace(/>/g,'&gt;');
  userDiv.innerHTML = '<div class="ai-msg-avatar" style="width:28px;height:28px;font-size:12px;">U</div><div class="ai-msg-bubble" style="font-size:13px">' + escapedText + '</div>';
  container.appendChild(userDiv);

  // 添加加载动画
  const aiDiv = document.createElement('div');
  aiDiv.className = 'ai-msg ai';
  aiDiv.style.maxWidth = '95%';
  aiDiv.innerHTML = '<div class="ai-msg-avatar" style="width:28px;height:28px;font-size:12px;">A</div><div class="ai-msg-bubble" style="font-size:13px"><span class="loading-dots">正在分析<span>.</span><span>.</span><span>.</span></span></div>';
  container.appendChild(aiDiv);
  container.scrollTop = container.scrollHeight;
  input.value = '';

  const aiBubble = aiDiv.querySelector('.ai-msg-bubble');

  try {
    const msgs = [
      { role: 'system', content: '你是研枢平台的AI投稿顾问。帮助研究人员分析投稿方向、匹配期刊会议、检查论文格式、分析审稿意见。回答应该专业、结构化，用Markdown格式，以中文为主。' },
      { role: 'user', content: text }
    ];

    // 流式调用，实时显示
    const streamBody = await deepseekChat(msgs, true);
    const reader = streamBody.getReader();
    const decoder = new TextDecoder();
    let fullReply = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            fullReply += content;
            // 实时渲染 Markdown 到气泡
            aiBubble.innerHTML = renderMdInline(fullReply);
            container.scrollTop = container.scrollHeight;
          }
        } catch(e) {}
      }
    }

    // 最终完整渲染
    aiBubble.innerHTML = renderMdInline(fullReply);
  } catch(err) {
    console.error('投稿对话 DeepSeek API 错误:', err);
    aiBubble.innerHTML = renderMdInline('**AI投稿顾问**\n\n⚠️ 服务暂时不可用：' + (err.message || '未知错误') + '\n\n请稍后重试。');
  }

  container.scrollTop = container.scrollHeight;
}

/**
 * 轻量 Markdown 行内渲染——用于流式过程中实时更新
 */
function renderMdInline(text) {
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // 粗体
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // 斜体
    .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
    // 行内代码
    .replace(/`([^`\n]+?)`/g, '<code style="background:#F1F5F9;padding:2px 6px;border-radius:4px;font-family:monospace;font-size:12px;">$1</code>')
    // 标题
    .replace(/^### (.+)$/gm, '<h4 style="font-size:14px;font-weight:600;margin:6px 0;">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="font-size:15px;font-weight:700;margin:8px 0;">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 style="font-size:16px;font-weight:700;margin:10px 0;">$1</h2>')
    // 无序列表
    .replace(/^- (.+)$/gm, '<li style="margin:2px 0;">$1</li>')
    // 换行
    .replace(/\n/g, '<br/>');
  // 包裹列表项
  html = html.replace(/(<li[^>]*>.*<\/li>)+/g, '<ul style="padding-left:18px;margin:4px 0;">$&</ul>');
  return html;
}

/**
 * 自动发送预设投稿消息
 */
function sendSubChatAuto(msg) {
  const input = $('subChatInput');
  if (input) { input.value = msg; sendSubChat(); }
}

/**
 * 渲染期刊卡片列表 —— 支持 CCF 等级和领域筛选
 */
function renderJournals() {
  const ccfFilter = ($('subCcfFilter')?.value || 'all');
  const domainFilter = ($('subDomainFilter')?.value || 'all');
  let displayJournals = journals;
  if (ccfFilter !== 'all') displayJournals = displayJournals.filter(j => j.ccf === ccfFilter);
  if (domainFilter !== 'all') displayJournals = displayJournals.filter(j => (j.domain||'') === domainFilter);
  
  const grid = $('journalGrid');
  if (!grid) return;
  grid.innerHTML = '';
  
  displayJournals.forEach(j => {
    // 录用率环形图计算
    const r = 20; const circumference = 2 * Math.PI * r;
    const offset = circumference * (1 - j.rate / 100);
    // 判断是否即将截稿（14天内）
    const isUrgent = j.urgent || (j.deadline && new Date(j.deadline) - new Date() < 14 * 24 * 60 * 60 * 1000);
    const competitionStars = j.rate < 20 ? '⭐⭐⭐⭐⭐' : j.rate < 25 ? '⭐⭐⭐⭐' : '⭐⭐⭐';
    
    const card = document.createElement('div');
    card.className = 'journal-card-new' + (isUrgent ? ' deadline-urgent' : '');
    card.onclick = function(e) { if (e.target.tagName === 'BUTTON') return; showJournalDetail(j.name); };
    
    card.innerHTML = '<div class="journal-card-top"><span class="ccf-badge level-'+j.ccf.toLowerCase()+'">CCF-'+j.ccf+'</span> '+j.name+(isUrgent?' <span class="deadline-urgent-tag">🔴 即将截稿</span>':'')+'</div>'
      + '<div class="journal-card-meta"><span>截稿: <strong class="'+(isUrgent?'deadline-urgent-text':'')+'">'+(j.deadline||'待定')+'</strong></span>'+(j.location?'<span>📍 '+j.location+'</span>':'')+'</div>'
      + '<div class="journal-card-stats"><div class="journal-ring-wrap"><svg width="52" height="52"><circle cx="26" cy="26" r="'+r+'" fill="none" stroke="#E5E7EB" stroke-width="3"/><circle cx="26" cy="26" r="'+r+'" fill="none" stroke="'+(j.rate>28?'#059669':j.rate>22?'#F59E0B':'#DC2626')+'" stroke-width="3" stroke-dasharray="'+circumference+'" stroke-dashoffset="'+offset+'" transform="rotate(-90 26 26)" stroke-linecap="round"/><text x="26" y="22" text-anchor="middle" font-size="12" font-weight="700" fill="var(--text-dark)">'+j.rate+'%</text><text x="26" y="36" text-anchor="middle" font-size="8" fill="var(--text-light)">录用率</text></svg></div>'
      + '<div><span style="display:block;font-size:12px;color:var(--text-mid);">投稿: '+(j.submissions||0).toLocaleString()+'</span><span style="display:block;font-size:12px;color:var(--text-mid);">方向: '+(j.domain||'综合')+'</span><span style="display:block;font-size:12px;color:var(--text-mid);">竞争: '+competitionStars+'</span></div></div>'
      + '<button class="btn-action" onclick="event.stopPropagation();sendSubChatAuto(\'帮我分析'+j.name+'的投稿策略\')">AI分析投稿策略</button>';
    grid.appendChild(card);
  });
}

/**
 * 显示期刊详情弹窗
 */
function showJournalDetail(journalName) {
  const j = journals.find(j => j.name === journalName);
  if (!j) return;
  const domains = j.domain || '通用';
  const location = j.location || '待定';
  const submissionsVal = (j.submissions||0).toLocaleString ? (j.submissions||0).toLocaleString() : String(j.submissions||0);
  const html = '<h3 style="margin-bottom:16px;font-size:18px;">'+j.name+' <span class="ccf-badge level-'+j.ccf.toLowerCase()+'">CCF-'+j.ccf+'</span></h3>' +
    '<p style="margin-bottom:8px;"><strong>全称：</strong>'+(j.fullName||j.name)+'</p>' +
    '<p style="margin-bottom:8px;"><strong>领域：</strong>'+domains+'</p>' +
    '<p style="margin-bottom:8px;"><strong>地点：</strong>'+location+'</p>' +
    '<p style="margin-bottom:8px;"><strong>截稿日期：</strong>'+(j.deadline||'待定')+'</p>' +
    '<p style="margin-bottom:8px;"><strong>录用率：</strong>'+j.rate+'%</p>' +
    '<p style="margin-bottom:8px;"><strong>投稿数：</strong>'+submissionsVal+'</p>' +
    '<p style="margin-bottom:16px;"><strong>匹配度：</strong><span style="color:'+(j.matchPct>85?'#059669':j.matchPct>70?'#F59E0B':'#9CA3AF')+';font-weight:700;font-size:18px;">'+j.matchPct+'%</span></p>' +
    '<button onclick="document.getElementById(\'journalDetailOverlay\').style.display=\'none\'" style="padding:8px 24px;border-radius:24px;border:none;background:var(--brand-blue);color:white;cursor:pointer;font-size:13px;font-family:var(--font-cn);">关闭</button>';
  let overlay = $('journalDetailOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'journalDetailOverlay';
    overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:5000;align-items:center;justify-content:center;';
    overlay.onclick = function(e) { if (e.target===overlay) overlay.style.display='none'; };
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = '<div style="background:white;border-radius:16px;padding:28px;width:440px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.15);animation:dropIn 0.25s ease;">'+html+'</div>';
  overlay.style.display = 'flex';
}

// ECharts 录用趋势图表实例
let trendChart = null;
/**
 * 初始化录用率趋势 ECharts 图表
 */
function initTrendChart() {
  if (typeof echarts === 'undefined') return;
  const dom = document.getElementById('trendChart');
  if (!dom) return;
  if (trendChart) { trendChart.resize(); return; }
  trendChart = echarts.init(dom);
  trendChart.setOption({
    tooltip: {
      trigger:'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#E5E7EB',
      borderWidth: 1,
      textStyle: { fontFamily:'Noto Sans SC', fontSize:12, color:'#111827' },
      formatter: function(params) {
        let s = '<strong style="font-size:13px;">'+params[0].axisValue+'</strong><br/>';
        params.forEach(p => {
          s += '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:'+p.color+';margin-right:6px;"></span>'
            + p.seriesName + ': <strong>' + p.value + '%</strong><br/>';
        });
        return s;
      }
    },
    legend: { data:['CVPR','ACL','EMNLP'], bottom:0, textStyle:{ fontFamily:'Noto Sans SC', fontSize:12, color:'#4B5563' } },
    grid: { left:50, right:20, top:25, bottom:45 },
    xAxis: { type:'category', data:['2020','2021','2022','2023','2024'], axisLabel:{ fontFamily:'Instrument Sans', color:'#9CA3AF' }, axisLine:{ lineStyle:{ color:'#E5E7EB' } } },
    yAxis: { type:'value', name:'录用率(%)', min:15, max:35, axisLabel:{ fontFamily:'Instrument Sans', color:'#9CA3AF' }, nameTextStyle:{ color:'#9CA3AF', fontSize:11 }, splitLine:{ lineStyle:{ color:'#F3F4F6', type:'dashed' } } },
    series: [
      { name:'CVPR', type:'line', smooth:true, data:[28.5,27.9,26.3,25.8,25.2], lineStyle:{ width:3, color:'#1A56DB' }, itemStyle:{ color:'#1A56DB' }, areaStyle:{ color:'rgba(26,86,219,0.08)' }, symbol:'circle', symbolSize:6 },
      { name:'ACL', type:'line', smooth:true, data:[25.6,24.8,24.1,23.5,23.8], lineStyle:{ width:3, color:'#7C3AED' }, itemStyle:{ color:'#7C3AED' }, areaStyle:{ color:'rgba(124,58,237,0.08)' }, symbol:'circle', symbolSize:6 },
      { name:'EMNLP', type:'line', smooth:true, data:[24.2,24.5,23.0,22.4,22.1], lineStyle:{ width:3, color:'#059669' }, itemStyle:{ color:'#059669' }, areaStyle:{ color:'rgba(5,150,105,0.08)' }, symbol:'circle', symbolSize:6 }
    ]
  });
}

// ECharts 图表响应式缩放
window.addEventListener('resize', function() {
  if (trendChart) trendChart.resize();
});

// ============================================================
// 十一、文献库管理
// ============================================================

/**
 * 渲染文献库列表 —— 支持搜索过滤、阅读状态和进度条展示
 */
function renderLibrary() {
  const searchTerm = ($('libSearch')?.value || '').toLowerCase();
  const filtered = searchTerm ? libraryPapers.filter(p => p.title.toLowerCase().includes(searchTerm) || p.authors.toLowerCase().includes(searchTerm) || (p.tags||[]).some(t=>t.toLowerCase().includes(searchTerm))) : libraryPapers;
  const list = document.getElementById('libList');
  if (!list) return;
  list.innerHTML = '';
  filtered.forEach((p, i) => {
    const div = document.createElement('div');
    div.className = 'lib-item';
    div.dataset.index = i;
    const statusSymbol = p.status === 'read' ? '&#9679;' : p.status === 'reading' ? '&#9688;' : '&#9675;';
    const statusTitle = p.status === 'read' ? '已读' : p.status === 'reading' ? '在读' : '未读';
    const tagsHtml = p.tags.map(t => '<span class="tag-item">'+t+'</span>').join('');
    const progressHtml = p.status === 'reading' ? '<div class="lib-item-progress"><div class="progress-bar"><div class="progress-fill" style="width:'+p.progress+'%"></div></div><span class="progress-text">'+p.progress+'%</span></div>' : '';
    const ccfClass = p.ccf === '预印本' ? 'level-none' : 'level-'+p.ccf.toLowerCase();
    div.innerHTML = '<input type="checkbox" class="lib-item-checkbox" onchange="updateBatchBar()">' +
      '<span class="read-status '+p.status+'" title="'+statusTitle+'"></span>' +
      '<span class="ccf-badge '+ccfClass+'">'+(p.ccf==='预印本'?'预印本':'CCF-'+p.ccf)+'</span>' +
      '<div class="lib-item-info"><div class="lib-item-title">'+p.title+'</div><div class="lib-item-authors">'+p.authors+' | '+p.venue+'</div><div class="lib-item-tags">'+tagsHtml+'</div><div class="lib-item-venue" style="font-size:11px;color:var(--text-light);margin-top:2px;">收藏于 '+p.collected+'</div></div>' +
      progressHtml +
      '<div class="lib-item-actions"><button class="btn-action" onclick="openReading(\'p1\')">阅读</button><button class="btn-action" onclick="event.stopPropagation();editLibItem('+i+')">编辑</button></div>';
    list.appendChild(div);
  });
  // 更新文献库统计数据
  const readCount = libraryPapers.filter(p=>p.status==='read').length;
  const readingCount = libraryPapers.filter(p=>p.status==='reading').length;
  const unreadCount = libraryPapers.filter(p=>p.status==='unread').length;
  $('libTotalCount') && ($('libTotalCount').textContent = libraryPapers.length);
  $('libReadCount') && ($('libReadCount').textContent = readCount);
  $('libReadingCount') && ($('libReadingCount').textContent = readingCount);
  $('libUnreadCount') && ($('libUnreadCount').textContent = unreadCount);
}

/** 选择文件夹 */
function selectFolder(el) { document.querySelectorAll('.folder-item').forEach(f=>f.classList.remove('active')); el.classList.add('active'); }
/** 切换标签选中状态 */
function selectLibTag(el) { el.classList.toggle('active'); }

/** 切换文献库视图模式（列表/网格） */
function toggleLibView() {
  const btn = document.getElementById('libViewBtn');
  btn.innerHTML = btn.innerHTML.includes('列表') ? '&#9776; 网格' : '&#9776; 列表';
}

/** 更新批量操作栏 —— 显示选中数量 */
function updateBatchBar() {
  const checked = document.querySelectorAll('#libList .lib-item-checkbox:checked');
  const bar = document.getElementById('batchBar');
  const count = document.getElementById('batchCount');
  count.textContent = checked.length;
  bar.classList.toggle('active', checked.length > 0);
}

/** 编辑文献库条目笔记 */
function editLibItem(index) {
  const paper = libraryPapers[index];
  if (!paper) return;
  const note = prompt('编辑笔记：' + (paper.title || ''), paper.note || '');
  if (note !== null) {
    paper.note = note;
    renderLibrary();
    alert('✅ 笔记已更新');
  }
}

/** 文献库排序 */
function sortLibrary() {
  const sel = document.getElementById('libSort');
  const val = sel.value;
  var sorted = [...libraryPapers];
  if (val.includes('发表时间')) {
    sorted.sort(function(a,b) {
      var ya = parseInt(((a.venue||'').match(/\d{4}/)||['0'])[0]);
      var yb = parseInt(((b.venue||'').match(/\d{4}/)||['0'])[0]);
      return yb - ya;
    });
  } else if (val.includes('引用数')) {
    sorted.reverse();
  }
  libraryPapers = sorted;
  renderLibrary();
}

// ===== 批量操作 =====

/** 批量移动文献到文件夹 */
function batchMove() {
  const n = document.querySelectorAll('#libList .lib-item-checkbox:checked').length;
  if (n===0) return alert('请先选择文献');
  alert('将 ' + n + ' 篇文献移动到文件夹（Demo：弹出文件夹选择器）');
}
/** 批量添加标签 */
function batchTag() {
  const n = document.querySelectorAll('#libList .lib-item-checkbox:checked').length;
  if (n===0) return alert('请先选择文献');
  alert('为 ' + n + ' 篇文献批量添加标签（Demo：弹出标签输入）');
}
/** 批量删除文献 */
function batchDelete() {
  const checked = $$('#libList .lib-item-checkbox:checked');
  if (checked.length === 0) return showToast('请先选择文献', 'warning');
  if (!confirm('确定要删除选中的 ' + checked.length + ' 篇文献吗？此操作不可恢复。')) return;
  
  const ids = [];
  checked.forEach(cb => {
    const idx = parseInt(cb.closest('.lib-item').dataset.index);
    const paper = libraryPapers[idx];
    if (paper && paper.id) ids.push(paper.id);
  });
  
  // 尝试调用 API
  apiFetch('/library/batch-delete', { method:'POST', body: JSON.stringify(ids), headers:{'Content-Type':'application/json'} });
  
  // 本地删除
  ids.map(id => libraryPapers.findIndex(p => p.id === id))
     .filter(i => i >= 0)
     .sort((a,b)=>b-a)
     .forEach(i => libraryPapers.splice(i, 1));
  
  renderLibrary();
  showToast('已删除 ' + ids.length + ' 篇文献', 'success');
}

// ============================================================
// 十二、论文阅读面板
// ============================================================

/**
 * 打开论文阅读面板 —— 动态填充标题、摘要、元数据并加载阅读进度
 * @param {string} id - 论文 ID
 */
function openReading(id) {
  const paper = papers.find(p => p.id === id);
  if (!paper) { alert('打开论文阅读：'+id); return; }
  
  // 设置标题和元数据
  document.getElementById('readingTitle').textContent = paper.title;
  document.getElementById('readingTitle').dataset.paperId = id;
  document.getElementById('pdfDetailTitle').textContent = paper.title;
  document.getElementById('pdfDetailMeta').innerHTML = paper.authors + ' | ' + paper.venue + '<br>引用数: ' + paper.citations + ' | 年份: ' + (paper.year||'N/A');
  
  // 在阅读 AI 面板中设置摘要
  const aiContent = document.getElementById('readingAiContent');
  if (aiContent) {
    aiContent.innerHTML = '<h4 style="font-size:14px;font-weight:600;margin-bottom:8px;color:var(--text-dark);">论文摘要</h4>'
      + '<p>' + (paper.abstract || '暂无摘要') + '</p>'
      + '<div style="margin-top:16px;display:flex;flex-wrap:wrap;gap:6px;">'
      + (paper.keywords||[]).map(k => '<span style="padding:2px 10px;background:#EFF6FF;border-radius:12px;font-size:11px;color:var(--brand-blue);">' + k + '</span>').join('')
      + '</div>';
  }
  
  // 初始化阅读进度
  initReadingProgress(paper.id);
  
  // 显示阅读覆盖层
  document.getElementById('readingOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
  
  // 重置到 PDF 标签页
  const pdfTab = document.querySelector('.reading-tab');
  if (pdfTab) switchReadingTab(pdfTab, 'pdf');
}

/** 关闭阅读面板 */
function closeReading() {
  saveReadingProgress();
  document.getElementById('readingOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

/**
 * 切换阅读面板标签（PDF / AI  / 相似论文）
 */
function switchReadingTab(el, tab) {
  document.querySelectorAll('.reading-tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  if (tab === 'similar') {
    document.getElementById('readingPdf').style.display = 'none';
    document.getElementById('readingAi').style.width = '100%';
    document.getElementById('readingAiContent').innerHTML = '<h4 style="font-size:14px;font-weight:600;margin-bottom:8px;">引文网络关系图谱</h4><p style="font-size:12px;color:var(--text-light);margin-bottom:12px;">节点大小=引用量 | 颜色=研究方向 | 连线=引用关系</p><svg id="citationGraph" width="100%" height="480" style="background:#FAFBFC;border-radius:8px;border:1px solid #E5E7EB;"></svg><div id="graphTooltip" style="position:absolute;display:none;background:white;border:1px solid #E5E7EB;border-radius:8px;padding:12px;box-shadow:var(--shadow-lg);font-size:12px;z-index:5000;pointer-events:none;"></div>';
    setTimeout(initCitationGraph, 100);
    // 取消 AI 子标签选中状态
    document.querySelectorAll('.reading-ai-tab').forEach(t => t.classList.remove('active'));
  } else if (tab === 'ai') {
    document.getElementById('readingPdf').style.display = '';
    document.querySelector('.reading-ai').style.width = '';
    // 重置到摘要子标签
    const summaryTab = document.querySelector('.reading-ai-tab[onclick*="summary"]');
    if (summaryTab) switchReadingAiTab(summaryTab, 'summary');
  } else {
    document.getElementById('readingPdf').style.display = '';
    document.querySelector('.reading-ai').style.width = '';
  }
}

/**
 * 切换 AI 阅读子标签（速读/创新点/实验/问答/翻译/相似论文）
 */
function switchReadingAiTab(el, tab) {
  document.querySelectorAll('.reading-ai-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const contents = {
    summary:'<div class="ai-reading-summary">'
      + '<h4 style="font-size:15px;font-weight:700;margin-bottom:14px;color:var(--text-dark);border-bottom:2px solid var(--brand-blue);padding-bottom:6px;">AI 速读 / AI Quick Read</h4>'
      + '<p class="en"><strong>1. Core Idea and Motivation</strong><br>'
      + 'The Transformer architecture was introduced to address the fundamental limitations of recurrent neural networks (RNNs) in sequence transduction tasks. RNNs process tokens sequentially, which prevents parallelization within training examples and creates difficulties in capturing long-range dependencies due to vanishing gradients. The authors propose a novel architecture that relies entirely on self-attention mechanisms, eliminating recurrence and convolution entirely. This design enables significantly more parallelization and achieves state-of-the-art translation quality in substantially less training time.</p>'
      + '<p class="zh"><strong>1. 核心思想与动机</strong><br>'
      + 'Transformer架构的提出是为了解决循环神经网络（RNN）在序列转导任务中的根本性局限。RNN按顺序处理token，这阻止了训练样本内的并行化，并且由于梯度消失导致难以捕获长距离依赖。作者提出了一种全新的架构，完全依赖于自注意力机制，彻底摒弃了循环和卷积结构。这种设计实现了显著的并行化提升，并且在更短的训练时间内达到了最先进的翻译质量。</p>'
      + '<p class="en"><strong>2. Key Technical Innovations</strong><br>'
      + 'The Transformer introduces three critical innovations. First, the Scaled Dot-Product Attention computes attention scores as QK^T / sqrt(d_k), where the scaling factor prevents excessively large dot products that push softmax into regions with extremely small gradients. Second, Multi-Head Attention runs h independent attention functions in parallel, allowing the model to jointly attend to information from different representation subspaces at different positions. Third, Positional Encoding injects sequence order information via sinusoidal functions, enabling the model to leverage the order of tokens without requiring recurrence.</p>'
      + '<p class="zh"><strong>2. 关键技术创新</strong><br>'
      + 'Transformer引入了三项关键创新。首先，缩放点积注意力将注意力分数计算为 QK^T / sqrt(d_k)，缩放因子防止了过大的点积使softmax进入梯度极小的区域。其次，多头注意力并行运行h个独立的注意力函数，使模型能够从不同位置的不同表示子空间中联合关注信息。第三，位置编码通过正弦函数注入序列顺序信息，使模型无需循环结构即可利用token的顺序信息。</p>'
      + '<p class="en"><strong>3. Impact and Significance</strong><br>'
      + 'The Transformer achieved 28.4 BLEU on the WMT 2014 English-to-German translation task, improving upon the previous best result by over 2 BLEU. More importantly, it established a new paradigm that has since revolutionized not only machine translation but virtually every area of NLP — BERT, GPT, T5, and countless other architectures all build upon the Transformer foundation. Its influence has even extended to computer vision (ViT), audio processing, and computational biology, making it arguably the most influential deep learning architecture of the past decade.</p>'
      + '<p class="zh"><strong>3. 影响与意义</strong><br>'
      + 'Transformer在WMT 2014英德翻译任务上达到了28.4 BLEU，比此前最佳结果提高了超过2个BLEU点。更重要的是，它建立了一个新的范式，不仅彻底革新了机器翻译领域，还几乎影响了NLP的每一个领域——BERT、GPT、T5以及无数其他架构都建立在Transformer基础之上。其影响力甚至扩展到了计算机视觉（ViT）、音频处理和计算生物学，使其成为过去十年中最具影响力的深度学习架构。</p>'
      + '</div>',
    novelty:'<h4 style="font-size:14px;font-weight:600;margin-bottom:8px;color:var(--text-dark);">创新点分析</h4><p><strong>核心创新：</strong></p><ul style="padding-left:16px;margin-top:6px;"><li>完全摒弃RNN/CNN，纯注意力架构</li><li>多头注意力并行捕获多子空间特征</li><li>残差连接+LayerNorm实现深层训练</li><li>第一个可并行训练的序列转导模型</li></ul>',
    experiment:'<h4 style="font-size:14px;font-weight:600;margin-bottom:8px;color:var(--text-dark);">实验分析</h4><p><strong>主要实验结果：</strong></p><ul style="padding-left:16px;margin-top:6px;"><li>WMT 2014英德翻译：28.4 BLEU（SOTA）</li><li>WMT 2014英法翻译：41.0 BLEU（SOTA）</li><li>训练速度：8 GPU上12小时完成</li><li>在英语成分解析任务上也取得最优结果</li></ul>',
    qa:'<h4 style="font-size:14px;font-weight:600;margin-bottom:8px;color:var(--text-dark);">问答</h4><p>您可以在此询问关于论文内容的问题，AI将基于论文上下文进行回答。</p><p style="color:var(--text-light);margin-top:8px;">示例问题：为什么Transformer比RNN更适合长序列？</p>',
    translate:'<h4 style="font-size:14px;font-weight:600;margin-bottom:8px;color:var(--text-dark);">翻译</h4><p>选择论文中的文本段落，即可查看中文翻译。</p><p style="color:var(--text-mid);margin-top:8px;">选中PDF中的文字后，点击工具栏中的"翻译"按钮。</p>'
  };
  const contentDiv = document.getElementById('readingAiContent');
  if (tab === 'similar') {
    // 相似论文推荐卡片
    const similarPapers = [
      { title:'BERT: Pre-training of Deep Bidirectional Transformers', authors:'Devlin et al.', venue:'NAACL 2019', tag:'高引' },
      { title:'Language Models are Few-Shot Learners', authors:'Brown et al.', venue:'NeurIPS 2020', tag:'热门' },
      { title:'Swin Transformer: Hierarchical Vision Transformer', authors:'Liu et al.', venue:'ICCV 2021', tag:'相关' }
    ];
    let html = '<h4 style="font-size:14px;font-weight:600;margin-bottom:12px;color:var(--text-dark);">相似论文推荐</h4><div class="similar-grid">';
    similarPapers.forEach(sp => {
      html += '<div class="similar-card" onclick="event.stopPropagation();alert(\'打开论文：'+sp.title+'\')">'
        + '<div class="similar-card-title">'+sp.title+'</div>'
        + '<div class="similar-card-meta">'+sp.authors+' | '+sp.venue+'</div>'
        + '<span class="similar-card-tag">'+sp.tag+'</span>'
        + '</div>';
    });
    html += '</div>';
    contentDiv.innerHTML = html;
  } else {
    contentDiv.innerHTML = contents[tab] || contents.summary;
  }
}// ===== 公式解释数据 =====
const formulaData = {
  attention: {
    title:'缩放点积注意力公式',
    display:'Attention(Q,K,V) = softmax(QK<sup>T</sup> / &radic;d<sub>k</sub>) V',
    step:'该公式定义了缩放点积注意力的计算过程。首先将查询矩阵 Q 与键矩阵 K 的转置相乘，得到注意力分数矩阵。除以 &radic;d<sub>k</sub> 进行缩放以防止梯度消失，再通过 softmax 归一化为权重分布，最后与值矩阵 V 加权求和得到输出。',
    vars:'<span class="variable">Q</span> 查询矩阵，维度为 n &times; d<sub>k</sub><br><span class="variable">K</span> 键矩阵，维度为 m &times; d<sub>k</sub><br><span class="variable">V</span> 值矩阵，维度为 m &times; d<sub>v</sub><br><span class="variable">d<sub>k</sub></span> 缩放因子，通常取键向量的维度',
    meaning:'注意力机制的本质是"查询-键值对"的软寻址过程。Q 中的每个查询通过点积计算与所有键 K 的相关性，softmax 将相关性转化为概率分布，最终按概率加权聚合值 V。这种机制使模型能够自适应地关注输入序列中最相关的部分。'
  },
  multihead: {
    title:'多头注意力公式',
    display:'MultiHead(Q,K,V) = Concat(head<sub>1</sub>,...,head<sub>h</sub>) W<sup>O</sup>',
    step:'多头注意力机制将多个独立注意力头（head）的输出拼接后进行线性变换。每个头在不同的表示子空间中执行注意力计算，从而使模型能够同时关注不同类型的信息。',
    vars:'<span class="variable">head<sub>i</sub></span> 第 i 个注意力头的输出<br><span class="variable">h</span> 注意力头的数量（原始论文中 h=8）<br><span class="variable">W<sup>O</sup></span> 输出的线性变换权重矩阵',
    meaning:'多头注意力的核心思想是让模型从多个角度同时关注输入序列。每个头可以学习到不同的注意力模式（如语法关系、语义关联、位置邻近等），拼接后通过线性变换融合这些多视角信息，从而获得更丰富的特征表示。'
  },
  head: {
    title:'注意力头计算公式',
    display:'head<sub>i</sub> = Attention(QW<sub>i</sub><sup>Q</sup>, KW<sub>i</sub><sup>K</sup>, VW<sub>i</sub><sup>V</sup>)',
    step:'每个注意力头先对 Q、K、V 分别进行线性投影（乘以权重矩阵 W<sub>i</sub><sup>Q</sup>、W<sub>i</sub><sup>K</sup>、W<sub>i</sub><sup>V</sup>），再执行标准的缩放点积注意力计算。不同的头使用不同的投影矩阵，从而学习到不同的表示子空间。',
    vars:'<span class="variable">W<sub>i</sub><sup>Q</sup></span> 第 i 个头的查询投影矩阵<br><span class="variable">W<sub>i</sub><sup>K</sup></span> 第 i 个头的键投影矩阵<br><span class="variable">W<sub>i</sub><sup>V</sup></span> 第 i 个头的值投影矩阵',
    meaning:'线性投影的作用是将输入映射到不同的子空间。每个头通过独立的投影矩阵学习不同的特征变换，使得多头注意力能够捕获输入序列在不同语义空间中的关联模式。这是Transformer表达能力的关键来源。'
  }
};

/** 打开公式解释弹窗 */
function openFormulaInterpretation(name) {
  const data = formulaData[name];
  if (!data) return;
  document.getElementById('formulaTitle').textContent = data.title;
  document.getElementById('formulaDisplay').innerHTML = data.display;
  document.getElementById('formulaStepByStep').textContent = data.step;
  document.getElementById('formulaVariables').innerHTML = data.vars;
  document.getElementById('formulaMeaning').textContent = data.meaning;
  document.getElementById('formulaOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

/** 关闭公式弹窗 */
function closeFormulaModal() {
  document.getElementById('formulaOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

// 阅读面板收藏状态
let readingFavState = false;
/** 切换阅读面板中的收藏按钮状态 */
function toggleReadingFav() {
  const btn = document.getElementById('readingFavBtn');
  readingFavState = !readingFavState;
  if (readingFavState) {
    btn.innerHTML = '&#10084; 已收藏';
    btn.style.color = 'var(--brand-red)';
    btn.style.borderColor = 'var(--brand-red)';
  } else {
    btn.innerHTML = '&#9825; 收藏';
    btn.style.color = '';
    btn.style.borderColor = '';
  }
}

// ============================================================
// 十三、引文图谱与词云
// ============================================================

// 引文网络节点数据
var citationNodes = [
  { id:'current', label:'Attention Is All You Need', year:2017, citations:98700, group:'seed', x:300, y:250 },
  { id:'n1', label:'BERT', year:2019, citations:65200, group:'pretraining' },
  { id:'n2', label:'GPT-3', year:2020, citations:42500, group:'pretraining' },
  { id:'n3', label:'T5', year:2020, citations:18300, group:'pretraining' },
  { id:'n4', label:'ViT', year:2021, citations:34000, group:'vision' },
  { id:'n5', label:'Swin Transformer', year:2021, citations:18500, group:'vision' },
  { id:'n6', label:'DETR', year:2020, citations:14500, group:'vision' },
  { id:'n7', label:'LoRA', year:2022, citations:8900, group:'efficient' },
  { id:'n8', label:'FlashAttention', year:2022, citations:7600, group:'efficient' },
  { id:'n9', label:'Mamba', year:2023, citations:3200, group:'efficient' },
  { id:'n10', label:'Hyena', year:2023, citations:1800, group:'efficient' },
  { id:'n11', label:'RoPE', year:2022, citations:12500, group:'position' },
  { id:'n12', label:'ALiBi', year:2022, citations:4200, group:'position' },
  { id:'n13', label:'LLaMA', year:2023, citations:38000, group:'pretraining' },
  { id:'n14', label:'RAG', year:2020, citations:8900, group:'application' },
  { id:'n15', label:'AlignLM', year:2023, citations:5600, group:'application' }
];

// 引文网络边数据
var citationEdges = [
  { source:'current', target:'n1', weight:0.9, relation:'predecessor' },
  { source:'current', target:'n2', weight:0.7, relation:'successor' },
  { source:'current', target:'n3', weight:0.5, relation:'successor' },
  { source:'current', target:'n4', weight:0.6, relation:'inspired' },
  { source:'current', target:'n5', weight:0.5, relation:'inspired' },
  { source:'current', target:'n6', weight:0.4, relation:'inspired' },
  { source:'current', target:'n7', weight:0.6, relation:'improved' },
  { source:'current', target:'n8', weight:0.7, relation:'improved' },
  { source:'current', target:'n9', weight:0.3, relation:'successor' },
  { source:'current', target:'n10', weight:0.3, relation:'successor' },
  { source:'current', target:'n11', weight:0.4, relation:'improved' },
  { source:'current', target:'n12', weight:0.4, relation:'improved' },
  { source:'n1', target:'n2', weight:0.8, relation:'contemporary' },
  { source:'n1', target:'n13', weight:0.7, relation:'successor' },
  { source:'n1', target:'n11', weight:0.3, relation:'technical' },
  { source:'n2', target:'n13', weight:0.9, relation:'successor' },
  { source:'n4', target:'n5', weight:0.8, relation:'improved' },
  { source:'n4', target:'n6', weight:0.7, relation:'inspired' },
  { source:'n7', target:'n8', weight:0.5, relation:'contemporary' },
  { source:'n8', target:'n9', weight:0.4, relation:'technical' },
  { source:'n2', target:'n14', weight:0.5, relation:'inspired' },
  { source:'n14', target:'n15', weight:0.6, relation:'improved' }
];

// 节点分组颜色映射
var groupColors = {
  seed: '#F59E0B',
  pretraining: '#1A56DB',
  vision: '#059669',
  efficient: '#7C3AED',
  position: '#FF7C00',
  application: '#DC2626'
};

// 边关系样式映射
var relationStyles = {
  predecessor: { dash:'6,3', color:'#9CA3AF' },
  successor: { dash:'', color:'#1A56DB' },
  improved: { dash:'', color:'#3B82F6' },
  inspired: { dash:'', color:'#059669' },
  contemporary: { dash:'4,3', color:'#7C3AED' },
  technical: { dash:'', color:'#6B7280' }
};

// 引文图谱运行时状态
var citationGraphData = { nodes:[], edges:[], frameCount:0 };
var citationGraphRunning = false;

/** 创建 SVG 命名空间元素 */
function svgNS(tag) { return document.createElementNS('http://www.w3.org/2000/svg', tag); }

/** 初始化引文图谱力导向布局 */
function initCitationGraph() {
  var svg = document.getElementById('citationGraph');
  if (!svg) return;

  var centerX = svg.clientWidth / 2;
  var centerY = 240;

  var nodes = citationNodes.map(function(n, i) {
    return {
      id: n.id,
      label: n.label,
      year: n.year,
      citations: n.citations,
      group: n.group,
      x: n.id === 'current' ? centerX : Math.random() * svg.clientWidth * 0.75 + svg.clientWidth * 0.125,
      y: n.id === 'current' ? centerY : Math.random() * 380 + 50,
      vx: 0, vy: 0,
      fx: n.id === 'current' ? centerX : null,
      fy: n.id === 'current' ? centerY : null
    };
  });

  var edges = citationEdges.map(function(e) {
    return { source: e.source, target: e.target, weight: e.weight, relation: e.relation };
  });

  citationGraphData = { nodes: nodes, edges: edges, frameCount: 0 };
  citationGraphRunning = true;

  svg.innerHTML = '';

  var edgeGroup = svgNS('g');
  edgeGroup.setAttribute('class', 'citation-edges');
  svg.appendChild(edgeGroup);

  var nodeGroup = svgNS('g');
  nodeGroup.setAttribute('class', 'citation-nodes');
  svg.appendChild(nodeGroup);

  var centerNode = nodes.find(function(n) { return n.id === 'current'; });
  if (!centerNode) centerNode = nodes[0];

  renderCitationGraphFrame(svg);

  function step() {
    if (!citationGraphRunning) return;
    runCitationPhysics(centerX, centerY);
    renderCitationGraphFrame(svg);
    citationGraphData.frameCount++;
    if (citationGraphData.frameCount < 600) {
      requestAnimationFrame(step);
    }
  }
  requestAnimationFrame(step);
}

/** 力导向物理模拟 —— 计算节点排斥力和边吸引力 */
function runCitationPhysics(centerX, centerY) {
  var nodes = citationGraphData.nodes;
  var edges = citationGraphData.edges;

  // 节点间排斥力
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i];
    if (n.fx !== null) { n.x = n.fx; n.y = n.fy; n.vx = 0; n.vy = 0; continue; }

    for (var j = i + 1; j < nodes.length; j++) {
      var m = nodes[j];
      var dx = n.x - m.x, dy = n.y - m.y;
      var dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      var force = 5000 / (dist * dist);
      var fx = (dx / dist) * force, fy = (dy / dist) * force;
      n.vx += fx; n.vy += fy;
      if (m.fx === null) { m.vx -= fx; m.vy -= fy; }
    }

    // 向心力
    var cx = centerX - n.x, cy = centerY - n.y;
    var cdist = Math.sqrt(cx * cx + cy * cy);
    if (cdist > 0) {
      n.vx += cx * 0.002;
      n.vy += cy * 0.002;
    }

    // 阻尼
    n.vx *= 0.85;
    n.vy *= 0.85;

    n.x += n.vx;
    n.y += n.vy;

    // 边界约束
    n.x = Math.max(30, Math.min(580, n.x));
    n.y = Math.max(30, Math.min(450, n.y));
  }

  // 边吸引力
  for (var ei = 0; ei < edges.length; ei++) {
    var e = edges[ei];
    var src = nodes.find(function(n) { return n.id === e.source; });
    var tgt = nodes.find(function(n) { return n.id === e.target; });
    if (!src || !tgt) continue;
    if (src.fx !== null && tgt.fx !== null) continue;

    var dx = tgt.x - src.x, dy = tgt.y - src.y;
    var dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    var targetDist = 100 + (1 - e.weight) * 120;
    var force = (dist - targetDist) * 0.01 * e.weight;
    var fx = (dx / dist) * force, fy = (dy / dist) * force;

    if (src.fx === null) { src.vx += fx; src.vy += fy; }
    if (tgt.fx === null) { tgt.vx -= fx; tgt.vy -= fy; }
  }
}

/** 渲染引文图谱当前帧 */
function renderCitationGraphFrame(svg) {
  var nodes = citationGraphData.nodes;
  var edges = citationGraphData.edges;

  var edgeGroup = svg.querySelector('.citation-edges');
  edgeGroup.innerHTML = '';

  for (var i = 0; i < edges.length; i++) {
    var e = edges[i];
    var src = nodes.find(function(n) { return n.id === e.source; });
    var tgt = nodes.find(function(n) { return n.id === e.target; });
    if (!src || !tgt) continue;

    var style = relationStyles[e.relation] || relationStyles.successor;
    var lineW = 0.5 + e.weight * 2.5;

    var line = svgNS('line');
    line.setAttribute('x1', src.x);
    line.setAttribute('y1', src.y);
    line.setAttribute('x2', tgt.x);
    line.setAttribute('y2', tgt.y);
    line.setAttribute('stroke', style.color);
    line.setAttribute('stroke-width', lineW);
    line.setAttribute('stroke-opacity', '0.5');
    if (style.dash) line.setAttribute('stroke-dasharray', style.dash);
    line.setAttribute('class', 'citation-edge');
    line.setAttribute('data-source', e.source);
    line.setAttribute('data-target', e.target);
    edgeGroup.appendChild(line);
  }

  var nodeGroup = svg.querySelector('.citation-nodes');
  nodeGroup.innerHTML = '';

  var minCitations = 1800, maxCitations = 98700;
  var minRadius = 8, maxRadius = 20;

  for (var j = 0; j < nodes.length; j++) {
    var n = nodes[j];
    var radius = minRadius + (maxRadius - minRadius) * ((n.citations - minCitations) / (maxCitations - minCitations));
    var color = groupColors[n.group] || '#6B7280';

    var g = svgNS('g');
    g.setAttribute('class', 'citation-node');
    g.setAttribute('data-id', n.id);
    g.setAttribute('data-label', n.label);
    g.setAttribute('data-year', n.year);
    g.setAttribute('data-citations', n.citations);

    // 种子节点发光效果
    if (n.id === 'current') {
      var glow = svgNS('circle');
      glow.setAttribute('cx', n.x);
      glow.setAttribute('cy', n.y);
      glow.setAttribute('r', radius + 4);
      glow.setAttribute('fill', 'none');
      glow.setAttribute('stroke', '#F59E0B');
      glow.setAttribute('stroke-width', '2');
      glow.setAttribute('stroke-opacity', '0.3');
      g.appendChild(glow);
    }

    var circle = svgNS('circle');
    circle.setAttribute('cx', n.x);
    circle.setAttribute('cy', n.y);
    circle.setAttribute('r', radius);
    circle.setAttribute('fill', color);
    circle.setAttribute('fill-opacity', '0.85');
    circle.setAttribute('stroke', color);
    circle.setAttribute('stroke-width', n.id === 'current' ? '2.5' : '1.5');
    circle.setAttribute('stroke-opacity', n.id === 'current' ? '1' : '0.6');
    g.appendChild(circle);

    var text = svgNS('text');
    text.setAttribute('x', n.x);
    text.setAttribute('y', n.y + radius + 14);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', n.id === 'current' ? '12' : '10');
    text.setAttribute('font-family', 'Noto Sans SC, sans-serif');
    text.setAttribute('fill', n.id === 'current' ? '#111827' : '#4B5563');
    text.setAttribute('font-weight', n.id === 'current' ? '600' : '400');
    text.textContent = n.label.length > 10 ? n.label.substring(0, 10) + '..' : n.label;
    g.appendChild(text);

    // 鼠标交互：高亮关联边、显示提示
    (function(node, nodeCircle) {
      g.addEventListener('mouseover', function() {
        var allEdges = svg.querySelectorAll('.citation-edge');
        allEdges.forEach(function(edge) {
          if (edge.getAttribute('data-source') !== node.id && edge.getAttribute('data-target') !== node.id) {
            edge.style.opacity = '0.08';
          } else {
            edge.style.opacity = '1';
          }
        });
        showGraphTooltip(node);
      });
      g.addEventListener('mouseout', function() {
        var allEdges = svg.querySelectorAll('.citation-edge');
        allEdges.forEach(function(edge) { edge.style.opacity = ''; });
        hideGraphTooltip();
      });
      g.addEventListener('click', function() {
        showGraphTooltip(node);
      });
    })(n, circle);

    nodeGroup.appendChild(g);
  }
}

/** 显示图谱节点提示 */
function showGraphTooltip(node) {
  var tooltip = document.getElementById('graphTooltip');
  if (!tooltip) return;
  var citeDisplay = node.citations >= 1000 ? (node.citations / 1000).toFixed(1) + 'K' : node.citations;
  tooltip.innerHTML = '<div class="tt-title">' + node.label + '</div>'
    + '<div class="tt-meta">' + node.year + ' | ' + getGroupLabel(node.group) + '</div>'
    + '<div class="tt-stats"><span>引用: ' + citeDisplay + '</span></div>';
  tooltip.style.display = 'block';

  var svgEl = document.getElementById('citationGraph');
  if (!svgEl) return;
  var svgRect = svgEl.getBoundingClientRect();
  var left = svgRect.left + node.x - 60;
  var top = svgRect.top + node.y - 90;
  left = Math.max(10, Math.min(left, window.innerWidth - 250));
  top = Math.max(10, top);
  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
}

/** 获取分组中文标签 */
function getGroupLabel(group) {
  var labels = { seed:'种子论文', pretraining:'预训练', vision:'视觉', efficient:'高效', position:'位置编码', application:'应用' };
  return labels[group] || group;
}

/** 隐藏图谱节点提示 */
function hideGraphTooltip() {
  var tooltip = document.getElementById('graphTooltip');
  if (tooltip) tooltip.style.display = 'none';
}

/** 初始化词云 */
function initWordCloud() {
  var svg = document.getElementById('wordCloud');
  if (!svg) return;
  svg.innerHTML = '';

  var words = [
    { text:'Transformer', freq:92 },
    { text:'大语言模型', freq:88 },
    { text:'注意力机制', freq:85 },
    { text:'预训练', freq:80 },
    { text:'深度学习', freq:78 },
    { text:'多模态', freq:72 },
    { text:'对比学习', freq:68 },
    { text:'强化学习', freq:65 },
    { text:'知识图谱', freq:60 },
    { text:'联邦学习', freq:55 },
    { text:'图神经网络', freq:52 },
    { text:'扩散模型', freq:48 },
    { text:'提示工程', freq:45 },
    { text:'语义分割', freq:42 },
    { text:'神经渲染', freq:38 }
  ];

  var colors = ['#1A56DB', '#7C3AED', '#059669', '#DC2626', '#F59E0B', '#FF7C00', '#3B82F6', '#8B5CF6'];

  var minFreq = 38, maxFreq = 92;
  var minSize = 14, maxSize = 36;

  var placedWords = [];

  words.sort(function(a, b) { return b.freq - a.freq; });

  var svgWidth = svg.clientWidth || 600;
  var svgHeight = 240;

  for (var i = 0; i < words.length; i++) {
    var w = words[i];
    var fontSize = minSize + (maxSize - minSize) * ((w.freq - minFreq) / (maxFreq - minFreq));
    var color = colors[i % colors.length];
    var textWidth = fontSize * w.text.length * 0.65;
    var textHeight = fontSize;

    var bestX = 0, bestY = 0, bestOverlap = Infinity;
    var attempts = 0;

    // 随机放置尝试：最小化与已放置词的重叠
    while (attempts < 200) {
      var tx = Math.random() * (svgWidth - textWidth);
      var ty = Math.random() * (svgHeight - textHeight) + 10;

      var overlap = 0;
      for (var pi = 0; pi < placedWords.length; pi++) {
        var pw = placedWords[pi];
        var ox = Math.max(0, Math.min(tx + textWidth, pw.x + pw.width) - Math.max(tx, pw.x));
        var oy = Math.max(0, Math.min(ty + textHeight, pw.y + pw.height) - Math.max(ty, pw.y));
        overlap += ox * oy;
      }

      if (overlap < bestOverlap) {
        bestOverlap = overlap;
        bestX = tx;
        bestY = ty;
      }

      if (overlap === 0) break;
      attempts++;
    }

    var text = svgNS('text');
    text.setAttribute('x', bestX + textWidth / 2);
    text.setAttribute('y', bestY + textHeight * 0.75);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', fontSize);
    text.setAttribute('font-family', 'Noto Sans SC, sans-serif');
    text.setAttribute('font-weight', w.freq > 70 ? '700' : w.freq > 55 ? '500' : '400');
    text.setAttribute('fill', color);
    text.setAttribute('fill-opacity', '0.85');
    text.textContent = w.text;
    svg.appendChild(text);

    placedWords.push({ x: bestX, y: bestY, width: textWidth, height: textHeight });
  }
}

// 详细趋势图表实例
var detailTrendChart = null;
/** 初始化详细录用率趋势图 */
function initDetailTrendChart() {
  if (typeof echarts === 'undefined') return;
  var dom = document.getElementById('detailTrendChart');
  if (!dom) return;
  if (detailTrendChart) { detailTrendChart.resize(); return; }
  detailTrendChart = echarts.init(dom);
  detailTrendChart.setOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#E5E7EB',
      borderWidth: 1,
      textStyle: { fontFamily: 'Noto Sans SC', fontSize: 12, color: '#111827' }
    },
    legend: {
      data: ['CVPR', 'ACL', 'NeurIPS', 'ICML', 'ICCV', 'EMNLP', 'AAAI', 'IJCAI'],
      bottom: 0,
      textStyle: { fontFamily: 'Noto Sans SC', fontSize: 11, color: '#4B5563' },
      type: 'scroll'
    },
    grid: { left: 50, right: 20, top: 25, bottom: 55 },
    xAxis: {
      type: 'category',
      data: ['2019', '2020', '2021', '2022', '2023', '2024'],
      axisLabel: { fontFamily: 'Instrument Sans', color: '#9CA3AF' },
      axisLine: { lineStyle: { color: '#E5E7EB' } }
    },
    yAxis: {
      type: 'value',
      name: '录用率(%)',
      min: 13,
      max: 33,
      axisLabel: { fontFamily: 'Instrument Sans', color: '#9CA3AF' },
      nameTextStyle: { color: '#9CA3AF', fontSize: 11 },
      splitLine: { lineStyle: { color: '#F3F4F6', type: 'dashed' } }
    },
    series: [
      { name: 'CVPR', type: 'line', smooth: true, data: [29.2, 28.5, 27.9, 26.3, 25.8, 25.2], lineStyle: { width: 2.5, color: '#1A56DB' }, itemStyle: { color: '#1A56DB' }, symbol: 'circle', symbolSize: 5 },
      { name: 'ACL', type: 'line', smooth: true, data: [26.1, 25.6, 24.8, 24.1, 23.5, 23.8], lineStyle: { width: 2.5, color: '#7C3AED' }, itemStyle: { color: '#7C3AED' }, symbol: 'circle', symbolSize: 5 },
      { name: 'NeurIPS', type: 'line', smooth: true, data: [21.8, 20.6, 22.0, 21.5, 20.8, 21.2], lineStyle: { width: 2.5, color: '#059669' }, itemStyle: { color: '#059669' }, symbol: 'circle', symbolSize: 5 },
      { name: 'ICML', type: 'line', smooth: true, data: [22.6, 21.8, 23.2, 22.5, 22.0, 22.3], lineStyle: { width: 2.5, color: '#F59E0B' }, itemStyle: { color: '#F59E0B' }, symbol: 'circle', symbolSize: 5 },
      { name: 'ICCV', type: 'line', smooth: true, data: [31.0, 30.5, 29.2, 28.6, 28.0, 27.5], lineStyle: { width: 2.5, color: '#DC2626' }, itemStyle: { color: '#DC2626' }, symbol: 'circle', symbolSize: 5 },
      { name: 'EMNLP', type: 'line', smooth: true, data: [24.2, 24.5, 24.1, 23.0, 22.4, 22.1], lineStyle: { width: 2.5, color: '#FF7C00' }, itemStyle: { color: '#FF7C00' }, symbol: 'circle', symbolSize: 5 },
      { name: 'AAAI', type: 'line', smooth: true, data: [16.5, 16.2, 17.8, 15.2, 15.6, 16.0], lineStyle: { width: 2.5, color: '#3B82F6' }, itemStyle: { color: '#3B82F6' }, symbol: 'circle', symbolSize: 5 },
      { name: 'IJCAI', type: 'line', smooth: true, data: [17.0, 17.5, 16.8, 15.5, 15.0, 14.8], lineStyle: { width: 2.5, color: '#8B5CF6' }, itemStyle: { color: '#8B5CF6' }, symbol: 'circle', symbolSize: 5 }
    ]
  });
}

// 详细趋势图响应式缩放
window.addEventListener('resize', function() {
  if (detailTrendChart) detailTrendChart.resize();
});


// ============================================================
// 十四、PDF 渲染与引用导出
// ============================================================

// PDF.js 运行时状态
let pdfDoc = null;
let pdfCurrentPage = 1;
let pdfTotalPages = 0;
let pdfScale = 1.2;

// 设置 PDF.js Worker 路径
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4/build/pdf.worker.min.js';
}

/** 从 URL 加载 PDF */
async function loadPdfFromUrl(url) {
  if (typeof pdfjsLib === 'undefined') {
    console.warn('PDF.js 未加载，使用模拟视图');
    return false;
  }
  try {
    const loadingTask = pdfjsLib.getDocument(url);
    pdfDoc = await loadingTask.promise;
    pdfTotalPages = pdfDoc.numPages;
    pdfCurrentPage = 1;
    await renderPdfPage(pdfCurrentPage);
    document.getElementById('readingProgressFill').style.width = '0%';
    return true;
  } catch(e) {
    console.warn('PDF 加载失败:', e.message);
    return false;
  }
}

/** 渲染指定页码的 PDF */
async function renderPdfPage(pageNum) {
  if (!pdfDoc) return;
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: pdfScale });
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const pdfInner = document.getElementById('readingPdfInner');
  if (!pdfInner) return;

  // 替换为 Canvas 渲染内容
  pdfInner.innerHTML = '';
  pdfInner.appendChild(canvas);

  await page.render({ canvasContext: ctx, viewport: viewport }).promise;
  pdfCurrentPage = pageNum;
  updatePdfPageIndicator();
}

/** 上一页 */
function prevPdfPage() {
  if (pdfCurrentPage > 1) renderPdfPage(pdfCurrentPage - 1);
}

/** 下一页 */
function nextPdfPage() {
  if (pdfCurrentPage < pdfTotalPages) renderPdfPage(pdfCurrentPage + 1);
}

/** 更新页码指示器 */
function updatePdfPageIndicator() {
  const el = document.getElementById('pdfPageIndicator');
  if (el) el.textContent = pdfCurrentPage + ' / ' + pdfTotalPages;
}

// PDF.js 实时加载覆盖已禁用，原 openReading（带阅读进度追踪）保留使用。
// 如需重新启用 PDF.js 集成，取消下方代码块的注释。
/*
const _origOpenReadingV2 = openReading;
openReading = async function(id) {
  _origOpenReadingV2(id);
  const pdfUrls = { 'p1': 'https://arxiv.org/pdf/1706.03762.pdf' };
  const url = pdfUrls[id];
  if (url) {
    document.getElementById('readingPdfInner').innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-mid);">正在加载PDF...</div>';
    const success = await loadPdfFromUrl(url);
    if (success) {
      const ctrl = document.getElementById('pdfPageControls');
      if (ctrl) ctrl.style.display = 'flex';
    } else {
      document.getElementById('readingPdfInner').innerHTML = document.getElementById('readingPdfInner').dataset.fallback || '';
    }
  }
};
*/

// SSE 流式对话 —— 通过后端 /api/chat/stream 接口实现
/**
 * 流式 AI 消息发送 —— 调用 DeepSeek SSE 流式 API 实现打字机效果
 * 
 * 流程：
 *   1. 构建 DeepSeek 格式消息
 *   2. 调用 deepseekChat(msgs, true) 获取 ReadableStream
 *   3. 逐行解析 SSE data: 事件，实时更新气泡
 *   4. 流式失败时自动降级为非流式调用
 */
async function sendAiMessageStream() {
  // 隐藏欢迎区
  const welcome = document.getElementById('aiWelcome');
  if (welcome) welcome.style.display = 'none';
  const delBtn = document.getElementById('aiDeleteBtn');
  if (delBtn) delBtn.style.display = '';

  const input = document.getElementById('aiInput');
  const text = input.value.trim();
  if (!text) return;

  const msgs = conversations[currentConv].messages;

  // 添加用户消息
  msgs.push({ type: 'user', text: text });
  // 添加加载动画
  msgs.push({ type: 'ai', text: '<span class="loading-dots">正在思考<span>.</span><span>.</span><span>.</span></span>' });
  renderMessages(msgs);
  input.value = '';

  // 首条消息自动生成标题
  if (conversations[currentConv].title === '新对话' && text.length > 3) {
    conversations[currentConv].title = text.length > 25 ? text.substring(0, 25) + '...' : text;
    conversations[currentConv].preview = text.substring(0, 50) + (text.length > 50 ? '...' : '');
    renderConversationsList();
  }

  const aiMsgIdx = msgs.length - 1;

  try {
    // 构建 DeepSeek 格式消息（排除加载占位符）
    const deepseekMsgs = buildDeepseekMessages(msgs.slice(0, -1));

    try {
      // 优先尝试流式调用
      const streamBody = await deepseekChat(deepseekMsgs, true);
      const reader = streamBody.getReader();
      const decoder = new TextDecoder();
      let fullReply = '';
      let buffer = '';

      const container = document.getElementById('aiMessages');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留不完整的行

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.delta?.content;  // 仅取正式回复
            if (content) {
              fullReply += content;
              // 实时更新最后一个气泡
              const bubbles = container.querySelectorAll('.ai-msg-bubble-new');
              const lastBubble = bubbles[bubbles.length - 1];
              if (lastBubble) {
                lastBubble.textContent = fullReply;
                container.scrollTop = container.scrollHeight;
              }
            }
          } catch(e) { /* 跳过格式异常的行 */ }
        }
      }

      msgs[aiMsgIdx] = { type: 'ai', text: fullReply };
      renderMessages(msgs);

    } catch(streamErr) {
      console.warn('流式调用失败，降级为非流式:', streamErr);
      // 降级为非流式调用
      const reply = await deepseekChat(deepseekMsgs, false);
      msgs[aiMsgIdx] = { type: 'ai', text: reply };
      renderMessages(msgs);
    }

  } catch(err) {
    console.error('DeepSeek API 错误:', err);
    const status = err.status || 0;
    let fallbackMsg = '';

    if (status === 401 || status === 403) {
      fallbackMsg = '**AI科研助手**\n\n⚠️ API密钥无效，无法连接 DeepSeek 服务。';
    } else if (status === 429) {
      fallbackMsg = '**AI科研助手**\n\n⚠️ 请求频率过高，请稍后再试。';
    } else {
      fallbackMsg = '**AI科研助手**\n\n⚠️ 网络连接失败：' + (err.message || '未知错误') + '\n\n请检查网络后重试。';
    }
    msgs[aiMsgIdx] = { type: 'ai', text: fallbackMsg };
    renderMessages(msgs);
  }
}

// 将 sendAiMessage 替换为流式强化版本
sendAiMessage = sendAiMessageStream;

/** 导出论文引用（BibTeX/APA/GB7714格式） */
function exportCitation(paperId, format) {
  const paper = papers.find(p => p.id === paperId) || fallbackPapers.find(p => p.id === paperId);
  if (!paper) return alert('论文未找到');

  let citation = '';
  switch(format) {
    case 'bibtex':
      citation = `@article{${paper.id},\n  title={${paper.title}},\n  author={${paper.authors}},\n  journal={${paper.venue.split(' ')[0]}},\n  year={${paper.year||'2024'}},\n  note={Citations: ${paper.citations}}\n}`;
      break;
    case 'apa':
      citation = `${paper.authors} (${paper.year||'2024'}). ${paper.title}. ${paper.venue}.`;
      break;
    case 'gb7714':
      citation = `${paper.authors}. ${paper.title}[J]. ${paper.venue}.`;
      break;
    default:
      citation = `${paper.authors}. "${paper.title}." ${paper.venue}.`;
  }

  // 复制到剪贴板
  navigator.clipboard.writeText(citation).then(() => {
    alert('已复制到剪贴板\n\n' + citation);
  }).catch(() => {
    // 降级：使用 textarea 方式复制
    const ta = document.createElement('textarea');
    ta.value = citation;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    alert('已复制到剪贴板');
  });
}

/** 批量导出引用 */
function exportBulkCitations(paperIds, format) {
  const citations = paperIds.map(id => {
    const paper = papers.find(p => p.id === id);
    if (!paper) return '';
    switch(format) {
      case 'bibtex': return `@article{${paper.id},\n  title={${paper.title}},\n  author={${paper.authors}},\n  journal={${paper.venue}},\n}\n`;
      case 'apa': return `${paper.authors} (${paper.year||'2024'}). ${paper.title}. ${paper.venue}.\n`;
      default: return `${paper.authors}. "${paper.title}." ${paper.venue}.\n`;
    }
  }).filter(Boolean).join('\n');

  navigator.clipboard.writeText(citations).then(() => alert('已导出' + citations.split('\n').filter(Boolean).length + '条引用到剪贴板'));
}

/** PDF 浮动菜单操作处理 */
function onPdfFloatAction(action) {
  const paperTitle = document.getElementById('readingTitle').textContent;
  const messages = {
    translate: '正在翻译选中的文本... 翻译结果将显示在右侧翻译面板中。',
    explain: '📖 术语解释：这是论文中关键的技术概念，我将为您逐步拆解其含义和背景。',
    question: '💬 请在弹出的对话框中输入您的具体问题，我将基于论文原文为您解答。'
  };
  // 在 AI 面板显示结果
  const content = document.getElementById('readingAiContent');
  content.innerHTML = `<h4 style="font-size:14px;font-weight:600;margin-bottom:8px;">${action === 'translate' ? '翻译结果' : action === 'explain' ? '概念解释' : '问答对话'}</h4><p>${messages[action]}</p>`;
  // 切换到对应的 AI 子标签
  const tabMap = { translate: 'translate', explain: 'summary', question: 'qa' };
  const tab = document.querySelector(`.reading-ai-tab[onclick*="${tabMap[action]}"]`);
  if (tab) switchReadingAiTab(tab, tabMap[action]);
  // 隐藏浮动菜单
  document.getElementById('pdfFloatMenu').classList.remove('active');
}

/** 阅读面板问答 —— 调用 DeepSeek API 基于论文上下文回答用户问题 */
function askReadingQuestion() {
  const input = document.getElementById('readingAiInput');
  const question = input.value.trim();
  if (!question) return;
  
  const content = document.getElementById('readingAiContent');
  const paperId = document.getElementById('readingTitle').dataset.paperId;
  const paper = papers.find(p => p.id === paperId);
  
  // 构建问答展示区域
  let html = '<h4 style="font-size:14px;font-weight:600;margin:0 0 12px;color:var(--text-dark);border-bottom:2px solid var(--brand-blue);padding-bottom:6px;">💬 论文问答</h4>';
  html += '<div style="background:#F0F4FF;padding:10px 14px;border-radius:10px;margin-bottom:12px;font-size:13px;"><strong>您问：</strong>' + question + '</div>';
  html += '<div style="background:#F8FAFC;padding:10px 14px;border-radius:10px;margin-bottom:12px;font-size:13px;border:1px solid #E5E7EB;" id="readingQaAnswer"><span class="loading-dots">正在思考<span>.</span><span>.</span><span>.</span></span></div>';
  // 保留历史 Q&A
  html += '<div id="readingQaHistory">' + (content.querySelector('#readingQaHistory')?.innerHTML || '') + '</div>';
  
  content.innerHTML = html;
  input.value = '';
  
  // 切换到问答标签（不覆盖内容！）
  document.querySelectorAll('.reading-ai-tab').forEach(t => t.classList.remove('active'));
  const qaTab = document.querySelector('.reading-ai-tab[onclick*="qa"]');
  if (qaTab) qaTab.classList.add('active');
  
  // 调用 DeepSeek API，传入论文上下文
  (async function() {
    try {
      const msgs = [
        { role: 'system', content: '你是研枢平台的论文阅读助手。用户正在阅读一篇论文，需要你基于论文内容回答问题。请用中文回答，保持学术风格，引用论文中的具体章节和内容。' },
        { role: 'user', content: '我正在阅读一篇论文：\n标题：' + (paper?.title || '未知') + '\n作者：' + (paper?.authors || '未知') + '\n发表：' + (paper?.venue || '未知') + '\n摘要：' + (paper?.abstract || '无') + '\n\n我的问题是：' + question }
      ];
      const reply = await deepseekChat(msgs, false);
      const ans = document.getElementById('readingQaAnswer');
      if (ans) ans.innerHTML = '<strong>AI答：</strong>' + reply.replace(/\n/g, '<br/>');
      // 添加到历史记录
      const hist = document.getElementById('readingQaHistory');
      if (hist) hist.innerHTML = '<div style="border-top:1px solid #E5E7EB;margin-top:10px;padding-top:10px;">'
        + '<div style="background:#F0F4FF;padding:8px 12px;border-radius:8px;margin-bottom:8px;font-size:12px;"><strong>Q:</strong> ' + question + '</div>'
        + '<div style="background:#F8FAFC;padding:8px 12px;border-radius:8px;font-size:12px;border:1px solid #E5E7EB;"><strong>A:</strong> ' + reply.replace(/\n/g, '<br/>') + '</div>'
        + '</div>' + hist.innerHTML;
    } catch(e) {
      const ans = document.getElementById('readingQaAnswer');
      if (ans) ans.innerHTML = '<strong>AI答：</strong>抱歉，AI服务暂时不可用。请稍后重试。基于论文内容，此问题涉及论文的核心方法部分，建议参考第3节的详细说明。';
    }
  })();
}

/** 下载 PDF */
function downloadPdf() {
  const title = document.getElementById('readingTitle').textContent;
  alert('📥 正在准备下载：' + title + '\n\n实际生产环境中，这里会触发 PDF 文件下载。');
}

/** 导出阅读中论文的引用 */
function exportReadingCitation() {
  const paperId = document.getElementById('readingTitle').dataset.paperId;
  if (paperId) {
    exportCitation(paperId, 'bibtex');
  } else {
    alert('📋 引用信息：\n\n@article{attention2017,\n  title={Attention Is All You Need},\n  author={Vaswani et al.},\n  journal={NeurIPS},\n  year={2017}\n}\n\n已复制到剪贴板！');
  }
}

/** 分享阅读中的论文 */
function shareReadingPaper() {
  const title = document.getElementById('readingTitle').textContent;
  const url = window.location.origin + window.location.pathname;
  navigator.clipboard.writeText('【研枢】推荐论文: ' + title + ' ' + url).then(() => {
    alert('✅ 论文链接已复制到剪贴板，可以分享给同事啦！');
  }).catch(() => {
    alert('🔗 分享链接: ' + url + '\n\n请手动复制分享。');
  });
}


// ============================================================
// 十五、通知系统
// ============================================================

// 通知数据
const notifData = [
  { icon:'📄', iconClass:'blue', title:'文献更新提醒', desc:'您关注的"Transformer"方向有3篇新论文上线', time:'2 分钟前', unread:true },
  { icon:'⏰', iconClass:'orange', title:'截稿提醒', desc:'ACL 2025 摘要提交截止日期临近（15天）', time:'1 小时前', unread:true },
  { icon:'🤖', iconClass:'purple', title:'AI分析完成', desc:'您的论文"对比学习综述"的审稿模拟已完成', time:'3 小时前', unread:false },
  { icon:'🔔', iconClass:'green', title:'系统通知', desc:'平台已更新至 v3.0，新增多项功能', time:'昨天', unread:false }
];

/** 渲染通知下拉面板 */
function renderNotifs() {
  const list = document.getElementById('notifList');
  list.innerHTML = '';
  notifData.forEach(n => {
    const div = document.createElement('div');
    div.className = 'notif-item' + (n.unread ? ' unread' : ' read');
    div.innerHTML = '<div class="notif-item-icon ' + n.iconClass + '">' + n.icon + '</div>'
      + '<div class="notif-item-body">'
      + '<div class="notif-item-title">' + n.title + (n.unread ? '<span class="notif-dot"></span>' : '') + '</div>'
      + '<div class="notif-item-desc">' + n.desc + '</div>'
      + '<div class="notif-item-time">' + n.time + '</div>'
      + '</div>';
    list.appendChild(div);
  });
}

/** 切换通知面板 */
function toggleNotifPanel(e) {
  e.stopPropagation();
  const panel = document.getElementById('notifPanel');
  panel.classList.toggle('active');
  if (panel.classList.contains('active')) renderNotifs();
}

/** 关闭通知面板 */
function closeNotifPanel() {
  document.getElementById('notifPanel').classList.remove('active');
}

// 点击面板外部关闭通知
document.addEventListener('click', function(e) {
  const panel = document.getElementById('notifPanel');
  if (panel && panel.classList.contains('active') && !panel.contains(e.target)) {
    closeNotifPanel();
  }
});

// ============================================================
// 十六、收藏页与通知页
// ============================================================

/** 渲染收藏页面 —— 按文件夹和关键词筛选 */
function renderFavoritesPage() {
  const grid = $('favPageGrid');
  const empty = $('favPageEmpty');
  if (!grid || !empty) return;

  const favs = getFavorites();
  const meta = getFavMeta();
  const search = ($('favSearch')?.value || '').toLowerCase();
  const folderFilter = $('favFolderFilter')?.value || 'all';

  let items = [];
  favs.forEach(pid => {
    const paper = papers.find(p => p.id === pid) || fallbackPapers.find(p => p.id === pid);
    if (paper) {
      const m = meta[pid] || {};
      items.push({ ...paper, folder: m.folder || '默认', tags: m.tags || [], favTime: m.time || '未知' });
    }
  });

  if (search) items = items.filter(p => p.title.toLowerCase().includes(search) || p.authors.toLowerCase().includes(search));
  if (folderFilter !== 'all') items = items.filter(p => p.folder === folderFilter);

  if (items.length === 0) {
    grid.innerHTML = '';
    empty.style.display = '';
    return;
  }

  empty.style.display = 'none';
  grid.innerHTML = '';

  items.forEach(p => {
    const card = document.createElement('div');
    card.className = 'fav-page-card';
    card.innerHTML = '<div class="fav-card-top"><span class="ccf-badge level-'+(p.ccf||'A').toLowerCase()+'">CCF-'+(p.ccf||'A')+'</span><span style="font-size:11px;color:var(--text-light);">'+p.folder+'</span></div>'
      + '<div class="fav-card-title" onclick="openReading(\''+p.id+'\')">'+p.title+'</div>'
      + '<div class="fav-card-meta">'+p.authors+' · '+p.venue+'</div>'
      + '<div class="fav-card-tags">'+(p.tags||[]).map(t=>'<span class="tag-item">'+t+'</span>').join('')+'</div>'
      + '<div class="fav-card-footer"><span>收藏于 '+p.favTime+'</span><div><button class="btn-action" onclick="openReading(\''+p.id+'\')">阅读</button><button class="btn-action" onclick="removeFavorite(\''+p.id+'\');renderFavoritesPage();">取消收藏</button></div></div>';
    grid.appendChild(card);
  });
}

/** 移除收藏 */
function removeFavorite(pid) {
  const favs = getFavorites();
  const idx = favs.indexOf(pid);
  if (idx >= 0) favs.splice(idx, 1);
  localStorage.setItem(FAV_KEY, JSON.stringify(favs));
  const meta = getFavMeta();
  delete meta[pid];
  saveFavMeta(meta);
  updateFavBadge();
  showToast('已取消收藏', 'info');
}

/** 渲染通知页面 */
function renderNotificationsPage() {
  const list = $('notifPageList');
  if (!list) return;

  const allNotifs = [
    ...notifData,
    { icon:'📄', iconClass:'blue', title:'新论文提醒', desc:'您关注的"对比学习"方向有7篇新论文上线', time:'5 分钟前', unread:true },
    { icon:'📅', iconClass:'orange', title:'截稿提醒', desc:'ICCV 2026 摘要截稿倒计时：还剩30天', time:'10 分钟前', unread:true },
    { icon:'🔬', iconClass:'purple', title:'科研动态', desc:'Google DeepMind 发布最新蛋白质结构预测模型 AlphaFold3', time:'2 小时前', unread:false },
    { icon:'📊', iconClass:'green', title:'数据更新', desc:'论文数据库已更新：新增2,341篇CV/NLP方向论文', time:'昨天 14:30', unread:false },
    { icon:'🎓', iconClass:'blue', title:'学术会议', desc:'ACL 2026 征稿通知已发布，截稿日期2026年3月15日', time:'2 天前', unread:false },
    { icon:'💡', iconClass:'purple', title:'智能推荐', desc:'基于你的阅读历史，推荐3篇高引论文', time:'3 天前', unread:false },
    { icon:'✅', iconClass:'green', title:'任务完成', desc:'自动科研报告"RAG技术研究"已生成完毕', time:'5 天前', unread:false },
  ];

  list.innerHTML = allNotifs.map(n => `
    <div class="notif-page-item ${n.unread?'unread':''}">
      <div class="notif-page-icon ${n.iconClass}">${n.icon}</div>
      <div class="notif-page-body">
        <div class="notif-page-title">${n.title}</div>
        <div class="notif-page-desc">${n.desc}</div>
      </div>
      <div class="notif-page-time">${n.time}</div>
    </div>
  `).join('');
}

// ============================================================
// 十七、日历与统计弹窗
// ============================================================

/** 显示日历覆盖层 */
function showCalendarOverlay() { 
  const overlay = $('calOverlay'); if (overlay) { overlay.style.display = 'flex'; renderCalendar(); }
}
/** 关闭日历覆盖层 */
function closeCalendarOverlay() { 
  const overlay = $('calOverlay'); if (overlay) overlay.style.display = 'none';
}

/** 渲染三个月日历视图（含截稿日期标注） */
function renderCalendar() {
  const wrap = $('calGridWrap'); if (!wrap) return;
  const ccfFilter = ($('calCcfFilter')?.value || 'all');
  const now = new Date();
  let html = '';
  // 渲染未来3个月
  for (let mo = 0; mo < 3; mo++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() + mo, 1);
    const monthName = monthDate.toLocaleDateString('zh-CN', {year:'numeric', month:'long'});
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 0).getDate();
    const startDay = monthDate.getDay();
    
    html += '<div class="cal-month"><h4 style="font-size:14px;font-weight:600;margin:8px 0;">'+monthName+'</h4>';
    html += '<div class="cal-weekdays"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>';
    html += '<div class="cal-days">';
    for (let i = 0; i < startDay; i++) html += '<div class="cal-day empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = monthDate.getFullYear()+'-'+String(monthDate.getMonth()+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
      const deadlines = journals.filter(j => {
        if (ccfFilter !== 'all' && j.ccf !== ccfFilter) return false;
        return j.deadline === dateStr;
      });
      html += '<div class="cal-day'+(deadlines.length?' has-deadline':'')+'" title="'+deadlines.map(j=>j.name+'截稿').join(', ')+'">'+d+(deadlines.length?'<span class="cal-dot"></span>':'')+'</div>';
    }
    html += '</div></div>';
  }
  wrap.innerHTML = html;
}

/** 显示统计覆盖层 */
function showStatsOverlay() {
  const overlay = $('statsOverlay'); if (!overlay) return;
  overlay.style.display = 'flex';
  
  const total = libraryPapers.length;
  const read = libraryPapers.filter(p=>p.status==='read').length;
  const reading = libraryPapers.filter(p=>p.status==='reading').length;
  const unread = libraryPapers.filter(p=>p.status==='unread').length;
  
  $('statsTotalPapers').textContent = total;
  $('statsReadPapers').textContent = read;
  $('statsReadingPapers').textContent = reading;
  $('statsUnreadPapers').textContent = unread;
  
  // CCF 分布
  const ccfCounts = {};
  libraryPapers.forEach(p => { ccfCounts[p.ccf] = (ccfCounts[p.ccf] || 0) + 1; });
  let ccfHtml = '';
  const ccfColors = {A:'#2563EB',B:'#7C3AED',C:'#F59E0B',预印本:'#94A3B8'};
  for (const [ccf, count] of Object.entries(ccfCounts)) {
    const pct = Math.round(count/total*100);
    ccfHtml += '<div style="display:flex;align-items:center;gap:8px;font-size:13px;"><span style="font-weight:500;min-width:50px;">CCF-'+ccf+'</span><div style="flex:1;height:8px;background:#E5E7EB;border-radius:4px;overflow:hidden;"><div style="width:'+pct+'%;height:100%;background:'+(ccfColors[ccf]||'#94A3B8')+';border-radius:4px;"></div></div><span style="min-width:60px;text-align:right;">'+count+' ('+pct+'%)</span></div>';
  }
  $('statsCcfDist').innerHTML = ccfHtml;
  
  // 阅读进度分布
  $('statsProgress').innerHTML = 
    '<div style="display:flex;align-items:center;gap:8px;font-size:13px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#059669;"></span> 已读 '+read+' ('+Math.round(read/total*100)+'%)</div>'
    + '<div style="display:flex;align-items:center;gap:8px;font-size:13px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#F59E0B;"></span> 在读 '+reading+' ('+Math.round(reading/total*100)+'%)</div>'
    + '<div style="display:flex;align-items:center;gap:8px;font-size:13px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#94A3B8;"></span> 未读 '+unread+' ('+Math.round(unread/total*100)+'%)</div>';
  
  // 最近收藏
  const recent = [...libraryPapers].sort(function(a,b) { return b.collected.localeCompare(a.collected); }).slice(0,5);
  $('statsRecent').innerHTML = recent.map(function(p) { return '<div>\u2022 '+p.collected+' '+p.title+' ('+p.folder+')</div>'; }).join('');
}

/** 关闭统计覆盖层 */
function closeStatsOverlay() {
  const overlay = $('statsOverlay'); if (overlay) overlay.style.display = 'none';
}


// ============================================================
// 十八、AI 编辑器与模式切换
// ============================================================

/** 保存编辑器内容 */
function saveEditor() {
  const body = document.getElementById('aiEditorBody');
  if (!body) return;
  const content = body.innerHTML;
  const wordCount = body.textContent.replace(/\s/g,'').length;
  document.getElementById('aiEditorWordCount').textContent = wordCount + ' 字';
  document.getElementById('aiEditorStatusLabel').textContent = '💾 已保存';
  showToast('文档已保存 (' + wordCount + ' 字)', 'success');
  localStorage.setItem('yanshu_editor_draft', content);
  setTimeout(() => { document.getElementById('aiEditorStatusLabel').textContent = '📝 可编辑'; }, 2000);
}

/** 将 Markdown 内容写入 AI 编辑器 */
function writeToEditor(md) {
  const body = document.getElementById('aiEditorBody');
  if (!body) return;
  let html = md
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background:#1E293B;color:#E2E8F0;padding:12px;border-radius:8px;font-family:monospace;font-size:12px;"><code>$2</code></pre>')
    .replace(/### (.+)/g, '<h3>$1</h3>')
    .replace(/## (.+)/g, '<h2>$1</h2>')
    .replace(/# (.+)/g, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
  body.innerHTML = '<div class="md-content">' + html + '</div>';
  document.getElementById('aiEditorTitle').textContent = '📄 AI 生成文档';
  document.getElementById('aiEditorStatusLabel').textContent = '🤖 AI生成 · 可编辑';
  document.getElementById('aiEditorWordCount').textContent = body.textContent.replace(/\s/g,'').length + ' 字';
  showToast('AI 回复已同步到编辑区', 'info');
}

/** 导出为 HTML 文件 */
function exportWord() {
  const body = document.getElementById('aiEditorBody');
  if (!body || !body.textContent.trim() || body.textContent.includes('AI 生成的文档')) { showToast('编辑区为空', 'warning'); return; }
  const blob = new Blob(['<html><head><meta charset="UTF-8"><style>body{font-family:sans-serif;line-height:1.8;max-width:800px;margin:40px auto;}h1{font-size:22px}h2{font-size:18px}pre{background:#1E293B;color:#E2E8F0;padding:12px}table{border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px}th{background:#2563EB;color:#fff}</style></head><body>' + body.innerHTML + '</body></html>'], {type:'text/html'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '研枢文档_' + new Date().toISOString().slice(0,10) + '.html'; a.click();
  showToast('文档已导出', 'success');
}

/** 导出为 LaTeX 文件 */
function exportLatex() {
  const body = document.getElementById('aiEditorBody');
  if (!body || !body.textContent.trim() || body.textContent.includes('AI 生成的文档')) { showToast('编辑区为空', 'warning'); return; }
  const latex = '\\documentclass{article}\n\\usepackage[UTF8]{ctex}\n\\begin{document}\n\n' + body.textContent + '\n\n\\end{document}';
  const blob = new Blob([latex], {type:'text/plain'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '研枢文档_' + new Date().toISOString().slice(0,10) + '.tex'; a.click();
  showToast('LaTeX 已导出', 'success');
}

/** 切换工作模式（对话/自动科研） */
function switchMode(el) {
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  const mode = el.textContent.trim();
  showToast(mode.includes('对话') ? '💬 对话模式' : '🤖 自动科研模式——AI将自主完成检索、分析、撰写全流程', 'info');
}

// ============================================================
// 十九、深色模式与版本信息
// ============================================================

/** 切换深色模式 */
function toggleDarkMode() {
  const html = document.documentElement;
  const icon = document.getElementById('darkToggleIcon');
  const label = document.getElementById('darkToggleLabel');
  const isDark = html.getAttribute('data-theme') === 'dark';
  if (isDark) {
    html.removeAttribute('data-theme');
    localStorage.setItem('deepknow_theme', 'light');
    icon.innerHTML = '&#127769;';
    label.textContent = '深色模式';
  } else {
    html.setAttribute('data-theme', 'dark');
    localStorage.setItem('deepknow_theme', 'dark');
    icon.innerHTML = '&#127774;';
    label.textContent = '浅色模式';
  }
}

/** 初始化深色模式（从 localStorage 读取偏好） */
function initDarkMode() {
  const saved = localStorage.getItem('deepknow_theme');
  const icon = document.getElementById('darkToggleIcon');
  const label = document.getElementById('darkToggleLabel');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    if (icon) icon.innerHTML = '&#127774;';
    if (label) label.textContent = '浅色模式';
  } else {
    document.documentElement.removeAttribute('data-theme');
    if (icon) icon.innerHTML = '&#127769;';
    if (label) label.textContent = '深色模式';
  }
}

/** 切换版本信息面板 */
function toggleVersionPanel() {
  document.getElementById('versionOverlay').classList.toggle('active');
}

// Hero 区域视差鼠标跟随效果
document.querySelector('.hero-section').addEventListener('mousemove', function(e) {
  const rect = this.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;
  this.style.backgroundPosition = (50 + (x - 0.5) * 8) + '% ' + (50 + (y - 0.5) * 6) + '%';
});

// ============================================================
// 二十、快捷键与命令面板
// ============================================================

/** 切换快捷键帮助面板 */
function toggleShortcutPanel() {
  document.getElementById('shortcutOverlay').classList.toggle('active');
}

// 命令面板数据
const cmdItems = [
  { group:'导航', items:[
    { icon:'🔍', label:'跳转到论文搜索', action:function(){ navigateTo('page-search'); closeCmdPalette(); }, shortcut:'Ctrl+1' },
    { icon:'✨', label:'跳转到AI科研助手', action:function(){ navigateTo('page-ai'); closeCmdPalette(); }, shortcut:'Ctrl+2' },
    { icon:'📊', label:'跳转到投稿分析', action:function(){ navigateTo('page-submit'); closeCmdPalette(); }, shortcut:'Ctrl+3' },
    { icon:'📁', label:'跳转到个人文献库', action:function(){ navigateTo('page-library'); closeCmdPalette(); }, shortcut:'Ctrl+4' }
  ]},
  { group:'操作', items:[
    { icon:'⭐', label:'查看收藏夹', action:function(){ navigateTo('page-search'); closeCmdPalette(); document.querySelector('.nav-item[data-page="page-search"] .nav-label') && alert('打开收藏夹'); }, shortcut:'Ctrl+F' },
    { icon:'❓', label:'查看快捷键', action:function(){ closeCmdPalette(); toggleShortcutPanel(); }, shortcut:'Shift+/' },
    { icon:'🌙', label:'切换深色模式', action:function(){ closeCmdPalette(); toggleDarkMode(); }, shortcut:'Ctrl+D' }
  ]}
];

let cmdSelectedIdx = -1;

/** 打开命令面板 */
function openCmdPalette() {
  document.getElementById('cmdPalette').classList.add('active');
  renderCmdList('');
  setTimeout(function() {
    document.getElementById('cmdInput').focus();
    document.getElementById('cmdInput').value = '';
  }, 50);
  cmdSelectedIdx = -1;
}

/** 关闭命令面板 */
function closeCmdPalette() {
  document.getElementById('cmdPalette').classList.remove('active');
}

/** 渲染命令列表（支持过滤） */
function renderCmdList(filter) {
  const list = document.getElementById('cmdList');
  list.innerHTML = '';
  let allItems = [];
  cmdItems.forEach(g => {
    const label = document.createElement('div');
    label.className = 'cmd-group-label';
    label.textContent = g.group;
    list.appendChild(label);
    g.items.forEach((item, idx) => {
      const div = document.createElement('div');
      div.className = 'cmd-item';
      if (filter && !item.label.toLowerCase().includes(filter.toLowerCase())) {
        div.style.display = 'none';
      }
      div.innerHTML = '<span class="cmd-item-icon">' + item.icon + '</span><span class="cmd-item-label">' + item.label + '</span><span class="cmd-item-shortcut">' + item.shortcut + '</span>';
      div.dataset.idx = allItems.length;
      div.onclick = item.action;
      div.onmouseenter = function() {
        document.querySelectorAll('.cmd-item').forEach(el => el.classList.remove('selected'));
        this.classList.add('selected');
        cmdSelectedIdx = parseInt(this.dataset.idx);
      };
      list.appendChild(div);
      allItems.push(item);
    });
  });
  return allItems;
}

/** 命令面板键盘导航 */
function cmdKeydown(e) {
  const items = document.querySelectorAll('.cmd-item:not([style*="display: none"])');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    cmdSelectedIdx = (cmdSelectedIdx + 1) % items.length;
    items.forEach((el, i) => el.classList.toggle('selected', i === cmdSelectedIdx));
    if (items[cmdSelectedIdx]) items[cmdSelectedIdx].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    cmdSelectedIdx = (cmdSelectedIdx - 1 + items.length) % items.length;
    items.forEach((el, i) => el.classList.toggle('selected', i === cmdSelectedIdx));
    if (items[cmdSelectedIdx]) items[cmdSelectedIdx].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (cmdSelectedIdx >= 0 && items[cmdSelectedIdx]) {
      items[cmdSelectedIdx].click();
    }
  } else if (e.key === 'Escape') {
    closeCmdPalette();
  } else {
    // 过滤命令
    cmdSelectedIdx = -1;
    const val = e.target.value;
    const allItems = document.querySelectorAll('.cmd-item');
    const groups = document.querySelectorAll('.cmd-group-label');
    allItems.forEach((el, i) => {
      const label = el.querySelector('.cmd-item-label').textContent;
      if (val && !label.toLowerCase().includes(val.toLowerCase())) {
        el.style.display = 'none';
      } else {
        el.style.display = '';
      }
    });
    // 隐藏空分组
    groups.forEach(g => {
      const nextItems = [];
      let sibling = g.nextElementSibling;
      while (sibling && sibling.classList.contains('cmd-item')) {
        nextItems.push(sibling);
        sibling = sibling.nextElementSibling;
      }
      const visible = nextItems.some(el => el.style.display !== 'none');
      g.style.display = visible ? '' : 'none';
    });
  }
}

// 全局键盘快捷键
document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'k') { e.preventDefault(); openCmdPalette(); return; }
    if (e.key === 'd') { e.preventDefault(); toggleDarkMode(); return; }
    if (e.key === 'n') { e.preventDefault(); navigateTo('page-ai'); setTimeout(newConversation, 100); return; }
    if (e.key === 'f') { e.preventDefault(); navigateTo('page-search'); setTimeout(()=>$('searchInput')?.focus(), 200); return; }
    if (e.key === 'l') { e.preventDefault(); navigateTo('page-library'); return; }
    if (['1','2','3','4'].includes(e.key)) {
      e.preventDefault();
      const pages = ['page-search','page-ai','page-submit','page-library'];
      navigateTo(pages[parseInt(e.key) - 1]);
    }
  }
  // Shift+/: 快捷键帮助
  if (e.shiftKey && e.key === '/') {
    e.preventDefault();
    toggleShortcutPanel();
  }
  // Esc: 关闭所有覆盖层
  if (e.key === 'Escape') {
    [$('searchHistoryPanel'),$('favPopover'),$('notifPanel'),$('cmdPalette'),$('shortcutOverlay'),$('versionOverlay'),$('readingOverlay'),$('journalDetailOverlay')].forEach(el => {
      if (el) { try { el.style.display='none'; el.classList.remove('active','show'); } catch(ex){} }
    });
    document.body.style.overflow = '';
  }
});


// ============================================================
// 二十一、初始化入口
// ============================================================

// 论文卡片趋势指标
const trendValues = ['up','stable','down'];
/** 为论文卡片随机分配趋势指示器 */
function assignTrends() {
  document.querySelectorAll('.paper-card').forEach(card => {
    const statsDiv = card.querySelector('.paper-stats');
    if (!statsDiv) return;
    // 如果已分配趋势则跳过
    if (card.querySelector('.trend-indicator')) return;
    const trend = trendValues[Math.floor(Math.random() * trendValues.length)];
    const labels = { up:'📈 上升', stable:'➡️ 平稳', down:'📉 下降' };
    const span = document.createElement('span');
    span.className = 'trend-indicator ' + trend;
    span.textContent = labels[trend];
    statsDiv.appendChild(span);
  });
}

// 阅读进度存储键
const PROGRESS_KEY = 'deepknow_reading_progress';
let readingScrollTimer = null;

/** 初始化阅读进度追踪 —— 监听 PDF 区域滚动并保存到 localStorage */
function initReadingProgress(paperId) {
  const pdfEl = document.getElementById('readingPdf');
  const fill = document.getElementById('readingProgressFill');
  if (!pdfEl || !fill) return;
  
  // 从 localStorage 恢复保存的进度
  const progressData = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
  const savedPct = progressData[paperId] || 0;
  if (savedPct > 0) {
    fill.style.width = savedPct + '%';
  } else {
    fill.style.width = '0%';
  }
  
  pdfEl.addEventListener('scroll', function() {
    clearTimeout(readingScrollTimer);
    readingScrollTimer = setTimeout(function() {
      const scrollTop = pdfEl.scrollTop;
      const scrollHeight = pdfEl.scrollHeight - pdfEl.clientHeight;
      const pct = scrollHeight > 0 ? Math.min(100, Math.round((scrollTop / scrollHeight) * 100)) : 0;
      fill.style.width = pct + '%';
      // 保存到 localStorage
      const data = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
      data[paperId] = pct;
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
    }, 200);
  });
}

/** 获取阅读进度 */
function getReadingProgress(title) {
  const data = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
  return data[title] || 0;
}

/** 保存阅读进度（关闭阅读面板时调用） */
function saveReadingProgress() {
  var pdfEl = document.getElementById('readingPdf');
  if (!pdfEl) return;
  var scrollTop = pdfEl.scrollTop;
  var scrollHeight = pdfEl.scrollHeight - pdfEl.clientHeight;
  var pct = scrollHeight > 0 ? Math.min(100, Math.round((scrollTop / scrollHeight) * 100)) : 0;
  var paperId = document.getElementById('readingTitle').dataset.paperId;
  if (paperId) {
    localStorage.setItem('reading_progress_' + paperId, pct);
    for (var i = 0; i < libraryPapers.length; i++) {
      var p = libraryPapers[i];
      if (p.pid === paperId || p.id === paperId) {
        p.progress = pct;
        if (pct >= 95) p.status = 'read';
        else if (pct > 0) p.status = 'reading';
        renderLibrary();
        break;
      }
    }
  }
}

// 增强 renderLibrary 以显示阅读进度条（装饰器模式）
const origRenderLibrary = renderLibrary;
renderLibrary = function() {
  origRenderLibrary();
  const progressData = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
  document.querySelectorAll('.lib-item').forEach(item => {
    const titleEl = item.querySelector('.lib-item-title');
    if (!titleEl) return;
    const title = titleEl.textContent;
    const pct = progressData[title];
    if (pct !== undefined && pct > 0 && pct < 100) {
      const existingProgress = item.querySelector('.lib-item-progress');
      if (existingProgress) {
        existingProgress.innerHTML = '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div><span class="progress-text">' + pct + '%</span>';
      } else {
        const actions = item.querySelector('.lib-item-actions');
        if (actions) {
          const div = document.createElement('div');
          div.className = 'lib-item-progress';
          div.innerHTML = '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div><span class="progress-text">' + pct + '%</span>';
          item.insertBefore(div, actions);
        }
      }
    }
  });
};

// Toast 通知系统
function showToast(msg, type='info', duration=2500) {
  const icons = { success:'\u2705', error:'\u274C', warning:'\u26A0\uFE0F', info:'\uD83D\uDCA1' };
  const colors = { success:'#059669', error:'#DC2626', warning:'#F59E0B', info:'#1A56DB' };
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);padding:12px 28px;border-radius:28px;color:white;font-weight:500;font-size:13px;z-index:99999;box-shadow:0 8px 30px rgba(0,0,0,0.15);animation:toastIn 0.35s ease;pointer-events:none;white-space:nowrap;max-width:90vw;overflow:hidden;text-overflow:ellipsis;';
  toast.style.background = colors[type] || colors.info;
  toast.textContent = (icons[type]||'') + ' ' + msg;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity='0'; toast.style.transition='opacity 0.3s'; setTimeout(()=>toast.remove(),300); }, duration);
}

// ===== 初始渲染 —— 从降级数据填充界面（类 SSR 策略，确保首屏有内容） =====
// 注意：loadData() 会在 DOMContentLoaded 中异步加载 API 数据并覆盖这些默认内容
(function preRender() {
  // 在 loadData 执行前，用降级数据填充界面内容
  if (!papers.length) papers = fallbackPapers;
  if (!journals.length) journals = fallbackJournals;
  if (!libraryPapers.length) libraryPapers = fallbackLibrary;
  if (!conversations.length) {
    conversations = [
      { id:'c1',title:'AI对话助手',preview:'DeepSeek驱动的科研对话...',messages:[
        {type:'ai',text:'**您好！我是研枢AI科研助手**\n\n我由 DeepSeek 大语言模型驱动，可以帮助您：\n\n- **论文检索与阅读** - 搜索学术论文，AI辅助阅读\n- **科研撰写** - 撰写文献综述、润色论文\n- **实验对比分析** - 对比不同方法的实验数据\n- **投稿建议** - 推荐最合适的会议/期刊\n\n请告诉我您需要什么帮助？'}
      ]}
    ];
  }
  renderDailyRecs();
  renderPapers(0, 20);
  renderConversationsList();
  renderNotifs();
})();

// ===== DOM 加载完成后的初始化 =====
document.addEventListener('DOMContentLoaded', function() {
  // 深色模式初始化
  initDarkMode();
  // 从 API 加载数据
  loadData();
  // 根据 localStorage 中保存的收藏状态更新按钮样式
  const favs = getFavorites();
  document.querySelectorAll('.btn-action.fav[data-id]').forEach(btn => {
    const pid = btn.getAttribute('data-id');
    if (favs.includes(pid)) {
      btn.classList.add('active');
      btn.innerHTML = '&#10084;';
    }
  });
  updateFavBadge();
  // 设置默认文件夹列表
  const folders = getFavFolders();
  const folderList = document.getElementById('favFolderList');
  if (folderList) {
    folderList.innerHTML = '';
    folders.forEach(function(f) {
      const div = document.createElement('div');
      div.className = 'fav-folder-item';
      div.dataset.folder = f;
      div.textContent = '\u{1F4C2} ' + f;
      div.onclick = function() { selectFavFolder(this); };
      folderList.appendChild(div);
    });
    if (folderList.firstChild) folderList.firstChild.classList.add('selected');
  }
  // 初始化过滤器指示器位置
  const activeTag = document.querySelector('.filter-tag.active');
  if (activeTag) moveFilterIndicator(activeTag);
  setTimeout(() => {
    document.querySelectorAll('.journal-match-fill').forEach(el => { el.style.width = el.style.width; });
  }, 300);
  // 延迟分配趋势指示器
  setTimeout(assignTrends, 500);
  // 初始化通知列表
  try { renderNotifs(); } catch(e){}
  // 欢迎提示
  setTimeout(() => showToast('\u6B22\u8FCE\u4F7F\u7528\u7814\u67A2 \u00B7 AI\u9A71\u52A8\u79D1\u7814\u5168\u94FE\u8DEF\u8F85\u52A9\u5E73\u53F0', 'info', 3000), 800);
});

