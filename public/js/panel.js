import { subscribe, saveContent, applyTheme, h } from './live.js';
import { kinds } from './kinds.js';

const form = document.getElementById('form');
const statusEl = document.getElementById('status');
let state;
let dirty = false;

function setStatus(text) {
  statusEl.textContent = text;
}

function buildInput(field, value) {
  if (field.type === 'textarea') {
    const input = h('textarea', 'input');
    input.rows = 5;
    input.value = value ?? '';
    return input;
  }
  const input = h('input', field.type === 'toggle' ? 'toggle' : 'input');
  if (field.type === 'toggle') {
    input.type = 'checkbox';
    input.checked = Boolean(value);
  } else {
    input.type = 'text';
    input.value = value ?? '';
  }
  return input;
}

function build() {
  applyTheme(state.settings.theme);
  form.replaceChildren();
  for (const region of state.settings.regions) {
    const fields = kinds[region.kind]?.fields ?? [];
    if (!fields.length) continue;
    const card = h('section', 'card');
    card.append(h('h2', 'card-title', region.label ?? region.id));
    for (const field of fields) {
      const row = h('label', `row ${field.type === 'toggle' ? 'row-toggle' : ''}`);
      const input = buildInput(field, state.content[region.id]?.[field.key]);
      input.dataset.region = region.id;
      input.dataset.key = field.key;
      row.append(h('span', 'row-label', field.label), input);
      card.append(row);
    }
    form.append(card);
  }
}

function collect() {
  const content = structuredClone(state.content);
  form.querySelectorAll('[data-region]').forEach((input) => {
    const { region, key } = input.dataset;
    content[region] ??= {};
    content[region][key] = input.type === 'checkbox' ? input.checked : input.value;
  });
  return content;
}

async function publish(event) {
  event?.preventDefault();
  try {
    await saveContent(collect());
    dirty = false;
    setStatus(`已更新 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`);
  } catch (err) {
    setStatus(`更新失败：${err.message}`);
  }
}

form.addEventListener('input', () => {
  dirty = true;
  setStatus('有改动，尚未更新');
});
form.addEventListener('submit', publish);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.ctrlKey) publish(event);
});

subscribe((next) => {
  state = next;
  if (!dirty) build();
});
