// 线条图标，取自 TRM UI（src/trm/components/Icon.tsx）：24 格、跟随文字颜色、1.6 描边。
// 新增图标从 TRM UI 的表里照抄路径，名字按图形起，不按用途起。
const PATHS = {
  play: 'M8 5.5v13l10.5-6.5z',
  edit: 'M5 19h3.5L18.5 9 15 5.5 5 15.5zM13 7.5l3.5 3.5',
  layers: 'M12 4 20.5 8.5 12 13 3.5 8.5zM3.5 12.5 12 17l8.5-4.5M3.5 16.5 12 21l8.5-4.5',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  settings: 'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM12 2.8l2 2.3 3-.4.9 2.9 2.7 1.4-1 2.9 1 2.9-2.7 1.4-.9 2.9-3-.4-2 2.3-2-2.3-3 .4-.9-2.9-2.7-1.4 1-2.9-1-2.9 2.7-1.4.9-2.9 3 .4z',
  sidebar: 'M4 5h16v14H4zM9.5 5v14',
  importIn: 'M12 4v10M7.5 9.5 12 14l4.5-4.5M4.5 14.5V19a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-4.5',
  copy: 'M9 9h10v10H9zM15 9V5H5v10h4',
  alert: 'M12 4.5 20.5 19.5h-17zM12 10v4.5M12 17h.01',
  close: 'M6 6l12 12M18 6 6 18',
  note: 'M6 3.5h9l3.5 3.5v13H6zM15 3.5V7h3.5M9 11h6.5M9 14.5h6.5M9 18h4',
};

export function icon(name, { size = 18, stroke = 1.6 } = {}) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', stroke);
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.classList.add('icon');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', PATHS[name] ?? '');
  svg.append(path);
  return svg;
}
