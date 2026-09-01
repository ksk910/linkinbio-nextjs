import assert from 'node:assert/strict'
import test from 'node:test'
import { buildProfileShareUrl, buildQrSvg } from '../../lib/qr'

test('QR helpers build a share URL and SVG with optional logo', async () => {
  const url = buildProfileShareUrl('https://example.com', 'alice')
  assert.equal(url, 'https://example.com/p/alice')

  const svg = await buildQrSvg(url, {
    width: 180,
    margin: 1,
    logoUrl: 'https://example.com/avatar.png',
  })

  assert.match(svg, /<svg[^>]*xmlns=/)
  assert.match(svg, /<image[^>]*href="https:\/\/example\.com\/avatar\.png"/)

  const noLogoSvg = await buildQrSvg(url, { width: 180, margin: 1 })
  assert.doesNotMatch(noLogoSvg, /<image/)
})
