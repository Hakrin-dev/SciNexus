/**
 * ai-chat.js — AI 对话系统与文档编辑器
 *
 * 职责：管理对话历史、发送 AI 消息（流式/非流式）、渲染消息、文档编辑与导出、投稿顾问对话
 * 包含模块：九、AI 对话系统；十、投稿分析与期刊渲染中的投稿对话部分；
 *           十四、PDF 渲染中的流式强化版 sendAiMessageStream；
 *           十八、AI 编辑器与模式切换；话题快捷卡片逻辑
 */

// 全局数据状态 —— AI 对话历史
let conversations = [];

// 话题卡片 -> 显式模块意图（与后端 supervisor INTENT_TABLE 对齐）。
// 传显式 task_type 后后端走 forced_decision 确定性路由，弱模型也不会误调 agent。
// 未映射的话题（experiment_compare / method_design）保持 null，由 Supervisor 按模块白名单约束。
const TASK_TYPE_BY_TOPIC = {
  literature_review: 'literature_review',
  paper_polish: 'ai_writing',
  paper_explain: 'ai_reading',
  submission_advice: 'submission',
  code_help: 'code_generation',
  research_trend: 'research_exploration',
};

/**
 * 处理预设话题点击 —— 构建定制化提示词发送给 DeepSeek
 * @param {string} topic - 预设话题标识符
 */
function pickTopic(topic) {
  currentAiTaskType = TASK_TYPE_BY_TOPIC[topic] || null;
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
 * 渲染左侧对话历史列表 —— 高亮当前激活的对话
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
// 投稿顾问对话（来自原"十、投稿分析与期刊渲染"章节）
// ============================================================

/**
 * 发送投稿对话消息 —— 流式调用 DeepSeek，实时显示 + Markdown 排版
 */
let subChatHistory = [];

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
      ...subChatHistory,
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
    // 保存对话上下文
    subChatHistory.push({ role: 'user', content: text });
    subChatHistory.push({ role: 'assistant', content: fullReply });
    if (subChatHistory.length > 20) subChatHistory = subChatHistory.slice(-20);
  } catch(err) {
    console.error('投稿对话 DeepSeek API 错误:', err);
    aiBubble.innerHTML = renderMdInline('**AI投稿顾问**\n\n⚠️ 服务暂时不可用：' + (err.message || '未知错误') + '\n\n请稍后重试。');
  }

  container.scrollTop = container.scrollHeight;
}

/**
 * 自动发送预设投稿消息
 */
function sendSubChatAuto(msg) {
  const input = $('subChatInput');
  if (input) { input.value = msg; sendSubChat(); }
}

function shouldSyncReplyToEditor(userText, reply) {
  const content = reply || '';
  return /##\s*生成文件[\s\S]*###\s*`[^`]+`[\s\S]*```/i.test(content);
}

function parseGeneratedFiles(reply) {
  const files = [];
  const re = /###\s*`([^`]+)`\s*\n```([\w-]*)\n([\s\S]*?)```/g;
  let match;
  while ((match = re.exec(reply || '')) !== null) {
    files.push({
      path: match[1],
      language: match[2] || 'text',
      content: match[3] || ''
    });
  }
  return files;
}

