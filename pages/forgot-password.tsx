import { useState } from 'react'
import Head from 'next/head'
import { useTranslations } from 'next-intl'
import { GetStaticPropsContext } from 'next'
import { getMessages } from '../lib/i18n'

export default function ForgotPasswordPage() {
  const t = useTranslations('forgotPassword')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
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

    setLoading(true)
    setMessage(null)
    try {
      const resp = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await resp.json().catch(() => ({}))

      if (!resp.ok) {
        if (data?.error === 'rate_limited' || resp.status === 429) {
          setMessage(getRateLimitMessage(resp))
          return
        }
        if (data?.error === 'email_invalid' || data?.error === 'email_required') {
          setMessage(t('invalidEmail'))
        } else {
          setMessage(t('requestFailed'))
        }
        return
      }

      if (data?.resetToken) {
        window.location.href = `/reset-password?token=${encodeURIComponent(data.resetToken as string)}`
        return
      }

      setMessage(t('requestSuccess'))
    } catch (err: any) {
      setMessage(err?.message || t('requestFailed'))
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
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white rounded-md py-2 hover:bg-gray-800 disabled:opacity-60"
            >
              {loading ? t('submitting') : t('submit')}
            </button>
          </form>

          {message && <p className="mt-3 text-sm text-gray-700">{message}</p>}

          <p className="mt-6 text-sm">
            <a href="/login" className="text-blue-600 underline">{t('goLogin')}</a>
          </p>
        </div>
      </main>
    </>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: await getMessages(locale || 'ja'),
    },
  }
}
