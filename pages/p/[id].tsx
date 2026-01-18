import React, { type ReactNode } from 'react'
import { GetServerSideProps } from 'next'
import Head from 'next/head'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { getMessages } from '../../lib/i18n'

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

// SNS アイコンコンポーネント
function SocialIcon({ type, url }: { type: string; url: string }) {
  const iconClasses = 'w-6 h-6 hover:opacity-80 transition-opacity'
  const linkClasses = 'inline-flex items-center justify-center'
  
  const icons: Record<string, ReactNode> = {
    twitter: (
      <svg className={iconClasses} fill="currentColor" viewBox="0 0 24 24">
        <path d="M2 3h4.6L12 10.3 17.1 3H22l-7.6 10.6L22 21h-4.6l-5.3-7.3L6.8 21H2l7.9-10.4z" />
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

export default function ProfilePage({ profile }: any) {
  const t = useTranslations('common')
  
  if (!profile) return <div className="p-6">{t('notFound')}</div>

  // SNS リンクを抽出
  const socialLinks = profile.links
    .map((link: any) => ({
      ...link,
      type: detectSocialMedia(link.url),
    }))
    .filter((link: any) => link.type)
    .slice(0, 8) // 最大8つまで

  return (
    <>
      <Head>
        <title>{profile.displayName ? `${profile.displayName} | Link in Bio` : 'Link in Bio'}</title>
        <meta name="description" content={profile.bio || 'Personal profile and links'} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={profile.displayName || 'Link in Bio'} />
        <meta property="og:description" content={profile.bio || 'Personal profile and links'} />
        <meta property="og:image" content={`/api/og?name=${encodeURIComponent(profile.displayName || 'Link in Bio')}&bio=${encodeURIComponent(profile.bio || '')}`} />
        <meta property="og:url" content={`https://linkinbio-ruby.vercel.app/p/${profile.id}`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={profile.displayName || 'Link in Bio'} />
        <meta name="twitter:description" content={profile.bio || 'Personal profile and links'} />
        <meta name="twitter:image" content={`/api/og?name=${encodeURIComponent(profile.displayName || 'Link in Bio')}&bio=${encodeURIComponent(profile.bio || '')}`} />
      </Head>
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-md mx-auto p-6 text-center">
          <div className="flex flex-col items-center">
            <div className="mx-auto rounded-full overflow-hidden border border-gray-200 shadow-sm" style={{ width: 96, height: 96 }}>
              <Image
                src={profile.avatarUrl || '/default-avatar.png'}
                alt="avatar"
                width={96}
                height={96}
                className="object-cover"
                priority
              />
            </div>
            <h1 className="text-2xl font-semibold mt-4 tracking-tight">{profile.displayName || t('anonymous')}</h1>
            {profile.bio && <p className="text-sm text-gray-600 mt-1">{profile.bio}</p>}
            
            {/* SNS アイコン表示 */}
            {socialLinks.length > 0 && (
              <div className="flex gap-3 mt-4 justify-center">
                {socialLinks.map((link: any) => (
                  <SocialIcon key={link.id} type={link.type} url={link.url} />
                ))}
              </div>
            )}
          </div>
          <div className="mt-6 space-y-3">
            {profile.links.map((l: any) => (
              <a
                key={l.id}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-white/90 hover:bg-white border border-gray-200 p-3 rounded-lg shadow-sm hover:shadow transition-shadow"
              >
                <div className="font-medium">{l.title}</div>
                <div className="text-xs text-gray-500 truncate">{l.url}</div>
              </a>
            ))}
          </div>
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
          messages: await getMessages(ctx.locale || 'ja')
        } 
      }
    }
    if (!resp.ok) throw new Error(`API error: ${resp.status}`)
    const profile = await resp.json()
    return { 
      props: { 
        profile,
        messages: await getMessages(ctx.locale || 'ja')
      } 
    }
  } catch (e) {
    console.error('SSR profile load error', e)
    return { props: { profile: null, messages: await getMessages(ctx.locale || 'ja') } }
  }
}
