# TRM Live UI 開発ガイド

[中文](develop.zh-CN.md) | [English](develop.en.md) | 日本語

このガイドは、UI パックを作る人と開発に参加する人（AI エージェントを含む）に向けたものです。日常の使い方は [使い方](guide.ja.md) をご覧ください。

## 構成

```
server/            ローカルサービス（Node.js、サードパーティ依存なし）
  index.js         入口：設定の読み込み → UI パックの選択 → 旧データの移行 → ファイル監視 → HTTP 起動
  http.js          すべてのエンドポイントと静的ファイル
  state.js         使用中のパック、配信画面とパネルへ送る全体の状態、ファイル監視
  packs.js         UI パックの読み込み、移行、構造チェック、互換性チェック
  packio.js        UI パックの読み込み（インポート）、書き出し、削除
  zip.js           最小限の zip の読み書き（Node 内蔵の zlib のみ使用）
  content.js       ユーザーの内容の読み書きと移行
  presets.js       プリセット
  config.js        プログラムの設定（config/default.json + data/config.json）
  version.js       バージョン番号と比較
  store.js         JSON の原子的な書き込み、壊れたファイルの退避、深いマージ
  legacy.js        v1 より前のデータの移動
public/
  overlay.html     配信画面
  panel.html       コントロールパネル
  core/            両方で共有：API、翻訳、テーマ、コンポーネント登録、組み込みコンポーネント、パックの読み込み
  overlay/         配信画面の骨組みと幕
  panel/           コントロールパネル
  i18n/            パネルの言語ファイル。ファイルを追加すると言語が増えます
packs/<id>/        内蔵の UI パック（プログラムの更新時に置き換わります）
schema/            pack.json の JSON Schema
scripts/check.mjs  コミット前に通すべきチェック
test/              単体テスト
config/default.json 既定の設定
data/              ユーザーデータ（コミットしない）。読み込んだ UI パックは data/packs/<id>/ にあります
```

## コマンド

```bash
npm start
```

```bash
npm test
```

```bash
npm run check
```

コミット前に `npm test` と `npm run check` の両方が通る必要があります。`check` は、言語ファイルが一致しているか、コードで使う文言のキーがすべて存在するか、すべての UI パックが使えるかを確認します。

## UI パック

UI パックはフォルダです。内蔵のパックは `packs/<id>/`、読み込んだパックは `data/packs/<id>/` にあり、同じ id を両方に置くことはできません。

```
packs/my-pack/
  pack.json             入口。構造は後述します
  content.default.json  既定の文字
  style.css             見た目
  fonts/                フォント
  components/           独自コンポーネント（任意）
```

サービスの起動中にパック内のファイルを変更すると、配信画面とパネルが自動で読み込み直されるので、変更をすぐに確認できます。

### pack.json

完全な定義は `schema/pack.schema.json` にあります。pack.json の先頭に `"$schema": "../../schema/pack.schema.json"` を書くと、エディタで補完とチェックが使えます。

| 項目 | 必須 | 説明 |
|---|---|---|
| `format` | はい | pack.json の構造バージョン。現在は 1 |
| `id` | はい | 小文字の英字、数字、ハイフン。フォルダ名と一致させます |
| `version` | はい | このパック自身のバージョン（x.y.z） |
| `madeWith` | はい | 作成に使った TRM Live UI のバージョン。ライブラリには「vX で作成」と表示されます |
| `requires` | いいえ | このパックを使える最も低いプログラムのバージョン |
| `componentApi` | コンポーネントがある場合は推奨 | コンポーネントが必要とするコンポーネント API のバージョン。現在は 1 |
| `name`、`description` | name は必須 | 文字列、または言語ごとの文字列 |
| `author` | いいえ | 作者 |
| `canvas` | はい | キャンバスの幅と高さ |
| `fonts` | いいえ | `{ family, weight, style, src }`。src はパック内のパス |
| `styles` | いいえ | パック内の CSS ファイル |
| `components` | いいえ | パック内のコンポーネントスクリプト |
| `content` | いいえ | 既定の文字のファイル |
| `theme` | いいえ | 色、大きさ、フォント、角丸、パレット。CSS 変数になります |
| `regions` | はい | 領域：`{ id, kind, x, y, w, h, label, options }` |
| `scenes` | いいえ | シーンと待機画面。後述します |

言語ごとの文字は `{ "zh-CN": "…", "en-US": "…", "ja-JP": "…" }` のように書きます。`npm run check` はすべてのパネル言語がそろっているかを確認します。

### theme と CSS 変数