function stripGeneratedFilesForChat(reply) {
  const files = parseGeneratedFiles(reply);
  if (!files.length) return reply;
  const beforeFiles = String(reply || '').split(/\n##\s*生成文件/i)[0].trim();
  const list = files.map(file => '- `' + file.path + '`').join('\n');
  return beforeFiles + '\n\n## 已生成文件\n' + list + '\n\n文件内容已放入右侧文件编辑区。';
}

function syncGeneratedReplyToEditor(userText, reply) {
  if (!shouldSyncReplyToEditor(userText, reply)) return;
  const files = parseGeneratedFiles(reply);
  if (files.length) writeFilesToEditor(files);
}

// ============================================================
// SSE 流式强化版 sendAiMessage（来自原"十四、PDF 渲染与引用导出"章节）
// ============================================================

let currentAiTaskType = null;

function getCurrentAiTaskType() {
  return currentAiTaskType;
}

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
      const streamBody = await deepseekChat(deepseekMsgs, true, { taskType: getCurrentAiTaskType() });
      const reader = streamBody.getReader();
      const decoder = new TextDecoder();
      let fullReply = '';
      let buffer = '';
      let currentEvent = 'message';

      const container = document.getElementById('aiMessages');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留不完整的行

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed.startsWith('event: ')) {
            currentEvent = trimmed.slice(7);
            continue;
          }
          if (!trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          try {
            const json = JSON.parse(data);
            if (currentEvent === 'meta') {
              window.lastAgentWorkflow = json.workflow || null;
              currentEvent = 'message';
              continue;
            }
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

      msgs[aiMsgIdx] = { type: 'ai', text: stripGeneratedFilesForChat(fullReply) };
      renderMessages(msgs);
      syncGeneratedReplyToEditor(text, fullReply);

    } catch(streamErr) {
      console.warn('流式调用失败，降级为非流式:', streamErr);
      // 降级为非流式调用
      const reply = await deepseekChat(deepseekMsgs, false, { taskType: getCurrentAiTaskType() });
      msgs[aiMsgIdx] = { type: 'ai', text: stripGeneratedFilesForChat(reply) };
      renderMessages(msgs);
      syncGeneratedReplyToEditor(text, reply);
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

function escapeEditorHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatEditorInline(text) {
  return escapeEditorHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`\n]+?)`/g, '<code class="md-inline-code">$1</code>');
}

function renderEditorText(markdown) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let html = '';
  let paragraph = [];
  let listOpen = false;

  function flushParagraph() {
    if (!paragraph.length) return;
    html += '<p>' + paragraph.map(formatEditorInline).join('<br/>') + '</p>';
    paragraph = [];
  }
  function closeList() {
    if (listOpen) {
      html += '</ul>';
      listOpen = false;
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      closeList();
      continue;
    }
    if (trimmed.startsWith('### ')) {
      flushParagraph();
      closeList();
      html += '<h3>' + formatEditorInline(trimmed.slice(4)) + '</h3>';
    } else if (trimmed.startsWith('## ')) {
      flushParagraph();
      closeList();
      html += '<h2>' + formatEditorInline(trimmed.slice(3)) + '</h2>';
    } else if (trimmed.startsWith('# ')) {
      flushParagraph();
      closeList();
      html += '<h1>' + formatEditorInline(trimmed.slice(2)) + '</h1>';
    } else if (/^[-*]\s+/.test(trimmed)) {
      flushParagraph();
      if (!listOpen) {
        html += '<ul>';
        listOpen = true;
      }
      html += '<li>' + formatEditorInline(trimmed.replace(/^[-*]\s+/, '')) + '</li>';
    } else {
      paragraph.push(line);
    }
  }
  flushParagraph();
  closeList();
  return html;
}

