# Phase 4 Readiness Checklist

## Go / No-Go 条件

### Functional
- 新規登録からログイン、プロフィール編集、公開ページ表示までの主要フローが成功する
- リンクの追加・編集・削除・並び替えが動作する
- アバターアップロードと保存が成功する
- 主要エラー時に適切なメッセージが表示される

### Quality
- API テストが主要機能で成功している
- E2E の最小フローが成功している
- 監視・ログ・ヘルスチェックが運用可能である

### Operations
- データベースマイグレーション手順が確認できる
- ロールバック手順が確認できる
- シークレット管理と監査ログの運用方法が確認できる

## Recommended Pre-Launch Checks

1. Run API tests: `npm run test:api`
2. Run E2E smoke flow: `npm run test:e2e`
3. Run performance benchmark: `npm run benchmark:perf`
4. Confirm monitoring dashboard and health endpoint are reachable
5. Review rollback and secret rotation steps with the ops owner
