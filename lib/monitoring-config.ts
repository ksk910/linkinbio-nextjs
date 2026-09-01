type AlertThresholds = {
  apiP95Ms: number
  pageLoadMs: number
  errorRatePercent: number
  healthFailures: number
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback
  const value = Number.parseInt(raw, 10)
  if (!Number.isFinite(value) || value <= 0) return fallback
  return value
}

export function getAlertThresholds(): AlertThresholds {
  return {
    apiP95Ms: parsePositiveInt(process.env.ALERT_API_P95_MS, 1500),
    pageLoadMs: parsePositiveInt(process.env.ALERT_PAGE_LOAD_MS, 4000),
    errorRatePercent: parsePositiveInt(process.env.ALERT_ERROR_RATE_PERCENT, 3),
    healthFailures: parsePositiveInt(process.env.ALERT_HEALTH_FAILURES, 2),
  }
}
