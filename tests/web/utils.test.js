/**
 * utils.js 单元测试 —— HTML 转义、DOM 工具、Toast
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadModule } from './setup.js';

// 加载 utils.js 到全局
beforeEach(() => {
  loadModule('utils.js');
});

describe('escapeHtml - XSS 防护', () => {
  it('应转义 & < > " \' 五个危险字符', () => {
    expect(window.escapeHtml('<script>alert("x")</script>'))
      .toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  });

  it('应转义单引号', () => {
    expect(window.escapeHtml("a'b")).toBe('a&#39;b');
  });

  it('应转义 & 符号（避免二次解析）', () => {
    expect(window.escapeHtml('a&b')).toBe('a&amp;b');
  });

  it('null/undefined 输入应返回空字符串', () => {
    expect(window.escapeHtml(null)).toBe('');
    expect(window.escapeHtml(undefined)).toBe('');
  });

  it('非字符串应先转为字符串再转义', () => {
    expect(window.escapeHtml(123)).toBe('123');
  });

  it('组合攻击载荷应被完全中和', () => {
    const payload = `"><img src=x onerror=alert(1)>`;
    const escaped = window.escapeHtml(payload);
    expect(escaped).not.toContain('<');
    expect(escaped).not.toContain('>');
    expect(escaped).not.toContain('"');
  });
});

describe('DOM 安全工具函数', () => {
  it('$ 应按 id 获取元素', () => {
    document.body.innerHTML = '<div id="test-el">hi</div>';
    const el = window.$('test-el');
    expect(el).not.toBeNull();
    expect(el.textContent).toBe('hi');
  });

  it('$ 对不存在的 id 应返回 null', () => {
    expect(window.$('nonexistent')).toBeNull();
  });

  it('safeAddClass 应安全添加类（空引用不报错）', () => {
    const el = document.createElement('div');
    window.safeAddClass(el, 'active');
    expect(el.classList.contains('active')).toBe(true);
    // 空引用不应抛错
    expect(() => window.safeAddClass(null, 'x')).not.toThrow();
  });

  it('safeRemoveClass 应安全移除类', () => {
    const el = document.createElement('div');
    el.classList.add('active');
    window.safeRemoveClass(el, 'active');
    expect(el.classList.contains('active')).toBe(false);
    expect(() => window.safeRemoveClass(null, 'x')).not.toThrow();
  });

  it('safeHTML 应安全设置 innerHTML', () => {
    const el = document.createElement('div');
    window.safeHTML(el, '<span>x</span>');
    expect(el.innerHTML).toBe('<span>x</span>');
    expect(() => window.safeHTML(null, 'x')).not.toThrow();
  });

  it('safeText 应安全设置 textContent', () => {
    const el = document.createElement('div');
    window.safeText(el, 'hello');
    expect(el.textContent).toBe('hello');
    expect(() => window.safeText(null, 'x')).not.toThrow();
  });
});

describe('showToast - 通知系统', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('应在 body 中创建 toast 元素', () => {
    window.showToast('操作成功', 'success');
    const toast = document.querySelector('div[style*="position:fixed"]');
    expect(toast).not.toBeNull();
    expect(toast.textContent).toContain('操作成功');
  });

  it('不同类型应使用不同背景色', () => {
    window.showToast('成功', 'success');
    const successToast = document.querySelector('div[style*="position:fixed"]');
    expect(successToast.style.background).toBe('rgb(5, 150, 105)'); // #059669
  });

  it('duration 后应移除 toast', () => {
    window.showToast('消失', 'info', 1000);
    expect(document.querySelector('div[style*="position:fixed"]')).not.toBeNull();
    vi.advanceTimersByTime(1300); // 1000ms + 300ms 渐隐
    expect(document.querySelector('div[style*="position:fixed"]')).toBeNull();
  });
});
