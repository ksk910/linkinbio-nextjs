# Release Operations Runbook

## Purpose

This runbook covers the minimum operational steps required to deploy the app safely and recover quickly if something goes wrong.

## Pre-Deployment Checklist

- Confirm the target commit is reviewed and tested
- Run `npm run test:api`
- Run `npm run test:e2e`
- Run `npm run benchmark:perf`
- Confirm environment variables are present and valid
- Take a database backup before applying migrations

## Deployment Steps

1. Review migration status with `npm run prisma:migrate:status`
2. Run full test suite: `npm run test:api && npm run test:e2e`
3. Deploy with alias update in one command:
   ```
   npm run deploy
   ```
   This runs `vercel --prod` and automatically re-aliases `implink.link` and `www.implink.link` to the new deployment.
4. Verify health: `curl https://implink.link/api/health`
5. Confirm `{"status":"up","checks":{"app":"up","db":"up","storage":"up"}}`

## Rollback Steps

1. Find the previous deployment URL from `npx vercel ls`
2. Re-alias the domain:
   ```
   npx vercel alias <previous-deploy-url> implink.link
   npx vercel alias <previous-deploy-url> www.implink.link
   ```
3. Verify health endpoint returns `up`
4. If a DB migration caused the issue, apply a corrective migration or use `npm run prisma:migrate:resolve:rolledback`
5. Re-run smoke tests: `npm run test:e2e`

## Incident Response

- Check `/api/health`
- Review recent logs and monitoring alerts
- Confirm whether the issue is database, application, or external service related
- Notify the responsible owner and document the incident
