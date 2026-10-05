// 几个页面共用的部分
import { t, describe } from '../../core/i18n.js';
import { btn, nudge } from '../ui.js';

/** 当前 UI 包的问题：改用了默认包、包里的提醒、组件载入失败。 */
export function packNudges(ctx) {
  const items = [];
  if (ctx.state.fallbackFrom) {
    items.push(nudge({
      title: t('banner.fallbackTitle'),
      text: t('banner.fallback', { id: ctx.state.fallbackFrom }),
      actions: ctx.page === 'library' ? [] : [btn({ label: t('nav.library'), onClick: () => ctx.actions.go('library') })],
    }));
  }
  const issues = [...(ctx.state.pack?.issues ?? []), ...ctx.loadIssues];
  if (issues.length) {
    items.push(nudge({ title: t('banner.issuesTitle'), text: issues.map(describe).join('\n') }));
  }
  return items;
}
