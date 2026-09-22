import { useEffect, useState } from 'react'
import { GetServerSideProps } from 'next'
import { verifyToken } from '../../lib/auth'
import { useTranslations } from 'next-intl'
import { getMessages } from '../../lib/i18n'
import { buildProfileShareUrl, buildQrSvg } from '../../lib/qr'
import FileUpload from '../../components/FileUpload'
import InlineFeedback from '../../components/InlineFeedback'

const templates = [
  { key: 'classic', nameKey: 'themeClassic', backgroundColor: '#f9fafb', textColor: '#111827', accentColor: '#111827' },
  { key: 'night', nameKey: 'themeNight', backgroundColor: '#0f172a', textColor: '#e2e8f0', accentColor: '#38bdf8' },
  { key: 'sunrise', nameKey: 'themeSunrise', backgroundColor: '#fff7ed', textColor: '#431407', accentColor: '#f97316' },
  { key: 'mint', nameKey: 'themeMint', backgroundColor: '#ecfdf3', textColor: '#064e3b', accentColor: '#10b981' },
]

type BlockType = 'profile' | 'headline' | 'bio' | 'links' | 'icon' | 'line' | 'video' | 'music'
type BlockItem = { id: string; type: BlockType; content: string; order: number }
type LineStyle = 'solid' | 'dashed' | 'dotted' | 'double'

const ICON_PRESETS = ['⭐', '🎵', '🎬', '📷', '💼', '📚', '🛍️', '🧭']

const defaultBlocks: BlockItem[] = [
  { id: 'default-profile', type: 'profile', content: '', order: 0 },
  { id: 'default-headline', type: 'headline', content: '', order: 1 },
  { id: 'default-bio', type: 'bio', content: '', order: 2 },
  { id: 'default-links', type: 'links', content: '', order: 3 },
]

function parseLineContent(content: string): { style: LineStyle; text: string } {
  try {
    const parsed = JSON.parse(content)
    if (parsed && typeof parsed === 'object') {
      const style = ['solid', 'dashed', 'dotted', 'double'].includes(parsed.style) ? parsed.style : 'solid'
      const text = typeof parsed.text === 'string' ? parsed.text : ''
      return { style: style as LineStyle, text }
    }
  } catch {
    // Fallback to plain text line label.
  }
  return { style: 'solid', text: content || '' }
}

function stringifyLineContent(style: LineStyle, text: string): string {
  return JSON.stringify({ style, text })
}

function getEmbeddedVideoUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl)
    const host = url.hostname.toLowerCase()
    if (host.includes('youtu.be')) {
      const id = url.pathname.replace('/', '')
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
    if (host.includes('youtube.com')) {
      const v = url.searchParams.get('v')
      if (v) return `https://www.youtube.com/embed/${v}`
      const parts = url.pathname.split('/').filter(Boolean)
      if (parts[0] === 'embed' && parts[1]) return `https://www.youtube.com/embed/${parts[1]}`
      if (parts[0] === 'shorts' && parts[1]) return `https://www.youtube.com/embed/${parts[1]}`
    }
    if (host.includes('vimeo.com')) {
      const id = url.pathname.split('/').filter(Boolean)[0]
      return id ? `https://player.vimeo.com/video/${id}` : null
    }
  } catch {
    return null
  }
  return null
}

type MusicEmbed = { url: string; kind: 'fixed'; height: number } | { url: string; kind: 'video' }

function getEmbeddedMusicUrl(rawUrl: string): MusicEmbed | null {
  try {
    const url = new URL(rawUrl)
    const host = url.hostname.toLowerCase()
    if (host.includes('open.spotify.com')) {
      const segments = url.pathname.split('/').filter(Boolean).filter((seg) => !/^intl-[a-z]{2}$/i.test(seg))
      const [resourceType, id] = segments
      if (!resourceType || !id) return null
      const height = resourceType === 'track' || resourceType === 'episode' ? 152 : 352
      return { url: `https://open.spotify.com/embed/${resourceType}/${id}`, kind: 'fixed', height }
    }
    if (host.includes('music.apple.com')) {
      const embedUrl = rawUrl.replace(/music\.apple\.com/i, 'embed.music.apple.com')
      const height = url.searchParams.has('i') ? 175 : 450
      return { url: embedUrl, kind: 'fixed', height }
    }
    if (host.includes('music.youtube.com') || host.includes('youtu.be') || host.includes('youtube.com')) {
      const videoUrl = getEmbeddedVideoUrl(rawUrl)
      if (videoUrl) return { url: videoUrl, kind: 'video' }

      const listId = url.searchParams.get('list')
      if (listId) return { url: `https://www.youtube.com/embed/videoseries?list=${listId}`, kind: 'video' }

      const parts = url.pathname.split('/').filter(Boolean)
      if (parts[0] === 'browse' && parts[1]) {
        const playlistId = parts[1].startsWith('VL') ? parts[1].slice(2) : parts[1]
        return { url: `https://www.youtube.com/embed/videoseries?list=${playlistId}`, kind: 'video' }
      }
      return null
    }
  } catch {
    return null
  }
  return null
}

