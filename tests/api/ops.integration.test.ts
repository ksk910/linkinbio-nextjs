import assert from 'node:assert/strict'
import test from 'node:test'
import healthHandler from '../../pages/api/health'
import clientErrorHandler from '../../pages/api/monitoring/client-error'
import dashboardHandler from '../../pages/api/monitoring/dashboard'
import { prisma } from '../../lib/prisma'
import { createMockReq, createMockRes } from './helpers'

test('OPS health returns 405 on non-GET', async () => {
  const req = createMockReq({ method: 'POST' })
  const res = createMockRes()

  await healthHandler(req, res)

  assert.equal(res.statusCode, 405)
  assert.deepEqual(res.jsonBody, { error: 'method_not_allowed' })
})

test('OPS health returns 200 when db and storage are up', async () => {
  const originalQueryRawUnsafe = prisma.$queryRawUnsafe
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const originalSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  ;(prisma.$queryRawUnsafe as any) = async () => [{ '?column?': 1 }]
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'

  const req = createMockReq({ method: 'GET' })
  const res = createMockRes()

  try {
    await healthHandler(req, res)
    assert.equal(res.statusCode, 200)
    assert.equal((res.jsonBody as any).status, 'up')
    assert.deepEqual((res.jsonBody as any).checks, {
      app: 'up',
      db: 'up',
      storage: 'up',
    })
  } finally {
    ;(prisma.$queryRawUnsafe as any) = originalQueryRawUnsafe
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalSupabaseAnonKey
  }
})

test('OPS health returns 503 when db probe fails', async () => {
  const originalQueryRawUnsafe = prisma.$queryRawUnsafe
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const originalSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  ;(prisma.$queryRawUnsafe as any) = async () => {
    throw new Error('db_down')
  }
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'

  const req = createMockReq({ method: 'GET' })
  const res = createMockRes()

  try {
    await healthHandler(req, res)
    assert.equal(res.statusCode, 503)
    assert.equal((res.jsonBody as any).status, 'degraded')
    assert.deepEqual((res.jsonBody as any).checks, {
      app: 'up',
      db: 'down',
      storage: 'up',
    })
  } finally {
    ;(prisma.$queryRawUnsafe as any) = originalQueryRawUnsafe
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalSupabaseAnonKey
  }
})

test('OPS client-error returns 405 on non-POST', async () => {
  const req = createMockReq({ method: 'GET' })
  const res = createMockRes()

  await clientErrorHandler(req, res)

  assert.equal(res.statusCode, 405)
  assert.deepEqual(res.jsonBody, { error: 'method_not_allowed' })
})

test('OPS client-error returns 400 when message is missing', async () => {
  const req = createMockReq({ method: 'POST', body: {} })
  const res = createMockRes()

  await clientErrorHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.jsonBody, { error: 'message_required' })
})

test('OPS client-error accepts payload and responds ok', async () => {
  const req = createMockReq({
    method: 'POST',
    body: {
      message: 'ui failed',
      stack: 'Error: ui failed',
      route: '/login',
    },
  })
  const res = createMockRes()

  await clientErrorHandler(req, res)

  assert.equal(res.statusCode, 200)
  assert.equal((res.jsonBody as any).ok, true)
  assert.equal(typeof (res.jsonBody as any).tracked, 'boolean')
})

test('OPS dashboard returns 405 on non-GET', async () => {
  const req = createMockReq({ method: 'POST' })
  const res = createMockRes()

  await dashboardHandler(req, res)

  assert.equal(res.statusCode, 405)
  assert.deepEqual(res.jsonBody, { error: 'method_not_allowed' })
})

test('OPS dashboard returns thresholds and degraded status when optional services are not configured', async () => {
  const originalQueryRawUnsafe = prisma.$queryRawUnsafe
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const originalSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const originalTrackingWebhook = process.env.ERROR_TRACKING_WEBHOOK_URL
  const originalAlertApiP95Ms = process.env.ALERT_API_P95_MS

  ;(prisma.$queryRawUnsafe as any) = async () => [{ '?column?': 1 }]
  process.env.NEXT_PUBLIC_SUPABASE_URL = ''
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ''
  process.env.ERROR_TRACKING_WEBHOOK_URL = ''
  process.env.ALERT_API_P95_MS = '1200'

  const req = createMockReq({ method: 'GET' })
  const res = createMockRes()

  try {
    await dashboardHandler(req, res)
    assert.equal(res.statusCode, 503)
    assert.equal((res.jsonBody as any).status, 'degraded')
    assert.deepEqual((res.jsonBody as any).services, {
      app: 'up',
      db: 'up',
      storage: 'down',
      errorTracking: 'down',
    })
    assert.deepEqual((res.jsonBody as any).alerts, [
      'storage_not_configured',
      'error_tracking_not_configured',
    ])
    assert.equal((res.jsonBody as any).thresholds.apiP95Ms, 1200)
  } finally {
    ;(prisma.$queryRawUnsafe as any) = originalQueryRawUnsafe
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalSupabaseAnonKey
    process.env.ERROR_TRACKING_WEBHOOK_URL = originalTrackingWebhook
    process.env.ALERT_API_P95_MS = originalAlertApiP95Ms
  }
})
