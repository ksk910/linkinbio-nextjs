import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { getTokenFromReq, verifyToken } from '../../../lib/auth'
import { assertCsrf } from '../../../lib/csrf'
import { logError, requestMeta } from '../../../lib/logger'
import { normalizeRequestBody } from '../../../lib/validation'
import { buildAvatarObjectKey } from '../../../lib/avatar-upload'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const meta = requestMeta(req, '/api/upload/avatar')
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
    const image = typeof body.image === 'string' ? body.image : undefined
    if (!image) return res.status(400).json({ error: 'No image provided' })
    if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(image)) {
      return res.status(400).json({ error: 'Invalid image format' })
    }

    const base64Data = image.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '')
    if (!base64Data || !/^[A-Za-z0-9+/]+=*$/.test(base64Data)) {
      return res.status(400).json({ error: 'Invalid image format' })
    }

    const buffer = Buffer.from(base64Data, 'base64')
    if (buffer.length === 0) {
      return res.status(400).json({ error: 'Invalid image format' })
    }

    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image too large' })
    }

    const mimeMatch = image.match(/^data:(image\/(jpeg|png|webp));base64,/i)
    if (!mimeMatch) {
      return res.status(400).json({ error: 'Unsupported image type' })
    }

    const fileName = buildAvatarObjectKey(userId, mimeMatch[1])

    // service_roleキーでSupabaseクライアントを作成（RLS回避）
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Supabase Storageにアップロード
    const { data: uploadData, error } = await supabaseAdmin.storage
      .from('avatars')
      .upload(fileName, buffer, {
        contentType: 'image/jpeg',
        upsert: false,
      })

    if (error) {
      logError('Supabase avatar upload error', { ...meta, userId, error: String(error) })
      return res.status(500).json({ error: 'Upload failed' })
    }

    // 公開URLを取得
    const { data: urlData } = supabaseAdmin.storage
      .from('avatars')
      .getPublicUrl(fileName)

    return res.json({ url: urlData.publicUrl })
  } catch (e: any) {
    logError('Avatar upload API error', { ...meta, userId, error: e?.message || String(e) })
    return res.status(500).json({ error: e.message })
  }
}
