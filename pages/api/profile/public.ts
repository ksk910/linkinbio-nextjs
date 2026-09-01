import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const { id, userId, slug } = req.query
  let where: any = null
  
  if (slug) {
    where = { slug: String(slug) }
  } else if (id) {
    where = { id: String(id) }
  } else if (userId) {
    where = { userId: String(userId) }
  }
  
  if (!where) {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    return res.status(400).json({ error: 'id、userId または slug を指定してください' })
  }
  const profile = await prisma.profile.findUnique({ 
    where: where as any, 
    include: {
      links: { where: { hidden: false }, orderBy: { order: 'asc' } },
      blocks: { orderBy: { order: 'asc' } },
    }
  })
  if (!profile) {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    return res.status(404).json({ error: 'プロフィールが見つかりません' })
  }
  if ((profile as any).accountStatus === 'disabled') {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    return res.status(404).json({ error: 'プロフィールが見つかりません' })
  }
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  const visibleLinks = Array.isArray((profile as any).links)
    ? (profile as any).links.filter((link: any) => !link.hidden)
    : []
  return res.json({ ...profile, links: visibleLinks })
}
