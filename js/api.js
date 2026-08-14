/**
 * api.js — API 通信层与 DeepSeek AI 对话引擎
 *
 * 职责：封装后端 API 请求、管理请求缓存、调用 DeepSeek AI 对话接口
 * 包含模块：二、API 通信层；三、DeepSeek AI 对话引擎
 */

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
    const hasBody = Object.prototype.hasOwnProperty.call(options, 'body');
    const body = hasBody && typeof options.body === 'string'
      ? options.body
      : hasBody
        ? JSON.stringify(options.body)
        : undefined;
    const res = await fetch(`${API}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
      body
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

/**
 * 获取论文知识图谱数据
 * 后端返回结构：{ originPaper, priorWorks, derivativeWorks, nodes, links }
 * @param {string} paperId - 中心论文ID
 * @returns {Promise<object|null>} 图谱数据，失败时返回 null
 */
async function fetchPaperGraph(paperId) {
  try {
    const res = await fetch(`${API}/papers/${encodeURIComponent(paperId)}/graph`, {
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const payload = await res.json();
    return (payload && payload.data) ? payload.data : null;
  } catch(e) {
    console.warn('[fetchPaperGraph] 请求失败，将使用模拟数据:', e.message);
    return null;
  }
}

// ============================================================
// 三、DeepSeek AI 对话引擎
// ============================================================

/**
 * 调用后端代理进行 AI 对话（API Key 保存在服务端，不暴露给前端）
 * @param {Array} messages - 消息数组 [{role:'user'|'assistant'|'system', content:'...'}]
 * @param {Boolean} stream - 是否使用 SSE 流式传输
 * @param {object} options - 附加请求参数，如 { taskType: 'ai_reading' }
 * @returns {Promise<string|ReadableStream>} 非流式模式返回回复文本，流式模式返回 ReadableStream
 */
async function deepseekChat(messages, stream = false, options = {}) {
  const url = stream ? `${API}/chat/stream` : `${API}/chat`;
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || '';
  const payload = { message: lastUserMessage, messages: messages };
  if (options.taskType) payload.task_type = options.taskType;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Unknown error');
    console.error('AI 对话请求错误:', res.status, errText);
    const error = new Error(errText);
    error.status = res.status;
    throw error;
  }

  if (stream) {
    return res.body; // 流式模式：返回 ReadableStream 供 SSE 处理
  } else {
    const data = await res.json();
    window.lastAgentWorkflow = data.workflow || null;
    return data.reply || '';
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
