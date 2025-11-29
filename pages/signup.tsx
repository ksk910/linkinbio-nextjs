import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      const resp = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        if (data?.error === 'exists') {
          // 既存ユーザーなら自動的にログインを試みる
          const login = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          })
          if (login.ok) {
            router.push('/profile/links')
            return
          }
          setMessage('既に登録済みのメールです。正しいパスワードでログインしてください。')
        } else {
          setMessage(data?.error || 'Sign up failed')
        }
      } else {
        setMessage('Sign up successful')
        // サインアップでJWTクッキーが設定されるので、そのままリンク管理へ遷移
        router.push('/profile/links')
      }
    } catch (err: any) {
      setMessage(err?.message || 'Unexpected error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Sign Up | Link in Bio</title>
      </Head>
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-md mx-auto p-6">
          <h1 className="text-2xl font-semibold mb-4">Sign Up</h1>
          <form onSubmit={onSubmit} className="space-y-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white rounded-md py-2 hover:bg-gray-800 disabled:opacity-60"
            >
              {loading ? 'Signing up...' : 'Sign Up'}
            </button>
          </form>
          {message && (
            <p className="mt-3 text-sm">
              {message}
            </p>
          )}
          <div className="mt-6 text-sm">
            <p>
              After signup, edit your profile: <a href="/profile/edit" className="text-blue-600 underline">/profile/edit</a>
            </p>
            <p className="mt-1">
              Manage links here: <a href="/profile/links" className="text-blue-600 underline">/profile/links</a>
            </p>
          </div>
        </div>
      </main>
    </>
  )
}
