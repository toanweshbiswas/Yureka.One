import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { normalizeEmail } from '../mail/emailAddress.js'
import type { WwChatMessage, WwChatThread, WwMember, WwMemberRole } from './types.js'
import {
  getOrg,
  getTrip,
  listMembers,
  listRegistrations,
  listTrips,
  memberCanAccessTrip,
  membershipsForIdentity,
  registrationsForIdentity,
} from './store.js'
import { communicateWwEvent } from './communicate.js'

type ChatStore = { messages: WwChatMessage[] }

let sb: SupabaseClient | null = null
let supabaseChatUnavailable = false

function chatFilePath() {
  return path.join(process.cwd(), 'data', 'wanderworld_chat.json')
}

function nowIso() {
  return new Date().toISOString()
}

function getSupabase(): SupabaseClient | null {
  if (supabaseChatUnavailable) return null
  if (sb) return sb
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  sb = createClient(url, key, { auth: { persistSession: false } })
  return sb
}

function isMissingTable(msg: string | undefined) {
  const t = String(msg || '').toLowerCase()
  return t.includes('does not exist') || t.includes('could not find') || t.includes('schema cache')
}

function readChatStore(): ChatStore {
  const p = chatFilePath()
  try {
    if (!fs.existsSync(p)) {
      const empty: ChatStore = { messages: [] }
      fs.mkdirSync(path.dirname(p), { recursive: true })
      fs.writeFileSync(p, JSON.stringify(empty, null, 2))
      return empty
    }
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as ChatStore
  } catch {
    const empty: ChatStore = { messages: [] }
    writeChatStore(empty)
    return empty
  }
}

function writeChatStore(snap: ChatStore) {
  const dest = chatFilePath()
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, JSON.stringify(snap, null, 2))
}

function rowToMessage(row: any): WwChatMessage {
  return {
    id: row.id,
    orgId: row.org_id ?? row.orgId,
    tripId: row.trip_id ?? row.tripId,
    authorUserId: row.author_user_id ?? row.authorUserId,
    authorEmail: row.author_email ?? row.authorEmail ?? null,
    authorName: row.author_name ?? row.authorName ?? '',
    authorRole: row.author_role ?? row.authorRole ?? 'traveler',
    body: row.body,
    createdAt: row.created_at ?? row.createdAt,
  }
}

async function syncMessageToSupabase(msg: WwChatMessage): Promise<void> {
  const c = getSupabase()
  if (!c) return
  try {
    const { error } = await c.from('wanderworld_messages').upsert(
      {
        id: msg.id,
        org_id: msg.orgId,
        trip_id: msg.tripId,
        author_user_id: msg.authorUserId,
        author_email: msg.authorEmail,
        author_name: msg.authorName,
        author_role: msg.authorRole,
        body: msg.body,
        created_at: msg.createdAt,
      },
      { onConflict: 'id' },
    )
    if (error && isMissingTable(error.message)) supabaseChatUnavailable = true
  } catch {
    /* best-effort mirror */
  }
}

async function loadMessagesFromSupabase(tripId: string, limit: number): Promise<WwChatMessage[] | null> {
  const c = getSupabase()
  if (!c || supabaseChatUnavailable) return null
  try {
    const { data, error } = await c
      .from('wanderworld_messages')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) {
      if (isMissingTable(error.message)) supabaseChatUnavailable = true
      return null
    }
    return (data || []).map(rowToMessage).reverse()
  } catch {
    return null
  }
}

function authorRoleFromMember(role: WwMemberRole): WwChatMessage['authorRole'] {
  if (role === 'owner') return 'owner'
  if (role === 'admin') return 'admin'
  return 'promoter'
}

async function userBookingsForTrip(
  userId: string,
  email: string | null | undefined,
  tripId: string,
) {
  const bookings = await registrationsForIdentity({ userId, email })
  return bookings.filter(
    (b) => b.trip?.id === tripId && b.registration.status !== 'cancelled',
  )
}

