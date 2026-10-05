// 连接本地服务，配置或内容一有变化就回调
export function subscribe(onState) {
  const source = new EventSource('/events');
  source.onmessage = (event) => onState(JSON.parse(event.data));
  return source;
}

export async function saveContent(content) {
  const res = await fetch('/api/content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(content),
  });
  if (!res.ok) throw new Error(await res.text());
}

// 把 settings.theme 写成 CSS 变量
export function applyTheme(theme, root = document.documentElement) {
  for (const [name, value] of Object.entries(theme.fonts)) {
    root.style.setProperty(`--font-${name}`, `'${value}'`);
  }
  root.style.setProperty('--radius', `${theme.radius}px`);
  for (const [name, value] of Object.entries(theme.colors)) {
    root.style.setProperty(`--color-${name}`, value);
  }
  for (const [name, value] of Object.entries(theme.sizes)) {
    root.style.setProperty(`--size-${name}`, `${value}px`);
  }
}

export function h(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
