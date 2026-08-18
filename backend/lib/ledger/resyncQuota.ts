import { findWaitlistByEmail, upsertWaitlistJoin } from '../admin/store.js'
import { parseWaitlistMeta } from '../waitlist/public.js'

export const RESYNC_LIMIT = 2
export const RESYNC_WINDOW_DAYS = 15

export type LedgerResyncQuota = {
  used: number
  remaining: number
  limit: number
  windowDays: number
  nextAvailableAt: string | null
  allowed: boolean
}

function windowMs() {
  return RESYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000
}

function recentAts(raw: unknown, now = Date.now()): string[] {
  const list = Array.isArray(raw) ? raw : []
  return list
    .map((v) => String(v || ''))
    .filter((iso) => {
      const t = new Date(iso).getTime()
      return Number.isFinite(t) && now - t <= windowMs()
    })
    .sort()
}

export function quotaFromAts(ats: string[], now = Date.now()): LedgerResyncQuota {
  const used = ats.length
  const remaining = Math.max(0, RESYNC_LIMIT - used)
  const oldest = ats[0]
  const nextAvailableAt =
    remaining === 0 && oldest
      ? new Date(new Date(oldest).getTime() + windowMs()).toISOString()
      : null
  return {
    used,
    remaining,
    limit: RESYNC_LIMIT,
    windowDays: RESYNC_WINDOW_DAYS,
    nextAvailableAt,
    allowed: remaining > 0,
  }
}

export async function getLedgerResyncQuota(email: string): Promise<LedgerResyncQuota> {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) return quotaFromAts([])
  const row = await findWaitlistByEmail(normalized)
  const meta = row ? parseWaitlistMeta(row) : {}
  return quotaFromAts(recentAts(meta.ledgerResyncAts))
}

export async function consumeLedgerResync(email: string): Promise<LedgerResyncQuota> {
  const normalized = String(email || '').trim().toLowerCase()
  const nowIso = new Date().toISOString()
  const row = normalized ? await findWaitlistByEmail(normalized) : null
  const meta = row ? parseWaitlistMeta(row) : {}
  const current = recentAts(meta.ledgerResyncAts)
  const preview = quotaFromAts(current)
  if (!normalized || !preview.allowed) return preview

  const nextAts = [...current, nowIso]
  await upsertWaitlistJoin({
    email: normalized,
    meta: {
      ...meta,
      ledgerResyncAts: nextAts,
      lastLedgerResyncAt: nowIso,
    },
  })
  return quotaFromAts(nextAts)
}
