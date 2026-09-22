import assert from 'node:assert/strict'
import test from 'node:test'
import callbackHandler from '../../pages/api/auth/oauth/google/callback'
import { prisma } from '../../lib/prisma'
import { createMockReq, createMockRes } from './helpers'

function setCookieValues(res: ReturnType<typeof createMockRes>): string[] {
  const raw = res.headers['Set-Cookie'] as unknown
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') return [raw]
  return []
}

function mockGoogleFetch(userInfo: Record<string, unknown>) {
  return (async (url: string) => {
    if (url.includes('oauth2.googleapis.com/token')) {
      return {
        ok: true,
        json: async () => ({ access_token: 'mock_access_token' }),
      } as Response
    }
    if (url.includes('googleapis.com/oauth2/v3/userinfo')) {
      return {
        ok: true,
        json: async () => userInfo,
      } as Response
    }
    throw new Error(`Unexpected fetch call: ${url}`)
  }) as typeof fetch
}

test('AUTH oauth google callback redirects to oauth_failed on state mismatch', async () => {
  const req = createMockReq({
    method: 'GET',
    query: { code: 'code_1', state: 'state_from_google' },
    headers: { cookie: 'oauth_google=state_from_cookie:verifier_1', 'x-forwarded-for': '198.51.120.1' },
  })
  const res = createMockRes()

  await callbackHandler(req, res)

  assert.equal(res.statusCode, 302)
  assert.equal(res.headers.Location, '/login?error=oauth_failed')
})

test('AUTH oauth google callback redirects to oauth_failed when state cookie is missing', async () => {
  const req = createMockReq({
    method: 'GET',
    query: { code: 'code_1', state: 'state_1' },
    headers: { 'x-forwarded-for': '198.51.120.2' },
  })
  const res = createMockRes()

  await callbackHandler(req, res)

  assert.equal(res.statusCode, 302)
  assert.equal(res.headers.Location, '/login?error=oauth_failed')
})

test('AUTH oauth google callback redirects to oauth_email_unverified when Google email is unverified', async () => {
  process.env.GOOGLE_CLIENT_ID = 'test_client_id'
  process.env.GOOGLE_CLIENT_SECRET = 'test_client_secret'
  const originalFetch = global.fetch
  global.fetch = mockGoogleFetch({ sub: 'google_sub_unverified', email: 'unverified@example.com', email_verified: false })

  const req = createMockReq({
    method: 'GET',
    query: { code: 'code_1', state: 'state_1' },
    headers: { cookie: 'oauth_google=state_1:verifier_1', 'x-forwarded-for': '198.51.120.3' },
  })
  const res = createMockRes()

  try {
    await callbackHandler(req, res)
    assert.equal(res.statusCode, 302)
    assert.equal(res.headers.Location, '/login?error=oauth_email_unverified')
  } finally {
    global.fetch = originalFetch
  }
})

test('AUTH oauth google callback creates a new user for a first-time verified Google sign-in', async () => {
  process.env.GOOGLE_CLIENT_ID = 'test_client_id'
  process.env.GOOGLE_CLIENT_SECRET = 'test_client_secret'
  const originalFetch = global.fetch
  const originalOAuthFindUnique = prisma.oAuthAccount.findUnique
  const originalUserFindUnique = prisma.user.findUnique
  const originalUserCreate = prisma.user.create

  global.fetch = mockGoogleFetch({ sub: 'google_sub_new', email: 'new-google-user@example.com', email_verified: true })
  ;(prisma.oAuthAccount.findUnique as any) = async () => null
  ;(prisma.user.findUnique as any) = async () => null
  let createArgs: any = null
  ;(prisma.user.create as any) = async (args: any) => {
    createArgs = args
    return { id: 'user_new_google_1', email: 'new-google-user@example.com' }
  }

  const req = createMockReq({
    method: 'GET',
    query: { code: 'code_1', state: 'state_1' },
    headers: { cookie: 'oauth_google=state_1:verifier_1', 'x-forwarded-for': '198.51.120.4' },
  })
  const res = createMockRes()

  try {
    await callbackHandler(req, res)

    assert.equal(res.statusCode, 302)
    assert.equal(res.headers.Location, '/profile/links')
    assert.equal(createArgs.data.email, 'new-google-user@example.com')
    assert.equal(createArgs.data.password, null)
    assert.equal(createArgs.data.oauthAccounts.create.providerAccountId, 'google_sub_new')
    assert.ok(setCookieValues(res).some((c) => c.startsWith('token=')))
  } finally {
    global.fetch = originalFetch
    ;(prisma.oAuthAccount.findUnique as any) = originalOAuthFindUnique
    ;(prisma.user.findUnique as any) = originalUserFindUnique
    ;(prisma.user.create as any) = originalUserCreate
  }
})

