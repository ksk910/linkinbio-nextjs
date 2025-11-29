import { GetServerSideProps } from 'next'
import { verifyToken } from '../lib/auth'

export default function Home() {
  return null
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const cookie = ctx.req.headers.cookie || ''
  const m = cookie.match(/token=([^;]+)/)
  const token = m ? m[1] : null
  const data = token ? (verifyToken(token) as any) : null
  const loggedIn = Boolean(data?.userId)
  return {
    redirect: {
      destination: loggedIn ? '/profile/links' : '/login',
      permanent: false,
    },
  }
}
