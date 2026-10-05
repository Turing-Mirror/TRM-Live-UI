// 控制面板：TRM UI 式的侧栏外壳，五个页面（直播、内容、预设、界面库、设置）
//
// 数据流：服务端通过 /events 推送完整状态 → 这里更新 store → 当前页面 update(ctx)。
// 文字改动先放在草稿里，点“更新到直播”才发给服务端；状态切换点一下立即生效。
import { api, subscribe } from '../core/api.js';
import { setLanguage, currentLanguage, t, localize, describe } from '../core/i18n.js';
import { preparePack } from '../core/pack.js';
import { el, iconBtn, notify, dialog } from './ui.js';
import { icon } from './icons.js';
import { livePage } from './pages/live.js';
import { contentPage } from './pages/content.js';
import { presetsPage } from './pages/presets.js';
import { libraryPage } from './pages/library.js';
import { settingsPage } from './pages/settings.js';

/** 导航顺序就是换页动画的方向依据：靠后的页在下面。 */
const NAV = [
  { id: 'live', icon: 'play', create: livePage },
  { id: 'content', icon: 'edit', create: contentPage },
  { id: 'presets', icon: 'layers', create: presetsPage },
  { id: 'library', icon: 'grid', create: libraryPage },
  { id: 'settings', icon: 'settings', create: settingsPage, foot: true },
];
const NARROW = 900;
const LEAVE_MS = 180;

const $ = (id) => document.getElementById(id);

const store = {
  state: null,
  registry: null,
  loadIssues: [],
  packKey: null,
  draft: { regions: {}, screens: {} },
  formVersion: 0,
  presets: [],
  packs: [],
  locales: [],
  online: false,
  page: NAV.some((item) => item.id === location.hash.slice(1)) ? location.hash.slice(1) : 'live',
  view: { contentTab: 'regions', presetName: '' },
  sidebarOpen: readPref('sidebarOpen', true),
};

