import { NextApiRequest } from 'next'

type CsrfResult =
  | { ok: true }
  | { ok: false; error: 'csrf_origin_missing' | 'csrf_origin_mismatch' }

export function assertCsrf(req: NextApiRequest): CsrfResult {
  const method = (req.method || 'GET').toUpperCase()
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return { ok: true }
  }

  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return { ok: true }
  }

  const cookie = req.headers.cookie || ''
  const hasSessionCookie = /(?:^|;\s*)token=/.test(cookie)
  if (!hasSessionCookie) {
    return { ok: true }
  }

  const expectedOrigin = getExpectedOrigin(req)
  const actualOrigin = getActualOrigin(req)
  if (!actualOrigin) {
    return { ok: false, error: 'csrf_origin_missing' }
  }

  if (actualOrigin !== expectedOrigin) {
    return { ok: false, error: 'csrf_origin_mismatch' }
  }

  return { ok: true }
}

function getExpectedOrigin(req: NextApiRequest): string {
  const forwardedProto = headerString(req.headers['x-forwarded-proto'])
  const proto = forwardedProto || (process.env.NODE_ENV === 'production' ? 'https' : 'http')
  const host =
    headerString(req.headers['x-forwarded-host']) ||
    headerString(req.headers.host) ||
    'localhost:3000'
  return `${proto}://${host}`
}

function getActualOrigin(req: NextApiRequest): string | undefined {
  const origin = headerString(req.headers.origin)
  if (origin) return origin

  const referer = headerString(req.headers.referer)
  if (!referer) return undefined

  try {
    const url = new URL(referer)
    return `${url.protocol}//${url.host}`
  } catch {
    return undefined
  }
}

function headerString(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value
  if (Array.isArray(value) && value.length > 0) return value[0]
  return undefined
}
