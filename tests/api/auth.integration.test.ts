import assert from 'node:assert/strict'
import test from 'node:test'
import signupHandler from '../../pages/api/auth/signup'
import loginHandler from '../../pages/api/auth/login'
import logoutHandler from '../../pages/api/auth/logout'
import verifyEmailHandler from '../../pages/api/auth/verify-email'
import resendVerificationHandler from '../../pages/api/auth/resend-verification'
import requestPasswordResetHandler from '../../pages/api/auth/request-password-reset'
import resetPasswordHandler from '../../pages/api/auth/reset-password'
import { prisma } from '../../lib/prisma'
import { createMockReq, createMockRes } from './helpers'

test('AUTH signup returns 405 on non-POST', async () => {
  const req = createMockReq({ method: 'GET' })
  const res = createMockRes()

  await signupHandler(req, res)

  assert.equal(res.statusCode, 405)
  assert.deepEqual(res.jsonBody, { error: 'method_not_allowed' })
})

test('AUTH login returns 405 on non-POST', async () => {
  const req = createMockReq({ method: 'GET' })
  const res = createMockRes()

  await loginHandler(req, res)

  assert.equal(res.statusCode, 405)
})

test('AUTH logout returns 405 on non-POST', async () => {
  const req = createMockReq({ method: 'GET' })
  const res = createMockRes()

  await logoutHandler(req, res)

  assert.equal(res.statusCode, 405)
})

test('AUTH verify-email returns 405 on non-POST', async () => {
  const req = createMockReq({ method: 'GET' })
  const res = createMockRes()

  await verifyEmailHandler(req, res)

  assert.equal(res.statusCode, 405)
  assert.deepEqual(res.jsonBody, { error: 'method_not_allowed' })
})

test('AUTH resend-verification returns 405 on non-POST', async () => {
  const req = createMockReq({ method: 'GET' })
  const res = createMockRes()

  await resendVerificationHandler(req, res)

  assert.equal(res.statusCode, 405)
  assert.deepEqual(res.jsonBody, { error: 'method_not_allowed' })
})

test('AUTH request-password-reset returns 405 on non-POST', async () => {
  const req = createMockReq({ method: 'GET' })
  const res = createMockRes()

  await requestPasswordResetHandler(req, res)

  assert.equal(res.statusCode, 405)
  assert.deepEqual(res.jsonBody, { error: 'method_not_allowed' })
})

test('AUTH reset-password returns 405 on non-POST', async () => {
  const req = createMockReq({ method: 'GET' })
  const res = createMockRes()

  await resetPasswordHandler(req, res)

  assert.equal(res.statusCode, 405)
  assert.deepEqual(res.jsonBody, { error: 'method_not_allowed' })
})

test('AUTH signup returns 400 for invalid email', async () => {
  const req = createMockReq({
    method: 'POST',
    body: { email: 'invalid-email', password: 'password123' },
    headers: { 'x-forwarded-for': '198.51.100.1' },
  })
  const res = createMockRes()

  await signupHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.jsonBody, { error: 'email_invalid' })
})

test('AUTH signup returns 400 for invalid password', async () => {
  const req = createMockReq({
    method: 'POST',
    body: { email: 'valid@example.com', password: 'short' },
    headers: { 'x-forwarded-for': '198.51.100.4' },
  })
  const res = createMockRes()

  await signupHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.jsonBody, { error: 'password_too_short' })
})

test('AUTH signup creates user and sets cookie', async () => {
  const originalFindUnique = prisma.user.findUnique
  const originalCreate = prisma.user.create

  ;(prisma.user.findUnique as any) = async () => null
  ;(prisma.user.create as any) = async () => ({ id: 'user_test_1', email: 'a@example.com' })

  const req = createMockReq({
    method: 'POST',
    body: { email: 'a@example.com', password: 'password123' },
    headers: { 'x-forwarded-for': '198.51.100.2' },
  })
  const res = createMockRes()

  try {
    await signupHandler(req, res)
    assert.equal(res.statusCode, 200)
    assert.equal((res.jsonBody as any).ok, true)
    assert.equal(typeof (res.jsonBody as any).token, 'string')
    assert.match(res.headers['Set-Cookie'] || '', /token=/)
  } finally {
    ;(prisma.user.findUnique as any) = originalFindUnique
    ;(prisma.user.create as any) = originalCreate
  }
})

