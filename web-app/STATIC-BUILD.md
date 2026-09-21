# 静的サイトビルド

Render の Node サーバーを廃止し、Cloudflare Pages で配信するための静的ビルド。

```bash
npm run build:static   # → dist/
```

## いまの状態

**既存の `index.ts` と `views/` には一切触っていない。** Render 上の Node アプリは
移行が完了する（Phase 6）まで並走させる必要があるため、両方が同じリポジトリから
ビルドできる状態を保っている。静的サイト側は `build.ts` + `views-static/` だけで完結する。

## ファイル構成

| パス | 役割 |
|---|---|
| `build.ts` | ビルダー本体。データ取得 → HTML生成 → 検証 |
| `views-static/layout.ejs` | 全ページ共通の外枠 |
| `views-static/partials/` | ナビ・フッター・head メタ |
| `views-static/pages/*.body.html` | 既存 `views/` から機械抽出した本文（トップ・法務3点） |
| `views-static/pages/*.ejs` | 動的ページ（記事・電子公告・404） |
| `content/notices.json` | 電子公告データ（microCMS に移すまでの暫定ソース） |
| `content/note-links.json` | 有料記事ID → note URL の対応表。旧URLの301に使う |
| `public/notices/` | 公告の添付PDFの実体。`public/notices/README.md` に運用手順 |

## 電子公告の注意点

**掲載日は `publishedDate` を使う。`publishedAt` ではない。**
microCMS は `publishedAt` を自動で作るため同名フィールドを定義できず、しかもその値は
「microCMS に登録した日」になる。過去の公告を後から入力すると法定の掲載日がずれるので、
専用の `publishedDate` フィールドを立てている。並び順も `publishedDate` で指定する。
欠けている公告があればビルドを失敗させる（`publishedAt` で代用しない）。

**添付PDFは microCMS に置けない。** Hobby プランはファイルフィールドが使えず、画像
フィールドは PDF を受け付けない。そのため実体は `public/notices/` に置き、microCMS の
`attachment.url`（テキスト）には `/notices/xxx.pdf` のような相対パスを入れる。
追加費用がかからず、Git の履歴にも残る。`url` が `/` で始まる場合はビルド時に実体の
有無を検証し、無ければ失敗する。

**`isActive` が未設定の公告は非公開扱い。** microCMS 側で必須にしていないため、
未設定は false として扱う。ただし黙って落とすと「登録したのに公告が出ない」に
気づけないので、除外した公告はビルドログに警告として列挙する。

**`content` はリッチエディタ（HTML文字列）。** エスケープせずそのまま挿入する。
一覧の抜粋と検索用インデックスは、タグを落としたプレーンテキストから作る
（HTMLのまま切ると途中でタグが千切れるため）。

## 環境変数

| 変数 | 必須 | 挙動 |
|---|---|---|
| `MICROCMS_SERVICE_DOMAIN` | ✅ | 無いとビルド失敗 |
| `MICROCMS_API_KEY` | ✅ | 無いとビルド失敗 |
| `NOTE_USERNAME` | — | 未設定なら note セクションを出さない |
| `SITE_URL` | — | 既定 `https://stockwith-jp.com`。canonical と sitemap に使う |

## 失敗の方針

壊れたものを黙って公開しないことを優先している。

- **記事の取得に失敗 → ビルド失敗。** 記事ゼロのサイトを公開しない
- **公告に `publishedDate` が無い → ビルド失敗。** 掲載日のずれた公告を出さない
- **公告の添付PDFの実体が無い → ビルド失敗。** 「添付あり」表示でリンクが404を防ぐ
- **microCMS に `notices` があるのにエラー → ビルド失敗。** 法定公告を黙って落とさない
- **microCMS に `notices` がまだ無い → `content/notices.json` を使う。** Phase 2 までの橋渡し。
  microCMS 側にエンドポイントを作れば、コード変更なしで自動的にそちらが優先される
- **note の RSS 取得に失敗 → 警告のみ、ビルドは続行。** note セクションが出ないだけ
- **サイト内リンクの参照先が無い → ビルド失敗。** 画像やCSSの取りこぼしは静かに壊れるため

## URL の互換性

Cloudflare Pages は `/foo.html` を `/foo` でも配信するので、現行URLがそのまま維持される。

| 現行URL | 出力ファイル |
|---|---|
| `/` | `dist/index.html` |
| `/articles` | `dist/articles/index.html` |
| `/articles/<id>` | `dist/articles/<id>.html` （**無料記事のみ**） |
| `/privacy` `/terms` `/commercial-disclosure` `/notice` | 各 `.html` |

廃止したURLは `dist/_redirects` で301転送する（`/learning` `/lessons/*` `/subscription`
`/admin/*` `/search` と、有料記事17件）。

## Cloudflare Pages の設定（Phase 4）

| 項目 | 値 |
|---|---|
| Root directory | `web-app` |
| Build command | `npm ci --ignore-scripts && npm run build:static` |
| Build output directory | `dist` |
| 環境変数 | `MICROCMS_SERVICE_DOMAIN` / `MICROCMS_API_KEY`（+ 任意で `NOTE_USERNAME`） |

> **`--ignore-scripts` が必要な理由。** `package.json` は Render の Node アプリと共用
> しているため、`prisma` / `@prisma/engines` / `@clerk/shared` の install スクリプトが
> 走る。静的ビルドはどれも使わないうえ、Prisma のエンジン取得は CI 環境でハングしうる。
> `--ignore-scripts` で 202MB → 166MB、実測 6.3秒。`esbuild` の postinstall も飛ぶが、
> バイナリは optionalDependencies 側から入るため `tsx` は問題なく動く（検証済み）。
> Render 側は `buildCommand` で `npx prisma generate` を明示的に呼んでいるので影響を受けない。

### Phase 7 で依存を絞るときの目安

`build.ts` が import しているのは `dotenv` / `ejs` と Node 標準モジュールだけ。
`index.ts` を削除したあとは、`dependencies` を次の3つまで落とせる。

```json
"dependencies": { "dotenv": "^17.1.0", "ejs": "^3.1.10", "tsx": "^4.20.3" }
```

この構成で実測: インストール12パッケージ / node_modules 14MB / 3秒（現状は170パッケージ・202MB）。
検証済みで、`build:static` は問題なく通る。

デプロイ後、microCMS の Webhook を Pages の Deploy Hook に繋ぐこと。繋がないと
記事や公告を公開してもサイトに反映されない。

## 運用

- **無料記事**：microCMS の `articles` で `isPaid` を外して公開 → 自社サイトに全文掲載
- **有料記事**：note に投稿 → `NOTE_USERNAME` 経由で `/articles` に自動で並ぶ
- **旧有料記事**：note に移したら `content/note-links.json` に
  `"<microCMSのID>": "<noteのURL>"` を追記する。旧URLがその note 記事へ301される
