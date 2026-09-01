import { NextApiRequest, NextApiResponse } from 'next'
import { hashPassword, verifyPassword, getTokenFromReq, verifyToken } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'
import { assertCsrf } from '../../../lib/csrf'
import { logError, requestMeta } from '../../../lib/logger'
import { normalizeRequestBody } from '../../../lib/validation'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const meta = requestMeta(req, '/api/profile/change-password')
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const csrf = assertCsrf(req)
    if (!csrf.ok) {
      return res.status(403).json({ error: csrf.error })
    }

    const token = getTokenFromReq(req)
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const payload = verifyToken(token)
    if (!payload || typeof payload === 'string') {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const userId = payload.userId
    if (!userId) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const body = normalizeRequestBody(req.body)
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : undefined
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : undefined
    const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : undefined

    // バリデーション
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'All fields are required' })
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    // ユーザーを取得
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // 現在のパスワードを検証
    const isPasswordValid = await verifyPassword(currentPassword, user.password)
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Current password is incorrect' })
    }

    // 新しいパスワードをハッシュ化
    const hashedPassword = await hashPassword(newPassword)

    // パスワードを更新
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    })

    return res.status(200).json({ success: true })
  } catch (err) {
    logError('Change password API error', { ...meta, error: String(err) })
    return res.status(500).json({ error: 'Internal server error' })
  }
}
