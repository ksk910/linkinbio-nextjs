import { useState } from 'react'
import { useRouter } from 'next/router'

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()

  async function signup(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) })
    if (res.ok) router.push('/profile/edit')
    else alert('signup failed')
  }

  async function login(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    if (res.ok) router.push('/profile/edit')
    else alert('login failed')
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Link-in-bio Clone (Demo)</h1>

      <form className="space-y-2" onSubmit={(e) => signup(e)}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" className="input" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" className="input" />
        <div className="flex gap-2">
          <button onClick={(e) => signup(e)} className="btn">Sign up</button>
          <button onClick={(e) => login(e)} className="btn">Log in</button>
        </div>
      </form>

      <p className="mt-6 text-sm text-gray-600">After creating an account you'll be redirected to the profile editor.</p>
    </div>
  )
}
