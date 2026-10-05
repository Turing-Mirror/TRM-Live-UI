// 程序设置：config/default.json 是默认值（进仓库），data/config.json 是用户改过的部分
import { PATHS } from './paths.js';
import { readJson, writeJson, deepMerge } from './store.js';
import { AppError } from './errors.js';

const defaults = readJson(PATHS.defaultConfig);

export function getConfig() {
  return deepMerge(defaults, readJson(PATHS.userConfig, {}));
}

/** 控制面板可以改的设置，以及各自的检查。 */
const EDITABLE = {
  activePack: (value) => typeof value === 'string' && value.length > 0,
  language: (value) => typeof value === 'string' && value.length > 0,
};

export function updateConfig(patch) {
  const user = readJson(PATHS.userConfig, {});
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (!EDITABLE[key]) throw new AppError('config.unknownKey', { key });
    if (!EDITABLE[key](value)) throw new AppError('config.invalidValue', { key });
    user[key] = value;
  }
  writeJson(PATHS.userConfig, user);
  return getConfig();
}
