// 控制面板的组件，照 TRM UI 的同名组件做成不依赖框架的版本（样式在 panel.css）。
// 每个函数返回一个元素；尺寸、间距、状态与 TRM UI 保持一致，改动时两边对照着改。
import { icon } from './icons.js';
import { t } from '../core/i18n.js';

/** 建元素：el('div', { class, onclick, style, ... }, 子元素或文字…)。文字一律作为文本插入。 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'style') Object.assign(node.style, value);
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key in node && typeof value !== 'string') node[key] = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

// ---- 布局 ----

export const pagePad = (...children) => el('div', { class: 'page-pad' }, ...children);

export function pageHead({ title, sub, actions }) {
  return el('div', { class: 'page-head' },
    el('div', {}, el('h2', { class: 'page-title' }, title), sub ? el('div', { class: 'page-sub' }, sub) : null),
    actions?.length ? el('div', { class: 'page-actions' }, actions) : null);
}

/** 一节：小标题、备注、右侧动作，下面是内容。dot 为真时标题旁亮一个小圆点（有未更新的改动）。 */
export function block({ title, note, action, dot = false, id }, ...children) {
  return el('section', { class: 'block', id },
    (title || note || action) ? el('div', { class: 'block-head' },
      title ? el('h3', { class: 'block-title' }, title, dot ? el('span', { class: 'dot', 'aria-hidden': 'true' }) : null) : null,
      note ? el('span', { class: 'block-note' }, note) : null,
      action ? el('span', { class: 'block-action' }, action) : null) : null,
    ...children);
}

export const group = (...children) => el('div', { class: 'group' }, ...children);

/** 设置项：标签在上、控件在下；inline 时标签在左、控件在右。项与项之间不画分隔线。 */
export function field({ label, desc, note, inline = false, control, id }) {
  const labelEl = el('label', { class: 'field-label', for: id }, label);
  return el('div', { class: `field${inline ? ' field-inline' : ''}` },
    inline ? el('div', { class: 'field-row' }, labelEl, el('div', { class: 'field-control' }, control)) : labelEl,
    desc ? el('div', { class: 'field-desc' }, desc) : null,
    inline ? null : control,
    note ? el('div', { class: 'field-note' }, note) : null);
}

/** 列表里的一行。 */
export function listItem({ meta, title, desc, extra, right }) {
  return el('div', { class: 'list-item' },
    el('div', { class: 'list-main' },
      meta ? el('span', { class: 'list-meta' }, meta) : null,
      title ? el('span', { class: 'list-title' }, title) : null,
      desc ? el('span', { class: 'list-desc' }, desc) : null,
      extra ?? null),
    right?.length ? el('div', { class: 'list-right' }, right) : null);
}

export function empty({ title, desc }) {
  return el('div', { class: 'empty' }, el('div', { class: 'empty-title' }, title), desc ? el('div', { class: 'empty-desc' }, desc) : null);
}

/** 顶部的一条提醒，带标题、说明和操作。tone：warn 或 danger。 */
export function nudge({ title, text, tone = 'warn', actions = [] }) {
  return el('div', { class: `nudge nudge-${tone}` },
    el('span', { class: 'nudge-icon' }, icon('alert', { size: 16 })),
    el('div', { class: 'nudge-body' }, el('div', { class: 'nudge-title' }, title), text ? el('div', { class: 'nudge-text' }, text) : null),
    actions.length ? el('div', { class: 'nudge-actions' }, actions) : null);
}

// ---- 控件 ----

/** 按钮。primary：实心强调色，一屏最多一个；on：已选中；uw：等宽，字数会变的按钮用。 */
export function btn({ label, primary = false, on = false, uw = false, disabled = false, title, onClick }) {
  const cls = ['btn', primary ? 'btn-primary' : on ? 'btn-on' : '', uw ? 'btn-uw' : ''].filter(Boolean).join(' ');
  return el('button', { type: 'button', class: cls, disabled, title, onclick: onClick }, label);
}

export function iconBtn({ name, label, onClick, active = false }) {
  return el('button', { type: 'button', class: `icon-btn${active ? ' is-active' : ''}`, 'aria-label': label, title: label, onclick: onClick }, icon(name));
}

export function textInput({ value = '', placeholder, onInput, type = 'text', id, width, maxLength }) {
  return el('input', {
    class: 'input', type, id, value, placeholder, maxLength,
    style: width ? { maxWidth: `${width}px` } : undefined,
    oninput: (event) => onInput?.(event.target.value),
  });
}

export function textArea({ value = '', onInput, id, rows = 4 }) {
  return el('textarea', { class: 'input textarea', id, rows, value, oninput: (event) => onInput?.(event.target.value) });
}

export function select({ value, options, onChange, width }) {
  const node = el('select', { class: 'select', style: width ? { minWidth: `${width}px` } : undefined, onchange: (event) => onChange(event.target.value) },
    options.map((option) => el('option', { value: option.id }, option.label)));
  node.value = value;
  return node;
}

