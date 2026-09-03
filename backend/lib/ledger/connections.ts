import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import path from 'path'
import { fileURLToPath } from 'url'
import { encryptSecret, decryptSecret } from './crypto.js'

export type LedgerConnection = {
  userId: string
  gmail: string
  refreshToken: string
  connectedAt?: string
  lastSyncAt?: string | null
  lastSyncError?: string | null
  syncEnabled: boolean
}

function getSupabase(): SupabaseClient | null {
  if ((process.env.LEDGER_STORE || process.env.PLANNING_STORE || '').toLowerCase() === 'file') {
    return null
  }
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
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

const FILE_PATH = new URL('../../../data/ledger_connections.json', import.meta.url)

async function readFileStore(): Promise<LedgerConnection[]> {
  try {
    const fs = await import('fs/promises')
    const raw = await fs.readFile(FILE_PATH, 'utf-8')
    const data = JSON.parse(raw) as { connections?: LedgerConnection[] }
    return Array.isArray(data.connections) ? data.connections : []
  } catch {
    return []
  }
}

async function writeFileStore(rows: LedgerConnection[]): Promise<void> {
  const fs = await import('fs/promises')
  const target = fileURLToPath(FILE_PATH)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, JSON.stringify({ connections: rows }, null, 2))
}

export async function saveLedgerConnection(opts: {
  userId: string
  gmail: string
  refreshToken: string
}): Promise<void> {
  const gmail = opts.gmail.trim().toLowerCase()
  const enc = encryptSecret(opts.refreshToken)
  const sb = getSupabase()

  if (sb) {
    try {
      const { error } = await sb.from('ledger_connections').upsert(
        {
          user_id: opts.userId,
          gmail,
          refresh_token_enc: enc,
          connected_at: new Date().toISOString(),
          sync_enabled: true,
          last_sync_error: null,
        },
        { onConflict: 'user_id,gmail' },
      )
      if (error && !isMissingSchemaError(error.message)) {
        console.warn('[ledger-connections] upsert failed:', error.message)
      } else if (!error) {
        return
      }
    } catch (e: any) {
      console.warn('[ledger-connections] upsert error:', e?.message || e)
    }
  }

  const rows = await readFileStore()
  const next = rows.filter((r) => !(r.userId === opts.userId && r.gmail === gmail))
  next.push({
    userId: opts.userId,
    gmail,
    refreshToken: opts.refreshToken,
    connectedAt: new Date().toISOString(),
    syncEnabled: true,
  })
  await writeFileStore(next)
}

