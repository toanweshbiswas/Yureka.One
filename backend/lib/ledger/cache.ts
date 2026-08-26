import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { filterMarketingTransactions } from './marketingFilter.js'
import { mergeLedgerTransactions } from './merge.js'
import type { ScanResult } from './types.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

export type LedgerStoreRecord = ScanResult & {
  scannedAt?: string
  gmail?: string
  userId?: string
}

export type LedgerReadParams = {
  userId?: string | null
  authEmail?: string | null
  gmail?: string | null
}

export type LedgerWriteParams = {
  userId: string
  authEmail?: string | null
  result: ScanResult
}

function safeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._@+-]/g, '_')
    .slice(0, 180)
}

function normalizeEmail(email: string | null | undefined): string {
  return String(email || '').trim().toLowerCase()
}

function gmailFromResult(result: ScanResult, fallback?: string | null): string {
  const fromProfile = normalizeEmail(String((result.profile as any)?.email || ''))
  if (fromProfile.includes('@')) return fromProfile
  const fb = normalizeEmail(fallback)
  if (fb.includes('@')) return fb
  return ''
}

function getSupabase(): SupabaseClient | null {
  if ((process.env.LEDGER_STORE || process.env.PLANNING_STORE || '').toLowerCase() === 'file') {
    return null
  }
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    ''
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

function isMissingSchemaError(message: string | undefined) {
  const text = String(message || '').toLowerCase()
  return (
    text.includes('could not find the table') ||
    text.includes('schema cache') ||
    text.includes('does not exist')
  )
}

/** Resolve stable storage user id (Supabase auth UUID preferred). */
export async function resolveLedgerUserId(opts: {
  userId?: string | null
  authEmail?: string | null
  gmailEmail?: string | null
}): Promise<string | null> {
  const direct = String(opts.userId || '').trim()
  if (direct && direct !== 'demo-user') return direct

  const emails = [opts.authEmail, opts.gmailEmail]
    .map(normalizeEmail)
    .filter((e) => e.includes('@'))

  for (const email of emails) {
    try {
      const { findWaitlistByEmail } = await import('../admin/store.js')
      const row = await findWaitlistByEmail(email)
      if (row?.id) return String(row.id)
    } catch {
      // ignore
    }
  }

  const fallbackEmail = emails[0]
  if (fallbackEmail) return `email:${safeKey(fallbackEmail)}`
  return null
}

export function ledgerUserFilePath(userId: string, gmail: string) {
  return path.join(
    ROOT,
    'data',
    'financial_cache',
    'users',
    safeKey(userId),
    `${safeKey(gmail)}.json`,
  )
}

/** Legacy email-keyed file from pre–Phase-1 deploys. */
export function legacyEmailFilePath(email: string) {
  return path.join(ROOT, 'data', 'financial_cache', `${safeKey(email)}.json`)
}

async function readUserFile(userId: string, gmail: string): Promise<LedgerStoreRecord | null> {
  try {
    const raw = await fsp.readFile(ledgerUserFilePath(userId, gmail), 'utf-8')
    return JSON.parse(raw) as LedgerStoreRecord
  } catch {
    return null
  }
}

async function writeUserFile(userId: string, gmail: string, record: LedgerStoreRecord): Promise<void> {
  const target = ledgerUserFilePath(userId, gmail)
  await fsp.mkdir(path.dirname(target), { recursive: true })
  await fsp.writeFile(target, JSON.stringify(record, null, 2))
}

async function readLegacyEmailFile(email: string): Promise<LedgerStoreRecord | null> {
  try {
    const raw = await fsp.readFile(legacyEmailFilePath(email), 'utf-8')
    const data = JSON.parse(raw) as LedgerStoreRecord
    const cachedEmail = normalizeEmail(String((data.profile as any)?.email || ''))
    const wanted = normalizeEmail(email)
    if (cachedEmail && wanted && cachedEmail !== wanted) return null
    return data
  } catch {
    return null
  }
}

async function readSupabaseRow(
  userId: string,
  gmail: string,
): Promise<LedgerStoreRecord | null> {
  const sb = getSupabase()
  if (!sb) return null
  try {
    const { data, error } = await sb
      .from('financial_ledger_cache')
      .select('user_id, gmail, scanned_at, profile, transactions, score')
      .eq('user_id', userId)
      .eq('gmail', gmail)
      .maybeSingle()
    if (error || !data) {
      if (error && !isMissingSchemaError(error.message)) {
        console.warn('[ledger-cache] read failed:', error.message)
      }
      return null
    }
    return {
      userId: String(data.user_id),
      gmail: String(data.gmail),
      scannedAt: data.scanned_at ? String(data.scanned_at) : undefined,
      profile: (data.profile as Record<string, unknown>) || {},
      transactions: filterMarketingTransactions(data.transactions as Array<Record<string, unknown>>),
      score: (data.score as ScanResult['score']) || undefined,
    }
  } catch (e: any) {
    console.warn('[ledger-cache] read error:', e?.message || e)
    return null
  }
}

async function readLatestSupabaseForUser(userId: string): Promise<LedgerStoreRecord | null> {
  const sb = getSupabase()
  if (!sb) return null
  try {
    const { data, error } = await sb
      .from('financial_ledger_cache')
      .select('user_id, gmail, scanned_at, profile, transactions, score')
      .eq('user_id', userId)
      .order('scanned_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error || !data) return null
    return {
      userId: String(data.user_id),
      gmail: String(data.gmail),
      scannedAt: data.scanned_at ? String(data.scanned_at) : undefined,
      profile: (data.profile as Record<string, unknown>) || {},
      transactions: filterMarketingTransactions(data.transactions as Array<Record<string, unknown>>),
      score: (data.score as ScanResult['score']) || undefined,
    }
  } catch {
    return null
  }
}

async function writeSupabaseRow(record: LedgerStoreRecord): Promise<void> {
  const sb = getSupabase()
  if (!sb || !record.userId || !record.gmail) return
  try {
    const { error } = await sb.from('financial_ledger_cache').upsert(
      {
        user_id: record.userId,
        gmail: record.gmail,
        scanned_at: record.scannedAt || new Date().toISOString(),
        profile: record.profile || {},
        transactions: record.transactions || [],
        score: record.score ?? null,
        scan_version: 1,
      },
      { onConflict: 'user_id,gmail' },
    )
    if (error && !isMissingSchemaError(error.message)) {
      console.warn('[ledger-cache] write failed:', error.message)
    }
  } catch (e: any) {
    console.warn('[ledger-cache] write error:', e?.message || e)
  }
}

function normalizeRecord(record: LedgerStoreRecord | null): LedgerStoreRecord {
  if (!record) return { profile: {}, transactions: [] }
  return {
    ...record,
    transactions: filterMarketingTransactions(record.transactions),
  }
}

async function loadFromAllSources(params: LedgerReadParams): Promise<LedgerStoreRecord> {
  const authEmail = normalizeEmail(params.authEmail)
  const gmail = normalizeEmail(params.gmail) || authEmail
  const userId =
    (await resolveLedgerUserId({
      userId: params.userId,
      authEmail,
      gmailEmail: gmail,
    })) || null

  const candidates: LedgerStoreRecord[] = []

  if (userId && gmail) {
    const sb = await readSupabaseRow(userId, gmail)
    if (sb) candidates.push(sb)
    const file = await readUserFile(userId, gmail)
    if (file) candidates.push(file)
  }

  if (authEmail) {
    try {
      const { findWaitlistByEmail } = await import('../admin/store.js')
      const waitlist = await findWaitlistByEmail(authEmail)
      const waitlistId = waitlist?.id ? String(waitlist.id) : ''
      if (waitlistId && waitlistId !== userId && gmail) {
        const sb = await readSupabaseRow(waitlistId, gmail)
        if (sb) candidates.push(sb)
        const file = await readUserFile(waitlistId, gmail)
        if (file) candidates.push(file)
      }
    } catch {
      // ignore
    }
  }

  if (userId && !gmail) {
    const latest = await readLatestSupabaseForUser(userId)
    if (latest) candidates.push(latest)
  }

  // Legacy paths: email-keyed files (auth email and gmail profile email may differ).
  for (const email of [authEmail, gmail].filter(Boolean)) {
    const legacy = await readLegacyEmailFile(email)
    if (legacy) candidates.push({ ...legacy, gmail: legacy.gmail || email })
  }

  if (!candidates.length) return { profile: {}, transactions: [] }

  // Pick freshest snapshot by scannedAt, then largest txn count.
  candidates.sort((a, b) => {
    const ta = Date.parse(String(a.scannedAt || '')) || 0
    const tb = Date.parse(String(b.scannedAt || '')) || 0
    if (tb !== ta) return tb - ta
    return (b.transactions?.length || 0) - (a.transactions?.length || 0)
  })

  const best = normalizeRecord(candidates[0])
  return {
    ...best,
    userId: userId || best.userId,
    gmail: best.gmail || gmail || authEmail || undefined,
  }
}

export async function readLedgerCache(params: LedgerReadParams | string | null | undefined): Promise<LedgerStoreRecord> {
  if (params != null && typeof params === 'object') {
    return loadFromAllSources(params)
  }
  const authEmail = typeof params === 'string' ? params : null
  return loadFromAllSources({ authEmail })
}

export async function writeLedgerCache(
  params: LedgerWriteParams | string | null | undefined,
  legacyResult?: ScanResult,
): Promise<LedgerStoreRecord> {
  if (params != null && typeof params === 'object') {
    const { userId, authEmail, result } = params
    const gmail = gmailFromResult(result, authEmail)
    if (!gmail) {
      throw new Error('Cannot persist ledger cache without a Gmail address on the scan profile')
    }

    const existing = await loadFromAllSources({ userId, authEmail, gmail })
    const incoming = filterMarketingTransactions(result.transactions) as Array<Record<string, unknown>>
    const mergedTxs = mergeLedgerTransactions(
      (existing.transactions || []) as Array<Record<string, unknown>>,
      incoming,
      gmail,
    )

    const record: LedgerStoreRecord = {
      userId,
      gmail,
      scannedAt: new Date().toISOString(),
      profile: { ...(existing.profile || {}), ...(result.profile || {}), email: gmail },
      transactions: mergedTxs,
      score: result.score ?? existing.score,
    }

    await writeUserFile(userId, gmail, record)
    await writeSupabaseRow(record)

    const auth = normalizeEmail(authEmail)
    if (auth) {
      try {
        const { findWaitlistByEmail } = await import('../admin/store.js')
        const waitlist = await findWaitlistByEmail(auth)
        const waitlistId = waitlist?.id ? String(waitlist.id) : ''
        if (waitlistId && waitlistId !== userId) {
          const mirror: LedgerStoreRecord = { ...record, userId: waitlistId }
          await writeUserFile(waitlistId, gmail, mirror)
          await writeSupabaseRow(mirror)
        }
      } catch {
        // ignore
      }
    }

    if (auth && auth !== gmail && !fs.existsSync(legacyEmailFilePath(auth))) {
      try {
        await fsp.mkdir(path.dirname(legacyEmailFilePath(auth)), { recursive: true })
        await fsp.writeFile(legacyEmailFilePath(auth), JSON.stringify(record, null, 2))
      } catch {
        // ignore
      }
    }

    return record
  }

  // Legacy signature: writeLedgerCache(email, result)
  const email = normalizeEmail(typeof params === 'string' ? params : '')
  const result = legacyResult || { profile: {}, transactions: [] }
  const userId =
    (await resolveLedgerUserId({ authEmail: email, gmailEmail: gmailFromResult(result, email) })) ||
    `email:${safeKey(email)}`
  return writeLedgerCache({ userId, authEmail: email, result })
}

/** @deprecated Use ledgerUserFilePath. Kept for admin tooling. */
export function ledgerCachePath(email?: string | null) {
  if (!email) return null
  return legacyEmailFilePath(email)
}
