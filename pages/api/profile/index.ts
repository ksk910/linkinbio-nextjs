import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { getTokenFromReq, verifyToken } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    const token = getTokenFromReq(req)
    const data = token ? (verifyToken(token as string) as any) : null
    const userId = data?.userId

    if (req.method === 'GET') {
      if (!userId) return res.status(401).json({ error: 'unauthorized' })
      try {
        const profile = await prisma.profile.findUnique({
          where: { userId },
          include: { links: { orderBy: { order: 'asc' } } }
        })
        return res.json(profile)
      } catch (dbErr: any) {
        console.error('API /profile DB error:', dbErr)
        return res.status(500).json({ error: 'db', code: dbErr?.code || dbErr?.name || 'unknown' })
      }
    }

    if (req.method === 'POST') {
      if (!userId) return res.status(401).json({ error: 'unauthorized' })
      function normalizeBody(raw: any) {
        if (!raw) return {}
        if (typeof raw === 'string') {
          try { return JSON.parse(raw) } catch (e) { return {} }
        }
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
      const { displayName, bio, avatarUrl, slug } = body
      const existing = await prisma.profile.findUnique({ where: { userId } })
      if (existing) {
        const updated = await prisma.profile.update({ where: { userId }, data: { displayName, bio, avatarUrl, slug } as any })
        return res.json(updated)
      }
      const created = await prisma.profile.create({ data: { userId, displayName, bio, avatarUrl, slug } as any })
      return res.json(created)
    }

    res.status(405).end()
  } catch (err: any) {
    console.error('API /profile error:', err)
    const code = err?.code || err?.name || 'unknown'
    return res.status(500).json({ error: 'internal', code })
  }
}
