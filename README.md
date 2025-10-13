# Link-in-bio Clone (Minimal)

ローカルで始めるための最小実装です。Next.js + TypeScript + Tailwind + Prisma を使用しています。簡易認証、プロフィール編集、公開プロフィールページ（リンク一覧）を含みます。

セットアップ手順:

1. 依存関係をインストール

```bash
cd linkinbio
npm install
```

2. Prisma 初期化（デフォルトは SQLite）

```bash
npx prisma migrate dev --name init
```

3. 開発サーバー起動

```bash
npm run dev
```

本番用に PostgreSQL を使う場合は、`DATABASE_URL` を Postgres の接続文字列に変更してください。Vercel/Render にデプロイする際のメモはファイル内のコメント参照。

Production deployment (short guide)

1) Use PostgreSQL in production

- Change `.env` or set `DATABASE_URL` in your hosting provider to a PostgreSQL URL, e.g.
	`postgresql://USER:PASSWORD@HOST:5432/dbname?schema=public`
- Run Prisma migrate on the production DB (or run `prisma migrate deploy` during CI):
	```bash
	npx prisma migrate deploy
	```

2) Environment variables

- Required in production:
	- `DATABASE_URL` - your Postgres connection string
	- `JWT_SECRET` - secure random secret for signing tokens
	- `NODE_ENV=production`

3) Deploying frontend + API to Vercel (recommended for Next.js)

- Push repository to GitHub and connect to Vercel.
- Configure Environment Variables in Vercel dashboard: `DATABASE_URL`, `JWT_SECRET`.
- Vercel will build and deploy your Next.js app. For Prisma, ensure your deployment step runs `npx prisma generate` and your production DB is migrated.

4) Deploying separate backend on Render (optional)

- If you prefer separating DB/back-end from Next.js, you can host the API on Render and frontend on Vercel. Configure `DATABASE_URL` and `JWT_SECRET` on Render.
- Use a managed Postgres from Render, Railway, or Supabase for ease.

5) Notes

- Cookie settings: in production cookies are set with `Secure` and `SameSite=Lax` in the code. If you're running behind a proxy, ensure `X-Forwarded-Proto` is handled by your host so Secure cookies can be transmitted.
- For file uploads (avatars) and media, use an object storage (S3/GCS) and store URLs in `avatarUrl`.
- Add proper email verification, password reset, and rate-limiting before public launch.

Push to GitHub (quick start)

1. Create a repository on GitHub (private or public) and copy the remote URL.

2. Initialize git (if not already) and push:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <REMOTE_URL>
git push -u origin main
```

3. Connect the repository to Vercel (or your host) and configure environment variables as described above.

## CI と型宣言について

このリポジトリには GitHub Actions による CI ワークフロー（`.github/workflows/ci.yml`）が含まれています。CI は `npm ci`, `npx prisma generate`, `npm run build` を実行します。

注意点:
- 一部サードパーティのパッケージ（例えば `bcrypt` や `jsonwebtoken`）は型定義が含まれていないか、プロジェクトに @types/* を追加していないため、CI 上の TypeScript チェックでエラーになることがあります。
- これを回避するために、暫定措置として `types/bcrypt.d.ts` と `types/jsonwebtoken.d.ts` の最小型宣言ファイルを追加しています。長期的には `npm i -D @types/jsonwebtoken @types/bcrypt` の追加や、より正確な型定義を導入することをおすすめします。

## Vercel へのデプロイ

1. Vercel アカウントを作成し、GitHub と連携します。
2. New Project から `ksk910/linkinbio-nextjs` を選択してインポートします。
3. 環境変数を Vercel のプロジェクト設定へ追加します（`Environment Variables`）:

```
JWT_SECRET=your_production_jwt_secret
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME
```

4. デプロイ後、アプリケーションが正常に起動するか確認します。Prisma を Postgres で使う場合は、データベースマイグレーションを実行するか、`prisma migrate deploy` を CI に追加してください。

### Vercel でのマイグレーション実行

Vercel はビルド環境でデータベースへのマイグレーションを実行することを推奨していません。安全にマイグレーションを行う方法の一例:

- GitHub Actions のワークフローで `prisma migrate deploy` を実行（環境変数 `DATABASE_URL` を Actions に設定）。
- または、Render や Fly.io のようなプラットフォームでマイグレーション用のジョブを実行する。

パッケージに以下のスクリプトを追加しています:

```
npm run prisma:migrate:prod
```

これにより、プロダクション環境でのマイグレーションを CI/CD の一部として簡単に実行できます。


