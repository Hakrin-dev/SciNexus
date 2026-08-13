/**
 * reading-enhanced.js — 论文阅读页面增强功能（v1.0）
 *
 * 职责：三栏面板切换、大纲生成、全文搜索、文本选中浮动菜单、
 *       高亮/笔记/书签系统、增强 AI 面板渲染、相似论文与引用图谱、
 *       增强公式弹窗、缩放与阅读模式、键盘快捷键、阅读统计、笔记导出
 *
 * 依赖：reading.js（不重复定义已有函数，仅扩展）
 *       api.js（deepseekChat）、utils.js（escapeHtml、showToast）、markdown.js（renderMdInline）
 */

// ============================================================
// 全局状态变量
// ============================================================

// 当前论文数据
var currentPaper = null;
var currentPaperId = null;

// 高亮 / 笔记 / 书签 / QA 历史
var readingHighlights = [];
var readingNotes = [];
var readingBookmarks = [];
var readingQaHistory = [];

// 当前高亮颜色
var currentHighlightColor = '#FFF3B0';

// 缩放级别
var readingZoomLevel = 1.0;

// 阅读计时器
var readingTimerSeconds = 0;
var readingTimerInterval = null;

// 笔记编辑状态：{ highlightId, noteId }
var currentEditingNote = null;

// 相似论文数据
var similarPapersData = [];
var similarPapersFiltered = [];
var similarCurrentView = 'list';

// 当前打开的公式名（供 copyFormulaLatex 使用）
var currentFormulaName = null;

// ============================================================
// 工具函数
// ============================================================

/** 安全读取 localStorage（JSON 解析，失败返回默认值） */
function lsGet(key, def) {
  try {
    var v = localStorage.getItem(key);
    return v ? JSON.parse(v) : def;
  } catch (e) {
    return def;
  }
}

/** 安全写入 localStorage */
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* 忽略跨域错误 */ }
}

/** 获取当前选中文本 */
function getSelectedText() {
  var sel = window.getSelection();
  return sel && sel.toString().trim();
}

/** escapeHtml 安全包装（兼容 utils.js 未加载的情况） */
function escapeHtmlSafe(text) {
  if (typeof escapeHtml === 'function') return escapeHtml(text);
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** showToast 安全包装 */
function showToastSafe(msg, type) {
  if (typeof showToast === 'function') showToast(msg, type);
  else if (typeof console !== 'undefined') console.log('[' + (type || 'info') + '] ' + msg);
}

/** 生成唯一 ID */
function genId(prefix) {
  return (prefix || 'id') + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
}

/** 降级复制到剪贴板 */
function fallbackCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) { /* 忽略 */ }
  document.body.removeChild(ta);
}

/** 解析引用量字符串为数字 */
function parseCitations(c) {
  if (!c) return 0;
  var n = parseInt(String(c).replace(/[^0-9]/g, ''));
  return isNaN(n) ? 0 : n;
}

// ============================================================
// 增强公式数据库（含逐步解读、变量、物理意义、相关公式、LaTeX）
// ============================================================

var formulaDatabase = {
  attention: {
    latex: 'Attention(Q,K,V) = softmax\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V',
    stepByStep: [
      '1. 计算 Q 与 K^T 的点积，得到查询与所有键的相似度矩阵 QK^T。',
      '2. 除以缩放因子 √d_k，防止点积值过大导致 softmax 进入饱和区。',
      '3. 对缩放后的分数沿最后一维做 softmax，归一化为注意力权重（和为 1）。',
      '4. 将注意力权重矩阵与 V 相乘，得到加权求和的输出。'
    ],
    variables: [
      { name: 'Q', desc: '查询矩阵，维度 n × d_k，代表当前位置的查询向量' },
      { name: 'K', desc: '键矩阵，维度 m × d_k，代表所有位置的键向量' },
      { name: 'V', desc: '值矩阵，维度 m × d_v，代表所有位置的值向量' },
      { name: 'd_k', desc: '键向量的维度，用作缩放因子防止梯度消失' },
      { name: 'softmax', desc: '归一化指数函数，将分数转为概率分布' }
    ],
    meaning: '注意力机制的本质是"查询-键值对"的软寻址过程。Q 中的每个查询通过点积计算与所有键 K 的相关性，softmax 将相关性转化为概率分布，最终按概率加权聚合值 V。这种机制使模型能够自适应地关注输入序列中最相关的部分。',
    related: [
      { name: 'multihead', desc: '多头注意力，将多个 attention 头并行计算后拼接' },
      { name: 'head', desc: '单头注意力，先做线性投影再执行 attention' }
    ]
  },
  multihead: {
    latex: 'MultiHead(Q,K,V) = Concat(head_1, \\ldots, head_h) W^O',
    stepByStep: [
      '1. 将 Q、K、V 分别投影到 h 个不同的子空间，得到 h 组 (Q_i, K_i, V_i)。',
      '2. 对每个头独立执行缩放点积注意力，得到 h 个输出 head_i。',
      '3. 将所有头的输出在特征维度上拼接（Concat）。',
      '4. 通过输出权重矩阵 W^O 进行线性变换，得到最终的多头注意力输出。'
    ],
    variables: [
      { name: 'head_i', desc: '第 i 个注意力头的输出' },
      { name: 'h', desc: '注意力头的数量（原论文中 h=8）' },
      { name: 'W^O', desc: '输出的线性变换权重矩阵，维度 h·d_v × d_model' },
      { name: 'Concat', desc: '将多个头的结果沿特征维度拼接' }
    ],
    meaning: '多头注意力的核心思想是让模型从多个角度同时关注输入序列。每个头可以学习到不同的注意力模式（如语法关系、语义关联、位置邻近等），拼接后通过线性变换融合这些多视角信息，从而获得更丰富的特征表示。',
    related: [
      { name: 'attention', desc: '缩放点积注意力，多头注意力的基础计算单元' },
      { name: 'head', desc: '单头注意力计算公式' }
    ]
  },
  head: {
    latex: 'head_i = Attention(QW_i^Q, KW_i^K, VW_i^V)',
    stepByStep: [
      '1. 对 Q 乘以投影矩阵 W_i^Q，得到第 i 个头的查询表示。',
      '2. 对 K 乘以投影矩阵 W_i^K，得到第 i 个头的键表示。',
      '3. 对 V 乘以投影矩阵 W_i^V，得到第 i 个头的值表示。',
      '4. 将投影后的 Q、K、V 代入缩放点积注意力公式计算输出。'
    ],
    variables: [
      { name: 'W_i^Q', desc: '第 i 个头的查询投影矩阵，维度 d_model × d_k' },
      { name: 'W_i^K', desc: '第 i 个头的键投影矩阵，维度 d_model × d_k' },
      { name: 'W_i^V', desc: '第 i 个头的值投影矩阵，维度 d_model × d_v' },
      { name: 'Q, K, V', desc: '原始的查询、键、值矩阵' }
    ],
    meaning: '线性投影的作用是将输入映射到不同的子空间。每个头通过独立的投影矩阵学习不同的特征变换，使得多头注意力能够捕获输入序列在不同语义空间中的关联模式。这是 Transformer 表达能力的关键来源。',
    related: [
      { name: 'attention', desc: '缩放点积注意力，头计算的最终步骤' },
      { name: 'multihead', desc: '多头注意力，将多个 head 组合起来' }
    ]
  }
};

// ============================================================
// 1. 主初始化 initReadingEnhanced
// ============================================================

/**
 * 根据论文数据动态渲染完整正文
 * 如果 window.PAPERS_DATA 中有对应论文，则渲染完整章节内容和公式
 * 否则保留 HTML 中硬编码的默认内容
 */
function renderPaperContent(paper) {
  var pdfWrap = document.getElementById('readingPdfInner');
  if (!pdfWrap || !paper) return;

  var fullData = window.PAPERS_DATA && window.PAPERS_DATA[paper.id];
  if (!fullData || !fullData.sections) return;

  // 用完整数据补充 paper 元信息
  if (fullData.abstract) currentPaper.abstract = fullData.abstract;
  if (fullData.keywords) currentPaper.keywords = fullData.keywords;
  if (fullData.ai) currentPaper.ai = fullData.ai;
  if (fullData.formulas) currentPaper.formulas = fullData.formulas;
  if (fullData.translations) currentPaper.translations = fullData.translations;

  // 构建正文 HTML
  var html = '';
  html += '<div class="rpage-pdf-title">' + escapeHtmlSafe(fullData.title || paper.title) + '</div>';
  html += '<div class="rpage-pdf-meta">' + escapeHtmlSafe(fullData.authors || paper.authors || '')
    + ' | ' + escapeHtmlSafe(fullData.venue || paper.venue || '')
    + '<br>引用数: ' + escapeHtmlSafe(fullData.citations || paper.citations || 'N/A')
    + ' | 年份: ' + (fullData.year || paper.year || 'N/A') + '</div>';

  // 渲染每个章节（所有章节统一用 h3，子章节通过样式缩进区分）
  fullData.sections.forEach(function(section) {
    html += '<div class="rpage-pdf-section" data-section="' + section.id + '">';
    var hTag = section.level === 3 ? 'h4' : 'h3';
    html += '<' + hTag + '>' + escapeHtmlSafe(section.title) + '</' + hTag + '>';

    (section.content || []).forEach(function(item) {
      if (item.type === 'p') {
        html += '<p>' + item.text + '</p>';
      } else if (item.type === 'formula' && item.ref) {
        html += '<div class="formula" onclick="openFormulaInterpretation(\'' + item.ref + '\')">'
          + (item.display || fullData.formulas[item.ref].latex.replace(/\\/g, '').replace(/text\{|\}|\left|\right|sqrt|frac|_/g, function(m) {
              if (m === 'sqrt') return '√';
              if (m === 'frac') return '/';
              return '';
            })) + '</div>';
      }
    });

    html += '</div>';
  });

  pdfWrap.innerHTML = html;
}

/**
 * 增强功能主初始化 —— 在页面加载时调用
 * 初始化论文数据、高亮/笔记/书签，生成大纲，渲染默认 AI 面板，
 * 绑定选中和滚动事件，启动阅读计时器
 */
