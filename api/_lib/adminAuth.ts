/// <reference types="node" />
import { createHmac, timingSafeEqual } from 'crypto'
import type { IncomingMessage } from 'http'

const COOKIE_NAME = 'wc3dotashop_admin'
const SESSION_MAX_AGE = 60 * 60 * 12
const isProductionRuntime = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'

function base64UrlEncode(input: string): string {
  return Buffer.from(input).toString('base64url')
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8')
}

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (secret) {
    return secret
  }

  if (isProductionRuntime) {
    throw new Error('ADMIN_SESSION_SECRET must be configured.')
  }

  return 'dev-only-session-secret'
}

function sign(payload: string) {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url')
}

export function createSessionToken(username: string) {
  const payload = JSON.stringify({
    username,
    exp: Date.now() + SESSION_MAX_AGE * 1000,
  })

  const encoded = base64UrlEncode(payload)
  return `${encoded}.${sign(encoded)}`
}

export function verifySessionToken(token?: string | null) {
  if (!token) {
    return null
  }

  const [encoded, signature] = token.split('.')
  if (!encoded || !signature) {
    return null
  }

  const expected = sign(encoded)
  if (signature.length !== expected.length) {
    return null
  }

  const valid = timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  if (!valid) {
    return null
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as { username?: unknown; exp?: unknown }
    if (typeof payload.username !== 'string' || typeof payload.exp !== 'number' || payload.exp < Date.now()) {
      return null
    }

    return {
      username: payload.username,
      exp: payload.exp,
    }
  } catch {
    return null
  }
}

export function parseCookieHeader(header?: string) {
  const out: Record<string, string> = {}

  if (!header) {
    return out
  }

  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (!key) {
      continue
    }

    try {
      out[key] = decodeURIComponent(rest.join('='))
    } catch {
      out[key] = ''
    }
  }

  return out
}

export function getSessionFromRequest(req: IncomingMessage) {
  try {
    const cookies = parseCookieHeader(req.headers.cookie)
    return verifySessionToken(cookies[COOKIE_NAME])
  } catch {
    return null
  }
}

export function buildSessionCookie(username: string) {
  const token = createSessionToken(username)
  const secureFlag = isProductionRuntime ? '; Secure' : ''
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${secureFlag}`
}

export function clearSessionCookie() {
  const secureFlag = isProductionRuntime ? '; Secure' : ''
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`
}

export function getConfiguredAdminCredentials() {
  const username = process.env.ADMIN_USERNAME
  const password = process.env.ADMIN_PASSWORD

  if (!username || !password) {
    return null
  }

  return { username, password }
}
