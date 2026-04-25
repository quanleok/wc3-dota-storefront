/// <reference types="node" />
import type { IncomingMessage, ServerResponse } from 'http'
import { buildSessionCookie, getConfiguredAdminCredentials } from '../_lib/adminAuth.js'
import { InvalidJsonBodyError, json, methodNotAllowed, readJsonBody, text } from '../_lib/http.js'

interface LoginBody {
  username: string
  password: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST'])
  }

  const credentials = getConfiguredAdminCredentials()
  if (!credentials) {
    return text(res, 501, 'ADMIN_USERNAME and ADMIN_PASSWORD must be configured.')
  }

  let body: LoginBody
  try {
    body = await readJsonBody<LoginBody>(req)
  } catch (error) {
    if (error instanceof InvalidJsonBodyError) {
      return text(res, 400, 'Invalid JSON body.')
    }

    throw error
  }

  if (!isRecord(body) || body.username !== credentials.username || body.password !== credentials.password) {
    return text(res, 401, 'Invalid admin credentials.')
  }

  return json(
    res,
    200,
    {
      authenticated: true,
      username: credentials.username,
      mode: 'live',
    },
    {
      'Set-Cookie': buildSessionCookie(credentials.username),
    },
  )
}