| theme | CSS 変数 |
|---|---|
| `colors.x` | `--color-x` |
| `sizes.x` | `--size-x`（px） |
| `fonts.x` | `--font-x` |
| `palette` | `--palette-0`、`--palette-1` …、`--palette-count` |
| `radius` | `--radius`（px） |

スタイルではこれらの変数だけを使います。色を変えるときは pack.json を編集するだけで済みます。

### 領域

`kind` で領域に表示するものが決まります。組み込みの種類は次のとおりです。

| kind | 用途 | options |
|---|---|---|
| `hole` | 切り抜き。OBS の画面が見えます | |
| `title` | バッジ、番組名、今回のタイトル | |
| `status` | 状態の文字 | `clock`：時計を表示 |
| `notice` | お知らせ | |
| `ticker` | 流れる文字 | `speed`：1 秒あたりのピクセル数 |

どの領域にも `options.autoHeight: true` を付けられます。高さが内容に合わせて変わり、h は最大の高さになります。

### シーンと待機画面

```json
"scenes": {
  "curtain": { "x": 24, "y": 128, "w": 1872, "h": 928 },
  "items": [
    { "id": "live", "label": "配信中" },
    { "id": "brb", "label": "少々お待ちください", "screen": { "kind": "screen", "options": { "animation": "hop", "reserve": 420 } } }
  ]
}
```

- `screen` がないシーンは通常のレイアウトを表示します。
- `screen` があるシーンは待機画面を表示します。すべての待機画面は 1 枚の幕を共有し、`curtain` の範囲を覆います。
- 組み込みの `screen` 種類は、左に文字、右にアニメーションを表示します。`animation` でアニメーションを選び、`reserve` で右側に Live2D モデル用の空きを作ります。

幕の開閉と内容の切り替えはプログラムが行うため、UI パック側で扱う必要はありません。

- 配信中から待機画面へ：幕が左から右へ閉じ、そのあと内容が順に現れます。
- 待機画面どうし：幕は閉じたままで、古い内容が消え、新しい内容が現れます。
- 配信中に戻す：内容が消え、幕が右へ開きます。
- 途中で向きが変わった場合は、幕は今の位置から折り返します。

幕の色は `--color-accent`（手前の層）と `--color-panel`（奥の層）から取られます。パックのスタイルで `.curtain-edge` と `.curtain-body` を上書きできます。

### 既定の文字

`content.default.json` の構造は次のとおりです。

```json
{
  "scene": "live",
  "regions": { "title": { "main": "…" } },
  "screens": { "brb": { "heading": "…" } }
}
```

`regions` は領域の id、`screens` はシーンの id で分けます。ユーザーの内容は既定の文字に重ねられるため、パックがあとで追加した項目にも自動で既定値が入ります。

### UI パックの共有

パネルで「書き出し」を押すと zip が得られます。自分で圧縮することもできます。pack.json は zip の最上位に置いても、ただ 1 つの最上位フォルダの中に置いてもかまいません。読み込み時の扱いは次のとおりです。

- まず一時フォルダで通常のパックと同じようにすべてチェックし、問題があれば何もインストールしません。
- パックの外に出るパス（`../` など）、暗号化された zip、分割された zip は受け付けません。
- 内蔵のパックと同じ id は使えません。読み込み済みのパックと同じ id の場合は置き換えの確認が必要で、古いパックはバックアップされます。
- コンポーネントスクリプトを含むパックの場合、パネルで注意を表示します。

## コンポーネント

パックは独自の領域の種類とアニメーションを持てます。コンポーネントスクリプトは ES モジュールで、関数を既定でエクスポートします。

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

| api | 説明 |
|---|---|
| `apiVersion` | コンポーネント API のバージョン。現在は 1 |
| `engineVersion` | プログラムのバージョン |
| `h(tag, className, text)` | 要素を作ります。text は HTML として扱われません |
| `paletteColor(i)` | 番号に応じてパレットの色を順に返します |
| `registerKind(name, definition)` | 領域の種類を登録します。同じ名前なら組み込みの種類を置き換えます |
| `registerAnimation(name, play)` | アニメーションを登録します |

領域の種類の `render(el, data, def, ctx)`：

- `el` は領域の要素です。内容が変わると空にしてから描き直されます
- `data` はこの領域の文字の内容です
- `def` は pack.json での定義です。options は `def.options` にあります
- `ctx.animations` は使えるアニメーションです

`fields` の `type` には `text`（既定）、`textarea`、`toggle`、`time` を使えます。`label` は言語ごとの文字にもできます。

コンポーネントの読み込みに失敗しても配信画面は止まらず、パネルにお知らせが表示されます。

## バージョンと互換性

