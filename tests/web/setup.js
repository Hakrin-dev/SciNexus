/**
 * Vitest 公共夹具 —— 在 jsdom 环境中加载项目脚本（全局函数风格，非 ES Module）
 *
 * 项目 JS 文件使用全局函数声明（window.escapeHtml 等），未使用 export。
 * 此处通过 fs 读取源码并在测试环境 eval 注入，使测试可直接调用全局函数。
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { beforeAll } from 'vitest';

const JS_DIR = resolve(__dirname, '../../js');

/**
 * 加载指定 JS 模块到全局环境
 * @param {string} name - 文件名（如 'utils.js'）
 */
export function loadModule(name) {
  const code = readFileSync(resolve(JS_DIR, name), 'utf-8');
  // 使用间接 eval 在全局作用域执行
  (0, eval)(code);
}

/**
 * 在 beforeAll 中加载多个模块（按顺序）
 * @param {string[]} names - 文件名列表
 */
export function loadModules(names) {
  beforeAll(() => {
    names.forEach(loadModule);
  });
}
