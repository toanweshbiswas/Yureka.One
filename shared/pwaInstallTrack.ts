import { api, isApiError } from '@backend/lib/api/client'
import {
  isAndroidDevice,
  isIosDevice,
  isStandalonePwa,
} from '@shared/pwaDisplay'

const LOCAL_KEY = 'yureka-pwa-presence-v1'
const MIN_RESEND_MS = 1000 * 60 * 60 * 12 // 12h for routine standalone heartbeats

type LocalPresence = {
  firstSentAt?: string
  lastSentAt?: string
  installed?: boolean
}

function readLocal(): LocalPresence {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as LocalPresence
  } catch {
    return {}
  }
}

function writeLocal(next: LocalPresence) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

function platform(): 'ios' | 'android' | 'other' {
  if (isIosDevice()) return 'ios'
  if (isAndroidDevice()) return 'android'
  return 'other'
}

async function postPresence(opts: {
  standalone: boolean
  installed: boolean
  source: string
  userId?: string
}) {
  const headers: Record<string, string> = {}
  if (opts.userId) headers['x-user-id'] = opts.userId
  const res = await api.post<{
    recorded?: boolean
    pwaInstalled?: boolean
    pwaFirstSeenAt?: string | null
    pwaLastSeenAt?: string | null
  }>(
    '/api/pwa/presence',
    {
      standalone: opts.standalone,
      installed: opts.installed,
      source: opts.source,
      platform: platform(),
    },
    {
      headers,
      timeoutMs: 8000,
    },
  )
  if (isApiError(res)) return false
  const now = new Date().toISOString()
  const prev = readLocal()
  writeLocal({
    firstSentAt: prev.firstSentAt || now,
    lastSentAt: now,
    installed: Boolean(res.data?.pwaInstalled || opts.installed || opts.standalone || prev.installed),
  })
  return true
}

/**
 * Report installed-PWA presence for the signed-in member.
 * Safe to call often. throttles routine heartbeats; always sends on first install signal.
 */
export async function trackPwaPresence(opts: {
  userId?: string | null
  email?: string | null
  /** Force send even if recently reported (e.g. appinstalled). */
  force?: boolean
  source?: 'standalone' | 'appinstalled' | 'manual'
} = {}): Promise<boolean> {
  if (typeof window === 'undefined') return false
  const userId = String(opts.userId || opts.email || '').trim() || undefined

  const standalone = isStandalonePwa()
  const source = opts.source || (standalone ? 'standalone' : 'manual')
  const installed = standalone || source === 'appinstalled'

  if (!installed && !opts.force) return false

  const prev = readLocal()
  const last = prev.lastSentAt ? Date.parse(prev.lastSentAt) : 0
  const recently =
    Number.isFinite(last) && Date.now() - last < MIN_RESEND_MS && Boolean(prev.installed)
  if (recently && !opts.force && source !== 'appinstalled') return false

  try {
    return await postPresence({
      standalone,
      installed,
      source,
      userId,
    })
  } catch {
    return false
  }
}

/** Listen once for Chrome/Android install completion. */
export function listenForPwaInstall(userId?: string | null, email?: string | null) {
  if (typeof window === 'undefined') return () => {}
  const onInstalled = () => {
    void trackPwaPresence({ userId, email, force: true, source: 'appinstalled' })
  }
  window.addEventListener('appinstalled', onInstalled)
  return () => window.removeEventListener('appinstalled', onInstalled)
}
