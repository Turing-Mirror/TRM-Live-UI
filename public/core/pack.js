// 载入当前 UI 包的字体、样式和组件。同一个包的同一次修订只载入一次。
//
// 直播画面需要全部三样；控制面板只要组件（读取字段定义），不能套用包的样式。
import { createRegistry } from './registry.js';

let loaded = null;

const url = (pack, file) => `${pack.base}${file}?v=${pack.revision}`;

async function loadFonts(pack, previous) {
  for (const face of previous ?? []) document.fonts.delete(face);
  const faces = pack.manifest.fonts.map((font) => new FontFace(font.family, `url("${url(pack, font.src)}")`, {
    weight: String(font.weight ?? 400),
    style: font.style ?? 'normal',
  }));
  const results = await Promise.allSettled(faces.map((face) => face.load()));
  const issues = [];
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') document.fonts.add(faces[i]);
    else issues.push({ level: 'warning', code: 'pack.fontFailed', params: { file: pack.manifest.fonts[i].src } });
  });
  return { faces, issues };
}

async function loadStyles(pack) {
  document.querySelectorAll('link[data-pack-style]').forEach((link) => link.remove());
  const issues = [];
  await Promise.all(pack.manifest.styles.map((file) => new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url(pack, file);
    link.dataset.packStyle = '';
    link.onload = resolve;
    link.onerror = () => {
      issues.push({ level: 'warning', code: 'pack.styleFailed', params: { file } });
      resolve();
    };
    document.head.append(link);
  })));
  return issues;
}

async function loadComponents(pack, registry) {
  const issues = [];
  for (const file of pack.manifest.components) {
    try {
      const mod = await import(url(pack, file));
      await mod.default?.(registry.api);
    } catch (err) {
      console.error(err);
      issues.push({ level: 'warning', code: 'pack.componentFailed', params: { file, message: err.message } });
    }
  }
  return issues;
}

/** 返回 { registry, issues }。issues 是载入时发现的问题，不会中断载入。 */
export async function preparePack(state, { fonts = false, styles = false } = {}) {
  const { pack, engine } = state;
  const key = `${pack.id}:${pack.revision}`;
  if (loaded?.key === key) return loaded;

  const registry = createRegistry(engine);
  const issues = [];
  let faces = loaded?.faces;
  if (fonts) {
    const result = await loadFonts(pack, faces);
    faces = result.faces;
    issues.push(...result.issues);
  }
  if (styles) issues.push(...await loadStyles(pack));
  issues.push(...await loadComponents(pack, registry));

  loaded = { key, registry, issues, faces };
  return loaded;
}
