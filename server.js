// TRM-Live-UI 的本地服务：提供直播画面、控制面板，并把改动实时推送给画面
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const PRESETS_DIR = path.join(ROOT, 'config', 'presets');
const FILES = {
  settings: path.join(ROOT, 'config', 'settings.json'),
  content: path.join(ROOT, 'config', 'content.json'),
};
const PAGES = { '/': 'panel.html', '/panel': 'panel.html', '/overlay': 'overlay.html' };
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};
const MAX_BODY = 1024 * 1024;

const DEFAULT_CONTENT = path.join(ROOT, 'config', 'content.default.json');

// 个人内容不进仓库；第一次启动时用默认内容生成
if (!fs.existsSync(FILES.content)) fs.copyFileSync(DEFAULT_CONTENT, FILES.content);

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const readState = () => ({ settings: readJson(FILES.settings), content: readJson(FILES.content) });

const clients = new Set();

function broadcast() {
  let data;
  try {
    data = JSON.stringify(readState());
  } catch (err) {
    console.error('配置文件格式有误，暂不推送：', err.message);
    return;
  }
  for (const res of clients) res.write(`data: ${data}\n\n`);
}

function handleEvents(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write(`data: ${JSON.stringify(readState())}\n\n`);
  clients.add(res);
  req.on('close', () => clients.delete(res));
}

const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');

function sendJson(res, data) {
  res.writeHead(200, { 'Content-Type': MIME['.json'] }).end(JSON.stringify(data));
}

function sendError(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }).end(message);
}

// 读取请求里的 JSON，出错时直接回复
function withJsonBody(req, res, handler) {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > MAX_BODY) req.destroy();
  });
  req.on('end', () => {
    try {
      handler(JSON.parse(body));
    } catch (err) {
      sendError(res, 400, err.message);
    }
  });
}

function handleSaveContent(req, res) {
  withJsonBody(req, res, (content) => {
    writeJson(FILES.content, content);
    broadcast();
    res.writeHead(204).end();
  });
}

// 预设：config/presets 里每个文件是一份内容
const INVALID_NAME = /[\\/:*?"<>|]/;

function presetFile(name) {
  const clean = String(name ?? '').trim();
  if (!clean || INVALID_NAME.test(clean)) throw new Error('预设名称不能为空，也不能包含 \\ / : * ? " < > |');
  return path.join(PRESETS_DIR, `${clean}.json`);
}

function listPresets() {
  fs.mkdirSync(PRESETS_DIR, { recursive: true });
  return fs.readdirSync(PRESETS_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.slice(0, -'.json'.length));
}

function handlePresets(req, res, name) {
  try {
    if (name === undefined) {
      return req.method === 'GET' ? sendJson(res, listPresets()) : res.writeHead(405).end();
    }
    const file = presetFile(name);
    if (req.method === 'GET') return sendJson(res, readJson(file));
    if (req.method === 'DELETE') {
      fs.rmSync(file, { force: true });
      return res.writeHead(204).end();
    }
    if (req.method === 'PUT') {
      return withJsonBody(req, res, (content) => {
        fs.mkdirSync(PRESETS_DIR, { recursive: true });
        writeJson(file, content);
        res.writeHead(204).end();
      });
    }
    res.writeHead(405).end();
  } catch (err) {
    sendError(res, err.code === 'ENOENT' ? 404 : 400, err.message);
  }
}

function handleStatic(pathname, res) {
  const file = path.join(PUBLIC_DIR, PAGES[pathname] || decodeURIComponent(pathname));
  if (!file.startsWith(PUBLIC_DIR)) return res.writeHead(403).end();
  fs.readFile(file, (err, data) => {
    if (err) return res.writeHead(404).end();
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (pathname === '/events') return handleEvents(req, res);
  if (pathname === '/api/content' && req.method === 'POST') return handleSaveContent(req, res);
  if (pathname === '/api/presets') return handlePresets(req, res);
  if (pathname.startsWith('/api/presets/')) {
    return handlePresets(req, res, decodeURIComponent(pathname.slice('/api/presets/'.length)));
  }
  if (req.method === 'GET') return handleStatic(pathname, res);
  res.writeHead(405).end();
});

// 直接改配置文件时也会同步到画面
let watchTimer;
for (const file of Object.values(FILES)) {
  fs.watch(file, () => {
    clearTimeout(watchTimer);
    watchTimer = setTimeout(broadcast, 150);
  });
}

// 保持连接不断开
setInterval(() => {
  for (const res of clients) res.write(': ping\n\n');
}, 25000);

const { host, port } = readJson(FILES.settings).server;
server.listen(port, host, () => {
  console.log('TRM-Live-UI 已启动');
  console.log(`  直播画面（放进 OBS）：http://${host}:${port}/overlay`);
  console.log(`  控制面板：           http://${host}:${port}/panel`);
});
