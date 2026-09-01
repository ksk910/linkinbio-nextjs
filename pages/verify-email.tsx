import { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { GetStaticPropsContext } from 'next'
import { getMessages } from '../lib/i18n'

export default function VerifyEmailPage() {
  const t = useTranslations('verifyEmail')
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const getRateLimitMessage = (resp: Response) => {
    const retryAfterRaw = Number(resp.headers.get('retry-after') || '60')
    const seconds = Number.isFinite(retryAfterRaw) && retryAfterRaw > 0 ? Math.ceil(retryAfterRaw) : 60
    return t('rateLimited', { seconds })
  }

  useEffect(() => {
    const token = typeof router.query.token === 'string' ? router.query.token : ''
    if (!token) return

    let active = true
    const run = async () => {
      setStatus('loading')
      setMessage(null)
      try {
        const resp = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = await resp.json().catch(() => ({}))
        if (!active) return

        if (!resp.ok) {
          setStatus('error')
          if (data?.error === 'rate_limited' || resp.status === 429) {
            setMessage(getRateLimitMessage(resp))
          } else if (data?.error === 'invalid_or_expired_token') {
            setMessage(t('invalidToken'))
          } else if (data?.error === 'token_required') {
            setMessage(t('missingToken'))
          } else {
            setMessage(t('verifyFailed'))
          }
          return
        }

        setStatus('success')
        setMessage(t('verifySuccess'))
      } catch (err: any) {
        if (!active) return
        setStatus('error')
        setMessage(err?.message || t('verifyFailed'))
      }
    }

    run()
    return () => {
      active = false
    }
  }, [router.query.token, t])

  return (
    <>
      <Head>
        <title>{`${t('title')} | Link in Bio`}</title>
      </Head>
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-md mx-auto p-6">
          <h1 className="text-2xl font-semibold mb-4">{t('title')}</h1>

          {!router.query.token && (
            <p className="text-sm text-gray-700">{t('missingToken')}</p>
          )}

          {status === 'loading' && <p className="text-sm text-gray-700">{t('verifying')}</p>}
          {message && (
            <p className={`text-sm ${status === 'success' ? 'text-green-700' : 'text-red-600'}`}>
              {message}
            </p>
          )}

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
