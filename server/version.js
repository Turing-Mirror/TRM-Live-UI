// 版本与兼容性
//
// 三个数字各管一件事：
//   ENGINE_VERSION  程序本身的版本，取自 package.json。UI 包用 requires 声明最低版本。
//   PACK_FORMAT     pack.json 的结构版本。旧结构由 packs.js 里的迁移补齐，新结构会被拒绝。
//   DATA_FORMAT     用户内容与预设的结构版本。旧数据由 content.js 里的迁移补齐。
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './paths.js';

const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

export const ENGINE_VERSION = pkg.version;
export const PACK_FORMAT = { min: 1, current: 1 };
export const DATA_FORMAT = 1;

const VERSION = /^v?(\d+)\.(\d+)\.(\d+)$/;

export function isVersion(value) {
  return typeof value === 'string' && VERSION.test(value);
}

/** 比较两个 x.y.z 版本：a 较新返回正数，较旧返回负数，相同返回 0。 */
export function compareVersions(a, b) {
  const x = VERSION.exec(a);
  const y = VERSION.exec(b);
  if (!x || !y) throw new Error(`Invalid version: ${!x ? a : b}`);
  for (let i = 1; i <= 3; i += 1) {
    const diff = Number(x[i]) - Number(y[i]);
    if (diff) return diff;
  }
  return 0;
}

export const majorOf = (version) => Number(VERSION.exec(version)?.[1]);
