# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Linktree 風の「リンクインバイオ」サービス。Next.js（Pages Router, v13）+ TypeScript + Tailwind + Prisma 構成。ユーザーはサインアップし、公開プロフィールページ（bio・リンク一覧・カスタムブロック・テーマ設定）を編集して `/p/[slug]` で共有する。Vercel にデプロイされ implink.link で公開。本番 DB は PostgreSQL（ローカルで手早く始める場合は SQLite）。

## コマンド

```bash
npm run dev                    # 開発サーバー起動
npm run build                  # 本番ビルド
npm run start                  # ビルド済みアプリを起動
npm run start:prod             # NODE_ENV=production で起動

# Prisma
npx prisma migrate dev --name <change_name>   # ローカルでマイグレーションを作成・適用
npm run prisma:migrate:status
npm run prisma:migrate:deploy                 # 保留中のマイグレーションを適用（本番）
npm run prisma:migrate:resolve:rolledback -- <migration_name>
npm run prisma:generate

# テスト
npm run test:api               # tests/api/** の node --test 統合テスト
npm run test:ops               # tests/api/ops.integration.test.ts のみ
npm run test:e2e               # Playwright e2e（実行中の `next` を kill してから実行）
npm run test:e2e:headed        # 同上、ブラウザを表示して実行

# その他
npm run benchmark:perf         # tsx scripts/perf-benchmark.ts
npm run browsers:update        # browserslist DB 更新（Playwright の警告対策）
npm run deploy                 # vercel --prod を実行し、結果を implink.link / www.implink.link にエイリアス
```

単一の API 統合テストファイルを直接実行する場合: `tsx --test tests/api/auth.integration.test.ts`
単一の Playwright スペックを実行する場合: `npx playwright test tests/e2e/minimal-flow.spec.ts`

lint スクリプトは設定されていない。TypeScript の型エラーは `npm run build` 実行時に検出される。

## アーキテクチャ

**Next.js Pages Router。** `pages/` 以下にすべてが存在する：UI は各ファイルルート（`pages/index.tsx`、`pages/login.tsx`、`pages/profile/edit.tsx`、公開プロフィール用の `pages/p/[id].tsx`）、API は `pages/api/**`。別立てのバックエンドサービスは存在しない。

**認証は NextAuth を使わず自前実装。** `lib/auth.ts` が JWT を発行・検証する（`signToken`/`verifyToken`、`JWT_SECRET` 環境変数）。パスワードは bcrypt でハッシュ化。トークンは `Authorization: Bearer` ヘッダーまたは `token=` クッキーのいずれかから読み取る（`getTokenFromReq`）。ログイン・サインアップ時は API が `Set-Cookie` で直接 HttpOnly クッキーを設定する（Secure・SameSite=Lax は本番環境のみ付与）。API ルートは `getTokenFromReq` + `verifyToken` を手動で呼び出し、payload から `userId` を取り出して認証する方式で、共通ミドルウェアは存在しないため `pages/api/**` の各ハンドラでこのパターンが繰り返されている。

**CSRF 対策（`lib/csrf.ts`）** はクッキーセッション特有の実装：`assertCsrf` は `token=` クッキーが存在し、かつ Bearer ヘッダーを使っていない場合（＝ブラウザのクッキー認証フロー）のみ同一オリジンチェックを強制する。Bearer 認証や GET/HEAD/OPTIONS リクエストは対象外。状態変更を伴うハンドラは変更処理前に `assertCsrf(req)` を呼ぶ。

**レート制限（`lib/rate-limit.ts` + `lib/rate-limit-config.ts`）** はインメモリ（`Map`）実装で、呼び出し側が渡す文字列キー（典型的には `"<route>:<ip>"` や `"<route>:<email>"`）で管理され、ルートごとに環境変数で設定する（`.env.example` の `AUTH_*_RATE_LIMIT` / `_RATE_WINDOW_MS` 系変数を参照）。インメモリのためサーバーレスインスタンス間で状態は共有されない — 現状の規模では許容範囲だが、厳密な保証が必要な用途に使う前に把握しておくこと。

**データモデル（`prisma/schema.prisma`）。** `User` と `Profile` は 1:1（`userId` で紐付け）。`Profile` は複数の `Link`（順序あり、type で種別化 — url/music/email/tel/sms/imessage、`lib/validation.ts` の `normalizeLinkValue` を参照）、複数の `Block`（自由記述のページセクション：profile/headline/bio/links/icon/line/video、`pages/api/profile/index.ts` でタイプごとの長さ・形式を検証）、複数の `AnalyticsEvent`（閲覧・クリック計測。`pages/api/profile/analytics.ts` と `pages/api/monitoring/dashboard.ts` が利用）を持つ。`Profile.slug` が公開 URL のセグメントで、`accountStatus` によって公開可否を制御する。

