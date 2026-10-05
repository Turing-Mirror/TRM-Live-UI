# TRM Live UI 开发说明

中文 | [English](develop.en.md) | [日本語](develop.ja.md)

本文写给制作 UI 包的人和参与开发的人（包括 AI Agent）。日常使用请看 [使用说明](guide.zh-CN.md)。

## 目录结构

```
server/            本地服务（Node.js，无第三方依赖）
  index.js         入口：读设置 → 选 UI 包 → 迁移旧数据 → 监听文件 → 启动 HTTP
  http.js          全部接口与静态文件
  state.js         当前使用的包、推送给画面和面板的完整状态、文件监听
  packs.js         UI 包的读取、迁移、结构校验、版本兼容检查
  packio.js        UI 包的导入、导出与删除
  zip.js           最小的 zip 读写（只用 Node 自带的 zlib）
  content.js       用户内容的读写与迁移
  presets.js       预设
  config.js        程序设置（config/default.json + data/config.json）
  version.js       版本号与比较
  store.js         JSON 原子写入、坏文件留档、深合并
  legacy.js        v1 之前旧数据的搬迁
public/
  overlay.html     直播画面
  panel.html       控制面板
  core/            两者共用：接口、翻译、主题、组件注册表、内置组件、UI 包载入
  overlay/         直播画面的骨架与幕布
  panel/           控制面板
  i18n/            界面语言包，放入新文件即可增加语言
packs/<id>/        程序自带的 UI 包（更新程序时会被替换）
schema/            pack.json 的 JSON Schema
scripts/check.mjs  提交前的硬校验
test/              单元测试
config/default.json 默认设置
data/              用户数据（不进仓库），导入的 UI 包在 data/packs/<id>/
```

## 常用命令

```bash
npm start
```

```bash
npm test
```

```bash
npm run check
```

提交前 `npm test` 与 `npm run check` 都必须通过。`check` 会检查语言包是否一致、代码里用到的文案是否存在、每个 UI 包是否能用。

## UI 包

一个 UI 包是一个文件夹。程序自带的放在 `packs/<id>/`，用户导入的放在 `data/packs/<id>/`，两处的 id 不能重复：

```
packs/my-pack/
  pack.json             入口，结构见下文
  content.default.json  默认文字
  style.css             外观
  fonts/                字体
  components/           自定义组件（可选）
```

服务运行时，改动包里的任何文件，画面和面板都会自动重新载入，可以边改边看。

### pack.json

完整定义见 `schema/pack.schema.json`。在 pack.json 开头写上 `"$schema": "../../schema/pack.schema.json"`，编辑器就能提示和检查。

| 字段 | 必填 | 说明 |
|---|---|---|
| `format` | 是 | pack.json 的结构版本，目前为 1 |
| `id` | 是 | 小写字母、数字和连字符，必须与文件夹名一致 |
| `version` | 是 | 这个包自己的版本，x.y.z |
| `madeWith` | 是 | 制作时使用的 TRM Live UI 版本，界面库里显示为“在 vX 制作” |
| `requires` | 否 | 能使用这个包的最低程序版本 |
| `componentApi` | 带组件时建议填 | 组件需要的组件接口版本，目前为 1 |
| `name`、`description` | name 必填 | 文字，可以是字符串，也可以按语言分开写 |
| `author` | 否 | 作者 |
| `canvas` | 是 | 画布宽高 |
| `fonts` | 否 | `{ family, weight, style, src }`，src 是包内路径 |
| `styles` | 否 | 包内的 CSS 文件 |
| `components` | 否 | 包内的组件脚本 |
| `content` | 否 | 默认文字文件 |
| `theme` | 否 | 颜色、字号、字体、圆角、调色板，会变成 CSS 变量 |
| `regions` | 是 | 区域：`{ id, kind, x, y, w, h, label, options }` |
| `scenes` | 否 | 状态与等待画面，见下文 |

按语言分开的文字写成 `{ "zh-CN": "…", "en-US": "…", "ja-JP": "…" }`。`npm run check` 会检查是否覆盖了所有界面语言。

### theme 与 CSS 变量

| theme | CSS 变量 |
|---|---|
| `colors.x` | `--color-x` |
| `sizes.x` | `--size-x`（单位 px） |
| `fonts.x` | `--font-x` |
| `palette` | `--palette-0`、`--palette-1` …，以及 `--palette-count` |
| `radius` | `--radius`（单位 px） |