window.initReadingEnhanced = function(paperId) {
  currentPaperId = paperId;

  // 获取论文数据（从 papers / libraryPapers / fallbackPapers 中查找）
  var allPapers = (window.papers || []).concat(window.libraryPapers || []);
  currentPaper = allPapers.find(function(p) { return p.id === paperId; })
    || (window.fallbackPapers || [])[0]
    || null;

  // 设置页面标题和元数据到 DOM
  if (currentPaper) {
    var titleEl = document.getElementById('readingTitle');
    if (titleEl) {
      titleEl.textContent = currentPaper.title;
      titleEl.dataset.paperId = currentPaper.id;
    }
    var pdfTitle = document.getElementById('pdfDetailTitle');
    if (pdfTitle) pdfTitle.textContent = currentPaper.title;
    var pdfMeta = document.getElementById('pdfDetailMeta');
    if (pdfMeta) {
      pdfMeta.innerHTML = (currentPaper.authors || '') + ' | ' + (currentPaper.venue || '')
        + ' | 引用数: ' + (currentPaper.citations || 'N/A')
        + ' | 年份: ' + (currentPaper.year || 'N/A');
    }
    // 恢复阅读进度
    if (typeof initReadingProgress === 'function') {
      try { initReadingProgress(currentPaper.id); } catch(e) {}
    }
  }

  // 从 localStorage 读取已保存的数据
  readingHighlights = lsGet('reading_highlights_' + paperId, []);
  readingNotes = lsGet('reading_notes_' + paperId, []);
  readingBookmarks = lsGet('reading_bookmarks_' + paperId, []);
  readingQaHistory = lsGet('reading_qa_history_' + paperId, []);

  // 恢复阅读模式
  var savedMode = lsGet('reading_readmode', null);
  if (savedMode) document.documentElement.setAttribute('data-readmode', savedMode);

  // 动态渲染论文完整正文（如果 PAPERS_DATA 中有对应论文）
  renderPaperContent(currentPaper);

  // 生成论文大纲
  window.generateOutline();

  // 渲染默认 AI 面板（摘要 Tab）
  renderAiSummary();

  // 绑定文本选中浮动菜单
  bindSelectionEvents();

  // 绑定高亮颜色选择器
  bindColorPicker();

  // 绑定滚动事件（进度条 + 大纲高亮）
  bindScrollEvents();

  // 启动阅读计时器
  startReadingTimer();
  updatePdfStats();

  // 渲染高亮列表和书签列表
  renderHighlightsList();
  renderBookmarksList();
};

// ============================================================
// 2. 左栏面板切换
// ============================================================

/**
 * 切换左栏面板（outline/search/highlights/bookmarks）
 * 更新 tab active 状态，显示对应面板
 */
window.switchLeftPanel = function(panelName) {
  // 更新 tab 按钮状态
  var tabs = document.querySelectorAll('.sidebar-left-tab');
  var tabMap = { outline: 0, search: 1, highlights: 2, bookmarks: 3 };
  tabs.forEach(function(t) { t.classList.remove('active'); });
  var idx = tabMap[panelName];
  if (idx != null && tabs[idx]) tabs[idx].classList.add('active');

  // 切换面板显示
  var panels = document.querySelectorAll('.sidebar-left-panel');
  panels.forEach(function(p) { p.classList.remove('active'); });
  var panelId = 'panel' + panelName.charAt(0).toUpperCase() + panelName.slice(1);
  var panel = document.getElementById(panelId);
  if (panel) panel.classList.add('active');
};

// ============================================================
// 3. 左右栏折叠
// ============================================================

/** 切换左栏显示/隐藏 */
window.toggleLeftSidebar = function() {
  var sidebar = document.getElementById('readingSidebarLeft');
  if (sidebar) sidebar.classList.toggle('collapsed');
};

/** 切换右栏显示/隐藏 */
window.toggleRightSidebar = function() {
  var sidebar = document.getElementById('readingAi');
  if (sidebar) sidebar.classList.toggle('collapsed');
};

// ============================================================
// 4. 论文目录大纲
// ============================================================

/**
 * 生成论文大纲 —— 扫描 .rpage-pdf-section 元素
 * 支持二级标题（h4），点击可跳转，当前阅读位置高亮
 */
window.generateOutline = function() {
  var list = document.getElementById('outlineList');
  if (!list) return;

  var sections = document.querySelectorAll('.rpage-pdf-section');
  if (!sections.length) {
    list.innerHTML = '<p class="sidebar-empty-hint">暂无大纲</p>';
    return;
  }

  var html = '';
  var numCounter = 0;
  sections.forEach(function(sec, i) {
    var sectionKey = sec.getAttribute('data-section') || ('sec_' + i);
    sec.id = sec.id || ('pdfSection_' + sectionKey);

    // 同时查找 h3 和 h4（level 3 的子章节渲染为 h4）
    var heading = sec.querySelector('h3') || sec.querySelector('h4');
    var title = heading ? heading.textContent : ('章节 ' + (i + 1));
    var isSubSection = heading && heading.tagName.toLowerCase() === 'h4';
    numCounter++;
    html += '<div class="outline-item' + (isSubSection ? ' sub' : '') + '" data-section-id="' + sec.id + '" onclick="scrollToSection(\'' + sec.id + '\')">';
    if (!isSubSection) {
      html += '<span class="outline-num">' + numCounter + '</span>';
    }
    html += '<span class="outline-title">' + escapeHtmlSafe(title) + '</span>'
      + '</div>';
  });

  list.innerHTML = html;
};

/** 滚动到指定章节 */
window.scrollToSection = function(id) {
  var el = document.getElementById(id);
  if (el && el.scrollIntoView) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

/** 更新大纲当前阅读位置高亮 */
function updateOutlineHighlight() {
  var pdfEl = document.getElementById('readingPdf');
  if (!pdfEl) return;
  var scrollTop = pdfEl.scrollTop;
  var currentSectionId = null;

  var sections = document.querySelectorAll('.rpage-pdf-section');
  sections.forEach(function(sec) {
    if (sec.offsetTop - 80 <= scrollTop) {
      currentSectionId = sec.id;
    }
  });

  document.querySelectorAll('.outline-item').forEach(function(item) {
    item.classList.remove('current');
  });

  if (currentSectionId) {
    var active = document.querySelector('.outline-item[data-section-id="' + currentSectionId + '"]');
    if (active) active.classList.add('current');
  }
}

// ============================================================
// 5. 全文搜索
// ============================================================

/**
 * 全文搜索 —— 遍历 .rpage-pdf-section p 元素
 * 高亮匹配文字（<mark>），显示搜索结果列表（上下文片段）
 */
window.searchInPdf = function(query) {
  var resultsEl = document.getElementById('searchResults');
  if (!resultsEl) return;

  // 先清除之前的搜索高亮
  var wrap = document.getElementById('readingPdfInner');
  if (wrap) {
    wrap.querySelectorAll('mark.search-mark').forEach(function(m) {
      var parent = m.parentNode;
      parent.replaceChild(document.createTextNode(m.textContent), m);
      parent.normalize();
    });
  }

  query = (query || '').trim();
  if (!query) {
    resultsEl.innerHTML = '<p class="sidebar-empty-hint">输入关键词搜索论文内容</p>';
    return;
  }

  var paragraphs = document.querySelectorAll('.rpage-pdf-section p');
  var results = [];
  var count = 0;
  var lowerQuery = query.toLowerCase();

  paragraphs.forEach(function(p, idx) {
    var text = p.textContent;
    var pos = text.toLowerCase().indexOf(lowerQuery);
    if (pos >= 0) {
      count++;
      // 高亮正文中的匹配文字
      highlightSearchInElement(p, query);
      // 生成上下文片段
      var start = Math.max(0, pos - 25);
      var end = Math.min(text.length, pos + query.length + 50);
      var snippet = (start > 0 ? '...' : '') + text.substring(start, end) + (end < text.length ? '...' : '');
      p.id = p.id || ('pdfPara_' + idx);
      results.push({ id: p.id, snippet: snippet, query: query });
    }
  });

  if (results.length === 0) {
    resultsEl.innerHTML = '<p class="sidebar-empty-hint">未找到匹配结果</p>';
    return;
  }

  var html = '<div class="search-result-count">找到 ' + count + ' 个结果</div>';
  results.forEach(function(r) {
    var escapedSnippet = escapeHtmlSafe(r.snippet);
    var escapedQuery = escapeHtmlSafe(r.query);
    var highlighted = escapedSnippet.replace(new RegExp(escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), function(m) {
      return '<mark>' + m + '</mark>';
    });
    html += '<div class="search-result-item" onclick="scrollToSection(\'' + r.id + '\')">'
      + '<p class="search-result-snippet">' + highlighted + '</p>'
      + '</div>';
  });
  resultsEl.innerHTML = html;
};

/** 在元素内高亮搜索匹配文字 */
function highlightSearchInElement(el, query) {
  var lowerQuery = query.toLowerCase();

  function walk(node) {
    if (node.nodeType === 3) {
      var text = node.textContent;
      var pos = text.toLowerCase().indexOf(lowerQuery);
      if (pos >= 0) {
        var mark = document.createElement('mark');
        mark.className = 'search-mark';
        mark.style.background = '#FEF3C7';
        mark.style.padding = '0 2px';
        mark.style.borderRadius = '2px';
        mark.textContent = text.substring(pos, pos + query.length);
        var after = document.createTextNode(text.substring(pos + query.length));
        node.textContent = text.substring(0, pos);
        node.parentNode.insertBefore(mark, node.nextSibling);
        node.parentNode.insertBefore(after, mark.nextSibling);
      }
    } else if (node.nodeType === 1) {
      if (node.classList && node.classList.contains('search-mark')) return;
      if (node.classList && node.classList.contains('pdf-highlight')) return;
      Array.prototype.slice.call(node.childNodes).forEach(walk);
    }
  }
  walk(el);
}

// ============================================================
// 6. 文本选中浮动菜单
// ============================================================

/** 绑定文本选中和浮动菜单事件 */
function bindSelectionEvents() {
  var wrap = document.querySelector('.reading-pdf-wrap');
  if (!wrap) return;

  // mouseup 时检测选中文本
  wrap.addEventListener('mouseup', function() {
    setTimeout(function() {
      var sel = window.getSelection();
      var text = sel && sel.toString().trim();
      if (text && text.length > 0 && sel.rangeCount > 0) {
        var range = sel.getRangeAt(0);
        if (wrap.contains(range.commonAncestorContainer)) {
          showFloatMenuForSelection();
        } else {
          hideFloatMenu();
        }
      } else {
        hideFloatMenu();
      }
    }, 10);
  });

  // 点击浮动菜单以外区域时隐藏
  document.addEventListener('mousedown', function(e) {
    var menu = document.getElementById('pdfFloatMenu');
    if (!menu || menu.style.display === 'none') return;
    if (!menu.contains(e.target)) {
      setTimeout(function() {
        var sel = window.getSelection();
        if (!sel || !sel.toString().trim()) hideFloatMenu();
      }, 10);
    }
  });
}

/** 显示浮动菜单（定位到选区上方） */
function showFloatMenuForSelection() {
  var sel = window.getSelection();
  if (!sel.rangeCount || sel.isCollapsed) { hideFloatMenu(); return; }
  var rect = sel.getRangeAt(0).getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) { hideFloatMenu(); return; }

  var menu = document.getElementById('pdfFloatMenu');
  if (!menu) return;

  menu.style.display = 'flex';
  var menuWidth = menu.offsetWidth || 280;
  var menuHeight = menu.offsetHeight || 40;

  var left = rect.left + rect.width / 2 - menuWidth / 2;
  var top = rect.top - menuHeight - 8;

  // 边界检查
  left = Math.max(10, Math.min(left, window.innerWidth - menuWidth - 10));
  if (top < 10) top = rect.bottom + 8; // 上方空间不够则显示在下方

  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
}

