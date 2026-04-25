/// <reference types="node" />
import type { IncomingMessage, ServerResponse } from 'http'
import { getSessionFromRequest } from '../_lib/adminAuth.js'
import { json, methodNotAllowed } from '../_lib/http.js'

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET'])
  }

  const session = getSessionFromRequest(req)
  if (!session) {
    return json(res, 200, { authenticated: false, mode: 'live' })
  }

  return json(res, 200, {
    authenticated: true,
    username: session.username,
    mode: 'live',
  })
}
