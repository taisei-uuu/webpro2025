# CLAUDE.md — AI向けプロジェクト概要

このファイルはAIアシスタントがこのリポジトリを素早く把握するためのガイドです。

---

## プロジェクト概要

**Stock with** — Stock with株式会社のコーポレートサイト。

2026年9月に、Node.js アプリケーションから**静的サイトへ移行**しました。
学習教材・会員登録・有料販売は廃止し、有料記事は note で販売しています。
月額コストはゼロ（ドメイン更新料のみ）です。

- サイト本体: `web-app/`（TypeScript のビルドスクリプト + EJS テンプレート）
- 分析ツール: `stock-tool/`（Python + Streamlit。**現在は未デプロイ**）
- デプロイ先: **Cloudflare Pages**（`stockwith-jp.com`）

---

## 重要ファイルの場所

| ファイル | 役割 |
|----------|------|
| `web-app/build.ts` | 静的サイトビルダー。データ取得 → HTML生成 → 検証 |
| `web-app/STATIC-BUILD.md` | **ビルドの仕様書。作業前に必ず読むこと** |
| `web-app/views-static/layout.ejs` | 全ページ共通の外枠 |
| `web-app/views-static/partials/` | ナビ・フッター・head メタ |
| `web-app/views-static/pages/` | 各ページの中身 |
| `web-app/content/notices.json` | 電子公告データ（microCMS が優先されるため通常は未使用） |
| `web-app/content/note-links.json` | 旧有料記事ID → note URL の対応表 |
| `web-app/public/` | 静的アセット。`notices/` に公告の添付PDF |

---

## アーキテクチャ

### 静的サイト生成
サーバーは存在しません。`build.ts` が microCMS と note からデータを取得し、
`views-static/` のテンプレートに流し込んで `dist/` に完成した HTML を書き出します。
Cloudflare Pages はその `dist/` を配信するだけです。

```bash
cd web-app
npm run build:static   # → dist/
npm run typecheck
```

### コンテンツの二層構造
- **無料記事** — microCMS の `articles`（`isPaid` なし）。自社サイトに全文掲載する。
  SEO資産を自社ドメインに蓄積するのが目的なので、note には出さない
- **有料記事** — note で販売。RSS から自動取得して `/articles` に一覧表示する

### 電子公告
会社法上の義務があるため機能として残しています。microCMS の `notices` から生成。
**掲載日は `publishedDate` を読むこと**（microCMS が自動生成する `publishedAt` とは別物）。
添付PDFの実体は `public/notices/` に置きます。詳細は `STATIC-BUILD.md`。

### ビルドの失敗方針
壊れたものを黙って公開しないことを優先しています。記事取得の失敗、公告の掲載日欠落、
添付PDFの不在、サイト内リンク切れは、いずれもビルドを失敗させます。

---

## 開発時の注意事項

### 環境変数
```
MICROCMS_SERVICE_DOMAIN   必須
MICROCMS_API_KEY          必須
NOTE_USERNAME             任意（未設定なら note セクションを出さない）
SITE_URL                  任意（既定 https://stockwith-jp.com）
```

### ページを追加・変更する場合
1. `web-app/views-static/pages/` にテンプレートを置く
2. `web-app/build.ts` の `main()` に出力処理を追加する
3. `npm run build:static` で `dist/` を確認する

### URL の互換性
Cloudflare Pages は `/foo.html` を `/foo` でも配信するため、旧サイトのURLが維持されています。
廃止したURL（`/learning` `/lessons/*` `/subscription` など）は `_redirects` で301転送しています。
**ファイル名を変えると旧URLが壊れる**ので注意してください。

---

## 廃止済みのもの（復活させないこと）

以下は2026年9月に意図的に削除しました。git 履歴には残っています。

| 廃止したもの | 備考 |
|---|---|
| 学習教材（Phase1系） | Stage1〜6のレッスン・クイズ・進捗管理 |
| 会員登録・ログイン（Clerk） | アカウントは無料枠で残置。ユーザー85件は退避済み |
| 決済（Stripe） | サブスク・買い切りとも停止。Product/Price はアーカイブ |
| いいね機能 | |
| PostgreSQL + Prisma | ダンプを退避済み |
| Express サーバー（`index.ts`） | 約2,000行 |
| Render.com | `render.yaml` ごと削除 |

---

## 現在の状態 (2026-09-21 時点)

- 静的サイトが Cloudflare Pages で本番稼働中
- 依存は3つ（`dotenv` / `ejs` / `tsx`）。`npm ci` は約2秒
- 電子公告は0件（元から0件。決算公告の時期が来たら microCMS に登録する）
- 利用規約・プライバシーポリシーは2026年9月21日に改定済み
- 特定商取引法に基づく表記は、販売停止中である旨の改訂が**未対応**
