import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { getTokenFromReq, verifyToken } from '../../../lib/auth'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = getTokenFromReq(req)
  const data = token ? (verifyToken(token as string) as any) : null
  const userId = data?.userId

  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const { image } = req.body
    if (!image) return res.status(400).json({ error: 'No image provided' })

    // Base64画像をBufferに変換
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    // ファイル名生成（userId + タイムスタンプ）
    const timestamp = Date.now()
    const fileName = `${userId}-${timestamp}.jpg`

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
      console.error('Supabase upload error:', error)
      return res.status(500).json({ error: 'Upload failed' })
    }

    // 公開URLを取得
    const { data: urlData } = supabaseAdmin.storage
      .from('avatars')
      .getPublicUrl(fileName)

    return res.json({ url: urlData.publicUrl })
  } catch (e: any) {
    console.error('Upload error:', e)
    return res.status(500).json({ error: e.message })
  }
}
