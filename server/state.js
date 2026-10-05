// 程序的当前状态：正在使用哪个 UI 包、它的内容，以及推送给画面和面板的数据
import fs from 'node:fs';
import path from 'node:path';
import { PATHS } from './paths.js';
import { getConfig } from './config.js';
import { listPackIds, loadPack, summarize } from './packs.js';
import { readContent } from './content.js';
import { ENGINE_VERSION, PACK_FORMAT, DATA_FORMAT, COMPONENT_API } from './version.js';

const cache = new Map();

export function getPack(id) {
  if (!cache.has(id)) cache.set(id, loadPack(id));
  return cache.get(id);
}

export function forgetPacks() {
  cache.clear();
}

export function listPacks() {
  return listPackIds().map((id) => summarize(getPack(id)));
}

/**
 * 选出要用的包：设置里选的那个 → 默认包 → 任何一个能用的。
 * 选中的包不能用时，记下原因，面板会提示。
 */
export function resolveActivePack() {
  const config = getConfig();
  const wanted = config.activePack;
  const available = listPackIds();
  for (const id of [wanted, config.defaultPack, ...available]) {
    if (!id || !available.includes(id)) continue;
    const pack = getPack(id);
    if (pack.usable) return { pack, fallbackFrom: id === wanted ? null : wanted };
  }
  return { pack: null, fallbackFrom: wanted };
}

export function buildState() {
  const config = getConfig();
  const { pack, fallbackFrom } = resolveActivePack();
  return {
    engine: { version: ENGINE_VERSION, packFormat: PACK_FORMAT.current, dataFormat: DATA_FORMAT, componentApi: COMPONENT_API },
    config: { language: config.language, activePack: config.activePack },
    pack: pack && {
      id: pack.id,
      base: pack.base,
      revision: pack.revision,
      issues: pack.issues,
      manifest: pack.manifest,
    },
    fallbackFrom,
    content: pack ? readContent(pack) : null,
  };
}

// 推送：画面和面板都通过 /events 接收完整状态
const clients = new Set();

export function addClient(res) {
  clients.add(res);
  res.write(`data: ${JSON.stringify(buildState())}\n\n`);
  res.on('close', () => clients.delete(res));
}

export function broadcast() {
  let data;
  try {
    data = JSON.stringify(buildState());
  } catch (err) {
    console.error('[state] broadcast skipped:', err.message);
    return;
  }
  for (const res of clients) res.write(`data: ${data}\n\n`);
}

setInterval(() => {
  for (const res of clients) res.write(': ping\n\n');
}, 25000).unref();

/**
 * 包或用户数据在磁盘上被改动时，重新读取并推送。改 UI 包时可以边改边看。
 * 包的修订号取文件修改时间，重新读取不会让没改过的包重建画面。
 */
export function watchFiles() {
  let timer;
  let reloadPacks = false;
  const schedule = (reload) => {
    reloadPacks ||= reload;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (reloadPacks) forgetPacks();
      reloadPacks = false;
      broadcast();
    }, 150);
  };
  const userPacksFolder = path.relative(PATHS.data, PATHS.userPacks);
  const isUserPack = (file) => typeof file === 'string' && file.startsWith(userPacksFolder);
  fs.mkdirSync(PATHS.packs, { recursive: true });
  fs.mkdirSync(PATHS.userPacks, { recursive: true });
  fs.watch(PATHS.packs, { recursive: true }, () => schedule(true));
  fs.watch(PATHS.data, { recursive: true }, (event, file) => schedule(isUserPack(file)));
}