export async function userHasTripChatAccess(opts: {
  userId: string
  email?: string | null
  tripId: string
}): Promise<{ allowed: boolean; member: WwMember | null; role: WwChatMessage['authorRole'] }> {
  const trip = await getTrip(opts.tripId)
  if (!trip) return { allowed: false, member: null, role: 'traveler' }

  const memberships = await membershipsForIdentity({
    userId: opts.userId,
    email: opts.email,
  })
  const member = memberships[0]?.member || null
  if (member && memberCanAccessTrip(member, opts.tripId)) {
    return { allowed: true, member, role: authorRoleFromMember(member.role) }
  }

  const hits = await userBookingsForTrip(opts.userId, opts.email, opts.tripId)
  return { allowed: hits.length > 0, member: null, role: 'traveler' }
}

async function tripParticipantCount(tripId: string): Promise<number> {
  const rows = await listRegistrations({ tripId })
  const emails = new Set<string>()
  for (const { registration, installments } of rows) {
    if (registration.status === 'cancelled') continue
    emails.add(normalizeEmail(registration.buyerEmail) || registration.buyerEmail)
    for (const inst of installments) {
      const em = normalizeEmail(inst.claimedByEmail ?? '')
      if (em) emails.add(em)
    }
  }
  return emails.size
}

async function buildThread(
  tripId: string,
  chat: ChatStore,
  tripMeta?: { title: string; slug: string; coverImageUrl?: string | null },
): Promise<WwChatThread | null> {
  const trip = tripMeta || (await getTrip(tripId))
  if (!trip) return null
  const msgs = chat.messages.filter((m) => m.tripId === tripId)
  const last = msgs.length ? msgs[msgs.length - 1] : null
  return {
    tripId,
    tripTitle: trip.title,
    tripSlug: trip.slug,
    coverImageUrl: trip.coverImageUrl || null,
    participantCount: await tripParticipantCount(tripId),
    lastMessage: last
      ? {
          body: last.body.slice(0, 120),
          authorName: last.authorName,
          createdAt: last.createdAt,
        }
      : null,
  }
}

export async function listChatThreadsForUser(opts: {
  userId: string
  email?: string | null
}): Promise<WwChatThread[]> {
  const chat = readChatStore()
  const tripIds = new Set<string>()

  const bookings = await registrationsForIdentity({
    userId: opts.userId,
    email: opts.email,
  })
  for (const b of bookings) {
    if (b.trip && b.registration.status !== 'cancelled') {
      tripIds.add(b.trip.id)
    }
  }

  const memberships = await membershipsForIdentity({
    userId: opts.userId,
    email: opts.email,
  })
  const member = memberships[0]?.member || null
  if (member) {
    const trips = await listTrips({ status: 'all' })
    for (const t of trips) {
      if (!memberCanAccessTrip(member, t.id)) continue
      if (t.status === 'published' || t.status === 'closed') {
        tripIds.add(t.id)
      }
    }
  }

  const threads: WwChatThread[] = []
  for (const tripId of tripIds) {
    const thread = await buildThread(tripId, chat)
    if (thread) threads.push(thread)
  }

  return threads.sort((a, b) => {
    const ta = a.lastMessage?.createdAt || ''
    const tb = b.lastMessage?.createdAt || ''
    if (ta !== tb) return tb.localeCompare(ta)
    return a.tripTitle.localeCompare(b.tripTitle)
  })
}