样式里只用变量取值。这样调整配色只需改 pack.json。

### 区域

`kind` 决定区域里显示什么。内置类型：

| kind | 用途 | options |
|---|---|---|
| `hole` | 镂空，透出 OBS 画面 | |
| `title` | 角标、节目名、本期标题 | |
| `status` | 状态文字 | `clock`：显示时钟 |
| `notice` | 公告 | |
| `ticker` | 滚动字幕 | `speed`：每秒移动的像素 |

任何区域都可以加 `options.autoHeight: true`，高度会跟着内容变化，h 是最大高度。

### 状态与等待画面

```json
"scenes": {
  "curtain": { "x": 24, "y": 128, "w": 1872, "h": 928 },
  "items": [
    { "id": "live", "label": "直播中" },
    { "id": "brb", "label": "稍后回来", "screen": { "kind": "screen", "options": { "animation": "hop", "reserve": 420 } } }
  ]
}
```

- 没有 `screen` 的状态显示正常画面。
- 有 `screen` 的状态显示等待画面。所有等待画面共用一块幕布，盖住 `curtain` 指定的区域。
- 内置的 `screen` 类型左侧是文字，右侧是动画。`animation` 选择动画，`reserve` 在右侧给 Live2D 模型留空。

幕布的开合与内容切换由程序负责，UI 包不需要处理：

- 从直播中切到等待画面：幕布从左向右合上，然后内容依次浮现。
- 在等待画面之间切换：幕布保持合上，旧内容淡出，新内容浮现。
- 切回直播中：内容淡出，幕布向右收起。
- 切换中途改变方向时，幕布从当前位置折返。

幕布的颜色来自 `--color-accent`（前面一层）和 `--color-panel`（后面一层），可在包的样式里覆盖 `.curtain-edge` 与 `.curtain-body`。

### 默认文字

`content.default.json` 的结构：

```json
{
  "scene": "live",
  "regions": { "title": { "main": "…" } },
  "screens": { "brb": { "heading": "…" } }
}
```

`regions` 按区域 id，`screens` 按状态 id。用户的内容会叠在默认文字上，所以包新增的字段会自动有默认值。

### 分享 UI 包

在面板里点“导出”即可得到 zip。也可以自己压缩：pack.json 放在 zip 根目录，或放在唯一的顶层文件夹里都可以。导入时：

- 先在临时文件夹里按正常的包完整检查一遍，有问题就不安装。
- 不接受越界路径（如 `../`）、加密或分卷的 zip。
- 不能与程序自带的包同 id；与已导入的包同 id 时需要确认覆盖，旧的会备份。
- 包里带组件脚本时，面板会提醒用户。

## 组件

包可以自带区域类型和动画。组件脚本是 ES 模块，默认导出一个函数：

```js
export default function setup(api) {
  api.registerAnimation('wave', (stage, ctx) => {
    stage.append(api.h('div', 'wave'));
  });

  api.registerKind('countdown-bar', {
    fields: [{ key: 'text', label: { 'zh-CN': '文字', 'en-US': 'Text', 'ja-JP': '文字' } }],
    render(el, data, def, ctx) {
      el.append(api.h('span', 'bar-text', data.text ?? ''));
    },
  });
}
```

| api | 说明 |
|---|---|
| `apiVersion` | 组件接口的版本，目前为 1 |
| `engineVersion` | 程序版本 |
| `h(tag, className, text)` | 建元素，text 不会被当作 HTML |
| `paletteColor(i)` | 按序号循环取调色板颜色 |
| `registerKind(name, definition)` | 注册区域类型，同名时覆盖内置类型 |
| `registerAnimation(name, play)` | 注册动画 |

区域类型的 `render(el, data, def, ctx)`：

- `el` 是区域元素，内容变化时会被清空后重画
- `data` 是这个区域的文字内容
- `def` 是 pack.json 里的定义，options 在 `def.options`
- `ctx.animations` 是可用的动画

`fields` 里的 `type` 可以是 `text`（默认）、`textarea`、`toggle`、`time`。`label` 可以是按语言分开的文字。

组件载入失败不会让画面崩溃，面板会显示提示。

## 版本与兼容

