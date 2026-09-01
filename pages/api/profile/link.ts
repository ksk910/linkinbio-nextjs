import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { getTokenFromReq, verifyToken } from '../../../lib/auth'
import { assertCsrf } from '../../../lib/csrf'
import { logError, requestMeta } from '../../../lib/logger'
import {
  getString,
  normalizeLinkValue,
  normalizeRequestBody,
  validateLinkTarget,
  validateLinkTitle,
} from '../../../lib/validation'

const ALLOWED_LINK_TYPES = new Set(['url', 'email', 'tel', 'sms', 'imessage', 'music'])
const ALLOWED_MUSIC_PROVIDERS = new Set(['apple_music', 'spotify', 'youtube_music'])

function matchesMusicProviderUrl(provider: string, url: string): boolean {
  const normalized = url.toLowerCase()
  if (provider === 'apple_music') return normalized.includes('music.apple.com')
  if (provider === 'spotify') return normalized.includes('open.spotify.com') || normalized.includes('spotify.link')
  if (provider === 'youtube_music') return normalized.includes('music.youtube.com') || normalized.includes('youtu.be') || normalized.includes('youtube.com')
  return false
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const meta = requestMeta(req, '/api/profile/link')
  const token = getTokenFromReq(req)
  const data = token ? verifyToken(token as string) as any : null
  const userId = data?.userId

  if (!userId) return res.status(401).json({})

  const csrf = assertCsrf(req)
  if (!csrf.ok) {
    return res.status(403).json({ error: csrf.error })
  }

  try {
    if (req.method === 'POST') {
      // create
      const body = normalizeRequestBody(req.body)
      const titleValidation = validateLinkTitle(body.title)
      if (!titleValidation.ok) return res.status(400).json({ error: titleValidation.error })

      const icon = getString(body.icon)
      const imageUrlRaw = getString(body.imageUrl)
      const type = getString(body.type) || 'url'
      const musicProvider = getString(body.musicProvider)
      const hidden = Boolean(body.hidden)

      if (!ALLOWED_LINK_TYPES.has(type)) {
        return res.status(400).json({ error: 'link_type_invalid' })
      }

      if (type === 'music' && !/^https?:\/\//i.test(String(body.url || ''))) {
        return res.status(400).json({ error: 'music_url_invalid' })
      }

      const normalizedUrlValue = normalizeLinkValue(type, body.url)
      if (!normalizedUrlValue) return res.status(400).json({ error: 'url_invalid_scheme' })

      const urlValidation = validateLinkTarget(normalizedUrlValue)
      if (!urlValidation.ok) return res.status(400).json({ error: urlValidation.error })
      if (type === 'music' && (!musicProvider || !ALLOWED_MUSIC_PROVIDERS.has(musicProvider))) {
        return res.status(400).json({ error: 'music_provider_invalid' })
      }
      if (type === 'music' && musicProvider && !matchesMusicProviderUrl(musicProvider, urlValidation.value)) {
        return res.status(400).json({ error: 'music_url_provider_mismatch' })
      }
      if (type !== 'music' && musicProvider) {
        return res.status(400).json({ error: 'music_provider_unexpected' })
      }

      let imageUrl: string | undefined
      if (imageUrlRaw) {
        const imageValidation = validateLinkTarget(imageUrlRaw)
        if (!imageValidation.ok || !/^https?:\/\//i.test(imageValidation.value)) {
          return res.status(400).json({ error: 'image_url_invalid' })
        }
        imageUrl = imageValidation.value
      }

      const order = typeof body.order === 'number' ? body.order : 0
      let profile = await prisma.profile.findUnique({ where: { userId } })
      if (!profile) {
        // プロフィール編集画面で未保存のユーザーでもリンク追加できるよう、
        // userId をフォールバック slug として最小限のプロフィールを自動作成する。
        profile = await prisma.profile.create({ data: { userId, slug: userId, accountStatus: 'active' } })
      }
      const link = await prisma.link.create({
        data: {
          profileId: profile.id,
          title: titleValidation.value,
          url: urlValidation.value,
          type,
          musicProvider: type === 'music' ? musicProvider : null,
          icon,
          imageUrl,
          hidden,
          order,
        },
      })
      return res.json(link)
    }

    if (req.method === 'PUT') {
      const body = normalizeRequestBody(req.body)
      const id = getString(body.id)
      if (!id) return res.status(400).json({ error: 'missing_id' })

      const link = await prisma.link.findUnique({ where: { id } })
      if (!link) return res.status(404).json({ error: 'not_found' })
      const profile = await prisma.profile.findUnique({ where: { userId } })
      if (!profile || profile.id !== link.profileId) return res.status(403).json({ error: 'forbidden' })

      const updateData: { title?: string; url?: string; type?: string; musicProvider?: string | null; icon?: string | null; imageUrl?: string | null; hidden?: boolean; order?: number } = {}
      if (body.title !== undefined) {
        const titleValidation = validateLinkTitle(body.title)
        if (!titleValidation.ok) return res.status(400).json({ error: titleValidation.error })
        updateData.title = titleValidation.value
      }

      if (body.type !== undefined) {
        const type = getString(body.type)
        if (!type || !ALLOWED_LINK_TYPES.has(type)) {
          return res.status(400).json({ error: 'link_type_invalid' })
        }
        updateData.type = type
      }

      const effectiveType = getString(body.type) || ((link as any).type || 'url')
      if (body.url !== undefined) {
        const normalizedUrlValue = normalizeLinkValue(effectiveType, body.url)
        if (!normalizedUrlValue) return res.status(400).json({ error: 'url_invalid_scheme' })
        const urlValidation = validateLinkTarget(normalizedUrlValue)
        if (!urlValidation.ok) return res.status(400).json({ error: urlValidation.error })
        updateData.url = urlValidation.value
      }

      if (body.musicProvider !== undefined) {
        const musicProvider = getString(body.musicProvider)
        if (!musicProvider) {
          updateData.musicProvider = null
        } else if (!ALLOWED_MUSIC_PROVIDERS.has(musicProvider)) {
          return res.status(400).json({ error: 'music_provider_invalid' })
        } else {
          updateData.musicProvider = musicProvider
        }
      }

      if (body.icon !== undefined) {
        const icon = getString(body.icon)
        updateData.icon = icon || null
      }

      if (body.imageUrl !== undefined) {
        const imageUrlRaw = getString(body.imageUrl)
        if (!imageUrlRaw) {
          updateData.imageUrl = null
        } else {
          const imageValidation = validateLinkTarget(imageUrlRaw)
          if (!imageValidation.ok || !/^https?:\/\//i.test(imageValidation.value)) {
            return res.status(400).json({ error: 'image_url_invalid' })
          }
          updateData.imageUrl = imageValidation.value
        }
      }

      if (body.hidden !== undefined) {
        updateData.hidden = Boolean(body.hidden)
      }

      if (typeof body.order === 'number') {
        updateData.order = body.order
      }

      const nextType = (updateData.type || (link as any).type || 'url') as string
      const nextUrl = updateData.url !== undefined ? updateData.url : (link as any).url
      const nextMusicProvider = updateData.musicProvider !== undefined
        ? updateData.musicProvider
        : ((link as any).musicProvider ?? null)
      if (nextType === 'music' && !nextMusicProvider) {
        return res.status(400).json({ error: 'music_provider_invalid' })
      }
      if (nextType === 'music' && !/^https?:\/\//i.test(String(nextUrl || ''))) {
        return res.status(400).json({ error: 'music_url_invalid' })
      }
      if (nextType === 'music' && nextMusicProvider && !matchesMusicProviderUrl(String(nextMusicProvider), String(nextUrl || ''))) {
        return res.status(400).json({ error: 'music_url_provider_mismatch' })
      }
      if (nextType !== 'music') {
        updateData.musicProvider = null
      }

      const updated = await prisma.link.update({ where: { id }, data: updateData })
      return res.json(updated)
    }

    if (req.method === 'DELETE') {
      const body = normalizeRequestBody(req.body)
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
  } catch (error: any) {
    logError('Profile link API error', { ...meta, userId, error: error?.message || String(error) })
    return res.status(500).json({ error: 'internal' })
  }
}
