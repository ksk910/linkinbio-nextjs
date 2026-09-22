import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { generateOpaqueToken, hashPassword, signToken, buildAuthCookie } from '../../../lib/auth'
import { checkRateLimit, getClientIp } from '../../../lib/rate-limit'
import { authRateLimits } from '../../../lib/rate-limit-config'
import { logError, logWarn, requestMeta } from '../../../lib/logger'
import { normalizeRequestBody, validateEmail, validatePassword } from '../../../lib/validation'
import { sendVerificationEmail } from '../../../lib/email'

const VERIFICATION_WINDOW_MS = 24 * 60 * 60 * 1000

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  const meta = requestMeta(req, '/api/auth/signup')

  try {
    const ip = getClientIp(req.headers)
    const rate = checkRateLimit({
      key: `auth:signup:${ip}`,
      limit: authRateLimits.signupIp.limit,
      windowMs: authRateLimits.signupIp.windowMs,
    })
    if (!rate.allowed) {
      logWarn('Rate limited signup request', { ...meta, ip })
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

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return res.status(400).json({ error: 'exists' })

    const hashed = await hashPassword(password)
    const verificationToken = generateOpaqueToken(24)
    const verificationExpiresAt = new Date(Date.now() + VERIFICATION_WINDOW_MS)

    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        emailVerificationToken: verificationToken,
        emailVerificationExpiresAt: verificationExpiresAt,
      },
    })
    const token = signToken({ userId: user.id })
    res.setHeader('Set-Cookie', buildAuthCookie(token))
    // メール送信（失敗しても登録自体は成功とする）
    try {
      await sendVerificationEmail({ to: email, token: verificationToken })
    } catch (emailErr) {
      const msg = emailErr instanceof Error ? emailErr.message : String(emailErr)
      logError('Failed to send verification email', { ...meta, error: msg })
    }

    const payload: Record<string, unknown> = {
      ok: true,
      token,
      emailVerificationRequired: true,
    }
    if (process.env.NODE_ENV !== 'production') {
      payload.verificationToken = verificationToken
      payload.verificationExpiresAt = verificationExpiresAt.toISOString()
    }

    return res.json(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error'
    logError('Signup failed unexpectedly', { ...meta, error: message })
    return res.status(500).json({ error: 'server_error' })
  }
}
