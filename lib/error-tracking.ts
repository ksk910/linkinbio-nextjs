type ErrorTrackingEvent = {
  source: 'server' | 'client'
  message: string
  timestamp?: string
  route?: string
  requestId?: string
  stack?: string
  [key: string]: unknown
}

type TrackResult = {
  attempted: boolean
  delivered: boolean
}

const webhookUrl = process.env.ERROR_TRACKING_WEBHOOK_URL

export async function trackError(event: ErrorTrackingEvent): Promise<TrackResult> {
  if (!webhookUrl) {
    return { attempted: false, delivered: false }
  }

  try {
    const payload = {
      timestamp: event.timestamp || new Date().toISOString(),
      ...event,
    }

    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    return {
      attempted: true,
      delivered: resp.ok,
    }
  } catch {
    return { attempted: true, delivered: false }
  }
}
