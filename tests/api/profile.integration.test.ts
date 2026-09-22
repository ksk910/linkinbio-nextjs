import assert from 'node:assert/strict'
import test from 'node:test'
import checkSlugHandler from '../../pages/api/profile/check-slug'
import linkHandler from '../../pages/api/profile/link'
import reorderHandler from '../../pages/api/profile/reorder'
import profileHandler from '../../pages/api/profile'
import publicProfileHandler from '../../pages/api/profile/public'
import changePasswordHandler from '../../pages/api/profile/change-password'
import { hashPassword, signToken } from '../../lib/auth'
import { prisma } from '../../lib/prisma'
import { validateLinkTarget } from '../../lib/validation'
import { createMockReq, createMockRes } from './helpers'

test('PROFILE check-slug returns validation error for bad format', async () => {
  const req = createMockReq({
    method: 'POST',
    body: { slug: 'bad slug!' },
    headers: { 'x-forwarded-for': '198.51.100.11' },
  })
  const res = createMockRes()

  await checkSlugHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.jsonBody, { available: false, error: 'slug_invalid_format' })
})

test('PROFILE check-slug rate limit returns 429 after threshold', async () => {
  const originalFindUnique = prisma.profile.findUnique
  ;(prisma.profile.findUnique as any) = async () => null

  try {
    for (let i = 0; i < 30; i += 1) {
      const req = createMockReq({
        method: 'POST',
        body: { slug: 'valid_slug_123' },
        headers: { 'x-forwarded-for': '198.51.100.12' },
      })
      const res = createMockRes()
      await checkSlugHandler(req, res)
      assert.equal(res.statusCode, 200)
    }

    const blockedReq = createMockReq({
      method: 'POST',
      body: { slug: 'valid_slug_123' },
      headers: { 'x-forwarded-for': '198.51.100.12' },
    })
    const blockedRes = createMockRes()
    await checkSlugHandler(blockedReq, blockedRes)

    assert.equal(blockedRes.statusCode, 429)
    assert.deepEqual(blockedRes.jsonBody, { available: false, error: 'rate_limited' })
  } finally {
    ;(prisma.profile.findUnique as any) = originalFindUnique
  }
})

test('PROFILE reorder returns 405 on non-POST', async () => {
  const req = createMockReq({
    method: 'GET',
    headers: { host: 'localhost:3000' },
  })
  const res = createMockRes()

  await reorderHandler(req, res)

  assert.equal(res.statusCode, 405)
})

