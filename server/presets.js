// 预设：每个 UI 包各自一组，存在 data/presets/<包 id>/<名称>.json
// 预设只记文字内容，不记当前状态。
import fs from 'node:fs';
import path from 'node:path';
import { PATHS } from './paths.js';
import { readJson, writeJson, isObject } from './store.js';
import { DATA_FORMAT, ENGINE_VERSION } from './version.js';
import { migrateData, cleanGroup } from './content.js';
import { AppError } from './errors.js';

const INVALID_NAME = /[\\/:*?"<>|]/;

const presetDir = (packId) => path.join(PATHS.presets, packId);

function presetFile(packId, name) {
  const clean = String(name ?? '').trim();
  if (!clean || INVALID_NAME.test(clean) || clean.length > 80) throw new AppError('preset.invalidName');
  return path.join(presetDir(packId), `${clean}.json`);
}

export function listPresets(packId) {
  const dir = presetDir(packId);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.slice(0, -'.json'.length))
    .sort((a, b) => a.localeCompare(b));
}

export function loadPreset(pack, name) {
  const file = presetFile(pack.id, name);
  if (!fs.existsSync(file)) throw new AppError('preset.notFound', { name }, 404);
  const { regions, screens } = migrateData(readJson(file), pack.manifest);
  return { regions: regions ?? {}, screens: screens ?? {} };
}

export function savePreset(pack, name, input) {
  if (!isObject(input)) throw new AppError('content.invalid');
  writeJson(presetFile(pack.id, name), {
    format: DATA_FORMAT,
    savedWith: ENGINE_VERSION,
    pack: { id: pack.id, version: pack.manifest.version },
    regions: cleanGroup(input.regions),
    screens: cleanGroup(input.screens),
  });
}

export function removePreset(packId, name) {
  fs.rmSync(presetFile(packId, name), { force: true });
}
