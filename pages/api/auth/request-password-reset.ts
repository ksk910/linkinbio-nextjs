import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { checkRateLimit, getClientIp } from '../../../lib/rate-limit'
import { authRateLimits } from '../../../lib/rate-limit-config'
import { generateOpaqueToken } from '../../../lib/auth'
import { normalizeRequestBody, validateEmail } from '../../../lib/validation'
import { logError, logWarn, requestMeta } from '../../../lib/logger'
import { sendPasswordResetEmail } from '../../../lib/email'

const RESET_WINDOW_MS = 60 * 60 * 1000

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const meta = requestMeta(req, '/api/auth/request-password-reset')
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const ip = getClientIp(req.headers)
  const rate = checkRateLimit({
    key: `auth:request-password-reset:${ip}`,
    limit: authRateLimits.requestPasswordResetIp.limit,
    windowMs: authRateLimits.requestPasswordResetIp.windowMs,
  })
  if (!rate.allowed) {
    logWarn('Rate limited password reset request', { ...meta, ip })
    res.setHeader('Retry-After', String(rate.retryAfterSec))
    return res.status(429).json({ error: 'rate_limited' })
  }

  try {
    const body = normalizeRequestBody(req.body)
    const emailValidation = validateEmail(body.email)
    if (!emailValidation.ok) return res.status(400).json({ error: emailValidation.error })
    const email = emailValidation.value

    const emailRate = checkRateLimit({
      key: `auth:request-password-reset:email:${email}`,
      limit: authRateLimits.requestPasswordResetEmail.limit,
      windowMs: authRateLimits.requestPasswordResetEmail.windowMs,
    })
    if (!emailRate.allowed) {
      logWarn('Rate limited password reset request by email', { ...meta, ip })
      res.setHeader('Retry-After', String(emailRate.retryAfterSec))
      return res.status(429).json({ error: 'rate_limited' })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(200).json({ ok: true })

    const resetToken = generateOpaqueToken(24)
    const resetExpiresAt = new Date(Date.now() + RESET_WINDOW_MS)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpiresAt: resetExpiresAt,
      },
    })

    // メール送信（失敗しても成功レスポンスを返す）
    try {
      await sendPasswordResetEmail({ to: email, token: resetToken })
    } catch (emailErr) {
      const msg = emailErr instanceof Error ? emailErr.message : String(emailErr)
      logError('Failed to send password reset email', { ...meta, error: msg })
    }

    const payload: Record<string, unknown> = { ok: true }
    if (process.env.NODE_ENV !== 'production') {
      payload.resetToken = resetToken
      payload.resetExpiresAt = resetExpiresAt.toISOString()
    }

    return res.status(200).json(payload)
  } catch (error: any) {
    logError('Request password reset API error', { ...meta, error: error?.message || String(error) })
    return res.status(500).json({ error: 'internal' })
  }
}
