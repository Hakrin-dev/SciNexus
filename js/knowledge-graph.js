/**
 * knowledge-graph.js — 文献知识图谱
 *
 * 职责：
 *   1. ECharts 力导向图渲染（接口数据 + 模拟数据降级）
 *   2. 三组件双向联动：左侧文献列表 ←→ 图谱节点 ←→ 右侧详情面板
 *   3. 工具栏：重置视图 / 全屏画布 / 导出PNG / 图例开关
 *   4. 深浅色模式适配、窗口 resize、资源完整释放
 *
 * 对外导出：initKnowledgeGraph(containerDomId, centerPaperId) / destroyKnowledgeGraph()
 * 全局回调钩子：window.__onGraphNodeClick(nodeData)
 */

// ============================================================
// 模块级状态
// ============================================================

var __graphInstance = null;
var __graphContainerId = null;
var __graphData = null;
var __graphFullData = null;
var __selectedNodeId = null;
var __graphResizeHandler = null;
var __graphDarkObserver = null;
var __graphFullscreen = false;
var __graphLegendVisible = false;
var __graphResizeTimer = null;
var __graphInitialOption = null;

// ============================================================
// 模拟数据（MARL 文献网络）
// ============================================================

function getMockGraphData(centerPaperId) {
  if (!centerPaperId) centerPaperId = 'lowe2017';

  var nodes = [
    { id: 'lowe2017',     name: 'Lowe_2017',    paperId: 'lowe2017',    citations: 4500, year: 2017, title: 'Multi-Agent Actor-Critic for Mixed Cooperative-Competitive Environments', authors: 'Lowe et al.', venue: 'NeurIPS 2017', abstract: '提出MADDPG算法，采用中心化训练、去中心化执行框架，解决多智能体非平稳问题。' },
    { id: 'peng2018',     name: 'Peng_2018',    paperId: 'peng2018',    citations: 1200, year: 2018, title: 'Multiagent Bidirectionally-Coordinated Nets', authors: 'Peng et al.', venue: 'NeurIPS 2018', abstract: '提出BiCNet，通过双向协调网络实现多智能体间高效通信与协作。' },
    { id: 'foerster2018', name: 'Foerster_2018',paperId: 'foerster2018',citations: 3200, year: 2016, title: 'Counterfactual Multi-Agent Policy Gradients (COMA)', authors: 'Foerster et al.', venue: 'AAAI 2018', abstract: '提出COMA算法，利用反事实基线解决多智能体信用分配问题。' },
    { id: 'zhang2017',    name: 'Zhang_2017',   paperId: 'zhang2017',   citations:  800, year: 2016, title: 'Fully Decentralized Multi-Agent RL with Networked Agents', authors: 'Zhang et al.', venue: 'ICML 2018', abstract: '研究网络化智能体的完全去中心化强化学习算法。' },
    { id: 'rashid2020',   name: 'Rashid_2020',  paperId: 'rashid2020',  citations: 2800, year: 2018, title: 'QMIX: Monotonic Value Function Factorisation for Deep MARL', authors: 'Rashid et al.', venue: 'ICML 2018', abstract: '提出QMIX，通过单调性约束实现联合动作值的可分解性。' },
    { id: 'sunehag2018',  name: 'Sunehag_2018', paperId: 'sunehag2018', citations: 2100, year: 2018, title: 'Value-Decomposition Networks (VDN)', authors: 'Sunehag et al.', venue: 'AAMAS 2018', abstract: '提出VDN，将联合值函数分解为各智能体独立值函数之和。' },
    { id: 'son2019',      name: 'Son_2019',     paperId: 'son2019',     citations: 1600, year: 2019, title: 'QTran: Learning to Factorise with Transformation', authors: 'Son et al.', venue: 'ICML 2019', abstract: '提出QTran，放宽QMIX的单调性约束，支持更丰富的分解方式。' },
    { id: 'yu2022',       name: 'Yu_2022',      paperId: 'yu2022',      citations:  600, year: 2022, title: 'Surprise Minimising Multi-Agent RL', authors: 'Yu et al.', venue: 'ICLR 2022', abstract: '基于惊喜最小化原理的多智能体强化学习方法。' },
    { id: 'wang2020',     name: 'Wang_2020',    paperId: 'wang2020',    citations:  950, year: 2022, title: 'RODE: Learning Roles to Decompose Multi-Agent Tasks', authors: 'Wang et al.', venue: 'ICLR 2022', abstract: '通过角色分解多智能体任务，提升学习效率和可解释性。' },
    { id: 'yang2023',     name: 'Yang_2023',    paperId: 'yang2023',    citations:  450, year: 2023, title: 'Multi-Agent Transformer for Cooperative MARL', authors: 'Yang et al.', venue: 'NeurIPS 2022', abstract: '将Transformer架构引入多智能体协作场景，实现序列化决策。' },
    { id: 'liu2021',      name: 'Liu_2021',     paperId: 'liu2021',     citations:  700, year: 2021, title: 'Hierarchical Multi-Agent RL with Graph Attention', authors: 'Liu et al.', venue: 'ICML 2021', abstract: '结合图注意力网络与层次化强化学习处理多智能体协作。' },
    { id: 'chen2022',     name: 'Chen_2022',    paperId: 'chen2022',    citations:  380, year: 2024, title: 'Efficient Multi-Agent Communication via Variational Inference', authors: 'Chen et al.', venue: 'ICLR 2024', abstract: '基于变分推断实现多智能体间高效通信策略学习。' },
  ];

  var links = [
    { source: 'lowe2017',     target: 'foerster2018',  relation: 'cited' },
    { source: 'lowe2017',     target: 'zhang2017',     relation: 'cited' },
    { source: 'peng2018',     target: 'lowe2017',      relation: 'cites' },
    { source: 'rashid2020',   target: 'lowe2017',      relation: 'cites' },
    { source: 'sunehag2018',  target: 'lowe2017',      relation: 'cites' },
    { source: 'son2019',      target: 'lowe2017',      relation: 'cites' },
    { source: 'yu2022',       target: 'lowe2017',      relation: 'cites' },
    { source: 'rashid2020',   target: 'sunehag2018',   relation: 'cites' },
    { source: 'son2019',      target: 'rashid2020',    relation: 'cites' },
    { source: 'son2019',      target: 'sunehag2018',   relation: 'cites' },
    { source: 'wang2020',     target: 'rashid2020',    relation: 'cites' },
    { source: 'yang2023',     target: 'rashid2020',    relation: 'cites' },
    { source: 'yang2023',     target: 'peng2018',      relation: 'cites' },
    { source: 'liu2021',      target: 'peng2018',      relation: 'cites' },
    { source: 'liu2021',      target: 'wang2020',      relation: 'cites' },
    { source: 'chen2022',     target: 'yu2022',        relation: 'cites' },
    { source: 'chen2022',     target: 'yang2023',      relation: 'cites' },
    { source: 'peng2018',     target: 'foerster2018',  relation: 'cited' },
    { source: 'yu2022',       target: 'son2019',       relation: 'cites' },
  ];

  var originPaper = nodes.find(function(n) { return n.id === centerPaperId; }) || nodes[0];
  var priorWorks = nodes.filter(function(n) {
    return links.some(function(l) { return l.source === centerPaperId && l.target === n.id && l.relation === 'cited'; });
  });
  var derivativeWorks = nodes.filter(function(n) {
    return links.some(function(l) { return l.source === n.id && l.target === centerPaperId && l.relation === 'cites'; });
  });

  return {
    nodes: nodes,
    links: links,
    centerId: centerPaperId,
    originPaper: originPaper,
    priorWorks: priorWorks,
    derivativeWorks: derivativeWorks,
  };
}

