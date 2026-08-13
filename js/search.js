/**
 * search.js — 搜索历史与论文渲染
 *
 * 职责：搜索历史管理、论文卡片渲染、过滤器交互、趋势指示器
 * 包含模块：七、搜索与论文渲染；assignTrends 和 trendValues（来自原"二十一、初始化入口"章节）
 */

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
  if (!box || !panel) return;
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

// 排序标签点击切换（综合排序 / 最新发表 / 高引论文）
document.querySelectorAll('.sort-tag').forEach(tag => {
  tag.addEventListener('click', function() {
    document.querySelectorAll('.sort-tag').forEach(t => t.classList.remove('active'));
    this.classList.add('active');
  });
});

// 已渲染的论文卡片数量计数器
let paperCount = 0;
let currentSearchMeta = null;

function normalizeFrontendPaper(p) {
  const citations = p.citations != null ? String(p.citations) : '0';
  return {
    id: p.id || p.paper_id || '',
    title: p.title || '未命名论文',
    authors: p.authors || p.author || '未知作者',
    venue: p.venue || '未知来源',
    ccf: p.ccf || 'N/A',
    match: p.match || p.match_label || 'partial',
    matchLabel: p.matchLabel || p.match_label || 'Partial',
    abstract: p.abstract || '',
    citations: citations.includes('+') || citations.includes(',') ? citations : (parseInt(citations, 10) || 0).toLocaleString() + '+',
    heat: p.heat || 'Warm',
    year: p.year || 'N/A',
    keywords: Array.isArray(p.keywords) ? p.keywords : [],
    doi: p.doi || '',
    institute: p.institute || ''
  };
}

function setDailyRecommendationsVisible(visible) {
  const header = document.getElementById('dailyRecHeader');
  const grid = document.getElementById('dailyRecGrid');
  if (header) header.style.display = visible ? '' : 'none';
  if (grid) grid.style.display = visible ? '' : 'none';
}

function renderAgentWorkflow(state, meta) {
  const panel = document.getElementById('agentWorkflowPanel');
  if (!panel) return;
  const isRunning = state === 'running';
  const workflow = meta?.workflow || {};
  const planned = workflow.steps || [];
  const agents = meta?.agents || workflow.agents || ['supervisor', 'scout'];
  const steps = planned.length ? planned : [
    { agent: 'supervisor', action: '识别检索意图并授权工具', status: isRunning ? 'running' : 'done' },
    ...agents.map((agent, idx) => ({
      agent,
      action: agent === 'scout' ? '召回候选论文并计算相关度' : '执行科研子任务',
      status: isRunning ? (idx === 0 ? 'running' : 'pending') : 'done'
    }))
  ];
  const statusText = isRunning ? '多智能体正在工作' : '多智能体流程已完成';
  const metaLine = meta ? [
    meta.task_type ? '任务类型: ' + escapeHtml(meta.task_type) : '',
    meta.candidates_count != null ? '候选: ' + meta.candidates_count : '',
    meta.search_time != null ? '耗时: ' + meta.search_time + 's' : '',
    meta.count != null ? '返回: ' + meta.count : ''
  ].filter(Boolean).join(' / ') : 'Supervisor 正在规划，Scout 正在检索论文库';

  panel.style.display = '';
  panel.innerHTML = '<div class="agent-workflow-head">'
    + '<div><div class="agent-workflow-title">' + statusText + '</div><div class="agent-workflow-meta">' + metaLine + '</div></div>'
    + '<button class="agent-workflow-reset" onclick="resetSearchResults()">返回每日推荐</button>'
    + '</div>'
    + '<div class="agent-workflow-steps">'
    + steps.map((step, i) => '<div class="agent-step ' + escapeHtml(step.status || (isRunning ? 'pending' : 'done')) + '">'
      + '<span class="agent-step-dot"></span>'
      + '<div class="agent-step-body"><span class="agent-step-agent">' + escapeHtml(step.agent || ('step' + (i + 1))) + '</span>'
      + '<span class="agent-step-action">' + escapeHtml(step.action || '执行任务') + '</span></div>'
      + '</div>').join('')
    + '</div>';
}

