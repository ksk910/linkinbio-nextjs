# Requirements Traceability

## 目的

仕様書ベースの開発を追跡しやすくするため、要件 ID ごとに実装状況と対応ファイルを一覧化する。

## 要件一覧

| ID | 項目 | 状態 | 実装/対応内容 | 参考ファイル |
| --- | --- | --- | --- | --- |
| AUTH-01 | 認証フローの基本動作 | 実装済み | ログイン / サインアップ / メール検証 / パスワード再設定 | pages/api/auth/*.ts |
| AUTH-02 | レート制限 | 実装済み | リクエスト頻度制御と 429 応答 | lib/rate-limit.ts, lib/rate-limit-config.ts |
| AUTH-03 | CSRF 対策 | 実装済み | Cookie 認証と CSRF ガード | lib/csrf.ts |
| AUTH-04 | パスワード変更 | 実装済み | 現在パスワード確認付き変更 | pages/api/profile/change-password.ts |
| AUTH-05 | メール検証フロー | 実装済み | 検証メール送信・検証処理 | pages/api/auth/verify-email.ts |
| LINK-01 | リンク作成 | 実装済み | 新規リンク作成 API と UI | pages/api/profile/link.ts |
| LINK-02 | リンク編集 | 実装済み | 既存リンクの更新 | pages/api/profile/link.ts |
| LINK-03 | リンク種別選択 | 実装済み | リンク種別（music など）選択と保存 | pages/api/profile/link.ts, pages/profile/links.tsx |
| LINK-04 | リンク並び替え | 実装済み | 並び替え API と UI | pages/api/profile/reorder.ts |
| LINK-05 | リンク非表示化 | 実装済み | hidden フラグの保存と表示制御 | pages/api/profile/link.ts, pages/profile/links.tsx |
| LINK-06 | リンク画像 / アイコン | 実装済み | imageUrl / icon の保存 | pages/api/profile/link.ts |
| LINK-07 | 音楽リンク対応 | 実装済み | music provider / url 対応 | pages/api/profile/link.ts |
| LINK-08 | URL コピー | 実装済み | リンク行のクリップボードコピー操作 | pages/profile/links.tsx |
| LINK-09 | Email / Tel / SMS / iMessage | 実装済み | 種別ごとの正規化と保存 | pages/api/profile/link.ts, pages/profile/links.tsx |
| PROF-01 | プロフィール作成・編集 | 実装済み | プロフィール更新 API と編集 UI | pages/api/profile/index.ts, pages/profile/edit.tsx |
| PROF-02 | アバターアップロード | 実装済み | 画像アップロードと保存 | pages/api/upload/avatar.ts, pages/profile/edit.tsx |
| PROF-03 | アカウント状態管理 | 実装済み | accountStatus の保存と公開制御 | pages/api/profile/index.ts, pages/api/profile/public.ts |
| BLK-01 | 基本ブロック編集 | 実装済み | プロフィールブロック保存 | pages/api/profile/index.ts |
| BLK-02 | 主要ブロック（Bio/Text, Headline, Line 等） | 実装済み | ブロック内容の保存 | pages/api/profile/index.ts |
| BLK-03 | Video ブロック | 実装済み | URL バリデーション付き video ブロック | pages/api/profile/index.ts |
| ANL-01 | 統計概要 | 実装済み | PV / クリック集計、日次トレンド、Top5、インサイト表示 | pages/api/profile/analytics.ts, pages/profile/edit.tsx, pages/p/[id].tsx |
| QR-01 | QR コード生成 | 実装済み | QR SVG 生成・ダウンロード・プロフィール画像ロゴ併用 | lib/qr.ts, pages/profile/edit.tsx, pages/p/[id].tsx |
| OTH-01 | 構造化ログ | 実装済み | requestMeta / logWarn / logError | lib/logger.ts |
| OTH-02 | 監視 / ヘルスチェック | 実装済み | /api/health, /api/monitoring/* | pages/api/health.ts, pages/api/monitoring/*.ts |
| OTH-03 | E2E 最小フロー | 実装済み | signup -> profile -> public page フロー | tests/e2e/minimal-flow.spec.ts |
| OTH-04 | PR 品質ゲート | 実装済み | API テストと E2E を実行する構成 | package.json |

## 実装状況サマリ

- 実装済み: AUTH-01 〜 AUTH-05, LINK-01 〜 LINK-09, PROF-01 〜 PROF-03, BLK-01 〜 BLK-03, ANL-01, OTH-01 〜 OTH-04, QR-01
- 進行中/未着手: なし

## 次の優先度

1. 追加の E2E / 回帰テスト拡充
2. 仕様書・運用ドキュメントの最終整理
3. 必要に応じた UI/UX の微調整
