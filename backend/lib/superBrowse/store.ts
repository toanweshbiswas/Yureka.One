import fs from 'fs'
import path from 'path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPER_BROWSE_STORES as SEED } from '../../../shared/superBrowseStores.js'
import catalog from '../../../shared/superBrowseCatalog.json' with { type: 'json' }

export type SuperBrowseStoreRow = {
  id: string
  name: string
  domain: string
  url: string
  logoUrl: string | null
  cashback: string | null
  bg: string
  active: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

type FileStore = { stores: SuperBrowseStoreRow[]; seeded?: boolean; catalogImportedAt?: string }

let supabaseSchemaUnavailable = false

function filePath() {
  return path.join(process.cwd(), 'data', 'super_browse_stores.json')
}

function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
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

function sbClient(): SupabaseClient | null {
  if (supabaseSchemaUnavailable) return null
  return getSupabase()
}

function slugId(name: string) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || `store-${Date.now()}`
}

function domainFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    return String(url || '')
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      .replace(/^www\./i, '')
  }
}

/** Keep Amazon Super Browse on the sign-in page even if an older seed/DB row still points home. */
function normalizeStoreRow(row: SuperBrowseStoreRow): SuperBrowseStoreRow {
  const domain = String(row.domain || '').toLowerCase().replace(/^www\./, '')
  const isAmazon = row.id === 'amazon' || domain === 'amazon.in' || domain === 'amazon.com'
  if (!isAmazon) return row
  try {
    const u = new URL(row.url)
    const host = u.hostname.replace(/^www\./i, '').toLowerCase()
    const path = (u.pathname || '/').replace(/\/+$/, '') || '/'
    if (
      (host === 'amazon.in' || host === 'amazon.com') &&
      (path === '/' || path === '/ref=nav_logo' || path.startsWith('/gp/aw'))
    ) {
      const loginHost = host === 'amazon.com' ? 'www.amazon.com' : 'www.amazon.in'
      return { ...row, url: `https://${loginHost}/ap/signin` }
    }
  } catch {
    /* keep */
  }
  return row
}

function mapRow(row: any): SuperBrowseStoreRow {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    url: row.url,
    logoUrl: row.logo_url ?? row.logoUrl ?? null,
    cashback: row.cashback ?? null,
    bg: row.bg || '#ffffff',
    active: row.active !== false,
    sortOrder: Number(row.sort_order ?? row.sortOrder ?? 0) || 0,
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.updatedAt ?? new Date().toISOString(),
  }
}

function catalogImportedAt(): string | null {
  const at = (catalog as { importedAt?: string }).importedAt
  return at ? String(at) : null
}

function shouldRefreshCatalog(local: FileStore | null, catalogRows: SuperBrowseStoreRow[] | null): boolean {
  if (!catalogRows?.length) return false
  const importedAt = catalogImportedAt()
  if (importedAt && local?.catalogImportedAt !== importedAt) return true
  return (local?.stores?.length ?? 0) < catalogRows.length
}

function catalogSeedRows(): SuperBrowseStoreRow[] | null {
  const rows = (catalog as { stores?: SuperBrowseStoreRow[] }).stores
  if (!Array.isArray(rows) || !rows.length) return null
  const now = new Date().toISOString()
  return rows.map((s, i) => ({
    id: s.id,
    name: s.name,
    domain: s.domain,
    url: s.url,
    logoUrl: s.logoUrl ?? null,
    cashback: s.cashback ?? null,
    bg: s.bg || '#ffffff',
    active: s.active !== false,
    sortOrder: Number.isFinite(s.sortOrder) ? s.sortOrder : i,
    createdAt: s.createdAt || now,
    updatedAt: s.updatedAt || now,
  }))
}

function seedRows(): SuperBrowseStoreRow[] {
  const fromCatalog = catalogSeedRows()
  if (fromCatalog) return fromCatalog.map(normalizeStoreRow)

  const now = new Date().toISOString()
  return SEED.map((s, i) => ({
    id: s.id,
    name: s.name,
    domain: s.domain,
    url: s.url,
    logoUrl: null,
    cashback: s.cashback || null,
    bg: s.bg,
    active: true,
    sortOrder: i,
    createdAt: now,
    updatedAt: now,
  }))
}

