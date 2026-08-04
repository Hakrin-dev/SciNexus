/**
 * markdown.js — Markdown 渲染辅助函数
 *
 * 职责：轻量 Markdown 行内渲染，用于流式对话过程中实时更新内容
 * 包含模块：renderMdInline 函数（来自原"十、投稿分析与期刊渲染"章节）
 */

/**
 * 轻量 Markdown 行内渲染——用于流式过程中实时更新
 */
function renderMdInline(text) {
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // 粗体
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // 斜体
    .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
    // 行内代码
    .replace(/`([^`\n]+?)`/g, '<code style="background:#F1F5F9;padding:2px 6px;border-radius:4px;font-family:monospace;font-size:12px;">$1</code>')
    // 标题
    .replace(/^### (.+)$/gm, '<h4 style="font-size:14px;font-weight:600;margin:6px 0;">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="font-size:15px;font-weight:700;margin:8px 0;">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 style="font-size:16px;font-weight:700;margin:10px 0;">$1</h2>')
    // 无序列表
    .replace(/^- (.+)$/gm, '<li style="margin:2px 0;">$1</li>')
    // 换行
    .replace(/\n/g, '<br/>');
  // 包裹列表项
  html = html.replace(/(<li[^>]*>.*<\/li>)+/g, '<ul style="padding-left:18px;margin:4px 0;">$&</ul>');
  return html;
}