// ============================================================
// 颜色 / 大小映射
// ============================================================

/** 年份→颜色映射：浅色模式（暖色早年 → 冷色近年） */
function yearToColor(year) {
  var stops = [
    { y: 2025, c: '#1E40AF' }, { y: 2024, c: '#2563EB' }, { y: 2023, c: '#3B82F6' },
    { y: 2022, c: '#6366F1' }, { y: 2021, c: '#8B5CF6' }, { y: 2020, c: '#A855F7' },
    { y: 2019, c: '#D946EF' }, { y: 2018, c: '#EC4899' }, { y: 2017, c: '#F43F5E' },
    { y: 2016, c: '#EF4444' },
  ];
  for (var i = 0; i < stops.length; i++) if (year >= stops[i].y) return stops[i].c;
  return stops[stops.length - 1].c;
}

/** 年份→颜色映射：深色模式（暖色近年 → 冷色早年，更柔和） */
function yearToColorDark(year) {
  var stops = [
    { y: 2025, c: '#60A5FA' }, { y: 2024, c: '#818CF8' }, { y: 2023, c: '#A78BFA' },
    { y: 2022, c: '#C084FC' }, { y: 2021, c: '#E879F9' }, { y: 2020, c: '#F472B6' },
    { y: 2019, c: '#FB7185' }, { y: 2018, c: '#FCA5A5' }, { y: 2017, c: '#FDBA74' },
    { y: 2016, c: '#FDE047' },
  ];
  for (var i = 0; i < stops.length; i++) if (year >= stops[i].y) return stops[i].c;
  return stops[stops.length - 1].c;
}

/** 引用量→节点大小映射（20~60px） */
function citationsToSize(citations) {
  if (citations >= 4000) return 60;
  if (citations >= 3000) return 50;
  if (citations >= 2000) return 40;
  if (citations >= 1000) return 32;
  if (citations >= 500)  return 26;
  return 20;
}

// ============================================================
// ECharts 配置构建
// ============================================================

/**
 * 构建 ECharts graph option
 * @param {Object} data - 图谱数据 { nodes, links, centerId, ... }
 * @param {boolean} isDark - 是否深色模式
 */
