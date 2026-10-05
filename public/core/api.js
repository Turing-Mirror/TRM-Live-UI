// 与本地服务通信。接口说明见 server/http.js 顶部。

export class ApiError extends Error {
  constructor({ code, params } = {}) {
    super(code);
    this.code = code ?? 'request.failed';
    this.params = params ?? {};
  }
}

/** 订阅完整状态。onConnection(true/false) 报告连接情况，断开后浏览器会自动重连。 */
export function subscribe(onState, onConnection) {
  const source = new EventSource('/events');
  source.onmessage = (event) => onState(JSON.parse(event.data));
  source.onopen = () => onConnection?.(true);
  source.onerror = () => onConnection?.(false);
  return source;
}

async function request(method, url, body) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError({ code: 'request.offline' });
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.error ?? { code: 'request.failed', params: { status: res.status } });
  return data;
}

const presetUrl = (name) => `/api/presets/${encodeURIComponent(name)}`;

export const api = {
  state: () => request('GET', '/api/state'),
  packs: () => request('GET', '/api/packs'),
  locales: () => request('GET', '/api/locales'),
  setConfig: (patch) => request('PUT', '/api/config', patch),
  saveContent: (content) => request('PUT', '/api/content', content),
  setScene: (scene) => request('PUT', '/api/scene', { scene }),
  presets: {
    list: () => request('GET', '/api/presets'),
    load: (name) => request('GET', presetUrl(name)),
    save: (name, content) => request('PUT', presetUrl(name), content),
    remove: (name) => request('DELETE', presetUrl(name)),
  },
};
