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
let allPapers = [];
let journals = [];

// 论文降级数据 —— 当 API 不可用时兜底展示
// 5 篇完整真实论文，数据来自 PAPERS_DATA（papers-data.js）
const FALLBACK_PAPER_IDS = ['p1', 'p2', 'p19', 'p31', 'p32'];
const fallbackPapers = FALLBACK_PAPER_IDS.map(function(id, idx) {
  var p = (window.PAPERS_DATA && window.PAPERS_DATA[id]) || {};
  return {
    id: id,
    title: p.title || '',
    authors: p.authors || '',
    venue: p.venue || '',
    year: p.year || '',
    ccf: p.ccf || 'A',
    match: 'perfect',
    matchLabel: 'Perfect',
    citations: p.citations || '',
    heat: 'Hot',
    keywords: p.keywords || [],
    abstract: p.abstract || ''
  };
});

// 期刊降级数据 —— 从 journals-data.js（window.JOURNALS_DATA）加载 12 篇真实会议
// 兜底：若 journals-data.js 未加载，则返回空数组由 API 数据接管
const FALLBACK_JOURNAL_IDS = window.JOURNAL_IDS || ['CVPR','ICCV','ECCV','ACL','EMNLP','NAACL','ICML','NeurIPS','ICLR','AAAI','IJCAI','KDD'];
const fallbackJournals = (function () {
  var out = [];
  var src = window.JOURNALS_DATA || {};
  for (var i = 0; i < FALLBACK_JOURNAL_IDS.length; i++) {
    var id = FALLBACK_JOURNAL_IDS[i];
    var raw = src[id] || {};
    if (!raw.name) continue;
    // 根据日期动态判断 urgent（30 天内或已过 7 天内）
    var dlMs = raw.deadline ? new Date(raw.deadline).getTime() : 0;
    var now = Date.now();
    var daysLeft = Math.ceil((dlMs - now) / (24 * 60 * 60 * 1000));
    out.push({
      id: raw.id || id,
      name: raw.name,
      fullName: raw.fullName || raw.name,
      ccf: raw.ccf || 'A',
      domain: raw.domain || '综合',
      domainCn: raw.domainCn || raw.domain || '综合',
      deadline: raw.deadline || '',
      deadlineStage: raw.deadlineStage || '全文截止',
      nextEdition: raw.nextEdition || '',
      location: raw.location || '',
      rate: typeof raw.rate === 'number' ? raw.rate : 0,
      matchPct: raw.matchPct || 0,
      matchClass: raw.matchClass || 'mid',
      submissions: raw.submissions || 0,
      urgent: (daysLeft >= 0 && daysLeft <= 30) || (daysLeft < 0 && daysLeft >= -7),
      daysLeft: daysLeft,
      publisher: raw.publisher || '',
      h5Index: raw.h5Index || 0,
      officialSite: raw.officialSite || '',
      templateUrl: raw.templateUrl || '',
      requirementsUrl: raw.requirementsUrl || '',
      keywords: raw.keywords || [],
      acceptanceHistory: raw.acceptanceHistory || []
    });
  }
  return out;
})();

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

/** 从阅读页返回时恢复主界面滚动位置；consume=true 时消费（删除）记录。 */
function restoreReadingScroll(consume) {
  try {
    const returnY = sessionStorage.getItem('yanshu_reading_return_y');
    if (!returnY) return;
    if (consume) sessionStorage.removeItem('yanshu_reading_return_y');
    const y = parseInt(returnY, 10);
    if (y > 0) {
      // 立即恢复（首帧不出现"先到顶部"），150ms 后校准一次（等图片加载后布局稳定）
      window.scrollTo(0, y);
      setTimeout(function() { window.scrollTo(0, y); }, 150);
    }
  } catch (e) { /* 忽略 */ }
}

/**
 * 从 API 加载全部数据，失败时使用降级数据
 * 论文数据最先渲染（返回阅读页时尽快呈现列表并恢复滚动位置），其余数据后台填充
 */
async function loadData() {
  // 加载论文数据（一次取全部，后端上限 100）
  const paperData = await apiFetch('/papers?page_size=100');
  papers = (paperData && paperData.data) ? paperData.data : fallbackPapers;
  allPapers = papers.slice();

  // 立即渲染论文列表（不等对话/期刊等慢请求），并恢复阅读返回的滚动位置
  renderDailyRecs();
  const paperGridEl = document.getElementById('paperGrid');
  if (paperGridEl) paperGridEl.innerHTML = '';
  renderPapers(0, papers.length);
  const countEl = document.getElementById('paperCountDisplay');
  if (countEl) countEl.textContent = '共 ' + papers.length + ' 篇';
  restoreReadingScroll(true);
  updateFavBadge();

  // 期刊数据（后台加载）
  const journalData = await apiFetch('/journals');
  journals = (journalData && journalData.data) ? journalData.data : fallbackJournals;
  renderJournals();

  // 对话数据 —— 逐个获取详情以填充 messages
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
  renderConversationsList();

  // 文献库数据（后台加载）
  const libData = await apiFetch('/library');
  libraryPapers = (libData && libData.data) ? libData.data : fallbackLibrary;
  renderLibrary();

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
    if (typeof resetSearchResults === 'function') {
      resetSearchResults({ silent: true });
    } else {
      renderDailyRecs();
      renderPapers(0, papers.length);
    }
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
    // AI 助手 fixed 位置再对齐 2 次（防止首次 init 时 sub-left-new 还没拿到正确宽度）
    setTimeout(function () { if (typeof alignAIPanel === 'function') alignAIPanel(); }, 120);
    setTimeout(function () { if (typeof alignAIPanel === 'function') alignAIPanel(); }, 500);
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

/** 切换投稿分析 Tab：journals | trends | graph —— P0-2c Tab 分工明确 */
function switchSubTab(tabName, paperId) {
  subActiveTab = tabName;
  var tabs = document.querySelectorAll('.sub-tab-btn');
  tabs.forEach(function(btn) {
    btn.classList.toggle('active', (btn.dataset.tab || '') === tabName);
  });

  var mainView = document.getElementById('subMainView');
  var graphContainer = document.getElementById('graphContainer');
  var jv = document.getElementById('tabJournalsView');
  var tv = document.getElementById('tabTrendsView');

  if (tabName === 'graph') {
    if (mainView) mainView.style.display = 'none';
    if (graphContainer) graphContainer.style.display = 'flex';
    if (typeof initKnowledgeGraph !== 'function') {
      var script = document.createElement('script');
      script.src = 'js/knowledge-graph.js?v=' + Date.now();
      script.onload = function() { initKnowledgeGraph('graphCanvas', paperId || null); };
      script.onerror = function() { console.error('[switchSubTab] knowledge-graph.js 加载失败'); };
      document.head.appendChild(script);
    } else {
      initKnowledgeGraph('graphCanvas', paperId || null);
    }
    return;
  }

  // 非图谱 Tab：销毁图谱，显示主视图
  if (typeof destroyKnowledgeGraph === 'function') destroyKnowledgeGraph();
  if (mainView) mainView.style.display = '';
  if (graphContainer) graphContainer.style.display = 'none';

  // 期刊列表 Tab：卡片网格 + 紧凑趋势小图
  if (tabName === 'journals') {
    if (jv) jv.style.display = '';
    if (tv) tv.style.display = 'none';
    renderJournals();
    refreshSubmissionStats();
    setTimeout(initTrendChart, 80);
    if (typeof alignAIPanel === 'function') alignAIPanel();
  }
  // 投稿趋势 Tab：大图 + 领域筛选 tags
  if (tabName === 'trends') {
    if (jv) jv.style.display = 'none';
    if (tv) tv.style.display = '';
    refreshSubmissionStats();
    if (typeof alignAIPanel === 'function') alignAIPanel();
    // 修复：切 Tab 后 display='' 的 reflow 需要一帧完成，否则 detailTrendChart.clientHeight=0 → ECharts 渲染成空白
    // 用 requestAnimationFrame（两帧）确保布局稳定后再 init
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          initDetailTrendChart();
          if (typeof alignAIPanel === 'function') alignAIPanel();
        });
      });
    } else {
      setTimeout(function () {
        initDetailTrendChart();
        if (typeof alignAIPanel === 'function') alignAIPanel();
      }, 180);
    }
    setTimeout(function() { if (typeof initWordCloud === 'function') initWordCloud(); }, 300);
  }
}

