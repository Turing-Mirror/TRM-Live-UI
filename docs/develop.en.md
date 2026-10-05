# TRM Live UI Developer Guide

[中文](develop.zh-CN.md) | English | [日本語](develop.ja.md)

This guide is for people who make UI packs and for contributors, including AI agents. For everyday use, see the [user guide](guide.en.md).

## Layout

```
server/            Local service (Node.js, no third-party dependencies)
  index.js         Entry: read settings → choose UI pack → migrate old data → watch files → start HTTP
  http.js          All endpoints and static files
  state.js         The pack in use, the full state pushed to the overlay and panel, file watching
  packs.js         Reading, migrating, validating and compatibility-checking UI packs
  packio.js        Importing, exporting and deleting UI packs
  zip.js           Minimal zip reading and writing (Node's built-in zlib only)
  content.js       Reading, writing and migrating user content
  presets.js       Presets
  config.js        Program settings (config/default.json + data/config.json)
  version.js       Version numbers and comparison
  store.js         Atomic JSON writes, backups of broken files, deep merge
  legacy.js        Moving data from before v1
public/
  overlay.html     Overlay
  panel.html       Control panel
  core/            Shared by both: API, translation, theme, component registry, built-in components, pack loading
  overlay/         Overlay skeleton and curtain
  panel/           Control panel
  i18n/            Panel language files; add a file to add a language
packs/<id>/        Built-in UI packs (replaced when the program is updated)
schema/            JSON Schema for pack.json
scripts/check.mjs  Checks that must pass before a commit
test/              Unit tests
config/default.json Default settings
data/              User data (not committed). Imported UI packs are in data/packs/<id>/
```

## Commands

```bash
npm start
```

```bash
npm test
```

```bash
npm run check
```

Both `npm test` and `npm run check` must pass before a commit. `check` verifies that the language files match, that every text key used in code exists, and that every UI pack can be used.

## UI packs

A UI pack is a folder. Built-in packs are in `packs/<id>/` and imported packs are in `data/packs/<id>/`. An id cannot appear in both:

```
packs/my-pack/
  pack.json             Entry point, described below
  content.default.json  Default text
  style.css             Look
  fonts/                Fonts
  components/           Custom components (optional)
```

While the service runs, the overlay and panel reload whenever a file in the pack changes, so you can see changes as you work.

### pack.json

The full definition is in `schema/pack.schema.json`. Add `"$schema": "../../schema/pack.schema.json"` at the top of pack.json to get hints and checks in your editor.

| Field | Required | Description |
|---|---|---|
| `format` | Yes | Structure version of pack.json, currently 1 |
| `id` | Yes | Lowercase letters, digits and hyphens. Must match the folder name |
| `version` | Yes | Version of this pack, x.y.z |
| `madeWith` | Yes | TRM Live UI version used to make the pack. The library shows it as "Made with vX" |
| `requires` | No | Lowest program version that can use the pack |
| `componentApi` | Recommended with components | Component API version the components need, currently 1 |
| `name`, `description` | name is required | Text, either a string or one string per language |
| `author` | No | Author |
| `canvas` | Yes | Canvas width and height |
| `fonts` | No | `{ family, weight, style, src }`, where src is a path inside the pack |
| `styles` | No | CSS files inside the pack |
| `components` | No | Component scripts inside the pack |
| `content` | No | Default text file |
| `theme` | No | Colors, sizes, fonts, radius and palette. These become CSS variables |
| `regions` | Yes | Regions: `{ id, kind, x, y, w, h, label, options }` |
| `scenes` | No | Scenes and waiting screens, described below |

Text per language is written as `{ "zh-CN": "…", "en-US": "…", "ja-JP": "…" }`. `npm run check` verifies that every panel language is covered.

### theme and CSS variables

| theme | CSS variable |
|---|---|
| `colors.x` | `--color-x` |
| `sizes.x` | `--size-x` (px) |
| `fonts.x` | `--font-x` |
| `palette` | `--palette-0`, `--palette-1` …, and `--palette-count` |
| `radius` | `--radius` (px) |

Use only these variables in styles, so that a color change only needs an edit to pack.json.

### Regions

`kind` decides what a region shows. Built-in kinds:

| kind | Use | options |
|---|---|---|
| `hole` | A cut-out that shows the OBS source | |
| `title` | Badge, show name and episode title | |
| `status` | Status text | `clock`: show a clock |
| `notice` | Notice | |
| `ticker` | Scrolling ticker | `speed`: pixels per second |

Any region can use `options.autoHeight: true`. The height then follows the content, and h is the maximum height.

### Scenes and waiting screens

```json
"scenes": {
  "curtain": { "x": 24, "y": 128, "w": 1872, "h": 928 },
  "items": [
    { "id": "live", "label": "Live" },
    { "id": "brb", "label": "Be right back", "screen": { "kind": "screen", "options": { "animation": "hop", "reserve": 420 } } }
  ]
}
```

- A scene without `screen` shows the normal layout.
- A scene with `screen` shows a waiting screen. All waiting screens share one curtain that covers the `curtain` area.
- The built-in `screen` kind shows text on the left and an animation on the right. `animation` chooses the animation, and `reserve` keeps space free on the right for the Live2D model.

The program handles the curtain and the content changes. A UI pack does not need to:

- From Live to a waiting screen: the curtain closes from left to right, then the content appears item by item.
- Between waiting screens: the curtain stays closed, the old content fades out and the new content appears.
- Back to Live: the content fades out and the curtain opens to the right.
- If the direction changes midway, the curtain turns back from where it is.

The curtain colors come from `--color-accent` (front layer) and `--color-panel` (back layer). A pack can override `.curtain-edge` and `.curtain-body` in its styles.

### Default text

The structure of `content.default.json`:

