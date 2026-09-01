# Phase 2 TODO

## Deferred Items

- DONE-02: E2Eに music link の追加・更新・公開表示の回帰ケースを追加済み。
  - 実施内容: `tests/e2e/minimal-flow.spec.ts` に music link 追加 -> 編集更新 -> 公開ページ表示確認を追加。

- DONE-03: リンク管理画面にフィルタ（すべて / 非表示のみ / musicのみ）を追加済み。
  - 実施内容: `pages/profile/links.tsx` にフィルタUIと表示ロジックを追加。
  - 補足: フィルタ中は誤操作防止のためドラッグ並び替えを無効化。

- DONE-04: QR コード生成と共有 UX を実装済み。
  - 実施内容: `lib/qr.ts` を追加し、プロフィール編集画面と公開ページで QR 生成・ダウンロード・ロゴ付き表示に対応。
  - 補足: テスト `tests/api/qr.integration.test.ts` で生成ロジックを回帰確認。

- DONE-05: analytics と公開プロフィールの主要表示を実装済み。
  - 実施内容: `pages/api/profile/analytics.ts` でイベント記録・集計・日次トレンド・Top5・インサイトを提供し、プロフィール編集画面と公開ページで表示。
  - 補足: `tests/api/analytics.integration.test.ts` と `tests/e2e/minimal-flow.spec.ts` で回帰確認。