function buildGraphOption(data, isDark) {
  var centerId = data.centerId;
  var isDarkMode = !!isDark;
  var textColor = isDarkMode ? '#94A3B8' : '#4E5969';
  var lineColorBase = isDarkMode ? 'rgba(148,163,184,0.22)' : 'rgba(30,41,89,0.16)';
  var bgColor     = isDarkMode ? '#0F1219' : '#F7F8FA';

  var selNode = __selectedNodeId;
  var selNeighbors = Object.create(null);
  if (selNode && data.links) {
    data.links.forEach(function(l) {
      if (l.source === selNode) selNeighbors[l.target] = true;
      if (l.target === selNode) selNeighbors[l.source] = true;
    });
  }

  var graphNodes = data.nodes.map(function(n) {
    var color = isDarkMode ? yearToColorDark(n.year) : yearToColor(n.year);
    var size  = citationsToSize(n.citations);
    var isCenter = n.id === centerId;
    var isSel    = n.id === selNode;
    var isNei    = !!selNeighbors[n.id];
    var isDim    = !!selNode && !isSel && !isNei;

    return {
      id: n.id,
      name: n.name,
      symbolSize: size,
      itemStyle: {
        color: color,
        borderColor: isCenter ? (isDarkMode ? '#FFD700' : '#FF6B35')
                   : isSel    ? '#165DFF'
                   : 'transparent',
        borderWidth: isCenter ? 3 : (isSel ? 2 : 0),
        shadowBlur:  isCenter ? 10 : (isSel ? 8 : 0),
        shadowColor: isCenter ? (isDarkMode ? 'rgba(255,215,0,0.55)' : 'rgba(255,107,53,0.45)')
                   : isSel    ? 'rgba(22,93,255,0.4)'
                   : 'transparent',
        opacity: isDim ? 0.28 : 1.0,
      },
      label: {
        show: true,
        fontSize: 11,
        color: isDim ? (isDarkMode ? 'rgba(148,163,184,0.4)' : 'rgba(78,89,105,0.4)') : textColor,
        fontFamily: "'Inter', 'Noto Sans SC', sans-serif",
        formatter: n.name,
        position: 'right',
        distance: 5,
      },
      paperId: n.paperId,
      citations: n.citations,
      year: n.year,
      title: n.title || n.name,
      authors: n.authors || '',
      venue: n.venue || '',
      abstract: n.abstract || '',
    };
  });

  var graphLinks = data.links.map(function(l) {
    var isRel = (selNode && (l.source === selNode || l.target === selNode));
    var isDim = !!selNode && !isRel;
    return {
      source: l.source,
      target: l.target,
      lineStyle: {
        color:   isRel ? (isDarkMode ? 'rgba(96,165,250,0.90)' : 'rgba(22,93,255,0.85)')
                 : isDim ? (isDarkMode ? 'rgba(148,163,184,0.10)' : 'rgba(30,41,89,0.08)')
                 : lineColorBase,
        width:   isRel ? 2.2 : (isDim ? 0.6 : 1.0),
        opacity: isRel ? 1.0 : (isDim ? 0.4 : 0.65),
        curveness: 0.1,
      },
    };
  });

  return {
    backgroundColor: bgColor,
    animationDuration: 500,
    animationEasingUpdate: 'quinticInOut',
    tooltip: {
      show: true,
      confine: true,
      enterable: true,
      hideDelay: 120,
      transitionDuration: 0.15,
      extraCssText: 'max-width:320px;box-shadow:0 6px 24px rgba(0,0,0,0.12);border-radius:8px;',
      backgroundColor: isDarkMode ? 'rgba(17,24,39,0.96)' : 'rgba(255,255,255,0.98)',
      borderColor: isDarkMode ? 'rgba(148,163,184,0.30)' : 'rgba(229,231,235,0.9)',
      borderWidth: 1,
      textStyle: { color: isDarkMode ? '#E5E7EB' : '#1F2937', fontSize: 12, fontFamily: "'Inter','Noto Sans SC',sans-serif", lineHeight: 1.6 },
      formatter: function(params) {
        if (params.dataType !== 'node') return '';
        var d = params.data;
        var titleTxt = d.title || d.name || '';
        var sizeDesc  = d.symbolSize >= 50 ? '引用量极高'
                      : d.symbolSize >= 36 ? '引用量较高'
                      : d.symbolSize >= 26 ? '引用量中等'
                      : '引用量一般';
        return '<div style="max-width:300px;word-break:break-word;">'
          + '<div style="font-weight:600;font-size:13px;margin-bottom:6px;line-height:1.45;">' + titleTxt + '</div>'
          + '<div style="font-size:12px;color:' + (isDarkMode ? '#94A3B8' : '#6B7280') + ';margin-bottom:4px;">'
          +   (d.authors || 'Unknown author') + ' · ' + (d.venue || 'N/A')
          + '</div>'
          + '<div style="display:flex;gap:14px;font-size:12px;margin-bottom:6px;">'
          +   '<span>年份：<b style="color:' + (isDarkMode ? '#FDE047' : '#F59E0B') + ';">' + (d.year || 'N/A') + '</b></span>'
          +   '<span>引用：<b>' + (d.citations || 0) + '</b></span>'
          +   '<span style="color:' + (isDarkMode ? '#94A3B8' : '#86909C') + ';">' + sizeDesc + '</span>'
          + '</div>'
          + (d.abstract ? '<div style="font-size:12px;color:' + (isDarkMode ? '#CBD5E1' : '#4B5563') + ';line-height:1.55;padding-top:6px;border-top:1px dashed ' + (isDarkMode ? 'rgba(148,163,184,0.25)' : 'rgba(229,231,235,0.9)') + ';">' + d.abstract + '</div>' : '')
          + '</div>';
      },
    },
    series: [{
      type: 'graph',
      layout: 'force',
      roam: true,
      draggable: true,
      force: {
        repulsion: 720,
        edgeLength: [90, 140],
        gravity: 0.06,
        friction: 0.65,
        layoutAnimation: false,
      },
      zoom: 1.0,
      scaleLimit: { min: 0.35, max: 2.8 },
      emphasis: {
        focus: 'adjacency',
        lineStyle: { width: 2.6, opacity: 1.0 },
        itemStyle: { shadowBlur: 14, shadowColor: 'rgba(22,93,255,0.45)' },
        label: { fontSize: 13, fontWeight: 600 },
      },
      label: {
        show: true,
        fontSize: 11,
        fontFamily: "'Inter', 'Noto Sans SC', sans-serif",
      },
      lineStyle: { width: 1.0, opacity: 0.65, curveness: 0.1 },
      edgeSymbol: ['none', 'none'],
      data: graphNodes,
      links: graphLinks,
    }],
  };
}