// 侧栏展开与否只是这个浏览器里的偏好，存不下也不影响使用
function readPref(key, fallback) {
  try {
    const value = localStorage.getItem(`trm-live:${key}`);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}
function writePref(key, value) {
  try {
    localStorage.setItem(`trm-live:${key}`, JSON.stringify(value));
  } catch {
    // 忽略：隐私模式等情况下存不了
  }
}

const clone = (value) => JSON.parse(JSON.stringify(value));
const published = () => ({ regions: store.state.content.regions, screens: store.state.content.screens });
const isDirty = () => Boolean(store.state?.content) && JSON.stringify(store.draft) !== JSON.stringify(published());
const isItemDirty = (group, id) => JSON.stringify(store.draft[group][id] ?? {}) !== JSON.stringify(published()[group][id] ?? {});

function resetDraft(content) {
  store.draft = clone(content);
  store.formVersion += 1;
}

const report = (err) => notify(describe(err), 'error');

// ---- 动作：页面通过 ctx.actions 调用 ----

const actions = {
  go: (page) => showPage(page),

  async switchScene(id) {
    const scene = store.state.pack.manifest.scenes.items.find((item) => item.id === id);
    if (!scene || id === store.state.content.scene) return;
    try {
      await api.setScene(id);
      notify(t('scenes.switched', { name: localize(scene.label) || id }));
    } catch (err) {
      report(err);
    }
  },

  edited() {
    refresh();
  },

  async publish() {
    if (!isDirty()) return;
    try {
      await api.saveContent(store.draft);
      notify(t('publish.done', { time: new Date().toLocaleTimeString(currentLanguage(), { hour12: false }) }), 'ok');
    } catch (err) {
      report(err);
    }
  },

  async discard() {
    if (!isDirty()) return;
    if (!await dialog({ title: t('content.discardTitle'), body: t('content.discardBody'), confirm: t('content.discard'), danger: true })) return;
    resetDraft(published());
    refresh();
  },

  async savePreset(name) {
    const clean = String(name ?? '').trim();
    if (!clean) return notify(t('presets.needName'), 'warn');
    if (store.presets.includes(clean) && !await dialog({ title: t('presets.replaceTitle', { name: clean }), body: t('presets.replaceBody'), confirm: t('presets.replace') })) return;
    try {
      store.presets = await api.presets.save(clean, store.draft);
      store.view.presetName = '';
      notify(t('presets.saved', { name: clean }), 'ok');
      rebuildPage();
    } catch (err) {
      report(err);
    }
  },

  async applyPreset(name) {
    try {
      const preset = await api.presets.load(name);
      // 预设里没有的条目保留现有内容
      const draft = clone(store.draft);
      for (const group of ['regions', 'screens']) {
        for (const [id, fields] of Object.entries(preset[group] ?? {})) draft[group][id] = { ...draft[group][id], ...fields };
      }
      resetDraft(draft);
      notify(t('presets.loaded', { name }), 'ok');
      showPage('content');
      refresh();
    } catch (err) {
      report(err);
    }
  },

  async removePreset(name) {
    if (!await dialog({ title: t('presets.confirmRemove', { name }), confirm: t('presets.remove'), danger: true })) return;
    try {
      store.presets = await api.presets.remove(name);
      notify(t('presets.removed', { name }));
      refresh();
    } catch (err) {
      report(err);
    }
  },

  async usePack(pack) {
    const name = localize(pack.name) || pack.id;
    const body = [t('packs.confirmUseBody')];
    if (isDirty()) body.push(t('packs.confirmDiscard'));
    if (!await dialog({ title: t('packs.confirmUse', { name }), body, confirm: t('packs.use') })) return;
    try {
      await api.setConfig({ activePack: pack.id });
    } catch (err) {
      report(err);
    }
  },

  /** 导入：先让服务端检查并说明这个包（含不含脚本、会不会覆盖），确认后才安装。 */
  async importPack(file) {
    try {
      const info = await api.pack.inspect(file);
      const name = localize(info.name) || info.id || file.name;
      const errors = info.issues.filter((issue) => issue.level === 'error');
      if (errors.length) {
        await dialog({ title: t('packs.importRejected', { name }), body: errors.map(describe), cancel: null });
        return;
      }
      if (info.exists === 'builtin') {
        await dialog({ title: t('packs.importRejected', { name }), body: describe({ code: 'pack.builtinConflict', params: { id: info.id } }), cancel: null });
        return;
      }
      const body = [t('packs.importBody', { version: info.version, madeWith: info.madeWith })];
      if (info.components) body.push(t('packs.scriptWarning', { count: info.components }));
      if (info.exists === 'user') body.push(t('packs.replaceWarning'));
      if (!await dialog({ title: t('packs.confirmImport', { name }), body, confirm: t('packs.import') })) return;
      await api.pack.install(file, info.exists === 'user');
      notify(t('packs.importDone', { name }), 'ok');
      await loadPacks();
    } catch (err) {
      report(err);
    }
  },

  async removePack(pack) {
    const name = localize(pack.name) || pack.id;
    if (!await dialog({ title: t('packs.confirmRemove', { name }), body: t('packs.removeBody'), confirm: t('packs.remove'), danger: true })) return;
    try {
      store.packs = await api.pack.remove(pack.id);
      notify(t('packs.removed', { name }));
      refresh();
    } catch (err) {
      report(err);
    }
  },

  async setLanguage(id) {
    try {
      await api.setConfig({ language: id });
    } catch (err) {
      report(err);
    }
  },
};

function context() {
  return {
    state: store.state,
    registry: store.registry,
    loadIssues: store.loadIssues,
    draft: store.draft,
    formVersion: store.formVersion,
    presets: store.presets,
    packs: store.packs,
    locales: store.locales,
    view: store.view,
    page: store.page,
    isDirty,
    isItemDirty,
    actions,
  };
}

// ---- 外壳：侧栏 ----

function sideItem({ iconNode, label, on, dot, key, onClick, title, scene = false }) {
  const cls = ['side-item', scene ? 'is-scene' : '', on ? 'is-on' : ''].filter(Boolean).join(' ');
  const current = on ? (scene ? 'true' : 'page') : null;
  return el('button', { type: 'button', class: cls, 'aria-current': current, title, onclick: onClick },
    iconNode,
    el('span', { class: 'side-label' }, label),
    key ? el('kbd', { class: 'side-key' }, key) : null,
    dot ? el('span', { class: 'side-dot', 'aria-label': dot }) : null);
}

function renderSidebar() {
  const navItem = (item) => sideItem({
    iconNode: icon(item.icon),
    label: t(`nav.${item.id}`),
    title: collapsed() ? t(`nav.${item.id}`) : null,
    on: store.page === item.id,
    dot: item.id === 'content' && isDirty() ? t('publish.pending') : null,
    onClick: () => showPage(item.id),
  });
  const main = NAV.filter((item) => !item.foot).map(navItem);
  const scenes = store.state?.pack?.manifest.scenes.items ?? [];
  if (scenes.length > 1) {
    main.push(el('div', { class: 'side-head' }, t('scenes.title')));
    scenes.forEach((scene, i) => {
      const label = localize(scene.label) || scene.id;
      main.push(sideItem({
        iconNode: el('span', { class: 'scene-mark', 'aria-hidden': 'true' }),
        label,
        title: collapsed() ? label : null,
        key: i < 9 ? `Alt+${i + 1}` : null,
        scene: true,
        on: scene.id === store.state.content.scene,
        onClick: () => actions.switchScene(scene.id),
      }));
    });
  }
  $('sidebar-main').replaceChildren(...main);
  $('sidebar-foot').replaceChildren(...NAV.filter((item) => item.foot).map(navItem));
  $('sidebar').setAttribute('aria-label', t('nav.label'));
}

const collapsed = () => innerWidth < NARROW || !store.sidebarOpen;

function renderShell() {
  $('shell').classList.toggle('is-collapsed', collapsed());
  $('sidebar-toggle').replaceChildren(iconBtn({
    name: 'sidebar',
    label: t(collapsed() ? 'nav.expand' : 'nav.collapse'),
    onClick: () => {
      store.sidebarOpen = collapsed();
      writePref('sidebarOpen', store.sidebarOpen);
      renderShell();
      renderSidebar();
    },
  }));
  const status = $('connection');
  status.textContent = t(store.online ? 'connection.online' : 'connection.offline');
  status.dataset.online = String(store.online);
}

// ---- 页面：侧栏式换页，往下走新页从下方浮上来，往上走从上方落下来 ----

let current = null;

function mountPage(id, animation) {
  const def = NAV.find((item) => item.id === id);
  const page = def.create(context());
  const node = el('div', { class: `page${animation ? ` ${animation}` : ''}`, 'data-page': id }, page.el);
  $('main').append(node);
  return { id, node, page };
}

function showPage(id) {
  if (!store.state?.pack && id !== 'settings') id = 'settings';
  const from = NAV.findIndex((item) => item.id === store.page);
  const to = NAV.findIndex((item) => item.id === id);
  store.page = id;
  history.replaceState(null, '', `#${id}`);
  renderSidebar();
  if (current?.id === id) return;
  const down = to >= from;
  if (current) {
    const old = current.node;
    old.classList.add(down ? 'page-leave-u' : 'page-leave-d');
    setTimeout(() => old.remove(), LEAVE_MS);
  }
  current = mountPage(id, current ? (down ? 'page-enter-u' : 'page-enter-d') : null);
}

/** 原地重建当前页（换语言、换包、预设列表变了），保留滚动位置，不放换页动画。 */
function rebuildPage() {
  if (!current) return showPage(store.page);
  const scroll = current.node.scrollTop;
  current.node.remove();
  current = mountPage(store.page, null);
  current.node.scrollTop = scroll;
}

function refresh() {
  renderSidebar();
  current?.page.update?.(context());
}

// ---- 数据 ----

async function loadPresets() {
  try {
    store.presets = store.state?.pack ? await api.presets.list() : [];
  } catch (err) {
    store.presets = [];
    report(err);
  }
}

async function loadPacks() {
  try {
    store.packs = await api.packs();
  } catch (err) {
    store.packs = [];
    report(err);
  }
  refresh();
}

async function loadLocales() {
  try {
    store.locales = await api.locales();
  } catch {
    store.locales = [];
  }
}

async function onState(next) {
  const previous = store.state;
  store.state = next;
  store.online = true;

  const languageChanged = previous?.config.language !== next.config.language;
  if (languageChanged) {
    await setLanguage(next.config.language);
    document.title = 'TRM Live UI';
  }

  const packKey = next.pack ? `${next.pack.id}:${next.pack.revision}` : null;
  const packChanged = packKey !== store.packKey;
  if (packChanged) {
    store.packKey = packKey;
    if (next.pack) {
      const { registry, issues } = await preparePack(next);
      store.registry = registry;
      store.loadIssues = issues;
    }
    await Promise.all([loadPresets(), loadPacks(), store.locales.length ? null : loadLocales()]);
  }

  // 草稿没有改动时跟随服务端；有改动时保留，避免覆盖正在编辑的内容
  if (next.content) {
    const wasClean = !previous?.content || JSON.stringify(store.draft) === JSON.stringify({
      regions: previous.content.regions, screens: previous.content.screens,
    });
    if (packChanged || wasClean) resetDraft({ regions: next.content.regions, screens: next.content.screens });
  }

  renderShell();
  if (!current || languageChanged || packChanged) {
    if (current) rebuildPage();
    else showPage(store.page);
  } else {
    refresh();
  }
}

// ---- 快捷键 ----

document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    actions.publish();
  }
  // Alt + 数字：切换到第几个状态
  if (event.altKey && /^[1-9]$/.test(event.key) && store.state?.pack) {
    const scene = store.state.pack.manifest.scenes.items[Number(event.key) - 1];
    if (scene) {
      event.preventDefault();
      actions.switchScene(scene.id);
    }
  }
});

// 地址栏里的 #页面 改变时（前进后退、手动输入）跟着换页
addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (store.state && NAV.some((item) => item.id === id) && id !== store.page) showPage(id);
});

addEventListener('resize', () => {
  if (!store.state) return;
  const before = $('shell').classList.contains('is-collapsed');
  if (before !== collapsed()) {
    renderShell();
    renderSidebar();
  }
});

let queue = Promise.resolve();
subscribe(
  (state) => { queue = queue.then(() => onState(state)).catch((err) => console.error(err)); },
  (online) => {
    store.online = online;
    if (store.state) renderShell();
  },
);
