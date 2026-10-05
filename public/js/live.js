// 连接本地服务，配置或内容一有变化就回调
export function subscribe(onState) {
  const source = new EventSource('/events');
  source.onmessage = (event) => onState(JSON.parse(event.data));
  return source;
}

async function request(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(await res.text());
  return res.status === 204 ? null : res.json();
}

export const saveContent = (content) => request('/api/content', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(content),
});

const presetUrl = (name) => `/api/presets/${encodeURIComponent(name)}`;

export const presets = {
  list: () => request('/api/presets'),
  load: (name) => request(presetUrl(name)),
  save: (name, content) => request(presetUrl(name), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(content),
  }),
  remove: (name) => request(presetUrl(name), { method: 'DELETE' }),
};

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
