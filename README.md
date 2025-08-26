# 株式投資学習ロードマップ

Webpro 2025 プロジェクト - 株式投資学習のためのロードマップアプリケーション

## 技術スタック

- **Backend**: Node.js + Express + TypeScript
- **Database**: Prisma + SQLite
- **Frontend**: EJS + CSS
- **Session Store**: MemoryStore (開発環境)
- **Authentication**: Express Session + bcrypt

## 新しく追加されたコンポーネント

### ステッパーコンポーネント

学習進捗を視覚的に表示するステッパーコンポーネントです。

#### 特徴
- 各Stageのクイズ完了状況に基づく動的な表示
- 完了・アクティブ・非アクティブ状態の視覚的表現
- レスポンシブデザイン対応
- 本番環境対応のセッション管理

## セットアップ手順

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env`ファイルを作成し、以下の環境変数を設定してください：

```env
# データベース接続URL
DATABASE_URL="postgresql://username:password@localhost:5432/database_name"

# セッションシークレット
SESSION_SECRET="your-super-secret-session-key-here"

# Gemini API キー
GEMINI_API_KEY="your-gemini-api-key-here"

# 環境設定
NODE_ENV="development"

# ポート番号
PORT=8888
```

### 3. データベースのセットアップ

```bash
npm run build
```

### 4. アプリケーションの起動

```bash
npm start
```

## 本番環境での注意点

- **セッション管理**: MemoryStoreを使用（開発・小規模運用向け）
- **セキュリティ**: 本番環境では`secure: true`でHTTPS必須
- **データベース**: SQLiteを使用（ファイルベース）

## プロジェクト構造

```
├── prisma/
│   ├── schema.prisma          # データベーススキーマ
│   ├── seed.ts               # シードデータ
│   └── migrations/           # データベースマイグレーション
├── views/                    # EJSテンプレート
├── public/                   # 静的ファイル
├── index.ts                  # メインアプリケーション
└── package.json
```
