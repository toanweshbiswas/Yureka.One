import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { PlanningBudget, PlanningCategory, PlanningInbox, PlanningManualEntry, PlanningSnapshot, PlanningTxOverride } from './types.js'
import { PLANNING_CATEGORIES, asPlanningCategory } from './types.js'

function forceFileMode() {
  return (process.env.PLANNING_STORE || '').toLowerCase() === 'file'
}

let supabaseSchemaUnavailable = false

function isMissingSchemaError(message: string | undefined) {
  const text = String(message || '').toLowerCase()
  return (
    text.includes('could not find the table') ||
    text.includes('schema cache') ||
    text.includes('does not exist')
  )
}

function disableSchema(reason: unknown) {
  supabaseSchemaUnavailable = true
  console.warn(
    '[planning] supabase schema unavailable, using file store:',
    (reason as Error)?.message || reason,
  )
}

function noteSchemaError(error: { message?: string } | null | undefined): boolean {
  if (!error?.message || !isMissingSchemaError(error.message)) return false
  disableSchema(error)
  return true
}

function filePath() {
  return path.join(process.cwd(), 'data', 'planning_store.json')
}

function emptySnapshot(): PlanningSnapshot {
  return { inboxes: [], budgets: [], entries: [], overrides: [] }
}

function readFileStore(): PlanningSnapshot {
  const p = filePath()
  try {
    if (!fs.existsSync(p)) {
      const snap = emptySnapshot()
      fs.mkdirSync(path.dirname(p), { recursive: true })
      fs.writeFileSync(p, JSON.stringify(snap, null, 2))
      return snap
    }
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as PlanningSnapshot
    if (!Array.isArray(raw.inboxes)) raw.inboxes = []
    if (!Array.isArray(raw.budgets)) raw.budgets = []
    if (!Array.isArray(raw.entries)) raw.entries = []
    if (!Array.isArray(raw.overrides)) raw.overrides = []
    return raw
  } catch {
    const snap = emptySnapshot()
    writeFileStore(snap)
    return snap
  }
}

function writeFileStore(snap: PlanningSnapshot) {
  fs.mkdirSync(path.dirname(filePath()), { recursive: true })
  fs.writeFileSync(filePath(), JSON.stringify(snap, null, 2))
}

function getSupabase(): SupabaseClient | null {
  if (forceFileMode()) return null
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    ''
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

function sbClient(): SupabaseClient | null {
  if (supabaseSchemaUnavailable) return null
  return getSupabase()
}

export function planningBackendMode(): 'supabase' | 'file' {
  return sbClient() ? 'supabase' : 'file'
}

function mapInbox(row: any): PlanningInbox {
  return {
    id: String(row.id),
    userId: String(row.user_id ?? row.userId),
    gmail: String(row.gmail || '').trim().toLowerCase(),
    connectedAt: String(row.connected_at ?? row.connectedAt),
    lastScannedAt: row.last_scanned_at ?? row.lastScannedAt ?? null,
    lastError: row.last_error ?? row.lastError ?? null,
  }
}

function mapBudget(row: any): PlanningBudget {
  return {
    id: String(row.id),
    userId: String(row.user_id ?? row.userId),
    category: asPlanningCategory(row.category),
    monthlyLimitInr: Number(row.monthly_limit_inr ?? row.monthlyLimitInr ?? 0) || 0,
    month: String(row.month || ''),
  }
}

function mapEntry(row: any): PlanningManualEntry {
  return {
    id: String(row.id),
    userId: String(row.user_id ?? row.userId),
    merchant: String(row.merchant || '').trim(),
    amountInr: Number(row.amount_inr ?? row.amountInr ?? 0) || 0,
    category: asPlanningCategory(row.category),
    date: String(row.date || '').slice(0, 10),
    note: row.note ? String(row.note) : undefined,
    createdAt: String(row.created_at ?? row.createdAt),
  }
}

export async function listInboxes(userId: string): Promise<PlanningInbox[]> {
  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb
      .from('planning_inboxes')
      .select('*')
      .eq('user_id', userId)
      .order('connected_at', { ascending: true })
    if (!error && data) return data.map(mapInbox)
    noteSchemaError(error)
  }
  return readFileStore().inboxes.filter((i) => i.userId === userId)
}

export async function getInbox(userId: string, id: string): Promise<PlanningInbox | null> {
  const inboxes = await listInboxes(userId)
  return inboxes.find((i) => i.id === id) || null
}

export async function addInbox(userId: string, gmail: string): Promise<PlanningInbox> {
  const email = gmail.trim().toLowerCase()
  const existing = (await listInboxes(userId)).find((i) => i.gmail === email)
  if (existing) return existing

  const inbox: PlanningInbox = {
    id: randomUUID(),
    userId,
    gmail: email,
    connectedAt: new Date().toISOString(),
    lastScannedAt: null,
    lastError: null,
  }

  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb
      .from('planning_inboxes')
      .insert({
        id: inbox.id,
        user_id: userId,
        gmail: email,
        connected_at: inbox.connectedAt,
      })
      .select('*')
      .single()
    if (!error && data) return mapInbox(data)
    if (!noteSchemaError(error) && error) throw new Error(error.message)
  }

  const snap = readFileStore()
  snap.inboxes.push(inbox)
  writeFileStore(snap)
  return inbox
}