function readFileStore(): FileStore {
  const catalogRows = catalogSeedRows()
  const p = filePath()
  try {
    if (!fs.existsSync(p)) {
      const snap: FileStore = { stores: catalogRows || seedRows(), seeded: true }
      fs.mkdirSync(path.dirname(p), { recursive: true })
      fs.writeFileSync(p, JSON.stringify(snap, null, 2))
      return snap
    }
    const snap = JSON.parse(fs.readFileSync(p, 'utf-8')) as FileStore
    if (!Array.isArray(snap.stores) || !snap.stores.length) {
      snap.stores = catalogRows || seedRows()
      snap.seeded = true
      writeFileStore(snap)
    } else if (catalogRows && shouldRefreshCatalog(snap, catalogRows)) {
      snap.stores = catalogRows
      snap.seeded = true
      snap.catalogImportedAt = catalogImportedAt() || snap.catalogImportedAt
      writeFileStore(snap)
    }
    return snap
  } catch {
    const snap: FileStore = { stores: catalogRows || seedRows(), seeded: true }
    writeFileStore(snap)
    return snap
  }
}

async function ensureCatalogSeeded(sb: SupabaseClient, existingCount: number): Promise<SuperBrowseStoreRow[] | null> {
  const catalogRows = catalogSeedRows()
  if (!catalogRows) return null
  const snap = readFileStoreRaw()
  if (!shouldRefreshCatalog(snap, catalogRows)) return null
  await sb.from('super_browse_stores').upsert(
    catalogRows.map((s) => ({
      id: s.id,
      name: s.name,
      domain: s.domain,
      url: s.url,
      logo_url: s.logoUrl,
      cashback: s.cashback,
      bg: s.bg,
      active: s.active,
      sort_order: s.sortOrder,
      updated_at: s.updatedAt,
    })),
    { onConflict: 'id' },
  )
  const next: FileStore = {
    stores: catalogRows,
    seeded: true,
    catalogImportedAt: catalogImportedAt() || undefined,
  }
  writeFileStore(next)
  return catalogRows
}

function readFileStoreRaw(): FileStore | null {
  const p = filePath()
  try {
    if (!fs.existsSync(p)) return null
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as FileStore
  } catch {
    return null
  }
}

function writeFileStore(snap: FileStore) {
  const dest = filePath()
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, JSON.stringify(snap, null, 2))
}

export function superBrowseBackendMode(): 'supabase' | 'file' {
  return sbClient() ? 'supabase' : 'file'
}

export async function listSuperBrowseStores(opts?: {
  includeInactive?: boolean
}): Promise<SuperBrowseStoreRow[]> {
  const includeInactive = Boolean(opts?.includeInactive)
  const sb = sbClient()
  if (sb) {
    try {
      let q = sb.from('super_browse_stores').select('*').order('sort_order', { ascending: true })
      if (!includeInactive) q = q.eq('active', true)
      const { data, error } = await q
      if (error) {
        if (isMissingSchemaError(error.message)) supabaseSchemaUnavailable = true
        else console.warn('[super-browse] list failed:', error.message)
      } else if (data) {
        if (!data.length) {
          const seeded = seedRows()
          await sb.from('super_browse_stores').upsert(
            seeded.map((s) => ({
              id: s.id,
              name: s.name,
              domain: s.domain,
              url: s.url,
              logo_url: s.logoUrl,
              cashback: s.cashback,
              bg: s.bg,
              active: s.active,
              sort_order: s.sortOrder,
            })),
            { onConflict: 'id' },
          )
          return includeInactive ? seeded : seeded.filter((s) => s.active)
        }
        const synced = await ensureCatalogSeeded(sb, data.length)
        if (synced) {
          return includeInactive ? synced : synced.filter((s) => s.active)
        }
        return data.map(mapRow).map(normalizeStoreRow)
      }
    } catch (e: any) {
      if (isMissingSchemaError(e?.message)) supabaseSchemaUnavailable = true
    }
  }
  const stores = readFileStore()
    .stores.slice()
    .map(normalizeStoreRow)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
  return includeInactive ? stores : stores.filter((s) => s.active)
}

