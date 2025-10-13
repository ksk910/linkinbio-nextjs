import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id, userId } = req.query
  const where = id ? { id: String(id) } : userId ? { userId: String(userId) } : null
  if (!where) return res.status(400).json({})
  const profile = await prisma.profile.findUnique({ where: where as any, include: { links: true } })
  return res.json(profile)
}
