import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { verifyPassword, signToken } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  const { email, password } = body
  if (!email || !password) return res.status(400).json({ error: 'missing' })

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return res.status(400).json({ error: 'invalid' })
  const ok = await verifyPassword(password, user.password)
  if (!ok) return res.status(400).json({ error: 'invalid' })

  const token = signToken({ userId: user.id })
  const maxAge = 60 * 60 * 24 * 7
  const cookieParts = [`token=${token}`, `HttpOnly`, `Path=/`, `Max-Age=${maxAge}`]
  if (process.env.NODE_ENV === 'production') {
    cookieParts.push('Secure', 'SameSite=None')
  } else {
    cookieParts.push('SameSite=Lax')
  }
  res.setHeader('Set-Cookie', cookieParts.join('; '))
  res.json({ ok: true, token })
}
