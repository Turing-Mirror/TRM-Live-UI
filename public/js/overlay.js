import { subscribe, applyTheme, h } from './live.js';
import { kinds } from './kinds.js';

const canvas = document.getElementById('canvas');
const backdrop = document.getElementById('backdrop');
const rendered = new Map();
let layoutKey = '';

function roundedRect({ x, y, w, h: ht }, r) {
  return `M${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}` +
    `V${y + ht - r}A${r},${r} 0 0 1 ${x + w - r},${y + ht}` +
    `H${x + r}A${r},${r} 0 0 1 ${x},${y + ht - r}` +
    `V${y + r}A${r},${r} 0 0 1 ${x + r},${y}Z`;
}

// 底色铺满画布，镂空区域挖掉
function drawBackdrop(settings) {
  const { width, height } = settings.canvas;
  const holes = settings.regions.filter((r) => kinds[r.kind]?.transparent);
  backdrop.setAttribute('viewBox', `0 0 ${width} ${height}`);
  backdrop.innerHTML = '';
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', `M0,0H${width}V${height}H0Z` + holes.map((r) => roundedRect(r, settings.theme.radius)).join(''));
  path.setAttribute('fill-rule', 'evenodd');
  path.setAttribute('fill', 'var(--color-backdrop)');
  backdrop.append(path);
}

function buildLayout(settings) {
  canvas.style.width = `${settings.canvas.width}px`;
  canvas.style.height = `${settings.canvas.height}px`;
  canvas.querySelectorAll('.region').forEach((el) => el.remove());
  rendered.clear();
  drawBackdrop(settings);
  for (const region of settings.regions) {
    if (kinds[region.kind]?.transparent) continue;
    const el = h('div', `region region-${region.kind}`);
    el.id = `region-${region.id}`;
    Object.assign(el.style, {
      left: `${region.x}px`,
      top: `${region.y}px`,
      width: `${region.w}px`,
      height: `${region.h}px`,
    });
    // 高度跟随内容，h 作为最大高度
    if (region.options?.autoHeight) {
      el.style.height = 'auto';
      el.style.maxHeight = `${region.h}px`;
    }
    canvas.append(el);
  }
}

function render({ settings, content }) {
  applyTheme(settings.theme);
  const key = JSON.stringify([settings.canvas, settings.regions, settings.theme.radius]);
  if (key !== layoutKey) {
    layoutKey = key;
    buildLayout(settings);
  }
  for (const region of settings.regions) {
    const kind = kinds[region.kind];
    const el = document.getElementById(`region-${region.id}`);
    if (!kind || !el) continue;
    const data = content[region.id] ?? {};
    const dataKey = JSON.stringify([data, settings.ticker]);
    if (rendered.get(region.id) === dataKey) continue;
    rendered.set(region.id, dataKey);
    el.replaceChildren();
    kind.render(el, data, region, settings);
  }
  // 只显示当前状态对应的等待画面
  for (const region of settings.regions) {
    if (!region.options?.scene) continue;
    document.getElementById(`region-${region.id}`)
      ?.classList.toggle('is-active', content.scene === region.options.scene);
  }
  tick();
}

const pad = (n) => String(n).padStart(2, '0');

// "21:00" 到现在的剩余时间；目标早于现在超过半天时算作第二天
function formatCountdown(target) {
  const [hours, minutes] = target.split(/[:：]/).map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return '';
  const end = new Date();
  end.setHours(hours, minutes, 0, 0);
  let seconds = Math.ceil((end - Date.now()) / 1000);
  if (seconds < -12 * 3600) seconds += 24 * 3600;
  if (seconds <= 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function tick() {
  const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  document.querySelectorAll('[data-clock]').forEach((el) => { el.textContent = time; });
  document.querySelectorAll('[data-countdown]').forEach((el) => {
    el.textContent = formatCountdown(el.dataset.countdown);
  });
}

setInterval(tick, 1000);
document.fonts.ready.then(() => subscribe(render));
