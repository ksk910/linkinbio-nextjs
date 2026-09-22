import React, { type ReactNode, useEffect, useMemo, useState } from 'react'
import { GetServerSideProps } from 'next'
import Head from 'next/head'
import { useTranslations } from 'next-intl'
import { getMessages } from '../../lib/i18n'
import { buildQrSvg } from '../../lib/qr'

// SNS ライン検出ロジック
function detectSocialMedia(url: string) {
  const domain = url.toLowerCase()
  if (domain.includes('twitter.com') || domain.includes('x.com')) return 'twitter'
  if (domain.includes('instagram.com')) return 'instagram'
  if (domain.includes('youtube.com') || domain.includes('youtu.be')) return 'youtube'
  if (domain.includes('tiktok.com')) return 'tiktok'
  if (domain.includes('linkedin.com')) return 'linkedin'
  if (domain.includes('github.com')) return 'github'
  if (domain.includes('facebook.com')) return 'facebook'
  return null
}

const safeColor = (value: string | undefined, fallback: string) => {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed ? trimmed : fallback
}

function parseLineContent(content: string): { style: 'solid' | 'dashed' | 'dotted' | 'double'; text: string } {
  try {
    const parsed = JSON.parse(content)
    if (parsed && typeof parsed === 'object') {
      const style = ['solid', 'dashed', 'dotted', 'double'].includes(parsed.style) ? parsed.style : 'solid'
      return { style: style as 'solid' | 'dashed' | 'dotted' | 'double', text: typeof parsed.text === 'string' ? parsed.text : '' }
    }
  } catch {
    // Fallback to plain text only format.
  }
  return { style: 'solid', text: content || '' }
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

// SNS アイコンコンポーネント
function SocialIcon({ type, url }: { type: string; url: string }) {
  const iconClasses = 'w-6 h-6 hover:opacity-80 transition-opacity'
  const linkClasses = 'inline-flex items-center justify-center'
  
  const icons: Record<string, ReactNode> = {
    twitter: (
      <svg className={iconClasses} fill="currentColor" viewBox="0 0 24 24">
        <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2s9 5 20 5a9.5 9.5 0 00-9-5.5c4.75 2.25 9-5 9-5" />
      </svg>
    ),
    instagram: (
      <svg className={iconClasses} fill="currentColor" viewBox="0 0 24 24">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" />
      </svg>
    ),
    youtube: (
      <svg className={iconClasses} fill="currentColor" viewBox="0 0 24 24">
        <path d="M22.54 6.42a2.78 2.78 0 00-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 11.75a29 29 0 00.46 5.33A2.78 2.78 0 003.4 19.54c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 001.94-2 29 29 0 00.46-5.25 29 29 0 00-.46-5.33zM9.75 15.02v-6.04l5.75 3.02-5.75 3.02z" />
      </svg>
    ),
    tiktok: (
      <svg className={iconClasses} fill="currentColor" viewBox="0 0 24 24">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.68v13.7a2.4 2.4 0 11-4.8-2.4A2.4 2.4 0 008.95 13.5V9.94a7.81 7.81 0 00-7.85 7.73v3.63a7.81 7.81 0 007.81-7.81v-3.63a4.83 4.83 0 003.75 1.73V6.69z" />
      </svg>
    ),
    linkedin: (
      <svg className={iconClasses} fill="currentColor" viewBox="0 0 24 24">
        <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z" />
        <circle cx="4" cy="4" r="2" />
      </svg>
    ),
    github: (
      <svg className={iconClasses} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
      </svg>
    ),
    facebook: (
      <svg className={iconClasses} fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={linkClasses}
      title={type}
    >
      {icons[type] || null}
    </a>
  )
}

export default function ProfilePage({ profile, shareUrl }: any) {
  const t = useTranslations('common')
  const [qrCodeSvg, setQrCodeSvg] = useState('')

  useEffect(() => {
    if (!profile?.id) return
    fetch('/api/profile/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId: profile.id, type: 'view' }),
    }).catch(() => undefined)
  }, [profile?.id])

  useEffect(() => {
    if (!profile?.id) {
      setQrCodeSvg('')
      return
    }
    if (!shareUrl) {
      setQrCodeSvg('')
      return
    }
    buildQrSvg(shareUrl, { width: 180, margin: 1, logoUrl: profile?.avatarUrl || undefined })
      .then((svg) => setQrCodeSvg(svg))
      .catch(() => setQrCodeSvg(''))
  }, [profile?.id, shareUrl])
  
  if (!profile) return <div className="p-6">{t('notFound')}</div>

  const backgroundColor = safeColor(profile.backgroundColor, '#f9fafb')
  const textColor = safeColor(profile.textColor, '#111827')
  const accentColor = safeColor(profile.accentColor, '#111827')

  const blocks = Array.isArray(profile.blocks) && profile.blocks.length > 0
    ? [...profile.blocks].sort((a: any, b: any) => a.order - b.order)
    : [
        { type: 'profile', content: '' },
        { type: 'headline', content: '' },
        { type: 'bio', content: '' },
        { type: 'links', content: '' },
      ]

  // SNS リンクを抽出
  const socialLinks = profile.links
    .map((link: any) => ({
      ...link,
      type: detectSocialMedia(link.url),
    }))
    .filter((link: any) => link.type)
    .slice(0, 8) // 最大8つまで

  const renderLinks = () => (
    <div className="mt-6 space-y-3">
      {profile.links.map((l: any) => (
        <a
          key={l.id}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            if (!profile?.id) return
            fetch('/api/profile/analytics', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ profileId: profile.id, type: 'click', linkId: l.id }),
            }).catch(() => undefined)
          }}
          className="block bg-white/90 hover:bg-white p-3 rounded-lg shadow-sm hover:shadow transition-shadow"
          style={{
            border: `1px solid ${accentColor}`,
            color: textColor,
            backgroundColor: 'rgba(255,255,255,0.92)'
          }}
        >
          <div className="flex items-center gap-2">
            {l.imageUrl && (
              <span className="inline-flex items-center justify-center w-8 h-8 rounded overflow-hidden bg-white border border-gray-200">
                <img src={l.imageUrl} alt={l.title} width={32} height={32} className="object-cover" />
              </span>
            )}
            {!l.imageUrl && l.icon && (
              <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-white border border-gray-200 text-lg">
                {l.icon}
              </span>
            )}
            <div className="font-medium">{l.title}</div>
          </div>
          <div className="text-xs truncate" style={{ color: textColor }}>{l.url}</div>
        </a>
      ))}
    </div>
  )

  return (
    <>
      <Head>
        <title>{profile.displayName ? `${profile.displayName} | Link in Bio` : 'Link in Bio'}</title>
        <meta name="description" content={profile.bio || 'Personal profile and links'} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={profile.displayName || 'Link in Bio'} />
        <meta property="og:description" content={profile.bio || 'Personal profile and links'} />
        <meta property="og:image" content={`/api/og?name=${encodeURIComponent(profile.displayName || 'Link in Bio')}&bio=${encodeURIComponent(profile.bio || '')}`} />
        <meta property="og:url" content={shareUrl} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={profile.displayName || 'Link in Bio'} />
        <meta name="twitter:description" content={profile.bio || 'Personal profile and links'} />
        <meta name="twitter:image" content={`/api/og?name=${encodeURIComponent(profile.displayName || 'Link in Bio')}&bio=${encodeURIComponent(profile.bio || '')}`} />
      </Head>
      <main className="min-h-screen" style={{ backgroundColor, color: textColor }}>
        <div className="max-w-md mx-auto p-6 text-center">
          {blocks.map((block: any, index: number) => {
            if (block.type === 'profile') {
              return (
                <div key={`block-${index}`} className="flex flex-col items-center">
                  <div
                    className="mx-auto rounded-full overflow-hidden border shadow-sm"
                    style={{ width: 96, height: 96, borderColor: accentColor }}
                  >
                    <img
                      src={profile.avatarUrl || '/default-avatar.png'}
                      alt="avatar"
                      width={96}
                      height={96}
                      className="object-cover"
                    />
                  </div>
                  <h1 className="text-2xl font-semibold mt-4 tracking-tight" style={{ color: textColor }}>
                    {profile.displayName || t('anonymous')}
                  </h1>
                  {socialLinks.length > 0 && (
                    <div className="flex gap-3 mt-4 justify-center" style={{ color: accentColor }}>
                      {socialLinks.map((link: any) => (
                        <SocialIcon key={link.id} type={link.type} url={link.url} />
                      ))}
                    </div>
                  )}
                </div>
              )
            }

            if (block.type === 'headline') {
              const value = String(block.content || profile.displayName || '').trim()
              if (!value) return null
              return <h2 key={`block-${index}`} className="text-xl font-semibold mt-6">{value}</h2>
            }

            if (block.type === 'bio') {
              const value = String(block.content || profile.bio || '').trim()
              if (!value) return null
              return <p key={`block-${index}`} className="text-sm mt-3">{value}</p>
            }

            if (block.type === 'links') {
              return (
                <div key={`block-${index}`}>
                  {qrCodeSvg ? (
                    <div className="mt-6 rounded-xl border border-white/70 bg-white/80 p-4 shadow-sm">
                      <div className="text-sm font-semibold mb-2">{t('qrCode')}</div>
                      <p className="text-xs opacity-70 mb-3">{t('qrCodeHint')}</p>
                      <div className="flex justify-center rounded-lg bg-white p-3" dangerouslySetInnerHTML={{ __html: qrCodeSvg }} />
                      <p className="text-[11px] mt-2 opacity-70 break-all">{shareUrl}</p>
                    </div>
                  ) : null}
                  {renderLinks()}
                </div>
              )
            }

            if (block.type === 'icon') {
              const value = String(block.content || '').trim()
              if (!value) return null
              const icons = value.split(/[\s,]+/).filter(Boolean).slice(0, 8)
              return (
                <div key={`block-${index}`} className="mt-4 flex items-center justify-center gap-2 text-3xl">
                  {icons.map((icon, iconIndex) => (
                    <span key={`icon-${index}-${iconIndex}`}>{icon}</span>
                  ))}
                </div>
              )
            }

            if (block.type === 'line') {
              const value = parseLineContent(String(block.content || '').trim())
              const borderStyle = value.style
              return (
                <div key={`block-${index}`} className="mt-5">
                  <div className="border-t" style={{ borderColor: accentColor, borderTopStyle: borderStyle }} />
                  {value.text && <p className="text-xs mt-2">{value.text}</p>}
                </div>
              )
            }

            if (block.type === 'video') {
              const value = String(block.content || '').trim()
              if (!value) return null
              const embedUrl = getEmbeddedVideoUrl(value)
              if (embedUrl) {
                return (
                  <div key={`block-${index}`} className="mt-4 rounded overflow-hidden border" style={{ borderColor: accentColor }}>
                    <iframe
                      src={embedUrl}
                      title="video"
                      className="w-full aspect-video"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )
              }
              return (
                <a
                  key={`block-${index}`}
                  href={value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-4 px-4 py-2 rounded border"
                  style={{ borderColor: accentColor }}
                >
                  {t('watchVideo')}
                </a>
              )
            }

            if (block.type === 'music') {
              const value = String(block.content || '').trim()
              if (!value) return null
              const embed = getEmbeddedMusicUrl(value)
              if (embed) {
                return (
                  <div key={`block-${index}`} className="mt-4 rounded overflow-hidden border" style={{ borderColor: accentColor }}>
                    {embed.kind === 'video' ? (
                      <iframe
                        src={embed.url}
                        title="music"
                        className="w-full aspect-video"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <iframe
                        src={embed.url}
                        title="music"
                        className="w-full"
                        style={{ height: embed.height }}
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        loading="lazy"
                      />
                    )}
                  </div>
                )
              }
              return (
                <a
                  key={`block-${index}`}
                  href={value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-4 px-4 py-2 rounded border"
                  style={{ borderColor: accentColor }}
                >
                  {t('listenMusic')}
                </a>
              )
            }

            return null
          })}
        </div>
      </main>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const id = ctx.params?.id as string
  const protocol = ctx.req.headers['x-forwarded-proto']?.toString() || 'https'
  const host = ctx.req.headers.host
  const baseUrl = `${protocol}://${host}`
  try {
    // slugパラメータまたはidパラメータでプロフィールを取得
    const resp = await fetch(`${baseUrl}/api/profile/public?slug=${encodeURIComponent(id)}`)
    if (resp.status === 404) {
      // slugが見つからない場合はidで試す
      const respById = await fetch(`${baseUrl}/api/profile/public?id=${encodeURIComponent(id)}`)
      if (respById.status === 404) return { notFound: true }
      if (!respById.ok) throw new Error(`API error: ${respById.status}`)
      const profile = await respById.json()
      return {
        props: {
          profile,
          shareUrl: `${baseUrl}/p/${id}`,
          messages: await getMessages(ctx.locale || 'ja')
        }
      }
    }
    if (!resp.ok) throw new Error(`API error: ${resp.status}`)
    const profile = await resp.json()
    return {
      props: {
        profile,
        shareUrl: `${baseUrl}/p/${id}`,
        messages: await getMessages(ctx.locale || 'ja')
      }
    }
  } catch (e) {
    console.error('SSR profile load error', e)
    return { props: { profile: null, messages: await getMessages(ctx.locale || 'ja') } }
  }
}
