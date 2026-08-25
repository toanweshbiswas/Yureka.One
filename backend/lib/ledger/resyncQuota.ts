import fs from 'fs'
import path from 'path'
import { findWaitlistByEmail, upsertWaitlistJoin } from '../admin/store.js'
import { parseWaitlistMeta } from '../waitlist/public.js'

/** Inbox Gmail resyncs allowed per rolling window. */
export const RESYNC_LIMIT = 5
export const RESYNC_WINDOW_DAYS = 15

export type LedgerResyncQuota = {
  used: number
  remaining: number
  limit: number
  windowDays: number
  nextAvailableAt: string | null
  allowed: boolean
  /** ISO timestamps of attempts inside the current window */
  attempts?: string[]
}

function windowMs() {
  return RESYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000
}

function filePath() {
  return path.join(process.cwd(), 'data', 'ledger_resync_quota.json')
}

type FileStore = Record<string, { ats: string[]; updatedAt: string }>

function readFileStore(): FileStore {
  try {
    const p = filePath()
    if (!fs.existsSync(p)) return {}
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as FileStore
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}

function writeFileStore(store: FileStore) {
  const p = filePath()
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(store, null, 2))
}

function recentAts(raw: unknown, now = Date.now()): string[] {
  const list = Array.isArray(raw) ? raw : []
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of list) {
    const iso = String(v || '').trim()
    if (!iso || seen.has(iso)) continue
    const t = new Date(iso).getTime()
    if (!Number.isFinite(t) || now - t > windowMs()) continue
    seen.add(iso)
    out.push(iso)
  }
  return out.sort()
}

function mergeAts(...lists: unknown[]): string[] {
  return recentAts(lists.flatMap((l) => (Array.isArray(l) ? l : [])))
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
    attempts: ats,
  }
}

async function atsFromWaitlist(email: string): Promise<string[]> {
  try {
    const row = await findWaitlistByEmail(email)
    if (!row) return []
    const meta = parseWaitlistMeta(row)
    return recentAts(meta.ledgerResyncAts)
  } catch (err) {
    console.warn('[resyncQuota] waitlist read failed:', (err as Error)?.message || err)
    return []
  }
}

function atsFromFile(email: string): string[] {
  const store = readFileStore()
  return recentAts(store[email]?.ats)
}

export async function getLedgerResyncQuota(email: string): Promise<LedgerResyncQuota> {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) return quotaFromAts([])
  const ats = mergeAts(atsFromFile(normalized), await atsFromWaitlist(normalized))
  return quotaFromAts(ats)
}

export async function consumeLedgerResync(email: string): Promise<LedgerResyncQuota> {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) return quotaFromAts([])

  const nowIso = new Date().toISOString()
  const current = mergeAts(atsFromFile(normalized), await atsFromWaitlist(normalized))
  const preview = quotaFromAts(current)
  if (!preview.allowed) return preview

  const nextAts = recentAts([...current, nowIso])

  // 1) Always persist to durable file store (survives waitlist/notes write failures)
  try {
    const store = readFileStore()
    store[normalized] = { ats: nextAts, updatedAt: nowIso }
    writeFileStore(store)
  } catch (err) {
    console.error('[resyncQuota] file persist failed:', (err as Error)?.message || err)
  }

  // 2) Mirror onto waitlist notes for admin / cross-host visibility
  try {
    const row = await findWaitlistByEmail(normalized)
    const meta = row ? parseWaitlistMeta(row) : {}
    await upsertWaitlistJoin({
      email: normalized,
      fullName: row?.fullName || null,
      meta: {
        ...meta,
        ledgerResyncAts: nextAts,
        ledgerResyncUsed: nextAts.length,
        ledgerResyncLimit: RESYNC_LIMIT,
        lastLedgerResyncAt: nowIso,
      },
    })
  } catch (err) {
    console.warn('[resyncQuota] waitlist mirror failed:', (err as Error)?.message || err)
  }

  return quotaFromAts(nextAts)
}