function renderEmptySearch(query) {
  const grid = document.getElementById('paperGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="search-empty-state">'
    + '<div class="search-empty-title">未检索到匹配论文</div>'
    + '<div class="search-empty-text">查询「' + escapeHtml(query) + '」暂无结果，请尝试更宽泛的关键词或切换语义检索。</div>'
    + '</div>';
}

async function performPaperSearch(mode) {
  const input = document.getElementById('searchInput');
  const query = (input?.value || '').trim() || '深度学习';
  const grid = document.getElementById('paperGrid');
  const loadWrap = document.querySelector('.load-more-wrap');
  const countEl = document.getElementById('paperCountDisplay');
  const mainBtn = document.querySelector('.search-btn.main');
  const semanticBtn = document.querySelector('.search-btn.semantic');

  addSearchHistory();
  hideSearchHistory();
  setDailyRecommendationsVisible(false);
  if (grid) grid.innerHTML = '';
  if (loadWrap) loadWrap.style.display = 'none';
  if (countEl) countEl.textContent = '检索中...';
  [mainBtn, semanticBtn].forEach(btn => { if (btn) btn.disabled = true; });
  renderAgentWorkflow('running', { query, agents: ['supervisor', 'scout'] });

  try {
    const result = await apiFetch('/search', {
      method: 'POST',
      body: { query, mode: mode || 'keyword', task_type: 'paper_search' }
    });
    const found = (result && Array.isArray(result.data)) ? result.data.map(normalizeFrontendPaper) : [];
    papers = found;
    currentSearchMeta = result?.meta || { query, count: found.length };

    if (grid) grid.innerHTML = '';
    paperCount = 0;
    if (found.length) {
      renderPapers(0, found.length);
      showToast('已检索到 ' + found.length + ' 篇论文', 'success');
    } else {
      renderEmptySearch(query);
      showToast('没有找到匹配论文', 'warning');
    }
    if (countEl) countEl.textContent = '检索结果 ' + found.length + ' 篇';
    renderAgentWorkflow('done', { ...currentSearchMeta, count: found.length });
  } catch (e) {
    console.error('论文检索失败:', e);
    const fallback = (allPapers && allPapers.length ? allPapers : fallbackPapers).filter(p => {
      const haystack = [p.title, p.authors, p.venue, p.abstract, ...(p.keywords || [])].join(' ').toLowerCase();
      return haystack.includes(query.toLowerCase());
    }).map(normalizeFrontendPaper);
    papers = fallback;
    if (grid) grid.innerHTML = '';
    paperCount = 0;
    if (fallback.length) renderPapers(0, fallback.length);
    else renderEmptySearch(query);
    if (countEl) countEl.textContent = '本地降级结果 ' + fallback.length + ' 篇';
    renderAgentWorkflow('done', { query, count: fallback.length, workflow: { steps: [
      { agent: 'supervisor', action: '后端不可用，切换本地降级检索', status: 'done' },
      { agent: 'local-index', action: '在已加载论文中执行关键词匹配', status: 'done' }
    ] } });
    showToast('后端检索失败，已使用本地降级结果', 'warning');
  } finally {
    [mainBtn, semanticBtn].forEach(btn => { if (btn) btn.disabled = false; });
  }
}

function resetSearchResults(options={}) {
  const panel = document.getElementById('agentWorkflowPanel');
  const grid = document.getElementById('paperGrid');
  const loadWrap = document.querySelector('.load-more-wrap');
  papers = (allPapers && allPapers.length) ? allPapers.slice() : fallbackPapers.slice();
  currentSearchMeta = null;
  setDailyRecommendationsVisible(true);
  if (panel) panel.style.display = 'none';
  if (grid) grid.innerHTML = '';
  paperCount = 0;
  renderDailyRecs();
  renderPapers(0, 20);
  if (loadWrap) loadWrap.style.display = paperCount < papers.length ? '' : 'none';
  const countEl = document.getElementById('paperCountDisplay');
  if (countEl) countEl.textContent = '共 ' + papers.length + ' 篇';
  if (!options.silent) showToast('已返回每日推荐', 'info');
}

window.performPaperSearch = performPaperSearch;
window.resetSearchResults = resetSearchResults;

function initSearchBindings() {
  const input = document.getElementById('searchInput');
  const mainBtn = document.querySelector('.search-btn.main');
  const semanticBtn = document.querySelector('.search-btn.semantic');
  if (input && !input.dataset.searchBound) {
    input.dataset.searchBound = 'true';
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        performPaperSearch('keyword');
      }
    });
  }
  if (mainBtn && !mainBtn.dataset.searchBound) {
    mainBtn.dataset.searchBound = 'true';
    mainBtn.addEventListener('click', function(e) {
      e.preventDefault();
      performPaperSearch('keyword');
    });
  }
  if (semanticBtn && !semanticBtn.dataset.searchBound) {
    semanticBtn.dataset.searchBound = 'true';
    semanticBtn.addEventListener('click', function(e) {
      e.preventDefault();
      performPaperSearch('semantic');
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSearchBindings);
} else {
  initSearchBindings();
}

/**
 * 生成统一结构的论文卡片 HTML（全局组件复用）
 *
 * 信息层级（从上到下严格顺序）：
 * ① 顶部徽章行：CCF等级标签 + 会议名称 + 发表年份
 * ② 论文标题（加粗，最大字号）
 * ③ 作者信息
 * ④ 摘要：最多 2 行文字截断
 * ⑤ 底部分割线 + 底部操作栏：引用量 / Hot 标识 + 操作按钮
 *
 * @param {Object} p - 论文数据对象
 * @returns {string} 卡片 HTML 字符串
 */
function buildPaperCardHTML(p) {
  const ccfLevel = (p.ccf || 'A').toLowerCase();
  const ccfLabel = 'CCF-' + (p.ccf || 'A');
  const year = p.year || 'N/A';
  const venue = escapeHtml(p.venue || '');
  const heat = p.heat === 'Hot'
    ? '<span class="heat-tag hot">Hot</span>'
    : '<span class="heat-tag warm">Warm</span>';
  // 引用量：解析数字（如 98,700+ → 98,700）
  const citesRaw = p.citations || '0';
  const citesNum = parseInt(citesRaw.replace(/[,+]/g, '')) || 0;
  const citesDisplay = citesNum >= 1000 ? (citesNum / 1000).toFixed(1) + 'K' : citesNum;
  const abstract = escapeHtml((p.abstract || '').substring(0, 160));
  const keywords = (p.keywords || []).slice(0, 3).map(k => '<span class="paper-keyword">' + escapeHtml(k) + '</span>').join('');

  return '<div class="paper-card-top">'
    + '<span class="ccf-badge level-' + ccfLevel + '">' + ccfLabel + '</span>'
    + '<span class="paper-venue">' + venue + '</span>'
    + '<span class="paper-year">' + year + '</span>'
    + '</div>'
    + '<div class="paper-title" data-action="read" data-id="' + p.id + '">' + escapeHtml(p.title) + '</div>'
    + '<div class="paper-meta">' + escapeHtml(p.authors || '') + '</div>'
    + '<div class="paper-abstract">' + abstract + '</div>'
    + (keywords ? '<div class="paper-keywords">' + keywords + '</div>' : '')
    + '<div class="paper-footer">'
    + '<span class="paper-cites" title="引用量">' + citesDisplay + ' 引用</span>'
    + heat
    + '<span class="footer-sep"></span>'
    + '<button class="btn-action fav" data-action="fav" data-id="' + p.id + '" data-title="' + escapeHtml(p.title) + '" title="收藏">&#9825;</button>'
    + '<button class="btn-action" data-action="read" data-id="' + p.id + '">AI 阅读</button>'
    + '<button class="btn-action" data-action="similar" data-id="' + p.id + '">相似论文</button>'
    + '<button class="btn-action graph" data-action="graph" data-id="' + p.id + '" title="查看引用图谱">引用图谱</button>'
    + '</div>';
}

function initPaperActionBindings() {
  if (document.body.dataset.paperActionsBound) return;
  document.body.dataset.paperActionsBound = 'true';
  document.addEventListener('click', function(e) {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    const id = actionEl.dataset.id;
    if (!action || !id) return;
    e.preventDefault();
    e.stopPropagation();
    if (action === 'fav') toggleFavPopover(actionEl, id);
    if (action === 'read') openReading(id);
    if (action === 'similar') {
      openReading(id);
      setTimeout(() => { if (typeof switchReadingTab === 'function') switchReadingTab(null, 'similar'); }, 50);
    }
    if (action === 'citation') exportCitation(id, 'bibtex');
    if (action === 'graph') openGraphForPaper(id);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPaperActionBindings);
} else {
  initPaperActionBindings();
}

/**
 * 渲染论文卡片到页面网格中
 * @param {number} start - 起始索引
 * @param {number} count - 渲染数量
 */
function renderPapers(start, count) {
  const grid = document.getElementById('paperGrid');
  if (!grid) return;
  const end = Math.min(start + count, papers.length);
  for (let i = start; i < end; i++) {
    const p = papers[i];
    if (window.featuredPaperId && p.id === window.featuredPaperId) continue;
    const card = document.createElement('div');
    card.className = 'paper-card';
    card.style.animationDelay = ((i-start)*0.04)+'s';
    card.innerHTML = buildPaperCardHTML(p);
    grid.appendChild(card);
    paperCount++;
  }
  const loadWrap = document.querySelector('.load-more-wrap');
  if (loadWrap && paperCount >= papers.length) loadWrap.style.display = 'none';
}

/**
 * "加载更多"论文 —— 模拟网络延迟后追加渲染
 */
function loadMorePapers() {
  const btn = document.querySelector('.btn-load-more');
  if (!btn) return;
  if (btn.classList.contains('loading')) return;
  btn.classList.add('loading');
  var origText = btn.textContent;
  btn.textContent = '加载中...';
  setTimeout(() => {
    renderPapers(paperCount, 6);
    btn.classList.remove('loading');
    btn.textContent = origText;
    assignTrends();
  }, 800);
}

/**
 * 渲染"今日精选"大卡片 —— 取引用量最高的第一篇，横向突出展示
 */
function renderFeaturedPaper() {
  const el = $('featuredPaperCard');
  if (!el || !papers.length) return;
  const p = [...papers].sort((a,b) => parseInt(b.citations.replace(/[,+]/g,'')) - parseInt(a.citations.replace(/[,+]/g,'')))[0];
  window.featuredPaperId = p.id;
  const ccfLevel = (p.ccf || 'A').toLowerCase();
  const citesNum = parseInt((p.citations || '0').replace(/[,+]/g, '')) || 0;
  const citesDisplay = citesNum >= 1000 ? (citesNum / 1000).toFixed(1) + 'K' : citesNum;
  const keywords = (p.keywords || []).map(k => '<span class="featured-keyword">' + escapeHtml(k) + '</span>').join('');

  el.innerHTML = `
    <div class="featured-left" data-action="read" data-id="${p.id}">
      <div class="featured-badges">
        <span class="ccf-badge level-${ccfLevel}">CCF-${p.ccf || 'A'}</span>
        <span class="featured-venue">${escapeHtml(p.venue || '')}</span>
        <span class="heat-tag hot">Hot</span>
      </div>
      <h2 class="featured-title" data-action="read" data-id="${p.id}">${escapeHtml(p.title)}</h2>
      <div class="featured-authors">${escapeHtml(p.authors || '')}</div>
      <p class="featured-abstract">${escapeHtml(p.abstract || '')}</p>
      <div class="featured-keywords">${keywords}</div>
    </div>
    <div class="featured-right">
      <div class="featured-stats">
        <div class="featured-stat">
          <strong>${citesDisplay}</strong>
          <span>引用量</span>
        </div>
        <div class="featured-stat">
          <strong>${p.year || 'N/A'}</strong>
          <span>发表年份</span>
        </div>
      </div>
      <div class="featured-actions">
        <button class="featured-btn primary" data-action="read" data-id="${p.id}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          开始阅读
        </button>
        <button class="featured-btn" data-action="graph" data-id="${p.id}">引用图谱</button>
        <button class="featured-btn" data-action="fav" data-id="${p.id}" data-title="${escapeHtml(p.title)}">收藏</button>
      </div>
    </div>
  `;
}

/**
 * 渲染"每日推荐"论文区域（兼容旧调用，改为今日精选）
 */
function renderDailyRecs() {
  renderFeaturedPaper();
}

/**
 * 渲染过滤后的论文列表（用于迷你过滤器）
 */
function renderPapersFiltered(paperList, start, count) {
  const grid = $('paperGrid');
  if (!grid) return;
  const end = Math.min(start + count, paperList.length);
  for (let i = start; i < end; i++) {
    const p = paperList[i];
    if (window.featuredPaperId && p.id === window.featuredPaperId) continue;
    const card = document.createElement('div');
    card.className = 'paper-card';
    card.style.animationDelay = ((i-start)*0.04)+'s';
    card.innerHTML = buildPaperCardHTML(p);
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

// 论文卡片趋势指标
const trendValues = ['up','stable','down'];
/** 为论文卡片分配趋势指示器（基于论文数据） */
function assignTrends() {
  document.querySelectorAll('.paper-card').forEach(card => {
    const statsDiv = card.querySelector('.paper-stats');
    if (!statsDiv) return;
    if (card.querySelector('.trend-indicator')) return;
    // 从论文标题查找对应的论文数据，读取真实趋势
    const titleEl = card.querySelector('.paper-title');
    const title = titleEl ? titleEl.textContent : '';
    const paper = papers.find(p => p.title === title);
    const trend = paper?.trend || 'stable';
    const labels = { up:'📈 上升', stable:'➡️ 平稳', down:'📉 下降' };
    const span = document.createElement('span');
    span.className = 'trend-indicator ' + trend;
    span.textContent = labels[trend];
    statsDiv.appendChild(span);
  });
}
