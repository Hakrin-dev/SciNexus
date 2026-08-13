/**
 * utils.js — 全局错误处理与基础工具函数
 *
 * 职责：全局错误捕获、DOM 安全工具、HTML 转义、Toast 通知
 * 包含模块：一、全局错误处理与基础工具；Toast 通知系统
 */

// ============================================================
// 一、全局错误处理与基础工具
// ============================================================

// 全局错误处理器 —— 捕获未处理的 JS 异常，展示恢复提示并阻止浏览器默认报错
window.onerror = function(msg, url, line, col, error) {
  console.error('全局错误:', msg, 'at', url, 'line', line);
  showToast('\u26A0\uFE0F \u9875\u9762\u51FA\u73B0\u5F02\u5E38\uFF0C\u5DF2\u81EA\u52A8\u6062\u590D', 'warning');
  return true; // 阻止浏览器默认错误处理
};
// 未处理的 Promise 拒绝 —— 网络请求失败时自动提示用户重试
window.onunhandledrejection = function(event) {
  console.error('未处理的 Promise 拒绝:', event.reason);
  showToast('\u26A0\uFE0F \u7F51\u7EDC\u8BF7\u6C42\u5931\u8D25\uFF0C\u6B63\u5728\u91CD\u8BD5...', 'warning');
};

// DOM 安全工具函数 —— 避免空引用导致的运行时错误
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);
const safeAddClass = (el, cls) => { if (el) el.classList.add(cls); };
const safeRemoveClass = (el, cls) => { if (el) el.classList.remove(cls); };
const safeHTML = (el, html) => { if (el) el.innerHTML = html; };
const safeText = (el, text) => { if (el) el.textContent = text; };

// HTML 转义工具 —— 防止 XSS 攻击，所有动态数据插入 innerHTML 前必须经过转义
function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Toast 通知系统
function showToast(msg, type='info', duration=2500) {
  const icons = { success:'\u2705', error:'\u274C', warning:'\u26A0\uFE0F', info:'\uD83D\uDCA1' };
  const colors = { success:'#059669', error:'#DC2626', warning:'#F59E0B', info:'#1A56DB' };
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);padding:12px 28px;border-radius:28px;color:white;font-weight:500;font-size:13px;z-index:99999;box-shadow:0 8px 30px rgba(0,0,0,0.15);animation:toastIn 0.35s ease;pointer-events:none;white-space:nowrap;max-width:90vw;overflow:hidden;text-overflow:ellipsis;';
  toast.style.background = colors[type] || colors.info;
  toast.textContent = (icons[type]||'') + ' ' + msg;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity='0'; toast.style.transition='opacity 0.3s'; setTimeout(()=>toast.remove(),300); }, duration);
}
