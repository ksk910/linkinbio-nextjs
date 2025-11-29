import { GetServerSideProps } from 'next'
import Head from 'next/head'

export default function ProfilePage({ profile }: any) {
  if (!profile) return <div className="p-6">Not found</div>
  return (
    <>
      <Head>
        <title>{profile.displayName ? `${profile.displayName} | Link in Bio` : 'Link in Bio'}</title>
        <meta name="description" content={profile.bio || 'Personal profile and links'} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={profile.displayName || 'Link in Bio'} />
        <meta property="og:description" content={profile.bio || 'Personal profile and links'} />
        <meta property="og:image" content={profile.avatarUrl || '/default-avatar.png'} />
        <meta property="og:url" content={`https://linkinbio-ruby.vercel.app/p/${profile.id}`} />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={profile.displayName || 'Link in Bio'} />
        <meta name="twitter:description" content={profile.bio || 'Personal profile and links'} />
        <meta name="twitter:image" content={profile.avatarUrl || '/default-avatar.png'} />
      </Head>
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-md mx-auto p-6 text-center">
          <div className="flex flex-col items-center">
            <img src={profile.avatarUrl || '/default-avatar.png'} alt="avatar" className="mx-auto rounded-full w-24 h-24 border border-gray-200 shadow-sm" />
            <h1 className="text-2xl font-semibold mt-4 tracking-tight">{profile.displayName || 'Anonymous'}</h1>
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
    return { props: { profile } }
  } catch (e) {
    console.error('SSR profile load error', e)
    return { props: { profile: null } }
  }
}
