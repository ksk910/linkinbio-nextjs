import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../lib/prisma'
import { logError, requestMeta } from '../../lib/logger'

type CheckStatus = 'up' | 'down'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const meta = requestMeta(req, '/api/health')
  const checks: { app: CheckStatus; db: CheckStatus; storage: CheckStatus } = {
    app: 'up',
    db: 'up',
    storage: 'up',
  }

  try {
    await prisma.$queryRawUnsafe('SELECT 1')
  } catch (error: any) {
    checks.db = 'down'
    logError('Health check DB probe failed', {
      ...meta,
      error: error?.message || String(error),
    })
  }

  const storageConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  if (!storageConfigured) {
    checks.storage = 'down'
  }

  const overall = checks.app === 'up' && checks.db === 'up' && checks.storage === 'up' ? 'up' : 'degraded'
  const statusCode = overall === 'up' ? 200 : 503

  return res.status(statusCode).json({
    status: overall,
    timestamp: new Date().toISOString(),
    checks,
  })
}
