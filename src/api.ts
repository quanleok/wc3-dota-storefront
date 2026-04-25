import { DEMO_ADMIN, SAMPLE_ADMIN_ORDERS, SHOP_PRODUCTS, type AdminOrder } from './shopData'

export interface CartLine {
  productId: string
  quantity: number
}

export interface CheckoutPayload {
  battleTag: string
  email: string
  region: string
  discord: string
  note: string
  items: CartLine[]
}

export interface AdminSession {
  authenticated: boolean
  username?: string
  mode: 'live' | 'demo'
}

const DEMO_MODE = import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true'
const DEMO_ADMIN_SESSION_KEY = 'wc3dotashop-demo-admin-session'
const DEMO_ORDER_KEY = 'wc3dotashop-demo-orders'

function productNameFromId(productId: string): string {
  return SHOP_PRODUCTS.find((product) => product.id === productId)?.name ?? productId
}

function getDemoOrders(): AdminOrder[] {
  if (typeof window === 'undefined') {
    return SAMPLE_ADMIN_ORDERS
  }

  try {
    const saved = window.localStorage.getItem(DEMO_ORDER_KEY)
    if (!saved) {
      return SAMPLE_ADMIN_ORDERS
    }

    const parsed = JSON.parse(saved) as AdminOrder[]
    return [...parsed, ...SAMPLE_ADMIN_ORDERS]
  } catch {
    return SAMPLE_ADMIN_ORDERS
  }
}

function saveDemoOrder(order: AdminOrder) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const existing = getDemoOrders().filter((entry) => !entry.id.startsWith('WC3-10'))
    window.localStorage.setItem(DEMO_ORDER_KEY, JSON.stringify([order, ...existing]))
  } catch {
    // Ignore localStorage failures and keep the UI responsive in restricted browsers.
  }
}

function getDemoAdminSession() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.sessionStorage.getItem(DEMO_ADMIN_SESSION_KEY)
  } catch {
    return null
  }
}

function setDemoAdminSession(username: string) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.setItem(DEMO_ADMIN_SESSION_KEY, username)
  } catch {
    // Restricted browsers can block sessionStorage; keep the live API path usable.
  }
}

function clearDemoAdminSession() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.removeItem(DEMO_ADMIN_SESSION_KEY)
  } catch {
    // Ignore blocked sessionStorage in privacy-restricted contexts.
  }
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T
  return payload
}

export async function createCheckout(payload: CheckoutPayload) {
  try {
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(errorBody || 'Checkout request failed.')
    }

    return await readJsonResponse<{ mode: 'live'; url: string }>(response)
  } catch (error) {
    if (!DEMO_MODE) {
      throw error
    }

    const subtotal = payload.items.reduce((sum, item) => {
      const product = SHOP_PRODUCTS.find((entry) => entry.id === item.productId)
      return sum + (product?.priceGold ?? 0) * item.quantity
    }, 0)

    saveDemoOrder({
      id: `DEMO-${Date.now()}`,
      battleTag: payload.battleTag,
      email: payload.email,
      region: payload.region,
      source: 'demo',
      status: 'manual-review',
      createdAt: new Date().toISOString(),
      items: payload.items.map((item) => productNameFromId(item.productId)),
      amountGold: subtotal,
      note: payload.note || 'Captured in demo checkout mode.',
    })

    return {
      mode: 'demo' as const,
      message:
        'Stripe is not configured yet. The order was captured in demo mode so you can test the full storefront flow.',
    }
  }
}

export async function getAdminSession(): Promise<AdminSession> {
  try {
    const response = await fetch('/api/admin/session', { credentials: 'include' })
    if (!response.ok) {
      throw new Error('Admin session unavailable.')
    }

    return await readJsonResponse<AdminSession>(response)
  } catch {
    if (!DEMO_MODE || typeof window === 'undefined') {
      return { authenticated: false, mode: 'live' }
    }

    const saved = getDemoAdminSession()
    if (!saved) {
      return { authenticated: false, mode: 'demo' }
    }

    return { authenticated: true, username: saved, mode: 'demo' }
  }
}

export async function loginAdmin(username: string, password: string): Promise<AdminSession> {
  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(errorBody || 'Admin login failed.')
    }

    return await readJsonResponse<AdminSession>(response)
  } catch {
    if (!DEMO_MODE || typeof window === 'undefined') {
      throw new Error('Admin API is not configured.')
    }

    if (username !== DEMO_ADMIN.username || password !== DEMO_ADMIN.password) {
      throw new Error('Incorrect demo admin credentials.')
    }

    setDemoAdminSession(username)
    return { authenticated: true, username, mode: 'demo' }
  }
}

export async function logoutAdmin() {
  try {
    await fetch('/api/admin/logout', {
      method: 'POST',
      credentials: 'include',
    })
  } catch {
    // Ignore live logout failures in demo mode.
  }

  clearDemoAdminSession()
}

export async function getAdminOrders(): Promise<{ mode: 'live' | 'demo'; orders: AdminOrder[] }> {
  try {
    const response = await fetch('/api/admin/orders', { credentials: 'include' })
    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(errorBody || 'Orders request failed.')
    }

    return await readJsonResponse<{ mode: 'live' | 'demo'; orders: AdminOrder[] }>(response)
  } catch {
    if (!DEMO_MODE) {
      throw new Error('Orders API is not configured.')
    }

    return { mode: 'demo', orders: getDemoOrders() }
  }
}
