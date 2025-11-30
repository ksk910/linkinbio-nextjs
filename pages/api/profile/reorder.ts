import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { getTokenFromReq, verifyToken } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = getTokenFromReq(req)
  const data = token ? (verifyToken(token as string) as any) : null
  const userId = data?.userId

  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const { linkIds } = req.body

    if (!Array.isArray(linkIds)) {
      return res.status(400).json({ error: 'linkIds must be an array' })
    }

    // リンクの並び順を一括更新
    const updatePromises = linkIds.map((linkId, index) =>
      prisma.link.update({
        where: { id: linkId },
        data: { order: index },
      })
    )

    await Promise.all(updatePromises)

    return res.json({ success: true })
  } catch (e: any) {
    console.error('Reorder error:', e)
    return res.status(500).json({ error: e.message })
  }
}
