import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { checkRateLimit, getClientIp } from '../../../lib/rate-limit'
import { authRateLimits } from '../../../lib/rate-limit-config'
import { generateOpaqueToken } from '../../../lib/auth'
import { normalizeRequestBody, validateEmail } from '../../../lib/validation'
import { logError, logWarn, requestMeta } from '../../../lib/logger'
import { sendVerificationEmail } from '../../../lib/email'

const VERIFICATION_WINDOW_MS = 24 * 60 * 60 * 1000

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const meta = requestMeta(req, '/api/auth/resend-verification')
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const ip = getClientIp(req.headers)
  const rate = checkRateLimit({
    key: `auth:resend-verification:${ip}`,
    limit: authRateLimits.resendVerificationIp.limit,
    windowMs: authRateLimits.resendVerificationIp.windowMs,
  })
  if (!rate.allowed) {
    logWarn('Rate limited resend verification request', { ...meta, ip })
    res.setHeader('Retry-After', String(rate.retryAfterSec))
    return res.status(429).json({ error: 'rate_limited' })
  }

  try {
    const body = normalizeRequestBody(req.body)
    const emailValidation = validateEmail(body.email)
    if (!emailValidation.ok) return res.status(400).json({ error: emailValidation.error })
    const email = emailValidation.value

    const emailRate = checkRateLimit({
      key: `auth:resend-verification:email:${email}`,
      limit: authRateLimits.resendVerificationEmail.limit,
      windowMs: authRateLimits.resendVerificationEmail.windowMs,
    })
    if (!emailRate.allowed) {
      logWarn('Rate limited resend verification request by email', { ...meta, ip })
      res.setHeader('Retry-After', String(emailRate.retryAfterSec))
      return res.status(429).json({ error: 'rate_limited' })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(200).json({ ok: true })

    if (user.emailVerifiedAt) {
      return res.status(200).json({ ok: true, alreadyVerified: true })
    }

    const verificationToken = generateOpaqueToken(24)
    const verificationExpiresAt = new Date(Date.now() + VERIFICATION_WINDOW_MS)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpiresAt: verificationExpiresAt,
      },
    })

    // メール送信（失敗しても成功レスポンスを返す）
    try {
      await sendVerificationEmail({ to: email, token: verificationToken })
    } catch (emailErr) {
      const msg = emailErr instanceof Error ? emailErr.message : String(emailErr)
      logError('Failed to send verification email', { ...meta, error: msg })
    }

    const payload: Record<string, unknown> = { ok: true }
    if (process.env.NODE_ENV !== 'production') {
      payload.verificationToken = verificationToken
      payload.verificationExpiresAt = verificationExpiresAt.toISOString()
    }

    return res.status(200).json(payload)
  } catch (error: any) {
    logError('Resend verification API error', { ...meta, error: error?.message || String(error) })
    return res.status(500).json({ error: 'internal' })
  }
}
