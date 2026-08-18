import type { GoldbackBalance, GoldbackLedgerEntry, GoldbackOffer } from './types'

import { getAuthAccessToken } from '@shared/auth'

interface Envelope<T> {
  data: T | null
  status: number
  error?: string
  timestamp?: string
}

async function goldbackFetch<T>(
  path: string,
  userId: string,
  init?: RequestInit
): Promise<Envelope<T>> {
  try {
    const token = getAuthAccessToken()
    const res = await fetch(path, {
      ...init,
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
  } catch {
    return {
      data: null,
      status: 503,
      error: 'Goldback API unreachable',
      timestamp: new Date().toISOString(),
    }
  }
}

export function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

/** Stable earn key — one credit per user+offer (prevents Date.now() double credits). */
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
