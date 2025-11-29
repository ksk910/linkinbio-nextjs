import { useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateEmail(email)) {
      setMessage('有効なメールアドレスを入力してください')
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        setMessage(data?.error === 'invalid' ? 'メールまたはパスワードが正しくありません' : 'ログインに失敗しました')
        return
      }
      // JWTクッキーが付与されるため、そのままリンク管理へ遷移
      router.push('/profile/links')
    } catch (err: any) {
      setMessage(err?.message || 'Unexpected error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Log In | Link in Bio</title>
      </Head>
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-md mx-auto p-6">
          <h1 className="text-2xl font-semibold mb-4">Log In</h1>
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
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </form>
          {message && (
            <p className="mt-3 text-sm text-red-600">{message}</p>
          )}
          <p className="mt-6 text-sm">
            アカウントがない場合は <a href="/signup" className="text-blue-600 underline">サインアップ</a>
          </p>
        </div>
      </main>
    </>
  )
}
