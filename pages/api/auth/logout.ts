import { NextApiRequest, NextApiResponse } from 'next'
import { assertCsrf } from '../../../lib/csrf'
import { requestMeta, logWarn } from '../../../lib/logger'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const meta = requestMeta(req, '/api/auth/logout')
  if (req.method !== 'POST') return res.status(405).end()
  const csrf = assertCsrf(req)
  if (!csrf.ok) {
    logWarn('Blocked logout by CSRF guard', { ...meta, error: csrf.error })
    return res.status(403).json({ error: csrf.error })
  }
  const cookieParts = ['token=','HttpOnly','Path=/','Max-Age=0','SameSite=Lax']
  if (process.env.NODE_ENV === 'production') cookieParts.push('Secure')
  res.setHeader('Set-Cookie', cookieParts.join('; '))
  res.json({ ok: true })
}
