// 幕布：所有等待画面共用的一层，盖住 pack.json 里 scenes.curtain 指定的区域。
//
// 切换规则：
//   直播中 → 等待画面    幕布从左向右合上，盖严之后文字和动画再依次浮现
//   等待画面 → 等待画面  幕布不动，旧内容很快淡出，新内容从去向一侧浮上来
//   等待画面 → 直播中    内容先淡出，幕布再向右收起
// 幕布在两种等待画面之间始终是合上的，所以下面的直播内容不会露出来。
// 幕布的开合用 CSS 过渡；中途改变方向时会从当前位置平滑折返，不会跳。
import { h, reflow } from '../core/dom.js';

/** 与 overlay.css 里的时长一致。 */
const TIMING = {
  enterAfterOpen: 420,  // 幕布合上后内容开始浮现
  enterAfterSwap: 60,   // 等待画面之间切换时，新内容跟在旧内容后面
  leave: 180,           // 旧内容淡出
  close: 760,           // 幕布收起：0.1s 等内容淡出 + 0.07s 两层错开 + 0.56s 收起
};

export function createCurtain(rect, order) {
  const root = h('div', 'curtain');
  Object.assign(root.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` });
  const edge = h('div', 'curtain-layer curtain-edge');
  const body = h('div', 'curtain-layer curtain-body');
  root.append(edge, body);

  const screens = new Map();
  let currentId = null;
  let closeTimer;

  function addScreen(sceneId, el) {
    el.classList.add('screen');
    body.append(el);
    screens.set(sceneId, el);
  }

  function enter(el, delay, instant) {
    el.classList.remove('is-leaving', 'is-current');
    el.classList.toggle('is-settled', instant);
    el.style.setProperty('--enter-delay', `${delay}ms`);
    reflow(el);
    el.classList.add('is-current');
  }

  function leave(el) {
    el.classList.remove('is-current');
    el.classList.add('is-leaving');
    setTimeout(() => el.classList.remove('is-leaving'), TIMING.leave);
  }

  function open() {
    clearTimeout(closeTimer);
    const wasOpen = root.classList.contains('is-open');
    root.classList.remove('is-closing');
    root.classList.add('is-open');
    return wasOpen;
  }

  function close() {
    root.classList.remove('is-open');
    root.classList.add('is-closing');
    clearTimeout(closeTimer);
    // 收起后回到左侧待命，下次仍从左边合上；此时完全看不见，复位不会被看到
    closeTimer = setTimeout(() => root.classList.remove('is-closing'), TIMING.close);
  }

  /** 切到某个状态。instant 用于页面刚打开时：直接到位，不放动画。 */
  function show(sceneId, { instant = false } = {}) {
    const target = screens.get(sceneId) ?? null;
    const previous = screens.get(currentId) ?? null;
    if (target === previous && !instant) return;

    const step = order.indexOf(sceneId) - order.indexOf(currentId);
    root.style.setProperty('--swap-dx', step < 0 ? '-36px' : '36px');
    root.style.setProperty('--swap-ox', step < 0 ? '20px' : '-20px');
    currentId = sceneId;

    if (instant) root.classList.add('is-instant');
    if (previous && previous !== target) leave(previous);
    if (target) {
      const wasOpen = open();
      enter(target, wasOpen ? TIMING.enterAfterSwap : TIMING.enterAfterOpen, instant);
    } else {
      close();
    }
    // 先让浏览器按“无过渡”算出最终位置，再去掉标记；不依赖动画帧，页面在后台时也可靠
    if (instant) {
      reflow(edge);
      reflow(body);
      root.classList.remove('is-instant');
    }
  }

  return { el: root, addScreen, show };
}
