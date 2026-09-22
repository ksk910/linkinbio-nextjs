import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { useTranslations } from 'next-intl'
import { GetStaticPropsContext } from 'next'
import { getMessages } from '../lib/i18n'

export default function SignupPage() {
  const t = useTranslations('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
  const validatePassword = (p: string) => p.length >= 8
  const getRateLimitMessage = (resp: Response) => {
    const retryAfterRaw = Number(resp.headers.get('retry-after') || '60')
    const seconds = Number.isFinite(retryAfterRaw) && retryAfterRaw > 0 ? Math.ceil(retryAfterRaw) : 60
    return t('rateLimited', { seconds })
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateEmail(email)) {
      setMessage(t('invalidEmail'))
      return
    }
    if (!validatePassword(password)) {
      setMessage(t('invalidPassword'))
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const resp = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      })
      let data: any = null
      const contentType = resp.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        data = await resp.json()
      } else {
        await resp.text()
      }

      if (!resp.ok) {
        if (data?.error === 'exists') {
          setMessage(t('emailExists'))
        } else if (data?.error === 'rate_limited' || resp.status === 429) {
          setMessage(getRateLimitMessage(resp))
        } else if (data?.error === 'server_error') {
          setMessage(t('serverError'))
        } else {
          setMessage(data?.error || t('signupFailed'))
        }
      } else {
        if (data?.verificationToken) {
          router.push(`/verify-email?token=${encodeURIComponent(data.verificationToken as string)}`)
          return
        }

        setMessage(t('signupSuccessVerify'))
      }
    } catch (err: any) {
      setMessage(err?.message || t('signupFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>{`${t('title')} | Link in Bio`}</title>
      </Head>
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-md mx-auto p-6">
          <h1 className="text-2xl font-semibold mb-4">{t('title')}</h1>
          <a
            href="/api/auth/oauth/google/start"
            className="w-full flex items-center justify-center gap-2 border border-gray-300 rounded-md py-2 bg-white hover:bg-gray-50 text-sm font-medium"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.17.29-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.6 8.6 0 0 0 9 0 9 9 0 0 0 .96 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z" />
            </svg>
            {t('continueWithGoogle')}
          </a>
          <div className="flex items-center gap-3 my-4 text-xs text-gray-400">
            <div className="flex-1 h-px bg-gray-200" />
            {t('orDivider')}
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          <form onSubmit={onSubmit} className="space-y-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div>
              <label className="block text-sm font-medium mb-1">{t('email')}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2"
                placeholder={t('emailPlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('password')}</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2"
                placeholder={t('passwordPlaceholder')}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white rounded-md py-2 hover:bg-gray-800 disabled:opacity-60"
            >
              {loading ? t('submitting') : t('submit')}
            </button>
          </form>
          {message && (
            <p className="mt-3 text-sm">
              {message}
            </p>
          )}
          <div className="mt-6 text-sm">
            <p>
              {t('afterSignup')} <a href="/login" className="text-blue-600 underline">/login</a>
            </p>
            <p className="mt-1">
              {t('manageLinks')} <a href="/verify-email" className="text-blue-600 underline">/verify-email</a>
            </p>
          </div>
        </div>
      </main>
    </>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: await getMessages(locale || 'ja')
    }
  }
}
