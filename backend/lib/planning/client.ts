import { getAuthAccessToken } from '@shared/auth'
import type { PlanningOverview, PlanningTransaction, PlanningInbox, PlanningManualEntry } from './types'

interface Envelope<T> {
  data: T | null
  status: number
  error?: string
  details?: string
  timestamp?: string
}

async function planningFetch<T>(
  path: string,
  userId: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Envelope<T>> {
  const { timeoutMs = 12_000, ...rest } = init || {}
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const token = getAuthAccessToken()
    const res = await fetch(path, {
      ...rest,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(rest.headers || {}),
      },
    })
    let json: any = null
    try {
      json = await res.json()
    } catch {
      return {
        data: null,
        status: res.status || 502,
        error: res.ok ? 'Invalid planning response' : `Planning API error (${res.status})`,
      }
    }
    if (!res.ok) {
      return {
        data: null,
        status: res.status,
        error: json?.error || `Planning API error (${res.status})`,
        details: json?.details,
        timestamp: json?.timestamp,
      }
    }
    return json as Envelope<T>
  } catch {
    return { data: null, status: 503, error: 'Planning API unreachable' }
  } finally {
    clearTimeout(timer)
  }
}

export const PLANNING_UPDATED_EVENT = 'yureka-planning-updated'

export function emitPlanningUpdated() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(PLANNING_UPDATED_EVENT))
}

export function onPlanningUpdated(handler: () => void) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(PLANNING_UPDATED_EVENT, handler)
  return () => window.removeEventListener(PLANNING_UPDATED_EVENT, handler)
}

export const planningApi = {
  overview: (userId: string, month?: string) =>
    planningFetch<PlanningOverview>(
      `/api/v1/planning${month ? `?month=${encodeURIComponent(month)}` : ''}`,
      userId,
    ),
  saveBudgets: (
    userId: string,
    budgets: { category: string; monthlyLimitInr: number }[],
    month?: string,
  ) =>
    planningFetch<PlanningOverview>('/api/v1/planning/budgets', userId, {
      method: 'PUT',
      body: JSON.stringify({ budgets, month }),
    }),
  extraTransactions: (userId: string) =>
    planningFetch<{ transactions: PlanningTransaction[] }>('/api/v1/planning/transactions', userId),
  addEntry: (
    userId: string,
    body: { merchant: string; amountInr: number; category: string; date: string; note?: string; month?: string },
  ) =>
    planningFetch<PlanningOverview & { entry: PlanningManualEntry }>('/api/v1/planning/entries', userId, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  patchEntry: (
    userId: string,
    id: string,
    body: Partial<{ merchant: string; amountInr: number; category: string; date: string; note: string; month: string }>,
  ) =>
    planningFetch<PlanningOverview & { entry: PlanningManualEntry }>(
      `/api/v1/planning/entries/${encodeURIComponent(id)}`,
      userId,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  removeEntry: (userId: string, id: string, month?: string) =>
    planningFetch<PlanningOverview & { removed: boolean; entry: PlanningManualEntry }>(
      `/api/v1/planning/entries/${encodeURIComponent(id)}${month ? `?month=${encodeURIComponent(month)}` : ''}`,
      userId,
      { method: 'DELETE' },
    ),
  saveOverride: (
    userId: string,
    body: { dedupeHash: string; category: string; needsReview?: boolean; month?: string },
  ) =>
    planningFetch<PlanningOverview>('/api/v1/planning/overrides', userId, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  connectInbox: (userId: string, accessToken: string, primaryEmail?: string) =>
    planningFetch<{ inbox: PlanningInbox; created: boolean }>(
      '/api/v1/planning/inboxes/connect',
      userId,
      {
        method: 'POST',
        body: JSON.stringify({ accessToken, primaryEmail }),
      },
    ),
  scanInbox: (userId: string, inboxId: string, accessToken: string) =>
    planningFetch<{ inbox: PlanningInbox; transactions: PlanningTransaction[]; count: number }>(
      `/api/v1/planning/inboxes/${encodeURIComponent(inboxId)}/scan`,
      userId,
      {
        method: 'POST',
        body: JSON.stringify({ accessToken }),
        timeoutMs: 200_000,
      },
    ),
  removeInbox: (userId: string, inboxId: string) =>
    planningFetch<{ removed: boolean; inbox: PlanningInbox }>(
      `/api/v1/planning/inboxes/${encodeURIComponent(inboxId)}`,
      userId,
      { method: 'DELETE' },
    ),
}
