# Vercel Deployment Guide

## Required Secrets

Set these GitHub repository secrets before enabling deployment automation:

- VERCEL_TOKEN
- VERCEL_ORG_ID
- VERCEL_PROJECT_ID
- DATABASE_URL
- SLACK_WEBHOOK_URL (optional, for deployment success and failure notifications)

## Deployment Flow

1. Push to the main branch
2. GitHub Actions runs CI checks and the deployment workflow
3. The app is deployed to Vercel with the production target

## Environment Variables

Configure the following in Vercel project settings:

- DATABASE_URL
- JWT_SECRET
- NODE_ENV=production

## Notes

- Prisma migrations are applied automatically in the deployment workflow before the app is deployed
- Ensure the GitHub repository has a valid DATABASE_URL secret
- Verify the health endpoint after deployment
