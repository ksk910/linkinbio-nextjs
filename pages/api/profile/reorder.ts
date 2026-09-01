import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { getTokenFromReq, verifyToken } from '../../../lib/auth'
import { assertCsrf } from '../../../lib/csrf'
import { logError, requestMeta } from '../../../lib/logger'
import { normalizeRequestBody } from '../../../lib/validation'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const meta = requestMeta(req, '/api/profile/reorder')
  if (req.method !== 'POST') return res.status(405).end()

  const token = getTokenFromReq(req)
  const data = token ? (verifyToken(token as string) as any) : null
  const userId = data?.userId

  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const csrf = assertCsrf(req)
    if (!csrf.ok) {
      return res.status(403).json({ error: csrf.error })
    }

    const body = normalizeRequestBody(req.body)
    const linkIds = body.linkIds

    if (!Array.isArray(linkIds)) {
      return res.status(400).json({ error: 'linkIds must be an array' })
    }

    const profile = await prisma.profile.findUnique({ where: { userId } })
    if (!profile) {
      return res.status(400).json({ error: 'no_profile' })
    }

    const existingLinks = await prisma.link.findMany({
      where: {
        id: { in: linkIds.map((linkId) => String(linkId)) },
        profileId: profile.id,
      },
      select: { id: true },
    })

    if (existingLinks.length !== linkIds.length) {
      return res.status(403).json({ error: 'forbidden' })
    }

    // リンクの並び順を一括更新
    const updatePromises = linkIds.map((linkId, index) =>
      prisma.link.update({
        where: { id: String(linkId) },
        data: { order: index },
      })
    )

    await Promise.all(updatePromises)

    return res.json({ success: true })
  } catch (e: any) {
    logError('Reorder API error', { ...meta, userId, error: e?.message || String(e) })
    return res.status(500).json({ error: e.message })
  }
}
