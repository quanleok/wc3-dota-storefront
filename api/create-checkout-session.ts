/// <reference types="node" />
import Stripe from 'stripe'
import type { IncomingMessage, ServerResponse } from 'http'
import { SHOP_PRODUCTS, type ShopProduct } from '../src/shopData.js'
import { InvalidJsonBodyError, json, methodNotAllowed, readJsonBody, text } from './_lib/http.js'

interface CartLine {
  productId: string
  quantity: number
}

interface CheckoutBody {
  battleTag: string
  email: string
  region: string
  discord: string
  note: string
  items: CartLine[]
}

const BATTLE_TAG_PATTERN = /^[A-Za-z0-9 _.-]{3,24}#\d{3,10}$/
const MAX_CHECKOUT_LINES = 50
const STRIPE_METADATA_VALUE_LIMIT = 450

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function readStringField(source: Record<string, unknown>, key: string) {
  const value = source[key]
  return typeof value === 'string' ? value : ''
}

function resolveBaseUrl(req: IncomingMessage) {
  const configured = process.env.PUBLIC_BASE_URL
  if (configured) {
    return configured.replace(/\/$/, '')
  }

  const host = req.headers.host
  if (!host) {
    return 'http://localhost:5173'
  }

  const proto = host.includes('localhost') ? 'http' : 'https'
  return `${proto}://${host}`
}

function clampMetadataValue(value: unknown) {
  return String(value ?? '').slice(0, STRIPE_METADATA_VALUE_LIMIT)
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST'])
  }

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    return text(res, 501, 'STRIPE_SECRET_KEY is not configured.')
  }

  let body: CheckoutBody
  try {
    body = await readJsonBody<CheckoutBody>(req)
  } catch (error) {
    if (error instanceof InvalidJsonBodyError) {
      return text(res, 400, 'Invalid JSON body.')
    }

    throw error
  }

  if (!isRecord(body)) {
    return text(res, 400, 'Missing battleTag or cart items.')
  }

  const battleTag = readStringField(body, 'battleTag').trim()
  const email = readStringField(body, 'email').trim()
  const region = readStringField(body, 'region').trim()
  const discord = readStringField(body, 'discord').trim()
  const note = readStringField(body, 'note').trim()
  const items = body.items

  if (!BATTLE_TAG_PATTERN.test(battleTag) || !Array.isArray(items) || items.length === 0) {
    return text(res, 400, 'Missing battleTag or cart items.')
  }

  if (items.length > MAX_CHECKOUT_LINES) {
    return text(res, 400, `Cart has too many line items. Limit is ${MAX_CHECKOUT_LINES}.`)
  }

  const stripe = new Stripe(secretKey)

  const requestedItems = new Map<string, { product: ShopProduct; stripePriceEnvKey: string; quantity: number }>()

  for (const item of items) {
    if (!isRecord(item) || typeof item.productId !== 'string') {
      return text(res, 400, 'Cart contains an invalid line item.')
    }

    const product = SHOP_PRODUCTS.find((entry) => entry.id === item.productId)
    if (!product || product.status === 'coming-soon' || !product.stripePriceEnvKey) {
      return text(res, 400, `Unknown or non-live product: ${item.productId}`)
    }

    const quantity = Number(item.quantity)
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return text(res, 400, `Invalid quantity for ${product.name}.`)
    }

    const currentQuantity = requestedItems.get(product.id)?.quantity ?? 0
    const nextQuantity = currentQuantity + quantity
    if (nextQuantity > product.stockTotal) {
      return text(res, 400, `${product.name} has only ${product.stockTotal} available.`)
    }

    requestedItems.set(product.id, { product, stripePriceEnvKey: product.stripePriceEnvKey, quantity: nextQuantity })
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []
  for (const { stripePriceEnvKey, quantity } of requestedItems.values()) {
    const priceId = process.env[stripePriceEnvKey]
    if (!priceId) {
      return text(res, 500, `Missing Stripe price env: ${stripePriceEnvKey}`)
    }

    lineItems.push({
      price: priceId,
      quantity,
    })
  }

  const baseUrl = resolveBaseUrl(req)

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      submit_type: 'pay',
      allow_promotion_codes: true,
      line_items: lineItems,
      customer_email: email || undefined,
      success_url: `${baseUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/?checkout=cancelled`,
      metadata: {
        battleTag,
        region: clampMetadataValue(region),
        discord: clampMetadataValue(discord),
        note: clampMetadataValue(note),
        cart: Array.from(requestedItems.entries())
          .map(([productId, item]) => `${productId}:${item.quantity}`)
          .join(','),
        productType: 'wc3dotashop',
      },
    })

    if (!session.url) {
      return text(res, 500, 'Stripe did not return a checkout URL.')
    }

    return json(res, 200, { mode: 'live', url: session.url })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stripe checkout creation failed.'
    return text(res, 500, message)
  }
}