// ============================================================
// 十、投稿分析与期刊渲染（renderJournals / initTrendChart 部分）
// ============================================================

/**
 * 渲染期刊卡片列表 —— 支持 CCF 等级和领域筛选（新版 12 篇数据）
 */
function renderJournals() {
  const ccfFilter = ($('subCcfFilter')?.value || 'all');
  const domainFilter = ($('subDomainFilter')?.value || 'all');
  let displayJournals = journals.slice();
  if (ccfFilter !== 'all') displayJournals = displayJournals.filter(j => j.ccf === ccfFilter);
  if (domainFilter !== 'all') displayJournals = displayJournals.filter(j => (j.domainCn||j.domain||'综合') === domainFilter);

  // 显示筛选结果计数
  var rc = $('journalResultCount');
  if (rc) rc.textContent = displayJournals.length + ' / ' + journals.length + ' 篇';
  // P1-2：刷新顶部统计条
  if (typeof refreshSubmissionStats === 'function') refreshSubmissionStats();
  
  const grid = $('journalGrid');
  if (!grid) return;
  grid.innerHTML = '';
  
  if (!displayJournals.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;padding:40px;text-align:center;color:var(--text-light);font-size:13px;">没有符合筛选条件的会议</div>';
    return;
  }

  displayJournals.forEach(j => {
    // 录用率环形图
    const r = 20; const circumference = 2 * Math.PI * r;
    const rateVal = Math.max(0, Math.min(100, parseFloat(j.rate) || 0));
    const offset = circumference * (1 - rateVal / 100);
    const ringColor = rateVal > 26 ? '#059669' : rateVal > 22 ? '#F59E0B' : '#DC2626';
    // 倒计时
    const daysLeft = Number.isInteger(j.daysLeft) ? j.daysLeft : (
      j.deadline ? Math.ceil((new Date(j.deadline).getTime() - Date.now()) / 86400000) : null
    );
    const isUrgent = (daysLeft !== null && daysLeft >= 0 && daysLeft <= 30) || !!j.urgent;
    // 倒计时文案 + 颜色
    let countdownText = '';
    let countdownClass = 'countdown-far';
    if (daysLeft === null) { countdownText = '日期待定'; countdownClass = 'countdown-far'; }
    else if (daysLeft < 0) { countdownText = '已截止 ' + (-daysLeft) + ' 天'; countdownClass = 'countdown-past'; }
    else if (daysLeft === 0) { countdownText = '今日截止 ⚠️'; countdownClass = 'countdown-urgent'; }
    else if (daysLeft <= 7) { countdownText = '还剩 ' + daysLeft + ' 天 🔴'; countdownClass = 'countdown-urgent'; }
    else if (daysLeft <= 30) { countdownText = '还剩 ' + daysLeft + ' 天 🟠'; countdownClass = 'countdown-soon'; }
    else { countdownText = '还剩 ' + daysLeft + ' 天 🟢'; countdownClass = 'countdown-far'; }
    // 竞争星级（按录用率）
    const competitionStars = rateVal < 19 ? '⭐⭐⭐⭐⭐' : rateVal < 23 ? '⭐⭐⭐⭐' : rateVal < 27 ? '⭐⭐⭐' : '⭐⭐';
    // 关键词 chips（最多 4 个）
    const keywordChips = (j.keywords || []).slice(0, 4).map(k =>
      '<span class="journal-kw-chip">' + escapeHtml(k) + '</span>'
    ).join('');

    const card = document.createElement('div');
    card.className = 'journal-card-new' + (isUrgent ? ' deadline-urgent' : '');
    card.onclick = function(e) {
      if (e.target.closest('button') || e.target.closest('a')) return;
      showJournalDetail(j.id || j.name);
    };

    card.innerHTML =
      // 顶部：CCF + 名称 + 全名 + 紧急标
      '<div class="journal-card-top">'
        + '<span class="ccf-badge level-' + j.ccf.toLowerCase() + '">CCF-' + j.ccf + '</span> '
        + '<span class="journal-name-main">' + escapeHtml(j.name) + '</span>'
        + (isUrgent ? ' <span class="deadline-urgent-tag">即将截稿</span>' : '')
      + '</div>'
      + '<div class="journal-card-fullname">' + escapeHtml(j.fullName || j.name) + '</div>'
      // 元信息行：截稿 + 分期 + 地点
      + '<div class="journal-card-meta">'
        + '<span><strong>截稿</strong>: <span class="' + (isUrgent ? 'deadline-urgent-text' : '') + '">'
          + (j.deadline ? formatDeadline(j.deadline, j.deadlineStage) : '待定') + '</span></span>'
        + '<span class="countdown-tag ' + countdownClass + '">' + countdownText + '</span>'
        + (j.location ? '<span>📍 ' + escapeHtml(j.location) + '</span>' : '')
      + '</div>'
      // 数据行：环形图 + 统计信息
      + '<div class="journal-card-stats">'
        + '<div class="journal-ring-wrap">'
          + '<svg width="52" height="52">'
            + '<circle cx="26" cy="26" r="' + r + '" fill="none" stroke="#E5E7EB" stroke-width="3"/>'
            + '<circle cx="26" cy="26" r="' + r + '" fill="none" stroke="' + ringColor + '" stroke-width="3" '
              + 'stroke-dasharray="' + circumference + '" stroke-dashoffset="' + offset + '" '
              + 'transform="rotate(-90 26 26)" stroke-linecap="round"/>'
            + '<text x="26" y="22" text-anchor="middle" font-size="12" font-weight="700" fill="var(--text-dark)">' + rateVal.toFixed(1) + '%</text>'
            + '<text x="26" y="36" text-anchor="middle" font-size="8" fill="var(--text-light)">录用率</text>'
          + '</svg>'
        + '</div>'
        + '<div class="journal-stats-info">'
          + '<div class="stats-info-row"><span class="stats-k">投稿数</span><span class="stats-v">' + formatNum(j.submissions) + '</span></div>'
          + '<div class="stats-info-row"><span class="stats-k">方向</span><span class="stats-v">' + escapeHtml(j.domainCn || j.domain || '综合') + '</span></div>'
          + '<div class="stats-info-row"><span class="stats-k">竞争</span><span class="stats-v">' + competitionStars + '</span></div>'
        + '</div>'
      + '</div>'
      // 关键词行
      + (keywordChips ? '<div class="journal-kw-row">' + keywordChips + '</div>' : '')
      // 按钮行：3 个操作
      + '<div class="journal-card-actions">'
        + '<button class="btn-action btn-ghost" onclick="event.stopPropagation();window.open(\'' + escapeAttr(j.officialSite || '#') + '\',\'_blank\',\'noopener\')">🌐 官网</button>'
        + '<button class="btn-action btn-ghost" onclick="event.stopPropagation();addDeadlineToCal(\'' + (j.id || j.name) + '\')">📅 加日历</button>'
        + '<button class="btn-action btn-primary-sm" onclick="event.stopPropagation();sendSubChatAuto(\'帮我分析' + j.name + '的投稿策略，包括方向匹配、录用率趋势和准备建议\')">🤖 AI 策略</button>'
      + '</div>';
    grid.appendChild(card);
  });
}

