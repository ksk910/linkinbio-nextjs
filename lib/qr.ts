import QRCode from 'qrcode'

export function buildProfileShareUrl(origin: string, target: string): string {
  const normalizedOrigin = origin.replace(/\/$/, '')
  return `${normalizedOrigin}/p/${encodeURIComponent(target)}`
}

export async function buildQrSvg(targetUrl: string, options?: { width?: number; margin?: number; logoUrl?: string }) {
  const svg = await QRCode.toString(targetUrl, {
    type: 'svg',
    margin: options?.margin ?? 1,
    width: options?.width ?? 180,
    color: {
      dark: '#111827',
      light: '#ffffff',
    },
  })

  if (!options?.logoUrl) return svg

  const logoTag = `<image href="${options.logoUrl}" x="50%" y="50%" width="24" height="24" preserveAspectRatio="xMidYMid meet" transform="translate(-12,-12)" />`
  return svg.replace('</svg>', `${logoTag}</svg>`)
}
