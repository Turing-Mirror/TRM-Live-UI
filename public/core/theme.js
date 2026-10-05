// 把 UI 包的 theme 写成 CSS 变量，样式里统一用变量取值：
//   colors.x  → --color-x        sizes.x → --size-x（px）
//   fonts.x   → --font-x         palette → --palette-0 … 与 --palette-count
//   radius    → --radius（px）
export function applyTheme(theme, root = document.documentElement) {
  const set = (name, value) => root.style.setProperty(name, value);
  for (const [name, value] of Object.entries(theme.fonts ?? {})) set(`--font-${name}`, `'${value}'`);
  for (const [name, value] of Object.entries(theme.colors ?? {})) set(`--color-${name}`, value);
  for (const [name, value] of Object.entries(theme.sizes ?? {})) set(`--size-${name}`, `${value}px`);
  const palette = theme.palette ?? [];
  palette.forEach((value, i) => set(`--palette-${i}`, value));
  set('--palette-count', String(palette.length));
  if (theme.radius !== undefined) set('--radius', `${theme.radius}px`);
}
