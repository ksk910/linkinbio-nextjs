import { NextApiRequest } from 'next'
import { randomUUID } from 'crypto'
import { trackError } from './error-tracking'

type LogLevel = 'info' | 'warn' | 'error'

type LogPayload = {
  level: LogLevel
  message: string
  timestamp: string
  requestId?: string
  route?: string
  method?: string
  userId?: string
  [key: string]: unknown
}

export function requestMeta(req: NextApiRequest, route: string, userId?: string) {
  const headerId = req.headers['x-request-id']
  const requestId = typeof headerId === 'string' && headerId.length > 0 ? headerId : randomUUID()
  return {
    requestId,
    route,
    method: req.method,
    userId,
  }
}

export function logInfo(message: string, data: Omit<LogPayload, 'level' | 'message' | 'timestamp'> = {}) {
  writeLog('info', message, data)
}

export function logWarn(message: string, data: Omit<LogPayload, 'level' | 'message' | 'timestamp'> = {}) {
  writeLog('warn', message, data)
}

export function logError(message: string, data: Omit<LogPayload, 'level' | 'message' | 'timestamp'> = {}) {
  writeLog('error', message, data)
}

function writeLog(level: LogLevel, message: string, data: Omit<LogPayload, 'level' | 'message' | 'timestamp'>) {
  const payload: LogPayload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...data,
  }

  const line = JSON.stringify(payload)
  if (level === 'error') {
    console.error(line)
    void trackError({
      source: 'server',
      message,
      ...data,
      timestamp: payload.timestamp,
    })
    return
  }
  if (level === 'warn') {
    console.warn(line)
    return
  }
  console.log(line)
}
