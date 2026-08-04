/**
 * app.js — 应用入口与全局编排
 *
 * 职责：全局数据声明、降级数据、数据加载、页面导航、投稿期刊渲染、
 *       通知系统、收藏/通知页面、日历弹窗、深色模式、命令面板、初始化入口
 * 包含模块：四、全局数据与降级数据；五、数据加载与初始化；六、导航与侧边栏；
 *           十、投稿分析与期刊渲染（renderJournals/initTrendChart 部分）；
 *           十五、通知系统；十六、收藏页与通知页；十七、日历弹窗；
 *           十九、深色模式；二十、快捷键与命令面板；二十一、初始化入口
 *
 * 注意：conversations（ai-chat.js）、libraryPapers（library.js）、
 *       trendValues/assignTrends（search.js）、showToast（utils.js）、
 *       renderMdInline（markdown.js）等已在各自模块声明，此处不再重复声明，
 *       依赖脚本加载顺序保证全局可见。
 */

// ============================================================
// 四、全局数据与降级数据
// ============================================================

// 全局数据状态 —— 从 API 加载或使用本地降级数据
// 注：conversations 与 libraryPapers 分别在 ai-chat.js、library.js 中声明
let papers = [];
let journals = [];

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
 * 切换高级搜索面板展开/收起
 */
function toggleAdvancedSearch() {
  const panel = document.getElementById('advancedSearchPanel');
  if (!panel) return;
  panel.classList.toggle('active');
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
    // 绑定 Tab 按钮点击事件
    var tabBtns = document.querySelectorAll('.sub-tab-btn');
    tabBtns.forEach(function(btn) {
      btn.onclick = function() { switchSubTab(btn.dataset.tab); };
    });
    // 如果有待渲染的图谱论文ID，自动切换到图谱Tab
    if (window.__pendingGraphPaperId) {
      var pendingId = window.__pendingGraphPaperId;
      window.__pendingGraphPaperId = null;
      switchSubTab('graph', pendingId);
    } else {
      // 默认激活期刊列表 Tab
      switchSubTab('journals');
    }
  }
  if (pageId === 'page-ai') {
    renderConversationsList();
    switchConv(currentConv);
  }
  if (pageId === 'page-library') renderLibrary();
  if (pageId === 'page-favorites') renderFavoritesPage();
  if (pageId === 'page-notifications') renderNotificationsPage();
}

/**
 * 全局快捷入口：跳转到文献知识图谱并以指定论文为中心渲染
 * @param {string} paperId - 论文ID
 */
function openGraphForPaper(paperId) {
  if (!paperId) {
    showToast('未找到论文ID', 'warning');
    return;
  }
  // 如果在独立阅读页，跳回首页
  if (window.location.pathname.includes('reading.html')) {
    window.location.href = 'index.html?graph=' + encodeURIComponent(paperId);
    return;
  }
  // 设置待渲染论文ID
  window.__pendingGraphPaperId = paperId;
  // 路由跳转到投稿分析页
  navigateTo('page-submit');
}

// ============================================================
// 投稿分析 Tab 切换系统
// ============================================================

/** 投稿分析页当前激活 Tab */
var subActiveTab = 'journals';

/** 切换投稿分析 Tab：journals | trends | graph */
function switchSubTab(tabName, paperId) {
  subActiveTab = tabName;
  var tabs = document.querySelectorAll('.sub-tab-btn');
  tabs.forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  var mainView = document.getElementById('subMainView');
  var graphContainer = document.getElementById('graphContainer');
  var journalGrid = document.getElementById('journalGrid');
  var trendSection = document.querySelector('.trend-section');
  var wordCloud = document.getElementById('wordCloudSection');
  var detailTrend = document.getElementById('detailTrendSection');

  if (tabName === 'graph') {
    // 显示图谱容器，隐藏主视图
    if (mainView) mainView.style.display = 'none';
    if (graphContainer) graphContainer.style.display = 'flex';
    // 动态懒加载 knowledge-graph.js，加载完成后初始化
    if (typeof initKnowledgeGraph !== 'function') {
      var script = document.createElement('script');
      script.src = 'js/knowledge-graph.js?v=' + Date.now();
      script.onload = function() {
        initKnowledgeGraph('graphCanvas', paperId || null);
      };
      script.onerror = function() {
        console.error('[switchSubTab] knowledge-graph.js 加载失败');
      };
      document.head.appendChild(script);
    } else {
      // 已加载过，直接初始化
      initKnowledgeGraph('graphCanvas', paperId || null);
    }
  } else {
    // 离开图谱 Tab，销毁实例
    if (typeof destroyKnowledgeGraph === 'function') {
      destroyKnowledgeGraph();
    }
    // 显示主视图，隐藏图谱
    if (mainView) mainView.style.display = '';
    if (graphContainer) graphContainer.style.display = 'none';

    // 期刊列表：显示期刊网格 + 趋势图表区域
    if (tabName === 'journals') {
      if (journalGrid) journalGrid.style.display = '';
      if (trendSection) trendSection.style.display = '';
      if (wordCloud) wordCloud.style.display = '';
      if (detailTrend) detailTrend.style.display = '';
      renderJournals();
      setTimeout(initTrendChart, 100);
      setTimeout(function() {
        if (wordCloud) wordCloud.style.display = '';
        if (detailTrend) detailTrend.style.display = '';
        if (typeof initWordCloud === 'function') initWordCloud();
        if (typeof initDetailTrendChart === 'function') initDetailTrendChart();
      }, 200);
    }

    // 投稿趋势图：仅显示趋势图表，隐藏期刊网格
    if (tabName === 'trends') {
      if (journalGrid) journalGrid.style.display = 'none';
      if (trendSection) trendSection.style.display = '';
      if (wordCloud) wordCloud.style.display = '';
      if (detailTrend) detailTrend.style.display = '';
      setTimeout(initTrendChart, 100);
      setTimeout(function() {
        if (wordCloud) wordCloud.style.display = '';
        if (detailTrend) detailTrend.style.display = '';
        if (typeof initWordCloud === 'function') initWordCloud();
        if (typeof initDetailTrendChart === 'function') initDetailTrendChart();
      }, 200);
    }
  }
}

