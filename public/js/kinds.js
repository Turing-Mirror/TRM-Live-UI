// 区域类型：fields 决定控制面板里能改什么，render 决定直播画面怎么画
// 新增一种区域时，在这里加一项，再到 config/settings.json 的 regions 里引用它
import { h } from './live.js';

export const kinds = {
  // 镂空区域，透出 OBS 里的画面
  hole: {
    transparent: true,
    fields: [],
    render() {},
  },

  title: {
    fields: [
      { key: 'badge', label: '角标' },
      { key: 'main', label: '节目名' },
      { key: 'sub', label: '本期标题' },
    ],
    render(el, data) {
      if (data.badge) el.append(h('span', 'badge', data.badge));
      el.append(h('span', 'title-main', data.main ?? ''));
      if (data.sub) el.append(h('span', 'title-sub', data.sub));
    },
  },

  status: {
    fields: [{ key: 'text', label: '状态文字' }],
    render(el, data, region) {
      el.append(h('span', 'status-text', data.text ?? ''));
      if (region.options?.clock) {
        const clock = h('span', 'status-clock');
        clock.dataset.clock = '';
        el.append(clock);
      }
    },
  },

  notice: {
    fields: [
      { key: 'heading', label: '标题' },
      { key: 'body', label: '内容', type: 'textarea' },
    ],
    render(el, data) {
      el.append(h('div', 'notice-heading', data.heading ?? ''), h('div', 'notice-body', data.body ?? ''));
    },
  },

  ticker: {
    fields: [
      { key: 'label', label: '标签' },
      { key: 'text', label: '字幕内容' },
      { key: 'scroll', label: '滚动', type: 'toggle' },
    ],
    render(el, data, region, settings) {
      if (data.label) el.append(h('span', 'ticker-label', data.label));
      const viewport = h('div', 'ticker-viewport');
      const track = h('div', 'ticker-track');
      track.append(h('span', 'ticker-item', data.text ?? ''));
      viewport.append(track);
      el.append(viewport);
      if (!data.scroll || !data.text) return;

      // 从右边进入，完全走出左边后再从右边重新进入
      requestAnimationFrame(() => {
        const from = viewport.clientWidth;
        const to = -track.offsetWidth;
        track.style.setProperty('--from', `${from}px`);
        track.style.setProperty('--to', `${to}px`);
        track.style.animationDuration = `${(from - to) / settings.ticker.speed}s`;
        track.classList.add('scrolling');
      });
    },
  },
};
