import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { hashPassword, signToken } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  // Normalize body: accept string, parsed object, or urlencoded form where the JSON string is the key
  function normalizeBody(raw: any) {
    if (!raw) return {}
    if (typeof raw === 'string') {
      try { return JSON.parse(raw) } catch (e) { return {} }
    }
    // If body parsed to an object like { '{"a":1}': '' } (curl -d without JSON header),
    // detect a single key that looks like JSON and parse it.
    if (typeof raw === 'object') {
      const keys = Object.keys(raw)
      if (keys.length === 1) {
        const k = keys[0]
        if (k && k.trim().startsWith('{') && k.trim().endsWith('}')) {
          try { return JSON.parse(k) } catch (e) { /* fallthrough */ }
        }
      }
      return raw
    }
    return {}
  }

  const body = normalizeBody(req.body)
  const { email, password } = body
  if (!email || !password) return res.status(400).json({ error: 'missing' })

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return res.status(400).json({ error: 'exists' })

  const hashed = await hashPassword(password)
  const user = await prisma.user.create({ data: { email, password: hashed } })
  const token = signToken({ userId: user.id })
  // Set cookie with secure flags in production
  const maxAge = 60 * 60 * 24 * 7
  const cookieParts = [`token=${token}`, `HttpOnly`, `Path=/`, `Max-Age=${maxAge}`]
  if (process.env.NODE_ENV === 'production') {
    cookieParts.push('Secure', 'SameSite=None')
  } else {
    cookieParts.push('SameSite=Lax')
  }
  res.setHeader('Set-Cookie', cookieParts.join('; '))
  res.json({ ok: true })
}
