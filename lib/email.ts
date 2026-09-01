import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const FROM = process.env.EMAIL_FROM ?? 'noreply@linkinbio-ruby.vercel.app'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://linkinbio-ruby.vercel.app'

export async function sendVerificationEmail(params: {
  to: string
  token: string
}): Promise<void> {
  const link = `${APP_URL}/verify-email?token=${params.token}`

  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set – skipping verification email to', params.to)
    console.warn('[email] verification link:', link)
    return
  }

  const { data, error } = await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: 'メールアドレスの確認',
    html: `
      <h2>メールアドレスの確認</h2>
      <p>下記のリンクをクリックしてメールアドレスを確認してください。</p>
      <p>このリンクは24時間有効です。</p>
      <p>
        <a href="${link}" style="
          display:inline-block;
          padding:12px 24px;
          background:#000;
          color:#fff;
          text-decoration:none;
          border-radius:6px;
          font-weight:bold;
        ">メールアドレスを確認する</a>
      </p>
      <p>ボタンが動作しない場合は以下のURLをブラウザに貼り付けてください：</p>
      <p><a href="${link}">${link}</a></p>
    `,
  })
  if (error) {
    console.error('[email] sendVerificationEmail error:', JSON.stringify(error))
    throw new Error(typeof error === 'object' && 'message' in error ? String((error as {message: string}).message) : JSON.stringify(error))
  }
  console.log('[email] sendVerificationEmail sent, id:', data?.id)
}

export async function sendPasswordResetEmail(params: {
  to: string
  token: string
}): Promise<void> {
  const link = `${APP_URL}/reset-password?token=${params.token}`

  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set – skipping password reset email to', params.to)
    console.warn('[email] reset link:', link)
    return
  }

  const { data: resetData, error: resetError } = await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: 'パスワードの再設定',
    html: `
      <h2>パスワードの再設定</h2>
      <p>下記のリンクをクリックしてパスワードを再設定してください。</p>
      <p>このリンクは1時間有効です。</p>
      <p>
        <a href="${link}" style="
          display:inline-block;
          padding:12px 24px;
          background:#000;
          color:#fff;
          text-decoration:none;
          border-radius:6px;
          font-weight:bold;
        ">パスワードを再設定する</a>
      </p>
      <p>ボタンが動作しない場合は以下のURLをブラウザに貼り付けてください：</p>
      <p><a href="${link}">${link}</a></p>
      <p>このリクエストに心当たりがない場合は、このメールを無視してください。</p>
    `,
  })
  if (resetError) {
    console.error('[email] sendPasswordResetEmail error:', JSON.stringify(resetError))
    throw new Error(typeof resetError === 'object' && 'message' in resetError ? String((resetError as {message: string}).message) : JSON.stringify(resetError))
  }
  console.log('[email] sendPasswordResetEmail sent, id:', resetData?.id)
}
