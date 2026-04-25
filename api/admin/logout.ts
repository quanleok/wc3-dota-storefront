/// <reference types="node" />
import type { IncomingMessage, ServerResponse } from 'http'
import { clearSessionCookie } from '../_lib/adminAuth.js'
import { json, methodNotAllowed } from '../_lib/http.js'

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST'])
  }

  return json(
    res,
    200,
    { authenticated: false, mode: 'live' },
    { 'Set-Cookie': clearSessionCookie() },
  )
}
