// JSON 文件的读写：写入先写临时文件再改名，坏文件留档后再回退默认值
import fs from 'node:fs';
import path from 'node:path';
import { PATHS } from './paths.js';

/** 读 JSON。文件不存在时返回 fallback；内容损坏时把原文件移到 data/backups 再返回 fallback。 */
export function readJson(file, fallback) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT' && fallback !== undefined) return fallback;
    throw err;
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    if (fallback === undefined) throw err;
    keepBroken(file);
    return fallback;
  }
}

function keepBroken(file) {
  fs.mkdirSync(PATHS.backups, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(PATHS.backups, `${path.basename(file, '.json')}.broken-${stamp}.json`);
  fs.renameSync(file, target);
  console.warn(`[store] ${file} is not valid JSON, moved to ${target}`);
}

/** 原子写入：断电或崩溃时不会留下写了一半的文件。 */
export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(temp, file);
}

export const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** 深合并：对象逐层合并，其余值以 override 为准。用于“默认值 + 用户值”。 */
export function deepMerge(base, override) {
  if (!isObject(base) || !isObject(override)) return override === undefined ? base : override;
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) out[key] = deepMerge(base[key], value);
  return out;
}
