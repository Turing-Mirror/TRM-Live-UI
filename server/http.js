// HTTP 接口与静态文件
//
// 接口一览（详见 docs/develop.*.md）：
//   GET    /events                 推送完整状态（Server-Sent Events）
//   GET    /api/state              当前完整状态
//   GET    /api/packs              界面库
//   GET    /api/locales            可用的界面语言
//   PUT    /api/config             修改设置 { activePack?, language? }
//   PUT    /api/content            保存文字内容 { regions, screens }
//   PUT    /api/scene              切换状态 { scene }
//   GET    /api/presets            当前包的预设列表
//   GET    /api/presets/:name      读取预设
//   PUT    /api/presets/:name      保存预设 { regions, screens }
//   DELETE /api/presets/:name      删除预设
//   GET    /packs/:id/...          UI 包里的文件
import fs from 'node:fs';
import path from 'node:path';
import { PATHS, inside } from './paths.js';
import { AppError, describeError } from './errors.js';
import { updateConfig } from './config.js';
import { saveContent, setScene } from './content.js';
import { listPresets, loadPreset, savePreset, removePreset } from './presets.js';
import { buildState, broadcast, addClient, listPacks, getPack, resolveActivePack } from './state.js';
import { listPackIds } from './packs.js';
import { listLocales } from './locales.js';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};
const PAGES = { '/': 'panel.html', '/panel': 'panel.html', '/overlay': 'overlay.html' };
const MAX_BODY = 1024 * 1024;

function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-cache' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY) reject(new AppError('request.tooLarge', {}, 413));
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new AppError('request.invalidJson'));
      }
    });
    req.on('error', reject);
  });
}

function activePack() {
  const { pack } = resolveActivePack();
  if (!pack) throw new AppError('pack.noneUsable', {}, 503);
  return pack;
}

function serveFile(res, root, relative) {
  const file = path.join(root, relative);
  if (!inside(root, file)) return res.writeHead(403).end();
  fs.readFile(file, (err, data) => {
    if (err) return res.writeHead(404).end();
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

/** 路由表：[方法, 路径正则, 处理函数]。处理函数返回的值会作为 JSON 回复。 */
const routes = [
  ['GET', /^\/api\/state$/, () => buildState()],
  ['GET', /^\/api\/packs$/, () => listPacks()],
  ['GET', /^\/api\/locales$/, () => listLocales()],
  ['PUT', /^\/api\/config$/, async (req) => {
    const patch = await readBody(req);
    if (patch.activePack !== undefined) {
      if (!listPackIds().includes(patch.activePack)) throw new AppError('pack.notFound', { id: patch.activePack }, 404);
      const pack = getPack(patch.activePack);
      if (!pack.usable) throw new AppError('pack.unusable', { id: patch.activePack });
    }
    if (patch.language !== undefined && !listLocales().some((locale) => locale.id === patch.language)) {
      throw new AppError('config.invalidValue', { key: 'language' });
    }
    updateConfig(patch);
    broadcast();
    return buildState().config;
  }],
  ['PUT', /^\/api\/content$/, async (req) => {
    const content = saveContent(activePack(), await readBody(req));
    broadcast();
    return content;
  }],
  ['PUT', /^\/api\/scene$/, async (req) => {
    const { scene } = await readBody(req);
    const content = setScene(activePack(), scene);
    broadcast();
    return { scene: content.scene };
  }],
  ['GET', /^\/api\/presets$/, () => listPresets(activePack().id)],
  ['GET', /^\/api\/presets\/(.+)$/, (req, [name]) => loadPreset(activePack(), name)],
  ['PUT', /^\/api\/presets\/(.+)$/, async (req, [name]) => {
    savePreset(activePack(), name, await readBody(req));
    return listPresets(activePack().id);
  }],
  ['DELETE', /^\/api\/presets\/(.+)$/, (req, [name]) => {
    removePreset(activePack().id, name);
    return listPresets(activePack().id);
  }],
];

export async function handle(req, res) {
  const { pathname } = new URL(req.url, 'http://localhost');
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return res.writeHead(400).end();
  }

  if (decoded === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    return addClient(res);
  }

  if (decoded.startsWith('/api/')) {
    const route = routes.find(([method, pattern]) => method === req.method && pattern.test(decoded));
    if (!route) return sendJson(res, { error: { code: 'request.notFound', params: {} } }, 404);
    try {
      const params = decoded.match(route[1]).slice(1);
      return sendJson(res, await route[2](req, params));
    } catch (err) {
      const status = err instanceof AppError ? err.status : 500;
      if (status >= 500) console.error(err);
      return sendJson(res, { error: describeError(err) }, status);
    }
  }

  if (req.method !== 'GET') return res.writeHead(405).end();
  const pack = /^\/packs\/([^/]+)\/(.+)$/.exec(decoded);
  if (pack) return serveFile(res, path.join(PATHS.packs, pack[1]), pack[2]);
  return serveFile(res, PATHS.public, PAGES[decoded] ?? decoded.slice(1));
}