**バリデーションは `lib/validation.ts` に集約**されており、ルートごとの場当たり実装ではない：`normalizeRequestBody` はリクエストボディを寛容にパースする（パース済みオブジェクトと、単一キーに文字列化された JSON が入っているエッジケースの両方に対応）。`validateEmail`/`validatePassword`/`validateSlug`/`validateLinkTitle`/`validateLinkTarget` はいずれも `{ ok: true, value } | { ok: false, error }` という一貫した形で結果を返す。新しいルートを書く際は正規表現をベタ書きせずこれらを再利用すること。

**Prisma クライアント**は `lib/prisma.ts` でシングルトン化されている（開発時の hot-reload に耐えるよう本番以外では `global` にキャッシュ）。`PrismaClient` を直接インスタンス化せず、必ずここから `prisma` を import すること。`Profile.slug`・`User.email` などの作成・更新時は `P2002`（ユニーク制約違反）エラーを明示的にハンドリングする — パターンは `pages/api/profile/index.ts` を参照。

**i18n**: `next.config.js` でロケール `['ja', 'en']`、デフォルト `ja` を宣言している（`next-intl` が依存関係に含まれるが、独自ルーターではなく Next.js 組み込みの i18n ルーティングを使用）。`lib/i18n.ts` が `locales/<locale>/common.json` を読み込み、失敗時は `ja` にフォールバックする。リポジトリ内のドキュメント・コメントは主に日本語で書かれており、ユーザー向け文言・リポジトリ内ドキュメントもこの慣習に合わせること。

**ロギング／監視**: `lib/logger.ts` が `logError`/`logWarn`/`requestMeta` を提供。`lib/error-tracking.ts` と `lib/monitoring-config.ts` が `pages/api/monitoring/client-error.ts`・`pages/api/monitoring/dashboard.ts` を支えており、アラート閾値は `ALERT_*` 環境変数で設定する（`.env.example` 参照）。詳細は `docs/monitoring-dashboard.md` を参照。

**ファイルアップロード**: アバター画像は `lib/avatar-upload.ts` + `pages/api/upload/avatar.ts` 経由で Supabase ストレージ（`lib/supabase.ts`）にアップロードされる。公開プロフィール画像は `next.config.js` の `images.remotePatterns`（placehold.co、pbs.twimg.com、`*.supabase.co`）で制約される。

**QR コード**はプロフィールリンク用に `lib/qr.ts`（`qrcode` パッケージ）で生成する。

## テストの方針

- `tests/api/**` は Node 組み込みのテストランナー（`tsx --test`）を使い、API ルートハンドラを（HTTP 経由ではなく）直接呼び出す統合テスト。`NextApiRequest`/`NextApiResponse` のモックは `tests/api/helpers.ts` の `createMockReq`/`createMockRes` を参照。`tests/api/README.md` によれば、このスイートは段階的に拡充中で、一部のケースはまだ `skip` のプレースホルダーになっている可能性がある。実装済みチケットごとに `skip` を1つ実テストに置き換えていく方針で、スイートを red のまま放置しないこと。
- `tests/e2e/**` は Playwright スペック（`playwright.config.ts`）：シングルワーカー・非並列、`baseURL` はデフォルト `http://localhost:3000`。`webServer` は既存の `next dev` を kill し `.next` を削除してから再起動する。
- CI（`.github/workflows/ci.yml`）は `prisma generate` → `test:api` → `benchmark:perf` → `test:e2e` → `build` の順で実行される。Deploy ワークフロー（`.github/workflows/deploy.yml`）は実際の `DATABASE_URL` シークレットに対して同じチェックを繰り返した上で `prisma migrate deploy` と Vercel 本番デプロイを行う。

## マイグレーションとデプロイ

- マイグレーションを Vercel のビルドステップの一部として実行しないこと。`vercel-build` スクリプト自体は `prisma migrate deploy && prisma generate && next build` を実行するが、推奨される安全な運用（`docs/db-migration-runbook.md` 参照）は CI や専用ジョブでマイグレーションを適用する方式であり、負荷のかかるビルドステップに依存しない。
- 本番環境では `DATABASE_URL`（Postgres）、`JWT_SECRET`、`NODE_ENV=production` をホスティング側（Vercel ダッシュボード）に設定する必要がある — `.env.production.example` を参照。
- `docs/` にはフェーズ単位の運用ドキュメント／チェックリスト（`phase1-completion-report.md` 〜 `phase4-*`、`db-migration-runbook.md`、`monitoring-dashboard.md`、`release-operations-runbook.md`、`vercel-deployment-guide.md`、`requirements-traceability.md`）が含まれる。マイグレーション・リリース・監視まわりを触る前に、コードには表れない運用判断が記載されているこれらを確認すること。