export async function updateInbox(
  userId: string,
  id: string,
  patch: Partial<Pick<PlanningInbox, 'lastScannedAt' | 'lastError'>>,
): Promise<PlanningInbox | null> {
  const current = await getInbox(userId, id)
  if (!current) return null
  const next: PlanningInbox = { ...current, ...patch }

  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb
      .from('planning_inboxes')
      .update({
        last_scanned_at: next.lastScannedAt,
        last_error: next.lastError,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single()
    if (!error && data) return mapInbox(data)
    if (!noteSchemaError(error) && error) throw new Error(error.message)
  }

  const snap = readFileStore()
  const idx = snap.inboxes.findIndex((i) => i.id === id && i.userId === userId)
  if (idx < 0) return null
  snap.inboxes[idx] = next
  writeFileStore(snap)
  return next
}

export async function deleteInbox(userId: string, id: string): Promise<PlanningInbox | null> {
  const current = await getInbox(userId, id)
  if (!current) return null

  const sb = sbClient()
  if (sb) {
    const { error } = await sb.from('planning_inboxes').delete().eq('id', id).eq('user_id', userId)
    if (error && !noteSchemaError(error)) throw new Error(error.message)
    if (!error) return current
  }

  const snap = readFileStore()
  snap.inboxes = snap.inboxes.filter((i) => !(i.id === id && i.userId === userId))
  writeFileStore(snap)
  return current
}

export async function listBudgets(userId: string, month: string): Promise<PlanningBudget[]> {
  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb
      .from('planning_budgets')
      .select('*')
      .eq('user_id', userId)
      .eq('month', month)
    if (!error && data) return data.map(mapBudget)
    noteSchemaError(error)
  }
  return readFileStore().budgets.filter((b) => b.userId === userId && b.month === month)
}

export async function upsertBudgets(
  userId: string,
  month: string,
  rows: { category: PlanningCategory; monthlyLimitInr: number }[],
): Promise<PlanningBudget[]> {
  const cleaned = rows
    .filter((r) => PLANNING_CATEGORIES.includes(r.category))
    .map((r) => ({
      category: r.category,
      monthlyLimitInr: Math.max(0, Number(r.monthlyLimitInr) || 0),
    }))

  const sb = sbClient()
  if (sb) {
    const saved: PlanningBudget[] = []
    for (const row of cleaned) {
      const { data: existing, error: findErr } = await sb
        .from('planning_budgets')
        .select('*')
        .eq('user_id', userId)
        .eq('month', month)
        .eq('category', row.category)
        .maybeSingle()
      if (findErr && !noteSchemaError(findErr)) throw new Error(findErr.message)
      if (findErr && noteSchemaError(findErr)) break

      if (existing) {
        const { data, error } = await sb
          .from('planning_budgets')
          .update({ monthly_limit_inr: row.monthlyLimitInr })
          .eq('id', existing.id)
          .select('*')
          .single()
        if (error) throw new Error(error.message)
        if (data) saved.push(mapBudget(data))
      } else {
        const { data, error } = await sb
          .from('planning_budgets')
          .insert({
            user_id: userId,
            category: row.category,
            monthly_limit_inr: row.monthlyLimitInr,
            month,
          })
          .select('*')
          .single()
        if (error) throw new Error(error.message)
        if (data) saved.push(mapBudget(data))
      }
    }
    if (saved.length) return listBudgets(userId, month)
  }

  const snap = readFileStore()
  const others = snap.budgets.filter((b) => !(b.userId === userId && b.month === month))
  const next = cleaned.map((row) => {
    const prev = snap.budgets.find(
      (b) => b.userId === userId && b.month === month && b.category === row.category,
    )
    return {
      id: prev?.id || randomUUID(),
      userId,
      category: row.category,
      monthlyLimitInr: row.monthlyLimitInr,
      month,
    } satisfies PlanningBudget
  })
  snap.budgets = [...others, ...next]
  writeFileStore(snap)
  return next
}

export async function listEntries(userId: string): Promise<PlanningManualEntry[]> {
  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb
      .from('planning_entries')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(400)
    if (!error && data) return data.map(mapEntry)
    noteSchemaError(error)
  }
  return readFileStore()
    .entries.filter((e) => e.userId === userId)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
}

