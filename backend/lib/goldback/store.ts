import fs from 'fs'
import path from 'path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { merchantLogoUrl } from '../media/offerImage.js'
import type {
  GoldbackBalance,
  GoldbackLedgerEntry,
  GoldbackOffer,
  GoldbackStoreSnapshot,
} from './types.js'

const SEED_OFFERS: Omit<GoldbackOffer, 'id'>[] = [
  {
    title: 'Nykaa Beauty Haul',
    merchant: 'Nykaa',
    category: 'beauty',
    description: 'Shop beauty essentials via Yureka and earn Goldback on eligible orders.',
    url: 'https://www.nykaa.com',
    rewardPaise: 2500,
    rewardLabel: '₹25 Goldback',
    active: true,
  },
  {
    title: 'Amazon Fashion',
    merchant: 'Amazon',
    category: 'shopping',
    description: 'Track your Amazon fashion spend and earn face-value Goldback.',
    url: 'https://www.amazon.in',
    rewardPaise: 5000,
    rewardLabel: '₹50 Goldback',
    active: true,
  },
  {
    title: 'Swiggy Weekend',
    merchant: 'Swiggy',
    category: 'food',
    description: 'Order food this weekend through the tracked link to earn Goldback.',
    url: 'https://www.swiggy.com',
    rewardPaise: 1500,
    rewardLabel: '₹15 Goldback',
    active: true,
  },
  {
    title: 'Myntra Style Drop',
    merchant: 'Myntra',
    category: 'fashion',
    description: 'Fashion drops with Goldback credited after confirmed conversion.',
    url: 'https://www.myntra.com',
    rewardPaise: 4000,
    rewardLabel: '₹40 Goldback',
    active: true,
  },
  {
    title: 'Flipkart Electronics',
    merchant: 'Flipkart',
    category: 'electronics',
    description: 'Electronics deals that pay Goldback you can redeem at face value later.',
    url: 'https://www.flipkart.com',
    rewardPaise: 7500,
    rewardLabel: '₹75 Goldback',
    active: true,
  },
]

/** Force file backend even if Supabase env is present (dev/debug). */
function forceFileMode() {
  return (process.env.GOLDBACK_STORE || '').toLowerCase() === 'file'
}

let supabaseSchemaUnavailable = false
/** Don't permanently stick on file mode after a transient schema miss. */
let supabaseSchemaDisabledUntil = 0
const SCHEMA_COOLDOWN_MS = 5 * 60 * 1000

function isMissingSchemaError(message: string | undefined) {
  const text = String(message || '').toLowerCase()
  return (
    text.includes('could not find the table') ||
    text.includes('schema cache') ||
    text.includes('does not exist')
  )
}

function disableGoldbackSchema(reason: unknown) {
  supabaseSchemaUnavailable = true
  supabaseSchemaDisabledUntil = Date.now() + SCHEMA_COOLDOWN_MS
  console.warn(
    '[goldback] supabase schema unavailable, using file store until cooldown ends:',
    (reason as Error)?.message || reason,
  )
}

function schemaCurrentlyDisabled() {
  if (!supabaseSchemaUnavailable) return false
  if (Date.now() >= supabaseSchemaDisabledUntil) {
    supabaseSchemaUnavailable = false
    supabaseSchemaDisabledUntil = 0
    return false
  }
  return true
}

function noteSchemaError(error: { message?: string } | null | undefined): boolean {
  if (!error?.message || !isMissingSchemaError(error.message)) return false
  disableGoldbackSchema(error)
  return true
}

function filePath() {
  return path.join(process.cwd(), 'data', 'goldback_store.json')
}

function emptySnapshot(): GoldbackStoreSnapshot {
  return {
    accounts: {},
    offers: SEED_OFFERS.map((o) => ({
      ...o,
      id: randomUUID(),
      imageUrl: o.imageUrl || merchantLogoUrl(o.merchant, o.url),
    })),
    ledger: [],
    clicks: [],
    offerSeedLocked: false,
  }
}