test('AUTH signup returns exists when email is already registered', async () => {
  const originalFindUnique = prisma.user.findUnique
  ;(prisma.user.findUnique as any) = async () => ({ id: 'user_exists_1', email: 'exists@example.com' })

  const req = createMockReq({
    method: 'POST',
    body: { email: 'exists@example.com', password: 'password123' },
    headers: { 'x-forwarded-for': '198.51.100.5' },
  })
  const res = createMockRes()

  try {
    await signupHandler(req, res)
    assert.equal(res.statusCode, 400)
    assert.deepEqual(res.jsonBody, { error: 'exists' })
  } finally {
    ;(prisma.user.findUnique as any) = originalFindUnique
  }
})

test('AUTH login returns invalid when user not found', async () => {
  const originalFindUnique = prisma.user.findUnique
  ;(prisma.user.findUnique as any) = async () => null

  const req = createMockReq({
    method: 'POST',
    body: { email: 'nobody@example.com', password: 'password123' },
    headers: { 'x-forwarded-for': '198.51.100.3' },
  })
  const res = createMockRes()

  try {
    await loginHandler(req, res)
    assert.equal(res.statusCode, 400)
    assert.deepEqual(res.jsonBody, { error: 'invalid' })
  } finally {
    ;(prisma.user.findUnique as any) = originalFindUnique
  }
})

test('AUTH login returns 400 for invalid email', async () => {
  const req = createMockReq({
    method: 'POST',
    body: { email: 'bad-email', password: 'password123' },
    headers: { 'x-forwarded-for': '198.51.100.31' },
  })
  const res = createMockRes()

  await loginHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.jsonBody, { error: 'email_invalid' })
})

test('AUTH login returns 400 for invalid password format', async () => {
  const req = createMockReq({
    method: 'POST',
    body: { email: 'valid@example.com', password: 'short' },
    headers: { 'x-forwarded-for': '198.51.100.32' },
  })
  const res = createMockRes()

  await loginHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.jsonBody, { error: 'password_too_short' })
})

test('AUTH login blocks unverified user', async () => {
  const originalFindUnique = prisma.user.findUnique
  ;(prisma.user.findUnique as any) = async () => ({
    id: 'user_unverified_1',
    email: 'u@example.com',
    password: 'ignored',
    emailVerifiedAt: null,
  })

  const req = createMockReq({
    method: 'POST',
    body: { email: 'u@example.com', password: 'password123' },
    headers: { 'x-forwarded-for': '198.51.100.30' },
  })
  const res = createMockRes()

  try {
    await loginHandler(req, res)
    assert.equal(res.statusCode, 403)
    assert.deepEqual(res.jsonBody, { error: 'email_not_verified' })
  } finally {
    ;(prisma.user.findUnique as any) = originalFindUnique
  }
})

test('AUTH login blocks password login for Google-only accounts', async () => {
  const originalFindUnique = prisma.user.findUnique
  ;(prisma.user.findUnique as any) = async () => ({
    id: 'user_google_only_1',
    email: 'google-only@example.com',
    password: null,
    emailVerifiedAt: new Date(),
  })

  const req = createMockReq({
    method: 'POST',
    body: { email: 'google-only@example.com', password: 'password123' },
    headers: { 'x-forwarded-for': '198.51.100.33' },
  })
  const res = createMockRes()

  try {
    await loginHandler(req, res)
    assert.equal(res.statusCode, 400)
    assert.deepEqual(res.jsonBody, { error: 'password_login_unavailable' })
  } finally {
    ;(prisma.user.findUnique as any) = originalFindUnique
  }
})

