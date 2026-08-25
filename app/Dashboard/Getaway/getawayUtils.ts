declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void }
  }
}

export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.Razorpay) return Promise.resolve(true)
  return new Promise((resolve) => {
    const existing = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
    )
    if (existing) {
      if (window.Razorpay) return resolve(true)
      existing.addEventListener('load', () => resolve(Boolean(window.Razorpay)))
      existing.addEventListener('error', () => resolve(false))
      return
    }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(Boolean(window.Razorpay))
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export const GETAWAY_REF_KEY = 'yureka_ww_ref'

export function captureGetawayRef(code: string | null | undefined) {
  const c = String(code || '').trim().toUpperCase()
  if (!c) return
  try {
    localStorage.setItem(GETAWAY_REF_KEY, c)
  } catch {
    /* ignore */
  }
}

/** Pull ?ref= from the current URL, and from nested login ?next=…?ref= paths. */
export function captureGetawayRefFromSearch(search: string | null | undefined) {
  try {
    const params = new URLSearchParams(search || '')
    const direct = params.get('ref')
    if (direct) captureGetawayRef(direct)

    const next = params.get('next')
    if (!next) return
    // next is usually a path like /dashboard/getaway/slug?ref=CODE
    const qIndex = next.indexOf('?')
    if (qIndex < 0) return
    const nested = new URLSearchParams(next.slice(qIndex + 1)).get('ref')
    if (nested) captureGetawayRef(nested)
  } catch {
    /* ignore */
  }
}

export function readGetawayRef(): string | null {
  try {
    return localStorage.getItem(GETAWAY_REF_KEY)
  } catch {
    return null
  }
}

export function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0)
}
