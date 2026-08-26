#!/usr/bin/env node
/**
 * One-time backfill: upload legacy data/financial_cache/*.json into Supabase financial_ledger_cache.
 *
 * Usage:
 *   node backend/scripts/backfill-ledger-cache.mjs
 *   node backend/scripts/backfill-ledger-cache.mjs --dry-run
 */
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
dotenv.config({ path: path.join(ROOT, '.env') })

const dryRun = process.argv.includes('--dry-run')
const cacheDir = path.join(ROOT, 'data', 'financial_cache')

function safeKey(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9._@+-]/g, '_').slice(0, 180)
}

async function resolveUserId(email) {
  try {
    const { findWaitlistByEmail } = await import('../lib/admin/store.js')
    const row = await findWaitlistByEmail(email)
    if (row?.id) return String(row.id)
  } catch {
    // ignore
  }
  return `email:${safeKey(email)}`
}

async function main() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  const sb = createClient(url, key, { auth: { persistSession: false } })

  const files = []
  async function walk(dir) {
    let entries = []
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) await walk(full)
      else if (ent.name.endsWith('.json')) files.push(full)
    }
  }
  await walk(cacheDir)

  let uploaded = 0
  for (const file of files) {
    const raw = await fs.readFile(file, 'utf-8')
    const data = JSON.parse(raw)
    const profile = data.profile || {}
    const gmail = String(profile.email || '').trim().toLowerCase()
    const authEmail = gmail || path.basename(file, '.json').replace(/_/g, '@')
    if (!authEmail.includes('@')) continue

    const userId = data.userId || (await resolveUserId(authEmail))
    const row = {
      user_id: userId,
      gmail: gmail || authEmail,
      scanned_at: data.scannedAt || new Date().toISOString(),
      profile,
      transactions: Array.isArray(data.transactions) ? data.transactions : [],
      score: data.score ?? null,
      scan_version: 1,
    }

    console.log(`${dryRun ? '[dry-run] ' : ''}upsert ${row.user_id} / ${row.gmail} (${row.transactions.length} tx)`)
    if (!dryRun) {
      const { error } = await sb.from('financial_ledger_cache').upsert(row, {
        onConflict: 'user_id,gmail',
      })
      if (error) {
        console.warn('  failed:', error.message)
        continue
      }
    }
    uploaded += 1
  }

  console.log(`Done. ${uploaded} cache file(s) processed.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
