import { useEffect, useState } from 'react'

type LinkItem = { id: string; title: string; url: string; order: number }

export default function LinksPage() {
  const [links, setLinks] = useState<LinkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')

  useEffect(() => {
    async function fetchProfile() {
      const res = await fetch('/api/profile')
      if (res.ok) {
        const data = await res.json()
        setLinks(data?.links || [])
      }
      setLoading(false)
    }
    fetchProfile()
  }, [])

  async function addLink(e: any) {
    e.preventDefault()
    const res = await fetch('/api/profile/link', { method: 'POST', body: JSON.stringify({ title, url, order: 0 }) })
    if (res.ok) {
      const l = await res.json()
      setLinks((s) => [...s, l])
      setTitle('')
      setUrl('')
    } else alert('add failed')
  }

  async function del(id: string) {
    if (!confirm('Delete this link?')) return
    const res = await fetch('/api/profile/link', { method: 'DELETE', body: JSON.stringify({ id }) })
    if (res.ok) setLinks((s) => s.filter((x) => x.id !== id))
    else alert('delete failed')
  }

  async function update(id: string, title: string, url: string) {
    const res = await fetch('/api/profile/link', { method: 'PUT', body: JSON.stringify({ id, title, url }) })
    if (!res.ok) alert('update failed')
  }

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Manage Links</h1>

      <form onSubmit={addLink} className="space-y-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="input" />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL" className="input" />
        <div className="flex gap-2"><button className="btn">Add</button></div>
      </form>

      <div className="mt-6 space-y-3">
        {links.map((l) => (
          <div key={l.id} className="flex items-center gap-2">
            <input defaultValue={l.title} onBlur={(e) => update(l.id, e.currentTarget.value, l.url)} className="input" />
            <input defaultValue={l.url} onBlur={(e) => update(l.id, l.title, e.currentTarget.value)} className="input" />
            <button onClick={() => del(l.id)} className="btn">Delete</button>
          </div>
        ))}
      </div>
    </div>
  )
}
