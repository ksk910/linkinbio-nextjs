import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const cookieParts = ['token=','HttpOnly','Path=/','Max-Age=0','SameSite=Lax']
  if (process.env.NODE_ENV === 'production') cookieParts.push('Secure')
  res.setHeader('Set-Cookie', cookieParts.join('; '))
  res.json({ ok: true })
}
