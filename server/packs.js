// UI 包：发现、读取、旧格式迁移、结构校验、版本兼容检查
//
// 一个 UI 包是一个文件夹，入口是 pack.json。程序自带的在 packs/<id>/，用户导入的在 data/packs/<id>/。
// 两处的 id 不能重复；重复时以自带的为准。
// 检查结果统一为 issues：{ level: 'error' | 'warning', code, params }。
// 有 error 的包不能使用；warning 只提示，不影响使用。
import fs from 'node:fs';
import path from 'node:path';
import { PATHS, inside } from './paths.js';
import { readJson, isObject } from './store.js';
import { ENGINE_VERSION, PACK_FORMAT, COMPONENT_API, compareVersions, isVersion, majorOf } from './version.js';

const ID = /^[a-z0-9][a-z0-9-]*$/;

/**
 * 旧格式升级到新格式：键是旧的 format，函数返回升一级后的 manifest。
 * 改 pack.json 结构时，把 PACK_FORMAT.current 加一，并在这里补一条。
 */
export const PACK_MIGRATIONS = {};

export function migrateManifest(manifest) {
  let current = manifest;
  while (current.format < PACK_FORMAT.current) {
    const step = PACK_MIGRATIONS[current.format];
    if (!step) break;
    current = { ...step(current), format: current.format + 1 };
  }
  return current;
}

const issue = (level, code, params = {}) => ({ level, code, params });

/** 版本兼容：格式太新、要求的程序版本更高时不能用；用更新的大版本制作时提醒。 */
export function checkCompatibility(manifest) {
  const issues = [];
  const { format, requires, madeWith } = manifest;
  if (!Number.isInteger(format)) {
    issues.push(issue('error', 'pack.invalidField', { field: 'format' }));
    return issues;
  }
  if (format > PACK_FORMAT.current) {
    issues.push(issue('error', 'pack.formatTooNew', { format, supported: PACK_FORMAT.current }));
  }
  if (format < PACK_FORMAT.min) {
    issues.push(issue('error', 'pack.formatTooOld', { format, supported: PACK_FORMAT.min }));
  }
  if (isVersion(requires) && compareVersions(requires, ENGINE_VERSION) > 0) {
    issues.push(issue('error', 'pack.requiresEngine', { required: requires, engine: ENGINE_VERSION }));
  }
  if (manifest.componentApi !== undefined && !(Number.isInteger(manifest.componentApi) && manifest.componentApi >= 1)) {
    issues.push(issue('error', 'pack.invalidField', { field: 'componentApi' }));
  } else if (manifest.componentApi > COMPONENT_API) {
    issues.push(issue('error', 'pack.componentApiTooNew', { required: manifest.componentApi, supported: COMPONENT_API }));
  }
  if (isVersion(madeWith) && majorOf(madeWith) > majorOf(ENGINE_VERSION)) {
    issues.push(issue('warning', 'pack.madeWithNewer', { madeWith, engine: ENGINE_VERSION }));
  }
  return issues;
}

const isRect = (value) => isObject(value) && ['x', 'y', 'w', 'h'].every((key) => Number.isFinite(value[key]));
const isText = (value) => typeof value === 'string' || (isObject(value) && Object.values(value).every((v) => typeof v === 'string'));

/** 结构校验。exists(file) 判断包内文件是否存在，方便测试时替换。 */
export function validateManifest(manifest, { folder, exists }) {
  const issues = [];
  const error = (code, params) => issues.push(issue('error', code, params));
  const missing = (field) => error('pack.missingField', { field });

  if (!ID.test(manifest.id ?? '')) error('pack.invalidField', { field: 'id' });
  else if (manifest.id !== folder) error('pack.idMismatch', { id: manifest.id, folder });
  if (!isText(manifest.name)) missing('name');
  for (const field of ['version', 'madeWith']) {
    if (!isVersion(manifest[field])) error('pack.invalidField', { field });
  }
  if (manifest.requires !== undefined && !isVersion(manifest.requires)) {
    error('pack.invalidField', { field: 'requires' });
  }
  const { canvas } = manifest;
  if (!isObject(canvas) || !(canvas.width > 0) || !(canvas.height > 0)) missing('canvas');

  const checkFile = (field, file) => {
    if (typeof file !== 'string') return error('pack.invalidField', { field });
    if (!exists(file)) error('pack.fileMissing', { file });
  };
  manifest.fonts?.forEach((font, i) => {
    if (typeof font?.family !== 'string') missing(`fonts[${i}].family`);
    checkFile(`fonts[${i}].src`, font?.src);
  });
  manifest.styles?.forEach((file, i) => checkFile(`styles[${i}]`, file));
  manifest.components?.forEach((file, i) => checkFile(`components[${i}]`, file));
  if (manifest.content !== undefined) checkFile('content', manifest.content);

  const ids = new Set();
  const checkId = (field, id) => {
    if (typeof id !== 'string' || !id) return missing(field);
    if (ids.has(id)) error('pack.duplicateId', { id });
    ids.add(id);
  };
  if (!Array.isArray(manifest.regions)) missing('regions');
  manifest.regions?.forEach((region, i) => {
    checkId(`regions[${i}].id`, region?.id);
    if (typeof region?.kind !== 'string') missing(`regions[${i}].kind`);
    if (!isRect(region)) error('pack.invalidField', { field: `regions[${i}]` });
  });

  const scenes = manifest.scenes?.items ?? [];
  const sceneIds = new Set();
  scenes.forEach((scene, i) => {
    if (typeof scene?.id !== 'string' || !scene.id) return missing(`scenes.items[${i}].id`);
    if (sceneIds.has(scene.id)) error('pack.duplicateId', { id: scene.id });
    sceneIds.add(scene.id);
    if (scene.screen && typeof scene.screen.kind !== 'string') missing(`scenes.items[${i}].screen.kind`);
  });
  if (scenes.some((scene) => scene.screen) && !isRect(manifest.scenes?.curtain)) missing('scenes.curtain');
  return issues;
}

