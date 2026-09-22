import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../../lib/prisma'
import { buildAuthCookie, signToken } from '../../../../../lib/auth'
import { getExpectedOrigin } from '../../../../../lib/csrf'
import { exchangeGoogleCode, fetchGoogleUserInfo } from '../../../../../lib/oauth-google'
import { checkRateLimit, getClientIp } from '../../../../../lib/rate-limit'
import { authRateLimits } from '../../../../../lib/rate-limit-config'
import { logError, logWarn, requestMeta } from '../../../../../lib/logger'

const CLEAR_STATE_COOKIE = 'oauth_google=; HttpOnly; Path=/api/auth/oauth/google; Max-Age=0'

function redirectTo(res: NextApiResponse, path: string) {
  res.status(302).setHeader('Location', path)
  res.end()
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const meta = requestMeta(req, '/api/auth/oauth/google/callback')

  const ip = getClientIp(req.headers)
  const rate = checkRateLimit({
    key: `oauth:google:callback:${ip}`,
    limit: authRateLimits.oauthCallbackIp.limit,
    windowMs: authRateLimits.oauthCallbackIp.windowMs,
  })
  if (!rate.allowed) {
    logWarn('Rate limited oauth callback request', { ...meta, ip })
    res.setHeader('Retry-After', String(rate.retryAfterSec))
    return res.status(429).json({ error: 'rate_limited' })
  }

  const query = req.query
  const errorParam = typeof query.error === 'string' ? query.error : undefined
  if (errorParam) {
    res.setHeader('Set-Cookie', CLEAR_STATE_COOKIE)
    return redirectTo(res, '/login?error=oauth_cancelled')
  }

  const code = typeof query.code === 'string' ? query.code : undefined
  const state = typeof query.state === 'string' ? query.state : undefined

  const cookieHeader = req.headers.cookie || ''
  const cookieMatch = cookieHeader.match(/oauth_google=([^;]+)/)
  const [cookieState, codeVerifier] = cookieMatch ? decodeURIComponent(cookieMatch[1]).split(':') : []

  res.setHeader('Set-Cookie', CLEAR_STATE_COOKIE)

  if (!code || !state || !cookieState || !codeVerifier || state !== cookieState) {
    logWarn('OAuth state mismatch', { ...meta, ip })
    return redirectTo(res, '/login?error=oauth_failed')
  }

  try {
    const redirectUri = `${getExpectedOrigin(req)}/api/auth/oauth/google/callback`
    const tokenResult = await exchangeGoogleCode({ code, codeVerifier, redirectUri })
    const userInfo = await fetchGoogleUserInfo(tokenResult.access_token)

    if (!userInfo.email || !userInfo.email_verified) {
      return redirectTo(res, '/login?error=oauth_email_unverified')
    }

    const existingAccount = await prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider: 'google', providerAccountId: userInfo.sub } },
    })

    let userId: string
    if (existingAccount) {
      userId = existingAccount.userId
    } else {
      const existingUser = await prisma.user.findUnique({ where: { email: userInfo.email } })
      if (existingUser) {
        await prisma.oAuthAccount.create({
          data: { provider: 'google', providerAccountId: userInfo.sub, userId: existingUser.id },
        })
        userId = existingUser.id
      } else {
        const createdUser = await prisma.user.create({
          data: {
            email: userInfo.email,
            password: null,
            emailVerifiedAt: new Date(),
            oauthAccounts: {
              create: { provider: 'google', providerAccountId: userInfo.sub },
            },
          },
        })
        userId = createdUser.id
      }
    }

    const token = signToken({ userId })
    res.setHeader('Set-Cookie', [CLEAR_STATE_COOKIE, buildAuthCookie(token)])
    return redirectTo(res, '/profile/links')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error'
    logError('Google OAuth callback failed', { ...meta, ip, error: message })
    return redirectTo(res, '/login?error=oauth_failed')
  }
}
