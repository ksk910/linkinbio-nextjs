import { GetServerSideProps } from 'next'
import { prisma } from '../../lib/prisma'

export default function ProfilePage({ profile }: any) {
  if (!profile) return <div className="p-6">Not found</div>
  return (
    <div className="max-w-md mx-auto p-6 text-center">
      <img src={profile.avatarUrl || '/default-avatar.png'} alt="avatar" className="mx-auto rounded-full w-24 h-24" />
      <h1 className="text-xl font-bold mt-4">{profile.displayName || 'Anonymous'}</h1>
      <p className="text-sm text-gray-600">{profile.bio}</p>
      <div className="mt-6 space-y-3">
        {profile.links.map((l: any) => (
          <a key={l.id} href={l.url} className="block bg-white p-3 rounded shadow">{l.title}</a>
        ))}
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const id = ctx.params?.id as string
  const profile = await prisma.profile.findUnique({ where: { id }, include: { links: true } })
  return { props: { profile: profile ? JSON.parse(JSON.stringify(profile)) : null } }
}
