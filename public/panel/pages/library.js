// 界面库：切换、导入、导出、删除 UI 包
import { t, localize, describe } from '../../core/i18n.js';
import { el, pagePad, pageHead, block, group, btn, listItem, empty } from '../ui.js';
import { api } from '../../core/api.js';
import { packNudges } from './shared.js';

function download(url) {
  const link = el('a', { href: url, download: '' });
  document.body.append(link);
  link.click();
  link.remove();
}

function packRow(ctx, pack) {
  const active = pack.id === ctx.state.pack?.id;
  const meta = [t(pack.builtin ? 'packs.sourceBuiltin' : 'packs.sourceImported'), pack.version && `v${pack.version}`, pack.author]
    .filter(Boolean).join(' · ');
  const lines = [];
  if (pack.madeWith) lines.push(el('span', { class: 'list-desc' }, t('packs.madeWith', { version: pack.madeWith })));
  for (const issue of pack.issues) {
    lines.push(el('span', { class: `list-desc ${issue.level === 'error' ? 'is-danger' : 'is-warn'}` }, describe(issue)));
  }
  const right = [];
  if (active) right.push(btn({ label: t('packs.active'), on: true, uw: true, disabled: true }));
  else if (pack.usable) right.push(btn({ label: t('packs.use'), uw: true, onClick: () => ctx.actions.usePack(pack) }));
  right.push(btn({ label: t('packs.export'), onClick: () => download(api.pack.exportUrl(pack.id)) }));
  if (!pack.builtin) right.push(btn({ label: t('packs.remove'), onClick: () => ctx.actions.removePack(pack) }));
  return listItem({ meta, title: localize(pack.name) || pack.id, desc: localize(pack.description), extra: lines, right });
}

export function libraryPage(ctx) {
  const file = el('input', { type: 'file', accept: '.zip,application/zip', hidden: true, onchange: (event) => {
    const [chosen] = event.target.files;
    event.target.value = '';
    if (chosen) ctx.actions.importPack(chosen);
  } });
  const nudges = el('div');
  const list = el('div');

  const fill = (next) => {
    nudges.replaceChildren(...packNudges({ ...next, page: 'library' }));
    // 使用中的在最前，其次是能用的
    const rank = (pack) => (pack.id === next.state.pack?.id ? 0 : pack.usable ? 1 : 2);
    const packs = [...next.packs].sort((a, b) => rank(a) - rank(b));
    list.replaceChildren(group(...(packs.length ? packs.map((pack) => packRow(next, pack)) : [empty({ title: t('packs.empty') })])));
  };

  const root = pagePad(
    pageHead({ title: t('nav.library'), sub: t('packs.sub'), actions: [btn({ label: t('packs.import'), onClick: () => file.click() })] }),
    file,
    nudges,
    block({ title: t('packs.listTitle'), note: t('packs.listNote') }, list),
  );
  fill(ctx);
  return { el: root, update: fill };
}
