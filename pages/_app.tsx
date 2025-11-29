import type { AppProps } from 'next/app'
import '../styles/globals.css'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

function Header() {
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
        <Link href="/" className="font-semibold">Link in Bio</Link>
        <nav className="ml-auto flex items-center gap-3 text-sm">
          {loggedIn ? (
            <>
              <Link href="/profile/edit" className="hover:underline">Edit</Link>
              <Link href="/profile/links" className="hover:underline">Links</Link>
              <button onClick={logout} className="text-gray-600 hover:text-black">Logout</button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:underline">Login</Link>
              <Link href="/signup" className="hover:underline">Signup</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Component {...pageProps} />
      </main>
    </div>
  )
}
