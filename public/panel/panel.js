// 控制面板
//
// 数据流：服务端通过 /events 推送完整状态 → 面板据此重画。
// 文字改动先放在草稿里，点“更新到直播”才发给服务端；状态切换点一下立即生效。
import { api, subscribe } from '../core/api.js';
import { h } from '../core/dom.js';
import { setLanguage, currentLanguage, t, localize, describe, translatePage } from '../core/i18n.js';
import { preparePack } from '../core/pack.js';
import { renderCards, markDirty } from './form.js';

const $ = (id) => document.getElementById(id);

const store = {
  state: null,
  registry: null,
  loadIssues: [],
  packKey: null,
  draft: { regions: {}, screens: {} },
  presets: [],
  packs: [],
  locales: [],
  flash: null,
  online: false,
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const published = () => ({ regions: store.state.content.regions, screens: store.state.content.screens });
const isDirty = () => JSON.stringify(store.draft) !== JSON.stringify(published());

// 顶栏右侧的一句提示：改动、更新、失败等
function flash(message, tone = 'info') {
  store.flash = { message, tone };
  renderSaveState();
}

function renderSaveState() {
  const el = $('save-state');
  const dirty = store.state?.content && isDirty();
  const message = store.flash?.message ?? (dirty ? t('publish.pending') : '');
  el.textContent = message;
  el.dataset.tone = store.flash?.tone ?? (dirty ? 'pending' : 'info');
  $('publish').disabled = !dirty;
}

function renderConnection() {
  const el = $('connection');
  el.textContent = store.online ? t('connection.online') : t('connection.offline');
  el.dataset.online = String(store.online);
}

function report(err) {
  flash(describe(err), 'error');
}

// ---- 横幅：包不能用、改用了默认包、组件载入失败等 ----

function renderBanners() {
  const { state } = store;
  const items = [];
  if (!state.pack) items.push({ tone: 'error', text: t('banner.noPack') });
  if (state.fallbackFrom) items.push({ tone: 'warn', text: t('banner.fallback', { id: state.fallbackFrom }) });
  for (const issue of [...(state.pack?.issues ?? []), ...store.loadIssues]) {
    items.push({ tone: issue.level === 'error' ? 'error' : 'warn', text: describe(issue) });
  }
  $('banners').replaceChildren(...items.map((item) => h('div', `banner banner-${item.tone}`, item.text)));
}

// ---- 状态 ----

function renderScenes() {
  const { manifest } = store.state.pack;
  const current = store.state.content.scene;
  $('scenes').replaceChildren(...manifest.scenes.items.map((scene, i) => {
    const button = h('button', 'scene');
    button.type = 'button';
    button.setAttribute('aria-pressed', String(scene.id === current));
    button.append(h('span', 'scene-name', localize(scene.label) || scene.id));
    if (i < 9) button.append(h('kbd', 'scene-key', `Alt+${i + 1}`));
    button.addEventListener('click', () => switchScene(scene));
    return button;
  }));
}

async function switchScene(scene) {
  try {
    await api.setScene(scene.id);
    flash(t('scenes.switched', { name: localize(scene.label) || scene.id }));
  } catch (err) {
    report(err);
  }
}

// ---- 预设 ----

async function loadPresets() {
  try {
    store.presets = await api.presets.list();
  } catch (err) {
    store.presets = [];
    report(err);
  }
  renderPresets();
}

function renderPresets() {
  const list = $('presets');
  if (!store.presets.length) {
    list.replaceChildren(h('p', 'help', t('presets.empty')));
    return;
  }
  list.replaceChildren(...store.presets.map((name) => {
    const row = h('div', 'row');
    row.append(h('span', 'row-title', name));
    const load = h('button', 'btn btn-small', t('presets.load'));
    load.type = 'button';
    load.addEventListener('click', () => applyPreset(name));
    const remove = h('button', 'btn btn-small btn-quiet', t('presets.remove'));
    remove.type = 'button';
    remove.addEventListener('click', () => removePreset(name));
    row.append(load, remove);
    return row;
  }));
}

async function applyPreset(name) {
  try {
    const preset = await api.presets.load(name);
    // 预设里没有的条目保留现有内容
    for (const group of ['regions', 'screens']) {
      for (const [id, fields] of Object.entries(preset[group] ?? {})) {
        store.draft[group][id] = { ...store.draft[group][id], ...fields };
      }
    }
    $('preset-name').value = name;
    renderForms();
    flash(t('presets.loaded', { name }), 'pending');
  } catch (err) {
    report(err);
  }
}

async function removePreset(name) {
  if (!confirm(t('presets.confirmRemove', { name }))) return;
  try {
    store.presets = await api.presets.remove(name);
    renderPresets();
    flash(t('presets.removed', { name }));
  } catch (err) {
    report(err);
  }
}

$('preset-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = $('preset-name').value.trim();
  if (!name) return flash(t('presets.needName'), 'error');
  try {
    store.presets = await api.presets.save(name, store.draft);
    renderPresets();
    flash(t('presets.saved', { name }));
  } catch (err) {
    report(err);
  }
});

// ---- 界面库 ----

async function loadPacks() {
  try {
    store.packs = await api.packs();
  } catch (err) {
    store.packs = [];
    report(err);
  }
  renderPacks();
}

