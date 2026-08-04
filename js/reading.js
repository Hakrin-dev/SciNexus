/**
 * reading.js — 论文阅读面板、收藏系统、引文图谱、PDF渲染、引用导出
 *
 * 职责：论文阅读浮层、收藏管理、公式解读、引文网络可视化、词云、
 *       PDF.js 集成、阅读进度追踪、引用导出与分享
 * 包含模块：八、收藏系统；十二、论文阅读面板；十三、引文图谱与词云；
 *           十四、PDF 渲染与引用导出（不含 sendAiMessageStream）；
 *           阅读进度追踪与 renderLibrary 增强（来自原"二十一、初始化入口"章节）
 */

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
// 十二、论文阅读面板
// ============================================================

/**
 * 打开论文阅读面板 —— 动态填充标题、摘要、元数据并加载阅读进度
 *
 * 路由策略：
 *   - 在首页（index.html）点击时，跳转到独立全屏阅读页 reading.html?id=xxx
 *   - 在阅读页（reading.html）内部时，触发页面内容重载
 *
 * @param {string} id - 论文 ID
 */
function openReading(id) {
  // 当前不在独立阅读页 → 跳转到全屏阅读页
  if (!window.location.pathname.includes('reading.html')) {
    window.location.href = 'reading.html?id=' + encodeURIComponent(id);
    return;
  }

  // 以下是 reading.html 独立页内的原逻辑（保留兼容）
  const paper = papers.find(p => p.id === id) || libraryPapers.find(p => p.id === id);
  if (!paper) { showToast('未找到论文：'+id, 'warning'); return; }
  
  // 设置标题和元数据
  const titleEl = document.getElementById('readingTitle');
  if (titleEl) {
    titleEl.textContent = paper.title;
    titleEl.dataset.paperId = id;
  }
  const pdfTitle = document.getElementById('pdfDetailTitle');
  if (pdfTitle) pdfTitle.textContent = paper.title;
  const pdfMeta = document.getElementById('pdfDetailMeta');
  if (pdfMeta) pdfMeta.innerHTML = paper.authors + ' | ' + paper.venue + '<br>引用数: ' + paper.citations + ' | 年份: ' + (paper.year||'N/A');
  
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
  
  // 显示阅读覆盖层（仅首页抽屉模式使用，全屏页此元素不存在则跳过）
  const overlay = document.getElementById('readingOverlay');
  if (overlay) {
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  
  // 重置到 PDF 标签页
  const pdfTab = document.querySelector('.reading-tab');
  if (pdfTab) switchReadingTab(pdfTab, 'pdf');
}

/** 关闭阅读面板 */
function closeReading() {
  saveReadingProgress();
  const overlay = document.getElementById('readingOverlay');
  if (overlay) {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
}

/**
 * 切换阅读面板标签（PDF / AI  / 相似论文）
 */
function switchReadingTab(el, tab) {
  document.querySelectorAll('.reading-tab, .reading-nav-tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  if (tab === 'similar') {
    document.getElementById('readingPdf').style.display = 'none';
    document.getElementById('readingAi').style.width = '100%';
    document.getElementById('readingAiContent').innerHTML = '<h4 style="font-size:14px;font-weight:600;margin-bottom:8px;">引文网络关系图谱</h4><p style="font-size:12px;color:var(--text-light);margin-bottom:12px;">节点大小=引用量 | 颜色=研究方向 | 连线=引用关系</p><svg id="citationGraph" width="100%" height="480" style="background:var(--bg-hover);border-radius:8px;border:1px solid var(--border-light, #E5E7EB);"></svg><div id="graphTooltip" style="position:absolute;display:none;background:var(--bg-card);border:1px solid var(--border-light, #E5E7EB);border-radius:8px;padding:12px;box-shadow:var(--shadow-lg);font-size:12px;z-index:5000;pointer-events:none;"></div>';
    setTimeout(initCitationGraph, 100);
    // 取消 AI 子标签选中状态
    document.querySelectorAll('.reading-ai-tab, .rpage-ai-tab').forEach(t => t.classList.remove('active'));
  } else if (tab === 'ai') {
    document.getElementById('readingPdf').style.display = '';
    const aiPanel = document.querySelector('.reading-ai') || document.querySelector('.reading-right');
    if (aiPanel) aiPanel.style.width = '';
    // 重置到摘要子标签
    const summaryTab = document.querySelector('.reading-ai-tab[onclick*="summary"], .rpage-ai-tab[onclick*="summary"]');
    if (summaryTab) switchReadingAiTab(summaryTab, 'summary');
  } else {
    document.getElementById('readingPdf').style.display = '';
    const aiPanel = document.querySelector('.reading-ai') || document.querySelector('.reading-right');
    if (aiPanel) aiPanel.style.width = '';
  }
}

/**
 * 切换 AI 阅读子标签（速读/创新点/实验/问答/翻译/相似论文）
 */
function switchReadingAiTab(el, tab) {
  document.querySelectorAll('.reading-ai-tab, .rpage-ai-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');

  // 获取当前论文数据，动态生成内容
  const paperId = document.getElementById('readingTitle')?.dataset.paperId;
  const paper = papers.find(p => p.id === paperId) || libraryPapers.find(p => p.id === paperId) || {};
  const keywords = paper.keywords || [];
  const keywordsHtml = keywords.map(k => '<span style="padding:2px 10px;background:#EFF6FF;border-radius:12px;font-size:11px;color:var(--brand-blue);">'+escapeHtml(k)+'</span>').join('');

  const contents = {
    summary: '<div class="ai-reading-summary">'
      + '<h4 style="font-size:15px;font-weight:700;margin-bottom:14px;color:var(--text-dark);border-bottom:2px solid var(--brand-blue);padding-bottom:6px;">AI 速读 / AI Quick Read</h4>'
      + '<p class="zh"><strong>论文摘要</strong></p>'
      + '<p class="zh">' + escapeHtml(paper.abstract || '暂无摘要') + '</p>'
      + (keywords.length ? '<div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:6px;">' + keywordsHtml + '</div>' : '')
      + '<p class="zh" style="margin-top:16px;"><strong>基本信息</strong></p>'
      + '<ul style="padding-left:16px;margin-top:6px;font-size:13px;color:var(--text-mid);">'
      + '<li>作者：' + escapeHtml(paper.authors || '未知') + '</li>'
      + '<li>发表：' + escapeHtml(paper.venue || '未知') + '</li>'
      + '<li>引用数：' + escapeHtml(paper.citations || 'N/A') + '</li>'
      + '<li>CCF 等级：' + escapeHtml(paper.ccf || 'N/A') + '</li>'
      + '</ul>'
      + '</div>',
    novelty: '<h4 style="font-size:14px;font-weight:600;margin-bottom:8px;color:var(--text-dark);">创新点分析</h4>'
      + '<p><strong>核心关键词：</strong></p>'
      + (keywords.length ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;">' + keywordsHtml + '</div>' : '<p style="color:var(--text-light);">暂无关键词信息</p>')
      + '<p style="margin-top:12px;"><strong>潜在创新方向：</strong></p>'
      + '<ul style="padding-left:16px;margin-top:6px;">'
      + (keywords.length ? keywords.slice(0, 3).map(k => '<li>'+escapeHtml(k)+' 相关的方法创新</li>').join('') : '<li>请阅读论文了解详细创新点</li>')
      + '</ul>'
      + '<p style="margin-top:12px;color:var(--text-light);font-size:12px;">提示：点击"问答"标签，向 AI 提问获取更深入的创新点分析。</p>',
    experiment: '<h4 style="font-size:14px;font-weight:600;margin-bottom:8px;color:var(--text-dark);">实验分析</h4>'
      + '<p><strong>发表信息：</strong></p>'
      + '<ul style="padding-left:16px;margin-top:6px;">'
      + '<li>会议/期刊：' + escapeHtml(paper.venue || '未知') + '</li>'
      + '<li>年份：' + escapeHtml((paper.year || 'N/A').toString()) + '</li>'
      + '<li>引用数：' + escapeHtml(paper.citations || 'N/A') + '</li>'
      + '</ul>'
      + '<p style="margin-top:12px;color:var(--text-light);font-size:12px;">提示：如需详细实验数据分析，请使用 AI 问答功能。</p>',
    qa: '<h4 style="font-size:14px;font-weight:600;margin-bottom:8px;color:var(--text-dark);">问答</h4>'
      + '<p>您可以在此询问关于「' + escapeHtml(paper.title || '当前论文') + '」的问题，AI 将基于论文上下文进行回答。</p>'
      + '<p style="color:var(--text-light);margin-top:8px;">示例问题：</p>'
      + '<ul style="padding-left:16px;margin-top:6px;color:var(--text-mid);">'
      + '<li>这篇论文的核心方法是什么？</li>'
      + '<li>论文中使用了哪些数据集？</li>'
      + '<li>该方法相比之前的工作有哪些优势？</li>'
      + '</ul>',
    translate: '<h4 style="font-size:14px;font-weight:600;margin-bottom:8px;color:var(--text-dark);">翻译</h4>'
      + '<p>选择论文中的文本段落，即可查看中文翻译。</p>'
      + '<p style="color:var(--text-mid);margin-top:8px;">选中 PDF 中的文字后，点击工具栏中的"翻译"按钮。</p>'
      + (paper.title ? '<div style="margin-top:16px;padding:12px;background:var(--bg-hover);border-radius:8px;"><strong>标题翻译：</strong><br>' + escapeHtml(paper.title) + '</div>' : '')
  };
  const contentDiv = document.getElementById('readingAiContent');
  if (tab === 'similar') {
    // 动态推荐相似论文 —— 按关键词匹配度排序
    let similarPapers = [];
    if (keywords.length > 0) {
      similarPapers = papers
        .filter(p => p.id !== paperId)
        .map(p => ({ id: p.id, title: p.title, authors: p.authors, venue: p.venue, _overlap: (p.keywords || []).filter(k => keywords.includes(k)).length }))
        .filter(p => p._overlap > 0)
        .sort((a, b) => b._overlap - a._overlap)
        .slice(0, 3);
    }
    if (similarPapers.length < 3) {
      var existing = similarPapers.map(s => s.id);
      var fallback = papers
        .filter(p => p.id !== paperId && !existing.includes(p.id))
        .filter(p => !paper.ccf || p.ccf === paper.ccf)
        .slice(0, 3 - similarPapers.length)
        .map(p => ({ id: p.id, title: p.title, authors: p.authors, venue: p.venue, _overlap: 0 }));
      similarPapers = similarPapers.concat(fallback);
    }
    if (similarPapers.length === 0) {
      similarPapers = papers.filter(p => p.id !== paperId).slice(0, 3).map(p => ({ id: p.id, title: p.title, authors: p.authors, venue: p.venue, _overlap: 0 }));
    }
    let html = '<h4 style="font-size:14px;font-weight:600;margin-bottom:12px;color:var(--text-dark);">相似论文推荐</h4><div class="similar-grid">';
    similarPapers.forEach(sp => {
      var tagLabel = sp._overlap > 0 ? sp._overlap + ' 个共同关键词' : '同领域';
      html += '<div class="similar-card" onclick="event.stopPropagation();openReading(\''+sp.id+'\')">'
        + '<div class="similar-card-title">'+escapeHtml(sp.title)+'</div>'
        + '<div class="similar-card-meta">'+escapeHtml(sp.authors)+' | '+escapeHtml(sp.venue)+'</div>'
        + '<span class="similar-card-tag">'+tagLabel+'</span>'
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
  const tab = document.querySelector(`.reading-ai-tab[onclick*="${tabMap[action]}"], .rpage-ai-tab[onclick*="${tabMap[action]}"]`);
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
  document.querySelectorAll('.reading-ai-tab, .rpage-ai-tab').forEach(t => t.classList.remove('active'));
  const qaTab = document.querySelector('.reading-ai-tab[onclick*="qa"], .rpage-ai-tab[onclick*="qa"]');
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

/** 从阅读弹窗跳转到引用图谱 */
function openGraphFromReading() {
  var paperId = '';
  var titleEl = document.getElementById('readingTitle');
  if (titleEl) paperId = titleEl.dataset.paperId || '';
  // 关闭阅读弹窗（首页抽屉模式）
  var overlay = document.getElementById('readingOverlay');
  if (overlay) {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
  // 跳转到图谱
  if (paperId) {
    openGraphForPaper(paperId);
  } else {
    showToast('未找到论文ID，无法打开图谱', 'warning');
  }
}


// ============================================================
// 阅读进度追踪（来自原"二十一、初始化入口"章节）
// ============================================================

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