export async function getLedgerConnection(
  userId: string,
  gmail: string,
): Promise<LedgerConnection | null> {
  const normalized = gmail.trim().toLowerCase()
  const sb = getSupabase()

  if (sb) {
    try {
      const { data, error } = await sb
        .from('ledger_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('gmail', normalized)
        .maybeSingle()
      if (!error && data?.refresh_token_enc) {
        return {
          userId: String(data.user_id),
          gmail: String(data.gmail),
          refreshToken: decryptSecret(String(data.refresh_token_enc)),
          connectedAt: data.connected_at ? String(data.connected_at) : undefined,
          lastSyncAt: data.last_sync_at ? String(data.last_sync_at) : null,
          lastSyncError: data.last_sync_error ? String(data.last_sync_error) : null,
          syncEnabled: data.sync_enabled !== false,
        }
      }
    } catch {
      // fall through
    }
  }

  const rows = await readFileStore()
  return rows.find((r) => r.userId === userId && r.gmail === normalized) || null
}

export async function getPrimaryLedgerConnection(userId: string): Promise<LedgerConnection | null> {
  const sb = getSupabase()
  if (sb) {
    try {
      const { data } = await sb
        .from('ledger_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('sync_enabled', true)
        .order('connected_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data?.refresh_token_enc) {
        return {
          userId: String(data.user_id),
          gmail: String(data.gmail),
          refreshToken: decryptSecret(String(data.refresh_token_enc)),
          connectedAt: data.connected_at ? String(data.connected_at) : undefined,
          lastSyncAt: data.last_sync_at ? String(data.last_sync_at) : null,
          lastSyncError: data.last_sync_error ? String(data.last_sync_error) : null,
          syncEnabled: data.sync_enabled !== false,
        }
      }
    } catch {
      // fall through
    }
  }

  const rows = await readFileStore()
  return rows.find((r) => r.userId === userId && r.syncEnabled) || null
}

export async function listDueLedgerConnections(opts?: {
  minDaysSinceSync?: number
  limit?: number
}): Promise<LedgerConnection[]> {
  const minDays = opts?.minDaysSinceSync ?? 7
  const limit = opts?.limit ?? 50
  const cutoff = Date.now() - minDays * 24 * 60 * 60 * 1000
  const out: LedgerConnection[] = []

  const sb = getSupabase()
  if (sb) {
    try {
      const { data } = await sb
        .from('ledger_connections')
        .select('*')
        .eq('sync_enabled', true)
        .order('last_sync_at', { ascending: true, nullsFirst: true })
        .limit(limit * 2)
      for (const row of data || []) {
        if (!row.refresh_token_enc) continue
        const last = row.last_sync_at ? Date.parse(String(row.last_sync_at)) : 0
        if (last > 0 && last > cutoff) continue
        out.push({
          userId: String(row.user_id),
          gmail: String(row.gmail),
          refreshToken: decryptSecret(String(row.refresh_token_enc)),
          connectedAt: row.connected_at ? String(row.connected_at) : undefined,
          lastSyncAt: row.last_sync_at ? String(row.last_sync_at) : null,
          lastSyncError: row.last_sync_error ? String(row.last_sync_error) : null,
          syncEnabled: row.sync_enabled !== false,
        })
        if (out.length >= limit) break
      }
      if (out.length) return out
    } catch {
      // fall through
    }
  }

  const rows = await readFileStore()
  for (const row of rows) {
    if (!row.syncEnabled) continue
    const last = row.lastSyncAt ? Date.parse(row.lastSyncAt) : 0
    if (last > 0 && last > cutoff) continue
    out.push(row)
    if (out.length >= limit) break
  }
  return out
}

export async function markLedgerConnectionSync(opts: {
  userId: string
  gmail: string
  error?: string | null
}): Promise<void> {
  const gmail = opts.gmail.trim().toLowerCase()
  const now = new Date().toISOString()
  const sb = getSupabase()

  if (sb) {
    try {
      await sb
        .from('ledger_connections')
        .update({
          last_sync_at: now,
          last_sync_error: opts.error || null,
        })
        .eq('user_id', opts.userId)
        .eq('gmail', gmail)
    } catch {
      // ignore
    }
  }

  const rows = await readFileStore()
  const idx = rows.findIndex((r) => r.userId === opts.userId && r.gmail === gmail)
  if (idx >= 0) {
    rows[idx] = { ...rows[idx], lastSyncAt: now, lastSyncError: opts.error || null }
    await writeFileStore(rows)
  }
}

export async function listAllLedgerConnections(): Promise<LedgerConnection[]> {
  const out: LedgerConnection[] = []
  const sb = getSupabase()
  if (sb) {
    try {
      const { data } = await sb.from('ledger_connections').select('*').eq('sync_enabled', true).limit(5000)
      for (const row of data || []) {
        if (!row.refresh_token_enc) continue
        try {
          out.push({
            userId: String(row.user_id),
            gmail: String(row.gmail),
            refreshToken: decryptSecret(String(row.refresh_token_enc)),
            connectedAt: row.connected_at ? String(row.connected_at) : undefined,
            lastSyncAt: row.last_sync_at ? String(row.last_sync_at) : null,
            lastSyncError: row.last_sync_error ? String(row.last_sync_error) : null,
            syncEnabled: row.sync_enabled !== false,
          })
        } catch {
          // skip undecryptable
        }
      }
      if (out.length) return out
    } catch {
      // fall through
    }
  }
  return (await readFileStore()).filter((r) => r.syncEnabled !== false)
}

export async function revokeAllLedgerConnectionsForUser(userId: string): Promise<number> {
  const rows = await listAllLedgerConnections()
  const mine = rows.filter((r) => r.userId === userId)
  for (const row of mine) {
    await revokeLedgerConnection(userId, row.gmail)
  }
  return mine.length
}

export async function revokeLedgerConnectionsByGmail(gmail: string): Promise<number> {
  const normalized = gmail.trim().toLowerCase()
  const rows = await listAllLedgerConnections()
  const match = rows.filter((r) => r.gmail === normalized)
  for (const row of match) {
    await revokeLedgerConnection(row.userId, row.gmail)
  }
  return match.length
}

export async function revokeLedgerConnection(userId: string, gmail: string): Promise<void> {
  const normalized = gmail.trim().toLowerCase()
  const sb = getSupabase()
  if (sb) {
    try {
      await sb
        .from('ledger_connections')
        .update({ sync_enabled: false, refresh_token_enc: '', last_sync_error: 'revoked' })
        .eq('user_id', userId)
        .eq('gmail', normalized)
    } catch {
      // ignore
    }
  }
  const rows = await readFileStore()
  await writeFileStore(rows.filter((r) => !(r.userId === userId && r.gmail === normalized)))
}
