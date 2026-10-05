// 界面翻译。语言包在 public/i18n/<语言>.json，zh-CN 是基准，缺的条目回退到它。
//
// t(key, params)   按 key 取文案，{name} 由 params 填入
// localize(value)  UI 包里的多语言文字：字符串原样返回，对象按当前语言取
// text(value)      两者合一：是已知 key 就翻译，否则按 localize 处理

export const BASE_LOCALE = 'zh-CN';

let language = BASE_LOCALE;
let messages = {};
let base = {};

async function load(id) {
  const res = await fetch(`/i18n/${encodeURIComponent(id)}.json`);
  if (!res.ok) throw new Error(`Missing locale ${id}`);
  return res.json();
}

export async function setLanguage(id) {
  base = Object.keys(base).length ? base : await load(BASE_LOCALE);
  messages = id === BASE_LOCALE ? base : await load(id).catch(() => base);
  language = id;
  document.documentElement.lang = id;
}

export const currentLanguage = () => language;

const lookup = (tree, key) => key.split('.').reduce((node, part) => node?.[part], tree);

export function has(key) {
  return typeof lookup(messages, key) === 'string' || typeof lookup(base, key) === 'string';
}

export function t(key, params = {}) {
  const template = lookup(messages, key) ?? lookup(base, key);
  if (typeof template !== 'string') return key;
  return template.replace(/\{(\w+)\}/g, (match, name) => (params[name] ?? match));
}

export function localize(value) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);
  return value[language] ?? value[BASE_LOCALE] ?? value['en-US'] ?? Object.values(value)[0] ?? '';
}

export function text(value) {
  return typeof value === 'string' && has(value) ? t(value) : localize(value);
}

/** 接口或 UI 包报告的问题 { code, params } 转成一句话。 */
export function describe(issue) {
  const key = `error.${issue?.code}`;
  return has(key) ? t(key, issue.params) : t('error.internal', { message: issue?.code ?? '' });
}

/** 页面上写了 data-i18n 的元素，按当前语言填入文字。 */
export function translatePage(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
}
