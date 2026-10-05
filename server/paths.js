// 所有目录都从这里取，别处不拼路径
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const PATHS = {
  root: ROOT,
  public: path.join(ROOT, 'public'),
  locales: path.join(ROOT, 'public', 'i18n'),
  packs: path.join(ROOT, 'packs'),
  defaultConfig: path.join(ROOT, 'config', 'default.json'),
  // 用户数据：个人内容、预设、设置，不进仓库
  data: path.join(ROOT, 'data'),
  userConfig: path.join(ROOT, 'data', 'config.json'),
  content: path.join(ROOT, 'data', 'content'),
  // 用户导入的 UI 包；程序自带的在 packs/，更新程序时只替换后者
  userPacks: path.join(ROOT, 'data', 'packs'),
  presets: path.join(ROOT, 'data', 'presets'),
  backups: path.join(ROOT, 'data', 'backups'),
  // v1 之前的旧位置，只在迁移时读取
  legacy: {
    content: path.join(ROOT, 'config', 'content.json'),
    presets: path.join(ROOT, 'config', 'presets'),
  },
};

/** child 必须落在 parent 之内，防止 ../ 越界读取。 */
export function inside(parent, child) {
  const rel = path.relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}
