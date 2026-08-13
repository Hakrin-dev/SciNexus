/**
 * library.js — 个人文献库管理
 *
 * 职责：文献库渲染、文件夹/标签筛选、排序、批量操作、统计弹窗
 * 包含模块：十一、文献库管理；十七、日历与统计弹窗中的统计弹窗部分
 */

// 全局数据状态 —— 个人文献库
let libraryPapers = [];

// ============================================================
// 十一、文献库管理
// ============================================================

/**
 * 渲染文献库列表 —— 支持搜索过滤、阅读状态和进度条展示
 */
// 文献库筛选状态
let libSelectedFolder = 'all';
let libSelectedTags = [];

function renderLibrary() {
  const searchTerm = ($('libSearch')?.value || '').toLowerCase();
  let filtered = libraryPapers;
  if (searchTerm) {
    filtered = filtered.filter(p => p.title.toLowerCase().includes(searchTerm) || p.authors.toLowerCase().includes(searchTerm) || (p.tags||[]).some(t=>t.toLowerCase().includes(searchTerm)));
  }
  if (libSelectedFolder !== 'all') {
    filtered = filtered.filter(p => (p.folder || '未分类') === libSelectedFolder);
  }
  if (libSelectedTags.length > 0) {
    filtered = filtered.filter(p => libSelectedTags.some(tag => (p.tags||[]).includes(tag)));
  }
  const list = document.getElementById('libList');
  if (!list) return;
  list.innerHTML = '';
  if (filtered.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-light);">未找到匹配的文献</div>';
    return;
  }
  filtered.forEach((p) => {
    const realIdx = libraryPapers.indexOf(p);
    const div = document.createElement('div');
    div.className = 'lib-item';
    div.dataset.index = realIdx;
    const statusTitle = p.status === 'read' ? '已读' : p.status === 'reading' ? '在读' : '未读';
    const tagsHtml = (p.tags||[]).map(t => '<span class="tag-item">'+escapeHtml(t)+'</span>').join('');
    const progressHtml = p.status === 'reading' ? '<div class="lib-item-progress"><div class="progress-bar"><div class="progress-fill" style="width:'+p.progress+'%"></div></div><span class="progress-text">'+p.progress+'%</span></div>' : '';
    const ccfClass = p.ccf === '预印本' ? 'level-none' : 'level-'+p.ccf.toLowerCase();
    div.innerHTML = '<input type="checkbox" class="lib-item-checkbox" onchange="updateBatchBar()" onclick="event.stopPropagation()">' +
      '<span class="read-status '+p.status+'" title="'+statusTitle+'"></span>' +
      '<span class="ccf-badge '+ccfClass+'">'+(p.ccf==='预印本'?'预印本':'CCF-'+p.ccf)+'</span>' +
      '<div class="lib-item-info"><div class="lib-item-title">'+escapeHtml(p.title)+'</div><div class="lib-item-authors">'+escapeHtml(p.authors)+' | '+escapeHtml(p.venue)+'</div><div class="lib-item-tags">'+tagsHtml+'</div><div class="lib-item-venue" style="font-size:11px;color:var(--text-light);margin-top:2px;">收藏于 '+escapeHtml(p.collected)+'</div></div>' +
      progressHtml +
      '<div class="lib-item-actions"><button class="btn-action" onclick="event.stopPropagation();openReading(\''+p.id+'\')">阅读</button><button class="btn-action" onclick="event.stopPropagation();openGraphForPaper(\''+p.id+'\')">引用图谱</button><button class="btn-action" onclick="event.stopPropagation();editLibItem('+realIdx+')">编辑</button></div>';
    // 点击整张卡片 → 打开阅读面板（按钮区域和复选框除外，由各自的 onclick 处理）
    div.addEventListener('click', function(e) {
      if (e.target.closest('.lib-item-actions, .lib-item-checkbox')) return;
      openReading(p.id);
    });
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

/** 选择文件夹 —— 过滤文献库列表 */
function selectFolder(el) {
  document.querySelectorAll('.folder-item').forEach(f=>f.classList.remove('active'));
  el.classList.add('active');
  libSelectedFolder = el.dataset.folder || el.textContent.trim().replace(/\(\d+\)/,'').trim() || 'all';
  renderLibrary();
}
/** 切换标签选中状态 —— 多选过滤 */
function selectLibTag(el) {
  el.classList.toggle('active');
  const tag = el.textContent.trim();
  if (el.classList.contains('active')) {
    if (!libSelectedTags.includes(tag)) libSelectedTags.push(tag);
  } else {
    libSelectedTags = libSelectedTags.filter(t => t !== tag);
  }
  renderLibrary();
}

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
    sorted.sort(function(a,b) {
      var ca = parseInt((a.citations||'0').replace(/[,+]/g,''));
      var cb = parseInt((b.citations||'0').replace(/[,+]/g,''));
      return cb - ca;
    });
  } else if (val.includes('收藏时间')) {
    sorted.sort(function(a,b) {
      return (b.collected||'').localeCompare(a.collected||'');
    });
  }
  libraryPapers = sorted;
  renderLibrary();
}

// ===== 批量操作 =====

/** 批量移动文献到文件夹 */
function batchMove() {
  const checked = $$('#libList .lib-item-checkbox:checked');
  if (checked.length === 0) return showToast('请先选择文献', 'warning');
  const folder = prompt('请输入目标文件夹名称（毕设/课程/综述/待读/未分类）：', '毕设');
  if (!folder) return;
  checked.forEach(cb => {
    const idx = parseInt(cb.closest('.lib-item').dataset.index);
    if (libraryPapers[idx]) libraryPapers[idx].folder = folder;
  });
  renderLibrary();
  showToast('已将 ' + checked.length + ' 篇文献移动到「' + folder + '」', 'success');
}
/** 批量添加标签 */
function batchTag() {
  const checked = $$('#libList .lib-item-checkbox:checked');
  if (checked.length === 0) return showToast('请先选择文献', 'warning');
  const tag = prompt('请输入要添加的标签：', '精读');
  if (!tag) return;
  checked.forEach(cb => {
    const idx = parseInt(cb.closest('.lib-item').dataset.index);
    if (libraryPapers[idx]) {
      if (!libraryPapers[idx].tags) libraryPapers[idx].tags = [];
      if (!libraryPapers[idx].tags.includes(tag)) libraryPapers[idx].tags.push(tag);
    }
  });
  renderLibrary();
  showToast('已为 ' + checked.length + ' 篇文献添加标签「' + tag + '」', 'success');
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
// 文献库统计弹窗（来自原"十七、日历与统计弹窗"章节）
// ============================================================

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