/** 给可选字段补上空值，前端可以直接使用，不必处处判断。 */
function normalize(manifest) {
  return {
    ...manifest,
    fonts: manifest.fonts ?? [],
    styles: manifest.styles ?? [],
    components: manifest.components ?? [],
    theme: { fonts: {}, colors: {}, sizes: {}, palette: [], ...manifest.theme },
    regions: manifest.regions ?? [],
    scenes: { curtain: null, items: [], ...manifest.scenes },
  };
}

function scan(root, builtin) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && fs.existsSync(path.join(root, entry.name, 'pack.json')))
    .map((entry) => ({ id: entry.name, dir: path.join(root, entry.name), builtin }));
}

/** 所有包的位置：[{ id, dir, builtin }]，自带的在前。 */
export function listPackEntries() {
  const builtins = scan(PATHS.packs, true);
  const taken = new Set(builtins.map((entry) => entry.id));
  return [...builtins, ...scan(PATHS.userPacks, false).filter((entry) => !taken.has(entry.id))];
}

export function listPackIds() {
  return listPackEntries().map((entry) => entry.id);
}

export function findPackEntry(id) {
  return listPackEntries().find((entry) => entry.id === id) ?? null;
}

/** 修订号取包内文件的最后修改时间：文件没变，修订号就不变，画面不必重建。 */
function revisionOf(dir) {
  let latest = 0;
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else latest = Math.max(latest, fs.statSync(full).mtimeMs);
    }
  };
  walk(dir);
  return Math.round(latest);
}

/** 读取一个包。无论是否可用都返回结果，问题写在 issues 里。dir 省略时按 id 查找。 */
export function loadPack(id, dir = findPackEntry(id)?.dir) {
  if (!dir) return { id, usable: false, issues: [issue('error', 'pack.notFound', { id })] };
  const exists = (file) => {
    const full = path.join(dir, file);
    return inside(dir, full) && fs.existsSync(full);
  };
  let raw;
  try {
    raw = readJson(path.join(dir, 'pack.json'));
  } catch (err) {
    return { id, usable: false, issues: [issue('error', 'pack.unreadable', { message: err.message })] };
  }
  const compatibility = checkCompatibility(raw);
  const manifest = compatibility.some((i) => i.level === 'error') ? raw : migrateManifest(raw);
  const issues = [...compatibility, ...validateManifest(manifest, { folder: id, exists })];

  let defaults = {};
  if (typeof manifest.content === 'string' && exists(manifest.content)) {
    try {
      defaults = readJson(path.join(dir, manifest.content));
    } catch (err) {
      issues.push(issue('error', 'pack.unreadable', { message: `${manifest.content}: ${err.message}` }));
    }
  }
  const usable = !issues.some((i) => i.level === 'error');
  return {
    id,
    usable,
    issues,
    revision: revisionOf(dir),
    builtin: inside(PATHS.packs, dir),
    base: `/packs/${encodeURIComponent(id)}/`,
    manifest: usable ? normalize(manifest) : manifest,
    defaults,
  };
}

/** 界面库列表用的摘要。 */
export function summarize(pack) {
  const m = pack.manifest ?? {};
  return {
    id: pack.id,
    builtin: pack.builtin,
    usable: pack.usable,
    issues: pack.issues,
    name: m.name ?? pack.id,
    description: m.description ?? '',
    author: m.author ?? '',
    version: m.version ?? '',
    madeWith: m.madeWith ?? '',
    requires: m.requires ?? '',
    format: m.format,
  };
}
