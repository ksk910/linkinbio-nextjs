import { useEffect, useState } from 'react'
import { GetServerSideProps } from 'next'
import { verifyToken } from '../../lib/auth'
import { useTranslations } from 'next-intl'
import { getMessages } from '../../lib/i18n'
import FileUpload from '../../components/FileUpload'

export default function ProfileEdit() {
  const t = useTranslations('profileEdit')
  const [displayName, setDisplayName] = useState('')
  const [slug, setSlug] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [userId, setUserId] = useState('')
  const [slugStatus, setSlugStatus] = useState<'idle' | 'validating' | 'available' | 'taken' | 'invalid'>('idle')
  const [slugError, setSlugError] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const slugCheckTimeout = { current: null as NodeJS.Timeout | null }

  useEffect(() => {
    async function fetchProfile() {
      const res = await fetch('/api/profile')
      if (res.ok) {
        const data = await res.json()
        if (data) {
          setDisplayName(data.displayName || '')
          setSlug(data.slug || '')
          setBio(data.bio || '')
          setAvatarUrl(data.avatarUrl || '')
          setUserId(data.userId || '')
        }
      }
      setLoading(false)
    }
    fetchProfile()
  }, [])

  useEffect(() => {
    if (slugCheckTimeout.current) clearTimeout(slugCheckTimeout.current)
    
    if (!slug.trim()) {
      setSlugStatus('idle')
      return
    }

    // クライアント側バリデーション
    if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
      setSlugStatus('invalid')
      setSlugError(t('slugInvalid'))
      return
    }

    if (slug.length < 3) {
      setSlugStatus('invalid')
      setSlugError(t('slugTooShort'))
      return
    }

    if (slug.length > 30) {
      setSlugStatus('invalid')
      setSlugError(t('slugTooLong'))
      return
    }

    setSlugStatus('validating')
    slugCheckTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/profile/check-slug', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, excludeUserId: userId })
        })
        const data = await res.json()
        if (data.available) {
          setSlugStatus('available')
          setSlugError('')
        } else {
          setSlugStatus('taken')
          setSlugError(data.error || t('slugTaken'))
        }
      } catch (err) {
        setSlugStatus('invalid')
        setSlugError('Error checking slug')
      }
    }, 500)

    return () => {
      if (slugCheckTimeout.current) clearTimeout(slugCheckTimeout.current)
    }
  }, [slug, userId, t])

  async function save(e: any) {
    e.preventDefault()
    if (slugStatus !== 'available' && slug !== slug) {
      alert('Please check your profile URL')
      return
    }
    if (avatarUrl && !avatarUrl.startsWith('http')) {
      alert(t('invalidUrl'))
      return
    }
    const res = await fetch('/api/profile', { 
      method: 'POST', 
      body: JSON.stringify({ displayName, slug, bio, avatarUrl }) 
    })
    if (res.ok) alert(t('saved'))
    else alert(t('saveFailed'))
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert(t('selectImage'))
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert(t('fileSizeLimit'))
      return
    }

    setUploading(true)
    try {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64 = reader.result as string
        const res = await fetch('/api/upload/avatar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64 }),
        })

        if (res.ok) {
          const data = await res.json()
          setAvatarUrl(data.url)
          alert(t('uploadSuccess'))
        } else {
          alert(t('uploadFailed'))
        }
        setUploading(false)
      }
      reader.readAsDataURL(file)
    } catch (err) {
      alert(t('uploadError'))
      setUploading(false)
    }
  }

  async function changePassword(e: any) {
    e.preventDefault()
    setPasswordError('')
    setPasswordMessage('')

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError(t('allFieldsRequired'))
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t('passwordsDoNotMatch'))
      return
    }

    if (newPassword.length < 6) {
      setPasswordError(t('passwordMinLength'))
      return
    }

    setPasswordLoading(true)
    try {
      const res = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
      })

      if (res.ok) {
        setPasswordMessage(t('passwordChanged'))
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        const data = await res.json()
        setPasswordError(data.error || t('changePasswordFailed'))
      }
    } catch (err) {
      setPasswordError(t('changePasswordError'))
    } finally {
      setPasswordLoading(false)
    }
  }

  if (loading) return <div className="p-6">{t('loading')}</div>

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>
      
      {/* プロフィール編集セクション */}
      <form onSubmit={save} className="space-y-3 mb-8 pb-8 border-b">
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t('displayName')} className="input" />
        
        <div className="space-y-2">
          <label className="block text-sm font-medium">{t('slug')}</label>
          <p className="text-xs text-gray-500">{t('slugDescription')}</p>
          <div className="flex items-center gap-2">
            <input 
              value={slug} 
              onChange={(e) => setSlug(e.target.value)} 
              placeholder={t('slugPlaceholder')} 
              className="input flex-1" 
            />
            <div className="w-6 h-6 flex items-center justify-center text-lg">
              {slugStatus === 'validating' && '⏳'}
              {slugStatus === 'available' && '✅'}
              {slugStatus === 'taken' && '❌'}
              {slugStatus === 'invalid' && '⚠️'}
            </div>
          </div>
          {slugError && <p className="text-xs text-red-600">{slugError}</p>}
          {slugStatus === 'available' && <p className="text-xs text-green-600">{t('slugAvailable')}</p>}
        </div>

        <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder={t('bio')} className="input" />
        
        <div className="space-y-2">
          <label className="block text-sm font-medium">{t('avatar')}</label>
          <FileUpload onChange={handleImageUpload} disabled={uploading} />
          <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder={t('avatarUrl')} className="input" />
        </div>

        <div className="flex gap-2">
          <button className="btn">{t('save')}</button>
        </div>
      </form>

      {/* パスワード変更セクション */}
      <div>
        <h2 className="text-xl font-bold mb-4">{t('changePassword')}</h2>
        <form onSubmit={changePassword} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t('currentPassword')}</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={t('passwordPlaceholder')}
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('newPassword')}</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('passwordPlaceholder')}
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('confirmPassword')}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('passwordPlaceholder')}
              className="input"
            />
          </div>

          {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
          {passwordMessage && <p className="text-sm text-green-600">{passwordMessage}</p>}

          <button type="submit" disabled={passwordLoading} className="btn">
            {passwordLoading ? t('changing') : t('changePassword')}
          </button>
        </form>
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const cookie = ctx.req.headers.cookie || ''
  const m = cookie.match(/token=([^;]+)/)
  const token = m ? m[1] : null
  const data = token ? (verifyToken(token) as any) : null
  if (!data?.userId) {
    return { redirect: { destination: '/login', permanent: false } }
  }
  return { 
    props: {
      messages: await getMessages(ctx.locale || 'ja')
    }
  }
}