/** 复选框：方形，选中时实心强调色加一个勾。 */
export function checkbox({ checked, label, onChange, id }) {
  const input = el('input', { type: 'checkbox', class: 'visually-hidden', id, checked, onchange: (event) => onChange(event.target.checked) });
  return el('label', { class: 'check' }, input, el('span', { class: 'check-box', 'aria-hidden': 'true' }), label ? el('span', { class: 'check-label' }, label) : null);
}

/**
 * 分段控件：一个滑块在选项之间滑动，而不是每个按钮各自画底色。
 * 返回的元素带 setValue(id)，外部状态变化时只移动滑块，不重建。
 */
export function segment({ value, options, onChange }) {
  const thumb = el('span', { class: 'seg-thumb', 'aria-hidden': 'true' });
  const buttons = new Map();
  const root = el('div', { class: 'seg', role: 'group' }, thumb);
  for (const option of options) {
    const button = el('button', { type: 'button', class: 'seg-item', 'aria-pressed': 'false', title: option.title, onclick: () => onChange(option.id) }, option.label);
    buttons.set(option.id, button);
    root.append(button);
  }
  let current = null;
  const place = (animate) => {
    const target = buttons.get(current);
    if (!target || !target.offsetWidth) return;
    thumb.classList.toggle('is-armed', animate);
    thumb.style.width = `${target.offsetWidth}px`;
    thumb.style.transform = `translateX(${target.offsetLeft - 3}px)`;
  };
  root.setValue = (id) => {
    const animate = current !== null && current !== id;
    current = id;
    for (const [key, button] of buttons) button.setAttribute('aria-pressed', String(key === id));
    place(animate);
  };
  // 挂到页面上、量得到宽度之后再放滑块
  new ResizeObserver(() => place(false)).observe(root);
  root.setValue(value);
  return root;
}

/** 下划线式标签页，指示条滑到选中的那一项。 */
export function tabs({ value, options, onChange }) {
  const bar = el('span', { class: 'tabs-bar', 'aria-hidden': 'true' });
  const root = el('div', { class: 'tabs', role: 'tablist' });
  const buttons = new Map();
  for (const option of options) {
    const button = el('button', { type: 'button', role: 'tab', class: 'tab', 'aria-selected': String(option.id === value), onclick: () => {
      if (option.id === current) return;
      choose(option.id, true);
      onChange(option.id);
    } }, option.label);
    buttons.set(option.id, button);
    root.append(button);
  }
  root.append(bar);
  let current = value;
  const place = (animate) => {
    const target = buttons.get(current);
    if (!target || !target.offsetWidth) return;
    bar.classList.toggle('is-armed', animate);
    bar.style.width = `${target.offsetWidth}px`;
    bar.style.transform = `translateX(${target.offsetLeft}px)`;
  };
  const choose = (id, animate) => {
    current = id;
    for (const [key, button] of buttons) button.setAttribute('aria-selected', String(key === id));
    place(animate);
  };
  new ResizeObserver(() => place(false)).observe(root);
  return root;
}

// ---- 浮层 ----

const OUT_MS = 200;

/** 右上角的消息：从右边滑进来，几秒后滑回去。tone：info、ok、warn、error。 */
export function notify(text, tone = 'info') {
  const stack = document.getElementById('notices');
  const card = el('div', { class: `notice notice-${tone}`, role: 'status' }, el('span', { class: 'notice-text' }, text));
  const row = el('div', { class: 'notice-row' }, el('div', { class: 'notice-clip' }, el('div', { class: 'notice-pad' }, card)));
  stack.append(row);
  const close = () => {
    card.classList.add('is-leaving');
    row.classList.add('is-leaving');
    setTimeout(() => row.remove(), 700);
  };
  card.addEventListener('click', close);
  setTimeout(close, tone === 'error' ? 6000 : 3200);
}

/**
 * 确认框，替代浏览器自带的 confirm/alert。返回 Promise<boolean>。
 * cancel 为 null 时只有一个按钮（相当于 alert）。Esc 或点遮罩等于取消。
 */
export function dialog({ title, body, confirm = t('dialog.ok'), cancel = t('dialog.cancel'), danger = false }) {
  return new Promise((resolve) => {
    const scrim = el('div', { class: 'scrim fade-in' });
    const done = (result) => {
      scrim.classList.replace('fade-in', 'fade-out');
      panel.classList.replace('pop-in', 'pop-out');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => scrim.remove(), OUT_MS);
      resolve(result);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') done(false);
    };
    const confirmBtn = btn({ label: confirm, primary: !danger, onClick: () => done(true) });
    if (danger) confirmBtn.classList.add('btn-danger');
    const panel = el('div', { class: 'dialog pop-in', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, onpointerdown: (event) => event.stopPropagation() },
      el('div', { class: 'dialog-title' }, title),
      body ? el('div', { class: 'dialog-body' }, ...[].concat(body).map((line) => el('p', {}, line))) : null,
      el('div', { class: 'dialog-actions' }, cancel ? btn({ label: cancel, onClick: () => done(false) }) : null, confirmBtn));
    scrim.append(panel);
    scrim.addEventListener('pointerdown', () => done(false));
    document.addEventListener('keydown', onKey);
    document.body.append(scrim);
    confirmBtn.focus();
  });
}