test('AUTH verify-email marks account verified with valid token', async () => {
  const originalFindFirst = (prisma.user as any).findFirst
  const originalUpdate = prisma.user.update

  ;(prisma.user as any).findFirst = async () => ({
    id: 'user_verify_1',
    emailVerificationToken: 'token_abc',
  })
  ;(prisma.user.update as any) = async () => ({ id: 'user_verify_1' })

  const req = createMockReq({
    method: 'POST',
    body: { token: 'token_abc' },
  })
  const res = createMockRes()

  try {
    await verifyEmailHandler(req, res)
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.jsonBody, { ok: true })
  } finally {
    ;(prisma.user as any).findFirst = originalFindFirst
    ;(prisma.user.update as any) = originalUpdate
  }
})

test('AUTH verify-email returns token_required when token is missing', async () => {
  const req = createMockReq({
    method: 'POST',
    body: {},
  })
  const res = createMockRes()

  await verifyEmailHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.jsonBody, { error: 'token_required' })
})

test('AUTH verify-email returns invalid_or_expired_token for unknown token', async () => {
  const originalFindFirst = (prisma.user as any).findFirst
  ;(prisma.user as any).findFirst = async () => null

  const req = createMockReq({
    method: 'POST',
    body: { token: 'missing_token' },
  })
  const res = createMockRes()

  try {
    await verifyEmailHandler(req, res)
    assert.equal(res.statusCode, 400)
    assert.deepEqual(res.jsonBody, { error: 'invalid_or_expired_token' })
  } finally {
    ;(prisma.user as any).findFirst = originalFindFirst
  }
})

test('AUTH verify-email rate limit returns 429 after threshold', async () => {
  const originalFindFirst = (prisma.user as any).findFirst
  const ip = '198.51.100.80'

  ;(prisma.user as any).findFirst = async () => null

  try {
    for (let i = 0; i < 20; i += 1) {
      const req = createMockReq({
        method: 'POST',
        body: { token: 'nope' },
        headers: { 'x-forwarded-for': ip },
      })
      const res = createMockRes()
      await verifyEmailHandler(req, res)
      assert.notEqual(res.statusCode, 429)
    }

    const blockedReq = createMockReq({
      method: 'POST',
      body: { token: 'nope' },
      headers: { 'x-forwarded-for': ip },
    })
    const blockedRes = createMockRes()
    await verifyEmailHandler(blockedReq, blockedRes)

    assert.equal(blockedRes.statusCode, 429)
    assert.deepEqual(blockedRes.jsonBody, { error: 'rate_limited' })
  } finally {
    ;(prisma.user as any).findFirst = originalFindFirst
  }
})

test('AUTH request-password-reset returns ok even when user does not exist', async () => {
  const originalFindUnique = prisma.user.findUnique
  ;(prisma.user.findUnique as any) = async () => null

  const req = createMockReq({
    method: 'POST',
    body: { email: 'unknown@example.com' },
    headers: { 'x-forwarded-for': '198.51.100.41' },
  })
  const res = createMockRes()

  try {
    await requestPasswordResetHandler(req, res)
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.jsonBody, { ok: true })
  } finally {
    ;(prisma.user.findUnique as any) = originalFindUnique
  }
})

test('AUTH resend-verification rate limit returns 429 for repeated email', async () => {
  const originalFindUnique = prisma.user.findUnique
  ;(prisma.user.findUnique as any) = async () => null

  try {
    for (let i = 0; i < 5; i += 1) {
      const req = createMockReq({
        method: 'POST',
        body: { email: 'repeat-verify@example.com' },
        headers: { 'x-forwarded-for': `198.51.110.${10 + i}` },
      })
      const res = createMockRes()
      await resendVerificationHandler(req, res)
      assert.notEqual(res.statusCode, 429)
    }

    const blockedReq = createMockReq({
      method: 'POST',
      body: { email: 'repeat-verify@example.com' },
      headers: { 'x-forwarded-for': '198.51.110.99' },
    })
    const blockedRes = createMockRes()
    await resendVerificationHandler(blockedReq, blockedRes)

    assert.equal(blockedRes.statusCode, 429)
    assert.deepEqual(blockedRes.jsonBody, { error: 'rate_limited' })
  } finally {
    ;(prisma.user.findUnique as any) = originalFindUnique
  }
})

