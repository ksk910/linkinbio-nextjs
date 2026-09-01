import { NextApiRequest, NextApiResponse } from 'next'
import { trackError } from '../../../lib/error-tracking'
import { getString, normalizeRequestBody } from '../../../lib/validation'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const body = normalizeRequestBody(req.body)
  const message = getString(body.message)
  if (!message) {
    return res.status(400).json({ error: 'message_required' })
  }

  const result = await trackError({
    source: 'client',
    message,
    stack: getString(body.stack),
    route: getString(body.route),
    url: getString(body.url),
    userAgent: getString(body.userAgent),
  })

  return res.status(200).json({ ok: true, tracked: result.delivered })
}
