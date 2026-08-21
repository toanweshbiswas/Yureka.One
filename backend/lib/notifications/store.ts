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

function matchesUser(n: UserNotification, userId: string, email?: string | null) {
  if (n.userId === userId) return true
  if (email && n.email && n.email.toLowerCase() === email.toLowerCase()) return true
  if (email && n.userId.toLowerCase() === email.toLowerCase()) return true
  return false
}

function identityKeys(userId: string, email?: string | null): string[] {
  const keys = new Set<string>()
  const id = String(userId || '').trim()
  if (id) keys.add(id)
  const em = email ? String(email).trim().toLowerCase() : ''
  if (em) keys.add(em)
  return [...keys]
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
  const keys = identityKeys(userId, email)
  const sb = sbClient()
  if (sb) {
    const byUser = await sb
      .from('user_notifications')
      .select('*')
      .is('dismissed_at', null)
      .in('user_id', keys)
      .order('created_at', { ascending: false })
      .limit(50)
    if (byUser.error) {
      if (isMissingSchemaError(byUser.error.message)) {
        supabaseSchemaUnavailable = true
      } else {
        throw new Error(byUser.error.message)
      }
    } else {
      const map = new Map<string, UserNotification>()
      for (const row of byUser.data || []) map.set(row.id, rowToNotif(row))
      if (email) {
        const byEmail = await sb
          .from('user_notifications')
          .select('*')
          .is('dismissed_at', null)
          .eq('email', email)
          .order('created_at', { ascending: false })
          .limit(50)
        if (!byEmail.error) {
          for (const row of byEmail.data || []) map.set(row.id, rowToNotif(row))
        }
      }
      const items = [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50)
      return { items, unreadCount: items.filter((n) => !n.readAt).length }
    }
  }

  const items = readFileStore()
    .items.filter((n) => !n.dismissedAt && matchesUser(n, userId, email))
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
