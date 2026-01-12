import type { AppProps } from 'next/app'
import '../styles/globals.css'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { NextIntlClientProvider, useTranslations } from 'next-intl'
import LanguageSwitcher from '../components/LanguageSwitcher'

function Header() {
  const t = useTranslations('header')
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const router = useRouter()

  useEffect(() => {
    let alive = true
    async function check() {
      try {
        const res = await fetch('/api/profile')
        if (!alive) return
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
        <nav className="ml-auto flex items-center gap-3 text-sm">
          <LanguageSwitcher />
          {loggedIn ? (
            <>
              <Link href="/profile/edit" className="hover:underline">{t('edit')}</Link>
              <Link href="/profile/links" className="hover:underline">{t('links')}</Link>
              <button onClick={logout} className="text-gray-600 hover:text-black">{t('logout')}</button>
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