function readFileStore(): GoldbackStoreSnapshot {
  const p = filePath()
  try {
    if (!fs.existsSync(p)) {
      const snap = emptySnapshot()
      fs.mkdirSync(path.dirname(p), { recursive: true })
      fs.writeFileSync(p, JSON.stringify(snap, null, 2))
      return snap
    }
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as GoldbackStoreSnapshot
    if (!Array.isArray(raw.offers)) raw.offers = []
    if (!raw.offers.length && !raw.offerSeedLocked) {
      raw.offers = emptySnapshot().offers
      writeFileStore(raw)
    } else {
      raw.offers = raw.offers.map((o) => ({
        ...o,
        imageUrl: o.imageUrl || merchantLogoUrl(o.merchant, o.url),
      }))
    }
    return raw
  } catch {
    const snap = emptySnapshot()
    writeFileStore(snap)
    return snap
  }
}

function writeFileStore(snap: GoldbackStoreSnapshot) {
  fs.mkdirSync(path.dirname(filePath()), { recursive: true })
  fs.writeFileSync(filePath(), JSON.stringify(snap, null, 2))
}

function writeOfferToFile(offer: GoldbackOffer) {
  const snap = readFileStore()
  const idx = snap.offers.findIndex((o) => o.id === offer.id)
  if (idx >= 0) snap.offers[idx] = { ...snap.offers[idx], ...offer }
  else snap.offers.unshift(offer)
  writeFileStore(snap)
}

