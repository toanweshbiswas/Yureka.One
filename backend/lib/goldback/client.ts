import type { GoldbackBalance, GoldbackLedgerEntry, GoldbackOffer } from './types'

import { getAuthAccessToken } from '@shared/auth'

interface Envelope<T> {
  data: T | null
  status: number
  error?: string
  timestamp?: string
}

// Match api/client.ts: relative /api on deployed hosts; never call localhost from prod.
const RAW_BASE = import.meta.env.VITE_API_BASE_URL ?? ''
const onLocalhost =
  typeof window !== 'undefined' &&
  /^(localhost|127\.|0\.0\.0\.0|\[?::1\]?)/.test(window.location.hostname)
const pointsAtLocalhost = /^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[?::1\]?)/i.test(RAW_BASE)
const BASE_URL = !onLocalhost && pointsAtLocalhost ? '' : RAW_BASE

async function goldbackFetchOnce<T>(
  path: string,
  userId: string,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Envelope<T>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const token = getAuthAccessToken()
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers || {}),
      },
    })
    let json: any = null
    try {
      json = await res.json()
    } catch {
      return {
        data: null,
        status: res.status || 502,
        error: res.ok ? 'Invalid Goldback response' : `Goldback API error (${res.status})`,
        timestamp: new Date().toISOString(),
      }
    }
    if (!res.ok) {
      return {
        data: null,
        status: res.status,
        error: json?.error || `Goldback API error (${res.status})`,
        timestamp: json?.timestamp || new Date().toISOString(),
      }
    }
    return json as Envelope<T>
  } catch (e: any) {
    const aborted = e?.name === 'AbortError'
    return {
      data: null,
      status: 503,
      error: aborted ? 'Goldback API timed out. retrying…' : 'Goldback API unreachable',
      timestamp: new Date().toISOString(),
    }
  } finally {
    clearTimeout(timer)
  }
}

async function goldbackFetch<T>(
  path: string,
  userId: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Envelope<T>> {
  const { timeoutMs = 25_000, ...rest } = init || {}
  const first = await goldbackFetchOnce<T>(path, userId, rest, timeoutMs)
  // One retry on cold-start / proxy blips (unreachable or abort).
  if (first.status === 503) {
    await new Promise((r) => setTimeout(r, 800))
    const second = await goldbackFetchOnce<T>(path, userId, rest, Math.max(timeoutMs, 35_000))
    if (second.error === 'Goldback API timed out. retrying…') {
      return { ...second, error: 'Goldback API timed out' }
    }
    return second
  }
  if (first.error === 'Goldback API timed out. retrying…') {
    return { ...first, error: 'Goldback API timed out' }
  }
  return first
}

export function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

/** Stable earn key. one credit per user+offer (prevents Date.now() double credits). */
export function goldbackEarnKey(userId: string, offerId: string) {
  return `earn:${userId}:${offerId}`
}

export const goldbackApi = {
  offers: (userId: string) => goldbackFetch<GoldbackOffer[]>('/api/goldback/offers', userId),
  balance: (userId: string) =>
    goldbackFetch<GoldbackBalance>(`/api/goldback/balance?userId=${encodeURIComponent(userId)}`, userId),
  ledger: (userId: string) =>
    goldbackFetch<GoldbackLedgerEntry[]>(`/api/goldback/ledger?userId=${encodeURIComponent(userId)}`, userId),
  click: (userId: string, offerId: string) =>
    goldbackFetch<{ recorded: boolean }>('/api/goldback/click', userId, {
      method: 'POST',
      body: JSON.stringify({ offerId, userId }),
    }),
  earn: (userId: string, offerId: string, idempotencyKey?: string) =>
    goldbackFetch<{
      entry: GoldbackLedgerEntry
      balance: GoldbackBalance
      created: boolean
    }>('/api/goldback/earn', userId, {
      method: 'POST',
      body: JSON.stringify({
        offerId,
        userId,
        idempotencyKey: idempotencyKey || goldbackEarnKey(userId, offerId),
      }),
    }),
}