function renderEditorMarkdown(md) {
  const source = String(md || '');
  const parts = [];
  const codeRe = /```([\w-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  while ((match = codeRe.exec(source)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: source.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'code', language: match[1] || 'text', value: match[2] || '' });
    lastIndex = codeRe.lastIndex;
  }
  if (lastIndex < source.length) {
    parts.push({ type: 'text', value: source.slice(lastIndex) });
  }
  return parts.map(part => {
    if (part.type === 'code') {
      return '<pre style="background:#1E293B;color:#E2E8F0;padding:12px;border-radius:8px;font-family:monospace;font-size:12px;white-space:pre-wrap;overflow:auto;"><code>' +
        escapeEditorHtml(part.value) +
        '</code></pre>';
    }
    return renderEditorText(part.value);
  }).join('');
}

function renderFileContent(file) {
  const language = (file.language || 'text').toLowerCase();
  if (language === 'markdown' || language === 'md') {
    return '<div class="generated-file-document">' + renderEditorMarkdown(file.content) + '</div>';
  }
  return '<pre style="background:#1E293B;color:#E2E8F0;padding:12px;border-radius:8px;font-family:monospace;font-size:12px;white-space:pre-wrap;overflow:auto;"><code>' +
    escapeEditorHtml(file.content) +
    '</code></pre>';
}

let generatedEditorFiles = [];
let activeGeneratedFileIndex = 0;

function generatedFileName(path) {
  return String(path || 'untitled.txt').split('/').pop();
}

function renderGeneratedFileTabs(files, activeIndex) {
  return '<div class="generated-file-tabs" contenteditable="false">' + files.map((file, index) => {
    const active = index === activeIndex ? ' active' : '';
    return '<button class="generated-file-tab' + active + '" type="button" onclick="selectGeneratedFile(' + index + ')" title="' +
      escapeEditorHtml(file.path) +
      '">' +
      '<span class="generated-file-name">' + escapeEditorHtml(generatedFileName(file.path)) + '</span>' +
      '<span class="generated-file-type">' + escapeEditorHtml(file.language || 'text') + '</span>' +
      '</button>';
  }).join('') + '</div>';
}

function renderGeneratedFileWorkspace(files, activeIndex) {
  const file = files[activeIndex] || files[0];
  if (!file) {
    return '<div class="generated-file-empty">暂无生成文件</div>';
  }
  return renderGeneratedFileTabs(files, activeIndex) +
    '<section class="generated-file-view">' +
    '<div class="generated-file-path" contenteditable="false"><code>' + escapeEditorHtml(file.path) + '</code></div>' +
    '<div class="generated-file-content">' + renderFileContent(file) + '</div>' +
    '</section>';
}

function selectGeneratedFile(index) {
  if (!generatedEditorFiles.length || index < 0 || index >= generatedEditorFiles.length) return;
  activeGeneratedFileIndex = index;
  const body = document.getElementById('aiEditorBody');
  if (!body) return;
  body.innerHTML = '<div class="md-content generated-file-workspace">' +
    renderGeneratedFileWorkspace(generatedEditorFiles, activeGeneratedFileIndex) +
    '</div>';
  const file = generatedEditorFiles[activeGeneratedFileIndex];
  document.getElementById('aiEditorStatusLabel').textContent = '正在编辑: ' + generatedFileName(file.path);
  document.getElementById('aiEditorWordCount').textContent = body.textContent.replace(/\s/g,'').length + ' 字';
}

function writeFilesToEditor(files) {
  const body = document.getElementById('aiEditorBody');
  if (!body) return;
  generatedEditorFiles = files;
  activeGeneratedFileIndex = 0;
  body.innerHTML = '<div class="md-content generated-file-workspace">' +
    renderGeneratedFileWorkspace(generatedEditorFiles, activeGeneratedFileIndex) +
    '</div>';
  document.getElementById('aiEditorTitle').textContent = '📁 生成文件 (' + files.length + ')';
  document.getElementById('aiEditorStatusLabel').textContent = '正在编辑: ' + generatedFileName(files[0]?.path);
  document.getElementById('aiEditorWordCount').textContent = body.textContent.replace(/\s/g,'').length + ' 字';
  showToast('生成文件已放入右侧编辑区', 'success');
}

/** 将 Markdown 内容写入 AI 编辑器 */
function writeToEditor(md) {
  const body = document.getElementById('aiEditorBody');
  if (!body) return;
  body.innerHTML = '<div class="md-content">' + renderEditorMarkdown(md) + '</div>';
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
  currentAiTaskType = mode.includes('自动科研') ? 'autonomous_research' : null;
  showToast(mode.includes('对话') ? '💬 对话模式' : '🤖 自动科研模式——AI将自主完成检索、分析、撰写全流程', 'info');
}