| バージョン | 場所 | 役割 |
|---|---|---|
| プログラムのバージョン | `package.json` の `version` | パックは `requires` で最も低いバージョンを示し、`madeWith` で作成時のバージョンを記録します |
| パック形式 | `server/version.js` の `PACK_FORMAT` | pack.json の構造バージョン |
| データ形式 | `server/version.js` の `DATA_FORMAT` | ユーザーの内容とプリセットの構造バージョン |
| コンポーネント API | `server/version.js` の `COMPONENT_API` | コンポーネントスクリプトに渡す api のバージョン。パックは `componentApi` で必要なバージョンを示します |

バージョンが異なる場合の扱いは次のとおりです。

| 状況 | 扱い |
|---|---|
| パックの `format` が対応より新しい | 使えません。先にプログラムを更新するよう表示します |
| パックの `format` が古い | `PACK_MIGRATIONS` で 1 段ずつ更新してから使います |
| パックの `requires` がプログラムより高い | 使えません。必要なバージョンを表示します |
| パックの `componentApi` が対応より高い | 使えません。先にプログラムを更新するよう表示します |
| パックの `madeWith` のメジャーバージョンが新しい | 使えますが、一部の表示が異なる場合があると表示します |
| 選んだパックが使えない | 既定のパック、次に使える任意のパックを使います。パネルに理由を表示します |
| ユーザーデータが古い形式 | `DATA_MIGRATIONS` で 1 段ずつ更新します |
| データファイルが壊れている | `data/backups/` に移し、既定の内容を使います |
| コンポーネントに kind がない | その領域を飛ばし、パネルにお知らせを表示します |

pack.json またはユーザーデータの構造を変えるときは、次の手順に従います。

1. `PACK_FORMAT.current` または `DATA_FORMAT` を 1 増やします。
2. `PACK_MIGRATIONS` または `DATA_MIGRATIONS` に、1 つ前の形式から 1 段上げる関数を追加します。
3. `test/` に移行のテストを追加します。
4. `schema/pack.schema.json` とこのガイドを更新します。

## API

すべてのエンドポイントは JSON を返します。エラー時は `{ "error": { "code", "params" } }` を返し、`code` は言語ファイルの `error.*` に対応します。

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/events` | 全体の状態を送信します（Server-Sent Events） |
| GET | `/api/state` | 現在の全体の状態 |
| GET | `/api/packs` | UI ライブラリ |
| POST | `/api/packs/inspect` | 読み込み前のプレビュー。本文は zip |
| POST | `/api/packs/import` | パックを読み込みます。本文は zip。`?replace=1` で同じ id の読み込み済みパックを置き換えます |
| GET | `/api/packs/:id/export` | パックを zip で書き出します |
| DELETE | `/api/packs/:id` | 読み込んだパックを削除します（data/backups に移動） |
| GET | `/api/locales` | 使えるパネルの言語 |
| PUT | `/api/config` | 設定を変更：`{ activePack?, language? }` |
| PUT | `/api/content` | 文字を保存：`{ regions, screens }` |
| PUT | `/api/scene` | シーンを切り替え：`{ scene }` |
| GET | `/api/presets` | 現在のパックのプリセット一覧 |
| GET | `/api/presets/:name` | プリセットを読み込み |
| PUT | `/api/presets/:name` | プリセットを保存：`{ regions, screens }` |
| DELETE | `/api/presets/:name` | プリセットを削除 |
| GET | `/packs/:id/…` | UI パック内のファイル |

全体の状態の構造は次のとおりです。

```json
{
  "engine": { "version": "1.0.0", "packFormat": 1, "dataFormat": 1 },
  "config": { "language": "zh-CN", "activePack": "trm-swiss" },
  "pack": { "id": "trm-swiss", "base": "/packs/trm-swiss/", "revision": 0, "issues": [], "manifest": {} },
  "fallbackFrom": null,
  "content": { "scene": "live", "regions": {}, "screens": {} }
}
```

## 決まりごと

- パネルに表示する文字はすべて `public/i18n/` の言語ファイルに置き、コードでは `t('key')` で取り出します。直接書き込みません。新しい文言は 3 つの言語に同時に追加します。
- パネルは TRM UI に合わせて作ります。サイドバーの外枠、ページ見出し、節、グループ、各種コントロールは `public/panel/ui.js` と `public/panel/panel.css` にあり、TRM UI の同名コンポーネントをフレームワークなしで再現したものです。新しい画面はこれらのコンポーネントとデザイントークンで組み立て、独自のスタイルや色の値を直接書きません。迷ったときは TRM UI を開いて合わせます。
- 配信画面の見た目は UI パックに書きます。`public/overlay/overlay.css` には骨組みだけを置きます。
- サーバーではサードパーティの依存を使いません。
- コメントには理由を書き、コードを読めばわかることは繰り返しません。