// ============================================================
// 左侧文献列表面板
// ============================================================

/** 渲染单条论文条目（左侧列表） */
function __renderPaperItem(paper, isOrigin) {
  var item = document.createElement('div');
  item.className = 'graph-paper-item';
  item.dataset.nodeId = paper.id;
  item.innerHTML =
    '<div class="graph-paper-item-title" title="' + (paper.title || paper.name || '') + '">' + (paper.title || paper.name || '') + '</div>'
    + '<div class="graph-paper-item-meta">'
    +   '<span>' + (paper.authors || 'Unknown') + '</span>'
    +   '<span>· ' + (paper.year || '') + '</span>'
    +   '<span>· 引用 ' + (paper.citations || 0) + '</span>'
    + '</div>';
  if (isOrigin) item.classList.add('origin');
  item.addEventListener('click', function() { __selectNode(paper.id, 'list'); });
  return item;
}

/** 渲染左侧三组列表 */
function renderLeftPanel(data) {
  var originList = document.getElementById('graphOriginList');
  var priorList  = document.getElementById('graphPriorList');
  var derivList  = document.getElementById('graphDerivList');
  if (!originList && !priorList && !derivList) return;

  if (originList) {
    originList.innerHTML = '';
    if (data.originPaper) originList.appendChild(__renderPaperItem(data.originPaper, true));
  }
  if (priorList) {
    priorList.innerHTML = '';
    var pw = data.priorWorks || [];
    if (pw.length === 0) { priorList.innerHTML = '<div class="graph-paper-empty">暂无数据</div>'; }
    else pw.forEach(function(p) { priorList.appendChild(__renderPaperItem(p, false)); });
  }
  if (derivList) {
    derivList.innerHTML = '';
    var dw = data.derivativeWorks || [];
    if (dw.length === 0) { derivList.innerHTML = '<div class="graph-paper-empty">暂无数据</div>'; }
    else dw.forEach(function(p) { derivList.appendChild(__renderPaperItem(p, false)); });
  }
}

// ============================================================
// 右侧详情面板
// ============================================================

/** 打开图谱节点的论文详情：真实 id 直接打开；模拟演示 id 用标题搜索后端，未收录则提示。 */
function __openGraphNode(nodeData) {
  var pid = (nodeData && (nodeData.paperId || nodeData.id)) || '';
  if (/^W\d+$/.test(pid) || /^p\d+$/.test(pid)) {
    if (typeof openReading === 'function') openReading(pid);
    return;
  }
  var query = (nodeData && (nodeData.title || nodeData.name || '')).trim();
  if (!query) {
    if (typeof showToast === 'function') showToast('该节点暂无论文详情', 'warning');
    return;
  }
  apiFetch('/search', { method: 'POST', body: { query: query, mode: 'keyword', task_type: 'paper_search' } })
    .then(function(res) {
      if (res && res.data && res.data.length) {
        if (typeof openReading === 'function') openReading(res.data[0].id);
      } else if (typeof showToast === 'function') {
        showToast('图谱节点「' + query.slice(0, 18) + '」为演示数据，详情暂未收录', 'warning');
      }
    });
}

