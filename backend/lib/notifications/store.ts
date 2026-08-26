import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { NotifyUserInput, UserNotification, UserNotificationType } from './types.js'

type FileStore = { items: UserNotification[] }

let supabaseSchemaUnavailable = false

function filePath() {
  return path.join(process.cwd(), 'data', 'user_notifications.json')
}

function emptyStore(): FileStore {
  return { items: [] }
}

function readFileStore(): FileStore {
  const p = filePath()
  try {
    if (!fs.existsSync(p)) {
      const snap = emptyStore()
      fs.mkdirSync(path.dirname(p), { recursive: true })
      fs.writeFileSync(p, JSON.stringify(snap, null, 2))
      return snap
    }
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as FileStore
  } catch {
    const snap = emptyStore()
    writeFileStore(snap)
    return snap
  }
}

function writeFileStore(snap: FileStore) {
  const dest = filePath()
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, JSON.stringify(snap, null, 2))
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

function rowToNotif(row: any): UserNotification {
  return {
    id: row.id,
    userId: row.user_id ?? row.userId,
    email: row.email || null,
    title: row.title,
    body: row.body || '',
    type: row.type || 'info',
    href: row.href || null,
    imageUrl: row.image_url ?? row.imageUrl ?? null,
    dedupeKey: row.dedupe_key ?? row.dedupeKey ?? null,
    readAt: row.read_at ?? row.readAt ?? null,
    dismissedAt: row.dismissed_at ?? row.dismissedAt ?? null,
    createdAt: row.created_at ?? row.createdAt,
  }
}

function normalizeEmail(value?: string | null): string | null {
  const em = String(value || '').trim().toLowerCase()
  return em.includes('@') ? em : null
}

/**
 * Strict ownership: a notification addressed to another email must never appear
 * in this inbox. even if a bad query or shared id leaked it.
 */
export function ownsNotification(
  n: Pick<UserNotification, 'userId' | 'email'>,
  userId: string,
  email?: string | null,
): boolean {
  const uid = String(userId || '').trim()
  if (!uid) return false
  const reqEmail = normalizeEmail(email)
  const nEmail = normalizeEmail(n.email)
  const nUid = String(n.userId || '').trim()
  const nUidEmail = normalizeEmail(nUid)

  // Addressed to a different mailbox → deny.
  if (nEmail && reqEmail && nEmail !== reqEmail) return false
  if (nUidEmail && reqEmail && nUidEmail !== reqEmail) return false
  // Notification has an email but requester has none. only allow exact userId match.
  if (nEmail && !reqEmail && nUid !== uid) return false

  if (nUid === uid) return true
  if (reqEmail && (nUidEmail === reqEmail || nEmail === reqEmail)) return true
  return false
}

function matchesUser(n: UserNotification, userId: string, email?: string | null) {
  return ownsNotification(n, userId, email)
}

function identityKeys(userId: string, email?: string | null): string[] {
  const keys = new Set<string>()
  const id = String(userId || '').trim()
  if (id) keys.add(id)
  const em = normalizeEmail(email)
  if (em) keys.add(em)
  return [...keys]
}

function filterOwned(
  rows: UserNotification[],
  userId: string,
  email?: string | null,
): UserNotification[] {
  return rows.filter((n) => ownsNotification(n, userId, email))
}

export async function notifyUser(input: NotifyUserInput): Promise<UserNotification | null> {
  const userId = String(input.userId || '').trim()
  if (!userId || !input.title) return null
  const now = new Date().toISOString()
  const email = input.email ? String(input.email).trim().toLowerCase() : null
  const item: UserNotification = {
    id: randomUUID(),
    userId,
    email,
    title: input.title.slice(0, 160),
    body: String(input.body || '').slice(0, 600),
    type: input.type || 'info',
    href: input.href || null,
    imageUrl: input.imageUrl || null,
    dedupeKey: input.dedupeKey || null,
    readAt: null,
    dismissedAt: null,
    createdAt: now,
  }

  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb
      .from('user_notifications')
      .insert({
        id: item.id,
        user_id: item.userId,
        email: item.email,
        title: item.title,
        body: item.body,
        type: item.type,
        href: item.href,
        image_url: item.imageUrl,
        dedupe_key: item.dedupeKey,
      })
      .select('*')
      .single()
    if (error) {
      if (error.code === '23505') {
        const { data: existing } = await sb
          .from('user_notifications')
          .select('*')
          .eq('user_id', userId)
          .eq('dedupe_key', item.dedupeKey)
          .maybeSingle()
        return existing ? rowToNotif(existing) : null
      }
      if (isMissingSchemaError(error.message)) {
        supabaseSchemaUnavailable = true
      } else {
        console.warn('[notifications] insert failed:', error.message)
        return null
      }
    } else if (data) {
      return rowToNotif(data)
    }
  }

  const snap = readFileStore()
  if (item.dedupeKey && snap.items.some((n) => n.userId === userId && n.dedupeKey === item.dedupeKey)) {
    return snap.items.find((n) => n.userId === userId && n.dedupeKey === item.dedupeKey) || null
  }
  snap.items.unshift(item)
  if (snap.items.length > 4000) snap.items = snap.items.slice(0, 3000)
  writeFileStore(snap)
  return item
}

