import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { verifyPassword, signToken } from '../../../lib/auth'
import { checkRateLimit, getClientIp } from '../../../lib/rate-limit'
import { authRateLimits } from '../../../lib/rate-limit-config'
import { logWarn, requestMeta } from '../../../lib/logger'
import { normalizeRequestBody, validateEmail, validatePassword } from '../../../lib/validation'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const meta = requestMeta(req, '/api/auth/login')

  const ip = getClientIp(req.headers)
  const rate = checkRateLimit({
    key: `auth:login:${ip}`,
    limit: authRateLimits.loginIp.limit,
    windowMs: authRateLimits.loginIp.windowMs,
  })
  if (!rate.allowed) {
    logWarn('Rate limited login request', { ...meta, ip })
    res.setHeader('Retry-After', String(rate.retryAfterSec))
    return res.status(429).json({ error: 'rate_limited' })
  }

  const body = normalizeRequestBody(req.body)
  const emailValidation = validateEmail(body.email)
  if (!emailValidation.ok) return res.status(400).json({ error: emailValidation.error })

  const passwordValidation = validatePassword(body.password)
  if (!passwordValidation.ok) return res.status(400).json({ error: passwordValidation.error })

  const email = emailValidation.value
  const password = passwordValidation.value

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return res.status(400).json({ error: 'invalid' })
  if (!user.emailVerifiedAt) return res.status(403).json({ error: 'email_not_verified' })
  const ok = await verifyPassword(password, user.password)
  if (!ok) return res.status(400).json({ error: 'invalid' })

  const token = signToken({ userId: user.id })
  const maxAge = 60 * 60 * 24 * 7
  const cookieParts = [`token=${token}`, `HttpOnly`, `Path=/`, `Max-Age=${maxAge}`]
  if (process.env.NODE_ENV === 'production') {
    cookieParts.push('Secure', 'SameSite=Lax')
  } else {
    cookieParts.push('SameSite=Lax')
  }
  res.setHeader('Set-Cookie', cookieParts.join('; '))
  res.json({ ok: true, token })
}
