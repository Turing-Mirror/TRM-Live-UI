// 直播画面：按当前 UI 包画出区域和等待画面，收到新状态就更新
//
// 地址加上 ?preview=1 时是控制面板里的预览：画面缩放到窗口大小，镂空处显示灰色。
import { subscribe } from '../core/api.js';
import { h } from '../core/dom.js';
import { applyTheme } from '../core/theme.js';
import { preparePack } from '../core/pack.js';
import { createCurtain } from './curtain.js';
import { clock, formatCountdown } from '../core/time.js';

const preview = new URLSearchParams(location.search).has('preview');
document.documentElement.classList.toggle('is-preview', preview);

const canvas = document.getElementById('canvas');
const backdrop = document.getElementById('backdrop');

let layoutKey = null;
let curtain = null;
const rendered = new Map();

function roundedRect({ x, y, w, h: ht }, r) {
  return `M${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}`
    + `V${y + ht - r}A${r},${r} 0 0 1 ${x + w - r},${y + ht}`
    + `H${x + r}A${r},${r} 0 0 1 ${x},${y + ht - r}`
    + `V${y + r}A${r},${r} 0 0 1 ${x + r},${y}Z`;
}

/** 底色铺满画布，透明类型的区域挖空。 */
function drawBackdrop(manifest, kinds) {
  const { width, height } = manifest.canvas;
  const radius = manifest.theme.radius ?? 0;
  const holes = manifest.regions.filter((region) => kinds.get(region.kind)?.transparent);
  backdrop.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', `M0,0H${width}V${height}H0Z${holes.map((r) => roundedRect(r, radius)).join('')}`);
  path.setAttribute('fill-rule', 'evenodd');
  path.setAttribute('class', 'backdrop-fill');
  backdrop.replaceChildren(path);
}

function place(el, rect) {
  Object.assign(el.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` });
}

function fitPreview(manifest) {
  if (!preview) return;
  const scale = Math.min(innerWidth / manifest.canvas.width, innerHeight / manifest.canvas.height);
  canvas.style.transform = `scale(${scale})`;
}

function buildLayout(manifest, registry) {
  const { kinds } = registry;
  canvas.style.width = `${manifest.canvas.width}px`;
  canvas.style.height = `${manifest.canvas.height}px`;
  canvas.querySelectorAll('.region, .curtain').forEach((el) => el.remove());
  rendered.clear();
  drawBackdrop(manifest, kinds);

  for (const region of manifest.regions) {
    const kind = kinds.get(region.kind);
    if (!kind) console.warn(`Unknown kind "${region.kind}" in region "${region.id}"`);
    if (!kind || kind.transparent) continue;
    const el = h('div', `region region-${region.kind}`);
    el.id = `region-${region.id}`;
    place(el, region);
    // 高度跟随内容，h 作为最大高度
    if (region.options?.autoHeight) {
      el.style.height = 'auto';
      el.style.maxHeight = `${region.h}px`;
    }
    canvas.append(el);
  }

  curtain = null;
  const { curtain: rect, items } = manifest.scenes;
  if (rect && items.some((scene) => scene.screen)) {
    curtain = createCurtain(rect, items.map((scene) => scene.id));
    for (const scene of items) {
      if (!scene.screen) continue;
      const el = h('div', `screen-${scene.screen.kind}`);
      el.id = `screen-${scene.id}`;
      curtain.addScreen(scene.id, el);
    }
    canvas.append(curtain.el);
  }
  fitPreview(manifest);
}

/** 内容没变的部分不重画，滚动字幕和动画不会因为别处的改动而从头开始。 */
function paint(key, el, kind, data, def, ctx) {
  const signature = JSON.stringify([data, def]);
  if (rendered.get(key) === signature) return;
  rendered.set(key, signature);
  el.replaceChildren();
  kind.render(el, data, def, ctx);
}

async function render(state) {
  if (!state.pack) {
    canvas.hidden = true;
    return;
  }
  canvas.hidden = false;
  const { manifest } = state.pack;
  const { registry } = await preparePack(state, { fonts: true, styles: true });
  const ctx = { animations: registry.animations };
  applyTheme(manifest.theme);

  const key = `${state.pack.id}:${state.pack.revision}`;
  const firstPaint = layoutKey === null;
  const rebuilt = key !== layoutKey;
  if (rebuilt) {
    layoutKey = key;
    buildLayout(manifest, registry);
  }

  for (const region of manifest.regions) {
    const kind = registry.kinds.get(region.kind);
    const el = document.getElementById(`region-${region.id}`);
    if (kind && el) paint(region.id, el, kind, state.content.regions[region.id] ?? {}, region, ctx);
  }
  for (const scene of manifest.scenes.items) {
    if (!scene.screen) continue;
    const kind = registry.kinds.get(scene.screen.kind);
    const el = document.getElementById(`screen-${scene.id}`);
    if (kind && el) paint(`screen:${scene.id}`, el, kind, state.content.screens[scene.id] ?? {}, scene.screen, ctx);
  }

  curtain?.show(state.content.scene, { instant: firstPaint || rebuilt });
  tick();
}

function tick() {
  const now = new Date();
  const time = clock(now);
  document.querySelectorAll('[data-clock]').forEach((el) => { el.textContent = time; });
  document.querySelectorAll('[data-countdown]').forEach((el) => { el.textContent = formatCountdown(el.dataset.countdown, now); });
}

// 状态按到达顺序依次处理；处理中又来了新状态时，只处理最新的那一个
let latest = null;
let queue = Promise.resolve();
subscribe((state) => {
  latest = state;
  queue = queue.then(() => (latest === state ? render(state) : null)).catch((err) => console.error(err));
});

setInterval(tick, 1000);
addEventListener('resize', () => {
  if (latest?.pack) fitPreview(latest.pack.manifest);
});
