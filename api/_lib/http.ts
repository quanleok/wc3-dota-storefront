/// <reference types="node" />
import type { IncomingMessage, ServerResponse } from 'http'

export class InvalidJsonBodyError extends Error {
  constructor() {
    super('Invalid JSON body.')
    this.name = 'InvalidJsonBodyError'
  }
}

export async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  if ('body' in req && req.body && typeof req.body === 'object') {
    return req.body as T
  }

  const chunks: Uint8Array[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }

  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) {
    return {} as T
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    throw new InvalidJsonBodyError()
  }
}

export function json(res: ServerResponse, statusCode: number, payload: unknown, headers?: Record<string, string>) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value)
    }
  }

  res.end(JSON.stringify(payload))
}

export function text(res: ServerResponse, statusCode: number, message: string, headers?: Record<string, string>) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')

  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value)
    }
  }

  res.end(message)
}

export function methodNotAllowed(res: ServerResponse, allowed: string[]) {
  text(res, 405, `Method not allowed. Use ${allowed.join(', ')}.`, {
    Allow: allowed.join(', '),
  })
}
