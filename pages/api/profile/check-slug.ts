import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { checkRateLimit, getClientIp } from '../../../lib/rate-limit'
import { logError, logWarn, requestMeta } from '../../../lib/logger'
import { normalizeRequestBody, validateSlug } from '../../../lib/validation'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const meta = requestMeta(req, '/api/profile/check-slug')
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const ip = getClientIp(req.headers)
  const rate = checkRateLimit({
    key: `profile:check-slug:${ip}`,
    limit: 30,
    windowMs: 60_000,
  })
  if (!rate.allowed) {
    logWarn('Rate limited slug check request', { ...meta, ip })
    res.setHeader('Retry-After', String(rate.retryAfterSec))
    return res.status(429).json({ available: false, error: 'rate_limited' })
  }

  const body = normalizeRequestBody(req.body)
  const slugValidation = validateSlug(body.slug)
  if (!slugValidation.ok) {
    return res.status(400).json({ available: false, error: slugValidation.error })
  }
  const slug = slugValidation.value
  const excludeUserId = typeof body.excludeUserId === 'string' ? body.excludeUserId : undefined

  try {
    const existingProfile = await prisma.profile.findUnique({
      where: { slug }
    })

    // 同じユーザーの場合は許可（編集時）
    if (existingProfile && existingProfile.userId !== excludeUserId) {
      return res.status(200).json({ available: false })
    }

    return res.status(200).json({ available: true })
  } catch (error) {
    logError('Slug validation error', { ...meta, error: String(error) })
    return res.status(500).json({ error: 'Internal server error' })
  }
}