/** 隐藏浮动菜单 */
function hideFloatMenu() {
  var menu = document.getElementById('pdfFloatMenu');
  if (menu) menu.style.display = 'none';
}

/**
 * 浮动菜单动作处理（扩展 reading.js 原函数）
 * translate: 翻译 Tab | explain: 问答 Tab 自动提问
 * summarize: 问答 Tab 自动总结 | highlight: 添加高亮 | question: 问答 Tab 预填
 */
var _originalOnPdfFloatAction = window.onPdfFloatAction;
window.onPdfFloatAction = function(action) {
  var selectedText = getSelectedText();

  switch (action) {
    case 'translate':
      // 切换到翻译 Tab，翻译选中文字
      switchToAiTab('translate');
      renderAiTranslate(selectedText);
      break;
    case 'explain':
      // 切换到问答 Tab，自动提问"请解释这个概念"
      switchToAiTab('qa');
      var input1 = document.getElementById('readingAiInput');
      if (input1 && selectedText) {
        input1.value = '请解释这个概念：' + selectedText;
        if (typeof askReadingQuestion === 'function') askReadingQuestion();
      }
      break;
    case 'summarize':
      // 切换到问答 Tab，自动提问"请总结这段内容"
      switchToAiTab('qa');
      var input2 = document.getElementById('readingAiInput');
      if (input2 && selectedText) {
        input2.value = '请总结这段内容：' + selectedText;
        if (typeof askReadingQuestion === 'function') askReadingQuestion();
      }
      break;
    case 'highlight':
      // 添加高亮
      addHighlight();
      break;
    case 'question':
      // 切换到问答 Tab，输入框预填选中文字并聚焦
      switchToAiTab('qa');
      var input3 = document.getElementById('readingAiInput');
      if (input3) {
        input3.value = selectedText || '';
        input3.focus();
      }
      break;
    default:
      // 未知动作，回退到原函数
      if (typeof _originalOnPdfFloatAction === 'function') {
        _originalOnPdfFloatAction(action);
      }
  }

  hideFloatMenu();
};

/** 切换到指定 AI Tab */
function switchToAiTab(tab) {
  var tabBtn = document.querySelector('.rpage-ai-tab[onclick*="' + tab + '"]');
  if (tabBtn && typeof window.rpageSwitchAiTab === 'function') {
    window.rpageSwitchAiTab(tabBtn, tab);
  } else {
    // 手动切换 tab 样式
    document.querySelectorAll('.rpage-ai-tab').forEach(function(t) { t.classList.remove('active'); });
    if (tabBtn) tabBtn.classList.add('active');
  }
}

// ============================================================
// 7. 高亮系统
// ============================================================

/** 颜色值转 CSS class 名 */
window.getHighlightColorClass = function(color) {
  var map = {
    '#FFF3B0': 'hl-yellow',
    '#C6F6D5': 'hl-green',
    '#BFDBFE': 'hl-blue',
    '#FBCFE8': 'hl-pink'
  };
  return map[color] || 'hl-yellow';
};

/** 颜色选择器点击 —— 设置当前高亮颜色 */
window.selectHighlightColor = function(color) {
  currentHighlightColor = color;
  document.querySelectorAll('.hl-color-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.getAttribute('data-color') === color);
  });
  // 如果有选中文本，直接添加高亮
  if (getSelectedText()) addHighlight();
};

/** 绑定颜色选择器点击事件 */
function bindColorPicker() {
  document.querySelectorAll('.hl-color-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      window.selectHighlightColor(btn.getAttribute('data-color'));
    });
  });
}

/**
 * 给当前选中文本添加高亮
 * 用 Range API 将选中文本包裹在 <span class="pdf-highlight"> 中
 */
window.addHighlight = function() {
  var sel = window.getSelection();
  if (!sel.rangeCount || sel.isCollapsed) {
    showToastSafe('请先选中要高亮的文字', 'warning');
    return;
  }
  var range = sel.getRangeAt(0);
  var container = document.getElementById('readingPdfInner');
  if (!container || !container.contains(range.commonAncestorContainer)) {
    showToastSafe('请在论文正文中选择文字', 'warning');
    return;
  }

  var id = genId('hl');
  var colorClass = window.getHighlightColorClass(currentHighlightColor);
  var text = sel.toString();
  var pdfEl = document.getElementById('readingPdf');

  try {
    var span = document.createElement('span');
    span.className = 'pdf-highlight ' + colorClass;
    span.dataset.highlightId = id;
    span.style.background = currentHighlightColor;
    span.style.padding = '1px 2px';
    span.style.borderRadius = '2px';
    span.style.cursor = 'pointer';
    span.addEventListener('click', function() { window.scrollToHighlight(id); });

    if (range.startContainer === range.endContainer) {
      range.surroundContents(span);
    } else {
      // 跨节点：提取内容后包裹
      var fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);
    }

    // 查找所属章节
    var sectionEl = span.closest('.rpage-pdf-section');
    var section = sectionEl ? (sectionEl.getAttribute('data-section') || sectionEl.querySelector('h3') ? sectionEl.querySelector('h3').textContent : '') : '';

    // 保存高亮数据
    readingHighlights.push({
      id: id,
      text: text,
      color: currentHighlightColor,
      section: section,
      note: '',
      createdAt: new Date().toISOString(),
      scrollPosition: pdfEl ? pdfEl.scrollTop : 0
    });
    saveHighlights();
    renderHighlightsList();
    showToastSafe('已添加高亮', 'success');
  } catch (e) {
    console.warn('高亮添加失败:', e);
    showToastSafe('高亮添加失败，请尝试选择更少的文字', 'warning');
  }

  sel.removeAllRanges();
  hideFloatMenu();
};

/** 保存高亮到 localStorage */
function saveHighlights() {
  lsSet('reading_highlights_' + currentPaperId, readingHighlights);
}