function mapProfileSaveErrorToKey(errorCode: string): string {
  if (errorCode === 'slug_taken') return 'saveErrorSlugTaken'
  if (errorCode.startsWith('block_')) return 'saveErrorBlockInvalid'
  if (errorCode === 'account_status_invalid') return 'saveErrorAccountStatusInvalid'
  if (errorCode === 'csrf_origin_mismatch' || errorCode === 'csrf_origin_missing') return 'saveErrorSecurity'
  return 'saveFailed'
}

function feedbackTypeForKey(key: string): 'success' | 'error' {
  if (key === 'saved' || key === 'uploadSuccess') return 'success'
  return 'error'
}

export default function ProfileEdit() {
  const t = useTranslations('profileEdit')
  const [displayName, setDisplayName] = useState('')
  const [slug, setSlug] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [accountStatus, setAccountStatus] = useState<'active' | 'disabled'>('active')
  const [theme, setTheme] = useState('')
  const [backgroundColor, setBackgroundColor] = useState('')
  const [textColor, setTextColor] = useState('')
  const [accentColor, setAccentColor] = useState('')
  const [blocks, setBlocks] = useState<BlockItem[]>(defaultBlocks)
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [userId, setUserId] = useState('')
  const [slugStatus, setSlugStatus] = useState<'idle' | 'validating' | 'available' | 'taken' | 'invalid'>('idle')
  const [slugError, setSlugError] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null)
  const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [analyticsSummary, setAnalyticsSummary] = useState<{ viewCount: number; clickCount: number; totalEvents: number; dailyTrend?: Array<{ date: string; views: number; clicks: number; total: number }>; topLinks?: Array<{ id: string; title: string; clickCount: number }>; insight?: { state: 'positive' | 'neutral' | 'negative'; summary: string; delta: number; currentPeriodTotal: number; previousPeriodTotal: number; actionKey?: string } } | null>(null)
  const [analyticsRange, setAnalyticsRange] = useState<'7' | '30'>('7')
  const [qrCodeSvg, setQrCodeSvg] = useState('')
  const slugCheckTimeout = { current: null as NodeJS.Timeout | null }

  useEffect(() => {
    async function fetchProfile() {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const res = await fetch('/api/profile', { 
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (res.ok) {
        const data = await res.json()
        if (data) {
          setDisplayName(data.displayName || '')
          setSlug(data.slug || '')
          setBio(data.bio || '')
          setAvatarUrl(data.avatarUrl || '')
          setAccountStatus(data.accountStatus === 'disabled' ? 'disabled' : 'active')
          setTheme(data.theme || '')
          setBackgroundColor(data.backgroundColor || '')
          setTextColor(data.textColor || '')
          setAccentColor(data.accentColor || '')
          if (Array.isArray(data.blocks) && data.blocks.length > 0) {
            setBlocks(
              data.blocks.map((block: any, index: number) => ({
                id: String(block.id || `block-${index}`),
                type: (block.type || 'bio') as BlockType,
                content: block.content || '',
                order: typeof block.order === 'number' ? block.order : index,
              }))
            )
          }
          setUserId(data.userId || '')
          if (data.id) {
            const analyticsRes = await fetch(`/api/profile/analytics?profileId=${encodeURIComponent(data.id)}&days=${analyticsRange}`)
            if (analyticsRes.ok) {
              const analyticsData = await analyticsRes.json()
              setAnalyticsSummary({
                viewCount: analyticsData.viewCount || 0,
                clickCount: analyticsData.clickCount || 0,
                totalEvents: analyticsData.totalEvents || 0,
                dailyTrend: Array.isArray(analyticsData.dailyTrend) ? analyticsData.dailyTrend : [],
                topLinks: Array.isArray(analyticsData.topLinks) ? analyticsData.topLinks : [],
                insight: analyticsData.insight || { state: 'neutral', summary: 'Steady performance', delta: 0, currentPeriodTotal: 0, previousPeriodTotal: 0, actionKey: 'analyticsActionNeutral' },
              })
            }
          }
        }
      }
      setLoading(false)
    }
    fetchProfile()
  }, [])

  useEffect(() => {
    if (!saveFeedback) return
    const timer = setTimeout(() => setSaveFeedback(null), 4000)
    return () => clearTimeout(timer)
  }, [saveFeedback])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const token = localStorage.getItem('token')
    const profileId = userId
    if (!profileId) return
    const fetchAnalytics = async () => {
      const res = await fetch(`/api/profile/analytics?profileId=${encodeURIComponent(profileId)}&days=${analyticsRange}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (res.ok) {
        const analyticsData = await res.json()
        setAnalyticsSummary({
          viewCount: analyticsData.viewCount || 0,
          clickCount: analyticsData.clickCount || 0,
          totalEvents: analyticsData.totalEvents || 0,
          dailyTrend: Array.isArray(analyticsData.dailyTrend) ? analyticsData.dailyTrend : [],
          topLinks: Array.isArray(analyticsData.topLinks) ? analyticsData.topLinks : [],
          insight: analyticsData.insight || { state: 'neutral', summary: 'Steady performance', delta: 0, currentPeriodTotal: 0, previousPeriodTotal: 0, actionKey: 'analyticsActionNeutral' },
        })
      }
    }
    fetchAnalytics()
  }, [analyticsRange, userId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const target = slug || userId
    if (!target) {
      setQrCodeSvg('')
      return
    }

    const targetUrl = buildProfileShareUrl(window.location.origin, target)
    buildQrSvg(targetUrl, { width: 180, margin: 1, logoUrl: avatarUrl || undefined })
      .then((svg) => setQrCodeSvg(svg))
      .catch(() => setQrCodeSvg(''))
  }, [slug, userId])

  useEffect(() => {
    if (slugCheckTimeout.current) clearTimeout(slugCheckTimeout.current)
    
    if (!slug.trim()) {
      setSlugStatus('idle')
      return
    }

    // クライアント側バリデーション
    if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
      setSlugStatus('invalid')
      setSlugError(t('slugInvalid'))
      return
    }

    if (slug.length < 3) {
      setSlugStatus('invalid')
      setSlugError(t('slugTooShort'))
      return
    }

    if (slug.length > 30) {
      setSlugStatus('invalid')
      setSlugError(t('slugTooLong'))
      return
    }

    setSlugStatus('validating')
    slugCheckTimeout.current = setTimeout(async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
        const res = await fetch('/api/profile/check-slug', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ slug, excludeUserId: userId }),
          credentials: 'include',
        })
        const data = await res.json()
        if (data.available) {
          setSlugStatus('available')
          setSlugError('')
        } else {
          setSlugStatus('taken')
          setSlugError(data.error || t('slugTaken'))
        }
      } catch (err) {
        setSlugStatus('invalid')
        setSlugError('Error checking slug')
      }
    }, 500)

    return () => {
      if (slugCheckTimeout.current) clearTimeout(slugCheckTimeout.current)
    }
  }, [slug, userId, t])

  async function save(e: any) {
    e.preventDefault()
    if (savingProfile) return
    setSaveFeedback(null)
    if (slug && slugStatus === 'invalid') {
      setSaveFeedback({ type: 'error', text: t('saveErrorCheckSlug') })
      return
    }
    const normalizedAvatarUrl = avatarUrl.trim()
    if (normalizedAvatarUrl) {
      try {
        const parsed = new URL(normalizedAvatarUrl)
        if (!parsed.hostname || !['http:', 'https:'].includes(parsed.protocol)) {
          setSaveFeedback({ type: 'error', text: t('invalidUrl') })
          return
        }
      } catch {
        setSaveFeedback({ type: 'error', text: t('invalidUrl') })
        return
      }
    }
    setSavingProfile(true)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const res = await fetch('/api/profile', {
        method: 'POST',
        body: JSON.stringify({
          displayName,
          slug,
          bio,
          avatarUrl: normalizedAvatarUrl,
          accountStatus,
          theme,
          backgroundColor,
          textColor,
          accentColor,
          blocks: blocks.map((block, index) => ({
            type: block.type,
            content: block.content,
            order: index,
          })),
        }),
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (res.ok) {
        const key = 'saved'
        setSaveFeedback({ type: feedbackTypeForKey(key), text: t(key) })
      } else {
        const data = await res.json().catch(() => ({}))
        const messageKey = mapProfileSaveErrorToKey(String((data as any)?.error || ''))
        setSaveFeedback({ type: feedbackTypeForKey(messageKey), text: t(messageKey as any) })
      }
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setSaveFeedback({ type: 'error', text: t('selectImage') })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setSaveFeedback({ type: 'error', text: t('fileSizeLimit') })
      return
    }

    setUploading(true)
    try {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64 = reader.result as string
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
        const res = await fetch('/api/upload/avatar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ image: base64 }),
          credentials: 'include',
        })

        if (res.ok) {
          const data = await res.json()
          setAvatarUrl(data.url)
          const key = 'uploadSuccess'
          setSaveFeedback({ type: feedbackTypeForKey(key), text: t(key) })
        } else {
          const data = await res.json().catch(() => ({}))
          const errorMessage = typeof data?.error === 'string' && data.error
            ? data.error
            : t('uploadFailed')
          setSaveFeedback({ type: 'error', text: errorMessage })
        }
        setUploading(false)
      }
      reader.readAsDataURL(file)
    } catch (err) {
      setSaveFeedback({ type: 'error', text: t('uploadError') })
      setUploading(false)
    }
  }

  async function changePassword(e: any) {
    e.preventDefault()
    setPasswordError('')
    setPasswordMessage('')

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError(t('allFieldsRequired'))
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t('passwordsDoNotMatch'))
      return
    }

    if (newPassword.length < 6) {
      setPasswordError(t('passwordMinLength'))
      return
    }

    setPasswordLoading(true)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const res = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
        credentials: 'include',
      })

      if (res.ok) {
        setPasswordMessage(t('passwordChanged'))
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        const data = await res.json()
        setPasswordError(data.error || t('changePasswordFailed'))
      }
    } catch (err) {
      setPasswordError(t('changePasswordError'))
    } finally {
      setPasswordLoading(false)
    }
  }

  async function copyShareLink() {
    if (typeof window === 'undefined') return
    const target = slug || userId
    if (!target) return
    const shareUrl = `${window.location.origin}/p/${encodeURIComponent(target)}`
    try {
      await navigator.clipboard.writeText(shareUrl)
      setSaveFeedback({ type: 'success', text: t('copied') })
    } catch {
      setSaveFeedback({ type: 'error', text: t('copyFailed') })
    }
  }

  async function shareProfile() {
    if (typeof window === 'undefined') return
    const target = slug || userId
    if (!target) return
    const shareUrl = `${window.location.origin}/p/${encodeURIComponent(target)}`
    try {
      if (navigator.share) {
        await navigator.share({
          title: document.title || 'Link in Bio',
          text: t('shareProfileText'),
          url: shareUrl,
        })
        setSaveFeedback({ type: 'success', text: t('shared') })
      } else {
        await copyShareLink()
      }
    } catch {
      setSaveFeedback({ type: 'error', text: t('shareFailed') })
    }
  }

  async function downloadQrCode() {
    if (typeof window === 'undefined') return
    const target = slug || userId
    if (!target) return
    const shareUrl = buildProfileShareUrl(window.location.origin, target)
    try {
      const svgString = await buildQrSvg(shareUrl, { width: 320, margin: 2, logoUrl: avatarUrl || undefined })
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'profile-qr.svg'
      link.click()
      URL.revokeObjectURL(url)
      setSaveFeedback({ type: 'success', text: t('qrDownloaded') })
    } catch {
      setSaveFeedback({ type: 'error', text: t('qrDownloadFailed') })
    }
  }

  if (loading) return <div className="p-6">{t('loading')}</div>

  function addBlock() {
    setBlocks((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        type: 'headline',
        content: '',
        order: prev.length,
      },
    ])
  }

  function updateBlock(index: number, patch: Partial<BlockItem>) {
    setBlocks((prev) => prev.map((block, i) => (i === index ? { ...block, ...patch } : block)))
  }

  function moveBlock(index: number, direction: -1 | 1) {
    setBlocks((prev) => {
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item)
      return next
    })
  }

  function removeBlock(index: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== index))
  }

  function handleBlockDragStart(index: number) {
    setDraggedBlockIndex(index)
  }

  function handleBlockDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    if (draggedBlockIndex === null || draggedBlockIndex === index) return

    setBlocks((prev) => {
      const next = [...prev]
      const [dragged] = next.splice(draggedBlockIndex, 1)
      next.splice(index, 0, dragged)
      return next
    })
    setDraggedBlockIndex(index)
  }

  function handleBlockDragEnd() {
    setDraggedBlockIndex(null)
  }

  function addIconPreset(index: number, icon: string) {
    setBlocks((prev) => prev.map((block, i) => {
      if (i !== index) return block
      const parts = block.content.split(/[\s,]+/).filter(Boolean)
      if (parts.includes(icon)) return block
      return { ...block, content: [...parts, icon].join(' ') }
    }))
  }

  const shareUrl = typeof window !== 'undefined' && (slug || userId)
    ? `${window.location.origin}/p/${encodeURIComponent(slug || userId)}`
    : ''

  const trendData = analyticsSummary?.dailyTrend ?? []
  const maxTrendValue = Math.max(...trendData.map((entry) => Math.max(entry.views, entry.clicks, 1)), 1)
  const chartWidth = 320
  const chartHeight = 120
  const chartPadding = 12
  const trendPoints = trendData.map((entry, index) => {
    const x = chartPadding + (index / Math.max(trendData.length - 1, 1)) * (chartWidth - chartPadding * 2)
    const viewY = chartHeight - chartPadding - (entry.views / maxTrendValue) * (chartHeight - chartPadding * 2)
    const clickY = chartHeight - chartPadding - (entry.clicks / maxTrendValue) * (chartHeight - chartPadding * 2)
    return { ...entry, x, viewY, clickY }
  })

  const buildPath = (points: Array<{ x: number; viewY: number }>) => points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.viewY.toFixed(1)}`).join(' ')
  const viewPath = buildPath(trendPoints.map((point) => ({ x: point.x, viewY: point.viewY })))
  const clickPath = buildPath(trendPoints.map((point) => ({ x: point.x, viewY: point.clickY })))

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>

      {analyticsSummary && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">{t('analyticsTitle')}</h2>
            <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white p-1 text-xs">
              <button type="button" onClick={() => setAnalyticsRange('7')} className={`rounded-full px-2 py-1 ${analyticsRange === '7' ? 'bg-sky-600 text-white' : 'text-gray-600'}`}>
                7{t('analyticsDaysShort')}
              </button>
              <button type="button" onClick={() => setAnalyticsRange('30')} className={`rounded-full px-2 py-1 ${analyticsRange === '30' ? 'bg-sky-600 text-white' : 'text-gray-600'}`}>
                30{t('analyticsDaysShort')}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded bg-white p-3">
              <div className="text-gray-500">{t('analyticsViews')}</div>
              <div className="text-xl font-semibold">{analyticsSummary.viewCount}</div>
            </div>
            <div className="rounded bg-white p-3">
              <div className="text-gray-500">{t('analyticsClicks')}</div>
              <div className="text-xl font-semibold">{analyticsSummary.clickCount}</div>
            </div>
            <div className="rounded bg-white p-3">
              <div className="text-gray-500">{t('analyticsTotal')}</div>
              <div className="text-xl font-semibold">{analyticsSummary.totalEvents}</div>
            </div>
          </div>
          {analyticsSummary.insight && (
            <div className="mt-3 rounded border border-slate-200 bg-white px-3 py-2 text-sm">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">{t('analyticsSummaryInsight')}</div>
              <div className="mt-1 flex items-center gap-2">
                <span className={`inline-flex h-2.5 w-2.5 rounded-full ${analyticsSummary.insight.state === 'positive' ? 'bg-emerald-500' : analyticsSummary.insight.state === 'negative' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                <span className="font-medium text-slate-700">{t(`analyticsInsight${analyticsSummary.insight.state.charAt(0).toUpperCase()}${analyticsSummary.insight.state.slice(1)}`)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                <span>Δ {analyticsSummary.insight.delta >= 0 ? '+' : ''}{analyticsSummary.insight.delta}</span>
                <span>{analyticsSummary.insight.currentPeriodTotal} / {analyticsSummary.insight.previousPeriodTotal}</span>
              </div>
              {analyticsSummary.insight.actionKey && (
                <div className="mt-2 rounded bg-slate-50 px-2.5 py-2 text-xs text-slate-600">
                  {t(analyticsSummary.insight.actionKey)}
                </div>
              )}
            </div>
          )}
          {trendData.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-medium text-gray-600">{t('analyticsTrend')}</div>
                <div className="flex items-center gap-3 text-[10px] text-gray-500">
                  <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-500" />{t('analyticsViews')}</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-500" />{t('analyticsClicks')}</span>
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-32 w-full">
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                    const y = chartPadding + (chartHeight - chartPadding * 2) * ratio
                    return <line key={ratio} x1={chartPadding} x2={chartWidth - chartPadding} y1={y} y2={y} stroke="#e5e7eb" strokeDasharray="3 3" />
                  })}
                  <path d={viewPath} fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" />
                  <path d={clickPath} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
                  {trendPoints.map((point) => (
                    <g key={point.date}>
                      <circle cx={point.x} cy={point.viewY} r="3" fill="#0ea5e9" />
                      <circle cx={point.x} cy={point.clickY} r="3" fill="#f59e0b" />
                    </g>
                  ))}
                </svg>
                <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
                  {trendPoints.filter((_, index) => index === 0 || index === trendPoints.length - 1 || index % Math.max(1, Math.ceil(trendPoints.length / 6)) === 0).map((point) => (
                    <span key={point.date}>{point.date.slice(5)}</span>
                  ))}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-gray-500">
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-sky-500" />{t('analyticsViews')}: {analyticsSummary.viewCount}</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-orange-500" />{t('analyticsClicks')}: {analyticsSummary.clickCount}</span>
              </div>
              {analyticsSummary.topLinks && analyticsSummary.topLinks.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-medium text-gray-600 mb-2">{t('analyticsTopLinks')}</div>
                  <div className="space-y-2">
                    {analyticsSummary.topLinks.map((link, index) => {
                      const isTop = index === 0
                      return (
                        <div key={link.id} className={`flex items-center justify-between rounded px-3 py-2 text-sm ${isTop ? 'border border-amber-200 bg-amber-50' : 'bg-white'}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${isTop ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                              {index + 1}
                            </span>
                            <span className="truncate pr-2">{link.title}</span>
                          </div>
                          <span className={`font-semibold ${isTop ? 'text-amber-700' : 'text-sky-600'}`}>{link.clickCount}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {shareUrl && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold">{t('shareProfileTitle')}</h2>
              <p className="text-xs text-gray-600">{t('shareProfileDescription')}</p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs font-medium text-blue-600">
              <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">{t('openProfile')}</a>
              <button type="button" onClick={shareProfile} className="hover:underline">{t('shareProfileButton')}</button>
              <button type="button" onClick={copyShareLink} className="hover:underline">{t('copyLink')}</button>
              <button type="button" onClick={downloadQrCode} className="hover:underline">{t('downloadQr')}</button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex justify-center rounded-lg bg-white p-3 min-w-[180px]">
              {qrCodeSvg ? (
                <div dangerouslySetInnerHTML={{ __html: qrCodeSvg }} />
              ) : (
                <div className="text-xs text-gray-500">{t('qrLoading')}</div>
              )}
            </div>
            <div className="space-y-2 text-xs text-gray-700">
              <p className="break-all">{shareUrl}</p>
              <p className="text-[11px] text-gray-500">{t('qrHintWithLogo')}</p>
            </div>
          </div>
        </div>
      )}

      {/* プロフィール編集セクション */}
      <form onSubmit={save} className="space-y-3 mb-8 pb-8 border-b">
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t('displayName')} className="input" />
        
        <div className="space-y-2">
          <label className="block text-sm font-medium">{t('slug')}</label>
          <p className="text-xs text-gray-500">{t('slugDescription')}</p>
          <div className="flex items-center gap-2">
            <input 
              value={slug} 
              onChange={(e) => setSlug(e.target.value)} 
              placeholder={t('slugPlaceholder')} 
              className="input flex-1" 
            />
            <div className="w-6 h-6 flex items-center justify-center text-lg">
              {slugStatus === 'validating' && '⏳'}
              {slugStatus === 'available' && '✅'}
              {slugStatus === 'taken' && '❌'}
              {slugStatus === 'invalid' && '⚠️'}
            </div>
          </div>
          {slugError && <p className="text-xs text-red-600">{slugError}</p>}
          {slugStatus === 'available' && <p className="text-xs text-green-600">{t('slugAvailable')}</p>}
        </div>

        <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder={t('bio')} className="input" />

        <div className="space-y-2">
          <label className="block text-sm font-medium">{t('accountStatusTitle')}</label>
          <p className="text-xs text-gray-500">{t('accountStatusDescription')}</p>
          <select
            value={accountStatus}
            onChange={(e) => setAccountStatus(e.target.value === 'disabled' ? 'disabled' : 'active')}
            className="input"
          >
            <option value="active">{t('accountStatusActive')}</option>
            <option value="disabled">{t('accountStatusDisabled')}</option>
          </select>
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-medium">{t('avatar')}</label>
          <FileUpload onChange={handleImageUpload} disabled={uploading} />
          <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder={t('avatarUrl')} className="input" />
          {avatarUrl && (
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs text-gray-500 mb-2">{t('avatarPreview')}</p>
              <img
                src={avatarUrl}
                alt="Avatar preview"
                className="h-24 w-24 rounded-full object-cover border border-gray-200"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement
                  target.style.display = 'none'
                }}
              />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium">{t('themeTitle')}</label>
              <p className="text-xs text-gray-500">{t('themeDescription')}</p>
            </div>
            <button
              type="button"
              className="text-xs text-blue-600 hover:underline"
              onClick={() => {
                setTheme('')
                setBackgroundColor('')
                setTextColor('')
                setAccentColor('')
              }}
            >
              {t('themeReset')}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {templates.map((tpl) => {
              const selected = theme === tpl.key
              return (
                <button
                  type="button"
                  key={tpl.key}
                  onClick={() => {
                    setTheme(tpl.key)
                    setBackgroundColor(tpl.backgroundColor)
                    setTextColor(tpl.textColor)
                    setAccentColor(tpl.accentColor)
                  }}
                  className={`border rounded-lg p-3 text-left transition shadow-sm hover:shadow ${selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}`}
                  style={{ backgroundColor: tpl.backgroundColor, color: tpl.textColor }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{t(tpl.nameKey)}</span>
                    <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: tpl.accentColor, color: tpl.backgroundColor }}>
                      {t('themeBadge')}
                    </span>
                  </div>
                  <div className="text-xs opacity-80" style={{ color: tpl.textColor }}>
                    {t('themePreview')}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium">{t('backgroundColor')}</label>
              <input type="color" value={backgroundColor || '#f9fafb'} onChange={(e) => { setBackgroundColor(e.target.value); setTheme('custom') }} className="w-full h-10 cursor-pointer" />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium">{t('textColor')}</label>
              <input type="color" value={textColor || '#111827'} onChange={(e) => { setTextColor(e.target.value); setTheme('custom') }} className="w-full h-10 cursor-pointer" />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium">{t('accentColor')}</label>
              <input type="color" value={accentColor || '#111827'} onChange={(e) => { setAccentColor(e.target.value); setTheme('custom') }} className="w-full h-10 cursor-pointer" />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button className="btn" disabled={savingProfile}>{savingProfile ? t('saving') : t('save')}</button>
        </div>
        {saveFeedback && <InlineFeedback type={saveFeedback.type} text={saveFeedback.text} />}

        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">{t('blocksTitle')}</h2>
              <p className="text-xs text-gray-500">{t('blocksDescription')}</p>
            </div>
            <button type="button" className="btn" onClick={addBlock}>{t('blocksAdd')}</button>
          </div>

          <div className="space-y-2">
            {blocks.map((block, index) => (
              <div
                key={block.id}
                draggable
                onDragStart={() => handleBlockDragStart(index)}
                onDragOver={(e) => handleBlockDragOver(e, index)}
                onDragEnd={handleBlockDragEnd}
                className={`border rounded-lg p-3 space-y-2 cursor-move transition ${
                  draggedBlockIndex === index ? 'bg-gray-100 opacity-70' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 select-none" aria-hidden>
                    ::
                  </span>
                  <select
                    value={block.type}
                    onChange={(e) => updateBlock(index, { type: e.target.value as BlockType })}
                    className="input"
                  >
                    <option value="profile">{t('blockTypeProfile')}</option>
                    <option value="headline">{t('blockTypeHeadline')}</option>
                    <option value="bio">{t('blockTypeBio')}</option>
                    <option value="links">{t('blockTypeLinks')}</option>
                    <option value="icon">{t('blockTypeIcon')}</option>
                    <option value="line">{t('blockTypeLine')}</option>
                    <option value="video">{t('blockTypeVideo')}</option>
                    <option value="music">{t('blockTypeMusic')}</option>
                  </select>
                  <button type="button" className="btn" onClick={() => moveBlock(index, -1)} disabled={index === 0}>↑</button>
                  <button type="button" className="btn" onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1}>↓</button>
                  <button type="button" className="btn bg-red-500 hover:bg-red-600 text-white" onClick={() => removeBlock(index)}>{t('blocksDelete')}</button>
                </div>
                {block.type !== 'links' && block.type !== 'profile' && (
                  <input
                    value={block.content}
                    onChange={(e) => updateBlock(index, { content: e.target.value })}
                    placeholder={
                      block.type === 'icon'
                        ? t('blockContentPlaceholderIcon')
                        : block.type === 'video'
                          ? t('blockContentPlaceholderVideo')
                          : block.type === 'music'
                            ? t('blockContentPlaceholderMusic')
                            : t('blockContentPlaceholder')
                    }
                    maxLength={
                      block.type === 'headline'
                        ? 120
                        : block.type === 'bio'
                          ? 500
                          : block.type === 'icon'
                            ? 64
                            : block.type === 'line'
                              ? 200
                              : 2048
                    }
                    className="input"
                  />
                )}
                {block.type === 'icon' && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">{t('blockIconHint')}</p>
                    <div className="flex flex-wrap gap-2">
                      {ICON_PRESETS.map((icon) => (
                        <button
                          key={icon}
                          type="button"
                          className="px-2 py-1 rounded border text-sm bg-white hover:bg-gray-100"
                          onClick={() => addIconPreset(index, icon)}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {block.type === 'line' && (
                  <div className="space-y-2">
                    <select
                      value={parseLineContent(block.content).style}
                      onChange={(e) => {
                        const current = parseLineContent(block.content)
                        updateBlock(index, { content: stringifyLineContent(e.target.value as LineStyle, current.text) })
                      }}
                      className="input"
                    >
                      <option value="solid">{t('lineStyleSolid')}</option>
                      <option value="dashed">{t('lineStyleDashed')}</option>
                      <option value="dotted">{t('lineStyleDotted')}</option>
                      <option value="double">{t('lineStyleDouble')}</option>
                    </select>
                    <input
                      value={parseLineContent(block.content).text}
                      onChange={(e) => {
                        const current = parseLineContent(block.content)
                        updateBlock(index, { content: stringifyLineContent(current.style, e.target.value) })
                      }}
                      placeholder={t('blockLineTextPlaceholder')}
                      maxLength={80}
                      className="input"
                    />
                  </div>
                )}
                {block.type === 'video' && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">{t('blockVideoHint')}</p>
                    {getEmbeddedVideoUrl(block.content.trim()) && (
                      <div className="rounded border overflow-hidden">
                        <iframe
                          src={getEmbeddedVideoUrl(block.content.trim()) as string}
                          title="video-preview"
                          className="w-full aspect-video"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    )}
                  </div>
                )}
                {block.type === 'music' && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">{t('blockMusicHint')}</p>
                    {(() => {
                      const embed = getEmbeddedMusicUrl(block.content.trim())
                      if (!embed) return null
                      return (
                        <div className="rounded border overflow-hidden">
                          {embed.kind === 'video' ? (
                            <iframe
                              src={embed.url}
                              title="music-preview"
                              className="w-full aspect-video"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          ) : (
                            <iframe
                              src={embed.url}
                              title="music-preview"
                              className="w-full"
                              style={{ height: embed.height }}
                              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                              loading="lazy"
                            />
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}
                {(block.type === 'links' || block.type === 'profile') && (
                  <p className="text-xs text-gray-500">{t('blockNoContent')}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </form>

      {/* パスワード変更セクション */}
      <div>
        <h2 className="text-xl font-bold mb-4">{t('changePassword')}</h2>
        <form onSubmit={changePassword} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t('currentPassword')}</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={t('passwordPlaceholder')}
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('newPassword')}</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('passwordPlaceholder')}
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('confirmPassword')}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('passwordPlaceholder')}
              className="input"
            />
          </div>

          {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
          {passwordMessage && <p className="text-sm text-green-600">{passwordMessage}</p>}

          <button type="submit" disabled={passwordLoading} className="btn">
            {passwordLoading ? t('changing') : t('changePassword')}
          </button>
        </form>
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