```json
{
  "scene": "live",
  "regions": { "title": { "main": "…" } },
  "screens": { "brb": { "heading": "…" } }
}
```

`regions` is keyed by region id and `screens` by scene id. User content is laid over the defaults, so fields a pack adds later get their default values automatically.

### Sharing UI packs

Click "Export" in the panel to get a zip. You can also zip a pack yourself: pack.json can be at the root of the zip or inside a single top-level folder. On import:

- The pack is first fully checked in a temporary folder. If it has problems, nothing is installed.
- Paths that leave the pack (such as `../`) and encrypted or split zips are rejected.
- The id cannot match a built-in pack. If it matches an imported pack, the user must confirm the replacement, and the old pack is backed up.
- If the pack contains component scripts, the panel warns the user.

## Components

A pack can bring its own region kinds and animations. A component script is an ES module whose default export is a function:

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

| api | Description |
|---|---|
| `apiVersion` | Version of the component API, currently 1 |
| `engineVersion` | Program version |
| `h(tag, className, text)` | Creates an element. text is never treated as HTML |
| `paletteColor(i)` | Returns palette colors in turn by index |
| `registerKind(name, definition)` | Registers a region kind. The same name replaces a built-in kind |
| `registerAnimation(name, play)` | Registers an animation |

`render(el, data, def, ctx)` of a region kind:

- `el` is the region element. It is cleared and redrawn when the content changes
- `data` is the text content of this region
- `def` is the definition in pack.json. Options are in `def.options`
- `ctx.animations` holds the available animations

`type` in `fields` can be `text` (default), `textarea`, `toggle` or `time`. `label` can be text per language.

A component that fails to load does not break the overlay. The panel shows a notice.

## Versions and compatibility

| Version | Location | Purpose |
|---|---|---|
| Program version | `version` in `package.json` | Packs declare the lowest version with `requires` and record the version they were made with in `madeWith` |
| Pack format | `PACK_FORMAT` in `server/version.js` | Structure version of pack.json |
| Data format | `DATA_FORMAT` in `server/version.js` | Structure version of user content and presets |
| Component API | `COMPONENT_API` in `server/version.js` | Version of the api given to component scripts. Packs declare the version they need with `componentApi` |

How the program handles different versions:

| Case | Handling |
|---|---|
| The pack's `format` is newer than supported | Not usable. The user is told to update the program |
| The pack's `format` is older | Upgraded step by step with `PACK_MIGRATIONS`, then used |
| The pack's `requires` is higher than the program version | Not usable. The required version is shown |
| The pack's `componentApi` is higher than supported | Not usable. The user is told to update the program |
| The major version of the pack's `madeWith` is newer | Usable, with a notice that some effects may differ |
| The chosen pack is not usable | The default pack is used, then any usable pack. The panel shows the reason |
| User data is in an older format | Upgraded step by step with `DATA_MIGRATIONS` |
| A data file is broken | Moved to `data/backups/`, and default content is used |
| A kind is missing from the components | The region is skipped, and the panel shows a notice |

When you change the structure of pack.json or of user data:

1. Increase `PACK_FORMAT.current` or `DATA_FORMAT` by one.
2. Add a function to `PACK_MIGRATIONS` or `DATA_MIGRATIONS` that upgrades the previous version by one step.
3. Add tests for the migration in `test/`.
4. Update `schema/pack.schema.json` and this guide.

## API

Every endpoint returns JSON. Errors return `{ "error": { "code", "params" } }`, where `code` matches `error.*` in the language files.

| Method | Path | Description |
|---|---|---|
| GET | `/events` | Pushes the full state (Server-Sent Events) |
| GET | `/api/state` | The current full state |
| GET | `/api/packs` | The UI library |
| POST | `/api/packs/inspect` | Preview before an import. The body is a zip |
| POST | `/api/packs/import` | Imports a pack. The body is a zip. `?replace=1` replaces an imported pack with the same id |
| GET | `/api/packs/:id/export` | Exports a pack as a zip |
| DELETE | `/api/packs/:id` | Deletes an imported pack (moved to data/backups) |
| GET | `/api/locales` | Available panel languages |
| PUT | `/api/config` | Changes settings: `{ activePack?, language? }` |
| PUT | `/api/content` | Saves text: `{ regions, screens }` |
| PUT | `/api/scene` | Switches the scene: `{ scene }` |
| GET | `/api/presets` | Presets of the current pack |
| GET | `/api/presets/:name` | Reads a preset |
| PUT | `/api/presets/:name` | Saves a preset: `{ regions, screens }` |
| DELETE | `/api/presets/:name` | Deletes a preset |
| GET | `/packs/:id/…` | Files inside a UI pack |

The structure of the full state:

```json
{
  "engine": { "version": "1.0.0", "packFormat": 1, "dataFormat": 1 },
  "config": { "language": "zh-CN", "activePack": "trm-swiss" },
  "pack": { "id": "trm-swiss", "base": "/packs/trm-swiss/", "revision": 0, "issues": [], "manifest": {} },
  "fallbackFrom": null,
  "content": { "scene": "live", "regions": {}, "screens": {} }
}
```

## Conventions

- All panel text lives in the language files in `public/i18n/`. Code reads it with `t('key')` and never hardcodes it. Add new text in all three languages at once.
- The panel follows TRM UI. The sidebar shell, page heads, blocks, groups and controls in `public/panel/ui.js` and `public/panel/panel.css` are framework-free versions of the TRM UI components of the same names. Build new panel UI from these components and the design tokens. Do not add new styles or color literals. When unsure, open TRM UI and match it.
- The overlay's look belongs in the UI pack. `public/overlay/overlay.css` holds only the skeleton.
- The server uses no third-party dependencies.
- Comments explain why, not what the code already says.
