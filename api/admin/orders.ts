/// <reference types="node" />
import type { IncomingMessage, ServerResponse } from 'http'
import { getSessionFromRequest } from '../_lib/adminAuth.js'
import { json, methodNotAllowed, text } from '../_lib/http.js'
import { SAMPLE_ADMIN_ORDERS } from '../../src/shopData.js'

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET'])
  }

  const session = getSessionFromRequest(req)
  if (!session) {
    return text(res, 401, 'Admin session required.')
  }

  const remoteUrl = process.env.BOT_ORDERS_API_URL
  const remoteToken = process.env.BOT_ORDERS_API_TOKEN

  if (!remoteUrl) {
    return json(res, 200, { mode: 'demo', orders: SAMPLE_ADMIN_ORDERS })
  }

  try {
    const response = await fetch(remoteUrl, {
      headers: remoteToken ? { Authorization: `Bearer ${remoteToken}` } : undefined,
    })

    if (!response.ok) {
      const payload = await response.text()
      return text(res, 502, payload || 'Partner order API failed.')
    }

    const payload = (await response.json()) as unknown
    return json(res, 200, {
      mode: 'live',
      orders: payload,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Partner order API failed.'
    return text(res, 502, message)
  }
}
