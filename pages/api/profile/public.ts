import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id, userId } = req.query
  const where = id ? { id: String(id) } : userId ? { userId: String(userId) } : null
  if (!where) return res.status(400).setHeader('Cache-Control', 'no-store').json({ error: 'id または userId を指定してください' })
  const profile = await prisma.profile.findUnique({ 
    where: where as any, 
    include: { links: { orderBy: { order: 'asc' } } } 
  })
  if (!profile) return res.status(404).setHeader('Cache-Control', 'no-store').json({ error: 'プロフィールが見つかりません' })
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
  return res.json(profile)
}
