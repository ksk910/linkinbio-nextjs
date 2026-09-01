type Entry = {
  count: number
  resetAt: number
}

const store = new Map<string, Entry>()

export function checkRateLimit(options: {
  key: string
  limit: number
  windowMs: number
  now?: number
}): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const { key, limit, windowMs } = options
  const now = options.now ?? Date.now()
  const current = store.get(key)

  if (!current || now >= current.resetAt) {
    const resetAt = now + windowMs
    store.set(key, { count: 1, resetAt })
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      retryAfterSec: Math.ceil(windowMs / 1000),
    }
  }

  if (current.count >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    return { allowed: false, remaining: 0, retryAfterSec }
  }

  current.count += 1
  store.set(key, current)
  return {
    allowed: true,
    remaining: Math.max(0, limit - current.count),
    retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  }
}

export function getClientIp(headers: Record<string, string | string[] | undefined>): string {
  const forwarded = headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim()
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0]
  }

  const realIp = headers['x-real-ip']
  if (typeof realIp === 'string' && realIp.length > 0) {
    return realIp
  }

  return 'unknown'
}
