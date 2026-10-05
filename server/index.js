// TRM-Live-UI 的本地服务入口
//
// 启动顺序：
//   1. 读设置，选出要用的 UI 包
//   2. 把 v1 之前的旧数据搬到 data/
//   3. 开始监听文件变化
//   4. 启动 HTTP 服务
import http from 'node:http';
import { getConfig } from './config.js';
import { migrateLegacy } from './legacy.js';
import { resolveActivePack, watchFiles } from './state.js';
import { handle } from './http.js';
import { serverText } from './locales.js';
import { ENGINE_VERSION } from './version.js';

const config = getConfig();
const text = serverText(config.language);
const format = (template, params) => template.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? '');

const { pack, fallbackFrom } = resolveActivePack();
for (const file of migrateLegacy(pack)) console.log(format(text.migrated, { file }));
if (!pack) console.error(text.noPack);
else if (fallbackFrom) console.warn(format(text.fallback, { wanted: fallbackFrom, used: pack.id }));

watchFiles();

const { host, port } = config.server;
const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error(err);
    if (!res.headersSent) res.writeHead(500).end();
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error(format(text.portInUse, { port }));
  else console.error(err);
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(format(text.started, { version: ENGINE_VERSION }));
  console.log(`  ${text.overlay}: http://${host}:${port}/overlay`);
  console.log(`  ${text.panel}: http://${host}:${port}/panel`);
});