function renderRightPanel(nodeData) {
  var card = document.getElementById('graphDetailCard');
  if (!card) return;
  if (!nodeData) {
    card.innerHTML = '<p class="graph-detail-placeholder">点击节点查看论文详情</p>';
    return;
  }

  var isFav = (typeof getFavorites === 'function') && getFavorites().includes(nodeData.paperId || nodeData.id);
  var favLabel = isFav ? '已收藏' : '加入文献库';

  card.innerHTML =
    '<div class="graph-detail-title" title="' + (nodeData.title || nodeData.name || '') + '">' + (nodeData.title || nodeData.name || '未命名') + '</div>'
    + '<div class="graph-detail-meta">'
    +   '<div class="graph-detail-row"><span class="label">作者</span><span class="value">' + (nodeData.authors || '未知') + '</span></div>'
    +   '<div class="graph-detail-row"><span class="label">会议</span><span class="value">' + (nodeData.venue || '未知') + '</span></div>'
    +   '<div class="graph-detail-row"><span class="label">年份</span><span class="value">' + (nodeData.year || 'N/A') + '</span></div>'
    +   '<div class="graph-detail-row"><span class="label">引用</span><span class="value">' + (nodeData.citations || 0) + '</span></div>'
    + '</div>'
    + '<div class="graph-detail-section">'
    +   '<div class="graph-detail-section-title">摘要</div>'
    +   '<div class="graph-detail-abstract">' + (nodeData.abstract || '暂无摘要') + '</div>'
    + '</div>'
    + '<div class="graph-detail-actions">'
    +   '<button class="btn-graph-action primary" data-action="read">打开论文</button>'
    +   '<button class="btn-graph-action" data-action="fav">' + favLabel + '</button>'
    +   '<button class="btn-graph-action" data-action="bibtex">导出BibTeX</button>'
    + '</div>';

  var pid = nodeData.paperId || nodeData.id;
  var r  = card.querySelector('[data-action="read"]'); if (r) r.addEventListener('click', function() { __openGraphNode(nodeData); });
  var f  = card.querySelector('[data-action="fav"]');  if (f) f.addEventListener('click', function() {
    if (typeof toggleFavPopover === 'function') { toggleFavPopover(this, pid); this.textContent = '已收藏'; }
  });
  var b  = card.querySelector('[data-action="bibtex"]'); if (b) b.addEventListener('click', function() {
    if (typeof exportCitation === 'function') exportCitation(pid, 'bibtex');
    else if (typeof showToast === 'function') showToast('导出功能加载中...', 'info');
  });
}

// ============================================================
// 节点选中：统一入口（三栏联动）
// ============================================================

/**
 * 选中某个节点
 * @param {string} nodeId 节点ID
 * @param {string|null} source 触发来源 'graph' | 'list' | null
 */
function __selectNode(nodeId, source) {
  __selectedNodeId = nodeId;

  // 1. 图谱高亮
  if (__graphInstance && !__graphInstance.isDisposed() && __graphData) {
    var isDark = document.documentElement.classList.contains('dark');
    __graphInstance.setOption(buildGraphOption(__graphData, isDark));

    if (source === 'list') {
      var idx = __graphData.nodes.findIndex(function(n) { return n.id === nodeId; });
      if (idx >= 0) {
        __graphInstance.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: idx });
        __graphInstance.dispatchAction({ type: 'showTip',   seriesIndex: 0, dataIndex: idx });
        setTimeout(function() {
          if (__graphInstance && !__graphInstance.isDisposed()) {
            __graphInstance.dispatchAction({ type: 'downplay',  seriesIndex: 0, dataIndex: idx });
            __graphInstance.dispatchAction({ type: 'hideTip',   seriesIndex: 0 });
          }
        }, 1800);
      }
    }
  }

  // 2. 左侧列表高亮
  __highlightListItem(nodeId);

  // 3. 右侧详情面板
  var nodeData = __graphData ? __graphData.nodes.find(function(n) { return n.id === nodeId; }) : null;
  renderRightPanel(nodeData);

  // 4. 全局钩子
  if (nodeData && typeof window.__onGraphNodeClick === 'function') {
    try { window.__onGraphNodeClick(nodeData); } catch (_) {}
  }
}

