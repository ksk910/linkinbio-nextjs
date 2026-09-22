import { NextApiRequest, NextApiResponse } from 'next'
import { generateOpaqueToken } from '../../../../../lib/auth'
import { getExpectedOrigin } from '../../../../../lib/csrf'
import { buildGoogleAuthorizationUrl, createPkcePair } from '../../../../../lib/oauth-google'
import { checkRateLimit, getClientIp } from '../../../../../lib/rate-limit'
import { authRateLimits } from '../../../../../lib/rate-limit-config'
import { logWarn, requestMeta } from '../../../../../lib/logger'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const meta = requestMeta(req, '/api/auth/oauth/google/start')

  const ip = getClientIp(req.headers)
  const rate = checkRateLimit({
    key: `oauth:google:start:${ip}`,
    limit: authRateLimits.oauthStartIp.limit,
    windowMs: authRateLimits.oauthStartIp.windowMs,
  })
  if (!rate.allowed) {
    logWarn('Rate limited oauth start request', { ...meta, ip })
    res.setHeader('Retry-After', String(rate.retryAfterSec))
    return res.status(429).json({ error: 'rate_limited' })
  }

  const state = generateOpaqueToken(16)
  const { codeVerifier, codeChallenge } = createPkcePair()
  const redirectUri = `${getExpectedOrigin(req)}/api/auth/oauth/google/callback`

  const cookieParts = [
    `oauth_google=${state}:${codeVerifier}`,
    'HttpOnly',
    'Path=/api/auth/oauth/google',
    'Max-Age=600',
  ]
  if (process.env.NODE_ENV === 'production') {
    cookieParts.push('Secure', 'SameSite=Lax')
  } else {
    cookieParts.push('SameSite=Lax')
  }
  res.setHeader('Set-Cookie', cookieParts.join('; '))

  const authorizationUrl = buildGoogleAuthorizationUrl({ state, codeChallenge, redirectUri })
  res.status(302).setHeader('Location', authorizationUrl)
  res.end()
}