export async function listTripMessages(
  tripId: string,
  opts?: { since?: string; limit?: number },
): Promise<WwChatMessage[]> {
  const limit = Math.min(Math.max(opts?.limit || 80, 1), 200)
  const fromDb = await loadMessagesFromSupabase(tripId, limit)
  let msgs = fromDb ?? readChatStore().messages.filter((m) => m.tripId === tripId)

  if (opts?.since) {
    const since = opts.since
    msgs = msgs.filter((m) => m.createdAt > since)
  } else {
    msgs = msgs.slice(-limit)
  }

  return msgs.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

async function notifyChatParticipants(opts: {
  message: WwChatMessage
  senderUserId: string
  senderEmail?: string | null
}) {
  const trip = await getTrip(opts.message.tripId)
  if (!trip) return

  const senderEmail = opts.senderEmail ? normalizeEmail(opts.senderEmail) : null
  const senderUid = String(opts.senderUserId || '').trim()

  const isSender = (uid: string, em: string | null | undefined) => {
    const id = String(uid || '').trim()
    const e = em ? normalizeEmail(em) : null
    if (id && senderUid && id === senderUid) return true
    if (senderEmail && e && e === senderEmail) return true
    if (senderEmail && id && normalizeEmail(id) === senderEmail) return true
    return false
  }

  const resolveNotifyUserId = (uid: string, em: string | null | undefined) => {
    const id = String(uid || '').trim()
    if (id && !id.startsWith('group:')) return id
    const e = em ? normalizeEmail(em) : normalizeEmail(id)
    return e || id
  }

  type Recipient = { userId: string; email: string | null; isStaff: boolean }
  const recipients = new Map<string, Recipient>()

  const add = (uid: string, em: string | null | undefined, isStaff: boolean) => {
    if (isSender(uid, em)) return
    const notifyId = resolveNotifyUserId(uid, em)
    if (!notifyId) return
    const email = em ? normalizeEmail(em) : normalizeEmail(uid) || null
    recipients.set(notifyId, { userId: notifyId, email, isStaff })
  }

  const rows = await listRegistrations({ tripId: opts.message.tripId })
  for (const { registration, installments } of rows) {
    if (registration.status === 'cancelled') continue
    add(registration.userId, registration.buyerEmail, false)
    for (const inst of installments) {
      if (!inst.claimedByUserId && !inst.claimedByEmail) continue
      add(inst.claimedByUserId || inst.claimedByEmail || '', inst.claimedByEmail, false)
    }
  }

  for (const m of await listMembers()) {
    if (!memberCanAccessTrip(m, opts.message.tripId)) continue
    add(m.userId || m.email, m.email, true)
  }

  const preview = opts.message.body.slice(0, 140)
  const sends = [...recipients.values()].map((r) =>
    communicateWwEvent({
      event: 'chat_message',
      userId: r.userId,
      email: r.email,
      payload: {
        trip,
        senderName: opts.message.authorName,
        messagePreview: preview,
        updateNote: `${opts.message.authorName}: ${preview}`,
        chatMessageId: opts.message.id,
        isStaffRecipient: r.isStaff,
      },
      channels: ['inbox'],
    }),
  )
  await Promise.all(sends)
}

export async function postTripMessage(opts: {
  userId: string
  email?: string | null
  name?: string | null
  tripId: string
  body: string
}): Promise<WwChatMessage | { error: string }> {
  const text = String(opts.body || '').trim()
  if (!text) return { error: 'Message required' }
  if (text.length > 2000) return { error: 'Message too long (max 2000 characters)' }

  const trip = await getTrip(opts.tripId)
  if (!trip) return { error: 'Trip not found' }

  const access = await userHasTripChatAccess({
    userId: opts.userId,
    email: opts.email,
    tripId: trip.id,
  })
  if (!access.allowed) return { error: 'You do not have access to this trip chat' }

  const org = getOrg()
  const msg: WwChatMessage = {
    id: randomUUID(),
    orgId: org.id,
    tripId: trip.id,
    authorUserId: opts.userId,
    authorEmail: normalizeEmail(opts.email ?? '') || null,
    authorName: String(opts.name || opts.email?.split('@')[0] || 'Traveler').trim(),
    authorRole: access.role,
    body: text,
    createdAt: nowIso(),
  }

  const snap = readChatStore()
  snap.messages.push(msg)
  if (snap.messages.length > 8000) snap.messages = snap.messages.slice(-6000)
  writeChatStore(snap)
  void syncMessageToSupabase(msg)

  await notifyChatParticipants({
    message: msg,
    senderUserId: opts.userId,
    senderEmail: opts.email,
  })

  return msg
}
