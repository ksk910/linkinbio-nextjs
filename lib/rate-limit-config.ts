type RateLimitSetting = {
  limit: number
  windowMs: number
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback
  const value = Number.parseInt(raw, 10)
  if (!Number.isFinite(value) || value <= 0) return fallback
  return value
}

function setting(limitEnv: string, limitFallback: number, windowEnv: string, windowFallback: number): RateLimitSetting {
  return {
    limit: parsePositiveInt(process.env[limitEnv], limitFallback),
    windowMs: parsePositiveInt(process.env[windowEnv], windowFallback),
  }
}

export const authRateLimits = {
  signupIp: setting('AUTH_SIGNUP_RATE_LIMIT', 10, 'AUTH_SIGNUP_RATE_WINDOW_MS', 60_000),
  loginIp: setting('AUTH_LOGIN_RATE_LIMIT', 20, 'AUTH_LOGIN_RATE_WINDOW_MS', 60_000),
  verifyEmailIp: setting('AUTH_VERIFY_EMAIL_RATE_LIMIT', 20, 'AUTH_VERIFY_EMAIL_RATE_WINDOW_MS', 60_000),
  resendVerificationIp: setting(
    'AUTH_RESEND_VERIFICATION_IP_RATE_LIMIT',
    10,
    'AUTH_RESEND_VERIFICATION_IP_RATE_WINDOW_MS',
    60_000,
  ),
  resendVerificationEmail: setting(
    'AUTH_RESEND_VERIFICATION_EMAIL_RATE_LIMIT',
    5,
    'AUTH_RESEND_VERIFICATION_EMAIL_RATE_WINDOW_MS',
    10 * 60 * 1000,
  ),
  requestPasswordResetIp: setting(
    'AUTH_REQUEST_PASSWORD_RESET_IP_RATE_LIMIT',
    10,
    'AUTH_REQUEST_PASSWORD_RESET_IP_RATE_WINDOW_MS',
    60_000,
  ),
  requestPasswordResetEmail: setting(
    'AUTH_REQUEST_PASSWORD_RESET_EMAIL_RATE_LIMIT',
    5,
    'AUTH_REQUEST_PASSWORD_RESET_EMAIL_RATE_WINDOW_MS',
    10 * 60 * 1000,
  ),
  resetPasswordIp: setting('AUTH_RESET_PASSWORD_RATE_LIMIT', 15, 'AUTH_RESET_PASSWORD_RATE_WINDOW_MS', 60_000),
  oauthStartIp: setting('AUTH_OAUTH_START_RATE_LIMIT', 20, 'AUTH_OAUTH_START_RATE_WINDOW_MS', 60_000),
  oauthCallbackIp: setting('AUTH_OAUTH_CALLBACK_RATE_LIMIT', 20, 'AUTH_OAUTH_CALLBACK_RATE_WINDOW_MS', 60_000),
}
