import { useEffect, useState } from 'react'
import { GetServerSideProps } from 'next'
import { verifyToken } from '../../lib/auth'
import { useTranslations } from 'next-intl'
import { getMessages } from '../../lib/i18n'

type LinkItem = { id: string; title: string; url: string; order: number }

export default function LinksPage() {
  const t = useTranslations('links')
  const [links, setLinks] = useState<LinkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [slug, setSlug] = useState<string | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  useEffect(() => {
    async function fetchProfile() {
      const res = await fetch('/api/profile', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setLinks(data?.links || [])
        setSlug(data?.slug || null)
      }
      setLoading(false)
    }
    fetchProfile()
  }, [])


  async function addLink(e: any) {
    e.preventDefault()
    if (!url.startsWith('http')) {
      alert(t('invalidUrl'))
      return
    }
    const res = await fetch('/api/profile/link', { method: 'POST', body: JSON.stringify({ title, url, order: 0 }), credentials: 'include' })
    if (res.ok) {
      const l = await res.json()
      setLinks((s) => [...s, l])
      setTitle('')
      setUrl('')
      alert(t('addSuccess'))
    } else alert(t('addFailed'))
  }

  async function del(id: string) {
    if (!confirm(t('deleteConfirm'))) return
    const res = await fetch('/api/profile/link', { method: 'DELETE', body: JSON.stringify({ id }), credentials: 'include' })
    if (res.ok) setLinks((s) => s.filter((x) => x.id !== id))
    else alert(t('deleteFailed'))
  }

  async function update(id: string, title: string, url: string) {
    const res = await fetch('/api/profile/link', { method: 'PUT', body: JSON.stringify({ id, title, url }), credentials: 'include' })
    if (!res.ok) alert(t('updateFailed'))
  }

  async function reorderLinks(newLinks: LinkItem[]) {
    const linkIds = newLinks.map((l) => l.id)
    const res = await fetch('/api/profile/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkIds }),
      credentials: 'include',
    })
    if (!res.ok) alert(t('reorderFailed'))
  }

  function handleDragStart(index: number) {
    setDraggedIndex(index)
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newLinks = [...links]
    const draggedItem = newLinks[draggedIndex]
    newLinks.splice(draggedIndex, 1)
    newLinks.splice(index, 0, draggedItem)

    setLinks(newLinks)
    setDraggedIndex(index)
  }

  function handleDragEnd() {
    setDraggedIndex(null)
    reorderLinks(links)
  }

  if (loading) return <div className="p-6">{t('loading')}</div>

  const publicUrl = slug ? `${window.location.origin}/p/${slug}` : null

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">{t('title')}</h1>

      {publicUrl && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm font-medium text-gray-700 mb-1">{t('publicUrl')}</p>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline break-all"
          >
            {publicUrl}
          </a>
        </div>
      )}

      <form onSubmit={addLink} className="space-y-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('titleLabel')} className="input" />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t('urlLabel')} className="input" />
        <div className="flex gap-2"><button className="btn">{t('add')}</button></div>
      </form>

      <div className="mt-6 space-y-3">
        {links.map((l, index) => (
          <div
            key={l.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-2 p-3 border rounded-lg cursor-move transition-all ${
              draggedIndex === index ? 'opacity-50 bg-gray-100' : 'bg-white hover:shadow-md'
            }`}
          >
            <div className="text-gray-400 mr-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"></path>
              </svg>
            </div>
            <input defaultValue={l.title} onBlur={(e) => update(l.id, e.currentTarget.value, l.url)} className="input flex-1" />
            <input defaultValue={l.url} onBlur={(e) => update(l.id, l.title, e.currentTarget.value)} className="input flex-1" />
            <button onClick={() => del(l.id)} className="btn bg-red-500 hover:bg-red-600 text-white">{t('delete')}</button>
          </div>
        ))}
      </div>
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
  return { 
    props: {
      messages: await getMessages(ctx.locale || 'ja')
    }
  }
}
