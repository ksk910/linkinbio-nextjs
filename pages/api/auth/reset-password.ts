import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { hashPassword } from '../../../lib/auth'
import { checkRateLimit, getClientIp } from '../../../lib/rate-limit'
import { authRateLimits } from '../../../lib/rate-limit-config'
import { normalizeRequestBody, validatePassword, getString } from '../../../lib/validation'
import { logError, logWarn, requestMeta } from '../../../lib/logger'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const meta = requestMeta(req, '/api/auth/reset-password')
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const ip = getClientIp(req.headers)
  const rate = checkRateLimit({
    key: `auth:reset-password:${ip}`,
    limit: authRateLimits.resetPasswordIp.limit,
    windowMs: authRateLimits.resetPasswordIp.windowMs,
  })
  if (!rate.allowed) {
    logWarn('Rate limited reset password request', { ...meta, ip })
    res.setHeader('Retry-After', String(rate.retryAfterSec))
    return res.status(429).json({ error: 'rate_limited' })
  }

  try {
    const body = normalizeRequestBody(req.body)
    const token = getString(body.token)
    if (!token) return res.status(400).json({ error: 'token_required' })

    const passwordValidation = validatePassword(body.newPassword)
    if (!passwordValidation.ok) {
      return res.status(400).json({ error: passwordValidation.error })
    }
    const newPassword = passwordValidation.value

    const confirmPassword = getString(body.confirmPassword)
    if (!confirmPassword) return res.status(400).json({ error: 'confirm_password_required' })
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'passwords_do_not_match' })
    }

    const now = new Date()
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpiresAt: { gt: now },
      },
    })

    if (!user) {
      return res.status(400).json({ error: 'invalid_or_expired_token' })
    }

    const hashed = await hashPassword(newPassword)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        resetPasswordToken: null,
        resetPasswordExpiresAt: null,
      },
    })

    return res.status(200).json({ ok: true })
  } catch (error: any) {
    logError('Reset password API error', { ...meta, error: error?.message || String(error) })
    return res.status(500).json({ error: 'internal' })
  }
}
