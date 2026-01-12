import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { slug, excludeUserId } = req.body

  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Slug is required' })
  }

  // バリデーション：英数字、ハイフン、アンダースコアのみ
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
    return res.status(400).json({ 
      available: false, 
      error: 'Slug can only contain letters, numbers, hyphens, and underscores' 
    })
  }

  // 長さチェック
  if (slug.length < 3 || slug.length > 30) {
    return res.status(400).json({ 
      available: false, 
      error: 'Slug must be between 3 and 30 characters' 
    })
  }

  try {
    const existingProfile = await prisma.profile.findUnique({
      where: { slug }
    })

    // 同じユーザーの場合は許可（編集時）
    if (existingProfile && existingProfile.userId !== excludeUserId) {
      return res.status(200).json({ available: false })
    }

    return res.status(200).json({ available: true })
  } catch (error) {
    console.error('Slug validation error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
