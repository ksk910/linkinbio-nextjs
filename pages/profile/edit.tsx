import { useEffect, useState } from 'react'
import { GetServerSideProps } from 'next'
import { verifyToken } from '../../lib/auth'

export default function ProfileEdit() {
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchProfile() {
      const res = await fetch('/api/profile')
      if (res.ok) {
        const data = await res.json()
        if (data) {
          setDisplayName(data.displayName || '')
          setBio(data.bio || '')
          setAvatarUrl(data.avatarUrl || '')
        }
      }
      setLoading(false)
    }
    fetchProfile()
  }, [])

  async function save(e: any) {
    e.preventDefault()
    const res = await fetch('/api/profile', { method: 'POST', body: JSON.stringify({ displayName, bio, avatarUrl }) })
    if (res.ok) alert('saved')
    else alert('save failed')
  }

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Edit Profile</h1>
      <form onSubmit={save} className="space-y-3">
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" className="input" />
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Bio" className="input" />
        <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="Avatar URL" className="input" />
        <div className="flex gap-2">
          <button className="btn">Save</button>
        </div>
      </form>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const cookie = ctx.req.headers.cookie || ''
  const m = cookie.match(/token=([^;]+)/)
  const token = m ? m[1] : null
  const data = token ? (verifyToken(token) as any) : null
  if (!data?.userId) {
    return { redirect: { destination: '/login', permanent: false } }
  }
  return { props: {} }
}
