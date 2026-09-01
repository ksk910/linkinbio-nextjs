import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { checkRateLimit, getClientIp } from '../../../lib/rate-limit'
import { authRateLimits } from '../../../lib/rate-limit-config'
import { normalizeRequestBody, getString } from '../../../lib/validation'
import { logError, logWarn, requestMeta } from '../../../lib/logger'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const meta = requestMeta(req, '/api/auth/verify-email')
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const ip = getClientIp(req.headers)
  const rate = checkRateLimit({
    key: `auth:verify-email:${ip}`,
    limit: authRateLimits.verifyEmailIp.limit,
    windowMs: authRateLimits.verifyEmailIp.windowMs,
  })
  if (!rate.allowed) {
    logWarn('Rate limited verify email request', { ...meta, ip })
    res.setHeader('Retry-After', String(rate.retryAfterSec))
    return res.status(429).json({ error: 'rate_limited' })
  }

  try {
    const body = normalizeRequestBody(req.body)
    const token = getString(body.token)
    if (!token) return res.status(400).json({ error: 'token_required' })

    const now = new Date()
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpiresAt: { gt: now },
      },
    })

    if (!user) {
      return res.status(400).json({ error: 'invalid_or_expired_token' })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: now,
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      },
    })

    return res.status(200).json({ ok: true })
  } catch (error: any) {
    logError('Verify email API error', { ...meta, error: error?.message || String(error) })
    return res.status(500).json({ error: 'internal' })
  }
}