// 工具：格式化数字（3420 -> "3,420"）
function formatNum(n) {
  if (typeof n === 'string') return n;
  if (!n && n !== 0) return '—';
  return Number(n).toLocaleString('en-US');
}
// 工具：格式化截稿日期 + 分期
function formatDeadline(isoDate, stage) {
  if (!isoDate) return '待定';
  var d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  var str = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  return str + (stage ? ' (' + stage + ')' : '');
}
// 工具：HTML 转义
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function escapeAttr(s) { return escapeHtml(s); }

/**
 * 期刊详情弹窗（丰富版）：全称 / 元信息 / 历史录用率 mini 图 / 3 个官网链接
 */
// 当前详情弹窗中正在展示的 journalId
window.currentDetailJournalId = null;

function showJournalDetail(journalIdOrName) {
  const j = journals.find(x => (x.id === journalIdOrName) || (x.name === journalIdOrName));
  if (!j) return;
  window.currentDetailJournalId = j.id || j.name;

  var rateVal = parseFloat(j.rate) || 0;
  var matchColor = j.matchPct > 85 ? 'high' : j.matchPct > 70 ? 'mid' : 'low';

  // ===== 头部 =====
  var logo = $('detailLogo'); if (logo) {
    logo.textContent = (j.name || '—').slice(0, 4);
    logo.style.background = j.ccf === 'A' ? 'linear-gradient(135deg,#2563EB,#7C3AED)'
      : j.ccf === 'B' ? 'linear-gradient(135deg,#059669,#2563EB)'
      : 'linear-gradient(135deg,#F59E0B,#EA580C)';
  }
  var t = $('detailTitle'); if (t) t.childNodes.forEach(function (n) { if (n.nodeType === 3) t.removeChild(n); });
  if (t) t.insertBefore(document.createTextNode(j.name || ''), t.firstChild);
  var ccfBadge = $('detailCcfBadge'); if (ccfBadge) {
    ccfBadge.textContent = j.ccf || '';
    ccfBadge.className = 'badge ccf-badge ccf-' + j.ccf;
  }
  var mBadge = $('detailMatchBadge'); if (mBadge) {
    mBadge.textContent = '匹配度 ' + (j.matchPct || 0) + '%';
    mBadge.className = 'match-badge ' + matchColor;
  }
  var fulln = $('detailFullname'); if (fulln) fulln.textContent = j.fullName || j.name || '';

  // ===== 倒计时 =====
  var info = getDeadlineInfo(j.deadline);
  var cBox = $('detailCountdownBox'); if (cBox) {
    cBox.classList.remove('urgent', 'soon');
    if (info.status === 'urgent') cBox.classList.add('urgent');
    else if (info.status === 'soon') cBox.classList.add('soon');
  }
  var cn = $('detailCountdownNum'); if (cn) {
    cn.innerHTML = (info.daysLeft == null ? '—' : info.daysLeft) + '<small>天</small>';
  }
  $('detailStage') && ($('detailStage').textContent = (j.deadlineStage || '全文截止') + ' · ' + info.label);
  $('detailDate') && ($('detailDate').textContent = (j.deadline || '—') + (info.status === 'past' ? '（已截止）' : ''));

  // ===== 基本信息 =====
  $('detailNextEdition') && ($('detailNextEdition').textContent = j.nextEdition || '—');
  $('detailLocation') && ($('detailLocation').textContent = j.location || '—');
  $('detailPublisher') && ($('detailPublisher').textContent = j.publisher || '—');
  $('detailDomain') && ($('detailDomain').textContent = (j.domainCn || j.domain || '综合') + (j.ccf ? ' · CCF-' + j.ccf : ''));
  $('detailSubs') && ($('detailSubs').textContent = formatNum(j.submissions) + ' 篇/年');
  $('detailH5') && ($('detailH5').textContent = j.h5Index || '—');
  var siteA = $('detailSite'); if (siteA) { siteA.href = j.officialSite || '#'; siteA.textContent = j.officialSite ? '访问官网' : '—'; }
  var tplA = $('detailTpl'); if (tplA) { tplA.href = j.templateUrl || j.officialSite || '#'; tplA.textContent = j.templateUrl ? '下载模板' : '暂无'; }
  var reqA = $('detailReq'); if (reqA) { reqA.href = j.requirementsUrl || j.officialSite || '#'; }

  // ===== 关键词 =====
  var kwBox = $('detailKeywords'); if (kwBox) {
    var kws = j.keywords && j.keywords.length ? j.keywords : [];
    if (j.domainCn && kws.indexOf(j.domainCn) === -1) kws = [j.domainCn].concat(kws);
    kwBox.innerHTML = kws.map(function (k) { return '<span class="keyword-chip">' + escapeHtml(k) + '</span>'; }).join('') || '<span style="color:var(--text-light);font-size:12px;">暂无</span>';
  }

  // ===== 底部按钮状态 =====
  var remindBtn = $('detailRemindBtn');
  if (remindBtn) {
    var reminded = isDeadlineReminded(j.id || j.name);
    remindBtn.textContent = reminded ? '✅ 已加入提醒' : '🔔 截稿提醒';
    remindBtn.classList.toggle('reminded', reminded);
  }

  // ===== 录用率历史趋势（当前期刊一条线 + 同类平均 对比，用 journalDetailTrendChart）=====
  setTimeout(function () {
    if (typeof echarts === 'undefined') return;
    var chartDom = document.getElementById('journalDetailTrendChart');
    if (!chartDom) return;
    if (window._journalDetailChart) {
      try { window._journalDetailChart.dispose(); } catch (e) {}
    }
    var c = echarts.init(chartDom);
    window._journalDetailChart = c;

    var hist = (j.acceptanceHistory || []).slice().sort(function (a, b) { return a.year - b.year; });
    var years = hist.map(function (h) { return String(h.year); });
    var rates = hist.map(function (h) { return Number(h.rate); });
    var peerAvgSeries = null;
    if (j.ccf) {
      var peers = journals.filter(function (x) { return x.ccf === j.ccf && x.acceptanceHistory; });
      if (peers.length > 1) {
        var peerAvg = years.map(function (y) {
          var vs = peers.map(function (p) {
            var m = (p.acceptanceHistory || []).find(function (h) { return String(h.year) === y; });
            return m ? Number(m.rate) : NaN;
          }).filter(function (v) { return !isNaN(v); });
          return vs.length ? +(vs.reduce(function (s, x) { return s + x; }, 0) / vs.length).toFixed(1) : null;
        });
        peerAvgSeries = {
          name: 'CCF-' + j.ccf + ' 平均',
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2, color: '#94A3B8', type: 'dashed' },
          itemStyle: { color: '#94A3B8' },
          connectNulls: true,
          data: peerAvg
        };
      }
    }
    var yMin = 12, yMax = 34;
    var allRates = rates.concat(peerAvgSeries ? peerAvgSeries.data.filter(function (x) { return x != null; }) : []);
    if (allRates.length) {
      yMin = Math.max(10, Math.floor(Math.min.apply(null, allRates) / 2) * 2 - 2);
      yMax = Math.min(40, Math.ceil(Math.max.apply(null, allRates) / 2) * 2 + 2);
    }
    c.setOption({
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(255,255,255,0.96)', borderColor: '#E5E7EB', borderWidth: 1, textStyle: { fontFamily: 'Noto Sans SC', fontSize: 12, color: '#111827' }, formatter: function (params) {
        var s = '<strong style="font-size:13px;">' + params[0].axisValue + '</strong><br/>';
        params.forEach(function (p) { s += p.seriesName + ': <strong>' + (p.value == null ? '—' : p.value + '%') + '</strong><br/>'; });
        return s;
      } },
      legend: { data: [j.name + ' 录用率'].concat(peerAvgSeries ? [peerAvgSeries.name] : []), bottom: 0, textStyle: { fontFamily: 'Noto Sans SC', fontSize: 11, color: '#4B5563' } },
      grid: { left: 44, right: 18, top: 24, bottom: 34 },
      xAxis: { type: 'category', data: years, axisLabel: { fontFamily: 'Instrument Sans', color: '#9CA3AF' }, axisLine: { lineStyle: { color: '#E5E7EB' } } },
      yAxis: { type: 'value', name: '录用率(%)', min: yMin, max: yMax, axisLabel: { fontFamily: 'Instrument Sans', color: '#9CA3AF' }, nameTextStyle: { color: '#9CA3AF', fontSize: 10 }, splitLine: { lineStyle: { color: '#F3F4F6', type: 'dashed' } } },
      series: [{
        name: j.name + ' 录用率',
        type: 'line',
        smooth: true,
        symbol: 'circle', symbolSize: 6, showSymbol: true,
        lineStyle: { width: 3, color: '#2563EB' },
        itemStyle: { color: '#2563EB' },
        areaStyle: { color: 'rgba(37,99,235,0.12)' },
        connectNulls: true,
        data: rates
      }].concat(peerAvgSeries ? [peerAvgSeries] : [])
    });
  }, 30);

  // 显示
  var overlay = $('journalDetailOverlay');
  if (!overlay) return;
  overlay.classList.add('visible');
  overlay.style.display = 'flex';
}