test('AUTH resend-verification returns 400 for invalid email', async () => {
  const req = createMockReq({
    method: 'POST',
    body: { email: 'bad-email' },
    headers: { 'x-forwarded-for': '198.51.110.55' },
  })
  const res = createMockRes()

  await resendVerificationHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.jsonBody, { error: 'email_invalid' })
})

test('AUTH resend-verification returns alreadyVerified for verified user', async () => {
  const originalFindUnique = prisma.user.findUnique
  ;(prisma.user.findUnique as any) = async () => ({ id: 'user_verified_1', emailVerifiedAt: new Date() })

  const req = createMockReq({
    method: 'POST',
    body: { email: 'verified@example.com' },
    headers: { 'x-forwarded-for': '198.51.110.56' },
  })
  const res = createMockRes()

  try {
    await resendVerificationHandler(req, res)
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.jsonBody, { ok: true, alreadyVerified: true })
  } finally {
    ;(prisma.user.findUnique as any) = originalFindUnique
  }
})

test('AUTH request-password-reset sets token for existing user', async () => {
  const originalFindUnique = prisma.user.findUnique
  const originalUpdate = prisma.user.update

  ;(prisma.user.findUnique as any) = async () => ({ id: 'user_reset_1' })
  ;(prisma.user.update as any) = async () => ({ id: 'user_reset_1' })

  const req = createMockReq({
    method: 'POST',
    body: { email: 'exists@example.com' },
    headers: { 'x-forwarded-for': '198.51.100.42' },
  })
  const res = createMockRes()

  try {
    await requestPasswordResetHandler(req, res)
    assert.equal(res.statusCode, 200)
    assert.equal((res.jsonBody as any).ok, true)
    assert.equal(typeof (res.jsonBody as any).resetToken, 'string')
  } finally {
    ;(prisma.user.findUnique as any) = originalFindUnique
    ;(prisma.user.update as any) = originalUpdate
  }
})

test('AUTH request-password-reset returns 400 for invalid email', async () => {
  const req = createMockReq({
    method: 'POST',
    body: { email: 'bad-email' },
    headers: { 'x-forwarded-for': '198.51.111.55' },
  })
  const res = createMockRes()

  await requestPasswordResetHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.jsonBody, { error: 'email_invalid' })
})

test('AUTH request-password-reset rate limit returns 429 for repeated email', async () => {
  const originalFindUnique = prisma.user.findUnique
  ;(prisma.user.findUnique as any) = async () => null

  try {
    for (let i = 0; i < 5; i += 1) {
      const req = createMockReq({
        method: 'POST',
        body: { email: 'repeat-reset@example.com' },
        headers: { 'x-forwarded-for': `198.51.111.${10 + i}` },
      })
      const res = createMockRes()
      await requestPasswordResetHandler(req, res)
      assert.notEqual(res.statusCode, 429)
    }

    const blockedReq = createMockReq({
      method: 'POST',
      body: { email: 'repeat-reset@example.com' },
      headers: { 'x-forwarded-for': '198.51.111.99' },
    })
    const blockedRes = createMockRes()
    await requestPasswordResetHandler(blockedReq, blockedRes)

    assert.equal(blockedRes.statusCode, 429)
    assert.deepEqual(blockedRes.jsonBody, { error: 'rate_limited' })
  } finally {
    ;(prisma.user.findUnique as any) = originalFindUnique
  }
})

test('AUTH reset-password rejects mismatched passwords', async () => {
  const req = createMockReq({
    method: 'POST',
    body: {
      token: 'token_1',
      newPassword: 'password123',
      confirmPassword: 'different123',
    },
  })
  const res = createMockRes()

  await resetPasswordHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.jsonBody, { error: 'passwords_do_not_match' })
})

