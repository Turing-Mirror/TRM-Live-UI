// 界面语言：public/i18n 下每个 .json 就是一种语言，放进去即可被发现
import fs from 'node:fs';
import path from 'node:path';
import { PATHS } from './paths.js';
import { readJson } from './store.js';

export const BASE_LOCALE = 'zh-CN';

export function listLocales() {
  return fs.readdirSync(PATHS.locales)
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      const id = file.slice(0, -'.json'.length);
      return { id, name: readJson(path.join(PATHS.locales, file)).locale?.[id] ?? id };
    });
}

/** 服务端自己要说的几句话（启动提示）也跟着设置里的语言走。 */
export function serverText(language) {
  const pick = (id) => {
    try {
      return readJson(path.join(PATHS.locales, `${id}.json`)).server;
    } catch {
      return null;
    }
  };
  const base = pick(BASE_LOCALE) ?? {};
  return { ...base, ...(pick(language) ?? {}) };
}
