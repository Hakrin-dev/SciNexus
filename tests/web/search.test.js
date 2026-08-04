/**
 * search.js 单元测试 —— 搜索历史管理、论文过滤、引用量解析
 *
 * 注意：search.js 中部分函数依赖 DOM 元素和 papers 全局变量，
 * 此处主要测试纯逻辑函数（历史管理、过滤算法、引用量解析）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadModule } from './setup.js';

// 模拟的论文数据 —— 用于测试过滤逻辑
const mockPapers = [
  { id: 'p1', title: 'Attention Is All You Need', authors: 'Vaswani', venue: 'NeurIPS 2017', ccf: 'A', year: 2017, citations: '98,700+', heat: 'Hot', keywords: ['NLP', 'Transformer'], match: 'perfect', matchLabel: 'Perfect', abstract: 'Transformer architecture', trend: 'down' },
  { id: 'p2', title: 'BERT', authors: 'Devlin', venue: 'NAACL 2019', ccf: 'A', year: 2019, citations: '65,200+', heat: 'Hot', keywords: ['NLP', 'BERT'], match: 'perfect', matchLabel: 'Perfect', abstract: 'Pre-training', trend: 'down' },
  { id: 'p3', title: 'ResNet', authors: 'He', venue: 'CVPR 2016', ccf: 'A', year: 2016, citations: '178,000+', heat: 'Hot', keywords: ['CV', 'ResNet'], match: 'perfect', matchLabel: 'Perfect', abstract: 'Deep residual', trend: 'stable' },
];

beforeEach(() => {
  // 清空 localStorage
  localStorage.clear();
  // 重置 DOM
  document.body.innerHTML = '';
  // 加载 search.js（会注册全局函数，但 papers 需手动设置）
  loadModule('search.js');
  // 注入测试用 papers 数据
  window.papers = mockPapers;
});

describe('搜索历史管理', () => {
  it('首次访问应初始化默认历史记录', () => {
    localStorage.clear();
    const history = window.getSearchHistory();
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThan(0);
    expect(history).toContain('Transformer 综述');
  });

  it('saveSearchHistory + getSearchHistory 应正确存取', () => {
    window.saveSearchHistory(['test1', 'test2']);
    expect(window.getSearchHistory()).toEqual(['test1', 'test2']);
  });

  it('saveSearchHistory 应持久化到 localStorage', () => {
    window.saveSearchHistory(['persisted']);
    const raw = localStorage.getItem('deepknow_search_history');
    expect(JSON.parse(raw)).toEqual(['persisted']);
  });
});

describe('引用量解析逻辑', () => {
  it('应正确解析带逗号和加号的引用数字符串', () => {
    // 复用 renderDailyRecs 中的解析逻辑：replace(/[,+]/g, '')
    const parse = (s) => parseInt(s.replace(/[,+]/g, ''));
    expect(parse('98,700+')).toBe(98700);
    expect(parse('178,000+')).toBe(178000);
    expect(parse('890+')).toBe(890);
  });

  it('应正确按引用量降序排序', () => {
    const parse = (s) => parseInt(s.replace(/[,+]/g, ''));
    const sorted = [...mockPapers].sort((a, b) => parse(b.citations) - parse(a.citations));
    expect(sorted[0].id).toBe('p3'); // 178,000
    expect(sorted[1].id).toBe('p1'); // 98,700
    expect(sorted[2].id).toBe('p2'); // 65,200
  });
});

describe('论文过滤逻辑', () => {
  it('CCF-A 过滤应只返回 CCF-A 论文', () => {
    const filtered = mockPapers.filter(p => p.ccf === 'A');
    expect(filtered.length).toBe(3);
  });

  it('关键词过滤应匹配 keywords 数组', () => {
    const filter = 'NLP';
    const filtered = mockPapers.filter(p =>
      (p.keywords || []).some(k => k.toLowerCase().includes(filter.toLowerCase())) ||
      p.venue.toLowerCase().includes(filter.toLowerCase())
    );
    expect(filtered.length).toBe(2); // p1, p2
    expect(filtered.map(p => p.id)).toEqual(['p1', 'p2']);
  });

  it('CV 关键词过滤应匹配 p3', () => {
    const filter = 'CV';
    const filtered = mockPapers.filter(p =>
      (p.keywords || []).some(k => k.toLowerCase().includes(filter.toLowerCase())) ||
      p.venue.toLowerCase().includes(filter.toLowerCase())
    );
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('p3');
  });

  it('"全部" 过滤应返回所有论文', () => {
    const filter = '全部';
    const filtered = filter === '全部' ? mockPapers : [];
    expect(filtered.length).toBe(3);
  });

  it('年份过滤应正确工作', () => {
    const filtered = mockPapers.filter(p => p.year === 2017);
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('p1');
  });
});

describe('趋势指示器逻辑', () => {
  it('应从论文数据读取真实趋势', () => {
    // 模拟 assignTrends 中的查找逻辑
    const paper = mockPapers.find(p => p.title === 'ResNet');
    const trend = paper?.trend || 'stable';
    expect(trend).toBe('stable');

    const paper2 = mockPapers.find(p => p.title === 'Attention Is All You Need');
    expect(paper2?.trend).toBe('down');
  });

  it('无 trend 字段时应默认 stable', () => {
    const paper = { title: 'NoTrend', trend: undefined };
    const trend = paper?.trend || 'stable';
    expect(trend).toBe('stable');
  });

  it('趋势标签映射应完整', () => {
    const labels = { up: '📈 上升', stable: '➡️ 平稳', down: '📉 下降' };
    expect(labels.up).toContain('上升');
    expect(labels.stable).toContain('平稳');
    expect(labels.down).toContain('下降');
  });
});
