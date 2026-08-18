/**
 * In-memory + sessionStorage cache for dashboard data.
 * Survives React remounts when switching tabs; TTL drives background revalidate.
 */

type Entry<T> = { data: T; at: number }

const memory = new Map<string, Entry<unknown>>()

const DEFAULT_TTL_MS = 5 * 60 * 1000

function storageKey(key: string) {
  return `yureka-cache:${key}`
}

export function cacheGet<T>(key: string, ttlMs = DEFAULT_TTL_MS): { data: T; stale: boolean } | null {
  const now = Date.now()
  const mem = memory.get(key) as Entry<T> | undefined
  if (mem) {
    return { data: mem.data, stale: now - mem.at >= ttlMs }
  }
  try {
    const raw = sessionStorage.getItem(storageKey(key))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Entry<T>
    if (!parsed?.data || typeof parsed.at !== 'number') return null
    memory.set(key, parsed)
    return { data: parsed.data, stale: now - parsed.at >= ttlMs }
  } catch {
    return null
  }
}

export function cacheSet<T>(key: string, data: T) {
  const entry: Entry<T> = { data, at: Date.now() }
  memory.set(key, entry)
  try {
    sessionStorage.setItem(storageKey(key), JSON.stringify(entry))
  } catch {
    /* quota / private mode */
  }
}

export function cacheInvalidate(prefix?: string) {
  if (!prefix) {
    memory.clear()
    return
  }
  for (const k of [...memory.keys()]) {
    if (k.startsWith(prefix)) memory.delete(k)
  }
  try {
    const remove: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (k?.startsWith(storageKey(prefix))) remove.push(k)
    }
    remove.forEach((k) => sessionStorage.removeItem(k))
  } catch {
    /* ignore */
  }
}

export const CACHE_TTL = {
  offersMarketplace: 5 * 60 * 1000,
  offersGoldback: 5 * 60 * 1000,
  goldbackHome: 2 * 60 * 1000,
  giftcards: 10 * 60 * 1000,
  myCards: 5 * 60 * 1000,
  authStatus: 12 * 60 * 60 * 1000,
} as const

export const AUTH_STATUS_KEY = 'auth:last-status'
export const AUTH_EMAIL_KEY = 'auth:last-email'

const RESOLVED_STATUSES = new Set(['accepted', 'admin', 'pending', 'on-hold', 'rejected', 'none'])

export function getLastAuthStatus(): string | null {
  const hit = cacheGet<string>(AUTH_STATUS_KEY, CACHE_TTL.authStatus)
  if (hit?.data && RESOLVED_STATUSES.has(hit.data)) return hit.data
  return null
}

export function getLastAuthEmail(): string | null {
  const hit = cacheGet<string>(AUTH_EMAIL_KEY, CACHE_TTL.authStatus)
  return hit?.data || null
}

export function persistAuthSnapshot(email: string | null, status: string) {
  cacheSet(AUTH_STATUS_KEY, status)
  if (email) cacheSet(AUTH_EMAIL_KEY, email.toLowerCase())
}
