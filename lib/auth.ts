import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { NextApiRequest } from 'next'

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret'

export async function hashPassword(pw: string) {
  return await bcrypt.hash(pw, 10)
}

export async function verifyPassword(pw: string, hash: string) {
  return await bcrypt.compare(pw, hash)
}

export function signToken(payload: object) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (e) {
    return null
  }
}

export function getTokenFromReq(req: NextApiRequest) {
  // Prefer Authorization header (Bearer) if provided
  const auth = req.headers.authorization
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7)
  }

  // Fallback to cookie
  const cookie = req.headers.cookie
  if (!cookie) return null
  const match = cookie.match(/token=([^;]+)/)
  return match ? match[1] : null
}
