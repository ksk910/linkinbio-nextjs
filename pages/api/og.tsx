import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'

export const config = { runtime: 'edge' }

export default async function handler(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const name = searchParams.get('name') || 'Link in Bio'
    const bio = searchParams.get('bio') || ''

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f9fafb',
            fontFamily: 'sans-serif',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              padding: '40px',
            }}
          >
            <div
              style={{
                fontSize: 64,
                fontWeight: 700,
                marginBottom: 16,
                color: '#111827',
              }}
            >
              {name}
            </div>
            {bio && (
              <div
                style={{
                  fontSize: 32,
                  color: '#6b7280',
                  maxWidth: 800,
                }}
              >
                {bio}
              </div>
            )}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    )
  } catch (e: any) {
    console.error(e?.message)
    return new Response('Failed to generate OG image', { status: 500 })
  }
}
