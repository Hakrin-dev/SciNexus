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
  const abstract = escapeHtml((p.abstract || '').substring(0, 120));

  return '<div class="paper-card-top">'
    + '<span class="ccf-badge level-' + ccfLevel + '">' + ccfLabel + '</span>'
    + '<span class="paper-venue">' + venue + '</span>'
    + '<span class="paper-year">' + year + '</span>'
    + '</div>'
    + '<div class="paper-title" onclick="event.stopPropagation();openReading(\'' + p.id + '\')">' + escapeHtml(p.title) + '</div>'
    + '<div class="paper-meta">' + escapeHtml(p.authors || '') + '</div>'
    + '<div class="paper-abstract">' + abstract + '</div>'
    + '<div class="paper-footer">'
    + '<span class="paper-cites" title="引用量">' + citesDisplay + ' 引用</span>'
    + heat
    + '<span class="footer-sep"></span>'
    + '<button class="btn-action fav" data-id="' + p.id + '" data-title="' + escapeHtml(p.title) + '" onclick="event.stopPropagation();toggleFavPopover(this,\'' + p.id + '\')" title="收藏">&#9825;</button>'
    + '<button class="btn-action" onclick="event.stopPropagation();openReading(\'' + p.id + '\')">AI 阅读</button>'
    + '<button class="btn-action" onclick="event.stopPropagation();openReading(\'' + p.id + '\');switchReadingTab(null,\'similar\')">相似论文</button>'
    + '<button class="btn-action" onclick="event.stopPropagation();exportCitation(\'' + p.id + '\',\'bibtex\')" title="复制 BibTeX 引用">BibTeX</button>'
    + '<button class="btn-action graph" onclick="event.stopPropagation();openGraphForPaper(\'' + p.id + '\')" title="查看引用图谱">引用图谱</button>'
    + '</div>';
}

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
    card.innerHTML = buildPaperCardHTML(p);
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
 * 渲染"每日推荐"论文区域 —— 取引用量最高的 8 篇
 * 复用统一论文卡片结构（buildPaperCardHTML），与全部论文列表保持组件一致
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
    card.innerHTML = buildPaperCardHTML(p);
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