// ============================================================
// 十、投稿分析与期刊渲染（renderJournals / initTrendChart 部分）
// ============================================================

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
  overlay.innerHTML = '<div style="background:var(--bg-card);border-radius:16px;padding:28px;width:440px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.15);animation:dropIn 0.25s ease;">'+html+'</div>';
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
      + '<div class="fav-card-title">'+p.title+'</div>'
      + '<div class="fav-card-meta">'+p.authors+' · '+p.venue+'</div>'
      + '<div class="fav-card-tags">'+(p.tags||[]).map(t=>'<span class="tag-item">'+t+'</span>').join('')+'</div>'
      + '<div class="fav-card-footer"><span>收藏于 '+p.favTime+'</span><div><button class="btn-action" onclick="event.stopPropagation();openReading(\''+p.id+'\')">阅读</button><button class="btn-action" onclick="event.stopPropagation();openGraphForPaper(\''+p.id+'\')">引用图谱</button><button class="btn-action" onclick="event.stopPropagation();removeFavorite(\''+p.id+'\');renderFavoritesPage();">取消收藏</button></div></div>';
    card.addEventListener('click', function(e) {
      if (e.target.closest('.btn-action')) return;
      openReading(p.id);
    });
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

  list.innerHTML = '';
  allNotifs.forEach((n) => {
    const item = document.createElement('div');
    item.className = 'notif-page-item ' + (n.unread ? 'unread' : '');
    item.innerHTML = '<div class="notif-page-icon ' + n.iconClass + '">' + n.icon + '</div>'
      + '<div class="notif-page-body"><div class="notif-page-title">' + n.title + '</div><div class="notif-page-desc">' + n.desc + '</div></div>'
      + '<div class="notif-page-time">' + n.time + '</div>';
    // 点击通知条目：根据类型跳转到对应页面
    item.addEventListener('click', function() {
      if (n.title.includes('新论文') || n.title.includes('数据更新') || n.title.includes('智能推荐')) navigateTo('page-search');
      else if (n.title.includes('截稿') || n.title.includes('学术会议')) navigateTo('page-submit');
      else if (n.title.includes('任务完成')) navigateTo('page-ai');
      else if (n.title.includes('科研动态')) showToast('查看科研动态详情（功能开发中）', 'info');
      n.unread = false;
      renderNotificationsPage();
    });
    list.appendChild(item);
  });
}

// ============================================================
// 十七、日历弹窗
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

// ============================================================
// 十九、深色模式与版本信息
// ============================================================

/** 深色/浅色模式图标 SVG（线性 outline 风格） */
const ICON_MOON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
const ICON_SUN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/></svg>';

/** 切换深色模式 */
function toggleDarkMode() {
  const html = document.documentElement;
  const icon = document.getElementById('darkToggleIcon');
  const label = document.getElementById('darkToggleLabel');
  const isDark = html.getAttribute('data-theme') === 'dark';
  if (isDark) {
    html.removeAttribute('data-theme');
    html.classList.remove('dark');
    localStorage.setItem('deepknow_theme', 'light');
    icon.innerHTML = ICON_MOON;
    label.textContent = '深色模式';
  } else {
    html.setAttribute('data-theme', 'dark');
    html.classList.add('dark');
    localStorage.setItem('deepknow_theme', 'dark');
    icon.innerHTML = ICON_SUN;
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
    document.documentElement.classList.add('dark');
    if (icon) icon.innerHTML = ICON_SUN;
    if (label) label.textContent = '浅色模式';
  } else {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('dark');
    if (icon) icon.innerHTML = ICON_MOON;
    if (label) label.textContent = '深色模式';
  }
}

/** 切换版本信息面板 */
function toggleVersionPanel() {
  document.getElementById('versionOverlay').classList.toggle('active');
}

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
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.isContentEditable) return;

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
  // 初始化排序标签高亮状态
  const activeSortTag = document.querySelector('.sort-tag.active');
  if (activeSortTag) activeSortTag.classList.add('active');
  setTimeout(() => {
    document.querySelectorAll('.journal-match-fill').forEach(el => { el.style.width = el.style.width; });
  }, 300);
  // 延迟分配趋势指示器
  setTimeout(assignTrends, 500);
  // 初始化通知列表
  try { renderNotifs(); } catch(e){}
  // 欢迎提示
  setTimeout(() => showToast('\u6B22\u8FCE\u4F7F\u7528\u7814\u67A2 \u00B7 AI\u9A71\u52A8\u79D1\u7814\u5168\u94FE\u8DEF\u8F85\u52A9\u5E73\u53F0', 'info', 3000), 800);
  // 检查URL参数：从reading.html跳转回来时自动打开图谱
  var urlParams = new URLSearchParams(window.location.search);
  var graphPaperId = urlParams.get('graph');
  if (graphPaperId) {
    window.__pendingGraphPaperId = graphPaperId;
    navigateTo('page-submit');
    // 清除URL参数
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});
