# Monitoring Dashboard and Alert Thresholds (PH1-OPS-04)

このドキュメントは監視ダッシュボード API とアラート閾値の定義です。

## Endpoint

- GET /api/monitoring/dashboard

レスポンス例:

```json
{
  "status": "degraded",
  "timestamp": "2026-06-27T11:00:00.000Z",
  "services": {
    "app": "up",
    "db": "up",
    "storage": "down",
    "errorTracking": "down"
  },
  "alerts": ["storage_not_configured", "error_tracking_not_configured"],
  "thresholds": {
    "apiP95Ms": 1000,
    "pageLoadMs": 3000,
    "errorRatePercent": 5,
    "healthFailures": 3
  }
}
```

## Alert Thresholds

環境変数で変更可能です。

- ALERT_API_P95_MS: API p95 目標（既定 1500ms）
- ALERT_PAGE_LOAD_MS: ページロード目標（既定 4000ms）
- ALERT_ERROR_RATE_PERCENT: エラー率アラート閾値（既定 3%）
- ALERT_HEALTH_FAILURES: 連続失敗回数閾値（既定 2）

## Alert Codes

- db_down
- storage_not_configured
- error_tracking_not_configured

## Operational Notes

- status が degraded のときは 503 を返すため、外部監視から検知可能です。
- thresholds はダッシュボード表示と SLO 設定の同期に利用します。
- db_down はログに構造化エラーとして出力されます。
- アラートが発生した場合は、まず `GET /api/monitoring/dashboard` の状態とログを確認し、必要に応じて復旧手順に入ります。
- 主要なリリース前には、ヘルスチェックとエラー監視の状態を確認してから公開します。
- パフォーマンスの簡易チェックは `npm run benchmark:perf` で実行し、目標値としてページ表示 4 秒以内 / API 応答 1.5 秒以内を目安にします。
