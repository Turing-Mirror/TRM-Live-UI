// 内置的区域类型。所有 UI 包都能直接使用；外观由各包的样式决定。
//
// 每种类型：
//   fields  控制面板里能改的字段：{ key, label, type }
//           type 可为 text（默认）、textarea、toggle、time
//           label 可以是语言包里的 key，也可以是 { "zh-CN": …, "en-US": … } 这样的多语言文字
//   render(el, data, def, ctx)
//           el    区域对应的元素，每次内容变化时清空后重画
//           data  这个区域的内容
//           def   pack.json 里这个区域（或等待画面）的定义，options 在 def.options
//           ctx   { animations }：可用的动画
//   transparent  为 true 时在底色上挖空，透出 OBS 里的画面
import { h } from './dom.js';

export const builtinKinds = {
  hole: {
    transparent: true,
    fields: [],
    render() {},
  },

  title: {
    fields: [
      { key: 'badge', label: 'kind.title.badge' },
      { key: 'main', label: 'kind.title.main' },
      { key: 'sub', label: 'kind.title.sub' },
    ],
    render(el, data) {
      if (data.badge) el.append(h('span', 'title-badge', data.badge));
      el.append(h('span', 'title-main', data.main ?? ''));
      if (data.sub) el.append(h('span', 'title-sub', data.sub));
    },
  },

  status: {
    fields: [{ key: 'text', label: 'kind.status.text' }],
    render(el, data, def) {
      el.append(h('span', 'status-text', data.text ?? ''));
      if (def.options?.clock) {
        const clock = h('span', 'status-clock');
        clock.dataset.clock = '';
        el.append(clock);
      }
    },
  },

  notice: {
    fields: [
      { key: 'heading', label: 'kind.notice.heading' },
      { key: 'body', label: 'kind.notice.body', type: 'textarea' },
    ],
    render(el, data) {
      el.append(h('div', 'notice-heading', data.heading ?? ''));
      if (data.body) el.append(h('div', 'notice-body', data.body));
    },
  },

  // 从右侧进入，完全走出左侧后再从右侧进入。速度取 options.speed（像素每秒）。
  ticker: {
    fields: [
      { key: 'label', label: 'kind.ticker.label' },
      { key: 'text', label: 'kind.ticker.text' },
      { key: 'scroll', label: 'kind.ticker.scroll', type: 'toggle' },
    ],
    render(el, data, def) {
      if (data.label) el.append(h('span', 'ticker-label', data.label));
      const viewport = h('div', 'ticker-viewport');
      const track = h('div', 'ticker-track');
      track.append(h('span', 'ticker-item', data.text ?? ''));
      viewport.append(track);
      el.append(viewport);
      if (!data.scroll || !data.text) return;
      const speed = def.options?.speed ?? 90;
      requestAnimationFrame(() => {
        const from = viewport.clientWidth;
        const to = -track.offsetWidth;
        track.style.setProperty('--from', `${from}px`);
        track.style.setProperty('--to', `${to}px`);
        track.style.animationDuration = `${(from - to) / speed}s`;
        track.classList.add('is-scrolling');
      });
    },
  },

  // 等待画面：左侧文字，右侧动画。options.animation 选动画，options.reserve 给模型留出右侧空白。
  screen: {
    fields: [
      { key: 'kicker', label: 'kind.screen.kicker' },
      { key: 'heading', label: 'kind.screen.heading' },
      { key: 'sub', label: 'kind.screen.sub' },
      { key: 'time', label: 'kind.screen.time', type: 'time' },
    ],
    render(el, data, def, ctx) {
      const { animation, reserve = 0 } = def.options ?? {};
      el.style.setProperty('--reserve', `${reserve}px`);
      const text = h('div', 'screen-text');
      const items = [
        data.kicker && h('div', 'screen-kicker', data.kicker),
        data.heading && h('div', 'screen-heading', data.heading),
        data.sub && h('div', 'screen-sub', data.sub),
      ].filter(Boolean);
      if (data.time) {
        const countdown = h('div', 'screen-countdown');
        countdown.dataset.countdown = data.time;
        items.push(countdown);
      }
      items.forEach((item, i) => {
        item.style.setProperty('--i', i);
        text.append(item);
      });
      const stage = h('div', 'screen-stage');
      stage.style.setProperty('--i', items.length);
      ctx.animations.get(animation)?.(stage, ctx);
      el.append(text, stage);
    },
  },
};
