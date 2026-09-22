import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { getTokenFromReq, verifyToken } from '../../../lib/auth'
import { assertCsrf } from '../../../lib/csrf'
import { logError, requestMeta } from '../../../lib/logger'
import { normalizeRequestBody, validateLinkTarget } from '../../../lib/validation'

const ALLOWED_BLOCK_TYPES = new Set(['profile', 'headline', 'bio', 'links', 'icon', 'line', 'video', 'music'])

function normalizeAndValidateBlocks(rawBlocks: any[]): { ok: true; value: Array<{ type: string; content: string | null; order: number }> } | { ok: false; error: string } {
  const normalized: Array<{ type: string; content: string | null; order: number }> = []

  for (let index = 0; index < rawBlocks.length; index += 1) {
    const block = rawBlocks[index]
    const type = typeof block?.type === 'string' ? block.type : 'bio'
    if (!ALLOWED_BLOCK_TYPES.has(type)) {
      return { ok: false, error: 'block_type_invalid' }
    }

    const contentRaw = typeof block?.content === 'string' ? block.content.trim() : ''
    if ((type === 'profile' || type === 'links') && contentRaw.length > 0) {
      return { ok: false, error: 'block_content_unexpected' }
    }

    if (type === 'headline' && contentRaw.length > 120) {
      return { ok: false, error: 'block_headline_too_long' }
    }
    if (type === 'bio' && contentRaw.length > 500) {
      return { ok: false, error: 'block_bio_too_long' }
    }
    if (type === 'icon' && contentRaw.length > 64) {
      return { ok: false, error: 'block_icon_too_long' }
    }
    if (type === 'line' && contentRaw.length > 200) {
      return { ok: false, error: 'block_line_too_long' }
    }
    if (type === 'video') {
      if (!contentRaw) return { ok: false, error: 'block_video_required' }
      if (!/^https?:\/\//i.test(contentRaw)) return { ok: false, error: 'block_video_url_invalid' }
    }
    if (type === 'music') {
      if (!contentRaw) return { ok: false, error: 'block_music_required' }
      if (!/^https?:\/\//i.test(contentRaw)) return { ok: false, error: 'block_music_url_invalid' }
    }

    normalized.push({
      type,
      content: contentRaw || null,
      order: typeof block?.order === 'number' ? block.order : index,
    })
  }

  return { ok: true, value: normalized }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const meta = requestMeta(req, '/api/profile')
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
          include: {
            links: { orderBy: { order: 'asc' } },
            blocks: { orderBy: { order: 'asc' } },
          }
        })
        return res.json(profile)
      } catch (dbErr: any) {
        logError('Profile GET DB error', { ...meta, userId, error: dbErr?.message || String(dbErr) })
        return res.status(500).json({ error: 'db', code: dbErr?.code || dbErr?.name || 'unknown' })
      }
    }

    if (req.method === 'POST') {
      if (!userId) return res.status(401).json({ error: 'unauthorized' })
      const csrf = assertCsrf(req)
      if (!csrf.ok) {
        return res.status(403).json({ error: csrf.error })
      }

      const body = normalizeRequestBody(req.body)
      const { displayName, bio, avatarUrl, slug, theme, backgroundColor, textColor, accentColor } = body
      const blocks = Array.isArray(body.blocks) ? body.blocks : null
      if (typeof avatarUrl === 'string' && avatarUrl.trim().length > 0) {
        const avatarValidation = validateLinkTarget(avatarUrl)
        if (!avatarValidation.ok) {
          return res.status(400).json({ error: 'avatar_url_invalid' })
        }
      }
      const validatedBlocks = blocks ? normalizeAndValidateBlocks(blocks) : null
      const accountStatus = typeof body.accountStatus === 'string' ? body.accountStatus : undefined
      if (accountStatus && accountStatus !== 'active' && accountStatus !== 'disabled') {
        return res.status(400).json({ error: 'account_status_invalid' })
      }
      if (validatedBlocks && !validatedBlocks.ok) {
        return res.status(400).json({ error: validatedBlocks.error })
      }
      const existing = await prisma.profile.findUnique({ where: { userId } })
      if (existing) {
        const updated = await prisma.profile.update({
          where: { userId },
          data: {
            displayName,
            bio,
            avatarUrl,
            slug,
            theme,
            backgroundColor,
            textColor,
            accentColor,
            ...(accountStatus ? { accountStatus } : {}),
          } as any,
        })
        if (validatedBlocks && validatedBlocks.ok) {
          await prisma.block.deleteMany({ where: { profileId: existing.id } })
          if (validatedBlocks.value.length > 0) {
            await prisma.block.createMany({
              data: validatedBlocks.value.map((block) => ({
                profileId: existing.id,
                type: block.type,
                content: block.content,
                order: block.order,
              })),
            })
          }
        }
        return res.json(updated)
      }
      const created = await prisma.profile.create({
        data: {
          userId,
          displayName,
          bio,
          avatarUrl,
          slug,
          theme,
          backgroundColor,
          textColor,
          accentColor,
          accountStatus: accountStatus || 'active',
        } as any,
      })
      if (validatedBlocks && validatedBlocks.ok && validatedBlocks.value.length > 0) {
        await prisma.block.createMany({
          data: validatedBlocks.value.map((block) => ({
            profileId: created.id,
            type: block.type,
            content: block.content,
            order: block.order,
          })),
        })
      }
      return res.json(created)
    }

    res.status(405).end()
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const target = Array.isArray(err?.meta?.target)
        ? err.meta.target.join(',')
        : String(err?.meta?.target || '')
      if (target.includes('slug')) {
        return res.status(409).json({ error: 'slug_taken' })
      }
      return res.status(409).json({ error: 'conflict' })
    }
    logError('Profile API error', { ...meta, error: err?.message || String(err) })
    const code = err?.code || err?.name || 'unknown'
    return res.status(500).json({ error: 'internal', code })
  }
}