test('AUTH oauth google callback auto-links to an existing user with a verified matching email', async () => {
  process.env.GOOGLE_CLIENT_ID = 'test_client_id'
  process.env.GOOGLE_CLIENT_SECRET = 'test_client_secret'
  const originalFetch = global.fetch
  const originalOAuthFindUnique = prisma.oAuthAccount.findUnique
  const originalOAuthCreate = prisma.oAuthAccount.create
  const originalUserFindUnique = prisma.user.findUnique
  const originalUserCreate = prisma.user.create

  global.fetch = mockGoogleFetch({ sub: 'google_sub_link', email: 'existing@example.com', email_verified: true })
  ;(prisma.oAuthAccount.findUnique as any) = async () => null
  ;(prisma.user.findUnique as any) = async () => ({ id: 'user_existing_1', email: 'existing@example.com' })
  let linkArgs: any = null
  ;(prisma.oAuthAccount.create as any) = async (args: any) => {
    linkArgs = args
    return { id: 'oauth_account_1', ...args.data }
  }
  let userCreateCalled = false
  ;(prisma.user.create as any) = async () => {
    userCreateCalled = true
    throw new Error('should not create a new user when auto-linking')
  }

  const req = createMockReq({
    method: 'GET',
    query: { code: 'code_1', state: 'state_1' },
    headers: { cookie: 'oauth_google=state_1:verifier_1', 'x-forwarded-for': '198.51.120.5' },
  })
  const res = createMockRes()

  try {
    await callbackHandler(req, res)

    assert.equal(res.statusCode, 302)
    assert.equal(res.headers.Location, '/profile/links')
    assert.equal(userCreateCalled, false)
    assert.equal(linkArgs.data.userId, 'user_existing_1')
    assert.equal(linkArgs.data.providerAccountId, 'google_sub_link')
  } finally {
    global.fetch = originalFetch
    ;(prisma.oAuthAccount.findUnique as any) = originalOAuthFindUnique
    ;(prisma.oAuthAccount.create as any) = originalOAuthCreate
    ;(prisma.user.findUnique as any) = originalUserFindUnique
    ;(prisma.user.create as any) = originalUserCreate
  }
})

test('AUTH oauth google callback logs in an existing linked account without creating duplicates', async () => {
  process.env.GOOGLE_CLIENT_ID = 'test_client_id'
  process.env.GOOGLE_CLIENT_SECRET = 'test_client_secret'
  const originalFetch = global.fetch
  const originalOAuthFindUnique = prisma.oAuthAccount.findUnique
  const originalUserCreate = prisma.user.create

  global.fetch = mockGoogleFetch({ sub: 'google_sub_returning', email: 'returning@example.com', email_verified: true })
  ;(prisma.oAuthAccount.findUnique as any) = async () => ({
    id: 'oauth_account_returning',
    provider: 'google',
    providerAccountId: 'google_sub_returning',
    userId: 'user_returning_1',
  })
  let userCreateCalled = false
  ;(prisma.user.create as any) = async () => {
    userCreateCalled = true
    throw new Error('should not create a new user for a returning linked account')
  }

  const req = createMockReq({
    method: 'GET',
    query: { code: 'code_1', state: 'state_1' },
    headers: { cookie: 'oauth_google=state_1:verifier_1', 'x-forwarded-for': '198.51.120.6' },
  })
  const res = createMockRes()

  try {
    await callbackHandler(req, res)

    assert.equal(res.statusCode, 302)
    assert.equal(res.headers.Location, '/profile/links')
    assert.equal(userCreateCalled, false)
  } finally {
    global.fetch = originalFetch
    ;(prisma.oAuthAccount.findUnique as any) = originalOAuthFindUnique
    ;(prisma.user.create as any) = originalUserCreate
  }
})
