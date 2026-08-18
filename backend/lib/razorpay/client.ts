import { createHmac, timingSafeEqual } from 'crypto'

export type RazorpayOrder = {
  id: string
  amount: number
  currency: string
  status: string
  receipt?: string | null
}

export type RazorpayPayment = {
  id: string
  order_id: string
  amount: number
  currency: string
  status: string
  method?: string
  email?: string
  contact?: string
}

function razorpayKeyId(): string {
  return (
    process.env.RAZORPAY_KEY_ID ||
    process.env.RAZORPAY_LIVE_API_KEY ||
    process.env.RAZORPAY_API_KEY ||
    ''
  ).trim()
}

function razorpayKeySecret(): string {
  return (
    process.env.RAZORPAY_KEY_SECRET ||
    process.env.RAZORPAY_LIVE_KEY_SECRET ||
    process.env.RAZORPAY_SECRET ||
    ''
  ).trim()
}

export function razorpayWebhookSecret(): string {
  return (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim()
}

export function razorpayConfigured(): boolean {
  return Boolean(razorpayKeyId() && razorpayKeySecret())
}

export function publicRazorpayKeyId(): string {
  return razorpayKeyId()
}

function authHeader(): string {
  return `Basic ${Buffer.from(`${razorpayKeyId()}:${razorpayKeySecret()}`).toString('base64')}`
}

async function razorpayRequest<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
    body: body != null ? JSON.stringify(body) : undefined,
  })
  const raw = await res.text()
  let json: any = {}
  try {
    json = raw ? JSON.parse(raw) : {}
  } catch {
    throw new Error(res.ok ? 'Razorpay returned an unexpected response' : `Razorpay request failed (${res.status})`)
  }
  if (!res.ok) {
    const msg = json?.error?.description || json?.error?.reason || json?.message || `Razorpay request failed (${res.status})`
    throw new Error(typeof msg === 'string' ? msg : 'Razorpay request failed')
  }
  return json as T
}

export async function createRazorpayOrder(input: {
  amountPaise: number
  receipt: string
  notes?: Record<string, string>
}): Promise<RazorpayOrder> {
  return razorpayRequest<RazorpayOrder>('POST', '/orders', {
    amount: input.amountPaise,
    currency: 'INR',
    receipt: input.receipt.slice(0, 40),
    notes: input.notes || {},
  })
}

export async function getRazorpayPayment(paymentId: string): Promise<RazorpayPayment> {
  return razorpayRequest<RazorpayPayment>('GET', `/payments/${encodeURIComponent(paymentId)}`)
}

export function verifyRazorpayCheckoutSignature(input: {
  orderId: string
  paymentId: string
  signature: string
}): boolean {
  const secret = razorpayKeySecret()
  if (!secret || !input.orderId || !input.paymentId || !input.signature) return false
  const expected = createHmac('sha256', secret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest('hex')
  try {
    const a = Buffer.from(expected)
    const b = Buffer.from(input.signature)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function verifyRazorpayWebhookSignature(rawBody: string, signature: string | undefined): boolean {
  const secret = razorpayWebhookSecret()
  if (!secret || !signature || !rawBody) return false
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  try {
    const a = Buffer.from(expected)
    const b = Buffer.from(signature)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}