export async function upsertSuperBrowseStore(
  input: Partial<SuperBrowseStoreRow> & { name: string; url: string },
): Promise<SuperBrowseStoreRow> {
  const now = new Date().toISOString()
  const url = String(input.url || '').trim()
  const name = String(input.name || '').trim()
  const domain = String(input.domain || domainFromUrl(url)).trim().replace(/^www\./i, '')
  const id = String(input.id || slugId(name || domain)).trim()

  let sortOrder = Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : NaN
  if (!Number.isFinite(sortOrder)) {
    const all = await listSuperBrowseStores({ includeInactive: true })
    const existing = all.find((s) => s.id === id)
    sortOrder = existing
      ? existing.sortOrder
      : all.reduce((m, s) => Math.max(m, s.sortOrder), -1) + 1
  }

  const row: SuperBrowseStoreRow = {
    id,
    name,
    domain,
    url,
    logoUrl: input.logoUrl != null ? String(input.logoUrl).trim() || null : null,
    cashback: input.cashback != null ? String(input.cashback).trim() || null : null,
    bg: String(input.bg || '#ffffff').trim() || '#ffffff',
    active: input.active !== false,
    sortOrder,
    createdAt: input.createdAt || now,
    updatedAt: now,
  }

  const sb = sbClient()
  if (sb) {
    const payload = {
      id: row.id,
      name: row.name,
      domain: row.domain,
      url: row.url,
      logo_url: row.logoUrl,
      cashback: row.cashback,
      bg: row.bg,
      active: row.active,
      sort_order: row.sortOrder,
      updated_at: now,
    }
    const { data, error } = await sb.from('super_browse_stores').upsert(payload).select('*').single()
    if (!error && data) {
      const mapped = mapRow(data)
      const snap = readFileStore()
      const idx = snap.stores.findIndex((s) => s.id === mapped.id)
      if (idx >= 0) snap.stores[idx] = mapped
      else snap.stores.push(mapped)
      writeFileStore(snap)
      return mapped
    }
    if (error && isMissingSchemaError(error.message)) supabaseSchemaUnavailable = true
    else if (error) throw new Error(error.message)
  }

  const snap = readFileStore()
  const idx = snap.stores.findIndex((s) => s.id === row.id)
  if (idx >= 0) {
    row.createdAt = snap.stores[idx].createdAt
    snap.stores[idx] = row
  } else {
    snap.stores.push(row)
  }
  writeFileStore(snap)
  return row
}

export async function deleteSuperBrowseStore(id: string): Promise<boolean> {
  const storeId = String(id || '').trim()
  if (!storeId) return false
  let removed = false

  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb.from('super_browse_stores').delete().eq('id', storeId).select('id')
    if (error && isMissingSchemaError(error.message)) supabaseSchemaUnavailable = true
    else if (!error) removed = Boolean(data?.length)
  }

  const snap = readFileStore()
  const before = snap.stores.length
  snap.stores = snap.stores.filter((s) => s.id !== storeId)
  if (snap.stores.length !== before) {
    writeFileStore(snap)
    removed = true
  }
  return removed
}

/** Persist display order. `orderedIds` is the full ordered list of store ids. */
export async function reorderSuperBrowseStores(orderedIds: string[]): Promise<SuperBrowseStoreRow[]> {
  const ids = orderedIds.map((id) => String(id || '').trim()).filter(Boolean)
  if (!ids.length) return listSuperBrowseStores({ includeInactive: true })

  const now = new Date().toISOString()
  const current = await listSuperBrowseStores({ includeInactive: true })
  const byId = new Map(current.map((s) => [s.id, s]))
  const ordered: SuperBrowseStoreRow[] = []
  const seen = new Set<string>()

  for (let i = 0; i < ids.length; i++) {
    const row = byId.get(ids[i])
    if (!row || seen.has(row.id)) continue
    seen.add(row.id)
    ordered.push({ ...row, sortOrder: i, updatedAt: now })
  }
  for (const row of current) {
    if (seen.has(row.id)) continue
    ordered.push({ ...row, sortOrder: ordered.length, updatedAt: now })
  }

  const sb = sbClient()
  if (sb) {
    try {
      for (const row of ordered) {
        const { error } = await sb
          .from('super_browse_stores')
          .update({ sort_order: row.sortOrder, updated_at: now })
          .eq('id', row.id)
        if (error) {
          if (isMissingSchemaError(error.message)) {
            supabaseSchemaUnavailable = true
            break
          }
          throw new Error(error.message)
        }
      }
    } catch (e: any) {
      if (isMissingSchemaError(e?.message)) supabaseSchemaUnavailable = true
      else throw e
    }
  }

  const snap = readFileStore()
  snap.stores = ordered
  writeFileStore(snap)
  return ordered
}
