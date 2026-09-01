import crypto from 'node:crypto'

const AVATAR_OBJECT_PREFIX = 'avatars/'

export function buildAvatarObjectKey(userId: string, mimeType: string) {
  const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'webp'
  const randomSuffix = crypto.randomBytes(8).toString('hex')
  return `${AVATAR_OBJECT_PREFIX}${userId}/${Date.now()}-${randomSuffix}.${extension}`
}