| 版本 | 位置 | 作用 |
|---|---|---|
| 程序版本 | `package.json` 的 `version` | UI 包用 `requires` 声明最低版本，用 `madeWith` 记录制作版本 |
| 包格式 | `server/version.js` 的 `PACK_FORMAT` | pack.json 的结构版本 |
| 数据格式 | `server/version.js` 的 `DATA_FORMAT` | 用户内容与预设的结构版本 |
| 组件接口 | `server/version.js` 的 `COMPONENT_API` | 组件脚本拿到的 api 的版本，UI 包用 `componentApi` 声明需要的版本 |

程序遇到不同版本时的处理：

| 情况 | 处理 |
|---|---|
| 包的 `format` 比程序支持的新 | 不能使用，提示先更新程序 |
| 包的 `format` 较旧 | 按 `PACK_MIGRATIONS` 逐级升级后使用 |
| 包的 `requires` 比程序版本高 | 不能使用，提示需要的版本 |
| 包的 `componentApi` 比程序支持的高 | 不能使用，提示先更新程序 |
| 包的 `madeWith` 大版本比程序新 | 可以使用，提示部分效果可能不同 |
| 选中的包不能用 | 依次改用默认包、任意能用的包，面板显示原因 |
| 用户数据是旧格式 | 按 `DATA_MIGRATIONS` 逐级升级 |
| 数据文件损坏 | 移到 `data/backups/`，改用默认内容 |
| 组件中没有某个 kind | 跳过这个区域，面板提示 |

修改 pack.json 或用户数据的结构时：

1. 把 `PACK_FORMAT.current` 或 `DATA_FORMAT` 加一。
2. 在 `PACK_MIGRATIONS` 或 `DATA_MIGRATIONS` 里补一条从旧版本升一级的函数。
3. 在 `test/` 里补上迁移的测试。
4. 更新 `schema/pack.schema.json` 与本文档。

## 接口

所有接口返回 JSON。出错时返回 `{ "error": { "code", "params" } }`，`code` 对应语言包里的 `error.*`。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/events` | 推送完整状态（Server-Sent Events） |
| GET | `/api/state` | 当前完整状态 |
| GET | `/api/packs` | 界面库 |
| POST | `/api/packs/inspect` | 导入前预览，请求体是 zip |
| POST | `/api/packs/import` | 导入，请求体是 zip；`?replace=1` 覆盖同名的已导入包 |
| GET | `/api/packs/:id/export` | 导出为 zip |
| DELETE | `/api/packs/:id` | 删除已导入的包（移到 data/backups） |
| GET | `/api/locales` | 可用的界面语言 |
| PUT | `/api/config` | 修改设置：`{ activePack?, language? }` |
| PUT | `/api/content` | 保存文字：`{ regions, screens }` |
| PUT | `/api/scene` | 切换状态：`{ scene }` |
| GET | `/api/presets` | 当前包的预设列表 |
| GET | `/api/presets/:name` | 读取预设 |
| PUT | `/api/presets/:name` | 保存预设：`{ regions, screens }` |
| DELETE | `/api/presets/:name` | 删除预设 |
| GET | `/packs/:id/…` | UI 包里的文件 |

完整状态的结构：

```json
{
  "engine": { "version": "1.0.0", "packFormat": 1, "dataFormat": 1 },
  "config": { "language": "zh-CN", "activePack": "trm-swiss" },
  "pack": { "id": "trm-swiss", "base": "/packs/trm-swiss/", "revision": 0, "issues": [], "manifest": {} },
  "fallbackFrom": null,
  "content": { "scene": "live", "regions": {}, "screens": {} }
}
```

## 约定

- 界面上的文字都放进 `public/i18n/` 的语言包，代码里用 `t('key')` 取用，不写死。新增文案时三种语言一起加。
- 控制面板照 TRM UI 做：侧栏外壳、页头、小节、分组和各种控件都在 `public/panel/ui.js` 与 `public/panel/panel.css` 里，是 TRM UI 同名组件的无框架版本。新界面用这些组件和设计令牌搭，不另起样式，不写颜色字面量；拿不准时打开 TRM UI 对照。
- 直播画面的外观写在 UI 包里，`public/overlay/overlay.css` 只放骨架。
- 服务端不引入第三方依赖。
- 注释写“为什么”，不复述代码。