function renderPacks() {
  const activeId = store.state.pack?.id;
  // 使用中的在最前，其次是能用的
  const rank = (pack) => (pack.id === activeId ? 0 : pack.usable ? 1 : 2);
  const packs = [...store.packs].sort((a, b) => rank(a) - rank(b));
  $('packs').replaceChildren(...packs.map((pack) => {
    const row = h('div', `pack ${pack.usable ? '' : 'is-unusable'}`);
    const info = h('div', 'pack-info');
    info.append(h('span', 'row-title', localize(pack.name) || pack.id));
    const meta = [pack.version && `v${pack.version}`, pack.author].filter(Boolean).join(' · ');
    if (meta) info.append(h('span', 'meta', meta));
    if (pack.madeWith) info.append(h('span', 'tag', t('packs.madeWith', { version: pack.madeWith })));
    for (const issue of pack.issues) {
      info.append(h('span', `help ${issue.level === 'error' ? 'danger' : 'warn'}`, describe(issue)));
    }
    row.append(info);
    if (pack.id === activeId) {
      row.append(h('span', 'tag tag-accent', t('packs.active')));
    } else if (pack.usable) {
      const use = h('button', 'btn btn-small', t('packs.use'));
      use.type = 'button';
      use.addEventListener('click', () => usePack(pack));
      row.append(use);
    }
    return row;
  }));
}

async function usePack(pack) {
  if (isDirty() && !confirm(t('packs.confirmDiscard'))) return;
  if (!confirm(t('packs.confirmUse', { name: localize(pack.name) || pack.id }))) return;
  try {
    await api.setConfig({ activePack: pack.id });
  } catch (err) {
    report(err);
  }
}

// ---- 内容表单 ----

function cardItems(defs, labelOf) {
  return defs.map((def) => {
    const kind = store.registry.kinds.get(def.kind);
    return { id: def.id, label: labelOf(def), kind, kindName: def.kind, fields: kind?.fields ?? [] };
  });
}

function onEdit() {
  store.flash = null;
  markAllDirty();
  renderSaveState();
}

function markAllDirty() {
  const { regions, screens } = published();
  markDirty($('regions'), store.draft.regions, regions);
  markDirty($('screens'), store.draft.screens, screens);
}

function renderForms() {
  const { manifest } = store.state.pack;
  const regions = cardItems(manifest.regions.filter((r) => store.registry.kinds.get(r.kind)?.fields?.length !== 0), (r) => r.label);
  const screens = cardItems(
    manifest.scenes.items.filter((scene) => scene.screen).map((scene) => ({ ...scene.screen, id: scene.id, label: scene.label })),
    (s) => s.label,
  );
  renderCards($('regions'), regions, store.draft.regions, onEdit);
  renderCards($('screens'), screens, store.draft.screens, onEdit);
  $('screens-block').hidden = !screens.length;
  markAllDirty();
  renderSaveState();
}

async function publish() {
  if (!isDirty()) return;
  try {
    await api.saveContent(store.draft);
    const time = new Date().toLocaleTimeString(currentLanguage(), { hour12: false });
    flash(t('publish.done', { time }), 'ok');
  } catch (err) {
    report(err);
  }
}

$('publish').addEventListener('click', publish);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    publish();
  }
  // Alt + 数字：切换到第几个状态
  if (event.altKey && /^[1-9]$/.test(event.key) && store.state?.pack) {
    const scene = store.state.pack.manifest.scenes.items[Number(event.key) - 1];
    if (scene) {
      event.preventDefault();
      switchScene(scene);
    }
  }
});

// ---- 语言 ----

async function loadLocales() {
  try {
    store.locales = await api.locales();
  } catch {
    store.locales = [];
  }
  renderLanguage();
}

function renderLanguage() {
  const select = $('language');
  select.replaceChildren(...store.locales.map((locale) => {
    const option = h('option', '', locale.name);
    option.value = locale.id;
    return option;
  }));
  select.value = currentLanguage();
}

$('language').addEventListener('change', async (event) => {
  try {
    await api.setConfig({ language: event.target.value });
  } catch (err) {
    report(err);
  }
});

// ---- 收到新状态 ----

function renderStatic() {
  const { state } = store;
  translatePage();
  $('engine-version').textContent = `v${state.engine.version}`;
  $('pack-name').textContent = state.pack ? localize(state.pack.manifest.name) : '';
  if (state.pack) {
    const { width, height } = state.pack.manifest.canvas;
    $('preview').style.aspectRatio = `${width} / ${height}`;
  }
  renderLanguage();
  renderConnection();
}

async function onState(next) {
  const previous = store.state;
  store.online = true;
  store.state = next;
  const languageChanged = previous?.config.language !== next.config.language;
  if (languageChanged) await setLanguage(next.config.language);

  const packKey = next.pack ? `${next.pack.id}:${next.pack.revision}` : null;
  const packChanged = packKey !== store.packKey;
  if (packChanged) {
    store.packKey = packKey;
    if (next.pack) {
      const { registry, issues } = await preparePack(next);
      store.registry = registry;
      store.loadIssues = issues;
    }
    loadPresets();
    loadPacks();
  }

  if (languageChanged || packChanged) renderStatic();
  renderBanners();
  if (!next.pack) return;

  // 草稿没有改动时跟随服务端；有改动时保留，避免覆盖正在编辑的内容
  const draftIsClean = previous?.content && JSON.stringify(store.draft) === JSON.stringify({
    regions: previous.content.regions, screens: previous.content.screens,
  });
  if (packChanged || draftIsClean || !previous?.content) {
    store.draft = clone(published());
    renderForms();
  } else if (languageChanged) {
    renderForms();
  } else {
    markAllDirty();
  }
  renderScenes();
  if (languageChanged) {
    renderPresets();
    renderPacks();
  }
  renderSaveState();
}

let queue = Promise.resolve();
subscribe(
  (state) => { queue = queue.then(() => onState(state)).catch((err) => console.error(err)); },
  (online) => {
    store.online = online;
    if (store.state) renderConnection();
  },
);

loadLocales();
