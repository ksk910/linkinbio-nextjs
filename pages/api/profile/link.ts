import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { getTokenFromReq, verifyToken } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = getTokenFromReq(req)
  const data = token ? verifyToken(token as string) as any : null
  const userId = data?.userId

  if (!userId) return res.status(401).json({})

  // Helper to normalize body
  const normalize = (raw: any) => {
    if (!raw) return {}
    if (typeof raw === 'string') {
      try { return JSON.parse(raw) } catch (e) { return {} }
    }
    if (typeof raw === 'object') {
      const keys = Object.keys(raw)
      if (keys.length === 1 && keys[0].trim().startsWith('{')) {
        try { return JSON.parse(keys[0]) } catch (e) { return raw }
      }
      return raw
    }
    return {}
  }

  if (req.method === 'POST') {
    // create
    const body = normalize(req.body)
    const { title, url, order } = body
    if (!title || !url) return res.status(400).json({ error: 'missing' })
    const profile = await prisma.profile.findUnique({ where: { userId } })
    if (!profile) return res.status(400).json({ error: 'no_profile' })
    const link = await prisma.link.create({ data: { profileId: profile.id, title, url, order: order || 0 } })
    return res.json(link)
  }

  if (req.method === 'PUT') {
    const body = normalize(req.body)
    const { id, title, url, order } = body
    if (!id) return res.status(400).json({ error: 'missing_id' })
    const link = await prisma.link.findUnique({ where: { id } })
    if (!link) return res.status(404).json({ error: 'not_found' })
    const profile = await prisma.profile.findUnique({ where: { userId } })
    if (!profile || profile.id !== link.profileId) return res.status(403).json({ error: 'forbidden' })
    const updated = await prisma.link.update({ where: { id }, data: { title, url, order } as any })
    return res.json(updated)
  }

  if (req.method === 'DELETE') {
    const body = normalize(req.body)
    const id = (body && body.id) || (req.query && req.query.id)
    if (!id) return res.status(400).json({ error: 'missing_id' })
    const link = await prisma.link.findUnique({ where: { id: String(id) } })
    if (!link) return res.status(404).json({ error: 'not_found' })
    const profile = await prisma.profile.findUnique({ where: { userId } })
    if (!profile || profile.id !== link.profileId) return res.status(403).json({ error: 'forbidden' })
    await prisma.link.delete({ where: { id: String(id) } })
    return res.json({ ok: true })
  }
  return res.status(405).end()
}
