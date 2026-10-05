// 内容表单：每个区域、每个等待画面一张卡片，字段来自组件的 fields 定义
import { h } from '../core/dom.js';
import { t, text, localize } from '../core/i18n.js';

let uid = 0;

function buildInput(field, value, onChange) {
  const id = `field-${uid += 1}`;
  let input;
  if (field.type === 'textarea') {
    input = h('textarea', 'input textarea');
    input.rows = 4;
    input.value = value ?? '';
    input.addEventListener('input', () => onChange(input.value));
  } else if (field.type === 'toggle') {
    input = h('input', 'switch');
    input.type = 'checkbox';
    input.checked = Boolean(value);
    input.addEventListener('change', () => onChange(input.checked));
  } else {
    input = h('input', 'input');
    input.type = field.type === 'time' ? 'time' : 'text';
    input.value = value ?? '';
    input.addEventListener('input', () => onChange(input.value));
  }
  input.id = id;
  return input;
}

/**
 * 画出一组卡片。
 * items:   [{ id, label, kind, fields }]，kind 为空表示组件不存在
 * values:  { id: { 字段: 值 } }，会被直接修改
 * onEdit:  有字段被改动时调用
 */
export function renderCards(container, items, values, onEdit) {
  container.replaceChildren();
  for (const item of items) {
    const card = h('article', 'card');
    card.dataset.id = item.id;
    const head = h('header', 'card-head');
    head.append(h('h3', 'card-title', localize(item.label) || item.id), h('span', 'card-dirty', t('publish.pending')));
    card.append(head);

    if (!item.kind) {
      card.append(h('p', 'help warn', t('error.kind.unknown', { kind: item.kindName })));
    } else if (!item.fields.length) {
      card.append(h('p', 'help', t('form.noFields')));
    }

    for (const field of item.fields) {
      const row = h('div', `field ${field.type === 'toggle' ? 'field-inline' : ''}`);
      const input = buildInput(field, values[item.id]?.[field.key], (value) => {
        values[item.id] = { ...values[item.id], [field.key]: value };
        onEdit();
      });
      const label = h('label', 'field-label', text(field.label));
      label.htmlFor = input.id;
      row.append(label, input);
      card.append(row);
    }
    container.append(card);
  }
}

/** 标出与已发布内容不同的卡片。 */
export function markDirty(container, values, published) {
  container.querySelectorAll('.card').forEach((card) => {
    const { id } = card.dataset;
    const dirty = JSON.stringify(values[id] ?? {}) !== JSON.stringify(published[id] ?? {});
    card.classList.toggle('is-dirty', dirty);
  });
}
