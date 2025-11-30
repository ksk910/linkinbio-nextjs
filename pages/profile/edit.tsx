import { useEffect, useState } from 'react'
import { GetServerSideProps } from 'next'
import { verifyToken } from '../../lib/auth'

export default function ProfileEdit() {
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

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
    if (avatarUrl && !avatarUrl.startsWith('http')) {
      alert('Avatar URLはhttp://またはhttps://で始まる有効なURLを入力してください')
      return
    }
    const res = await fetch('/api/profile', { method: 'POST', body: JSON.stringify({ displayName, bio, avatarUrl }) })
    if (res.ok) alert('保存しました')
    else alert('保存に失敗しました')
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('ファイルサイズは5MB以下にしてください')
      return
    }

    setUploading(true)
    try {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64 = reader.result as string
        const res = await fetch('/api/upload/avatar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64 }),
        })

        if (res.ok) {
          const data = await res.json()
          setAvatarUrl(data.url)
          alert('画像をアップロードしました')
        } else {
          alert('アップロードに失敗しました')
        }
        setUploading(false)
      }
      reader.readAsDataURL(file)
    } catch (err) {
      alert('アップロードエラーが発生しました')
      setUploading(false)
    }
  }

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Edit Profile</h1>
      <form onSubmit={save} className="space-y-3">
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" className="input" />
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Bio" className="input" />
        
        <div className="space-y-2">
          <label className="block text-sm font-medium">Avatar画像</label>
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleImageUpload} 
            disabled={uploading}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {uploading && <p className="text-sm text-gray-600">アップロード中...</p>}
          <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="Avatar URL（または上記からアップロード）" className="input" />
        </div>

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
