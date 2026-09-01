import type { NextApiRequest, NextApiResponse } from 'next'

export type MockRes = NextApiResponse & {
  statusCode: number
  jsonBody: unknown
  headers: Record<string, string>
}

export function createMockReq(input: {
  method: string
  body?: unknown
  headers?: Record<string, string>
  query?: Record<string, string>
}): NextApiRequest {
  return {
    method: input.method,
    body: input.body,
    headers: input.headers || {},
    query: input.query || {},
  } as unknown as NextApiRequest
}

export function createMockRes(): MockRes {
  const res: {
    statusCode: number
    jsonBody: unknown
    headers: Record<string, string>
    status: (code: number) => unknown
    json: (payload: unknown) => unknown
    setHeader: (name: string, value: string) => unknown
    end: () => unknown
  } = {
    statusCode: 200,
    jsonBody: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(payload: unknown) {
      this.jsonBody = payload
      return this
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value
      return this
    },
    end() {
      return this
    },
  }

  return res as unknown as MockRes
}
