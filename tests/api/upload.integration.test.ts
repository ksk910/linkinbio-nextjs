import assert from 'node:assert/strict'
import test from 'node:test'
import avatarUploadHandler from '../../pages/api/upload/avatar'
import { signToken } from '../../lib/auth'
import { buildAvatarObjectKey } from '../../lib/avatar-upload'
import { createMockReq, createMockRes } from './helpers'

test('UPLOAD avatar returns 405 on non-POST', async () => {
  const req = createMockReq({ method: 'GET' })
  const res = createMockRes()

  await avatarUploadHandler(req, res)

  assert.equal(res.statusCode, 405)
})

test('UPLOAD avatar returns 401 when unauthenticated', async () => {
  const req = createMockReq({
    method: 'POST',
    body: { image: 'data:image/jpeg;base64,AAAA' },
    headers: {
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  await avatarUploadHandler(req, res)

  assert.equal(res.statusCode, 401)
  assert.deepEqual(res.jsonBody, { error: 'Unauthorized' })
})

test('UPLOAD avatar blocks cookie-auth write when CSRF origin is missing', async () => {
  const token = signToken({ userId: 'user_upload_1' })
  const req = createMockReq({
    method: 'POST',
    body: { image: 'data:image/jpeg;base64,AAAA' },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
    },
  })
  const res = createMockRes()

  await avatarUploadHandler(req, res)

  assert.equal(res.statusCode, 403)
  assert.deepEqual(res.jsonBody, { error: 'csrf_origin_missing' })
})

test('UPLOAD avatar returns 400 when image is missing', async () => {
  const token = signToken({ userId: 'user_upload_2' })
  const req = createMockReq({
    method: 'POST',
    body: {},
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  await avatarUploadHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.jsonBody, { error: 'No image provided' })
})

test('UPLOAD avatar returns 400 for invalid image format', async () => {
  const token = signToken({ userId: 'user_upload_3' })
  const req = createMockReq({
    method: 'POST',
    body: { image: 'not-a-data-url' },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  await avatarUploadHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.jsonBody, { error: 'Invalid image format' })
})

test('UPLOAD avatar returns 400 for malformed base64 data', async () => {
  const token = signToken({ userId: 'user_upload_4' })
  const req = createMockReq({
    method: 'POST',
    body: { image: 'data:image/jpeg;base64,!!!' },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  await avatarUploadHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.jsonBody, { error: 'Invalid image format' })
})

test('UPLOAD avatar returns 400 for oversized payload', async () => {
  const token = signToken({ userId: 'user_upload_5' })
  const payload = Buffer.alloc(6 * 1024 * 1024, 0x41).toString('base64')
  const req = createMockReq({
    method: 'POST',
    body: { image: `data:image/jpeg;base64,${payload}` },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  await avatarUploadHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.jsonBody, { error: 'Image too large' })
})

test('UPLOAD avatar returns 400 for unsupported mime type', async () => {
  const token = signToken({ userId: 'user_upload_6' })
  const payload = Buffer.from('fake-image-content').toString('base64')
  const req = createMockReq({
    method: 'POST',
    body: { image: `data:image/svg+xml;base64,${payload}` },
    headers: {
      cookie: `token=${token}`,
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const res = createMockRes()

  await avatarUploadHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.jsonBody, { error: 'Unsupported image type' })
})

test('UPLOAD avatar uses a unique object key on repeated uploads', () => {
  const keyA = buildAvatarObjectKey('user_upload_7', 'image/png')
  const keyB = buildAvatarObjectKey('user_upload_7', 'image/png')

  assert.notEqual(keyA, keyB)
  assert.match(keyA, /^avatars\/user_upload_7\//)
  assert.match(keyB, /^avatars\/user_upload_7\//)
  assert.match(keyA, /\.png$/)
  assert.match(keyB, /\.png$/)
})