/** 渲染高亮列表 */
window.renderHighlightsList = function() {
  var list = document.getElementById('highlightsList');
  var countEl = document.getElementById('highlightCount');
  if (countEl) countEl.textContent = readingHighlights.length;
  if (!list) return;

  if (readingHighlights.length === 0) {
    list.innerHTML = '<p class="sidebar-empty-hint">选中正文文字后点击高亮颜色即可标注</p>';
    return;
  }

  var html = '';
  // 按时间倒序
  var sorted = readingHighlights.slice().sort(function(a, b) {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  sorted.forEach(function(hl) {
    var hasNote = readingNotes.some(function(n) { return n.highlightId === hl.id; });
    var preview = hl.text.length > 60 ? hl.text.substring(0, 60) + '...' : hl.text;
    html += '<div class="highlight-item" data-highlight-id="' + hl.id + '">'
      + '<div class="highlight-color-dot" style="background:' + hl.color + ';"></div>'
      + '<div class="highlight-content" onclick="scrollToHighlight(\'' + hl.id + '\')">'
      + '<p class="highlight-text">' + escapeHtmlSafe(preview) + '</p>'
      + (hl.section ? '<span class="highlight-section">' + escapeHtmlSafe(hl.section) + '</span>' : '')
      + (hasNote ? '<span class="highlight-note-badge" title="有笔记">📝</span>' : '')
      + '</div>'
      + '<div class="highlight-actions">'
      + '<button class="hl-action-btn" onclick="event.stopPropagation();openNoteEditor(\'' + hl.id + '\')" title="添加/编辑笔记">📝</button>'
      + '<button class="hl-action-btn" onclick="event.stopPropagation();removeHighlight(\'' + hl.id + '\')" title="删除">✕</button>'
      + '</div>'
      + '</div>';
  });
  list.innerHTML = html;

  // 在高亮列表中渲染笔记标记
  renderNotesInHighlightList();
};

/** 删除高亮 */
window.removeHighlight = function(id) {
  // 从 DOM 中移除高亮 span
  var spans = document.querySelectorAll('span.pdf-highlight[data-highlight-id="' + id + '"]');
  spans.forEach(function(span) {
    var parent = span.parentNode;
    while (span.firstChild) parent.insertBefore(span.firstChild, span);
    parent.removeChild(span);
    parent.normalize();
  });

  // 从数据中移除
  readingHighlights = readingHighlights.filter(function(h) { return h.id !== id; });
  // 同时移除关联笔记
  readingNotes = readingNotes.filter(function(n) { return n.highlightId !== id; });
  saveHighlights();
  saveNotes();
  renderHighlightsList();
  showToastSafe('已删除高亮', 'success');
};

/** 滚动到指定高亮位置 */
window.scrollToHighlight = function(id) {
  var span = document.querySelector('span.pdf-highlight[data-highlight-id="' + id + '"]');
  if (span && span.scrollIntoView) {
    span.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // 闪烁效果
    span.style.transition = 'box-shadow 0.3s';
    span.style.boxShadow = '0 0 0 3px rgba(26,86,219,0.4)';
    setTimeout(function() { span.style.boxShadow = ''; }, 1500);
  } else {
    // DOM 中找不到（可能页面刷新后未恢复），尝试用 scrollPosition
    var hl = readingHighlights.find(function(h) { return h.id === id; });
    if (hl && hl.scrollPosition != null) {
      var pdfEl = document.getElementById('readingPdf');
      if (pdfEl) pdfEl.scrollTop = hl.scrollPosition;
    }
  }
};

// ============================================================
// 8. 笔记系统
// ============================================================

/** 打开笔记编辑弹窗 */
window.openNoteEditor = function(highlightId) {
  var overlay = document.getElementById('noteOverlay');
  if (!overlay) return;

  currentEditingNote = { highlightId: highlightId || null, noteId: null };

  var titleEl = document.getElementById('noteModalTitle');
  var previewEl = document.getElementById('noteHighlightPreview');
  var previewTextEl = document.getElementById('noteHighlightText');
  var contentEl = document.getElementById('noteContent');
  var deleteBtn = document.getElementById('noteBtnDelete');

  if (highlightId) {
    var hl = readingHighlights.find(function(h) { return h.id === highlightId; });
    if (hl) {
      titleEl.textContent = '编辑笔记';
      previewEl.style.display = 'block';
      previewTextEl.textContent = hl.text;
      // 查找已有笔记
      var note = readingNotes.find(function(n) { return n.highlightId === highlightId; });
      if (note) {
        contentEl.value = note.content;
        currentEditingNote.noteId = note.id;
        deleteBtn.style.display = 'inline-block';
      } else {
        contentEl.value = '';
        deleteBtn.style.display = 'none';
      }
    }
  } else {
    titleEl.textContent = '添加笔记';
    previewEl.style.display = 'none';
    contentEl.value = '';
    deleteBtn.style.display = 'none';
  }

  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  setTimeout(function() { if (contentEl) contentEl.focus(); }, 100);
};

/** 关闭笔记编辑弹窗 */
window.closeNoteEditor = function() {
  var overlay = document.getElementById('noteOverlay');
  if (overlay) overlay.classList.remove('active');
  document.body.style.overflow = '';
  currentEditingNote = null;
};

/** 保存笔记到 localStorage */
window.saveNote = function() {
  var contentEl = document.getElementById('noteContent');
  if (!contentEl) return;
  var content = contentEl.value.trim();
  if (!content) {
    showToastSafe('笔记内容不能为空', 'warning');
    return;
  }

  if (currentEditingNote && currentEditingNote.highlightId) {
    // 编辑高亮关联笔记
    if (currentEditingNote.noteId) {
      // 更新已有笔记
      var note = readingNotes.find(function(n) { return n.id === currentEditingNote.noteId; });
      if (note) {
        note.content = content;
        note.updatedAt = new Date().toISOString();
      }
    } else {
      // 新建笔记
      readingNotes.push({
        id: genId('note'),
        highlightId: currentEditingNote.highlightId,
        content: content,
        createdAt: new Date().toISOString()
      });
    }
  } else {
    // 独立笔记（不关联高亮）
    readingNotes.push({
      id: genId('note'),
      highlightId: null,
      content: content,
      createdAt: new Date().toISOString()
    });
  }

  saveNotes();
  renderHighlightsList();
  window.closeNoteEditor();
  showToastSafe('笔记已保存', 'success');
};

/** 删除笔记 */
window.deleteNote = function() {
  if (!currentEditingNote || !currentEditingNote.noteId) return;
  readingNotes = readingNotes.filter(function(n) { return n.id !== currentEditingNote.noteId; });
  saveNotes();
  renderHighlightsList();
  window.closeNoteEditor();
  showToastSafe('笔记已删除', 'success');
};

/** 保存笔记到 localStorage */
function saveNotes() {
  lsSet('reading_notes_' + currentPaperId, readingNotes);
}

/** 在高亮列表中显示笔记标记 */
window.renderNotesInHighlightList = function() {
  // 此函数已在 renderHighlightsList 中集成（通过 hasNote 判断显示 📝 标记）
  // 此处保留为独立函数以供外部调用
  var list = document.getElementById('highlightsList');
  if (!list) return;
  readingNotes.forEach(function(note) {
    if (note.highlightId) {
      var item = list.querySelector('.highlight-item[data-highlight-id="' + note.highlightId + '"]');
      if (item && !item.querySelector('.highlight-note-badge')) {
        var content = item.querySelector('.highlight-content');
        if (content) {
          var badge = document.createElement('span');
          badge.className = 'highlight-note-badge';
          badge.title = note.content;
          badge.textContent = '📝';
          content.appendChild(badge);
        }
      }
    }
  });
};

// ============================================================
// 9. 书签系统
// ============================================================

/** 在当前滚动位置添加书签 */
window.addBookmark = function() {
  var pdfEl = document.getElementById('readingPdf');
  if (!pdfEl) return;
  var scrollTop = pdfEl.scrollTop;

  // 尝试获取当前章节标题作为书签标题
  var title = '书签 ' + (readingBookmarks.length + 1);
  var sections = document.querySelectorAll('.rpage-pdf-section');
  sections.forEach(function(sec) {
    if (sec.offsetTop - 80 <= scrollTop) {
      var h3 = sec.querySelector('h3');
      if (h3) title = h3.textContent;
    }
  });

  readingBookmarks.push({
    id: genId('bm'),
    title: title,
    scrollPosition: scrollTop,
    createdAt: new Date().toISOString()
  });
  saveBookmarks();
  renderBookmarksList();
  showToastSafe('已添加书签', 'success');
};

/** 删除书签 */
window.removeBookmark = function(id) {
  readingBookmarks = readingBookmarks.filter(function(b) { return b.id !== id; });
  saveBookmarks();
  renderBookmarksList();
  showToastSafe('已删除书签', 'success');
};

/** 保存书签到 localStorage */
function saveBookmarks() {
  lsSet('reading_bookmarks_' + currentPaperId, readingBookmarks);
}

/** 渲染书签列表 */
window.renderBookmarksList = function() {
  var list = document.getElementById('bookmarksList');
  if (!list) return;

  if (readingBookmarks.length === 0) {
    list.innerHTML = '<p class="sidebar-empty-hint">点击 + 添加书签标记当前位置</p>';
    return;
  }

  var html = '';
  var sorted = readingBookmarks.slice().sort(function(a, b) {
    return a.scrollPosition - b.scrollPosition;
  });
  sorted.forEach(function(bm) {
    var time = new Date(bm.createdAt).toLocaleString();
    html += '<div class="bookmark-item" data-bookmark-id="' + bm.id + '">'
      + '<div class="bookmark-content" onclick="scrollToBookmark(\'' + bm.id + '\')">'
      + '<span class="bookmark-icon">🔖</span>'
      + '<div class="bookmark-info">'
      + '<p class="bookmark-title">' + escapeHtmlSafe(bm.title) + '</p>'
      + '<span class="bookmark-time">' + time + '</span>'
      + '</div>'
      + '</div>'
      + '<button class="hl-action-btn" onclick="event.stopPropagation();removeBookmark(\'' + bm.id + '\')" title="删除">✕</button>'
      + '</div>';
  });
  list.innerHTML = html;
};

/** 滚动到书签位置 */
window.scrollToBookmark = function(id) {
  var bm = readingBookmarks.find(function(b) { return b.id === id; });
  if (!bm) return;
  var pdfEl = document.getElementById('readingPdf');
  if (pdfEl) pdfEl.scrollTop = bm.scrollPosition;
};

// ============================================================
// 10. 增强 AI 面板内容渲染
// ============================================================

/** 获取当前论文的 AI 数据（优先使用 PAPERS_DATA，否则用 mock） */
function getPaperMockData() {
  // 如果有结构化数据，优先使用
  if (currentPaper && currentPaper.structured && currentPaper.structured.zh) {
    return { structured: currentPaper.structured };
  }
  // 如果有完整论文数据中的 ai 字段，优先使用
  if (currentPaper && currentPaper.ai) {
    return currentPaper.ai;
  }
  // 否则返回 mock 数据
  return {
    oneLineSummary: '本文提出了 Transformer 架构，完全基于注意力机制，摒弃了传统的循环和卷积结构，在机器翻译任务上取得了 SOTA 结果并大幅缩短训练时间。',
    contributions: [
      '首次提出完全基于自注意力机制的序列转录模型 Transformer',
      '引入多头注意力机制，使模型能从多个子空间并行关注不同信息',
      '使用位置编码替代循环结构，实现高度并行化训练',
      '在 WMT 2014 英德翻译任务上达到 28.4 BLEU，超越所有先前模型',
      '在 8 GPU 上仅需 12 小时训练，效率远超 RNN/CNN 方案'
    ],
    dataCards: [
      { label: 'Encoder 层数', value: '6', unit: '层' },
      { label: '英德翻译', value: '28.4', unit: 'BLEU' },
      { label: '训练时间', value: '12', unit: '小时' },
      { label: 'GPU 数量', value: '8', unit: 'GPU' }
    ],
    keywords: currentPaper ? currentPaper.keywords : ['NLP', 'Transformer', '注意力机制'],
    tip: '建议先阅读第 3 节了解模型架构，重点关注缩放点积注意力和多头注意力两个核心公式。然后跳到第 5 节查看实验结果，对比 Table 2 中 Transformer 与基线模型的差异。'
  };
}

/** 渲染摘要 Tab */
function renderAiSummary() {
  var el = document.getElementById('readingAiContent');
  if (!el) return;

  var data = getPaperMockData();
  var keywords = (currentPaper && currentPaper.keywords) || data.keywords || [];

  // 如果有结构化数据
  if (data.structured && data.structured.zh && data.structured.zh.summary) {
    el.innerHTML = '<div class="ai-reading-summary">'
      + '<h4 style="font-size:15px;font-weight:700;margin-bottom:14px;color:var(--text-dark);border-bottom:2px solid var(--brand-blue);padding-bottom:6px;">AI 速读</h4>'
      + '<p class="ai-one-line-summary" style="font-size:13px;line-height:1.8;color:var(--text-dark);">' + escapeHtmlSafe(data.structured.zh.summary) + '</p>'
      + (currentPaper && currentPaper.abstract ? '<details style="margin-top:12px;background:#F8FAFC;border:1px solid #E5E7EB;border-radius:8px;padding:10px 12px;"><summary style="cursor:pointer;font-size:12px;font-weight:600;color:var(--brand-blue);">📄 英文摘要</summary><p style="font-size:12px;color:var(--text-mid);line-height:1.7;margin-top:8px;">' + escapeHtmlSafe(currentPaper.abstract) + '</p></details>' : '')
      + renderKeywordsHtml(keywords)
      + renderTipBox('研读建议：先定位论文解决的问题，再对照摘要中的方法词和实验指标，判断其贡献是架构、训练策略、数据构造还是应用验证。')
      + '</div>';
    return;
  }

  // 使用 mock 数据
  var contributionsHtml = data.contributions.map(function(c, i) {
    return '<div class="ai-contribution-item" style="display:flex;align-items:flex-start;gap:10px;margin:8px 0;">'
      + '<span style="flex-shrink:0;width:22px;height:22px;border-radius:50%;background:var(--brand-blue);color:#fff;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;">' + (i + 1) + '</span>'
      + '<span style="font-size:13px;color:var(--text-dark);line-height:1.6;">' + escapeHtmlSafe(c) + '</span>'
      + '</div>';
  }).join('');

  var cardsHtml = data.dataCards.map(function(card) {
    return '<div class="ai-data-card" style="background:var(--bg-hover);border-radius:8px;padding:12px;text-align:center;">'
      + '<div style="font-size:22px;font-weight:700;color:var(--brand-blue);">' + escapeHtmlSafe(card.value) + (card.unit ? '<span style="font-size:12px;color:var(--text-mid);margin-left:2px;">' + escapeHtmlSafe(card.unit) + '</span>' : '') + '</div>'
      + '<div style="font-size:11px;color:var(--text-mid);margin-top:4px;">' + escapeHtmlSafe(card.label) + '</div>'
      + '</div>';
  }).join('');

  el.innerHTML = '<div class="ai-reading-summary">'
    + '<h4 style="font-size:15px;font-weight:700;margin-bottom:14px;color:var(--text-dark);border-bottom:2px solid var(--brand-blue);padding-bottom:6px;">AI 速读</h4>'
    + '<div class="ai-one-line-summary" style="font-size:13px;line-height:1.8;color:var(--text-dark);background:#F0F4FF;padding:12px;border-radius:8px;margin-bottom:16px;">' + escapeHtmlSafe(data.oneLineSummary) + '</div>'
    + '<div class="ai-contribution-list" style="margin-bottom:16px;">'
    + '<h5 style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text-dark);">核心贡献</h5>'
    + contributionsHtml
    + '</div>'
    + '<div class="ai-data-cards" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;">' + cardsHtml + '</div>'
    + renderKeywordsHtml(keywords)
    + renderTipBox(data.tip)
    + '</div>';
}

/** 渲染创新 Tab */
function renderAiNovelty() {
  var el = document.getElementById('readingAiContent');
  if (!el) return;

  // 检查结构化数据
  if (currentPaper && currentPaper.structured && (currentPaper.structured.zh && currentPaper.structured.zh.core_innovation || currentPaper.structured.core_innovation)) {
    var zhContent = currentPaper.structured.zh && currentPaper.structured.zh.core_innovation;
    var enContent = currentPaper.structured.core_innovation;
    var html = '<div class="ai-novelty-section"><h4 style="font-size:14px;font-weight:600;margin-bottom:10px;color:var(--text-dark);">核心创新</h4>';
    if (zhContent) html += '<p style="font-size:13px;line-height:1.8;color:var(--text-dark);">' + escapeHtmlSafe(zhContent) + '</p>';
    if (enContent && enContent.content) {
      html += '<details style="margin-top:10px;background:#F8FAFC;border:1px solid #E5E7EB;border-radius:8px;padding:10px 12px;"><summary style="cursor:pointer;font-size:12px;font-weight:600;color:var(--brand-blue);">📄 英文原文</summary><p style="font-size:12px;color:var(--text-mid);line-height:1.7;margin-top:8px;">' + escapeHtmlSafe(enContent.content) + '</p></details>';
    }
    el.innerHTML = html + '</div>';
    return;
  }

  var data = getPaperMockData();
  var html = '<div class="ai-novelty-section">';

  // 创新点概述
  html += '<h4 style="font-size:14px;font-weight:600;margin-bottom:10px;color:var(--text-dark);">创新点概述</h4>';
  if (data.noveltySummary) {
    html += '<p style="font-size:13px;line-height:1.7;color:var(--text-mid);margin-bottom:16px;">' + escapeHtmlSafe(data.noveltySummary) + '</p>';
  } else {
    html += '<p style="font-size:13px;line-height:1.7;color:var(--text-mid);margin-bottom:16px;">本文的核心创新在于提出了一种新的方法或架构，在关键指标上显著超越了先前工作，并对后续研究产生了深远影响。</p>';
  }

  // 对比表格
  if (data.comparisonTable) {
    var ct = data.comparisonTable;
    html += '<h5 style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text-dark);">方法对比</h5>';
    html += '<div class="ai-comparison-table" style="overflow-x:auto;margin-bottom:16px;"><table style="width:100%;border-collapse:collapse;font-size:12px;">';
    html += '<thead><tr style="background:var(--bg-hover);">';
    ct.headers.forEach(function(h) { html += '<th style="padding:8px;text-align:left;border:1px solid #E5E7EB;">' + escapeHtmlSafe(h) + '</th>'; });
    html += '</tr></thead><tbody>';
    ct.rows.forEach(function(row) {
      var style = row.highlight ? ' style="background:#FEF3C7;font-weight:600;"' : '';
      html += '<tr' + style + '>';
      row.values.forEach(function(v) {
        html += '<td style="padding:8px;border:1px solid #E5E7EB;">' + escapeHtmlSafe(v) + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
  }

  // 技术路线
  if (data.techRoute) {
    html += '<h5 style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text-dark);">技术路线</h5>';
    html += '<p style="font-size:13px;line-height:1.7;color:var(--text-mid);">' + escapeHtmlSafe(data.techRoute) + '</p>';
  }

  html += '</div>';
  el.innerHTML = html;
}

/** 渲染实验 Tab */
function renderAiExperiment() {
  var el = document.getElementById('readingAiContent');
  if (!el) return;

  // 检查结构化数据
  if (currentPaper && currentPaper.structured && (currentPaper.structured.zh && currentPaper.structured.zh.experiments || currentPaper.structured.experiments)) {
    var zhExp = currentPaper.structured.zh && currentPaper.structured.zh.experiments;
    var enExp = currentPaper.structured.experiments;
    var html2 = '<div class="ai-experiment-section"><h4 style="font-size:14px;font-weight:600;margin-bottom:10px;color:var(--text-dark);">实验与结果</h4>';
    if (zhExp) html2 += '<p style="font-size:13px;line-height:1.8;color:var(--text-dark);">' + escapeHtmlSafe(zhExp) + '</p>';
    if (enExp && enExp.content) {
      html2 += '<details style="margin-top:10px;background:#F8FAFC;border:1px solid #E5E7EB;border-radius:8px;padding:10px 12px;"><summary style="cursor:pointer;font-size:12px;font-weight:600;color:var(--brand-blue);">📄 英文原文</summary><p style="font-size:12px;color:var(--text-mid);line-height:1.7;margin-top:8px;">' + escapeHtmlSafe(enExp.content) + '</p></details>';
    }
    el.innerHTML = html2 + '</div>';
    return;
  }

  var data = getPaperMockData();
  var html = '<div class="ai-experiment-section">';

  // 实验结果表格
  if (data.experimentTable) {
    var et = data.experimentTable;
    html += '<h4 style="font-size:14px;font-weight:600;margin-bottom:10px;color:var(--text-dark);">主要实验结果</h4>';
    html += '<div class="ai-experiment-table" style="overflow-x:auto;margin-bottom:16px;"><table style="width:100%;border-collapse:collapse;font-size:12px;">';
    html += '<thead><tr style="background:var(--bg-hover);">';
    et.headers.forEach(function(h) { html += '<th style="padding:8px;text-align:left;border:1px solid #E5E7EB;">' + escapeHtmlSafe(h) + '</th>'; });
    html += '</tr></thead><tbody>';
    et.rows.forEach(function(row) {
      var style = row.highlight ? ' style="background:#FEF3C7;font-weight:600;"' : '';
      html += '<tr' + style + '>';
      row.values.forEach(function(v) {
        html += '<td style="padding:8px;border:1px solid #E5E7EB;">' + escapeHtmlSafe(v) + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
  }

  // 消融实验柱状图
  if (data.ablationBars && data.ablationBars.length) {
    var maxVal = 0;
    data.ablationBars.forEach(function(b) { if (b.value > maxVal) maxVal = b.value; });
    if (maxVal === 0) maxVal = 1;
    html += '<h5 style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text-dark);">消融实验</h5>';
    html += '<div style="margin-bottom:16px;">';
    data.ablationBars.forEach(function(d, i) {
      var pct = Math.round((d.value / maxVal) * 100);
      var color = ['#1A56DB','#F59E0B','#7C3AED','#DC2626','#059669'][i % 5];
      html += '<div style="display:flex;align-items:center;gap:8px;margin:6px 0;">'
        + '<span style="width:140px;font-size:11px;color:var(--text-mid);flex-shrink:0;">' + escapeHtmlSafe(d.label) + '</span>'
        + '<div style="flex:1;height:18px;background:var(--bg-hover);border-radius:4px;overflow:hidden;">'
        + '<div style="width:' + pct + '%;height:100%;background:' + color + ';border-radius:4px;transition:width 0.5s;"></div>'
        + '</div>'
        + '<span style="width:60px;font-size:11px;font-weight:600;color:var(--text-dark);text-align:right;">' + escapeHtmlSafe(d.display || d.value) + '</span>'
        + '</div>';
    });
    html += '</div>';
  }

  // SOTA 说明
  if (data.sotaNote) {
    html += '<div class="ai-sota-note" style="padding:12px;background:#F0F4FF;border-radius:8px;font-size:12px;color:var(--text-dark);line-height:1.7;">'
      + '<strong>SOTA 对比说明：</strong>' + escapeHtmlSafe(data.sotaNote)
      + '</div>';
  }

  html += '</div>';
  el.innerHTML = html;
}

/** 渲染问答 Tab */
function renderAiQa() {
  var el = document.getElementById('readingAiContent');
  if (!el) return;
  var title = currentPaper ? currentPaper.title : '当前论文';

  // 优先使用论文数据中的推荐问题
  var data = getPaperMockData();
  var suggestedQuestions = (data && data.suggestedQuestions && data.suggestedQuestions.length)
    ? data.suggestedQuestions
    : [
      '这篇论文的核心贡献是什么？',
      '这篇论文相比先前工作有什么优势？',
      '核心方法/机制是什么？',
      '这篇论文有哪些局限和可改进方向？'
    ];
  var suggestedHtml = suggestedQuestions.map(function(q) {
    return '<button class="qa-suggested-btn" onclick="fillReadingQuestionEnhanced(\'' + q.replace(/'/g, "\\'") + '\')" style="padding:8px 14px;background:var(--bg-hover);border:1px solid #E5E7EB;border-radius:20px;font-size:12px;color:var(--text-dark);cursor:pointer;text-align:left;transition:all 0.2s;" onmouseover="this.style.borderColor=\'var(--brand-blue)\';this.style.color=\'var(--brand-blue)\'" onmouseout="this.style.borderColor=\'#E5E7EB\';this.style.color=\'var(--text-dark)\'">' + escapeHtmlSafe(q) + '</button>';
  }).join('');

  // 历史问答
  var historyHtml = '';
  if (readingQaHistory && readingQaHistory.length > 0) {
    historyHtml = '<div class="qa-qa-history" style="margin-top:16px;"><h5 style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text-dark);">历史问答</h5>';
    readingQaHistory.forEach(function(item) {
      historyHtml += '<div style="background:#F0F4FF;padding:8px 12px;border-radius:8px;margin-bottom:6px;font-size:12px;"><strong>Q:</strong> ' + escapeHtmlSafe(item.question) + '</div>'
        + '<div style="background:#F8FAFC;padding:8px 12px;border-radius:8px;margin-bottom:10px;font-size:12px;border:1px solid #E5E7EB;"><strong>A:</strong> ' + escapeHtmlSafe(item.answer) + '</div>';
    });
    historyHtml += '</div>';
  }

  el.innerHTML = '<div class="ai-qa-section">'
    + '<h4 style="font-size:14px;font-weight:600;margin-bottom:10px;color:var(--text-dark);">论文问答</h4>'
    + '<p style="font-size:13px;color:var(--text-mid);margin-bottom:12px;">围绕「' + escapeHtmlSafe(title) + '」继续追问，AI 会带入标题、作者、venue、摘要和关键词作为上下文。</p>'
    + '<div class="qa-suggested-questions" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">' + suggestedHtml + '</div>'
    + historyHtml
    + '</div>';
}

/** 预填问答输入框（供推荐问题按钮调用） */
window.fillReadingQuestionEnhanced = function(question) {
  var input = document.getElementById('readingAiInput');
  if (input) {
    input.value = question;
    input.focus();
  }
};

/** 渲染翻译 Tab（可选传入选中文本进行翻译） */
function renderAiTranslate(selectedText) {
  var el = document.getElementById('readingAiContent');
  if (!el) return;

  // 优先使用论文数据中的翻译对照
  var translations = (currentPaper && currentPaper.translations) || [];

  var html = '<div class="ai-translate-section">'
    + '<h4 style="font-size:14px;font-weight:600;margin-bottom:10px;color:var(--text-dark);">翻译与术语</h4>';

  // 如果有选中文本，显示翻译区域
  if (selectedText) {
    html += '<div style="margin-bottom:16px;padding:12px;background:#F0F4FF;border-radius:8px;">'
      + '<p style="font-size:12px;color:var(--text-mid);margin-bottom:6px;"><strong>选中文字：</strong></p>'
      + '<p style="font-size:12px;color:var(--text-dark);margin-bottom:8px;">' + escapeHtmlSafe(selectedText) + '</p>'
      + '<div id="selectedTransResult" style="padding:8px;background:#F8FAFC;border-radius:4px;font-size:12px;color:var(--text-dark);"><span class="loading-dots">翻译中...</span></div>'
      + '</div>';
    // 调用 API 翻译选中文字
    translateTextViaApi(selectedText, function(result) {
      var resultEl = document.getElementById('selectedTransResult');
      if (resultEl) resultEl.innerHTML = '<strong>中文翻译：</strong><br>' + escapeHtmlSafe(result);
    });
  }

  // 如果有预置的双语对照，直接展示
  if (translations.length > 0) {
    html += '<h5 style="font-size:13px;font-weight:600;margin:12px 0 8px;color:var(--text-dark);">段落级双语对照</h5><div class="bilingual-list">';
    translations.forEach(function(t, i) {
      html += '<div class="bilingual-paragraph" style="margin-bottom:12px;padding:10px;background:var(--bg-hover);border-radius:8px;">'
        + '<p style="font-size:12px;color:var(--text-mid);line-height:1.6;margin-bottom:6px;">' + escapeHtmlSafe(t.en) + '</p>'
        + '<p style="font-size:12px;color:var(--text-dark);line-height:1.6;padding:8px;background:#F8FAFC;border-left:3px solid var(--brand-blue);border-radius:4px;">' + escapeHtmlSafe(t.zh) + '</p>'
        + '</div>';
    });
    html += '</div>';
  } else {
    // 否则从 PDF 段落中生成可翻译按钮
    var paragraphs = document.querySelectorAll('.rpage-pdf-section p');
    var paraHtml = '';
    paragraphs.forEach(function(p, i) {
      var enText = p.textContent.trim();
      if (enText.length < 20) return;
      var preview = enText.length > 120 ? enText.substring(0, 120) + '...' : enText;
      paraHtml += '<div class="bilingual-paragraph" style="margin-bottom:12px;padding:10px;background:var(--bg-hover);border-radius:8px;">'
        + '<p style="font-size:12px;color:var(--text-mid);line-height:1.6;margin-bottom:6px;">' + escapeHtmlSafe(preview) + '</p>'
        + '<button onclick="translateParagraphEnhanced(' + i + ')" style="font-size:11px;color:var(--brand-blue);background:none;border:none;cursor:pointer;padding:0;">🌐 翻译此段落</button>'
        + '<div class="para-translation" id="paraTrans_' + i + '" style="display:none;margin-top:8px;padding:8px;background:#F8FAFC;border-left:3px solid var(--brand-blue);border-radius:4px;font-size:12px;color:var(--text-dark);"></div>'
        + '</div>';
    });
    html += '<h5 style="font-size:13px;font-weight:600;margin:12px 0 8px;color:var(--text-dark);">段落级双语对照</h5><div class="bilingual-list">' + paraHtml + '</div>';
  }

  html += '</div>';
  el.innerHTML = html;
}

/** 翻译指定段落 */
window.translateParagraphEnhanced = function(idx) {
  var paragraphs = document.querySelectorAll('.rpage-pdf-section p');
  if (!paragraphs[idx]) return;
  var text = paragraphs[idx].textContent.trim();
  var resultEl = document.getElementById('paraTrans_' + idx);
  if (!resultEl) return;
  resultEl.style.display = 'block';
  resultEl.innerHTML = '<span class="loading-dots">翻译中...</span>';
  translateTextViaApi(text, function(result) {
    if (resultEl) resultEl.innerHTML = escapeHtmlSafe(result);
  });
};

/** 通过后端 /api/translate 接口翻译文本 */
function translateTextViaApi(text, callback) {
  if (typeof apiFetch !== 'function') {
    callback('（翻译服务不可用）');
    return;
  }
  apiFetch('/translate', {
    method: 'POST',
    body: { text: text, target_lang: '中文', source_lang: null }
  }).then(function(data) {
    if (data && data.translated) {
      callback(data.translated);
    } else {
      callback('翻译服务暂时不可用，请稍后重试。');
    }
  });
}

/** 渲染关键词标签 HTML */
function renderKeywordsHtml(keywords) {
  if (!keywords || !keywords.length) return '';
  var chips = keywords.map(function(k) {
    return '<span style="padding:3px 12px;background:#EFF6FF;border-radius:12px;font-size:11px;color:var(--brand-blue);">' + escapeHtmlSafe(k) + '</span>';
  }).join('');
  return '<div class="ai-keywords" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;">' + chips + '</div>';
}

/** 渲染研读建议框 */
function renderTipBox(tip) {
  return '<div class="ai-tip-box" style="padding:12px;background:#FFFBEB;border-left:3px solid #F59E0B;border-radius:8px;font-size:12px;color:var(--text-dark);line-height:1.7;">'
    + '<strong>💡 研读建议</strong><br>' + escapeHtmlSafe(tip) + '</div>';
}

// ============================================================
// 11. 相似论文面板
// ============================================================

/** 显示相似论文弹窗 */
window.showSimilarPapers = function() {
  var overlay = document.getElementById('similarOverlay');
  if (!overlay) return;

  // 准备相似论文数据
  prepareSimilarPapersData();

  // 默认列表视图
  similarCurrentView = 'list';
  document.querySelectorAll('.similar-view-tab').forEach(function(t) { t.classList.remove('active'); });
  var listTab = document.querySelector('.similar-view-tab[onclick*="list"]');
  if (listTab) listTab.classList.add('active');
  document.querySelectorAll('.similar-view-panel').forEach(function(p) { p.classList.remove('active'); });
  var listPanel = document.getElementById('similarListView');
  if (listPanel) listPanel.classList.add('active');

  renderSimilarList();
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
};

/** 关闭相似论文弹窗 */
window.closeSimilarPapers = function() {
  var overlay = document.getElementById('similarOverlay');
  if (overlay) overlay.classList.remove('active');
  document.body.style.overflow = '';
};

/** 切换列表/图谱视图 */
window.switchSimilarView = function(view) {
  similarCurrentView = view;
  document.querySelectorAll('.similar-view-tab').forEach(function(t) { t.classList.remove('active'); });
  var tabs = document.querySelectorAll('.similar-view-tab');
  if (view === 'list' && tabs[0]) tabs[0].classList.add('active');
  if (view === 'graph' && tabs[1]) tabs[1].classList.add('active');

  document.querySelectorAll('.similar-view-panel').forEach(function(p) { p.classList.remove('active'); });
  if (view === 'list') {
    var lp = document.getElementById('similarListView');
    if (lp) lp.classList.add('active');
    renderSimilarList();
  } else {
    var gp = document.getElementById('similarGraphView');
    if (gp) gp.classList.add('active');
    setTimeout(renderCitationGraph, 100);
  }
};

/** 准备相似论文数据（基于关键词重叠度计算相关度） */
function prepareSimilarPapersData() {
  var allPapers = (window.papers || []).concat(window.libraryPapers || []);
  var keywords = (currentPaper && currentPaper.keywords) || [];

  similarPapersData = allPapers
    .filter(function(p) { return p.id !== currentPaperId; })
    .map(function(p) {
      var overlap = (p.keywords || []).filter(function(k) {
        return keywords.some(function(kw) { return kw.toLowerCase() === k.toLowerCase(); });
      }).length;
      var relevance = keywords.length > 0 ? Math.round((overlap / keywords.length) * 100) : 0;
      if (relevance === 0) relevance = 30 + Math.floor(Math.random() * 30); // fallback 相关度
      return {
        id: p.id, title: p.title, authors: p.authors, venue: p.venue,
        year: p.year, ccf: p.ccf, citations: p.citations, keywords: p.keywords || [],
        abstract: p.abstract || '',
        _relevance: relevance, _overlap: overlap
      };
    })
    .sort(function(a, b) { return b._relevance - a._relevance; })
    .slice(0, 12);

  similarPapersFiltered = similarPapersData.slice();
}

/** 渲染相似论文列表（带相关度进度条） */
function renderSimilarList() {
  var list = document.getElementById('similarList');
  if (!list) return;

  if (!similarPapersFiltered.length) {
    list.innerHTML = '<p class="sidebar-empty-hint">暂无相似论文</p>';
    return;
  }

  var html = '';
  similarPapersFiltered.forEach(function(p) {
    var relevance = p._relevance || 0;
    var citeNum = parseCitations(p.citations);
    html += '<div class="similar-item" style="padding:12px;border:1px solid #E5E7EB;border-radius:8px;margin-bottom:8px;cursor:pointer;" onclick="openReadingFromEnhanced(\'' + p.id + '\')">'
      + '<div style="font-size:13px;font-weight:600;color:var(--text-dark);margin-bottom:4px;">' + escapeHtmlSafe(p.title) + '</div>'
      + '<div style="font-size:11px;color:var(--text-mid);margin-bottom:8px;">' + escapeHtmlSafe(p.authors || '') + ' | ' + escapeHtmlSafe(p.venue || '') + ' | ' + (p.year || '') + ' | 引用 ' + escapeHtmlSafe(p.citations || 'N/A') + '</div>'
      + '<div style="display:flex;align-items:center;gap:8px;">'
      + '<div style="flex:1;height:6px;background:var(--bg-hover);border-radius:3px;overflow:hidden;">'
      + '<div style="width:' + relevance + '%;height:100%;background:linear-gradient(90deg,var(--brand-blue),#3B82F6);border-radius:3px;"></div>'
      + '</div>'
      + '<span style="font-size:11px;color:var(--brand-blue);font-weight:600;white-space:nowrap;">相关度 ' + relevance + '%</span>'
      + '</div>'
      + '</div>';
  });
  list.innerHTML = html;
}

/** 从相似论文弹窗打开论文阅读 */
window.openReadingFromEnhanced = function(id) {
  window.closeSimilarPapers();
  if (typeof openReading === 'function') {
    openReading(id);
  } else {
    window.location.href = 'reading.html?id=' + encodeURIComponent(id);
  }
};

/** 搜索过滤相似论文 */
window.filterSimilarPapers = function(query) {
  query = (query || '').trim().toLowerCase();
  if (!query) {
    similarPapersFiltered = similarPapersData.slice();
  } else {
    similarPapersFiltered = similarPapersData.filter(function(p) {
      return (p.title || '').toLowerCase().indexOf(query) >= 0
        || (p.authors || '').toLowerCase().indexOf(query) >= 0
        || (p.venue || '').toLowerCase().indexOf(query) >= 0;
    });
  }
  renderSimilarList();
};

/** 排序相似论文 */
window.sortSimilarPapers = function() {
  var select = document.getElementById('similarSortSelect');
  var sortBy = select ? select.value : 'relevance';
  similarPapersFiltered.sort(function(a, b) {
    switch (sortBy) {
      case 'citations': return parseCitations(b.citations) - parseCitations(a.citations);
      case 'year': return (b.year || 0) - (a.year || 0);
      default: return (b._relevance || 0) - (a._relevance || 0);
    }
  });
  renderSimilarList();
};

/** 用 SVG 绘制引用关系图（中心节点 + 周围相似论文节点） */
function renderCitationGraph() {
  var svg = document.getElementById('citationGraph');
  if (!svg) return;
  svg.innerHTML = '';
  if (!similarPapersData.length) return;

  var width = svg.clientWidth || 600;
  var height = svg.clientHeight || 400;
  var centerX = width / 2;
  var centerY = height / 2;
  var centerRadius = 28;
  var svgNS = 'http://www.w3.org/2000/svg';

  // 计算周围节点位置（圆形布局）
  var maxCite = 0;
  similarPapersData.forEach(function(p) {
    p._citeNum = parseCitations(p.citations);
    if (p._citeNum > maxCite) maxCite = p._citeNum;
  });

  var radius = Math.min(width, height) * 0.35;
  similarPapersData.forEach(function(p, i) {
    var angle = (i / similarPapersData.length) * 2 * Math.PI - Math.PI / 2;
    p._x = centerX + Math.cos(angle) * radius;
    p._y = centerY + Math.sin(angle) * radius;
    p._r = 10 + (maxCite > 0 ? Math.min(18, (p._citeNum / maxCite) * 18) : 10);
  });

  // 绘制连线
  similarPapersData.forEach(function(p) {
    var line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', centerX);
    line.setAttribute('y1', centerY);
    line.setAttribute('x2', p._x);
    line.setAttribute('y2', p._y);
    line.setAttribute('stroke', '#E5E8EF');
    line.setAttribute('stroke-width', '1.5');
    line.setAttribute('stroke-opacity', '0.6');
    svg.appendChild(line);
  });

  // 绘制周围节点
  similarPapersData.forEach(function(p) {
    var g = document.createElementNS(svgNS, 'g');
    g.style.cursor = 'pointer';

    var circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', p._x);
    circle.setAttribute('cy', p._y);
    circle.setAttribute('r', p._r);
    circle.setAttribute('fill', '#1A56DB');
    circle.setAttribute('fill-opacity', '0.7');
    circle.setAttribute('stroke', '#1A56DB');
    circle.setAttribute('stroke-width', '1.5');
    g.appendChild(circle);

    var text = document.createElementNS(svgNS, 'text');
    text.setAttribute('x', p._x);
    text.setAttribute('y', p._y + p._r + 14);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '10');
    text.setAttribute('font-family', 'Noto Sans SC, sans-serif');
    text.setAttribute('fill', '#4B5563');
    var label = (p.title || '').substring(0, 12) + (p.title && p.title.length > 12 ? '...' : '');
    text.textContent = label;
    g.appendChild(text);

    // 悬停 tooltip
    g.addEventListener('mouseover', function() {
      var tooltip = document.getElementById('graphTooltip');
      if (tooltip) {
        tooltip.innerHTML = '<div style="font-weight:600;margin-bottom:4px;">' + escapeHtmlSafe(p.title) + '</div>'
          + '<div style="color:var(--text-mid);">' + escapeHtmlSafe(p.authors || '') + ' | ' + escapeHtmlSafe(p.venue || '') + '</div>'
          + '<div style="color:var(--brand-blue);margin-top:4px;">引用: ' + escapeHtmlSafe(p.citations || 'N/A') + ' | 相关度: ' + (p._relevance || 0) + '%</div>';
        tooltip.style.display = 'block';
        var svgRect = svg.getBoundingClientRect();
        tooltip.style.left = Math.max(10, svgRect.left + p._x - 80) + 'px';
        tooltip.style.top = Math.max(10, svgRect.top + p._y - p._r - 80) + 'px';
      }
    });
    g.addEventListener('mouseout', function() {
      var tooltip = document.getElementById('graphTooltip');
      if (tooltip) tooltip.style.display = 'none';
    });
    // 点击显示详情
    g.addEventListener('click', function() {
      var detail = document.getElementById('similarGraphDetail');
      if (detail) {
        detail.innerHTML = '<h4 style="font-size:14px;font-weight:600;margin-bottom:6px;color:var(--text-dark);">' + escapeHtmlSafe(p.title) + '</h4>'
          + '<p style="font-size:12px;color:var(--text-mid);margin-bottom:6px;">' + escapeHtmlSafe(p.authors || '') + ' | ' + escapeHtmlSafe(p.venue || '') + ' | ' + (p.year || '') + '</p>'
          + '<p style="font-size:12px;color:var(--text-mid);margin-bottom:6px;">引用量: ' + escapeHtmlSafe(p.citations || 'N/A') + ' | 相关度: ' + (p._relevance || 0) + '%</p>'
          + (p.abstract ? '<p style="font-size:12px;color:var(--text-mid);line-height:1.6;">' + escapeHtmlSafe(p.abstract.substring(0, 150)) + (p.abstract.length > 150 ? '...' : '') + '</p>' : '')
          + '<button onclick="openReadingFromEnhanced(\'' + p.id + '\')" style="margin-top:8px;padding:6px 12px;background:var(--brand-blue);color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;">阅读此论文</button>';
      }
    });

    svg.appendChild(g);
  });

  // 绘制中心节点（当前论文）
  var cg = document.createElementNS(svgNS, 'g');
  var glow = document.createElementNS(svgNS, 'circle');
  glow.setAttribute('cx', centerX);
  glow.setAttribute('cy', centerY);
  glow.setAttribute('r', centerRadius + 5);
  glow.setAttribute('fill', 'none');
  glow.setAttribute('stroke', '#F59E0B');
  glow.setAttribute('stroke-width', '2');
  glow.setAttribute('stroke-opacity', '0.3');
  cg.appendChild(glow);

  var cc = document.createElementNS(svgNS, 'circle');
  cc.setAttribute('cx', centerX);
  cc.setAttribute('cy', centerY);
  cc.setAttribute('r', centerRadius);
  cc.setAttribute('fill', '#F59E0B');
  cc.setAttribute('fill-opacity', '0.85');
  cc.setAttribute('stroke', '#F59E0B');
  cc.setAttribute('stroke-width', '2.5');
  cg.appendChild(cc);

  var ct = document.createElementNS(svgNS, 'text');
  ct.setAttribute('x', centerX);
  ct.setAttribute('y', centerY + 4);
  ct.setAttribute('text-anchor', 'middle');
  ct.setAttribute('font-size', '11');
  ct.setAttribute('font-weight', '600');
  ct.setAttribute('fill', '#fff');
  ct.textContent = '当前论文';
  cg.appendChild(ct);
  svg.appendChild(cg);
}

// ============================================================
// 12. 增强公式弹窗（扩展 openFormulaInterpretation）
// ============================================================

// 保存原函数引用
var _originalOpenFormula = window.openFormulaInterpretation;

/**
 * 扩展公式弹窗 —— 调用原函数设置基础内容，
 * 然后增加逐步解读、变量含义、物理意义、相关公式
 * 数据来源优先级：currentPaper.formulas > formulaDatabase
 */
window.openFormulaInterpretation = function(name) {
  // 调用原函数设置基础内容
  if (typeof _originalOpenFormula === 'function') {
    _originalOpenFormula(name);
  }
  currentFormulaName = name;

  // 优先从当前论文的完整数据中获取公式
  var data = (currentPaper && currentPaper.formulas && currentPaper.formulas[name])
    ? currentPaper.formulas[name]
    : formulaDatabase[name];
  if (!data) return;

  // 设置标题
  var titleEl = document.getElementById('formulaTitle');
  if (titleEl && data.title) titleEl.textContent = data.title;

  // 设置公式显示（用 display 字段或简化的 latex）
  var displayEl = document.getElementById('formulaDisplay');
  if (displayEl) {
    displayEl.innerHTML = data.display || data.latex || name;
  }

  // 逐步解读
  var stepEl = document.getElementById('formulaStepByStep');
  if (stepEl) {
    if (data.steps && data.steps.length) {
      stepEl.innerHTML = data.steps.map(function(s) {
        return '<div class="formula-step"><span class="step-num">' + s.num + '</span>' + escapeHtmlSafe(s.text) + '</div>';
      }).join('');
    } else if (data.stepByStep) {
      stepEl.innerHTML = data.stepByStep.map(function(s) {
        return '<p style="margin:6px 0;font-size:13px;line-height:1.7;">' + s + '</p>';
      }).join('');
    }
  }

  // 变量含义
  var varEl = document.getElementById('formulaVariables');
  if (varEl) {
    if (data.variables && data.variables.length) {
      varEl.innerHTML = data.variables.map(function(v) {
        return '<div class="formula-variable-row">'
          + '<span class="var-symbol">' + escapeHtmlSafe(v.symbol || v.name) + '</span>'
          + '<span class="var-desc">' + escapeHtmlSafe(v.desc) + '</span>'
          + '</div>';
      }).join('');
    }
  }

  // 物理意义
  var meaningEl = document.getElementById('formulaMeaning');
  if (meaningEl && data.meaning) {
    meaningEl.textContent = data.meaning;
  }

  // 相关公式
  var relatedSection = document.getElementById('formulaRelatedSection');
  var relatedEl = document.getElementById('formulaRelated');
  if (relatedSection && relatedEl) {
    if (data.related && data.related.length > 0) {
      relatedSection.style.display = 'block';
      relatedEl.innerHTML = data.related.map(function(r) {
        var rName = typeof r === 'string' ? r : r.name;
        var rDesc = typeof r === 'string' ? '' : (r.desc || '');
        return '<div class="formula-related-item" onclick="openFormulaInterpretation(\'' + rName + '\')">'
          + '<strong>' + escapeHtmlSafe(rName) + '</strong>'
          + (rDesc ? ' — ' + escapeHtmlSafe(rDesc) : '')
          + '</div>';
      }).join('');
    } else {
      relatedSection.style.display = 'none';
    }
  }
};

/** 复制当前公式的 LaTeX 代码到剪贴板 */
window.copyFormulaLatex = function() {
  var data = formulaDatabase[currentFormulaName];
  var latex = data ? data.latex : '';
  if (!latex) {
    showToastSafe('无可复制的 LaTeX', 'warning');
    return;
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(latex).then(function() {
      showToastSafe('LaTeX 已复制到剪贴板', 'success');
    }).catch(function() { fallbackCopy(latex); showToastSafe('LaTeX 已复制到剪贴板', 'success'); });
  } else {
    fallbackCopy(latex);
    showToastSafe('LaTeX 已复制到剪贴板', 'success');
  }
};

// ============================================================
// 13. 缩放和阅读模式
// ============================================================

/** 调整 PDF 内容字体大小 */
window.zoomPdf = function(delta) {
  readingZoomLevel = Math.max(0.5, Math.min(2.0, readingZoomLevel + delta));
  var wrap = document.getElementById('readingPdfInner');
  if (wrap) wrap.style.fontSize = (16 * readingZoomLevel) + 'px';
  var label = document.getElementById('pdfZoomLabel');
  if (label) label.textContent = Math.round(readingZoomLevel * 100) + '%';
};

/** 设置阅读模式（light/sepia/dark） */
window.setReadMode = function(mode) {
  document.documentElement.setAttribute('data-readmode', mode);
  lsSet('reading_readmode', mode);
};

// ============================================================
// 14. 键盘快捷键
// ============================================================

/**
 * 阅读页键盘快捷键处理
 * Ctrl+B: 目录 | Ctrl+/: AI面板 | Ctrl+F: 搜索
 * H: 高亮 | N: 笔记 | M: 书签 | T: 翻译 | ?: 帮助
 */
window.handleReadingShortcuts = function(e) {
  var tag = e.target.tagName;
  var isInput = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;

  // Ctrl / Cmd 组合键（输入框中也触发）
  if (e.ctrlKey || e.metaKey) {
    var key = e.key.toLowerCase();
    if (key === 'b') { e.preventDefault(); window.toggleLeftSidebar(); return; }
    if (e.key === '/') { e.preventDefault(); window.toggleRightSidebar(); return; }
    if (key === 'f') {
      e.preventDefault();
      window.switchLeftPanel('search');
      var si = document.getElementById('pdfSearchInput');
      if (si) si.focus();
      return;
    }
    return; // 其他 Ctrl 组合不处理
  }

  // 非 Ctrl 快捷键：焦点在输入框中时不触发
  if (isInput) return;

  switch (e.key) {
    case 'h': case 'H':
      if (getSelectedText()) window.addHighlight();
      break;
    case 'n': case 'N':
      window.openNoteEditor(null);
      break;
    case 'm': case 'M':
      window.addBookmark();
      break;
    case 't': case 'T':
      if (getSelectedText()) window.onPdfFloatAction('translate');
      break;
    case '?':
      window.showShortcutHelp();
      break;
  }
};

// ============================================================
// 15. 快捷键帮助弹窗
// ============================================================

/** 显示快捷键帮助弹窗 */
window.showShortcutHelp = function() {
  var overlay = document.getElementById('shortcutOverlayEnhanced');
  if (overlay) overlay.classList.add('active');
};

/** 关闭快捷键帮助弹窗 */
window.closeShortcutHelp = function() {
  var overlay = document.getElementById('shortcutOverlayEnhanced');
  if (overlay) overlay.classList.remove('active');
};

// ============================================================
// 16. 阅读进度和统计
// ============================================================

/** 绑定滚动事件（进度条 + 大纲高亮） */
function bindScrollEvents() {
  var pdfEl = document.getElementById('readingPdf');
  if (!pdfEl) return;
  pdfEl.addEventListener('scroll', function() {
    updateReadingProgress();
    updateOutlineHighlight();
  });
}

/** 更新阅读进度条和进度文字 */
function updateReadingProgress() {
  var pdfEl = document.getElementById('readingPdf');
  if (!pdfEl) return;
  var scrollTop = pdfEl.scrollTop;
  var scrollHeight = pdfEl.scrollHeight - pdfEl.clientHeight;
  var pct = scrollHeight > 0 ? Math.min(100, Math.round((scrollTop / scrollHeight) * 100)) : 0;

  var fill = document.getElementById('readingProgressFill');
  if (fill) fill.style.width = pct + '%';

  var progressText = document.getElementById('progressText');
  if (progressText) progressText.textContent = pct + '%';
}

/** 启动阅读计时器（每秒更新） */
function startReadingTimer() {
  if (readingTimerInterval) clearInterval(readingTimerInterval);
  readingTimerInterval = setInterval(function() {
    readingTimerSeconds++;
    updatePdfStats();
  }, 1000);
}

/** 更新 PDF 统计信息（阅读时长 + 字数） */
function updatePdfStats() {
  var el = document.getElementById('pdfStats');
  if (!el) return;
  var minutes = Math.floor(readingTimerSeconds / 60);
  var wrap = document.getElementById('readingPdfInner');
  var wordCount = 0;
  if (wrap) {
    wordCount = wrap.textContent.replace(/\s+/g, '').length;
  }
  el.textContent = '阅读 ' + minutes + ' 分钟 · ' + wordCount + ' 字';
}

// ============================================================
// 17. 导出笔记为 Markdown
// ============================================================

/** 将所有高亮和笔记导出为 Markdown 格式文件 */
window.exportReadingNotes = function() {
  if (!currentPaper) {
    showToastSafe('未找到论文信息', 'warning');
    return;
  }

  var md = '# 论文阅读笔记\n\n';
  md += '**论文标题：** ' + (currentPaper.title || '未知') + '\n';
  md += '**作者：** ' + (currentPaper.authors || '') + '\n';
  md += '**发表：** ' + (currentPaper.venue || '') + '\n';
  if (currentPaper.year) md += '**年份：** ' + currentPaper.year + '\n';
  md += '**导出时间：** ' + new Date().toLocaleString() + '\n\n';
  md += '---\n\n';

  if (readingHighlights.length === 0 && readingNotes.length === 0) {
    md += '*暂无高亮和笔记*\n';
  } else {
    // 高亮与关联笔记
    if (readingHighlights.length > 0) {
      md += '## 高亮与笔记\n\n';
      readingHighlights.forEach(function(hl, i) {
        var time = new Date(hl.createdAt).toLocaleString();
        md += '### ' + (i + 1) + '. 高亮内容\n\n';
        md += '> ' + hl.text + '\n\n';
        md += '- 颜色：' + hl.color + '\n';
        if (hl.section) md += '- 章节：' + hl.section + '\n';
        md += '- 创建时间：' + time + '\n';
        // 查找关联笔记
        var note = readingNotes.find(function(n) { return n.highlightId === hl.id; });
        if (note) {
          md += '\n**笔记：**\n\n' + note.content + '\n';
        }
        md += '\n---\n\n';
      });
    }

    // 独立笔记（不关联高亮）
    var standaloneNotes = readingNotes.filter(function(n) { return !n.highlightId; });
    if (standaloneNotes.length > 0) {
      md += '## 独立笔记\n\n';
      standaloneNotes.forEach(function(n, i) {
        md += '### 笔记 ' + (i + 1) + '\n\n';
        md += n.content + '\n\n';
        md += '---\n\n';
      });
    }

    // 书签
    if (readingBookmarks.length > 0) {
      md += '## 书签\n\n';
      readingBookmarks.forEach(function(bm, i) {
        md += (i + 1) + '. ' + bm.title + '（' + new Date(bm.createdAt).toLocaleString() + '）\n';
      });
      md += '\n';
    }
  }

  // 下载文件
  var blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = (currentPaper.title || '论文') + '_阅读笔记.md';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToastSafe('笔记已导出', 'success');
};

// ============================================================
// 18. rpageSwitchAiTab 扩展（调用对应渲染函数）
// ============================================================

// 保存原函数引用（如果存在）
var _originalRpageSwitchAiTab = window.rpageSwitchAiTab;

/**
 * 扩展 AI Tab 切换 —— 调用原函数（如有）+ 调用对应渲染函数
 * 确保 HTML onclick="rpageSwitchAiTab(this,'summary')" 能正常工作
 */
window.rpageSwitchAiTab = function(el, tab) {
  // 调用原函数（如果存在）
  if (typeof _originalRpageSwitchAiTab === 'function') {
    _originalRpageSwitchAiTab(el, tab);
  } else {
    // 原函数不存在，手动切换 tab 样式
    document.querySelectorAll('.rpage-ai-tab').forEach(function(t) { t.classList.remove('active'); });
    if (el) el.classList.add('active');
  }

  // 调用对应的渲染函数
  switch (tab) {
    case 'summary': renderAiSummary(); break;
    case 'novelty': renderAiNovelty(); break;
    case 'experiment': renderAiExperiment(); break;
    case 'qa': renderAiQa(); break;
    case 'translate': renderAiTranslate(); break;
  }
};
