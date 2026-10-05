// 用户内容：每个 UI 包一份，存在 data/content/<包 id>.json
//
// 读取时：旧结构先迁移，再叠在包的默认内容上，包新增的字段自动有默认值。
// 内容的形状：{ scene, regions: { 区域 id: {...} }, screens: { 状态 id: {...} } }
import path from 'node:path';
import { PATHS } from './paths.js';
import { readJson, writeJson, deepMerge, isObject } from './store.js';
import { DATA_FORMAT } from './version.js';
import { AppError } from './errors.js';

/**
 * 旧数据升级：键是旧的 format，函数返回升一级后的数据。
 * 0 是 v1 之前的平铺结构：区域和等待画面的内容都直接放在顶层。
 */
export const DATA_MIGRATIONS = {
  0(data, manifest) {
    const sceneIds = new Set(manifest.scenes.items.map((scene) => scene.id));
    const regions = {};
    const screens = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === 'scene' || !isObject(value)) continue;
      (sceneIds.has(key) ? screens : regions)[key] = value;
    }
    return { scene: data.scene, regions, screens };
  },
};

export function migrateData(data, manifest) {
  let current = data;
  let format = Number.isInteger(data.format) ? data.format : 0;
  while (format < DATA_FORMAT) {
    current = DATA_MIGRATIONS[format](current, manifest);
    format += 1;
  }
  const { format: _, ...rest } = current;
  return rest;
}

const contentFile = (packId) => path.join(PATHS.content, `${packId}.json`);
const sceneIds = (manifest) => manifest.scenes.items.map((scene) => scene.id);

function validScene(manifest, scene) {
  const ids = sceneIds(manifest);
  return ids.includes(scene) ? scene : ids[0] ?? null;
}

/** 只保留 { 键: 对象 } 这一层结构，值必须是字符串、数字或布尔。 */
function cleanGroup(group) {
  const out = {};
  if (!isObject(group)) return out;
  for (const [id, fields] of Object.entries(group)) {
    if (!isObject(fields)) continue;
    out[id] = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value)),
    );
  }
  return out;
}

export function readContent(pack) {
  const stored = readJson(contentFile(pack.id), {});
  const merged = deepMerge(
    { scene: null, regions: {}, screens: {}, ...pack.defaults },
    migrateData(stored, pack.manifest),
  );
  return { ...merged, scene: validScene(pack.manifest, merged.scene) };
}

function write(pack, content) {
  writeJson(contentFile(pack.id), { format: DATA_FORMAT, ...content });
}

/** 保存文字内容，不改变当前状态。 */
export function saveContent(pack, input) {
  if (!isObject(input)) throw new AppError('content.invalid');
  const current = readContent(pack);
  write(pack, { scene: current.scene, regions: cleanGroup(input.regions), screens: cleanGroup(input.screens) });
  return readContent(pack);
}

export function setScene(pack, scene) {
  if (!sceneIds(pack.manifest).includes(scene)) throw new AppError('scene.unknown', { scene });
  const current = readContent(pack);
  write(pack, { ...current, scene });
  return readContent(pack);
}

export { cleanGroup };
