// 直播：切换状态，看实时预览
import { t, localize } from '../../core/i18n.js';
import { el, pagePad, pageHead, block, group, segment } from '../ui.js';
import { packNudges } from './shared.js';

export function livePage(ctx) {
  const { manifest } = ctx.state.pack;
  const scenes = manifest.scenes.items;
  const seg = segment({
    value: ctx.state.content.scene,
    options: scenes.map((scene, i) => ({ id: scene.id, label: localize(scene.label) || scene.id, title: i < 9 ? `Alt+${i + 1}` : undefined })),
    onChange: (id) => ctx.actions.switchScene(id),
  });
  const { width, height } = manifest.canvas;
  const preview = el('div', { class: 'preview' },
    el('iframe', { src: '/overlay?preview=1', title: t('live.preview'), tabIndex: -1 }));
  preview.style.setProperty('--ratio', `${width} / ${height}`);
  const nudges = el('div');

  const root = pagePad(
    pageHead({ title: t('nav.live'), sub: t('live.sub', { name: localize(manifest.name) }) }),
    nudges,
    scenes.length > 1 ? block({ title: t('live.scenes'), note: t('live.scenesNote') }, seg) : null,
    block({ title: t('live.preview') }, group(preview)),
  );

  const update = (next) => {
    seg.setValue(next.state.content.scene);
    nudges.replaceChildren(...packNudges(next));
  };
  update(ctx);
  return { el: root, update };
}
