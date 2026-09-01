import { useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { GetStaticPropsContext } from 'next'
import { getMessages } from '../lib/i18n'

export default function ResetPasswordPage() {
  const t = useTranslations('resetPassword')
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const getRateLimitMessage = (resp: Response) => {
    const retryAfterRaw = Number(resp.headers.get('retry-after') || '60')
    const seconds = Number.isFinite(retryAfterRaw) && retryAfterRaw > 0 ? Math.ceil(retryAfterRaw) : 60
    return t('rateLimited', { seconds })
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = typeof router.query.token === 'string' ? router.query.token : ''
    if (!token) {
      setMessage(t('missingToken'))
      return
    }

    if (newPassword.length < 8) {
      setMessage(t('invalidPassword'))
      return
    }

    if (newPassword !== confirmPassword) {
      setMessage(t('passwordMismatch'))
      return
    }

    setLoading(true)
    setMessage(null)
    try {
      const resp = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword, confirmPassword }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        if (data?.error === 'rate_limited' || resp.status === 429) {
          setMessage(getRateLimitMessage(resp))
          return
        }
        if (data?.error === 'token_required') {
          setMessage(t('missingToken'))
        } else if (data?.error === 'invalid_or_expired_token') {
          setMessage(t('invalidToken'))
        } else if (data?.error === 'password_too_short') {
          setMessage(t('invalidPassword'))
        } else if (data?.error === 'passwords_do_not_match' || data?.error === 'confirm_password_required') {
          setMessage(t('passwordMismatch'))
        } else {
          setMessage(t('resetFailed'))
        }
        return
      }

      setMessage(t('resetSuccess'))
      setTimeout(() => {
        router.push('/login')
      }, 800)
    } catch (err: any) {
      setMessage(err?.message || t('resetFailed'))
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
              <label className="block text-sm font-medium mb-1">{t('newPassword')}</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2"
                placeholder={t('passwordPlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('confirmPassword')}</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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

          {message && <p className="mt-3 text-sm text-gray-700">{message}</p>}
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