function getSupabase(): SupabaseClient | null {
  if (forceFileMode()) return null
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  // Prefer service role for writes (RLS blocks anon). Never mix file IDs into Supabase.
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    ''
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

function sbClient(): SupabaseClient | null {
  if (schemaCurrentlyDisabled()) return null
  return getSupabase()
}

function mapOffer(row: any): GoldbackOffer {
  const url = row.url || ''
  const merchant = row.merchant || ''
  return {
    id: row.id,
    title: row.title,
    merchant,
    category: row.category,
    description: row.description ?? '',
    url,
    imageUrl: row.image_url || row.imageUrl || merchantLogoUrl(merchant, url),
    rewardPaise: row.reward_paise ?? row.rewardPaise ?? 0,
    rewardLabel: row.reward_label ?? row.rewardLabel ?? '',
    active: row.active !== false,
  }
}

function mapLedger(row: any): GoldbackLedgerEntry {
  return {
    id: row.id,
    userId: row.user_id ?? row.userId,
    type: row.type,
    amountPaise: row.amount_paise ?? row.amountPaise,
    offerId: row.offer_id ?? row.offerId ?? null,
    status: row.status,
    idempotencyKey: row.idempotency_key ?? row.idempotencyKey,
    meta: row.meta ?? {},
    createdAt: row.created_at ?? row.createdAt,
  }
}

function markOfferSeedLocked() {
  const snap = readFileStore()
  if (snap.offerSeedLocked) return
  snap.offerSeedLocked = true
  writeFileStore(snap)
}

/** Seed empty Supabase offers table from SEED_OFFERS — keeps IDs in the same backend as balance. */
async function ensureSupabaseOffers(sb: SupabaseClient): Promise<GoldbackOffer[]> {
  const { data, error } = await sb.from('offers').select('*').eq('active', true).order('created_at', { ascending: false })
  if (error) {
    noteSchemaError(error)
    throw new Error(error.message)
  }
  if (data && data.length > 0) return data.map(mapOffer)
  if (readFileStore().offerSeedLocked) return []

  const rows = SEED_OFFERS.map((o) => ({
    title: o.title,
    merchant: o.merchant,
    category: o.category,
    description: o.description,
    url: o.url,
    reward_paise: o.rewardPaise,
    reward_label: o.rewardLabel,
    active: true,
  }))
  const { data: inserted, error: insertErr } = await sb.from('offers').insert(rows).select('*')
  if (insertErr) throw new Error(`Failed to seed offers: ${insertErr.message}`)
  return (inserted || []).map(mapOffer)
}

function creditInFile(
  userId: string,
  offer: GoldbackOffer,
  idempotencyKey: string
): { entry: GoldbackLedgerEntry; balance: GoldbackBalance; created: boolean } {
  const snap = readFileStore()
  // Ensure offer exists in file store when earning against file-backed IDs
  if (!snap.offers.some((o) => o.id === offer.id)) {
    snap.offers.unshift(offer)
  }
  const existing = snap.ledger.find((e) => e.userId === userId && e.idempotencyKey === idempotencyKey)
  if (existing) {
    const balance = snap.accounts[userId] ?? { userId, balancePaise: 0, updatedAt: new Date().toISOString() }
    return { entry: existing, balance, created: false }
  }
  // Also block duplicate earn for same offer (stable product rule)
  const already = snap.ledger.find(
    (e) => e.userId === userId && e.offerId === offer.id && e.type === 'earn' && e.status === 'earned'
  )
  if (already) {
    const balance = snap.accounts[userId] ?? { userId, balancePaise: 0, updatedAt: new Date().toISOString() }
    return { entry: already, balance, created: false }
  }

  const entry: GoldbackLedgerEntry = {
    id: randomUUID(),
    userId,
    type: 'earn',
    amountPaise: offer.rewardPaise,
    offerId: offer.id,
    status: 'earned',
    idempotencyKey,
    meta: { merchant: offer.merchant, title: offer.title },
    createdAt: new Date().toISOString(),
  }
  const prev = snap.accounts[userId]?.balancePaise ?? 0
  const balance: GoldbackBalance = {
    userId,
    balancePaise: prev + offer.rewardPaise,
    updatedAt: new Date().toISOString(),
  }
  snap.ledger.unshift(entry)
  snap.accounts[userId] = balance
  writeFileStore(snap)
  return { entry, balance, created: true }
}

export async function listOffers(): Promise<GoldbackOffer[]> {
  const sb = sbClient()
  if (sb) {
    try {
      return await ensureSupabaseOffers(sb)
    } catch (e: any) {
      noteSchemaError(e)
      console.warn('[goldback] offers via supabase failed, using file store:', e?.message)
    }
  }
  return readFileStore().offers.filter((o) => o.active)
}

export async function getBalance(userId: string): Promise<GoldbackBalance> {
  const keys = await resolveGoldbackUserKeys(userId)
  let best: GoldbackBalance = {
    userId,
    balancePaise: 0,
    updatedAt: new Date().toISOString(),
  }
  for (const key of keys) {
    const bal = await getBalanceExact(key)
    if (bal.balancePaise > best.balancePaise) {
      best = { ...bal, userId }
    } else if (bal.balancePaise === best.balancePaise && bal.updatedAt > best.updatedAt) {
      best = { ...bal, userId }
    }
  }
  return best
}

export async function listLedger(userId: string, limit = 50): Promise<GoldbackLedgerEntry[]> {
  const keys = await resolveGoldbackUserKeys(userId)
  const byId = new Map<string, GoldbackLedgerEntry>()
  for (const key of keys) {
    for (const entry of await listLedgerExact(key, limit * 2)) {
      if (!byId.has(entry.id)) byId.set(entry.id, entry)
    }
  }
  return [...byId.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
}

const goldbackKeyMemo = new Map<string, { keys: string[]; at: number }>()
const GOLDBACK_KEY_MEMO_MS = 60_000

/**
 * Map admin email ↔ member Supabase UUID so Goldback isn't split across keys.
 * Admin UI often adjusts by email; the app reads JWT `sub` (UUID).
 */
export async function resolveGoldbackUserKeys(raw: string): Promise<string[]> {
  const input = String(raw || '').trim()
  if (!input) return []
  const memoHit = goldbackKeyMemo.get(input)
  if (memoHit && Date.now() - memoHit.at < GOLDBACK_KEY_MEMO_MS) return memoHit.keys

  const keys = new Set<string>([input])
  const lower = input.toLowerCase()
  if (lower.includes('@')) {
    keys.add(lower)
    try {
      const { findAuthUserByEmail } = await import('../auth/supabaseAdmin.js')
      const user = await findAuthUserByEmail(lower)
      if (user?.id) keys.add(user.id)
    } catch {
      /* service role may be unavailable in local file mode */
    }
  } else {
    try {
      const { getServiceClient } = await import('../auth/supabaseAdmin.js')
      const sb = getServiceClient()
      const { data } = await sb.auth.admin.getUserById(input)
      const email = String(data.user?.email || '')
        .trim()
        .toLowerCase()
      if (email.includes('@')) keys.add(email)
    } catch {
      /* ignore */
    }
  }
  const list = [...keys]
  const at = Date.now()
  for (const k of list) goldbackKeyMemo.set(k, { keys: list, at })
  return list
}

async function getBalanceExact(userId: string): Promise<GoldbackBalance> {
  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb.from('goldback_accounts').select('*').eq('user_id', userId).maybeSingle()
    if (!error) {
      if (data) {
        return {
          userId: data.user_id,
          balancePaise: data.balance_paise,
          updatedAt: data.updated_at,
        }
      }
      return { userId, balancePaise: 0, updatedAt: new Date().toISOString() }
    }
    noteSchemaError(error)
    console.warn('[goldback] balance query failed, using file store:', error.message)
  }
  const snap = readFileStore()
  return snap.accounts[userId] ?? { userId, balancePaise: 0, updatedAt: new Date().toISOString() }
}

async function listLedgerExact(userId: string, limit = 50): Promise<GoldbackLedgerEntry[]> {
  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb
      .from('goldback_ledger')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (!error && data) return data.map(mapLedger)
    noteSchemaError(error)
    console.warn('[goldback] ledger query failed, using file store:', error?.message)
  }
  return readFileStore()
    .ledger.filter((e) => e.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
}

export async function recordClick(userId: string, offerId: string) {
  const sb = sbClient()
  if (sb) {
    // Verify offer lives in Supabase before inserting FK-bound click
    const { data: offerRow } = await sb.from('offers').select('id').eq('id', offerId).maybeSingle()
    if (offerRow) {
      const { error } = await sb.from('offer_clicks').insert({ user_id: userId, offer_id: offerId })
      if (!error) return { ok: true as const }
      console.warn('[goldback] click insert failed:', error.message)
      // Non-fatal — click tracking shouldn't block shopping
      return { ok: true as const }
    }
  }
  const snap = readFileStore()
  snap.clicks.push({ id: randomUUID(), userId, offerId, createdAt: new Date().toISOString() })
  writeFileStore(snap)
  return { ok: true as const }
}

export async function creditEarn(
  userId: string,
  offerId: string,
  idempotencyKey: string
): Promise<{ entry: GoldbackLedgerEntry; balance: GoldbackBalance; created: boolean }> {
  const offers = await listOffers()
  const offer = offers.find((o) => o.id === offerId)
  if (!offer) throw new Error('Offer not found')

  // Normalize client keys — one earn per user+offer
  const stableKey = idempotencyKey.startsWith('earn:')
    ? `earn:${userId}:${offerId}`
    : idempotencyKey

  const sb = sbClient()
  if (sb) {
    // Confirm offer exists in Supabase (avoid file-id FK failures)
    const { data: sbOffer } = await sb.from('offers').select('id').eq('id', offerId).maybeSingle()
    if (!sbOffer) {
      // Offer came from a previous file-seed response while Supabase was empty —
      // re-seed and try matching by merchant+title, else file fallback for this offer only.
      try {
        await ensureSupabaseOffers(sb)
      } catch {
        /* continue to file */
      }
      const { data: again } = await sb.from('offers').select('*').eq('merchant', offer.merchant).eq('title', offer.title).maybeSingle()
      if (again) {
        return creditEarn(userId, again.id, `earn:${userId}:${again.id}`)
      }
      console.warn('[goldback] offer not in supabase — crediting via file store for', offerId)
      return creditInFile(userId, offer, stableKey)
    }

    const { data: existing } = await sb
      .from('goldback_ledger')
      .select('*')
      .eq('user_id', userId)
      .eq('idempotency_key', stableKey)
      .maybeSingle()

    if (existing) {
      const balance = await getBalance(userId)
      return { entry: mapLedger(existing), balance, created: false }
    }

    // Also stop double-credit if older keys used Date.now()
    const { data: priorOfferEarn } = await sb
      .from('goldback_ledger')
      .select('*')
      .eq('user_id', userId)
      .eq('offer_id', offerId)
      .eq('type', 'earn')
      .eq('status', 'earned')
      .limit(1)
      .maybeSingle()
    if (priorOfferEarn) {
      const balance = await getBalance(userId)
      return { entry: mapLedger(priorOfferEarn), balance, created: false }
    }

    const entryRow = {
      user_id: userId,
      type: 'earn',
      amount_paise: offer.rewardPaise,
      offer_id: offerId,
      status: 'earned',
      idempotency_key: stableKey,
      meta: { merchant: offer.merchant, title: offer.title },
    }

    const { data: inserted, error: insertErr } = await sb.from('goldback_ledger').insert(entryRow).select('*').single()
    if (insertErr || !inserted) {
      throw new Error(insertErr?.message || 'Failed to credit Goldback ledger')
    }

    const current = await getBalance(userId)
    const nextBalance = current.balancePaise + offer.rewardPaise
    const { error: upsertErr } = await sb.from('goldback_accounts').upsert({
      user_id: userId,
      balance_paise: nextBalance,
      updated_at: new Date().toISOString(),
    })
    if (upsertErr) {
      // Roll back the lied success path — delete orphan ledger row when possible
      await sb.from('goldback_ledger').delete().eq('id', inserted.id)
      throw new Error(`Failed to update Goldback balance: ${upsertErr.message}`)
    }

    return {
      entry: mapLedger(inserted),
      balance: { userId, balancePaise: nextBalance, updatedAt: new Date().toISOString() },
      created: true,
    }
  }

  return creditInFile(userId, offer, stableKey)
}

export function goldbackBackendMode(): 'supabase' | 'file' {
  return sbClient() ? 'supabase' : 'file'
}

/** Admin: list all offers including inactive */
export async function listAllOffers(): Promise<GoldbackOffer[]> {
  const sb = sbClient()
  if (sb) {
    try {
      const { data, error } = await sb.from('offers').select('*').order('created_at', { ascending: false })
      if (error) {
        noteSchemaError(error)
      } else if (data) {
        if (data.length === 0 && !readFileStore().offerSeedLocked) {
          return await ensureSupabaseOffers(sb)
        }
        return data.map(mapOffer).filter((o) => o.active !== false)
      }
    } catch (e: any) {
      noteSchemaError(e)
      console.warn('[goldback] listAllOffers failed:', e?.message)
    }
  }
  return readFileStore().offers
}

export async function upsertOffer(
  input: Partial<GoldbackOffer> & Pick<GoldbackOffer, 'title' | 'merchant' | 'url'>
): Promise<GoldbackOffer> {
  const sb = sbClient()
  const row: Record<string, unknown> = {
    title: input.title,
    merchant: input.merchant,
    category: input.category || 'general',
    description: input.description || '',
    url: input.url,
    reward_paise: input.rewardPaise ?? 0,
    reward_label: input.rewardLabel || '',
    active: input.active !== false,
  }
  if (input.imageUrl !== undefined) {
    row.image_url = input.imageUrl || null
  }

  if (sb) {
    if (input.id) {
      const { data, error } = await sb.from('offers').update(row).eq('id', input.id).select('*').single()
      if (!error && data) {
        const mapped = mapOffer(data)
        writeOfferToFile(mapped)
        return mapped
      }
      if (!noteSchemaError(error)) throw new Error(error?.message || 'Offer update failed')
    } else {
      const { data, error } = await sb.from('offers').insert(row).select('*').single()
      if (!error && data) {
        const mapped = mapOffer(data)
        writeOfferToFile(mapped)
        return mapped
      }
      if (!noteSchemaError(error)) throw new Error(error?.message || 'Offer insert failed')
    }
  }

  const snap = readFileStore()
  if (input.id) {
    const idx = snap.offers.findIndex((o) => o.id === input.id)
    if (idx >= 0) {
      snap.offers[idx] = { ...snap.offers[idx], ...input, id: input.id } as GoldbackOffer
      writeFileStore(snap)
      return snap.offers[idx]
    }
  }
  const created: GoldbackOffer = {
    id: randomUUID(),
    title: input.title,
    merchant: input.merchant,
    category: input.category || 'general',
    description: input.description || '',
    url: input.url,
    imageUrl: input.imageUrl || null,
    rewardPaise: input.rewardPaise ?? 0,
    rewardLabel: input.rewardLabel || '',
    active: input.active !== false,
  }
  snap.offers.unshift(created)
  writeFileStore(snap)
  return created
}

export async function deleteOffer(id: string): Promise<boolean> {
  const offerId = String(id || '').trim()
  if (!offerId) return false
  markOfferSeedLocked()
  let removed = false

  const sb = sbClient()
  if (sb) {
    const clicks = await sb.from('offer_clicks').delete().eq('offer_id', offerId)
    if (noteSchemaError(clicks.error)) {
      // table missing — file store below
    } else {
      await sb.from('goldback_ledger').update({ offer_id: null }).eq('offer_id', offerId)
      const { data, error } = await sb.from('offers').delete().eq('id', offerId).select('id')
      if (error) {
        if (!noteSchemaError(error)) {
          const { data: soft, error: softErr } = await sb
            .from('offers')
            .update({ active: false })
            .eq('id', offerId)
            .select('id')
          if (softErr) {
            if (!noteSchemaError(softErr)) {
              console.warn('[goldback] offer delete failed, using file store:', error.message)
            }
          } else {
            removed = Boolean(soft?.length)
          }
        }
      } else {
        removed = Boolean(data?.length)
      }
    }
  }

  const snap = readFileStore()
  const before = snap.offers.length
  snap.offers = snap.offers.filter((o) => o.id !== offerId)
  snap.offerSeedLocked = true
  if (snap.offers.length !== before) {
    writeFileStore(snap)
    removed = true
  } else if (snap.offerSeedLocked) {
    writeFileStore(snap)
  }

  return removed
}

export async function listAllLedger(limit = 200): Promise<GoldbackLedgerEntry[]> {
  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb
      .from('goldback_ledger')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (!error && data) return data.map(mapLedger)
    noteSchemaError(error)
  }
  return readFileStore()
    .ledger.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
}

