import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { getAlertThresholds } from '../../../lib/monitoring-config'
import { logError, requestMeta } from '../../../lib/logger'

type ServiceState = 'up' | 'down'

type DashboardResponse = {
  status: 'up' | 'degraded'
  timestamp: string
  services: {
    app: ServiceState
    db: ServiceState
    storage: ServiceState
    errorTracking: ServiceState
  }
  alerts: string[]
  thresholds: {
    apiP95Ms: number
    pageLoadMs: number
    errorRatePercent: number
    healthFailures: number
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<DashboardResponse | { error: string }>) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const meta = requestMeta(req, '/api/monitoring/dashboard')
  const services: DashboardResponse['services'] = {
    app: 'up',
    db: 'up',
    storage: 'up',
    errorTracking: 'up',
  }

  try {
    await prisma.$queryRawUnsafe('SELECT 1')
  } catch (error: any) {
    services.db = 'down'
    logError('Monitoring dashboard DB probe failed', {
      ...meta,
      error: error?.message || String(error),
    })
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    services.storage = 'down'
  }

  if (!process.env.ERROR_TRACKING_WEBHOOK_URL) {
    services.errorTracking = 'down'
  }

  const alerts: string[] = []
  if (services.db === 'down') alerts.push('db_down')
  if (services.storage === 'down') alerts.push('storage_not_configured')
  if (services.errorTracking === 'down') alerts.push('error_tracking_not_configured')

  const status = alerts.length > 0 ? 'degraded' : 'up'
  const statusCode = status === 'up' ? 200 : 503

  return res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    services,
    alerts,
    thresholds: getAlertThresholds(),
  })
}
