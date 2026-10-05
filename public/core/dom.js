/** 建一个元素。text 用 textContent 写入，不会被当成 HTML。 */
export function h(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined && text !== null) el.textContent = text;
  return el;
}

/** 强制浏览器先算一次布局，让紧接着加上的动画从头开始。 */
export const reflow = (el) => void el.offsetWidth;
