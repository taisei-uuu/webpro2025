# Phase別テーブル分離セットアップガイド

このガイドでは、単一データベース内でPhase別テーブル分離のセットアップ手順を説明します。

## 概要

データベースを以下のようにテーブル分離しました：
- **Phase1テーブル**: `Phase1Lesson`, `Phase1Question`, `Phase1Option`, `Phase1QuizAttempt`, `Phase1ClearedQuestion`, `Phase1Progress`
- **Phase2テーブル**: `Phase2Lesson`, `Phase2Question`, `Phase2Option`, `Phase2QuizAttempt`, `Phase2ClearedQuestion`, `Phase2Progress`
- **Phase3テーブル**: `Phase3Lesson`, `Phase3Question`, `Phase3Option`, `Phase3QuizAttempt`, `Phase3ClearedQuestion`, `Phase3Progress`
- **共通テーブル**: `User`, `Subscription`（既存のまま）

## セットアップ手順

### 1. データベーススキーマの適用

```bash
# Prismaクライアントを生成
npm run build

# データベースにスキーマを適用
npm run db:push
```

### 2. 既存データの移行

```bash
# 既存データをPhase別テーブルに移行
npm run migrate:phase-tables
```

### 3. アプリケーションの起動

```bash
# 開発サーバーを起動
npm run dev
```

## 実装したファイル

### データベーススキーマ
- `prisma/schema.prisma` - Phase別テーブル分離に更新

### ライブラリ
- `lib/phase-database.ts` - Phase別テーブル管理ライブラリ

### スクリプト
- `scripts/migrate-to-phase-tables.ts` - データ移行スクリプト

### 更新されたファイル
- `index.ts` - Phase別テーブルを使用するように更新
- `package.json` - 移行スクリプトを追加

## 主な機能

### Phase別テーブル管理
- `getPhaseTables(phase)` - Phase番号に基づいて適切なテーブルを取得
- `getPhaseFromLessonId(lessonId)` - レッスンIDからPhaseを判定
- `getPhase1Lessons()` - Phase1のレッスンを取得
- `getPhaseLessons(phase)` - 指定Phaseのレッスンを取得

### 進捗管理
- `getPhaseQuizAttempts(phase, userId, sessionId)` - Phase別のクイズ試行を取得
- `getPhaseClearedQuestions(phase, userId)` - Phase別のクリア済み問題を取得
- `getPhaseProgress(phase, userId)` - Phase別の進捗を取得
- `updatePhaseProgress(phase, userId, lessonId, completed)` - Phase別の進捗を更新

### クイズ機能
- `savePhaseQuizAttempt(phase, data)` - Phase別のクイズ回答を保存
- `savePhaseClearedQuestion(phase, userId, questionId)` - Phase別のクリア済み問題を保存

## メリット

1. **独立した更新**: Phase2/3のレッスン内容を変更してもPhase1に影響しない
2. **進捗保持**: ユーザーの進捗データが失われることなく、各Phaseで独立管理
3. **シンプルな管理**: 単一データベース内でテーブル分離のため、管理が簡単
4. **コスト効率**: 追加のデータベースサーバーは不要

## 移行後の確認事項

1. **Phase1の機能確認**
   - レッスン一覧が正常に表示される
   - クイズ機能が正常に動作する
   - 進捗が正しく保存・表示される

2. **データ整合性確認**
   - 既存のユーザー進捗が正しく移行されている
   - レッスンと問題の関係が正しく保持されている

3. **パフォーマンス確認**
   - ページの読み込み速度が適切
   - クイズ回答の保存が正常に動作

## トラブルシューティング

### 移行エラーが発生した場合
1. データベース接続設定を確認
2. 既存データの整合性を確認
3. 移行スクリプトのログを確認

### Phase1の機能が動作しない場合
1. Prismaクライアントが正しく生成されているか確認
2. データベーススキーマが正しく適用されているか確認
3. 移行が正常に完了しているか確認

## 次のステップ

移行が正常に完了したら：

1. **既存テーブルの削除**（オプション）
   - Phase1の機能が正常に動作することを確認後
   - 既存の`Lesson`, `Question`, `Option`, `QuizAttempt`, `ClearedQuestion`テーブルを削除可能

2. **Phase2/3の実装**
   - Phase2/3のレッスンコンテンツを追加
   - 必要に応じてPhase2/3専用の機能を実装

3. **監視とメンテナンス**
   - パフォーマンスの監視
   - 定期的なデータベースの最適化

## サポート

問題が発生した場合は、ログファイルを確認し、エラーメッセージを記録してください。