/** 关闭期刊详情 */
function closeJournalDetail() {
  var overlay = $('journalDetailOverlay');
  if (!overlay) return;
  overlay.classList.remove('visible');
  overlay.style.display = 'none';
  window.currentDetailJournalId = null;
  if (window._journalDetailChart) {
    try { window._journalDetailChart.dispose(); window._journalDetailChart = null; } catch (e) {}
  }
}
// ESC 关闭详情与日历
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    var ov1 = $('journalDetailOverlay');
    if (ov1 && ov1.classList.contains('visible')) { closeJournalDetail(); return; }
    closeCalendarOverlay();
  }
});

/** 详情弹窗：切换截稿提醒 */
function toggleRemindDetail(evt) {
  evt && evt.stopPropagation && evt.stopPropagation();
  var id = window.currentDetailJournalId;
  if (!id) return;
  addDeadlineToCal(id);
  // 刷新按钮
  var btn = $('detailRemindBtn');
  if (btn) {
    var reminded = isDeadlineReminded(id);
    btn.textContent = reminded ? '✅ 已加入提醒' : '🔔 截稿提醒';
    btn.classList.toggle('reminded', reminded);
  }
  // 同步刷新卡片里该期刊的按钮状态
  renderJournals();
}

/** 详情弹窗：打开官网 */
function openOfficialSite(evt) {
  evt && evt.stopPropagation && evt.stopPropagation();
  var id = window.currentDetailJournalId;
  if (!id) return;
  var j = journals.find(function (x) { return x.id === id || x.name === id; });
  if (j && j.officialSite) window.open(j.officialSite, '_blank', 'noopener');
}

/** 详情弹窗：问 AI 投稿顾问（关闭弹窗并自动发送） */
function askAdvisorAbout(evt) {
  evt && evt.stopPropagation && evt.stopPropagation();
  var id = window.currentDetailJournalId;
  if (!id) return;
  var j = journals.find(function (x) { return x.id === id || x.name === id; });
  if (!j) return;
  closeJournalDetail();
  // 切到投稿分析页
  switchPage('submit');
  setTimeout(function () {
    switchSubTab('journals');
    sendSubChatAuto('帮我分析 ' + j.name + '（' + (j.fullName || j.nextEdition || '') + '）的投稿策略，包括录用率趋势、时间规划和格式要求。');
  }, 80);
}

