# Phase 3 TODO

## Completed

- P3-01: analytics イベントの過剰送信を抑制するレート制限を追加済み。
  - 実施内容: `pages/api/profile/analytics.ts` に profile/IP 単位のレート制限を追加。
  - 対象: 連続アクセスによるイベント増加の抑止。

- P3-02: 公開プロフィール API のキャッシュ・セキュリティヘッダーを強化済み。
  - 実施内容: `pages/api/profile/public.ts` に `Cache-Control` / `Pragma` / `X-Content-Type-Options` を付与。
  - 対象: CDN / プロキシ / ブラウザキャッシュの扱い改善。

- P3-03: 監視しきい値のより現実的な調整と、アラートの運用ルール整理を実施済み。
  - 実施内容: `lib/monitoring-config.ts` と `docs/monitoring-dashboard.md` を更新。

- P3-04: ロード/性能の簡易ベンチマークを追加し、目標値を明文化済み。
  - 実施内容: `scripts/perf-benchmark.ts` と `package.json` を追加。

- P3-05: セキュリティ・運用手順（バックアップ/ロールバック/秘密情報管理）を docs に整理済み。
  - 実施内容: `docs/db-migration-runbook.md` に運用メモを追加。

## Next Up

- Phase 3 の完了レポートをまとめる。
- Phase 4 での Go / No-Go 判定に使うチェックリストを整理する。
- デプロイ / ロールバック手順の運用書を整える。
- Phase 4 のタスク一覧を作成する。
