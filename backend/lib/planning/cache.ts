import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import type { PlanningTransaction } from './types.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

function safeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._@+-]/g, '_')
    .slice(0, 180)
}

function getSupabase(): SupabaseClient | null {
  if ((process.env.PLANNING_STORE || '').toLowerCase() === 'file') return null
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

export function planningCachePath(userId: string, gmail: string) {
  return path.join(ROOT, 'data', 'planning_cache', safeKey(userId), `${safeKey(gmail)}.json`)
}

async function readFileCache(userId: string, gmail: string): Promise<PlanningTransaction[]> {
  try {
    const raw = await fsp.readFile(planningCachePath(userId, gmail), 'utf-8')
    const data = JSON.parse(raw) as { transactions?: PlanningTransaction[] }
    return Array.isArray(data.transactions) ? data.transactions : []
  } catch {
    return []
  }
}

async function writeFileCache(
  userId: string,
  gmail: string,
  transactions: PlanningTransaction[],
): Promise<void> {
  const target = planningCachePath(userId, gmail)
  await fsp.mkdir(path.dirname(target), { recursive: true })
  await fsp.writeFile(
    target,
    JSON.stringify(
      {
        gmail,
        userId,
        scannedAt: new Date().toISOString(),
        transactions,
      },
      null,
      2,
    ),
  )
}

export async function readPlanningCache(userId: string, gmail: string): Promise<PlanningTransaction[]> {
  const email = gmail.trim().toLowerCase()
  const sb = getSupabase()
  if (sb) {
    try {
      const { data, error } = await sb
        .from('planning_inbox_cache')
        .select('transactions')
        .eq('user_id', userId)
        .eq('gmail', email)
        .maybeSingle()
      if (!error && data && Array.isArray(data.transactions)) {
        return data.transactions as PlanningTransaction[]
      }
      if (error && !isMissingSchemaError(error.message)) {
        console.warn('[planning-cache] read failed:', error.message)
      }
    } catch (e: any) {
      console.warn('[planning-cache] read error:', e?.message || e)
    }
  }
  return readFileCache(userId, email)
}

export async function writePlanningCache(
  userId: string,
  gmail: string,
  transactions: PlanningTransaction[],
): Promise<void> {
  const email = gmail.trim().toLowerCase()
  // Always mirror to disk so local/dev still works if Supabase table is missing.
  await writeFileCache(userId, email, transactions)

  const sb = getSupabase()
  if (!sb) return
  try {
    const { error } = await sb.from('planning_inbox_cache').upsert(
      {
        user_id: userId,
        gmail: email,
        scanned_at: new Date().toISOString(),
        transactions,
      },
      { onConflict: 'user_id,gmail' },
    )
    if (error && !isMissingSchemaError(error.message)) {
      console.warn('[planning-cache] write failed:', error.message)
    }
  } catch (e: any) {
    console.warn('[planning-cache] write error:', e?.message || e)
  }
}

export async function deletePlanningCache(userId: string, gmail: string): Promise<void> {
  const email = gmail.trim().toLowerCase()
  const target = planningCachePath(userId, email)
  try {
    await fsp.unlink(target)
  } catch {
    // ignore
  }

  const sb = getSupabase()
  if (!sb) return
  try {
    await sb.from('planning_inbox_cache').delete().eq('user_id', userId).eq('gmail', email)
  } catch {
    // ignore
  }
}

export function planningCacheDirExists(userId: string) {
  return fs.existsSync(path.join(ROOT, 'data', 'planning_cache', safeKey(userId)))
}
