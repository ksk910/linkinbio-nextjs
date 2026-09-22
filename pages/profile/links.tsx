import { useEffect, useRef, useState } from 'react'
import { GetServerSideProps } from 'next'
import { verifyToken } from '../../lib/auth'
import { useTranslations } from 'next-intl'
import { getMessages } from '../../lib/i18n'
import InlineFeedback from '../../components/InlineFeedback'
import { normalizeLinkValue } from '../../lib/validation'

type LinkType = 'url' | 'email' | 'tel' | 'sms' | 'imessage' | 'music'
type MusicProvider = 'apple_music' | 'spotify' | 'youtube_music'
type LinkFilter = 'all' | 'hidden' | 'music'

type LinkItem = {
  id: string
  title: string
  url: string
  type?: LinkType
  musicProvider?: MusicProvider | null
  icon?: string | null
  imageUrl?: string | null
  hidden?: boolean
  order: number
}

export default function LinksPage() {
  const t = useTranslations('links')
  const [links, setLinks] = useState<LinkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [icon, setIcon] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [hidden, setHidden] = useState(false)
  const [linkType, setLinkType] = useState<LinkType>('url')
  const [filter, setFilter] = useState<LinkFilter>('all')
  const [slug, setSlug] = useState<string | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  // 初回ロードのfetchより後にユーザーがリンクを追加/削除/更新/並び替えした場合、
  // 遅れて届いた初回ロードのレスポンスが最新のlinks状態を上書きしないようにするガード。
  const linksMutatedRef = useRef(false)

  useEffect(() => {
    async function fetchProfile() {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const res = await fetch('/api/profile', {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (res.ok) {
        const data = await res.json()
        if (!linksMutatedRef.current) {
          setLinks(data?.links || [])
        }
        setSlug(data?.slug || null)
      }
      setLoading(false)
    }
    fetchProfile()
  }, [])

  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(null), 4000)
    return () => clearTimeout(timer)
  }, [feedback])

  async function addLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const normalized = normalizeLinkValue(linkType, url)
    if (!normalized) {
      if (linkType === 'url') setFeedback({ type: 'error', text: t('invalidUrl') })
      else if (linkType === 'email') setFeedback({ type: 'error', text: t('invalidEmailAddress') })
      else setFeedback({ type: 'error', text: t('invalidPhoneNumber') })
      return
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const payload: any = {
      title,
      url: normalized,
      type: linkType,
      icon,
      imageUrl,
      hidden,
      order: 0,
    }

    const res = await fetch('/api/profile/link', {
      method: 'POST',
      body: JSON.stringify(payload),
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

    if (res.ok) {
      const l = await res.json()
      linksMutatedRef.current = true
      setLinks((s) => [
        ...s,
        {
          ...l,
          title: l?.title ?? title,
          url: l?.url ?? normalized,
          type: (l?.type ?? linkType) as LinkType,
          musicProvider: l?.musicProvider ?? null,
          icon: (l?.icon ?? icon) || null,
          imageUrl: (l?.imageUrl ?? imageUrl) || null,
          hidden: typeof l?.hidden === 'boolean' ? l.hidden : hidden,
        },
      ])
      setTitle('')
      setUrl('')
      setIcon('')
      setImageUrl('')
      setHidden(false)
      setLinkType('url')
      setFeedback({ type: 'success', text: t('addSuccess') })
      return
    }

    setFeedback({ type: 'error', text: t('addFailed') })
  }

  async function del(id: string) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const res = await fetch('/api/profile/link', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

    if (res.ok) {
      linksMutatedRef.current = true
      setLinks((s) => s.filter((x) => x.id !== id))
      setPendingDeleteId(null)
      setFeedback({ type: 'success', text: t('deleteSuccess') })
    } else {
      setFeedback({ type: 'error', text: t('deleteFailed') })
    }
  }

  function requestDelete(id: string) {
    if (pendingDeleteId === id) {
      void del(id)
      return
    }
    setPendingDeleteId(id)
  }

  async function update(
    id: string,
    titleValue: string,
    urlValue: string,
    iconValue?: string,
    imageUrlValue?: string,
    hiddenValue?: boolean,
    type?: LinkType,
    provider?: MusicProvider | null,
  ) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const effectiveType = type ?? 'url'
    const normalizedUrl = normalizeLinkValue(effectiveType, urlValue)
    const payload: any = {
      id,
      title: titleValue,
      url: normalizedUrl ?? urlValue,
      icon: iconValue,
      imageUrl: imageUrlValue,
      hidden: hiddenValue,
    }
    if (type) payload.type = type
    payload.musicProvider = type === 'music' ? provider : null

    const res = await fetch('/api/profile/link', {
      method: 'PUT',
      body: JSON.stringify(payload),
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

    if (!res.ok) {
      setFeedback({ type: 'error', text: t('updateFailed') })
      return
    }

    linksMutatedRef.current = true
    setLinks((prev) => prev.map((item) => {
      if (item.id !== id) return item
      return {
        ...item,
        title: titleValue,
        url: urlValue,
        icon: iconValue ?? null,
        imageUrl: imageUrlValue ?? null,
        hidden: typeof hiddenValue === 'boolean' ? hiddenValue : item.hidden,
        type: type ?? item.type,
        musicProvider: type === 'music' ? (provider ?? item.musicProvider ?? null) : (type ? null : item.musicProvider ?? null),
      }
    }))
  }

  async function reorderLinks(newLinks: LinkItem[]) {
    const linkIds = newLinks.map((l) => l.id)
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const res = await fetch('/api/profile/reorder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ linkIds }),
      credentials: 'include',
    })
    if (!res.ok) setFeedback({ type: 'error', text: t('reorderFailed') })
  }

  function handleDragStart(index: number) {
    if (filter !== 'all') return
    setDraggedIndex(index)
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    if (filter !== 'all') return
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newLinks = [...links]
    const draggedItem = newLinks[draggedIndex]
    newLinks.splice(draggedIndex, 1)
    newLinks.splice(index, 0, draggedItem)

    linksMutatedRef.current = true
    setLinks(newLinks)
    setDraggedIndex(index)
  }

  function handleDragEnd() {
    if (filter !== 'all') return
    setDraggedIndex(null)
    reorderLinks(links)
  }

  async function copyPublicUrl(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setFeedback({ type: 'success', text: t('copySuccess') })
    } catch {
      setFeedback({ type: 'error', text: t('copyFailed') })
    }
  }

  async function copyLinkValue(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setFeedback({ type: 'success', text: t('copySuccess') })
    } catch {
      setFeedback({ type: 'error', text: t('copyFailed') })
    }
  }

  if (loading) return <div className="p-6">{t('loading')}</div>

  const publicUrl = slug ? `${window.location.origin}/p/${slug}` : null
  const targetPlaceholder =
    linkType === 'url'
      ? t('urlLabel')
      : linkType === 'email'
        ? t('inputPlaceholderEmail')
        : t('inputPlaceholderPhone')

  const filteredEntries = links
    .map((link, index) => ({ link, index }))
    .filter(({ link }) => {
      if (filter === 'hidden') return Boolean(link.hidden)
      if (filter === 'music') return link.type === 'music'
      return true
    })

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">{t('title')}</h1>

      {feedback && <InlineFeedback type={feedback.type} text={feedback.text} className="mb-4" />}

      {publicUrl && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm font-medium text-gray-700 mb-1">{t('publicUrl')}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline break-all"
            >
              {publicUrl}
            </a>
            <button type="button" className="btn" onClick={() => copyPublicUrl(publicUrl)}>
              {t('copyPublicUrl')}
            </button>
          </div>
        </div>
      )}

      <form onSubmit={addLink} className="space-y-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('titleLabel')} className="input" />
        <select value={linkType} onChange={(e) => setLinkType(e.target.value as LinkType)} className="input">
          <option value="url">{t('linkTypeUrl')}</option>
          <option value="email">{t('linkTypeEmail')}</option>
          <option value="tel">{t('linkTypeTel')}</option>
          <option value="sms">{t('linkTypeSms')}</option>
          <option value="imessage">{t('linkTypeImessage')}</option>
        </select>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={targetPlaceholder} className="input" />
        <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder={t('iconLabel')} className="input" />
        <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder={t('imageUrlLabel')} className="input" />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
          {t('hiddenLabel')}
        </label>
        <div className="flex gap-2"><button className="btn">{t('add')}</button></div>
      </form>

      <div className="mt-6 space-y-2">
        <label className="block text-sm font-medium text-gray-700">{t('filterLabel')}</label>
        <select data-testid="links-filter" value={filter} onChange={(e) => setFilter(e.target.value as LinkFilter)} className="input">
          <option value="all">{t('filterAll')}</option>
          <option value="hidden">{t('filterHidden')}</option>
          <option value="music">{t('filterMusic')}</option>
        </select>
        {filter !== 'all' && <p className="text-xs text-gray-500">{t('filterDragDisabled')}</p>}
      </div>

      <div className="mt-6 space-y-3" data-testid="links-list">
        {filteredEntries.length === 0 && <p className="text-sm text-gray-500">{t('filterNoResults')}</p>}
        {filteredEntries.map(({ link: l, index }) => (
          <div
            key={l.id}
            data-testid="link-row"
            draggable={filter === 'all'}
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`flex flex-wrap items-center gap-2 p-3 border rounded-lg transition-all ${
              filter === 'all' ? 'cursor-move' : 'cursor-default'
            } ${
              draggedIndex === index ? 'opacity-50 bg-gray-100' : l.hidden ? 'bg-gray-50 border-dashed' : 'bg-white hover:shadow-md'
            }`}
          >
            <div className="text-gray-400 mr-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"></path>
              </svg>
            </div>
            <input defaultValue={l.title} onBlur={(e) => update(l.id, e.currentTarget.value, l.url, l.icon || '', l.imageUrl || '', Boolean(l.hidden), l.type, l.musicProvider || null)} className="input flex-1 min-w-[140px]" />
            <input defaultValue={l.url} onBlur={(e) => update(l.id, l.title, e.currentTarget.value, l.icon || '', l.imageUrl || '', Boolean(l.hidden), l.type, l.musicProvider || null)} className="input flex-1 min-w-[140px]" />
            <input defaultValue={l.icon || ''} onBlur={(e) => update(l.id, l.title, l.url, e.currentTarget.value, l.imageUrl || '', Boolean(l.hidden), l.type, l.musicProvider || null)} placeholder={t('iconLabel')} className="input w-24" />
            <input defaultValue={l.imageUrl || ''} onBlur={(e) => update(l.id, l.title, l.url, l.icon || '', e.currentTarget.value, Boolean(l.hidden), l.type, l.musicProvider || null)} placeholder={t('imageUrlLabel')} className="input flex-1 min-w-[140px]" />
            {l.type === 'music' && (
              <select
                defaultValue={l.musicProvider || 'spotify'}
                onChange={(e) => update(l.id, l.title, l.url, l.icon || '', l.imageUrl || '', Boolean(l.hidden), 'music', e.currentTarget.value as MusicProvider)}
                className="input w-40"
              >
                <option value="apple_music">{t('musicProviderAppleMusic')}</option>
                <option value="spotify">{t('musicProviderSpotify')}</option>
                <option value="youtube_music">{t('musicProviderYoutubeMusic')}</option>
              </select>
            )}
            <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
              <input
                type="checkbox"
                defaultChecked={Boolean(l.hidden)}
                onChange={(e) => update(l.id, l.title, l.url, l.icon || '', l.imageUrl || '', e.currentTarget.checked, l.type, l.musicProvider || null)}
              />
              {t('hiddenLabel')}
            </label>
            <button type="button" onClick={() => void copyLinkValue(l.url)} className="btn whitespace-nowrap">{t('copyLink')}</button>
            {pendingDeleteId === l.id ? (
              <>
                <button type="button" onClick={() => void del(l.id)} className="btn bg-red-500 hover:bg-red-600 text-white whitespace-nowrap">{t('deleteConfirmAction')}</button>
                <button type="button" onClick={() => setPendingDeleteId(null)} className="btn whitespace-nowrap">{t('deleteCancel')}</button>
              </>
            ) : (
              <button type="button" onClick={() => requestDelete(l.id)} className="btn bg-red-500 hover:bg-red-600 text-white whitespace-nowrap">{t('delete')}</button>
            )}
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
      messages: await getMessages(ctx.locale || 'ja'),
    },
  }
}
