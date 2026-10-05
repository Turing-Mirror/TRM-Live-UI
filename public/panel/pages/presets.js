// 预设：把内容页现在的文字存起来，以后一键载入
import { t } from '../../core/i18n.js';
import { el, pagePad, pageHead, block, group, field, btn, textInput, listItem, empty } from '../ui.js';

export function presetsPage(ctx) {
  const name = textInput({
    id: 'preset-name',
    value: ctx.view.presetName ?? '',
    placeholder: t('presets.namePlaceholder'),
    maxLength: 80,
    onInput: (value) => { ctx.view.presetName = value; },
  });
  const save = btn({ label: t('presets.save'), onClick: () => ctx.actions.savePreset(name.value) });
  name.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') save.click();
  });
  const list = el('div');

  const fill = (next) => {
    list.replaceChildren(next.presets.length
      ? group(...next.presets.map((preset) => listItem({
        title: preset,
        right: [
          btn({ label: t('presets.load'), onClick: () => next.actions.applyPreset(preset) }),
          btn({ label: t('presets.remove'), onClick: () => next.actions.removePreset(preset) }),
        ],
      })))
      : group(empty({ title: t('presets.empty'), desc: t('presets.emptyDesc') })));
  };

  const root = pagePad(
    pageHead({ title: t('nav.presets'), sub: t('presets.sub') }),
    block({ title: t('presets.saveTitle') }, group(el('div', { class: 'fields' },
      field({ id: 'preset-name', label: t('presets.name'), note: t('presets.saveNote'), control: el('div', { class: 'field-row' }, name, save) })))),
    block({ title: t('presets.listTitle') }, list),
  );
  fill(ctx);
  return { el: root, update: fill };
}
