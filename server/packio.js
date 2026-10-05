// UI 包的导入、导出与删除
//
// 导出：把包文件夹打成 zip，文件名 <id>-<version>.zip。
// 导入：先解到 data/packs/ 下的临时文件夹，按正常的包完整检查一遍，能用才改名为 data/packs/<id>/。
//       zip 里的 pack.json 可以在根目录，也可以在唯一的顶层文件夹里（直接压缩文件夹时就是这样）。
// 覆盖与删除：旧的包移到 data/backups/packs/，不直接删掉。
// 程序自带的包（packs/）不能被导入覆盖，也不能删除。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PATHS, inside } from './paths.js';
import { readJson } from './store.js';
import { readZip, createZip } from './zip.js';
import { loadPack, findPackEntry, summarize } from './packs.js';
import { AppError } from './errors.js';

const JUNK = [/^__MACOSX\//, /(^|\/)\.DS_Store$/, /(^|\/)Thumbs\.db$/i, /(^|\/)desktop\.ini$/i];

function collectFiles(dir, prefix = '') {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) files.push(...collectFiles(full, `${name}/`));
    else files.push({ name, data: fs.readFileSync(full) });
  }
  return files;
}

export function exportPack(id) {
  const entry = findPackEntry(id);
  if (!entry) throw new AppError('pack.notFound', { id }, 404);
  const version = loadPack(id, entry.dir).manifest?.version ?? '0.0.0';
  return { filename: `${id}-${version}.zip`, data: createZip(collectFiles(entry.dir)) };
}

/** zip 里的路径 → 包内相对路径；去掉系统杂项与唯一的顶层文件夹，拒绝越界路径。 */
export function normalizeEntries(files) {
  const kept = files
    .map((file) => ({ ...file, name: file.name.replaceAll('\\', '/') }))
    .filter((file) => !JUNK.some((pattern) => pattern.test(file.name)));
  let prefix = '';
  if (!kept.some((file) => file.name === 'pack.json')) {
    const tops = new Set(kept.map((file) => file.name.split('/')[0]));
    const [top] = tops;
    if (tops.size !== 1 || !kept.some((file) => file.name === `${top}/pack.json`)) throw new AppError('zip.noManifest');
    prefix = `${top}/`;
  }
  return kept.map((file) => {
    const name = file.name.slice(prefix.length);
    const parts = name.split('/');
    if (!name || name.startsWith('/') || /^[a-zA-Z]:/.test(name) || parts.some((part) => part === '..' || part === '.' || part === '')) {
      throw new AppError('zip.invalid');
    }
    return { name, data: file.data };
  });
}

/** 解到临时文件夹并检查。调用方负责在用完后删除 dir。 */
function stage(buffer) {
  const files = normalizeEntries(readZip(buffer));
  const dir = path.join(PATHS.userPacks, `.import-${crypto.randomUUID()}`);
  for (const file of files) {
    const target = path.join(dir, file.name);
    if (!inside(dir, target)) throw new AppError('zip.invalid');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.data);
  }
  let manifest = {};
  try {
    manifest = readJson(path.join(dir, 'pack.json'));
  } catch {
    manifest = {};
  }
  const id = typeof manifest.id === 'string' ? manifest.id : '';
  return { dir, manifest, pack: loadPack(id, dir) };
}

function withStaged(buffer, use) {
  let staged;
  try {
    staged = stage(buffer);
    return use(staged);
  } finally {
    if (staged && fs.existsSync(staged.dir)) fs.rmSync(staged.dir, { recursive: true, force: true });
  }
}

function existingKind(id) {
  const entry = id ? findPackEntry(id) : null;
  if (!entry) return null;
  return entry.builtin ? 'builtin' : 'user';
}

/** 导入前的预览：包的信息、问题、是否含脚本、是否会覆盖。不安装任何东西。 */
export function inspectPack(buffer) {
  return withStaged(buffer, ({ manifest, pack }) => ({
    ...summarize(pack),
    builtin: false,
    components: Array.isArray(manifest.components) ? manifest.components.length : 0,
    exists: existingKind(manifest.id),
  }));
}

function backupPack(dir, id) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(PATHS.backups, 'packs', `${id}-${stamp}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.renameSync(dir, target);
}

export function importPack(buffer, { replace = false } = {}) {
  return withStaged(buffer, ({ dir, manifest, pack }) => {
    if (!pack.usable) throw new AppError('pack.importUnusable', { id: manifest.id ?? '' });
    const { id } = manifest;
    const exists = existingKind(id);
    if (exists === 'builtin') throw new AppError('pack.builtinConflict', { id }, 409);
    if (exists === 'user' && !replace) throw new AppError('pack.exists', { id }, 409);
    const target = path.join(PATHS.userPacks, id);
    if (fs.existsSync(target)) backupPack(target, id);
    fs.renameSync(dir, target);
    return summarize(loadPack(id, target));
  });
}

export function removePack(id) {
  const entry = findPackEntry(id);
  if (!entry) throw new AppError('pack.notFound', { id }, 404);
  if (entry.builtin) throw new AppError('pack.notRemovable', { id });
  backupPack(entry.dir, id);
}
