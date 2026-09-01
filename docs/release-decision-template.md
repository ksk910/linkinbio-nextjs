# Release Decision Template

## Release Summary
- Product: Link in Bio (implink.link)
- Target: Closed beta
- Date: 2026-08-02
- Owner: ksk910

## Go / No-Go Checklist

### Functional
- [x] Core signup/login flow works
- [x] Email verification works (Resend + implink.link domain)
- [x] Profile editing works
- [x] Link management works
- [x] Public profile renders correctly

### Quality
- [x] API tests pass (119/119)
- [x] E2E smoke tests pass (2/2)
- [x] Performance benchmark meets target (all < 0.03ms, target < 1.5s)

### Operations
- [x] Health endpoint is healthy (`{"status":"up","checks":{"app":"up","db":"up","storage":"up"}}`)
- [x] Monitoring dashboard reachable at `/api/monitoring/dashboard`
- [x] Rollback plan documented in `release-operations-runbook.md`
- [x] Secrets managed in Vercel encrypted env vars (DATABASE_URL, JWT_SECRET, RESEND_API_KEY)
- [ ] Error tracking service configured (Sentry 等 — 今後対応)

## Decision
- Status: **Go**
- Reason: 全機能テスト通過・本番 DB/メール送信確認済み・デプロイ・ロールバック手順整備済み
- Follow-up actions:
  - Error tracking サービス（Sentry 等）の導入
  - Supabase の自動一時停止を防ぐため定期的にアクティビティを維持する
  - `npm run deploy` を使い implink.link alias が常に最新を向くようにする
