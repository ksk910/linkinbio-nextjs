# DB Migration Runbook (Prisma + PostgreSQL)

このドキュメントは PH1-DOM-03 の運用手順です。
目的は、ローカル開発・本番反映・障害時対応を同じ手順で再現できるようにすることです。

## 1. 前提

- Prisma schema: prisma/schema.prisma
- Migration files: prisma/migrations/
- DB provider: postgresql
- 本番では prisma migrate reset は使用しない

## 2. 日常フロー（ローカル開発）

1) 変更前に状態確認
- npm run prisma:migrate:status

2) schema を更新
- prisma/schema.prisma を編集

3) migration 生成と適用
- npm run prisma:migrate:dev -- --name <change_name>

4) Prisma Client 再生成
- npm run prisma:generate

5) テスト
- npm run test:api
- npm run build

## 3. デプロイ前チェック（staging/prod 共通）

1) 対象 migration がコミットされていること
- prisma/migrations/<timestamp>_<name>/migration.sql

2) 差分確認
- npm run prisma:migrate:status

3) 環境変数確認
- DATABASE_URL
- JWT_SECRET

## 4. 本番適用手順

1) DB バックアップ取得
- 例: pg_dump で事前バックアップ

2) migration 適用
- npm run prisma:migrate:deploy

3) Client 生成（ビルドパイプライン内でも可）
- npm run prisma:generate

4) アプリ起動/デプロイ

5) 動作確認
- GET /api/health が 200 であること
- 重要画面（login/profile/public）が正常表示

## 5. ロールバック方針

原則は forward fix（修正版 migration 追加）です。
既存 migration を書き換えないこと。

### 5-1. まだ適用されていない migration の取り消し

- migration ファイルを修正し、再デプロイする
- resolve は不要

### 5-2. 失敗して中断した migration の復旧

1) DB の実状態を確認（テーブル/カラム有無）
2) 必要に応じて手動 SQL で整合を回復
3) 履歴を resolve で修正
- npm run prisma:migrate:resolve:rolledback -- <migration_name>
4) 修正版 migration を作成して再適用

### 5-3. 適用済み migration を実質的に戻す（緊急時）

1) 逆操作を新しい migration として作成（推奨）
2) どうしても履歴のみ戻す必要がある場合は、手動 SQL 実行後に以下で整合を取る
- npm run prisma:migrate:resolve:rolledback -- <migration_name>

注意:
- resolve は migration 履歴テーブルを調整するだけで、実データを自動復元しない
- DROP COLUMN 等の逆操作はデータ損失リスクがあるため、必ずバックアップ後に実施

## 6. 例: accountStatus 追加 migration の障害対応

対象 migration:
- 20260627104000_profile_account_status

この migration を巻き戻す必要がある場合（緊急限定）:

1) 手動 SQL（要バックアップ）
- ALTER TABLE "Profile" DROP COLUMN "accountStatus";

2) 履歴調整
- npm run prisma:migrate:resolve:rolledback -- 20260627104000_profile_account_status

3) 修正版 migration を作成して再適用

## 7. 禁止事項

- 本番で prisma migrate reset を実行しない
- 適用済み migration.sql を後から書き換えない
- resolve のみでロールバック完了と判断しない（DB実体確認が必須）

## 8. チェックリスト

- [ ] 事前バックアップを取得した
- [ ] migrate status で意図した差分のみ
- [ ] migrate deploy 成功
- [ ] /api/health が healthy
- [ ] 主要画面の疎通確認
- [ ] 障害時は resolve と手動SQLの両方を記録

## 9. Phase 3 運用メモ（バックアップ / ロールバック / 秘密情報管理）

### 9-1. バックアップ

- データベースは本番適用前に必ずバックアップを取得する
- 重要な変更は `pg_dump` やホスティング提供元のバックアップ機能を使って保存する
- バックアップファイルはアクセス制限をかけ、必要な運用担当者だけが参照できるようにする

### 9-2. ロールバック

- 変更内容が壊れた場合は、まずサービスを一時停止または機能を無効化する
- ロールバックは「履歴を戻す」だけではなく、DB 実体とアプリの両方を確認して行う
- Prisma の migration は forward fix を基本とし、既存 migration の書き換えは避ける

### 9-3. 秘密情報管理

- `.env` やシークレットは Git リポジトリにコミットしない
- 本番環境の `JWT_SECRET` / `DATABASE_URL` / `SUPABASE` 系キーは Vercel やホスティングの環境変数で管理する
- 失効したシークレットは直ちにローテーションし、その履歴を運用ログに残す

### 9-4. 事故発生時の基本フロー

1. 影響範囲を確認する
2. /api/health と主要画面の状態を確認する
3. 必要ならバックアップから復旧する
4. ロールバック手順を実行し、再デプロイする
5. 事後原因と対応内容を記録する