export async function addEntry(
  userId: string,
  input: { merchant: string; amountInr: number; category: PlanningCategory; date: string; note?: string },
): Promise<PlanningManualEntry> {
  const merchant = String(input.merchant || '').trim().slice(0, 80)
  const amountInr = Math.round(Math.max(0, Number(input.amountInr) || 0) * 100) / 100
  const date = String(input.date || '').slice(0, 10)
  if (!merchant) throw new Error('Merchant is required')
  if (amountInr <= 0) throw new Error('Amount must be greater than 0')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Date must be YYYY-MM-DD')
  if (!PLANNING_CATEGORIES.includes(input.category)) throw new Error('Invalid category')

  const entry: PlanningManualEntry = {
    id: randomUUID(),
    userId,
    merchant,
    amountInr,
    category: input.category,
    date,
    note: input.note?.trim().slice(0, 160) || undefined,
    createdAt: new Date().toISOString(),
  }

  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb
      .from('planning_entries')
      .insert({
        id: entry.id,
        user_id: userId,
        merchant,
        amount_inr: amountInr,
        category: input.category,
        date,
        note: entry.note || null,
        created_at: entry.createdAt,
      })
      .select('*')
      .single()
    if (!error && data) return mapEntry(data)
    if (!noteSchemaError(error) && error) throw new Error(error.message)
  }

  const snap = readFileStore()
  snap.entries.unshift(entry)
  writeFileStore(snap)
  return entry
}

export async function deleteEntry(userId: string, id: string): Promise<PlanningManualEntry | null> {
  const current = (await listEntries(userId)).find((e) => e.id === id) || null
  if (!current) return null

  const sb = sbClient()
  if (sb) {
    const { error } = await sb.from('planning_entries').delete().eq('id', id).eq('user_id', userId)
    if (error && !noteSchemaError(error)) throw new Error(error.message)
    if (!error) return current
  }

  const snap = readFileStore()
  snap.entries = snap.entries.filter((e) => !(e.id === id && e.userId === userId))
  writeFileStore(snap)
  return current
}

function mapOverride(row: any): PlanningTxOverride {
  return {
    userId: String(row.user_id ?? row.userId),
    dedupeHash: String(row.dedupe_hash ?? row.dedupeHash),
    category: asPlanningCategory(row.category),
    needsReview: Boolean(row.needs_review ?? row.needsReview),
  }
}

export async function listOverrides(userId: string): Promise<PlanningTxOverride[]> {
  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb
      .from('planning_tx_overrides')
      .select('*')
      .eq('user_id', userId)
    if (!error && data) return data.map(mapOverride)
    noteSchemaError(error)
  }
  return (readFileStore().overrides || []).filter((o) => o.userId === userId)
}

export async function upsertOverride(
  userId: string,
  input: { dedupeHash: string; category: PlanningCategory; needsReview?: boolean },
): Promise<PlanningTxOverride> {
  const dedupeHash = String(input.dedupeHash || '').trim()
  if (!dedupeHash) throw new Error('Transaction hash is required')
  const category = asPlanningCategory(input.category)
  const needsReview = input.needsReview === true
  const row: PlanningTxOverride = { userId, dedupeHash, category, needsReview }

  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb
      .from('planning_tx_overrides')
      .upsert(
        {
          user_id: userId,
          dedupe_hash: dedupeHash,
          category,
          needs_review: needsReview,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,dedupe_hash' },
      )
      .select('*')
      .single()
    if (!error && data) return mapOverride(data)
    if (!noteSchemaError(error) && error) throw new Error(error.message)
  }

  const snap = readFileStore()
  snap.overrides = snap.overrides || []
  const idx = snap.overrides.findIndex((o) => o.userId === userId && o.dedupeHash === dedupeHash)
  if (idx >= 0) snap.overrides[idx] = row
  else snap.overrides.push(row)
  writeFileStore(snap)
  return row
}

export async function updateEntry(
  userId: string,
  id: string,
  patch: Partial<Pick<PlanningManualEntry, 'merchant' | 'amountInr' | 'category' | 'date' | 'note'>>,
): Promise<PlanningManualEntry | null> {
  const current = (await listEntries(userId)).find((e) => e.id === id) || null
  if (!current) return null
  const next: PlanningManualEntry = {
    ...current,
    merchant: patch.merchant != null ? String(patch.merchant).trim().slice(0, 80) : current.merchant,
    amountInr:
      patch.amountInr != null
        ? Math.round(Math.max(0, Number(patch.amountInr) || 0) * 100) / 100
        : current.amountInr,
    category: patch.category ? asPlanningCategory(patch.category) : current.category,
    date: patch.date ? String(patch.date).slice(0, 10) : current.date,
    note: patch.note != null ? String(patch.note).trim().slice(0, 160) || undefined : current.note,
  }
  if (!next.merchant) throw new Error('Merchant is required')
  if (next.amountInr <= 0) throw new Error('Amount must be greater than 0')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(next.date)) throw new Error('Date must be YYYY-MM-DD')

  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb
      .from('planning_entries')
      .update({
        merchant: next.merchant,
        amount_inr: next.amountInr,
        category: next.category,
        date: next.date,
        note: next.note || null,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single()
    if (!error && data) return mapEntry(data)
    if (!noteSchemaError(error) && error) throw new Error(error.message)
  }

  const snap = readFileStore()
  const idx = snap.entries.findIndex((e) => e.id === id && e.userId === userId)
  if (idx < 0) return null
  snap.entries[idx] = next
  writeFileStore(snap)
  return next
}