test('PROFILE reorder returns 401 when unauthenticated', async () => {
  const req = createMockReq({
    method: 'POST',
    body: { linkIds: ['link_1'] },
    headers: {
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  await reorderHandler(req, res)

  assert.equal(res.statusCode, 401)
  assert.deepEqual(res.jsonBody, { error: 'Unauthorized' })
})

test('PROFILE reorder blocks cookie-auth write when CSRF origin is missing', async () => {
  const token = signToken({ userId: 'user_reorder_0' })
  const req = createMockReq({
    method: 'POST',
    body: { linkIds: ['link_1'] },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
    },
  })
  const res = createMockRes()

  await reorderHandler(req, res)

  assert.equal(res.statusCode, 403)
  assert.deepEqual(res.jsonBody, { error: 'csrf_origin_missing' })
})

test('PROFILE reorder rejects non-array linkIds payload', async () => {
  const token = signToken({ userId: 'user_reorder_1' })
  const req = createMockReq({
    method: 'POST',
    body: { linkIds: 'bad' },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  await reorderHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.jsonBody, { error: 'linkIds must be an array' })
})

test('PROFILE reorder returns no_profile when profile does not exist', async () => {
  const token = signToken({ userId: 'user_reorder_missing_profile' })
  const originalProfileFindUnique = prisma.profile.findUnique
  ;(prisma.profile.findUnique as any) = async () => null

  const req = createMockReq({
    method: 'POST',
    body: { linkIds: ['link_1'] },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  try {
    await reorderHandler(req, res)
    assert.equal(res.statusCode, 400)
    assert.deepEqual(res.jsonBody, { error: 'no_profile' })
  } finally {
    ;(prisma.profile.findUnique as any) = originalProfileFindUnique
  }
})

test('PROFILE reorder updates owned link order successfully', async () => {
  const token = signToken({ userId: 'user_reorder_2' })
  const originalProfileFindUnique = prisma.profile.findUnique
  const originalLinkFindMany = prisma.link.findMany
  const originalLinkUpdate = prisma.link.update
  const updatedOrders: Array<{ id: string; order: number }> = []

  ;(prisma.profile.findUnique as any) = async () => ({ id: 'profile_reorder_2', userId: 'user_reorder_2' })
  ;(prisma.link.findMany as any) = async () => ([{ id: 'link_b' }, { id: 'link_a' }])
  ;(prisma.link.update as any) = async ({ where, data }: any) => {
    updatedOrders.push({ id: where.id, order: data.order })
    return { id: where.id, order: data.order }
  }

  const req = createMockReq({
    method: 'POST',
    body: { linkIds: ['link_b', 'link_a'] },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  try {
    await reorderHandler(req, res)
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.jsonBody, { success: true })
    assert.deepEqual(updatedOrders, [
      { id: 'link_b', order: 0 },
      { id: 'link_a', order: 1 },
    ])
  } finally {
    ;(prisma.profile.findUnique as any) = originalProfileFindUnique
    ;(prisma.link.findMany as any) = originalLinkFindMany
    ;(prisma.link.update as any) = originalLinkUpdate
  }
})

test('PROFILE reorder rejects non-owned link ids', async () => {
  const token = signToken({ userId: 'user_reorder_3' })
  const originalProfileFindUnique = prisma.profile.findUnique
  const originalLinkFindMany = prisma.link.findMany

  ;(prisma.profile.findUnique as any) = async () => ({ id: 'profile_reorder_3', userId: 'user_reorder_3' })
  ;(prisma.link.findMany as any) = async () => ([{ id: 'link_owned_only' }])

  const req = createMockReq({
    method: 'POST',
    body: { linkIds: ['link_owned_only', 'link_other_user'] },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  try {
    await reorderHandler(req, res)
    assert.equal(res.statusCode, 403)
    assert.deepEqual(res.jsonBody, { error: 'forbidden' })
  } finally {
    ;(prisma.profile.findUnique as any) = originalProfileFindUnique
    ;(prisma.link.findMany as any) = originalLinkFindMany
  }
})

test('PROFILE link blocks cookie-auth write when CSRF origin is missing', async () => {
  const token = signToken({ userId: 'user_test_1' })
  const req = createMockReq({
    method: 'POST',
    body: { title: 'X', url: 'https://example.com' },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
    },
  })
  const res = createMockRes()

  await linkHandler(req, res)

  assert.equal(res.statusCode, 403)
  assert.deepEqual(res.jsonBody, { error: 'csrf_origin_missing' })
})

test('PROFILE link validates title before DB write', async () => {
  const token = signToken({ userId: 'user_test_1' })
  const req = createMockReq({
    method: 'POST',
    body: { title: '', url: 'https://example.com' },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  await linkHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.jsonBody, { error: 'title_required' })
})

test('PROFILE link creates with icon and imageUrl', async () => {
  const token = signToken({ userId: 'user_link_icon_1' })
  const originalProfileFindUnique = prisma.profile.findUnique
  const originalLinkCreate = prisma.link.create

  ;(prisma.profile.findUnique as any) = async () => ({ id: 'profile_link_icon_1', userId: 'user_link_icon_1' })
  ;(prisma.link.create as any) = async ({ data }: any) => ({ id: 'link_icon_1', ...data })

  const req = createMockReq({
    method: 'POST',
    body: {
      title: 'Docs',
      url: 'https://example.com/docs',
      icon: 'DOC',
      imageUrl: 'https://example.com/icon.png',
    },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  try {
    await linkHandler(req, res)
    assert.equal(res.statusCode, 200)
    assert.equal((res.jsonBody as any).icon, 'DOC')
    assert.equal((res.jsonBody as any).imageUrl, 'https://example.com/icon.png')
  } finally {
    ;(prisma.profile.findUnique as any) = originalProfileFindUnique
    ;(prisma.link.create as any) = originalLinkCreate
  }
})

test('PROFILE link normalizes contact link values by type', async () => {
  const token = signToken({ userId: 'user_link_contact_1' })
  const originalProfileFindUnique = prisma.profile.findUnique
  const originalLinkCreate = prisma.link.create
  const createdLinks: Array<{ type: string; url: string }> = []

  ;(prisma.profile.findUnique as any) = async () => ({ id: 'profile_link_contact_1', userId: 'user_link_contact_1' })
  ;(prisma.link.create as any) = async ({ data }: any) => {
    createdLinks.push({ type: data.type, url: data.url })
    return { id: 'link_contact_1', ...data }
  }

  const cases = [
    { type: 'email', input: 'user@example.com', expected: 'mailto:user@example.com' },
    { type: 'tel', input: '+1 555 123 4567', expected: 'tel:+1 555 123 4567' },
    { type: 'sms', input: '+15551234567', expected: 'sms:+15551234567' },
    { type: 'imessage', input: '+15551234567', expected: 'imessage:+15551234567' },
  ]

  try {
    for (const testCase of cases) {
      const req = createMockReq({
        method: 'POST',
        body: {
          title: 'Contact Link',
          url: testCase.input,
          type: testCase.type,
        },
        headers: {
          cookie: `token=${token}`,
          host: 'localhost:3000',
          origin: 'http://localhost:3000',
        },
      })
      const res = createMockRes()

      await linkHandler(req, res)
      assert.equal(res.statusCode, 200)
      assert.equal((res.jsonBody as any).url, testCase.expected)
    }
  } finally {
    ;(prisma.profile.findUnique as any) = originalProfileFindUnique
    ;(prisma.link.create as any) = originalLinkCreate
  }

  assert.deepEqual(createdLinks, [
    { type: 'email', url: 'mailto:user@example.com' },
    { type: 'tel', url: 'tel:+1 555 123 4567' },
    { type: 'sms', url: 'sms:+15551234567' },
    { type: 'imessage', url: 'imessage:+15551234567' },
  ])
})

test('PROFILE link rejects invalid imageUrl format', async () => {
  const token = signToken({ userId: 'user_link_icon_2' })
  const originalProfileFindUnique = prisma.profile.findUnique
  ;(prisma.profile.findUnique as any) = async () => ({ id: 'profile_link_icon_2', userId: 'user_link_icon_2' })

  const req = createMockReq({
    method: 'POST',
    body: {
      title: 'Docs',
      url: 'https://example.com/docs',
      imageUrl: 'ftp://example.com/image.png',
    },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  try {
    await linkHandler(req, res)
    assert.equal(res.statusCode, 400)
    assert.deepEqual(res.jsonBody, { error: 'image_url_invalid' })
  } finally {
    ;(prisma.profile.findUnique as any) = originalProfileFindUnique
  }
})

test('PROFILE link auto-creates a fallback profile when none exists yet', async () => {
  const token = signToken({ userId: 'user_link_create_1' })
  const originalProfileFindUnique = prisma.profile.findUnique
  const originalProfileCreate = prisma.profile.create
  const originalLinkCreate = prisma.link.create

  let createArgs: any = null
  ;(prisma.profile.findUnique as any) = async () => null
  ;(prisma.profile.create as any) = async (args: any) => {
    createArgs = args
    return { id: 'profile_link_create_1', ...args.data }
  }
  ;(prisma.link.create as any) = async ({ data }: any) => ({ id: 'link_create_1', ...data })

  const req = createMockReq({
    method: 'POST',
    body: {
      title: 'Docs',
      url: 'https://example.com/docs',
    },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  try {
    await linkHandler(req, res)
    assert.equal(res.statusCode, 200)
    assert.equal((res.jsonBody as any).profileId, 'profile_link_create_1')
    assert.deepEqual(createArgs.data, { userId: 'user_link_create_1', slug: 'user_link_create_1', accountStatus: 'active' })
  } finally {
    ;(prisma.profile.findUnique as any) = originalProfileFindUnique
    ;(prisma.profile.create as any) = originalProfileCreate
    ;(prisma.link.create as any) = originalLinkCreate
  }
})

test('PROFILE link rejects invalid link type', async () => {
  const token = signToken({ userId: 'user_link_create_2' })
  const originalProfileFindUnique = prisma.profile.findUnique
  ;(prisma.profile.findUnique as any) = async () => ({ id: 'profile_link_create_2', userId: 'user_link_create_2' })

  const req = createMockReq({
    method: 'POST',
    body: {
      title: 'Bad Type',
      url: 'https://example.com/bad-type',
      type: 'unsupported',
    },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  try {
    await linkHandler(req, res)
    assert.equal(res.statusCode, 400)
    assert.deepEqual(res.jsonBody, { error: 'link_type_invalid' })
  } finally {
    ;(prisma.profile.findUnique as any) = originalProfileFindUnique
  }
})

test('PROFILE link rejects unexpected music provider for non-music type', async () => {
  const token = signToken({ userId: 'user_link_create_3' })
  const originalProfileFindUnique = prisma.profile.findUnique
  ;(prisma.profile.findUnique as any) = async () => ({ id: 'profile_link_create_3', userId: 'user_link_create_3' })

  const req = createMockReq({
    method: 'POST',
    body: {
      title: 'URL With Provider',
      url: 'https://example.com/url-provider',
      type: 'url',
      musicProvider: 'spotify',
    },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  try {
    await linkHandler(req, res)
    assert.equal(res.statusCode, 400)
    assert.deepEqual(res.jsonBody, { error: 'music_provider_unexpected' })
  } finally {
    ;(prisma.profile.findUnique as any) = originalProfileFindUnique
  }
})

test('PROFILE link creates hidden flag when requested', async () => {
  const token = signToken({ userId: 'user_link_hidden_1' })
  const originalProfileFindUnique = prisma.profile.findUnique
  const originalLinkCreate = prisma.link.create

  ;(prisma.profile.findUnique as any) = async () => ({ id: 'profile_link_hidden_1', userId: 'user_link_hidden_1' })
  ;(prisma.link.create as any) = async ({ data }: any) => ({ id: 'link_hidden_1', ...data })

  const req = createMockReq({
    method: 'POST',
    body: {
      title: 'Hidden Link',
      url: 'https://example.com/hidden',
      hidden: true,
    },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  try {
    await linkHandler(req, res)
    assert.equal(res.statusCode, 200)
    assert.equal((res.jsonBody as any).hidden, true)
  } finally {
    ;(prisma.profile.findUnique as any) = originalProfileFindUnique
    ;(prisma.link.create as any) = originalLinkCreate
  }
})

test('PROFILE link creates music link with provider', async () => {
  const token = signToken({ userId: 'user_link_music_1' })
  const originalProfileFindUnique = prisma.profile.findUnique
  const originalLinkCreate = prisma.link.create

  ;(prisma.profile.findUnique as any) = async () => ({ id: 'profile_link_music_1', userId: 'user_link_music_1' })
  ;(prisma.link.create as any) = async ({ data }: any) => ({ id: 'link_music_1', ...data })

  const req = createMockReq({
    method: 'POST',
    body: {
      title: 'My Playlist',
      url: 'https://open.spotify.com/track/123',
      type: 'music',
      musicProvider: 'spotify',
    },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  try {
    await linkHandler(req, res)
    assert.equal(res.statusCode, 200)
    assert.equal((res.jsonBody as any).type, 'music')
    assert.equal((res.jsonBody as any).musicProvider, 'spotify')
  } finally {
    ;(prisma.profile.findUnique as any) = originalProfileFindUnique
    ;(prisma.link.create as any) = originalLinkCreate
  }
})

test('PROFILE link rejects music link without valid provider', async () => {
  const token = signToken({ userId: 'user_link_music_2' })
  const originalProfileFindUnique = prisma.profile.findUnique
  ;(prisma.profile.findUnique as any) = async () => ({ id: 'profile_link_music_2', userId: 'user_link_music_2' })

  const req = createMockReq({
    method: 'POST',
    body: {
      title: 'Music No Provider',
      url: 'https://music.apple.com/jp/album/example',
      type: 'music',
    },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  try {
    await linkHandler(req, res)
    assert.equal(res.statusCode, 400)
    assert.deepEqual(res.jsonBody, { error: 'music_provider_invalid' })
  } finally {
    ;(prisma.profile.findUnique as any) = originalProfileFindUnique
  }
})

test('PROFILE link rejects music link with non-http url', async () => {
  const token = signToken({ userId: 'user_link_music_3' })
  const originalProfileFindUnique = prisma.profile.findUnique
  ;(prisma.profile.findUnique as any) = async () => ({ id: 'profile_link_music_3', userId: 'user_link_music_3' })

  const req = createMockReq({
    method: 'POST',
    body: {
      title: 'Music Invalid URL',
      url: 'mailto:music@example.com',
      type: 'music',
      musicProvider: 'spotify',
    },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  try {
    await linkHandler(req, res)
    assert.equal(res.statusCode, 400)
    assert.deepEqual(res.jsonBody, { error: 'music_url_invalid' })
  } finally {
    ;(prisma.profile.findUnique as any) = originalProfileFindUnique
  }
})

test('PROFILE link rejects music link when provider and url mismatch', async () => {
  const token = signToken({ userId: 'user_link_music_4' })
  const originalProfileFindUnique = prisma.profile.findUnique
  ;(prisma.profile.findUnique as any) = async () => ({ id: 'profile_link_music_4', userId: 'user_link_music_4' })

  const req = createMockReq({
    method: 'POST',
    body: {
      title: 'Music Provider Mismatch',
      url: 'https://open.spotify.com/track/abc',
      type: 'music',
      musicProvider: 'apple_music',
    },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  try {
    await linkHandler(req, res)
    assert.equal(res.statusCode, 400)
    assert.deepEqual(res.jsonBody, { error: 'music_url_provider_mismatch' })
  } finally {
    ;(prisma.profile.findUnique as any) = originalProfileFindUnique
  }
})

test('PROFILE link update preserves music type when type is omitted', async () => {
  const token = signToken({ userId: 'user_link_music_5' })
  const originalLinkFindUnique = prisma.link.findUnique
  const originalProfileFindUnique = prisma.profile.findUnique
  const originalLinkUpdate = prisma.link.update

  const existing = {
    id: 'link_music_5',
    profileId: 'profile_link_music_5',
    title: 'Original Music',
    url: 'https://open.spotify.com/track/original',
    type: 'music',
    musicProvider: 'spotify',
  }

  ;(prisma.link.findUnique as any) = async () => existing
  ;(prisma.profile.findUnique as any) = async () => ({ id: 'profile_link_music_5', userId: 'user_link_music_5' })
  ;(prisma.link.update as any) = async ({ data }: any) => ({ ...existing, ...data })

  const req = createMockReq({
    method: 'PUT',
    body: {
      id: 'link_music_5',
      title: 'Updated Music Title',
    },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  try {
    await linkHandler(req, res)
    assert.equal(res.statusCode, 200)
    assert.equal((res.jsonBody as any).type, 'music')
    assert.equal((res.jsonBody as any).musicProvider, 'spotify')
    assert.equal((res.jsonBody as any).title, 'Updated Music Title')
  } finally {
    ;(prisma.link.findUnique as any) = originalLinkFindUnique
    ;(prisma.profile.findUnique as any) = originalProfileFindUnique
    ;(prisma.link.update as any) = originalLinkUpdate
  }
})

test('PROFILE link update returns missing_id when id is absent', async () => {
  const token = signToken({ userId: 'user_link_update_1' })
  const req = createMockReq({
    method: 'PUT',
    body: { title: 'No Id' },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  await linkHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.jsonBody, { error: 'missing_id' })
})

test('PROFILE link update returns not_found when link does not exist', async () => {
  const token = signToken({ userId: 'user_link_update_2' })
  const originalLinkFindUnique = prisma.link.findUnique

  ;(prisma.link.findUnique as any) = async () => null

  const req = createMockReq({
    method: 'PUT',
    body: { id: 'link_missing_update', title: 'Missing' },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  try {
    await linkHandler(req, res)
    assert.equal(res.statusCode, 404)
    assert.deepEqual(res.jsonBody, { error: 'not_found' })
  } finally {
    ;(prisma.link.findUnique as any) = originalLinkFindUnique
  }
})

test('PROFILE link update returns forbidden for non-owned link', async () => {
  const token = signToken({ userId: 'user_link_update_3' })
  const originalLinkFindUnique = prisma.link.findUnique
  const originalProfileFindUnique = prisma.profile.findUnique

  ;(prisma.link.findUnique as any) = async () => ({
    id: 'link_update_3',
    profileId: 'profile_other_owner',
    title: 'Other Owner Link',
    url: 'https://example.com/other-owner',
    type: 'url',
    musicProvider: null,
  })
  ;(prisma.profile.findUnique as any) = async () => ({ id: 'profile_link_update_3', userId: 'user_link_update_3' })

  const req = createMockReq({
    method: 'PUT',
    body: { id: 'link_update_3', title: 'Blocked' },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  try {
    await linkHandler(req, res)
    assert.equal(res.statusCode, 403)
    assert.deepEqual(res.jsonBody, { error: 'forbidden' })
  } finally {
    ;(prisma.link.findUnique as any) = originalLinkFindUnique
    ;(prisma.profile.findUnique as any) = originalProfileFindUnique
  }
})

test('PROFILE link deletes owned link successfully', async () => {
  const token = signToken({ userId: 'user_link_delete_1' })
  const originalLinkFindUnique = prisma.link.findUnique
  const originalProfileFindUnique = prisma.profile.findUnique
  const originalLinkDelete = prisma.link.delete

  ;(prisma.link.findUnique as any) = async () => ({
    id: 'link_delete_1',
    profileId: 'profile_link_delete_1',
    title: 'Delete Me',
    url: 'https://example.com/delete-me',
  })
  ;(prisma.profile.findUnique as any) = async () => ({ id: 'profile_link_delete_1', userId: 'user_link_delete_1' })
  ;(prisma.link.delete as any) = async () => ({ id: 'link_delete_1' })

  const req = createMockReq({
    method: 'DELETE',
    body: { id: 'link_delete_1' },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  try {
    await linkHandler(req, res)
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.jsonBody, { ok: true })
  } finally {
    ;(prisma.link.findUnique as any) = originalLinkFindUnique
    ;(prisma.profile.findUnique as any) = originalProfileFindUnique
    ;(prisma.link.delete as any) = originalLinkDelete
  }
})

test('PROFILE link delete returns not_found when link does not exist', async () => {
  const token = signToken({ userId: 'user_link_delete_2' })
  const originalLinkFindUnique = prisma.link.findUnique

  ;(prisma.link.findUnique as any) = async () => null

  const req = createMockReq({
    method: 'DELETE',
    body: { id: 'link_delete_missing' },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  try {
    await linkHandler(req, res)
    assert.equal(res.statusCode, 404)
    assert.deepEqual(res.jsonBody, { error: 'not_found' })
  } finally {
    ;(prisma.link.findUnique as any) = originalLinkFindUnique
  }
})

test('PROFILE link delete returns forbidden for non-owned link', async () => {
  const token = signToken({ userId: 'user_link_delete_3' })
  const originalLinkFindUnique = prisma.link.findUnique
  const originalProfileFindUnique = prisma.profile.findUnique

  ;(prisma.link.findUnique as any) = async () => ({
    id: 'link_delete_3',
    profileId: 'profile_other_user',
    title: 'Other User Link',
    url: 'https://example.com/other',
  })
  ;(prisma.profile.findUnique as any) = async () => ({ id: 'profile_link_delete_3', userId: 'user_link_delete_3' })

  const req = createMockReq({
    method: 'DELETE',
    body: { id: 'link_delete_3' },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  try {
    await linkHandler(req, res)
    assert.equal(res.statusCode, 403)
    assert.deepEqual(res.jsonBody, { error: 'forbidden' })
  } finally {
    ;(prisma.link.findUnique as any) = originalLinkFindUnique
    ;(prisma.profile.findUnique as any) = originalProfileFindUnique
  }
})

test('PROFILE returns 405 on unsupported method', async () => {
  const req = createMockReq({
    method: 'DELETE',
    headers: { host: 'localhost:3000' },
  })
  const res = createMockRes()

  await profileHandler(req, res)

  assert.equal(res.statusCode, 405)
})

test('PROFILE GET returns unauthorized when unauthenticated', async () => {
  const req = createMockReq({
    method: 'GET',
    headers: { host: 'localhost:3000' },
  })
  const res = createMockRes()

  await profileHandler(req, res)

  assert.equal(res.statusCode, 401)
  assert.deepEqual(res.jsonBody, { error: 'unauthorized' })
})

test('PROFILE POST returns unauthorized when unauthenticated', async () => {
  const req = createMockReq({
    method: 'POST',
    body: { displayName: 'Anon' },
    headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
  })
  const res = createMockRes()

  await profileHandler(req, res)

  assert.equal(res.statusCode, 401)
  assert.deepEqual(res.jsonBody, { error: 'unauthorized' })
})

test('PROFILE POST blocks cookie-auth write when CSRF origin is missing', async () => {
  const token = signToken({ userId: 'user_profile_csrf_1' })
  const req = createMockReq({
    method: 'POST',
    body: { displayName: 'Tester' },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
    },
  })
  const res = createMockRes()

  await profileHandler(req, res)

  assert.equal(res.statusCode, 403)
  assert.deepEqual(res.jsonBody, { error: 'csrf_origin_missing' })
})

test('PROFILE update creates profile when none exists', async () => {
  const token = signToken({ userId: 'user_profile_1' })
  const originalFindUnique = prisma.profile.findUnique
  const originalCreate = prisma.profile.create

  ;(prisma.profile.findUnique as any) = async (args: any) => {
    if (args?.where?.userId === 'user_profile_1') return null
    return null
  }
  ;(prisma.profile.create as any) = async ({ data }: any) => ({ id: 'profile_1', ...data })

  const req = createMockReq({
    method: 'POST',
    body: { displayName: 'Tester', slug: 'tester_slug' },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  try {
    await profileHandler(req, res)
    assert.equal(res.statusCode, 200)
    assert.equal((res.jsonBody as any).userId, 'user_profile_1')
    assert.equal((res.jsonBody as any).displayName, 'Tester')
  } finally {
    ;(prisma.profile.findUnique as any) = originalFindUnique
    ;(prisma.profile.create as any) = originalCreate
  }
})

test('PROFILE update rejects invalid account status', async () => {
  const token = signToken({ userId: 'user_profile_invalid_status' })
  const req = createMockReq({
    method: 'POST',
    body: { accountStatus: 'paused' },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  await profileHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.jsonBody, { error: 'account_status_invalid' })
})

test('PROFILE update rejects invalid avatar url', async () => {
  const token = signToken({ userId: 'user_profile_invalid_avatar' })
  const req = createMockReq({
    method: 'POST',
    body: { avatarUrl: 'ftp://example.com/avatar.png' },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  await profileHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.jsonBody, { error: 'avatar_url_invalid' })
})

test('PROFILE update returns slug_taken on duplicate slug conflict', async () => {
  const token = signToken({ userId: 'user_profile_slug_conflict' })
  const originalFindUnique = prisma.profile.findUnique
  const originalUpdate = prisma.profile.update

  ;(prisma.profile.findUnique as any) = async ({ where }: any) => {
    if (where?.userId === 'user_profile_slug_conflict') return { id: 'profile_slug_conflict', userId: 'user_profile_slug_conflict' }
    return null
  }
  ;(prisma.profile.update as any) = async () => {
    const error: any = new Error('Unique constraint failed')
    error.code = 'P2002'
    error.meta = { target: ['slug'] }
    throw error
  }

  const req = createMockReq({
    method: 'POST',
    body: { slug: 'already-used-slug' },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  try {
    await profileHandler(req, res)
    assert.equal(res.statusCode, 409)
    assert.deepEqual(res.jsonBody, { error: 'slug_taken' })
  } finally {
    ;(prisma.profile.findUnique as any) = originalFindUnique
    ;(prisma.profile.update as any) = originalUpdate
  }
})

test('PROFILE update persists blocks when provided', async () => {
  const token = signToken({ userId: 'user_profile_blocks_1' })
  const originalFindUnique = prisma.profile.findUnique
  const originalUpdate = prisma.profile.update
  const originalBlockDeleteMany = prisma.block.deleteMany
  const originalBlockCreateMany = prisma.block.createMany

  let deletedProfileId = ''
  let createdBlocks: any[] = []

  ;(prisma.profile.findUnique as any) = async ({ where }: any) => {
    if (where?.userId === 'user_profile_blocks_1') {
      return { id: 'profile_blocks_1', userId: 'user_profile_blocks_1' }
    }
    return null
  }
  ;(prisma.profile.update as any) = async ({ data }: any) => ({ id: 'profile_blocks_1', ...data })
  ;(prisma.block.deleteMany as any) = async ({ where }: any) => {
    deletedProfileId = where.profileId
    return { count: 2 }
  }
  ;(prisma.block.createMany as any) = async ({ data }: any) => {
    createdBlocks = data
    return { count: data.length }
  }

  const req = createMockReq({
    method: 'POST',
    body: {
      displayName: 'Block Owner',
      blocks: [
        { type: 'profile', content: '', order: 0 },
        { type: 'headline', content: 'Welcome', order: 1 },
        { type: 'links', content: '', order: 2 },
      ],
    },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  try {
    await profileHandler(req, res)
    assert.equal(res.statusCode, 200)
    assert.equal(deletedProfileId, 'profile_blocks_1')
    assert.equal(createdBlocks.length, 3)
    assert.equal(createdBlocks[1].type, 'headline')
    assert.equal(createdBlocks[1].content, 'Welcome')
  } finally {
    ;(prisma.profile.findUnique as any) = originalFindUnique
    ;(prisma.profile.update as any) = originalUpdate
    ;(prisma.block.deleteMany as any) = originalBlockDeleteMany
    ;(prisma.block.createMany as any) = originalBlockCreateMany
  }
})

test('PROFILE update rejects invalid block type', async () => {
  const token = signToken({ userId: 'user_profile_blocks_invalid_type' })
  const req = createMockReq({
    method: 'POST',
    body: {
      blocks: [{ type: 'unknown_block', content: 'x', order: 0 }],
    },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  await profileHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.jsonBody, { error: 'block_type_invalid' })
})

test('PROFILE update rejects invalid video block url', async () => {
  const token = signToken({ userId: 'user_profile_blocks_invalid_video' })
  const req = createMockReq({
    method: 'POST',
    body: {
      blocks: [{ type: 'video', content: 'ftp://example.com/video', order: 0 }],
    },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  await profileHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.jsonBody, { error: 'block_video_url_invalid' })
})

test('PROFILE update rejects unexpected content for profile block', async () => {
  const token = signToken({ userId: 'user_profile_blocks_profile_content' })
  const req = createMockReq({
    method: 'POST',
    body: {
      blocks: [{ type: 'profile', content: 'not-allowed', order: 0 }],
    },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  await profileHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.jsonBody, { error: 'block_content_unexpected' })
})

test('PROFILE update rejects line block content that is too long', async () => {
  const token = signToken({ userId: 'user_profile_blocks_line_too_long' })
  const req = createMockReq({
    method: 'POST',
    body: {
      blocks: [{ type: 'line', content: 'x'.repeat(201), order: 0 }],
    },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  await profileHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.jsonBody, { error: 'block_line_too_long' })
})

test('PROFILE public returns 405 on non-GET', async () => {
  const req = createMockReq({
    method: 'POST',
    query: { slug: 'someone' },
  })
  const res = createMockRes()

  await publicProfileHandler(req, res)

  assert.equal(res.statusCode, 405)
})

test('PROFILE public returns 400 when no id, userId, or slug is provided', async () => {
  const req = createMockReq({
    method: 'GET',
    query: {},
  })
  const res = createMockRes()

  await publicProfileHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.jsonBody, { error: 'id、userId または slug を指定してください' })
  assert.equal(res.headers['Cache-Control'], 'no-store')
})

test('PROFILE public returns 404 when profile is not found', async () => {
  const originalFindUnique = prisma.profile.findUnique
  ;(prisma.profile.findUnique as any) = async () => null

  const req = createMockReq({
    method: 'GET',
    query: { slug: 'missing-user' },
  })
  const res = createMockRes()

  try {
    await publicProfileHandler(req, res)
    assert.equal(res.statusCode, 404)
    assert.deepEqual(res.jsonBody, { error: 'プロフィールが見つかりません' })
    assert.equal(res.headers['Cache-Control'], 'no-store')
  } finally {
    ;(prisma.profile.findUnique as any) = originalFindUnique
  }
})

test('PROFILE public returns 404 for disabled account', async () => {
  const originalFindUnique = prisma.profile.findUnique
  ;(prisma.profile.findUnique as any) = async () => ({
    id: 'profile_disabled_1',
    userId: 'user_disabled_1',
    slug: 'hidden-user',
    accountStatus: 'disabled',
    links: [],
  })

  const req = createMockReq({
    method: 'GET',
    query: { slug: 'hidden-user' },
  })
  const res = createMockRes()

  try {
    await publicProfileHandler(req, res)
    assert.equal(res.statusCode, 404)
  } finally {
    ;(prisma.profile.findUnique as any) = originalFindUnique
  }
})

test('PROFILE public resolves by id and returns cache header on success', async () => {
  const originalFindUnique = prisma.profile.findUnique
  ;(prisma.profile.findUnique as any) = async (args: any) => ({
    id: args?.where?.id || 'profile_public_by_id_1',
    userId: 'user_public_by_id_1',
    slug: 'public-by-id',
    accountStatus: 'active',
    links: [{ id: 'l1', title: 'Visible', url: 'https://example.com/visible', hidden: false, order: 0 }],
    blocks: [],
  })

  const req = createMockReq({
    method: 'GET',
    query: { id: 'profile_public_by_id_1' },
  })
  const res = createMockRes()

  try {
    await publicProfileHandler(req, res)
    assert.equal(res.statusCode, 200)
    assert.equal((res.jsonBody as any).id, 'profile_public_by_id_1')
    assert.equal(res.headers['Cache-Control'], 's-maxage=60, stale-while-revalidate=300')
  } finally {
    ;(prisma.profile.findUnique as any) = originalFindUnique
  }
})

test('PROFILE public resolves by userId on success', async () => {
  const originalFindUnique = prisma.profile.findUnique
  ;(prisma.profile.findUnique as any) = async (args: any) => ({
    id: 'profile_public_by_user_1',
    userId: args?.where?.userId || 'user_public_by_user_1',
    slug: 'public-by-user',
    accountStatus: 'active',
    links: [{ id: 'l1', title: 'Visible', url: 'https://example.com/visible', hidden: false, order: 0 }],
    blocks: [],
  })

  const req = createMockReq({
    method: 'GET',
    query: { userId: 'user_public_by_user_1' },
  })
  const res = createMockRes()

  try {
    await publicProfileHandler(req, res)
    assert.equal(res.statusCode, 200)
    assert.equal((res.jsonBody as any).userId, 'user_public_by_user_1')
    assert.equal(Array.isArray((res.jsonBody as any).links), true)
  } finally {
    ;(prisma.profile.findUnique as any) = originalFindUnique
  }
})

test('PROFILE public hides links marked as hidden', async () => {
  const originalFindUnique = prisma.profile.findUnique
  ;(prisma.profile.findUnique as any) = async () => ({
    id: 'profile_hidden_links_1',
    userId: 'user_hidden_links_1',
    slug: 'visible-user',
    accountStatus: 'active',
    links: [
      { id: 'l1', title: 'Visible', url: 'https://example.com/visible', hidden: false, order: 0 },
      { id: 'l2', title: 'Hidden', url: 'https://example.com/hidden', hidden: true, order: 1 },
    ],
  })

  const req = createMockReq({
    method: 'GET',
    query: { slug: 'visible-user' },
  })
  const res = createMockRes()

  try {
    await publicProfileHandler(req, res)
    assert.equal(res.statusCode, 200)
    assert.equal(Array.isArray((res.jsonBody as any).links), true)
    assert.equal((res.jsonBody as any).links.length, 1)
    assert.equal((res.jsonBody as any).links[0].title, 'Visible')
  } finally {
    ;(prisma.profile.findUnique as any) = originalFindUnique
  }
})

test('PROFILE change-password returns 405 on non-POST', async () => {
  const req = createMockReq({
    method: 'GET',
    headers: { host: 'localhost:3000' },
  })
  const res = createMockRes()

  await changePasswordHandler(req, res)

  assert.equal(res.statusCode, 405)
  assert.deepEqual(res.jsonBody, { error: 'Method not allowed' })
})

test('PROFILE change-password blocks cookie-auth write when CSRF origin is missing', async () => {
  const token = signToken({ userId: 'user_pw_csrf_1' })
  const req = createMockReq({
    method: 'POST',
    body: {
      currentPassword: 'currentPass123',
      newPassword: 'nextPass123',
      confirmPassword: 'nextPass123',
    },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
    },
  })
  const res = createMockRes()

  await changePasswordHandler(req, res)

  assert.equal(res.statusCode, 403)
  assert.deepEqual(res.jsonBody, { error: 'csrf_origin_missing' })
})

test('PROFILE change-password returns 401 when unauthenticated', async () => {
  const req = createMockReq({
    method: 'POST',
    body: {
      currentPassword: 'currentPass123',
      newPassword: 'nextPass123',
      confirmPassword: 'nextPass123',
    },
    headers: {
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  await changePasswordHandler(req, res)

  assert.equal(res.statusCode, 401)
  assert.deepEqual(res.jsonBody, { error: 'Unauthorized' })
})

test('PROFILE change-password returns 401 for invalid token', async () => {
  const req = createMockReq({
    method: 'POST',
    body: {
      currentPassword: 'currentPass123',
      newPassword: 'nextPass123',
      confirmPassword: 'nextPass123',
    },
    headers: {
      cookie: 'token=invalid_token',
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  await changePasswordHandler(req, res)

  assert.equal(res.statusCode, 401)
  assert.deepEqual(res.jsonBody, { error: 'Invalid token' })
})

test('PROFILE change-password returns 401 when token payload lacks userId', async () => {
  const token = signToken({ role: 'viewer' })
  const req = createMockReq({
    method: 'POST',
    body: {
      currentPassword: 'currentPass123',
      newPassword: 'nextPass123',
      confirmPassword: 'nextPass123',
    },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  await changePasswordHandler(req, res)

  assert.equal(res.statusCode, 401)
  assert.deepEqual(res.jsonBody, { error: 'Invalid token' })
})

test('PROFILE change-password rejects missing fields', async () => {
  const token = signToken({ userId: 'user_pw_missing_1' })
  const req = createMockReq({
    method: 'POST',
    body: {
      currentPassword: 'currentPass123',
      newPassword: '',
      confirmPassword: 'nextPass123',
    },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  await changePasswordHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.jsonBody, { error: 'All fields are required' })
})

test('PROFILE change-password rejects mismatched passwords', async () => {
  const token = signToken({ userId: 'user_pw_mismatch_1' })
  const req = createMockReq({
    method: 'POST',
    body: {
      currentPassword: 'currentPass123',
      newPassword: 'nextPass123',
      confirmPassword: 'differentPass123',
    },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  await changePasswordHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.jsonBody, { error: 'Passwords do not match' })
})

test('PROFILE change-password rejects short new password', async () => {
  const token = signToken({ userId: 'user_pw_short_1' })
  const req = createMockReq({
    method: 'POST',
    body: {
      currentPassword: 'currentPass123',
      newPassword: '12345',
      confirmPassword: '12345',
    },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  await changePasswordHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.jsonBody, { error: 'Password must be at least 6 characters' })
})

test('PROFILE change-password returns user not found when account is missing', async () => {
  const token = signToken({ userId: 'user_pw_missing_user_1' })
  const originalFindUnique = prisma.user.findUnique
  ;(prisma.user.findUnique as any) = async () => null

  const req = createMockReq({
    method: 'POST',
    body: {
      currentPassword: 'currentPass123',
      newPassword: 'nextPass123',
      confirmPassword: 'nextPass123',
    },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  try {
    await changePasswordHandler(req, res)
    assert.equal(res.statusCode, 404)
    assert.deepEqual(res.jsonBody, { error: 'User not found' })
  } finally {
    ;(prisma.user.findUnique as any) = originalFindUnique
  }
})

test('PROFILE change-password rejects incorrect current password', async () => {
  const token = signToken({ userId: 'user_pw_2' })
  const originalFindUnique = prisma.user.findUnique
  const currentHash = await hashPassword('actualCurrent123')

  ;(prisma.user.findUnique as any) = async () => ({
    id: 'user_pw_2',
    password: currentHash,
  })

  const req = createMockReq({
    method: 'POST',
    body: {
      currentPassword: 'wrongCurrent123',
      newPassword: 'nextPass123',
      confirmPassword: 'nextPass123',
    },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  try {
    await changePasswordHandler(req, res)
    assert.equal(res.statusCode, 400)
    assert.deepEqual(res.jsonBody, { error: 'Current password is incorrect' })
  } finally {
    ;(prisma.user.findUnique as any) = originalFindUnique
  }
})

test('PROFILE change-password succeeds with valid current password', async () => {
  const token = signToken({ userId: 'user_pw_1' })
  const originalFindUnique = prisma.user.findUnique
  const originalUpdate = prisma.user.update
  const currentHash = await hashPassword('currentPass123')

  ;(prisma.user.findUnique as any) = async () => ({
    id: 'user_pw_1',
    password: currentHash,
  })
  ;(prisma.user.update as any) = async () => ({ id: 'user_pw_1' })

  const req = createMockReq({
    method: 'POST',
    body: {
      currentPassword: 'currentPass123',
      newPassword: 'nextPass123',
      confirmPassword: 'nextPass123',
    },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  try {
    await changePasswordHandler(req, res)
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.jsonBody, { success: true })
  } finally {
    ;(prisma.user.findUnique as any) = originalFindUnique
    ;(prisma.user.update as any) = originalUpdate
  }
})
