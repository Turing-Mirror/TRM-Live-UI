// 图灵镜直播模板的本地服务：提供直播画面、控制面板，并把改动实时推送给画面
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
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

function handleSaveContent(req, res) {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > MAX_BODY) req.destroy();
  });
  req.on('end', () => {
    try {
      const content = JSON.parse(body);
      fs.writeFileSync(FILES.content, JSON.stringify(content, null, 2) + '\n', 'utf8');
      broadcast();
      res.writeHead(204).end();
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end(err.message);
    }
  });
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
  console.log('图灵镜直播模板已启动');
  console.log(`  直播画面（放进 OBS）：http://${host}:${port}/overlay`);
  console.log(`  控制面板：           http://${host}:${port}/panel`);
});
