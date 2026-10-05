// 提交前的硬校验：npm run check。任何一项不过就以非零退出。
//
// 一、语言包（做法与 TRM UI 的 check_i18n 相同）
//   1. 结构：每个语言包的 key 树必须与 zh-CN 完全一致
//   2. 占位符：每条文案里 {…} 的集合必须与 zh-CN 一致
//   3. 引用：代码里用到的 key（t('…')、data-i18n、组件字段 label、错误代码）必须存在于 zh-CN
// 二、UI 包
//   4. packs/ 下每个包都必须能用（结构、文件、版本兼容）
//   5. 包里的多语言文字必须覆盖所有界面语言
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, PATHS } from '../server/paths.js';
import { listPackIds, loadPack } from '../server/packs.js';

const BASE = 'zh-CN';
const failures = [];
const fail = (message) => failures.push(message);

// ---- 语言包 ----

const locales = Object.fromEntries(
  fs.readdirSync(PATHS.locales)
    .filter((file) => file.endsWith('.json'))
    .map((file) => [file.slice(0, -5), JSON.parse(fs.readFileSync(path.join(PATHS.locales, file), 'utf8'))]),
);

function flatten(tree, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(tree)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') flatten(value, full, out);
    else out[full] = value;
  }
  return out;
}

const tokens = (text) => [...String(text).matchAll(/\{[^{}]*\}/g)].map((m) => m[0]).sort().join(' ');
const base = flatten(locales[BASE]);

for (const [id, tree] of Object.entries(locales)) {
  if (id === BASE) continue;
  const flat = flatten(tree);
  for (const key of Object.keys(base)) {
    if (!(key in flat)) fail(`[i18n] ${id} 缺少 ${key}`);
    else if (tokens(flat[key]) !== tokens(base[key])) fail(`[i18n] ${id} 的 ${key} 占位符与 ${BASE} 不一致`);
  }
  for (const key of Object.keys(flat)) {
    if (!(key in base)) fail(`[i18n] ${id} 多出 ${key}`);
  }
}

function walk(dir, exts, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, exts, out);
    else if (exts.includes(path.extname(entry.name))) out.push(full);
  }
  return out;
}

const REFERENCES = [
  [/\bt\(\s*'([\w.]+)'/g, (key) => key],
  [/data-i18n(?:-placeholder|-title)?="([\w.]+)"/g, (key) => key],
  [/label: '((?:kind)\.[\w.]+)'/g, (key) => key],
  [/new AppError\(\s*'([\w.]+)'/g, (code) => `error.${code}`],
  [/issue\(\s*'(?:error|warning)',\s*'([\w.]+)'/g, (code) => `error.${code}`],
  [/code: '([\w.]+)'/g, (code) => `error.${code}`],
];

const sources = [
  ...walk(path.join(ROOT, 'server'), ['.js']),
  ...walk(PATHS.public, ['.js', '.html']),
];
for (const file of sources) {
  const text = fs.readFileSync(file, 'utf8');
  for (const [pattern, toKey] of REFERENCES) {
    for (const match of text.matchAll(pattern)) {
      const key = toKey(match[1]);
      if (!(key in base)) fail(`[i18n] ${path.relative(ROOT, file)} 用到的 ${key} 不在 ${BASE}`);
    }
  }
}

// ---- UI 包 ----

const localeIds = Object.keys(locales);
function checkTexts(packId, value, where) {
  if (!value || typeof value !== 'object') return;
  for (const id of localeIds) {
    if (typeof value[id] !== 'string') fail(`[pack] ${packId}: ${where} 缺少 ${id} 的文字`);
  }
}

for (const id of listPackIds()) {
  const pack = loadPack(id);
  for (const issue of pack.issues) {
    if (issue.level === 'error') fail(`[pack] ${id}: ${issue.code} ${JSON.stringify(issue.params)}`);
  }
  if (!pack.usable) continue;
  const m = pack.manifest;
  checkTexts(id, m.name, 'name');
  checkTexts(id, m.description, 'description');
  m.regions.forEach((region) => checkTexts(id, region.label, `regions.${region.id}.label`));
  m.scenes.items.forEach((scene) => checkTexts(id, scene.label, `scenes.${scene.id}.label`));
}

if (failures.length) {
  console.error(failures.join('\n'));
  console.error(`\n${failures.length} 项未通过`);
  process.exit(1);
}
console.log(`通过：${Object.keys(locales).length} 种语言，${Object.keys(base).length} 条文案，${listPackIds().length} 个 UI 包`);
