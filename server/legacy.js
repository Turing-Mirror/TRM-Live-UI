// v1 之前，内容和预设放在 config/ 下，结构是平铺的。
// 启动时若发现旧文件，就搬到 data/ 并转成新结构；原文件留在 data/backups。
// 只搬一次：目标已存在时不覆盖。
import fs from 'node:fs';
import path from 'node:path';
import { PATHS } from './paths.js';
import { readJson, writeJson } from './store.js';
import { DATA_FORMAT } from './version.js';
import { migrateData } from './content.js';

function backup(file) {
  fs.mkdirSync(PATHS.backups, { recursive: true });
  fs.renameSync(file, path.join(PATHS.backups, `legacy-${path.basename(file)}`));
}

export function migrateLegacy(pack) {
  if (!pack?.usable) return [];
  const moved = [];
  const { content, presets } = PATHS.legacy;

  if (fs.existsSync(content)) {
    const target = path.join(PATHS.content, `${pack.id}.json`);
    if (!fs.existsSync(target)) {
      writeJson(target, { format: DATA_FORMAT, ...migrateData(readJson(content), pack.manifest) });
      moved.push(target);
    }
    backup(content);
  }

  if (fs.existsSync(presets)) {
    for (const file of fs.readdirSync(presets).filter((name) => name.endsWith('.json'))) {
      const source = path.join(presets, file);
      const target = path.join(PATHS.presets, pack.id, file);
      if (!fs.existsSync(target)) {
        writeJson(target, { format: DATA_FORMAT, ...migrateData(readJson(source), pack.manifest) });
        moved.push(target);
      }
      fs.rmSync(source);
    }
    fs.rmSync(presets, { recursive: true, force: true });
  }
  return moved;
}