test('AUTH reset-password returns token_required when token is missing', async () => {
  const req = createMockReq({
    method: 'POST',
    body: {
      newPassword: 'password123',
      confirmPassword: 'password123',
    },
  })
  const res = createMockRes()

  await resetPasswordHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.jsonBody, { error: 'token_required' })
})

test('AUTH reset-password returns confirm_password_required when confirm password is missing', async () => {
  const req = createMockReq({
    method: 'POST',
    body: {
      token: 'token_1',
      newPassword: 'password123',
    },
  })
  const res = createMockRes()

  await resetPasswordHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.jsonBody, { error: 'confirm_password_required' })
})

test('AUTH reset-password returns invalid_or_expired_token for unknown token', async () => {
  const originalFindFirst = (prisma.user as any).findFirst
  ;(prisma.user as any).findFirst = async () => null

  const req = createMockReq({
    method: 'POST',
    body: {
      token: 'unknown_token',
      newPassword: 'password123',
      confirmPassword: 'password123',
    },
    headers: { 'x-forwarded-for': '198.51.100.82' },
  })
  const res = createMockRes()

  try {
    await resetPasswordHandler(req, res)
    assert.equal(res.statusCode, 400)
    assert.deepEqual(res.jsonBody, { error: 'invalid_or_expired_token' })
  } finally {
    ;(prisma.user as any).findFirst = originalFindFirst
  }
})

test('AUTH reset-password updates password for valid token', async () => {
  const originalFindFirst = (prisma.user as any).findFirst
  const originalUpdate = prisma.user.update

  ;(prisma.user as any).findFirst = async () => ({ id: 'user_reset_2' })
  ;(prisma.user.update as any) = async () => ({ id: 'user_reset_2' })

  const req = createMockReq({
    method: 'POST',
    body: {
      token: 'valid_token',
      newPassword: 'password123',
      confirmPassword: 'password123',
    },
  })
  const res = createMockRes()

  try {
    await resetPasswordHandler(req, res)
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.jsonBody, { ok: true })
  } finally {
    ;(prisma.user as any).findFirst = originalFindFirst
    ;(prisma.user.update as any) = originalUpdate
  }
})

test('AUTH reset-password rate limit returns 429 after threshold', async () => {
  const originalFindFirst = (prisma.user as any).findFirst
  const ip = '198.51.100.81'

  ;(prisma.user as any).findFirst = async () => null

  try {
    for (let i = 0; i < 15; i += 1) {
      const req = createMockReq({
        method: 'POST',
        body: {
          token: 'invalid',
          newPassword: 'password123',
          confirmPassword: 'password123',
        },
        headers: { 'x-forwarded-for': ip },
      })
      const res = createMockRes()
      await resetPasswordHandler(req, res)
      assert.notEqual(res.statusCode, 429)
    }

    const blockedReq = createMockReq({
      method: 'POST',
      body: {
        token: 'invalid',
        newPassword: 'password123',
        confirmPassword: 'password123',
      },
      headers: { 'x-forwarded-for': ip },
    })
    const blockedRes = createMockRes()
    await resetPasswordHandler(blockedReq, blockedRes)

    assert.equal(blockedRes.statusCode, 429)
    assert.deepEqual(blockedRes.jsonBody, { error: 'rate_limited' })
  } finally {
    ;(prisma.user as any).findFirst = originalFindFirst
  }
})

test('AUTH logout blocks CSRF when origin is missing', async () => {
  const req = createMockReq({
    method: 'POST',
    headers: { cookie: 'token=fake', host: 'localhost:3000' },
  })
  const res = createMockRes()

  await logoutHandler(req, res)

  assert.equal(res.statusCode, 403)
  assert.deepEqual(res.jsonBody, { error: 'csrf_origin_missing' })
})

test('AUTH logout clears cookie when CSRF origin is valid', async () => {
  const req = createMockReq({
    method: 'POST',
    headers: {
      cookie: 'token=fake',
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  await logoutHandler(req, res)

  assert.equal(res.statusCode, 200)
  assert.equal((res.jsonBody as any).ok, true)
  assert.match(res.headers['Set-Cookie'] || '', /Max-Age=0/)
})
