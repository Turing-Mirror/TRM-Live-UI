// 设置：界面语言、OBS 要用的地址、版本信息
import { t, currentLanguage } from '../../core/i18n.js';
import { el, pagePad, pageHead, block, group, field, select, btn, listItem, notify } from '../ui.js';

async function copy(textValue) {
  try {
    await navigator.clipboard.writeText(textValue);
    notify(t('settings.copied'), 'ok');
  } catch {
    notify(t('settings.copyFailed'), 'error');
  }
}

export function settingsPage(ctx) {
  const origin = location.origin;
  const overlayUrl = `${origin}/overlay`;
  const panelUrl = `${origin}/panel`;
  const { engine } = ctx.state;

  const root = pagePad(
    pageHead({ title: t('nav.settings'), sub: t('settings.sub') }),
    block({ title: t('settings.general') }, group(el('div', { class: 'fields' },
      field({
        inline: true,
        label: t('settings.language'),
        control: select({
          value: currentLanguage(),
          width: 160,
          options: ctx.locales.map((locale) => ({ id: locale.id, label: locale.name })),
          onChange: (id) => ctx.actions.setLanguage(id),
        }),
      })))),
    block({ title: t('settings.obs'), note: t('settings.obsNote') }, group(
      listItem({ title: t('settings.overlayUrl'), desc: overlayUrl, right: [btn({ label: t('settings.copy'), onClick: () => copy(overlayUrl) })] }),
      listItem({ title: t('settings.panelUrl'), desc: panelUrl, right: [btn({ label: t('settings.copy'), onClick: () => copy(panelUrl) })] }),
    )),
    block({ title: t('settings.about') }, group(
      listItem({ title: t('settings.engine'), right: [el('span', { class: 'list-desc' }, `v${engine.version}`)] }),
      listItem({ title: t('settings.packFormat'), right: [el('span', { class: 'list-desc' }, String(engine.packFormat))] }),
      listItem({ title: t('settings.dataFormat'), right: [el('span', { class: 'list-desc' }, String(engine.dataFormat))] }),
      listItem({ title: t('settings.componentApi'), right: [el('span', { class: 'list-desc' }, String(engine.componentApi))] }),
    )),
  );
  return { el: root };
}
