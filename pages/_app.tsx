import type { AppProps } from 'next/app'
import '../styles/globals.css'
import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { NextIntlClientProvider, useTranslations } from 'next-intl'
import LanguageSwitcher from '../components/LanguageSwitcher'

function Header() {
  const t = useTranslations('header')
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    let alive = true
    async function check() {
      try {
        const res = await fetch('/api/profile', { credentials: 'include' })
        if (!alive) return
        if (res.ok) {
          const data = await res.json()
          setAvatarUrl(data.avatarUrl || null)
        }
        setLoggedIn(res.ok)
      } catch {
        if (!alive) return
        setLoggedIn(false)
      }
    }
    check()
    return () => { alive = false }
  }, [])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setLoggedIn(false)
    router.push('/login')
  }

  return (
    <header className="border-b border-gray-200 bg-white/95 sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-4 h-12 flex items-center gap-4">
        <Link href="/" className="font-semibold">{t('title')}</Link>
        <nav className="ml-auto flex items-center gap-4 text-sm">
          <LanguageSwitcher />
          {loggedIn ? (
            <>
              <Link href="/profile/edit" className="hover:opacity-70 transition-opacity" title={t('edit')}>
                <div className="w-6 h-6 rounded-full overflow-hidden border border-gray-300 flex items-center justify-center bg-gray-100">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt="avatar"
                      width={24}
                      height={24}
                      className="w-6 h-6 object-cover"
                    />
                  ) : (
                    <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </Link>
              <Link href="/profile/links" className="hover:opacity-70 transition-opacity" title={t('links')}>
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </Link>
              <button onClick={logout} className="text-gray-600 hover:text-black" title={t('logout')}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:underline">{t('login')}</Link>
              <Link href="/signup" className="hover:underline">{t('signup')}</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter()
  
  return (
    <NextIntlClientProvider 
      locale={router.locale || 'ja'}
      messages={pageProps.messages}
      timeZone="Asia/Tokyo"
    >
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <Component {...pageProps} />
        </main>
      </div>
    </NextIntlClientProvider>
  )
}