export async function listAllAccounts(): Promise<GoldbackBalance[]> {
  const sb = sbClient()
  let rows: GoldbackBalance[] = []
  if (sb) {
    const { data, error } = await sb.from('goldback_accounts').select('*').order('updated_at', { ascending: false })
    if (!error && data) {
      rows = data.map((d) => ({
        userId: d.user_id,
        balancePaise: d.balance_paise,
        updatedAt: d.updated_at,
      }))
    } else if (error) {
      noteSchemaError(error)
      rows = Object.values(readFileStore().accounts)
    }
  } else {
    rows = Object.values(readFileStore().accounts)
  }

  // Collapse email ↔ UUID duplicates (same person after alias sync).
  const claimed = new Set<string>()
  const out: GoldbackBalance[] = []
  for (const row of rows) {
    if (claimed.has(row.userId)) continue
    const keys = await resolveGoldbackUserKeys(row.userId)
    for (const k of keys) claimed.add(k)
    const siblings = rows.filter((r) => keys.includes(r.userId))
    const best = siblings.reduce((a, b) => (b.balancePaise > a.balancePaise ? b : a), row)
    const primary = keys.find((k) => k.includes('-') && !k.includes('@')) || best.userId
    out.push({
      userId: primary,
      balancePaise: best.balancePaise,
      updatedAt: best.updatedAt,
    })
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/** Admin: set absolute balance or apply signed delta (paise). Records an `adjust` ledger row. */
export async function adminAdjustGoldback(opts: {
  userId: string
  /** Absolute balance in paise. Prefer this when provided. */
  balancePaise?: number
  /** Signed delta in paise (positive credit / negative debit). Used when balancePaise omitted. */
  deltaPaise?: number
  note?: string
}): Promise<{ entry: GoldbackLedgerEntry; balance: GoldbackBalance }> {
  const rawId = String(opts.userId || '').trim()
  if (!rawId) throw new Error('userId required')

  const keys = await resolveGoldbackUserKeys(rawId)
  // Prefer auth UUID as canonical; keep email aliases in sync for admin search.
  const primary = keys.find((k) => k.includes('-') && !k.includes('@')) || keys[0]
  const syncKeys = keys.length ? keys : [primary]

  let currentPaise = 0
  for (const key of syncKeys) {
    const bal = await getBalanceExact(key)
    if (bal.balancePaise > currentPaise) currentPaise = bal.balancePaise
  }

  let nextBalance = currentPaise
  if (opts.balancePaise != null && Number.isFinite(Number(opts.balancePaise))) {
    nextBalance = Math.max(0, Math.round(Number(opts.balancePaise)))
  } else if (opts.deltaPaise != null && Number.isFinite(Number(opts.deltaPaise))) {
    nextBalance = Math.max(0, currentPaise + Math.round(Number(opts.deltaPaise)))
  } else {
    throw new Error('balancePaise or deltaPaise required')
  }

  const amountPaise = nextBalance - currentPaise
  const now = new Date().toISOString()
  const entry: GoldbackLedgerEntry = {
    id: randomUUID(),
    userId: primary,
    type: 'adjust',
    amountPaise,
    offerId: null,
    status: amountPaise >= 0 ? 'earned' : 'redeemed',
    idempotencyKey: `admin-adjust:${primary}:${now}:${amountPaise}`,
    meta: {
      note: opts.note || 'Admin adjustment',
      previous: currentPaise,
      next: nextBalance,
      aliases: syncKeys,
      requestedUserId: rawId,
    },
    createdAt: now,
  }
  const balance: GoldbackBalance = { userId: primary, balancePaise: nextBalance, updatedAt: now }

  const sb = sbClient()
  if (sb) {
    let upsertOk = true
    for (const key of syncKeys) {
      const { error: upsertErr } = await sb.from('goldback_accounts').upsert({
        user_id: key,
        balance_paise: nextBalance,
        updated_at: now,
      })
      if (upsertErr) {
        upsertOk = false
        noteSchemaError(upsertErr)
        break
      }
    }
    if (upsertOk) {
      const { error: ledErr } = await sb.from('goldback_ledger').insert({
        id: entry.id,
        user_id: primary,
        type: entry.type,
        amount_paise: entry.amountPaise,
        offer_id: null,
        status: entry.status,
        idempotency_key: entry.idempotencyKey,
        meta: entry.meta,
        created_at: now,
      })
      if (!ledErr) {
        const snap = readFileStore()
        for (const key of syncKeys) {
          snap.accounts[key] = { userId: key, balancePaise: nextBalance, updatedAt: now }
        }
        snap.ledger.unshift(entry)
        writeFileStore(snap)
        return { entry, balance }
      }
      noteSchemaError(ledErr)
    }
  }

  const snap = readFileStore()
  for (const key of syncKeys) {
    snap.accounts[key] = { userId: key, balancePaise: nextBalance, updatedAt: now }
  }
  snap.ledger.unshift(entry)
  writeFileStore(snap)
  return { entry, balance }
}

export async function listAllClicks(limit = 500): Promise<
  { id: string; userId: string; offerId: string; createdAt: string }[]
> {
  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb
      .from('offer_clicks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (!error && data) {
      return data.map((d: any) => ({
        id: d.id,
        userId: d.user_id,
        offerId: d.offer_id,
        createdAt: d.created_at,
      }))
    }
    noteSchemaError(error)
  }
  return readFileStore()
    .clicks.slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
}
