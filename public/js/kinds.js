// 区域类型：fields 决定控制面板里能改什么，render 决定直播画面怎么画
// 新增一种区域时，在这里加一项，再到 config/settings.json 的 regions 里引用它
import { h } from './live.js';
import { animations } from './animations.js';

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
      el.append(h('div', 'notice-heading', data.heading ?? ''));
      if (data.body) el.append(h('div', 'notice-body', data.body));
    },
  },

  // 等待画面：开播前、稍后回来、即将下播等，切换到对应状态时盖住中间区域
  screen: {
    fields: [
      { key: 'kicker', label: '小标题' },
      { key: 'heading', label: '大标题' },
      { key: 'sub', label: '说明' },
      { key: 'time', label: '倒计时到（如 21:00，可留空）' },
    ],
    render(el, data, region) {
      const { animation, reserve = 0 } = region.options ?? {};
      el.style.setProperty('--reserve', `${reserve}px`);
      const text = h('div', 'screen-text');
      const items = [
        data.kicker && h('div', 'screen-kicker', data.kicker),
        data.heading && h('div', 'screen-heading', data.heading),
        data.sub && h('div', 'screen-sub', data.sub),
      ];
      if (data.time) {
        const countdown = h('div', 'screen-countdown');
        countdown.dataset.countdown = data.time;
        items.push(countdown);
      }
      items.filter(Boolean).forEach((item, i) => {
        item.style.setProperty('--i', i);
        text.append(item);
      });
      const stage = h('div', 'screen-stage');
      animations[animation]?.(stage);
      el.append(text, stage);
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
