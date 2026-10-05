// 内容：改文字，点“更新到直播”生效。改过还没更新的一节，标题旁亮一个小圆点。
import { t, text, localize } from '../../core/i18n.js';
import { el, pagePad, pageHead, block, group, field, btn, tabs, textInput, textArea, checkbox, empty } from '../ui.js';

let uid = 0;

function control(fieldDef, values, onChange) {
  const id = `field-${uid += 1}`;
  const value = values?.[fieldDef.key];
  if (fieldDef.type === 'textarea') return { id, node: textArea({ id, value: value ?? '', onInput: onChange }) };
  if (fieldDef.type === 'toggle') return { id, node: checkbox({ id, checked: Boolean(value), onChange }), inline: true };
  if (fieldDef.type === 'time') return { id, node: textInput({ id, type: 'time', value: value ?? '', onInput: onChange }) };
  return { id, node: textInput({ id, value: value ?? '', onInput: onChange }) };
}

/** 一个区域或一个等待画面：一节标题加一组字段。 */
function itemBlock(ctx, groupName, item) {
  const kind = ctx.registry.kinds.get(item.kind);
  const values = ctx.draft[groupName];
  let body;
  if (!kind) {
    body = empty({ title: t('error.kind.unknown', { kind: item.kind }) });
  } else {
    body = el('div', { class: 'fields' }, kind.fields.map((fieldDef) => {
      const { id, node, inline } = control(fieldDef, values[item.id], (value) => {
        values[item.id] = { ...values[item.id], [fieldDef.key]: value };
        ctx.actions.edited();
      });
      return field({ id, label: text(fieldDef.label), control: node, inline });
    }));
  }
  const section = block({ title: localize(item.label) || item.id, note: t('content.pending'), dot: true }, group(body));
  section.dataset.group = groupName;
  section.dataset.id = item.id;
  return section;
}

function items(ctx) {
  const { manifest } = ctx.state.pack;
  const regions = manifest.regions
    .filter((region) => ctx.registry.kinds.get(region.kind)?.fields.length !== 0)
    .map((region) => ({ id: region.id, kind: region.kind, label: region.label }));
  const screens = manifest.scenes.items
    .filter((scene) => scene.screen)
    .map((scene) => ({ id: scene.id, kind: scene.screen.kind, label: scene.label }));
  return { regions, screens };
}

export function contentPage(ctx) {
  const groups = items(ctx);
  const tabIds = ['regions', 'screens'].filter((id) => groups[id].length);
  let tab = tabIds.includes(ctx.view.contentTab) ? ctx.view.contentTab : tabIds[0];

  const discard = btn({ label: t('content.discard'), onClick: () => ctx.actions.discard() });
  const publish = btn({ label: t('publish.button'), primary: true, title: t('publish.hint'), onClick: () => ctx.actions.publish() });
  const body = el('div');

  const fill = (animate) => {
    body.replaceChildren(...(groups[tab] ?? []).map((item) => itemBlock(ctx, tab, item)));
    if (animate) {
      body.classList.remove('view-in');
      void body.offsetWidth;
      body.classList.add('view-in');
    }
    markDirty(ctx);
  };

  const markDirty = (next) => {
    const dirty = next.isDirty();
    discard.disabled = !dirty;
    publish.disabled = !dirty;
    body.querySelectorAll('.block[data-id]').forEach((section) => {
      section.classList.toggle('is-dirty', next.isItemDirty(section.dataset.group, section.dataset.id));
    });
  };

  const root = pagePad(
    pageHead({ title: t('nav.content'), sub: t('content.sub'), actions: [discard, publish] }),
    tabIds.length > 1 ? tabs({
      value: tab,
      options: tabIds.map((id) => ({ id, label: t(`content.${id}`) })),
      onChange: (id) => {
        tab = id;
        ctx.view.contentTab = id;
        fill(true);
      },
    }) : null,
    tabIds.length ? body : empty({ title: t('content.none') }),
  );
  fill(false);

  let formVersion = ctx.formVersion;
  return {
    el: root,
    update(next) {
      // 草稿被整体替换时（服务端同步、载入预设、撤销）重画字段，否则只更新标记
      if (next.formVersion !== formVersion) {
        formVersion = next.formVersion;
        Object.assign(ctx, next);
        fill(false);
      } else {
        markDirty(next);
      }
    },
  };
}
