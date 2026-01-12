import { GetServerSideProps } from 'next'
import Head from 'next/head'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { getMessages } from '../../lib/i18n'

export default function ProfilePage({ profile }: any) {
  const t = useTranslations('common')
  
  if (!profile) return <div className="p-6">{t('notFound')}</div>
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
    const resp = await fetch(`${baseUrl}/api/profile/public?id=${encodeURIComponent(id)}`)
    if (resp.status === 404) return { notFound: true }
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
