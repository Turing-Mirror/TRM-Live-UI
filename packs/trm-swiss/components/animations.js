// 图灵镜 · 瑞士 的等待画面动画。动效写在 ../style.css。
export default function setup(api) {
  const { h, paletteColor } = api;

  // 开播前：几何拼块按波浪顺序旋转
  api.registerAnimation('tiles', (stage) => {
    const columns = 4;
    const rows = 4;
    const shapes = ['quarter', 'half', 'leaf', 'quarter', 'circle', 'quarter', 'half', 'leaf'];
    const grid = h('div', 'anim-tiles');
    grid.style.setProperty('--columns', columns);
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        const i = row * columns + col;
        const tile = h('div', `tile tile-${shapes[(i * 3 + row) % shapes.length]}`);
        tile.style.setProperty('--turn', `${((i * 7) % 4) * 90}deg`);
        tile.style.setProperty('--delay', `${(row + col) * 0.18}s`);
        tile.style.background = paletteColor(i * 2 + row);
        grid.append(tile);
      }
    }
    stage.append(grid);
  });

  // 稍后回来：一排小图形轮流蹦跳
  api.registerAnimation('hop', (stage) => {
    const shapes = ['circle', 'square', 'triangle', 'circle', 'half'];
    const row = h('div', 'anim-hop');
    shapes.forEach((shape, i) => {
      const cell = h('div', 'hop-cell');
      cell.style.setProperty('--delay', `${i * 0.14}s`);
      const body = h('div', `hop-body hop-${shape}`);
      body.style.background = paletteColor(i);
      cell.append(body, h('div', 'hop-shadow'));
      row.append(cell);
    });
    stage.append(row, h('div', 'hop-ground'));
  });

  // 即将下播：太阳慢慢落下，星星闪烁，飘出几个 Z
  api.registerAnimation('sunset', (stage) => {
    const scene = h('div', 'anim-sunset');
    const sky = h('div', 'sunset-sky');
    const sun = h('div', 'sunset-sun');
    for (let i = 0; i < 4; i += 1) {
      const stripe = h('div', 'sunset-stripe');
      stripe.style.setProperty('--i', i);
      sun.append(stripe);
    }
    sky.append(sun);
    for (let i = 0; i < 7; i += 1) {
      const star = h('div', 'sunset-star');
      star.style.left = `${8 + ((i * 37) % 84)}%`;
      star.style.top = `${6 + ((i * 23) % 40)}%`;
      star.style.setProperty('--delay', `${i * 0.6}s`);
      star.style.background = paletteColor(i + 1);
      sky.append(star);
    }
    for (let i = 0; i < 3; i += 1) {
      const z = h('div', 'sunset-z', 'Z');
      z.style.setProperty('--delay', `${i * 1.2}s`);
      z.style.setProperty('--size', `${40 + i * 14}px`);
      sky.append(z);
    }
    scene.append(sky, h('div', 'sunset-ground'));
    stage.append(scene);
  });
}
