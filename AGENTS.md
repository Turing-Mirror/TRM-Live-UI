# AGENTS.md

Instructions for AI agents working in this repository. The full developer guide is in `docs/develop.en.md` (also `develop.zh-CN.md`, `develop.ja.md`).

## Commands

- `npm start` runs the local service (port in `config/default.json`, overridable in `data/config.json`).
- `npm test` runs the unit tests.
- `npm run check` checks language files, text keys used in code, and every UI pack.

Both `npm test` and `npm run check` must pass before a commit.

## Rules

- No hardcoded user-facing text. Put every string in `public/i18n/*.json` and read it with `t('key')`. Add new keys to all locales at once.
- Server errors are `AppError(code, params)`. Add a matching `error.<code>` entry to every locale.
- The overlay look belongs in UI packs (`packs/<id>/style.css`). `public/overlay/overlay.css` holds only the skeleton.
- The control panel follows TRM UI (github.com/Turing-Mirror/TRM-UI): its sidebar shell, page heads, blocks, groups and controls are ported to plain DOM in `public/panel/ui.js` and `public/panel/panel.css`. Build new panel UI from these components and the tokens; do not invent new visual patterns or use color literals. When unsure, open TRM UI and match it.
- When the structure of `pack.json` or user data changes: bump `PACK_FORMAT` or `DATA_FORMAT` in `server/version.js`, add a migration step, add a test, and update `schema/pack.schema.json` and the developer guides.
- No third-party dependencies on the server.
- `data/` (user content, imported packs in `data/packs/`) and `internal/` (internal notes) are git-ignored. Never commit them.
- Comments are in Chinese and explain why, matching the existing code.