/** 投稿趋势 Tab：按领域过滤趋势图曲线（全部/领域） —— 整合 P0-3 + P1-2/3/5 + P2-1/2 */
window._trendFilterDomain = 'all';
// 用户手动 toggle 的图例隐藏系列（id 集合），跨 pill 切换保留
window._trendHiddenIds = {};
window.applyTrendFilter = function (domain, btnEl) {
  window._trendFilterDomain = domain || 'all';
  if (btnEl) {
    var row = btnEl.closest('.trend-filters-pills') || btnEl.parentElement;
    var allBtns = row.querySelectorAll('.trend-filter-tag');
    allBtns.forEach(function (b) { b.classList.remove('active'); });
    btnEl.classList.add('active');
  }
  if (typeof echarts === 'undefined' || !journals.length) return;
  var dom = document.getElementById('detailTrendChart');
  if (!dom) return;

  // P2-1：选某个领域 → 该领域系列升级为彩色粗线（主系列），其余灰虚 context；否则取默认 4 条主
  var activeDomain = window._trendFilterDomain;
  var domainIds = {};
  if (activeDomain !== 'all') {
    journals.filter(function (j) { return (j.domainCn || j.domain || '') === activeDomain; })
      .forEach(function (j) { domainIds[j.id] = true; });
  }
  var defaultFocusIds = activeDomain === 'all'
    ? { 'ICLR': true, 'NeurIPS': true, 'ICML': true, 'ACL': true }
    : domainIds;

  var scope = journals.slice(); // 始终基于 12 篇整体渲染，其余变 context（不丢失年份参照系）
  var paletteMap = buildPaletteMap();
  // 收集年份（所有 scope，保证跨 pill 切换横轴不变）
  var yearSet = {};
  scope.forEach(function (j) { (j.acceptanceHistory || []).forEach(function (h) { yearSet[String(h.year)] = true; }); });
  var years = Object.keys(yearSet).sort();

  var series = scope.map(function (j) {
    var mp = {};
    (j.acceptanceHistory || []).forEach(function (h) { mp[String(h.year)] = h.rate; });
    var data = years.map(function (y) { var v = mp[y]; return v == null ? null : Number(v); });
    // 末尾非空数据点（用于 end-of-line 直接标签）
    var lastNonNullIdx = -1;
    for (var i = data.length - 1; i >= 0; i--) { if (data[i] != null) { lastNonNullIdx = i; break; } }
    var isFocus = !!defaultFocusIds[j.id];
    var hidden = !!window._trendHiddenIds[j.id];
    var baseColor = paletteMap[j.id] || '#6B7280';
    var color = isFocus ? baseColor : '#C9CED6';
    var lineStyle = isFocus
      ? { width: 3, color: color }
      : { width: 1.2, color: color, type: 'dashed' };
    var symbolSize = isFocus ? 6 : 3;
    // end-of-line 直接标签（P1-3）：只在主系列最后一个有效点右侧显示
    var label = { show: false };
    if (isFocus && lastNonNullIdx >= 0 && !hidden) {
      label = {
        show: true,
        position: 'right',
        formatter: function () { return j.name + '  ' + data[lastNonNullIdx] + '%'; },
        color: baseColor,
        fontFamily: 'Instrument Sans, Noto Sans SC, sans-serif',
        fontWeight: 700,
        fontSize: 11,
        distance: 6,
        // 只在 lastNonNullIdx 位置显示
        dataOnly: true
      };
    }
    // ECharts 5 label 支持精确指定位置：用数组 data 打点 label
    var dataWithLabel = data.slice();
    if (isFocus && lastNonNullIdx >= 0 && !hidden) {
      dataWithLabel = data.map(function (v, i) {
        if (i === lastNonNullIdx) {
          return {
            value: v,
            label: {
              show: true, position: 'right',
              formatter: j.name + '  ' + v + '%',
              color: baseColor, fontWeight: 700, fontSize: 11, distance: 6,
              fontFamily: 'Instrument Sans, Noto Sans SC, sans-serif',
              backgroundColor: '#fff', padding: [2, 6], borderRadius: 6,
              borderColor: '#EEF0F3', borderWidth: 1,
              shadowBlur: 4, shadowColor: 'rgba(15,23,42,0.06)'
            }
          };
        }
        return v;
      });
    }
    return {
      name: j.name,
      id: j.id,
      journal: j,
      type: 'line',
      smooth: true,
      showSymbol: isFocus,
      symbol: 'circle',
      symbolSize: symbolSize,
      // P0-3：双年刊断线不连（connectNulls=false）
      connectNulls: false,
      lineStyle: lineStyle,
      itemStyle: { color: isFocus ? baseColor : '#C9CED6' },
      emphasis: { focus: 'series', lineStyle: { width: isFocus ? 4 : 2 } },
      // legend 用户手动隐藏时：整系列不显示
      data: hidden ? [] : dataWithLabel
    };
  });

  if (!subDetailTrendChart) {
    subDetailTrendChart = echarts.init(dom);
  } else {
    try { subDetailTrendChart.resize(); } catch (e) {}
  }
  // 双保险：任何情况下 init 后再调 2 次 resize 适应可能延迟的 reflow
  try {
    subDetailTrendChart.resize();
    setTimeout(function () { try { subDetailTrendChart.resize(); } catch (e) {} }, 60);
  } catch (e) {}

  // P1-5：Y 轴收紧到 18–32（真实数据区间）
  var arr = [];
  series.forEach(function (s) { (s.data || []).forEach(function (v) {
    var num = (v && typeof v === 'object') ? v.value : v;
    if (typeof num === 'number') arr.push(num);
  }); });
  var yrMin = 18, yrMax = 32;
  if (arr.length) {
    yrMin = Math.max(15, Math.floor(Math.min.apply(null, arr) / 2) * 2 - 1);
    yrMax = Math.min(35, Math.ceil(Math.max.apply(null, arr) / 2) * 2 + 1);
  }

  // P2-1：切换 pill 时刷新 claim 标题
  updateClaimTitle(activeDomain, defaultFocusIds);
  // P1-4：渲染 3 张洞察卡
  renderInsightCards(activeDomain);
  // P2-2：渲染交互 legend 网格
  renderLegendGrid(activeDomain, defaultFocusIds, paletteMap);

  // P0-3 + P1-2 + P1-3：最终 setOption（不显示内部 legend，全部由网格 legend 承担）
  subDetailTrendChart.setOption({
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(255,255,255,0.96)', borderColor: '#E5E7EB', borderWidth: 1,
      textStyle: { fontFamily: 'Noto Sans SC, Instrument Sans, sans-serif', fontSize: 12, color: '#111827' },
      extraCssText: 'box-shadow: 0 6px 18px rgba(15,23,42,0.08); border-radius:10px;',
      formatter: function (params) {
        if (!params || !params.length) return '';
        var yr = params[0].axisValue;
        var s = '<strong style="font-size:13px;color:#111827;">' + yr + ' 录用率</strong><br/>';
        var sorted = params.slice().filter(function (p) { return p.value != null; })
          .sort(function (a, b) { return (b.value || 0) - (a.value || 0); });
        if (!sorted.length) s += '<span style="color:#9CA3AF;font-size:11px;">（该年份所有系列数据缺失）</span><br/>';
        sorted.forEach(function (p) {
          s += '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + p.color + ';margin-right:6px;"></span>'
            + p.seriesName + ': <strong style="color:#0F172A;">' + (p.value == null ? '' : p.value + '%') + '</strong><br/>';
        });
        // P0-3：双年刊小注 —— 该年缺失数据的非隐藏系列
        var missing = params.filter(function (p) { return p.value == null; }).map(function (p) { return p.seriesName; });
        if (missing.length) {
          s += '<div style="margin-top:4px;padding-top:4px;border-top:1px dashed #E5E7EB;font-size:10px;color:#9CA3AF;">'
            + '* ' + missing.join(' / ') + ' 该年无会议</div>';
        }
        return s;
      }
    },
    legend: { show: false }, // 不再用 ECharts 内部 legend，改用自定义网格
    grid: { left: 48, right: 78, top: 18, bottom: 28 },
    xAxis: {
      type: 'category', data: years, boundaryGap: false,
      axisLabel: { fontFamily: 'Instrument Sans, sans-serif', color: '#9CA3AF', fontSize: 11 },
      axisLine: { lineStyle: { color: '#E5E7EB' } }, axisTick: { show: false }
    },
    yAxis: {
      type: 'value', name: '录用率 (%)', min: yrMin, max: yrMax, interval: 2,
      axisLabel: { fontFamily: 'Instrument Sans, sans-serif', color: '#9CA3AF', fontSize: 11, formatter: '{value}' },
      nameTextStyle: { color: '#9CA3AF', fontSize: 10, padding: [0, 0, 0, -14] },
      splitLine: { lineStyle: { color: '#F3F4F6', type: 'dashed' } }
    },
    series: series
  }, true);
};

/* ============================================================
   工具：为每篇期刊构造一个稳定的调色板映射
   ============================================================ */
function buildPaletteMap() {
  var palette = [
    '#2563EB', // CVPR  蓝
    '#1D4ED8', // ICCV  深蓝
    '#3B82F6', // ECCV  浅蓝
    '#DC2626', // ACL   红
    '#EF4444', // EMNLP 橙红
    '#0EA5E9', // NAACL 天蓝
    '#7C3AED', // ICML  紫
    '#059669', // NeurIPS 墨绿
    '#F59E0B', // ICLR  金黄
    '#0891B2', // AAAI  青
    '#EC4899', // IJCAI 粉
    '#6366F1'  // KDD   靛青
  ];
  var ids = journals.map(function (j) { return j.id; });
  var map = {};
  journals.forEach(function (j, i) { map[j.id] = palette[i % palette.length]; });
  return map;
}

