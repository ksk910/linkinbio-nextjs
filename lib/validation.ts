export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }

export function normalizeRequestBody(raw: unknown): Record<string, unknown> {
  if (!raw) return {}

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return isRecord(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }

  if (isRecord(raw)) {
    const keys = Object.keys(raw)
    if (keys.length === 1) {
      const onlyKey = keys[0]
      const trimmed = onlyKey.trim()
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed)
          return isRecord(parsed) ? parsed : raw
        } catch {
          return raw
        }
      }
    }
    return raw
  }

  return {}
}

export function getString(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined
  const value = input.trim()
  return value.length > 0 ? value : undefined
}

export function validateEmail(input: unknown): ValidationResult<string> {
  const email = getString(input)
  if (!email) return { ok: false, error: 'email_required' }

  // Practical email validation for API-level checks.
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailPattern.test(email)) return { ok: false, error: 'email_invalid' }

  return { ok: true, value: email.toLowerCase() }
}

export function validatePassword(input: unknown, minLength = 8): ValidationResult<string> {
  const password = getString(input)
  if (!password) return { ok: false, error: 'password_required' }
  if (password.length < minLength) return { ok: false, error: 'password_too_short' }
  return { ok: true, value: password }
}

export function validateSlug(input: unknown): ValidationResult<string> {
  const slug = getString(input)
  if (!slug) return { ok: false, error: 'slug_required' }

  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
    return { ok: false, error: 'slug_invalid_format' }
  }

  if (slug.length < 3 || slug.length > 30) {
    return { ok: false, error: 'slug_invalid_length' }
  }

  return { ok: true, value: slug }
}

export function validateLinkTitle(input: unknown): ValidationResult<string> {
  const title = getString(input)
  if (!title) return { ok: false, error: 'title_required' }
  if (title.length > 120) return { ok: false, error: 'title_too_long' }
  return { ok: true, value: title }
}

export function normalizeLinkValue(type: string, rawValue: unknown): string | null {
  const value = getString(rawValue)
  if (!value) return null

  const trimmed = value.trim()
  const normalized = trimmed.toLowerCase()

  if (type === 'url' || type === 'music') {
    if (!/^https?:\/\//i.test(trimmed)) return null
    return trimmed
  }

  if (type === 'email') {
    if (normalized.startsWith('mailto:')) return trimmed
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailPattern.test(trimmed)) return null
    return `mailto:${trimmed}`
  }

  if (type === 'tel' || type === 'sms' || type === 'imessage') {
    if (normalized.startsWith('tel:') || normalized.startsWith('sms:') || normalized.startsWith('imessage:')) {
      return trimmed
    }
    if (!/^\+?[0-9\-()\s]+$/.test(trimmed)) return null
    if (type === 'tel') return `tel:${trimmed}`
    if (type === 'sms') return `sms:${trimmed}`
    return `imessage:${trimmed}`
  }

  return null
}

export function validateLinkTarget(input: unknown): ValidationResult<string> {
  const raw = getString(input)
  if (!raw) return { ok: false, error: 'url_required' }

  const normalized = raw.toLowerCase()
  const allowedSchemes = ['http://', 'https://', 'mailto:', 'tel:', 'sms:', 'imessage:']
  if (!allowedSchemes.some((scheme) => normalized.startsWith(scheme))) {
    return { ok: false, error: 'url_invalid_scheme' }
  }

  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    try {
      const parsed = new URL(raw)
      if (!parsed.hostname) return { ok: false, error: 'url_invalid' }
    } catch {
      return { ok: false, error: 'url_invalid' }
    }
  }

  return { ok: true, value: raw }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
