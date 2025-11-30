import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { getTokenFromReq, verifyToken } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = getTokenFromReq(req)
  const data = token ? verifyToken(token as string) as any : null
  const userId = data?.userId

  if (req.method === 'GET') {
    if (!userId) return res.status(401).json({})
    const profile = await prisma.profile.findUnique({ 
      where: { userId }, 
      include: { links: { orderBy: { order: 'asc' } } } 
    })
    return res.json(profile)
  }

  if (req.method === 'POST') {
    if (!userId) return res.status(401).json({})
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
    const { displayName, bio, avatarUrl } = body
    const existing = await prisma.profile.findUnique({ where: { userId } })
    if (existing) {
      const updated = await prisma.profile.update({ where: { userId }, data: { displayName, bio, avatarUrl } as any })
      return res.json(updated)
    }
    const created = await prisma.profile.create({ data: { userId, displayName, bio, avatarUrl } as any })
    return res.json(created)
  }

  res.status(405).end()
}
