// 组件注册表：区域类型（kind）和动画（animation）
//
// 每加载一次 UI 包就新建一个注册表：先放入内置组件，再执行包里的组件脚本。
// 组件脚本默认导出一个函数，接收 api：
//
//   export default function setup(api) {
//     api.registerAnimation('wave', (stage, ctx) => { ... });
//     api.registerKind('clock', { fields: [...], render(el, data, def, ctx) { ... } });
//   }
//
// 这套接口的版本由服务端的 COMPONENT_API 决定（server/version.js），随状态一起传来。
// 接口有不兼容的改动时加一；UI 包在 pack.json 里用 componentApi 声明需要的版本。
import { h } from './dom.js';
import { builtinKinds } from './kinds.js';

/** 按序号循环取 UI 包调色板里的颜色。 */
export function paletteColor(index) {
  const count = Number(getComputedStyle(document.documentElement).getPropertyValue('--palette-count')) || 1;
  return `var(--palette-${index % count})`;
}

export function createRegistry(engine) {
  const kinds = new Map(Object.entries(builtinKinds));
  const animations = new Map();
  const api = {
    apiVersion: engine.componentApi,
    engineVersion: engine.version,
    h,
    paletteColor,
    registerKind(name, definition) {
      if (typeof definition?.render !== 'function') throw new Error(`Kind "${name}" needs a render function`);
      kinds.set(name, { fields: [], ...definition });
    },
    registerAnimation(name, play) {
      if (typeof play !== 'function') throw new Error(`Animation "${name}" must be a function`);
      animations.set(name, play);
    },
  };
  return { kinds, animations, api };
}