/** 高亮左侧列表条目并滚动到可视区 */
function __highlightListItem(nodeId) {
  document.querySelectorAll('.graph-paper-item').forEach(function(el) {
    el.classList.toggle('selected', el.dataset.nodeId === nodeId);
  });
  var sel = document.querySelector('.graph-paper-item.selected');
  if (sel) sel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ============================================================
// Loading / 空数据 / 截断提示  覆盖层
// ============================================================

function __showGraphLoading(container) {
  if (!container) return;
  var loading = document.createElement('div');
  loading.className = 'graph-loading-overlay';
  loading.id = 'graphLoadingOverlay';
  loading.innerHTML = '<div class="graph-loading-spinner"></div><div class="graph-loading-text">加载知识图谱数据...</div>';
  container.appendChild(loading);
}

function __hideGraphLoading() {
  var el = document.getElementById('graphLoadingOverlay'); if (el) el.remove();
}

function __showGraphEmpty(container) {
  if (!container) return;
  __hideGraphEmpty();
  var empty = document.createElement('div');
  empty.className = 'graph-empty-overlay';
  empty.id = 'graphEmptyOverlay';
  empty.innerHTML =
    '<div class="graph-empty-icon">&#128193;</div>'
    + '<div class="graph-empty-text">暂无关联文献数据</div>'
    + '<div class="graph-empty-subtext">该论文可能尚未建立引用关系网络</div>';
  container.appendChild(empty);
}

function __hideGraphEmpty() {
  var el = document.getElementById('graphEmptyOverlay'); if (el) el.remove();
}

function __showGraphTruncatedTip(container, totalCount, shownCount) {
  if (!container) return;
  __hideGraphTruncatedTip();
  var tip = document.createElement('div');
  tip.className = 'graph-truncated-tip';
  tip.id = 'graphTruncatedTip';
  tip.innerHTML =
    '<span class="graph-truncated-text">已展示 ' + shownCount + ' / ' + totalCount + ' 个节点</span>'
    + '<button class="graph-truncated-btn" id="graphLoadMoreBtn">加载更多关联文献</button>';
  container.appendChild(tip);
  var btn = document.getElementById('graphLoadMoreBtn');
  if (btn) btn.addEventListener('click', __loadFullGraph);
}

function __hideGraphTruncatedTip() {
  var el = document.getElementById('graphTruncatedTip'); if (el) el.remove();
}

function __loadFullGraph() {
  if (!__graphFullData) return;
  __graphData = __graphFullData;
  __graphFullData = null;
  __hideGraphTruncatedTip();
  renderLeftPanel(__graphData);
  if (__graphInstance && !__graphInstance.isDisposed()) {
    var isDark = document.documentElement.classList.contains('dark');
    __graphInstance.setOption(buildGraphOption(__graphData, isDark), true);
    __graphInitialOption = null;
    if (__selectedNodeId) __selectNode(__selectedNodeId, null);
  }
}

// ============================================================
// 工具栏：重置视图 / 全屏 / 导出图片 / 图例开关
// ============================================================

/** 初始化悬浮工具栏（渲染在 graph-canvas-wrap 内部右上角） */
function __initGraphToolbar() {
  var wrap = document.getElementById('graphCanvasWrap');
  if (!wrap) return;
  __destroyGraphToolbar();

  var toolbar = document.createElement('div');
  toolbar.className = 'graph-toolbar';
  toolbar.id = 'graphToolbar';
  toolbar.innerHTML =
    '<button class="graph-toolbar-btn" data-tb="reset"  title="重置视图">&#x21BB;</button>'
    + '<button class="graph-toolbar-btn" data-tb="full"  title="全屏画布">&#x26F6;</button>'
    + '<button class="graph-toolbar-btn" data-tb="export" title="导出图片">&#x2913;</button>'
    + '<button class="graph-toolbar-btn" data-tb="legend" title="图例说明">&#x24D8;</button>';
  wrap.appendChild(toolbar);

  toolbar.addEventListener('click', function(e) {
    var btn = e.target.closest('.graph-toolbar-btn');
    if (!btn) return;
    var act = btn.dataset.tb;
    if (act === 'reset')  __graphResetView();
    if (act === 'full')   __graphToggleFullscreen();
    if (act === 'export') __graphExportPNG();
    if (act === 'legend') __graphToggleLegend();
  });
}

function __destroyGraphToolbar() {
  var el = document.getElementById('graphToolbar'); if (el) el.remove();
  __destroyGraphLegend();
  if (__graphFullscreen) { try { if (document.exitFullscreen) document.exitFullscreen(); } catch (_) {} __graphFullscreen = false; }
}

/** 重置视图（回到初始 zoom + 中心） */
function __graphResetView() {
  if (!__graphInstance || __graphInstance.isDisposed()) return;
  if (__graphInitialOption) {
    __graphInstance.setOption(__graphInitialOption, true);
  } else {
    var isDark = document.documentElement.classList.contains('dark');
    var opt = buildGraphOption(__graphData, isDark);
    opt.series[0].zoom = 1.0;
    __graphInstance.setOption(opt, true);
  }
  if (__selectedNodeId) __selectNode(__selectedNodeId, null);
}

/** 全屏切换 */
function __graphToggleFullscreen() {
  var wrap = document.getElementById('graphCanvasWrap');
  if (!wrap) return;
  if (!document.fullscreenElement) {
    if (wrap.requestFullscreen) {
      wrap.requestFullscreen().then(function() {
        __graphFullscreen = true;
        if (__graphResizeTimer) clearTimeout(__graphResizeTimer);
        __graphResizeTimer = setTimeout(function() {
          if (__graphInstance && !__graphInstance.isDisposed()) __graphInstance.resize();
        }, 180);
      }).catch(function() {});
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().then(function() {
        __graphFullscreen = false;
        if (__graphResizeTimer) clearTimeout(__graphResizeTimer);
        __graphResizeTimer = setTimeout(function() {
          if (__graphInstance && !__graphInstance.isDisposed()) __graphInstance.resize();
        }, 180);
      }).catch(function() {});
    }
  }
}

/** 导出为 PNG */
function __graphExportPNG() {
  if (!__graphInstance || __graphInstance.isDisposed()) return;
  var url = __graphInstance.getDataURL({
    type: 'png', pixelRatio: 2, backgroundColor: document.documentElement.classList.contains('dark') ? '#0F1219' : '#F7F8FA',
  });
  var a = document.createElement('a');
  var ts = new Date();
  var pad = function(n) { return (n < 10 ? '0' : '') + n; };
  var fname = '研枢_文献图谱_' + ts.getFullYear() + pad(ts.getMonth()+1) + pad(ts.getDate())
            + '_' + pad(ts.getHours()) + pad(ts.getMinutes()) + pad(ts.getSeconds()) + '.png';
  a.href = url; a.download = fname;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  if (typeof showToast === 'function') showToast('图谱已导出为PNG', 'success');
}

/** 图例开关 */
function __graphToggleLegend() {
  __graphLegendVisible = !__graphLegendVisible;
  var legend = document.getElementById('graphLegendPanel');
  if (__graphLegendVisible) {
    if (!legend) __renderGraphLegend();
    else legend.style.display = 'block';
  } else {
    if (legend) legend.style.display = 'none';
  }
}

/** 渲染图例面板 */
function __renderGraphLegend() {
  var wrap = document.getElementById('graphCanvasWrap');
  if (!wrap) return;
  __destroyGraphLegend();
  var panel = document.createElement('div');
  panel.className = 'graph-legend-panel';
  panel.id = 'graphLegendPanel';

  var isDark = document.documentElement.classList.contains('dark');
  var sizeItems = [
    { label: '≥4000 引用', r: 30, desc: '极高' },
    { label: '2000~4000',  r: 20, desc: '较高' },
    { label: '1000~2000',  r: 16, desc: '中等' },
    { label: '<1000 引用', r: 10, desc: '一般' },
  ];
  var yearItems = [
    { label: '2025', y: 2025 },
    { label: '2023', y: 2023 },
    { label: '2021', y: 2021 },
    { label: '2019', y: 2019 },
    { label: '2017', y: 2017 },
    { label: '≤2016', y: 2016 },
  ];

  var sizeHtml = sizeItems.map(function(s) {
    var c = isDark ? '#3B82F6' : '#165DFF';
    return '<div class="graph-legend-row">'
      + '<span class="graph-legend-dot" style="width:' + s.r + 'px;height:' + s.r + 'px;background:' + c + ';border-radius:50%;"></span>'
      + '<span class="graph-legend-text">' + s.label + '</span>'
      + '<span class="graph-legend-sub">(' + s.desc + ')</span>'
      + '</div>';
  }).join('');

  var yearHtml = yearItems.map(function(y) {
    var c = isDark ? yearToColorDark(y.y) : yearToColor(y.y);
    return '<div class="graph-legend-row">'
      + '<span class="graph-legend-year-bar" style="background:' + c + ';"></span>'
      + '<span class="graph-legend-text">' + y.label + '</span>'
      + '</div>';
  }).join('');

  panel.innerHTML =
    '<div class="graph-legend-header">'
    +   '<span class="graph-legend-title">图例说明</span>'
    +   '<button class="graph-legend-close" id="graphLegendClose" title="关闭">&#x2715;</button>'
    + '</div>'
    + '<div class="graph-legend-section">'
    +   '<div class="graph-legend-section-title">节点大小 · 引用量</div>'
    +   sizeHtml
    + '</div>'
    + '<div class="graph-legend-section">'
    +   '<div class="graph-legend-section-title">节点颜色 · 发表年份</div>'
    +   '<div class="graph-legend-note">' + (isDark ? '暖色：近年 → 冷色：早年' : '冷色：近年 → 暖色：早年') + '</div>'
    +   yearHtml
    + '</div>';
  wrap.appendChild(panel);
  var close = document.getElementById('graphLegendClose');
  if (close) close.addEventListener('click', function() { __graphLegendVisible = false; __destroyGraphLegend(); });
}

function __destroyGraphLegend() {
  var el = document.getElementById('graphLegendPanel'); if (el) el.remove();
}

// ============================================================
// 核心初始化函数
// ============================================================

/**
 * 初始化文献知识图谱
 * @param {string} containerDomId - 中间画布容器 DOM ID
 * @param {string} [centerPaperId] - 中心论文 ID（可选）
 */
async function initKnowledgeGraph(containerDomId, centerPaperId) {
  if (!containerDomId) return;
  __graphContainerId = containerDomId;

  // 销毁旧实例（含旧工具栏、监听器）
  destroyKnowledgeGraph();

  var containerDom = document.getElementById(containerDomId);
  if (!containerDom) return;

  __showGraphLoading(containerDom);

  var effectiveCenterId = centerPaperId || 'lowe2017';

  // 接口请求 + 失败降级
  var apiData = null;
  try {
    if (typeof fetchPaperGraph === 'function') {
      apiData = await fetchPaperGraph(effectiveCenterId);
    }
  } catch (_) {}
  __hideGraphLoading();

  if (apiData && apiData.nodes && apiData.nodes.length > 0) {
    __graphData = {
      nodes: apiData.nodes,
      links: apiData.links || [],
      centerId: effectiveCenterId,
      originPaper: apiData.originPaper || apiData.nodes.find(function(n) { return n.id === effectiveCenterId; }),
      priorWorks: apiData.priorWorks || [],
      derivativeWorks: apiData.derivativeWorks || [],
    };
  } else {
    __graphData = getMockGraphData(effectiveCenterId);
  }

  // 空数据兜底
  if (!__graphData.nodes || __graphData.nodes.length === 0) {
    __showGraphEmpty(containerDom);
    renderLeftPanel(__graphData);
    __initGraphToolbar();
    return;
  }

  // 节点阈值限流（60 上限）
  var MAX_NODES = 60;
  __graphFullData = null;
  if (__graphData.nodes.length > MAX_NODES) {
    __graphFullData = __graphData;
    var truncatedNodes = __graphFullData.nodes.slice(0, MAX_NODES);
    var truncatedIds  = Object.create(null);
    truncatedNodes.forEach(function(n) { truncatedIds[n.id] = true; });
    __graphData = {
      nodes: truncatedNodes,
      links: __graphFullData.links.filter(function(l) { return truncatedIds[l.source] && truncatedIds[l.target]; }),
      centerId: __graphFullData.centerId,
      originPaper: __graphFullData.originPaper,
      priorWorks: (__graphFullData.priorWorks || []).filter(function(p) { return truncatedIds[p.id]; }),
      derivativeWorks: (__graphFullData.derivativeWorks || []).filter(function(p) { return truncatedIds[p.id]; }),
    };
  }

  renderLeftPanel(__graphData);
  if (__graphFullData) {
    var wrap = document.getElementById('graphCanvasWrap');
    if (wrap) __showGraphTruncatedTip(wrap, __graphFullData.nodes.length, MAX_NODES);
  }

  // 初始化 ECharts + 事件
  __graphInstance = echarts.init(containerDom);

  __graphInstance.on('click', function(params) {
    if (params.dataType === 'node') __selectNode(params.data.id, 'graph');
  });

  var isDark0 = document.documentElement.classList.contains('dark');
  var opt0 = buildGraphOption(__graphData, isDark0);
  __graphInitialOption = JSON.parse(JSON.stringify(opt0));
  __graphInstance.setOption(opt0);

  // 默认选中中心节点
  __selectNode(__graphData.centerId, null);

  // 工具栏
  __initGraphToolbar();

  // Resize（防抖）
  __graphResizeHandler = function() {
    if (__graphResizeTimer) clearTimeout(__graphResizeTimer);
    __graphResizeTimer = setTimeout(function() {
      if (__graphInstance && !__graphInstance.isDisposed()) __graphInstance.resize();
    }, 120);
  };
  window.addEventListener('resize', __graphResizeHandler, { passive: true });

  // 全屏状态变更
  document.addEventListener('fullscreenchange', __graphResizeHandler);

  // 深色模式 MutationObserver
  __graphDarkObserver = new MutationObserver(function(mutations) {
    for (var i = 0; i < mutations.length; i++) {
      if (mutations[i].attributeName === 'class') {
        var isDarkNow = document.documentElement.classList.contains('dark');
        if (__graphInstance && !__graphInstance.isDisposed() && __graphData) {
          __graphInstance.setOption(buildGraphOption(__graphData, isDarkNow), true);
        }
        __destroyGraphLegend();
        if (__graphLegendVisible) __renderGraphLegend();
        break;
      }
    }
  });
  __graphDarkObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
}

// ============================================================
// 资源完整释放（杜绝内存泄漏）
// ============================================================

function destroyKnowledgeGraph() {
  // 定时器
  if (__graphResizeTimer) { clearTimeout(__graphResizeTimer); __graphResizeTimer = null; }

  // 工具栏 / 图例
  __destroyGraphToolbar();

  // Resize 监听
  if (__graphResizeHandler) {
    window.removeEventListener('resize', __graphResizeHandler);
    try { document.removeEventListener('fullscreenchange', __graphResizeHandler); } catch (_) {}
    __graphResizeHandler = null;
  }

  // 深色模式监听
  if (__graphDarkObserver) {
    try { __graphDarkObserver.disconnect(); } catch (_) {}
    __graphDarkObserver = null;
  }

  // ECharts 实例
  if (__graphInstance) {
    try {
      __graphInstance.off('click');
      if (!__graphInstance.isDisposed()) __graphInstance.dispose();
    } catch (_) {}
    __graphInstance = null;
  }

  // 覆盖层
  __hideGraphLoading();
  __hideGraphEmpty();
  __hideGraphTruncatedTip();

  // 三栏内容
  ['graphOriginList', 'graphPriorList', 'graphDerivList'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
  var card = document.getElementById('graphDetailCard');
  if (card) card.innerHTML = '<p class="graph-detail-placeholder">点击节点查看论文详情</p>';

  // 全屏状态清理
  if (__graphFullscreen) {
    try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen(); } catch (_) {}
    __graphFullscreen = false;
  }

  // 状态复位
  __graphContainerId  = null;
  __graphData         = null;
  __graphFullData     = null;
  __selectedNodeId    = null;
  __graphLegendVisible = false;
  __graphInitialOption = null;
}