export async function listUserNotifications(
  userId: string,
  email?: string | null,
): Promise<{ items: UserNotification[]; unreadCount: number }> {
  const uid = String(userId || '').trim()
  const em = normalizeEmail(email)
  if (!uid) return { items: [], unreadCount: 0 }

  const keys = identityKeys(uid, em)
  const sb = sbClient()
  if (sb) {
    const map = new Map<string, UserNotification>()

    const byUser = await sb
      .from('user_notifications')
      .select('*')
      .is('dismissed_at', null)
      .in('user_id', keys)
      .order('created_at', { ascending: false })
      .limit(80)
    if (byUser.error) {
      if (isMissingSchemaError(byUser.error.message)) {
        supabaseSchemaUnavailable = true
      } else {
        throw new Error(byUser.error.message)
      }
    } else {
      for (const row of byUser.data || []) map.set(row.id, rowToNotif(row))
    }

    // Only pull by email column when we have a verified requester email.
    if (em && !supabaseSchemaUnavailable) {
      const byEmail = await sb
        .from('user_notifications')
        .select('*')
        .is('dismissed_at', null)
        .eq('email', em)
        .order('created_at', { ascending: false })
        .limit(80)
      if (!byEmail.error) {
        for (const row of byEmail.data || []) map.set(row.id, rowToNotif(row))
      }
    }

    if (!supabaseSchemaUnavailable) {
      const items = filterOwned([...map.values()], uid, em)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 50)
      return { items, unreadCount: items.filter((n) => !n.readAt).length }
    }
  }

  const items = filterOwned(
    readFileStore().items.filter((n) => !n.dismissedAt),
    uid,
    em,
  )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 50)
  return { items, unreadCount: items.filter((n) => !n.readAt).length }
}

export async function markNotificationsRead(
  userId: string,
  email: string | null,
  ids?: string[],
): Promise<number> {
  const now = new Date().toISOString()
  const sb = sbClient()
  if (sb) {
    const listed = await listUserNotifications(userId, email)
    const targetIds = listed.items
      .filter((n) => !n.readAt && (!ids?.length || ids.includes(n.id)))
      .map((n) => n.id)
    if (!targetIds.length) return 0
    const { error } = await sb.from('user_notifications').update({ read_at: now }).in('id', targetIds)
    if (error) {
      if (isMissingSchemaError(error.message)) supabaseSchemaUnavailable = true
      else throw new Error(error.message)
    } else {
      return targetIds.length
    }
  }

  const snap = readFileStore()
  let n = 0
  for (const item of snap.items) {
    if (item.dismissedAt || item.readAt) continue
    if (!matchesUser(item, userId, email)) continue
    if (ids?.length && !ids.includes(item.id)) continue
    item.readAt = now
    n += 1
  }
  writeFileStore(snap)
  return n
}

export async function dismissNotification(
  userId: string,
  email: string | null,
  id: string,
): Promise<boolean> {
  const now = new Date().toISOString()
  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb.from('user_notifications').select('*').eq('id', id).maybeSingle()
    if (error) {
      if (isMissingSchemaError(error.message)) supabaseSchemaUnavailable = true
      else throw new Error(error.message)
    } else if (data) {
      const item = rowToNotif(data)
      if (!matchesUser(item, userId, email)) return false
      const { error: upd } = await sb
        .from('user_notifications')
        .update({ dismissed_at: now, read_at: item.readAt || now })
        .eq('id', id)
      if (upd) throw new Error(upd.message)
      return true
    } else {
      return false
    }
  }

  const snap = readFileStore()
  const item = snap.items.find((n) => n.id === id && matchesUser(n, userId, email))
  if (!item) return false
  item.dismissedAt = now
  item.readAt = item.readAt || now
  writeFileStore(snap)
  return true
}

export async function listAllNotifications(limit = 300): Promise<UserNotification[]> {
  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb
      .from('user_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) {
      if (isMissingSchemaError(error.message)) supabaseSchemaUnavailable = true
      else throw new Error(error.message)
    } else {
      return (data || []).map(rowToNotif)
    }
  }
  return readFileStore()
    .items.slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
}

/** Fan-out a push/inbox notification to many users (admin broadcast). */
export async function broadcastNotifications(opts: {
  recipients: { userId: string; email?: string | null }[]
  title: string
  body: string
  type?: UserNotificationType
  href?: string | null
  imageUrl?: string | null
}): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0
  const dedupeBase = `broadcast:${Date.now()}`
  for (const r of opts.recipients) {
    const userId = String(r.userId || r.email || '').trim()
    if (!userId) {
      failed += 1
      continue
    }
    const n = await notifyUser({
      userId,
      email: r.email,
      title: opts.title,
      body: opts.body,
      type: opts.type || 'info',
      href: opts.href,
      imageUrl: opts.imageUrl,
      dedupeKey: `${dedupeBase}:${userId}`,
    })
    if (n) sent += 1
    else failed += 1
  }
  return { sent, failed }
}
