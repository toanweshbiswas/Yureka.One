import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type BrowseClickSource = 'super_browse' | 'explore' | 'offers' | 'manual' | 'unknown'

export type BrowseClick = {
  id: string
  userId: string
  storeId: string | null
  storeName: string | null
  destUrl: string
  openedUrl: string
  host: string
  affiliate: boolean
  goldbackOfferId: string | null
  source: BrowseClickSource
  createdAt: string
}

export type RecordBrowseClickInput = {
  userId: string
  storeId?: string | null
  storeName?: string | null
  destUrl: string
  openedUrl: string
  host: string
  affiliate?: boolean
  goldbackOfferId?: string | null
  source?: BrowseClickSource
}

type FileStore = { clicks: BrowseClick[] }

let supabaseSchemaUnavailable = false

function filePath() {
  return path.join(process.cwd(), 'data', 'browse_clicks.json')
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

function normalizeSource(raw: string | undefined): BrowseClickSource {
  const s = String(raw || '').trim().toLowerCase()
  if (s === 'super_browse' || s === 'explore' || s === 'offers' || s === 'manual') return s
  return 'unknown'
}

function mapRow(row: any): BrowseClick {
  return {
    id: row.id,
    userId: row.user_id ?? row.userId,
    storeId: row.store_id ?? row.storeId ?? null,
    storeName: row.store_name ?? row.storeName ?? null,
    destUrl: row.dest_url ?? row.destUrl,
    openedUrl: row.opened_url ?? row.openedUrl,
    host: row.host,
    affiliate: row.affiliate === true,
    goldbackOfferId: row.goldback_offer_id ?? row.goldbackOfferId ?? null,
    source: normalizeSource(row.source),
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
  }
}

function readFileStore(): FileStore {
  const p = filePath()
  try {
    if (!fs.existsSync(p)) {
      const snap: FileStore = { clicks: [] }
      fs.mkdirSync(path.dirname(p), { recursive: true })
      fs.writeFileSync(p, JSON.stringify(snap, null, 2))
      return snap
    }
    const snap = JSON.parse(fs.readFileSync(p, 'utf-8')) as FileStore
    if (!Array.isArray(snap.clicks)) return { clicks: [] }
    return snap
  } catch {
    const snap: FileStore = { clicks: [] }
    writeFileStore(snap)
    return snap
  }
}

function writeFileStore(snap: FileStore) {
  const dest = filePath()
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, JSON.stringify(snap, null, 2))
}

export async function recordBrowseClick(input: RecordBrowseClickInput): Promise<BrowseClick> {
  const now = new Date().toISOString()
  const row: BrowseClick = {
    id: randomUUID(),
    userId: String(input.userId || '').trim(),
    storeId: input.storeId ? String(input.storeId).trim() : null,
    storeName: input.storeName ? String(input.storeName).trim() : null,
    destUrl: String(input.destUrl || '').trim(),
    openedUrl: String(input.openedUrl || input.destUrl || '').trim(),
    host: String(input.host || '').trim(),
    affiliate: input.affiliate === true,
    goldbackOfferId: input.goldbackOfferId ? String(input.goldbackOfferId) : null,
    source: normalizeSource(input.source),
    createdAt: now,
  }

  const sb = sbClient()
  if (sb) {
    const payload = {
      id: row.id,
      user_id: row.userId,
      store_id: row.storeId,
      store_name: row.storeName,
      dest_url: row.destUrl,
      opened_url: row.openedUrl,
      host: row.host,
      affiliate: row.affiliate,
      goldback_offer_id: row.goldbackOfferId,
      source: row.source,
      created_at: now,
    }
    const { data, error } = await sb.from('browse_clicks').insert(payload).select('*').single()
    if (!error && data) {
      const mapped = mapRow(data)
      const snap = readFileStore()
      snap.clicks.unshift(mapped)
      snap.clicks = snap.clicks.slice(0, 5000)
      writeFileStore(snap)
      return mapped
    }
    if (error && isMissingSchemaError(error.message)) supabaseSchemaUnavailable = true
    else if (error) console.warn('[browse] click insert failed:', error.message)
  }

  const snap = readFileStore()
  snap.clicks.unshift(row)
  snap.clicks = snap.clicks.slice(0, 5000)
  writeFileStore(snap)
  return row
}

export async function listBrowseClicks(limit = 500): Promise<BrowseClick[]> {
  const cap = Math.min(Math.max(Number(limit) || 500, 1), 5000)
  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb
      .from('browse_clicks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(cap)
    if (!error && data) return data.map(mapRow)
    if (error && isMissingSchemaError(error.message)) supabaseSchemaUnavailable = true
    else if (error) console.warn('[browse] list failed:', error.message)
  }
  return readFileStore()
    .clicks.slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, cap)
}