/* ============================================================
   P2-2：交互 legend 2 行网格（6 列 → 12 个）
   ============================================================ */
function renderLegendGrid(activeDomain, focusIds, paletteMap) {
  var wrap = document.getElementById('trendLegendGrid');
  if (!wrap) return;
  wrap.innerHTML = '';
  journals.forEach(function (j) {
    var isHidden = !!window._trendHiddenIds[j.id];
    var isFocus = !!focusIds[j.id];
    var color = isFocus ? (paletteMap[j.id] || '#6B7280') : '#C9CED6';
    var hist = j.acceptanceHistory || [];
    var latest = null, latestYear = null;
    hist.forEach(function (h) { if (latestYear == null || h.year > latestYear) { latest = h.rate; latestYear = h.year; } });
    var item = document.createElement('div');
    item.className = 'legend-item' + (isFocus && !isHidden ? ' highlight' : '') + (isHidden ? ' disabled' : '');
    item.title = (j.fullName || j.name) + ' · ' + (j.domainCn || j.domain || '');
    item.innerHTML =
      '<span class="legend-dot" style="background:' + (isFocus ? color : '#D1D5DB') + ';'
      + (isFocus ? '' : 'opacity:0.5;') + '"></span>'
      + '<span class="legend-name">' + j.name + '</span>'
      + '<span class="legend-value">' + (latest != null ? (Number(latest).toFixed(1) + '%') : '—') + '</span>';
    // 点击 toggle 显示/隐藏（P2-2 交互）
    item.onclick = function () {
      if (isHidden) delete window._trendHiddenIds[j.id];
      else window._trendHiddenIds[j.id] = true;
      // 不刷新 pill，直接按当前领域重新渲染
      var curActive = document.querySelector('.trend-filters-pills .trend-filter-tag.active');
      window.applyTrendFilter(window._trendFilterDomain, curActive);
    };
    wrap.appendChild(item);
  });
}

/* ============================================================
   P1-4：3 张洞察卡（录用率榜首 / 6年涨幅 TOP / 跌幅最大）
   ============================================================ */
function renderInsightCards(activeDomain) {
  var scope = activeDomain === 'all' ? journals.slice()
    : journals.filter(function (j) { return (j.domainCn || j.domain || '') === activeDomain; });
  if (!scope.length) scope = journals.slice();

  var cardTop = document.getElementById('insightTopCard');
  var cardUp  = document.getElementById('insightUpCard');
  var cardDown = document.getElementById('insightDownCard');

  // 1) 录用率榜首：最新年份最高者
  var entries = scope.map(function (j) {
    var hist = (j.acceptanceHistory || []).slice().sort(function (a, b) { return b.year - a.year; });
    var last = hist[0] || null;
    // 6 年变化（最新 - 最早）
    var deltaPp = null;
    if (hist.length >= 2) {
      var oldest = hist[hist.length - 1];
      deltaPp = Number(last.rate) - Number(oldest.rate);
    }
    return {
      id: j.id, name: j.name, fullName: j.fullName,
      lastRate: last ? Number(last.rate) : null,
      lastYear: last ? last.year : null,
      deltaPp: deltaPp,
      hist: j.acceptanceHistory || []
    };
  }).filter(function (e) { return e.lastRate != null; });

  if (cardTop) {
    var top = entries.slice().sort(function (a, b) { return b.lastRate - a.lastRate; })[0];
    if (top) {
      cardTop.querySelector('.insight-value').textContent = top.lastRate.toFixed(1) + '%';
      cardTop.querySelector('.insight-meta').innerHTML =
        '<strong style="color:#0F172A;">' + top.name + '</strong>'
        + '<span style="color:#6B7280;">' + top.lastYear + ' </span>'
        + (top.deltaPp != null && top.deltaPp !== 0
          ? '<span class="' + (top.deltaPp > 0 ? 'arrow-up' : 'arrow-down') + '">'
            + (top.deltaPp > 0 ? '▲ +' : '▼ ') + top.deltaPp.toFixed(1) + 'pp</span>'
          : '')
        + (top.hist.length >= 2
          ? '<svg class="insight-spark" viewBox="0 0 80 22" preserveAspectRatio="none">'
            + sparklineSVG(top.hist, top.deltaPp >= 0 ? '#059669' : '#DC2626')
            + '</svg>'
          : '');
    }
  }

  if (cardUp) {
    var ups = entries.filter(function (e) { return e.deltaPp != null; });
    var up = ups.slice().sort(function (a, b) { return b.deltaPp - a.deltaPp; })[0];
    if (up) {
      var pos = up.deltaPp >= 0;
      cardUp.querySelector('.insight-value').textContent = (pos ? '+' : '') + up.deltaPp.toFixed(1) + 'pp';
      cardUp.querySelector('.insight-meta').innerHTML =
        '<strong style="color:#0F172A;">' + up.name + '</strong>'
        + (up.hist.length >= 2
          ? '<svg class="insight-spark" viewBox="0 0 80 22" preserveAspectRatio="none">' + sparklineSVG(up.hist, '#059669') + '</svg>'
          : '');
    }
  }

  if (cardDown) {
    var downs = entries.filter(function (e) { return e.deltaPp != null; });
    var down = downs.slice().sort(function (a, b) { return a.deltaPp - b.deltaPp; })[0];
    if (down) {
      var dn = down.deltaPp <= 0;
      cardDown.querySelector('.insight-value').textContent = (dn ? '' : '+') + down.deltaPp.toFixed(1) + 'pp';
      cardDown.querySelector('.insight-meta').innerHTML =
        '<strong style="color:#0F172A;">' + down.name + '</strong>'
        + (down.hist.length >= 2
          ? '<svg class="insight-spark" viewBox="0 0 80 22" preserveAspectRatio="none">' + sparklineSVG(down.hist, '#DC2626') + '</svg>'
          : '');
    }
  }
}

/* 迷你 sparkline SVG（仅针对 acceptanceHistory 数组 [{year,rate}]） */
function sparklineSVG(hist, color) {
  if (!hist || !hist.length) return '';
  var sorted = hist.slice().sort(function (a, b) { return a.year - b.year; });
  var xs = sorted.map(function (h) { return Number(h.rate); });
  var mn = Math.min.apply(null, xs), mx = Math.max.apply(null, xs);
  var span = mx - mn || 1;
  var W = 80, H = 22;
  var pts = sorted.map(function (h, i) {
    var x = (sorted.length === 1 ? W / 2 : (i * W / (sorted.length - 1)));
    var y = H - ((Number(h.rate) - mn) / span) * (H - 4) - 2;
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  return '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'
       + '<polyline points="0,' + (H-0.5) + ' ' + pts + ' ' + W + ',' + (H-0.5) + '" '
       + 'fill="' + color + '" fill-opacity="0.10" stroke="none"/>';
}

/* ============================================================
   P2-1：根据当前 pill 选择更新 claim 标题
   ============================================================ */
function updateClaimTitle(activeDomain, focusIds) {
  var titleEl = document.getElementById('trendClaimTitle');
  if (!titleEl) return;
  if (activeDomain === 'all') {
    titleEl.textContent = '2020—2027 CCF-A/B 会议录用率走势：ICLR 蝉联第一，传统 CV 会议整体下行';
    return;
  }
  // 具体领域：聚焦该领域表现
  var scope = journals.filter(function (j) { return (j.domainCn || j.domain || '') === activeDomain; });
  if (!scope.length) return;
  var topName = '—', topRate = 0;
  scope.forEach(function (j) {
    var latest = (j.acceptanceHistory || []).sort(function (a,b){return b.year-a.year;})[0];
    if (latest && Number(latest.rate) > topRate) { topRate = Number(latest.rate); topName = j.name; }
  });
  titleEl.textContent = activeDomain + ' 领域顶级会议近 7 年录用率：' + topName + ' 以 ' + topRate.toFixed(1) + '% 居首';
}

/** 解析截稿日期，返回 {daysLeft, status, label}。支持 'yyyy-mm-dd' / 'yyyy年mm月dd日' 两种格式。 */
function getDeadlineInfo(deadline) {
  if (!deadline) return { daysLeft: null, status: 'unknown', label: '日期待定' };
  var d = null;
  if (typeof deadline === 'string') {
    // ISO: yyyy-mm-dd
    var m1 = deadline.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (m1) d = new Date(parseInt(m1[1], 10), parseInt(m1[2], 10) - 1, parseInt(m1[3], 10));
    else {
      // 中文日期: yyyy年mm月dd日
      var m2 = deadline.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
      if (m2) d = new Date(parseInt(m2[1], 10), parseInt(m2[2], 10) - 1, parseInt(m2[3], 10));
    }
  }
  if (!d || isNaN(d.getTime())) return { daysLeft: null, status: 'unknown', label: '日期待定' };
  var today = new Date(); today.setHours(0,0,0,0);
  var diffMs = d.getTime() - today.getTime();
  var days = Math.round(diffMs / 86400000);
  if (days < 0) return { daysLeft: days, status: 'past', label: '已截止 ' + (-days) + ' 天' };
  if (days === 0) return { daysLeft: 0, status: 'urgent', label: '今日截止 ⚠️' };
  if (days <= 7) return { daysLeft: days, status: 'urgent', label: '剩 ' + days + ' 天紧急' };
  if (days <= 30) return { daysLeft: days, status: 'soon', label: '剩 ' + days + ' 天' };
  return { daysLeft: days, status: 'far', label: '剩 ' + days + ' 天' };
}

/** 是否已加入截稿提醒 */
function isDeadlineReminded(id) {
  if (!id) return false;
  try {
    var list = JSON.parse(localStorage.getItem('yanshu_deadline_list') || '[]');
    return list.some(function (x) { return x.id === id; });
  } catch (e) { return false; }
}

/** P1-2：刷新顶部投稿分析统计条 */
function refreshSubmissionStats() {
  var open = 0, within30 = 0, highRate = 0, ccfA = 0;
  journals.forEach(function (j) {
    if (j.ccf === 'A') ccfA++;
    var r = parseFloat(j.rate) || 0;
    if (r >= 25) highRate++;
    var info = getDeadlineInfo(j.deadline);
    if (info.status !== 'past' && info.status !== 'unknown') open++;
    if (info.daysLeft != null && info.daysLeft >= 0 && info.daysLeft <= 30) within30++;
  });
  var e1 = $('stat-open'); if (e1) e1.textContent = open;
  var e2 = $('stat-30'); if (e2) e2.textContent = within30;
  var e3 = $('stat-high-rate'); if (e3) e3.textContent = highRate;
  var e4 = $('stat-ccf-a'); if (e4) e4.textContent = ccfA;
  var e5 = $('stat-total'); if (e5) e5.textContent = journals.length;
}

// ============================================================
// 十三、AI 投稿助手对话
// ============================================================

/**
 * 把某个会议的截稿加入本地提醒（存到 localStorage + toast 通知）
 */
function addDeadlineToCal(journalIdOrName) {
  const j = journals.find(x => (x.id === journalIdOrName) || (x.name === journalIdOrName));
  if (!j || !j.deadline) { showToast('该会议截稿日期待定', 'info'); return; }
  var key = 'yanshu_deadline_list';
  var list = [];
  try { list = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { list = []; }
  if (!list.find(function (x) { return x.id === (j.id || j.name); })) {
    list.push({ id: j.id || j.name, name: j.name, deadline: j.deadline, stage: j.deadlineStage || '', added: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(list));
  }
  showToast('已添加到截稿提醒：' + j.name + '（' + formatDeadline(j.deadline, j.deadlineStage) + '）', 'success');
}

// ECharts 录用趋势图表实例（期刊列表 Tab 紧凑小图 / 趋势 Tab 大图）
// 注意：避免与 reading.js 中的同名 var 冲突，改名为 subDetailTrendChart
let trendChart = null;
let subDetailTrendChart = null;

/**
 * 根据 journals 数据生成趋势图配置（不再硬编码 3 条线）
 * - all: 是否展示全部 12 个系列（趋势大图 Tab），false 时只展示前 4 个默认（期刊列表 Tab）
 */
function buildTrendOption(all) {
  // 收集所有出现的年份，做横轴
  var yearSet = {};
  var seriesList = [];
  // 调色板（循环使用）
  var palette = [
    '#1A56DB', '#7C3AED', '#059669', '#DC2626', '#F59E0B', '#2563EB',
    '#9333EA', '#10B981', '#EA580C', '#0EA5E9', '#EC4899', '#6366F1'
  ];
  var selectedJournals = all ? journals.slice() : journals.slice(0, 4);
  selectedJournals.forEach(function (j, idx) {
    var hist = j.acceptanceHistory || [];
    if (!hist.length) return;
    hist.forEach(function (h) { yearSet[String(h.year)] = true; });
    seriesList.push({
      name: j.name,
      journal: j,
      color: palette[idx % palette.length]
    });
  });
  // 年份排序
  var years = Object.keys(yearSet).sort();
  // 构造 series data（对齐年份，缺失插值）
  var series = seriesList.map(function (s, idx) {
    var histMap = {};
    (s.journal.acceptanceHistory || []).forEach(function (h) { histMap[String(h.year)] = h.rate; });
    var data = years.map(function (y) {
      var v = histMap[y];
      return v == null ? null : Number(v);
    });
    return {
      name: s.name,
      type: 'line',
      smooth: true,
      showSymbol: true,
      symbol: 'circle',
      symbolSize: 6,
      connectNulls: true,
      lineStyle: { width: all ? 2.5 : 3, color: s.color },
      itemStyle: { color: s.color },
      areaStyle: all ? undefined : { color: hexToRgba(s.color, 0.08) },
      data: data
    };
  });
  // Y 轴范围（根据数据自动推算）
  var allRates = [];
  series.forEach(function (s) { s.data.forEach(function (v) { if (typeof v === 'number') allRates.push(v); }); });
  var yMin = 12, yMax = 34;
  if (allRates.length) {
    yMin = Math.max(10, Math.floor(Math.min.apply(null, allRates) / 2) * 2 - 2);
    yMax = Math.min(40, Math.ceil(Math.max.apply(null, allRates) / 2) * 2 + 2);
  }

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.96)',
      borderColor: '#E5E7EB',
      borderWidth: 1,
      textStyle: { fontFamily: 'Noto Sans SC', fontSize: 12, color: '#111827' },
      formatter: function (params) {
        var s = '<strong style="font-size:13px;">' + params[0].axisValue + '</strong><br/>';
        params.slice().sort(function (a, b) { return (b.value || 0) - (a.value || 0); }).forEach(function (p) {
          s += '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + p.color + ';margin-right:6px;"></span>'
            + p.seriesName + ': <strong>' + (p.value == null ? '—' : p.value + '%') + '</strong><br/>';
        });
        return s;
      }
    },
    legend: {
      type: 'scroll',
      pageTextStyle: { color: '#9CA3AF' },
      data: series.map(function (s) { return s.name; }),
      bottom: 0,
      textStyle: { fontFamily: 'Noto Sans SC', fontSize: 12, color: '#4B5563' }
    },
    grid: { left: 52, right: 24, top: 28, bottom: all ? 64 : 48 },
    xAxis: {
      type: 'category',
      data: years,
      axisLabel: { fontFamily: 'Instrument Sans', color: '#9CA3AF' },
      axisLine: { lineStyle: { color: '#E5E7EB' } }
    },
    yAxis: {
      type: 'value',
      name: '录用率(%)',
      min: yMin,
      max: yMax,
      axisLabel: { fontFamily: 'Instrument Sans', color: '#9CA3AF', formatter: '{value}' },
      nameTextStyle: { color: '#9CA3AF', fontSize: 11 },
      splitLine: { lineStyle: { color: '#F3F4F6', type: 'dashed' } }
    },
    series: series
  };
}

// 颜色工具：#RRGGBB -> rgba(r,g,b,a)
function hexToRgba(hex, alpha) {
  var h = (hex || '').replace('#', '');
  if (h.length !== 6) return 'rgba(26,86,219,0.08)';
  var r = parseInt(h.slice(0, 2), 16);
  var g = parseInt(h.slice(2, 4), 16);
  var b = parseInt(h.slice(4, 6), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + (alpha || 1) + ')';
}

/**
 * 初始化录用率趋势图（期刊列表 Tab：前 4 条线，紧凑视图）
 */
function initTrendChart() {
  if (typeof echarts === 'undefined') return;
  const dom = document.getElementById('trendChart');
  if (!dom) return;
  if (trendChart) { trendChart.dispose(); }
  trendChart = echarts.init(dom);
  trendChart.setOption(buildTrendOption(false));
}

/**
 * 初始化详情录用率趋势图（投稿趋势 Tab：全部系列，大图）
 * —— 现在通过 applyTrendFilter 统一驱动，会一起渲染 3 张洞察卡 + 交互 legend + claim 标题
 */
function initDetailTrendChart() {
  if (typeof echarts === 'undefined') return;
  var dom = document.getElementById('detailTrendChart');
  if (!dom) return;
  // dispose 后交给 applyTrendFilter 重新 init（保证 pill 激活样式 + 首次自动渲染 3卡/legend）
  if (subDetailTrendChart) { try { subDetailTrendChart.dispose(); } catch (e) {} subDetailTrendChart = null; }
  // 找到趋势筛选器里当前 active 的 pill 或 "全部" 按钮
  var activeBtn = document.querySelector('#tabTrendsView .trend-filter-tag.active')
    || document.querySelector('#tabTrendsView .trend-filter-tag');
  window.applyTrendFilter(window._trendFilterDomain || 'all', activeBtn);
}

// ECharts 图表响应式缩放 + AI 助手 fixed 像素对齐
window.addEventListener('resize', function () {
  if (trendChart) { try { trendChart.resize(); } catch (e) {} }
  if (subDetailTrendChart) { try { subDetailTrendChart.resize(); } catch (e) {} }
  alignAIPanel();
});
// 滚动时不需要重新计算 left（sub-left-new.right 不随滚动变），但窗口 innerWidth 变化时 resize 已处理。

/* ============================================================
   AI 助手面板精确像素对齐（经验方案A：fixed + left = subLeft.right + 24px）
   小屏 ≤820px 时直接跳过（CSS 媒体查询已 position:static）
   ============================================================ */
function alignAIPanel() {
  try {
    var panel = document.querySelector('#page-submit .sub-right-new');
    if (!panel) return;
    var isMobile = window.innerWidth <= 820;
    if (isMobile) { panel.style.left = ''; panel.style.top = ''; panel.style.width = ''; return; }
    var subLeft = document.querySelector('#page-submit .sub-left-new');
    if (!subLeft) return;
    var lr = subLeft.getBoundingClientRect();
    if (!lr.width) return;
    var gap = 24;
    var leftPx = Math.round(lr.right + gap);
    panel.style.left = leftPx + 'px';
    // 宽度：sub-page-inner.right - (lr.right + gap) 最多 300px
    var subInner = document.querySelector('#page-submit .sub-page-inner') || document.querySelector('#page-submit');
    var innerR = subInner.getBoundingClientRect().right;
    var maxW = Math.max(260, Math.min(300, innerR - lr.right - gap - 4));
    panel.style.width = maxW + 'px';
    // 限制最大高度，防止底部超出视口
    panel.style.maxHeight = 'calc(100vh - 112px)';
  } catch (e) { /* 忽略异常，避免影响主流程 */ }
}
// DOM 稳定、页面切换到投稿、切换 Tab 都重新对齐
setTimeout(alignAIPanel, 100);
setTimeout(alignAIPanel, 600);

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

/** 渲染三个月日历视图（含截稿日期标注） —— 修复日期格式，支持 ISO yyyy-mm-dd */
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
    const yyyy = monthDate.getFullYear();
    const mm = String(monthDate.getMonth() + 1).padStart(2, '0');

    html += '<div class="cal-month"><h4 style="font-size:14px;font-weight:600;margin:8px 0;">' + monthName + '</h4>';
    html += '<div class="cal-weekdays"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>';
    html += '<div class="cal-days">';
    for (let i = 0; i < startDay; i++) html += '<div class="cal-day empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const dateIso = yyyy + '-' + mm + '-' + String(d).padStart(2, '0');
      // 匹配 ISO 格式（yyyy-mm-dd），取"年月日"部分比对
      const deadlines = journals.filter(function (j) {
        if (ccfFilter !== 'all' && j.ccf !== ccfFilter) return false;
        if (!j.deadline) return false;
        // j.deadline 格式统一应为 yyyy-mm-dd，取前 10 位即可
        return String(j.deadline).slice(0, 10) === dateIso;
      });
      var tooltip = deadlines.length ? deadlines.map(function (j) { return j.name + ' 截稿（' + (j.deadlineStage || '全文截止') + '）'; }).join('&#10;') : '';
      html += '<div class="cal-day' + (deadlines.length ? ' has-deadline' : '') + '"'
        + (tooltip ? ' title="' + tooltip + '"' : '') + '>'
        + d + (deadlines.length ? '<span class="cal-dot" style="display:block;width:4px;height:4px;margin:2px auto 0;background:#DC2626;border-radius:50%;"></span>' : '')
        + '</div>';
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
  if (!allPapers.length) allPapers = papers.slice();
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
  renderPapers(0, papers.length);
  // 首帧尽量恢复阅读返回的滚动位置（不消费，loadData 渲染真实数据后校准）
  restoreReadingScroll(false);
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
