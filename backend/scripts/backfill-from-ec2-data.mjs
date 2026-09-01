#!/usr/bin/env node
/**
 * Restore Supabase data from EC2/local file stores (data/*.json).
 * Source of truth when the old Supabase project is gone — rsync from EC2 first:
 *   rsync -avz -e "ssh -i yureka.pem" ec2-user@13.57.223.228:/opt/yureka-one/data/ ./data/
 *
 * Usage:
 *   node backend/scripts/backfill-from-ec2-data.mjs
 *   node backend/scripts/backfill-from-ec2-data.mjs --dry-run
 */
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const DATA = path.join(ROOT, 'data')
dotenv.config({ path: path.join(ROOT, '.env') })

const dryRun = process.argv.includes('--dry-run')
const stats = {}

function bump(key, n = 1) {
  stats[key] = (stats[key] || 0) + n
}

function safeKey(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9._@+-]/g, '_').slice(0, 180)
}

function isMissingTable(err) {
  const text = String(err?.message || err || '').toLowerCase()
  return text.includes('could not find') || text.includes('does not exist') || text.includes('schema cache')
}

function buildWaitlistNotes(row) {
  if (row.notes && String(row.notes).trim()) return row.notes
  const meta = {}
  if (row.scoreDecision) meta.scoreDecision = row.scoreDecision
  if (row.scoreMetrics) meta.scoreMetrics = row.scoreMetrics
  if (row.yurekaScore != null) meta.yurekaScore = row.yurekaScore
  return Object.keys(meta).length ? JSON.stringify(meta) : null
}

function pickBestWaitlistRow(rows) {
  return [...rows].sort((a, b) => {
    const scoreA = a.yurekaScore != null ? 1 : 0
    const scoreB = b.yurekaScore != null ? 1 : 0
    if (scoreB !== scoreA) return scoreB - scoreA
    const tA = new Date(a.updatedAt || a.createdAt || 0).getTime()
    const tB = new Date(b.updatedAt || b.createdAt || 0).getTime()
    return tB - tA
  })[0]
}

/** @type {Map<string, string>} email -> waitlist uuid */
const emailToWaitlistId = new Map()

async function readJson(relPath, fallback = null) {
  try {
    const raw = await fs.readFile(path.join(DATA, relPath), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

async function migrateWaitlist(sb) {
  const admin = await readJson('admin_store.json', { waitlist: [], admins: [] })
  const byEmail = new Map()
  for (const row of admin.waitlist || []) {
    const email = String(row.email || '').trim().toLowerCase()
    if (!email) continue
    if (!byEmail.has(email)) byEmail.set(email, [])
    byEmail.get(email).push(row)
  }

  for (const [email, rows] of byEmail) {
    const best = pickBestWaitlistRow(rows)
    const payload = {
      id: best.id,
      email,
      full_name: best.fullName ?? null,
      mobile_number: best.mobileNumber ?? null,
      status: best.status || 'pending',
      yureka_score: best.yurekaScore ?? null,
      monthly_spend: best.monthlySpend ?? null,
      top_category: best.topCategory ?? null,
      notes: buildWaitlistNotes(best),
      created_at: best.createdAt || new Date().toISOString(),
      updated_at: best.updatedAt || best.createdAt || new Date().toISOString(),
    }
    console.log(`${dryRun ? '[dry-run] ' : ''}waitlist ${email} (${payload.status}, score=${payload.yureka_score ?? '—'})`)
    if (!dryRun) {
      const { data, error } = await sb.from('waitlist').upsert(payload, { onConflict: 'email' }).select('id,email').single()
      if (error) {
        console.warn('  waitlist failed:', error.message)
        continue
      }
      emailToWaitlistId.set(email, data.id)
    } else {
      emailToWaitlistId.set(email, best.id)
    }
    bump('waitlist')
  }
}

async function migrateAdmins(sb) {
  const admin = await readJson('admin_store.json', { admins: [] })
  for (const row of admin.admins || []) {
    const email = String(row.email || '').trim().toLowerCase()
    if (!email) continue
    const payload = {
      id: row.id,
      email,
      full_name: row.fullName ?? null,
      role: row.role || 'admin',
      created_at: row.createdAt || new Date().toISOString(),
    }
    console.log(`${dryRun ? '[dry-run] ' : ''}admin ${email}`)
    if (!dryRun) {
      const { error } = await sb.from('admin_users').upsert(payload, { onConflict: 'email' })
      if (error) console.warn('  admin failed:', error.message)
    }
    bump('admin_users')
  }
}

function resolveUserId(rawUserId, gmail) {
  const email = String(gmail || rawUserId || '').trim().toLowerCase()
  if (email.includes('@') && emailToWaitlistId.has(email)) {
    return emailToWaitlistId.get(email)
  }
  return rawUserId || (email.includes('@') ? `email:${safeKey(email)}` : String(rawUserId || ''))
}

async function migrateLedgerCache(sb) {
  const cacheDir = path.join(DATA, 'financial_cache')
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

  for (const file of files) {
    const data = JSON.parse(await fs.readFile(file, 'utf-8'))
    const profile = data.profile || {}
    const gmail = String(profile.email || '').trim().toLowerCase()
    const authEmail = gmail || path.basename(file, '.json').replace(/_/g, '@')
    if (!authEmail.includes('@')) continue

    const userId = resolveUserId(data.userId, authEmail)
    const row = {
      user_id: userId,
      gmail: gmail || authEmail,
      scanned_at: data.scannedAt || new Date().toISOString(),
      profile,
      transactions: Array.isArray(data.transactions) ? data.transactions : [],
      score: data.score ?? null,
      scan_version: data.scanVersion ?? 1,
    }
    console.log(`${dryRun ? '[dry-run] ' : ''}ledger ${row.gmail} (${row.transactions.length} tx, user=${userId.slice(0, 8)}…)`)
    if (!dryRun) {
      const { error } = await sb.from('financial_ledger_cache').upsert(row, { onConflict: 'user_id,gmail' })
      if (error) console.warn('  ledger failed:', error.message)
    }
    bump('financial_ledger_cache')
  }
}

async function migratePlanning(sb) {
  const store = await readJson('planning_store.json', { inboxes: [], budgets: [], entries: [] })

  for (const inbox of store.inboxes || []) {
    const row = {
      id: inbox.id,
      user_id: inbox.userId,
      gmail: inbox.gmail,
      connected_at: inbox.connectedAt || new Date().toISOString(),
      last_scanned_at: inbox.lastScannedAt ?? null,
      last_error: inbox.lastError ?? null,
    }
    if (!dryRun) {
      const { error } = await sb.from('planning_inboxes').upsert(row, { onConflict: 'user_id,gmail' })
      if (error) console.warn('  planning inbox failed:', error.message)
    }
    bump('planning_inboxes')
  }

  for (const budget of store.budgets || []) {
    const row = {
      id: budget.id,
      user_id: budget.userId,
      category: budget.category,
      monthly_limit_inr: budget.monthlyLimitInr ?? 0,
      month: budget.month,
    }
    if (!dryRun) {
      const { error } = await sb.from('planning_budgets').upsert(row, { onConflict: 'user_id,category,month' })
      if (error) console.warn('  planning budget failed:', error.message)
    }
    bump('planning_budgets')
  }

  for (const entry of store.entries || []) {
    const row = {
      id: entry.id,
      user_id: entry.userId,
      merchant: entry.merchant,
      amount_inr: entry.amountInr ?? 0,
      category: entry.category,
      date: entry.date,
      note: entry.note ?? null,
      created_at: entry.createdAt || new Date().toISOString(),
    }
    if (!dryRun) {
      const { error } = await sb.from('planning_entries').upsert(row, { onConflict: 'id' })
      if (error) console.warn('  planning entry failed:', error.message)
    }
    bump('planning_entries')
  }

  const cacheDir = path.join(DATA, 'planning_cache')
  async function walkCache(dir) {
    let entries = []
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) await walkCache(full)
      else if (ent.name.endsWith('.json')) {
        const data = JSON.parse(await fs.readFile(full, 'utf-8'))
        const userId = data.userId || path.basename(path.dirname(full))
        const gmail = data.gmail || path.basename(full, '.json').replace(/_/g, '@')
        const row = {
          user_id: userId,
          gmail,
          scanned_at: data.scannedAt || new Date().toISOString(),
          transactions: Array.isArray(data.transactions) ? data.transactions : [],
        }
        if (!dryRun) {
          const { error } = await sb.from('planning_inbox_cache').upsert(row, { onConflict: 'user_id,gmail' })
          if (error) console.warn('  planning cache failed:', error.message)
        }
        bump('planning_inbox_cache')
      }
    }
  }
  await walkCache(cacheDir)
}

async function migrateGoldback(sb) {
  const store = await readJson('goldback_store.json', { accounts: {}, ledger: [] })

  for (const account of Object.values(store.accounts || {})) {
    const row = {
      user_id: account.userId,
      balance_paise: account.balancePaise ?? 0,
      updated_at: account.updatedAt || new Date().toISOString(),
    }
    if (!dryRun) {
      const { error } = await sb.from('goldback_accounts').upsert(row, { onConflict: 'user_id' })
      if (error) console.warn('  goldback account failed:', error.message)
    }
    bump('goldback_accounts')
  }

  for (const entry of store.ledger || []) {
    const row = {
      id: entry.id,
      user_id: entry.userId,
      type: entry.type,
      amount_paise: entry.amountPaise ?? 0,
      offer_id: entry.offerId ?? null,
      status: entry.status,
      idempotency_key: entry.idempotencyKey,
      meta: entry.meta ?? {},
      created_at: entry.createdAt || new Date().toISOString(),
    }
    if (!dryRun) {
      let { error } = await sb.from('goldback_ledger').upsert(row, { onConflict: 'id' })
      if (error && /offer_id_fkey|foreign key/i.test(error.message || '')) {
        row.offer_id = null
        ;({ error } = await sb.from('goldback_ledger').upsert(row, { onConflict: 'id' }))
      }
      if (error) console.warn('  goldback ledger failed:', error.message)
    }
    bump('goldback_ledger')
  }
}

async function migrateHubble(sb) {
  const store = await readJson('hubble_orders_store.json', { orders: [] })

  for (const order of store.orders || []) {
    const row = {
      id: order.id,
      user_id: order.userId,
      reference_id: order.referenceId,
      hubble_order_id: order.hubbleOrderId ?? null,
      product_id: order.productId,
      product_title: order.productTitle || '',
      amount_inr: order.amountInr,
      denomination: order.denomination,
      quantity: order.quantity ?? 1,
      status: order.status || 'PENDING',
      failure_reason: order.failureReason ?? null,
      customer_name: order.customerName ?? null,
      customer_email: order.customerEmail ?? null,
      customer_phone: order.customerPhone ?? null,
      razorpay_order_id: order.razorpayOrderId ?? null,
      razorpay_payment_id: order.razorpayPaymentId ?? null,
      payment_status: order.paymentStatus || 'unpaid',
      is_gift: Boolean(order.isGift),
      recipient_name: order.recipientName ?? null,
      recipient_email: order.recipientEmail ?? null,
      gift_message: order.giftMessage ?? null,
      guest_token: order.guestToken ?? null,
      raw_response: {
        payment: {
          status: order.paymentStatus || 'unpaid',
          razorpayOrderId: order.razorpayOrderId ?? null,
          razorpayPaymentId: order.razorpayPaymentId ?? null,
        },
        guestToken: order.guestToken ?? null,
        ...(order.isGift
          ? {
              gift: {
                isGift: true,
                recipientName: order.recipientName,
                recipientEmail: order.recipientEmail,
                giftMessage: order.giftMessage,
              },
            }
          : {}),
      },
      created_at: order.createdAt || new Date().toISOString(),
      updated_at: order.updatedAt || order.createdAt || new Date().toISOString(),
    }
    console.log(`${dryRun ? '[dry-run] ' : ''}hubble ${order.referenceId} (${order.status})`)
    if (!dryRun) {
      const { error } = await sb.from('hubble_orders').upsert(row, { onConflict: 'reference_id' })
      if (error) {
        console.warn('  hubble order failed:', error.message)
        continue
      }
      if (Array.isArray(order.vouchers) && order.vouchers.length) {
        await sb.from('hubble_vouchers').delete().eq('order_id', order.id)
        const vouchers = order.vouchers.map((v) => ({
          id: v.id,
          order_id: order.id,
          hubble_voucher_id: v.hubbleVoucherId ?? null,
          card_type: v.cardType ?? null,
          card_number: v.cardNumber ?? null,
          card_pin: v.cardPin ?? null,
          amount: v.amount ?? null,
          valid_till: v.validTill ?? null,
          created_at: v.createdAt || new Date().toISOString(),
        }))
        const { error: vErr } = await sb.from('hubble_vouchers').upsert(vouchers, { onConflict: 'id' })
        if (vErr) console.warn('  hubble vouchers failed:', vErr.message)
        else bump('hubble_vouchers', vouchers.length)
      }
    }
    bump('hubble_orders')
  }
}

async function migrateSuperBrowse(sb) {
  const store = await readJson('super_browse_stores.json', { stores: [] })
  for (const s of store.stores || []) {
    const row = {
      id: s.id,
      name: s.name,
      domain: s.domain,
      url: s.url,
      logo_url: s.logoUrl ?? null,
      cashback: s.cashback ?? null,
      bg: s.bg ?? '#ffffff',
      active: s.active !== false,
      sort_order: s.sortOrder ?? 0,
      updated_at: s.updatedAt || new Date().toISOString(),
    }
    if (!dryRun) {
      const { error } = await sb.from('super_browse_stores').upsert(row, { onConflict: 'id' })
      if (error) console.warn('  super browse failed:', error.message)
    }
    bump('super_browse_stores')
  }
}

async function migrateNotifications(sb) {
  const store = await readJson('user_notifications.json', { items: [] })
  for (const n of store.items || []) {
    const row = {
      id: n.id,
      user_id: n.userId,
      email: n.email ?? null,
      title: n.title,
      body: n.body ?? '',
      type: n.type || 'info',
      href: n.href ?? null,
      image_url: n.imageUrl ?? null,
      dedupe_key: n.dedupeKey ?? null,
      read_at: n.readAt ?? null,
      dismissed_at: n.dismissedAt ?? null,
      created_at: n.createdAt || new Date().toISOString(),
    }
    if (!dryRun) {
      const { error } = await sb.from('user_notifications').upsert(row, { onConflict: 'id' })
      if (error && error.code !== '23505') console.warn('  notification failed:', error.message)
    }
    bump('user_notifications')
  }
}

async function migrateCareers(sb) {
  const store = await readJson('careers_store.json', { roles: [] })
  for (const r of store.roles || []) {
    const row = {
      id: r.id,
      ref_id: r.refId,
      title: r.title,
      department: r.department || 'General',
      location: r.location || 'Bengaluru',
      type: r.type || 'Full-time',
      description: r.description || '',
      apply_email: r.applyEmail || 'support@yureka.one',
      status: r.status || 'draft',
      sort_order: r.sortOrder ?? 0,
      created_at: r.createdAt || new Date().toISOString(),
      updated_at: r.updatedAt || r.createdAt || new Date().toISOString(),
    }
    if (!dryRun) {
      const { error } = await sb.from('cms_careers').upsert(row, { onConflict: 'ref_id' })
      if (error) console.warn('  career failed:', error.message)
    }
    bump('cms_careers')
  }
}

async function migrateBlogs(sb) {
  const store = await readJson('blogs_store.json', { posts: [] })
  if (!store.posts?.length) return

  const { error: probe } = await sb.from('cms_blogs').select('id').limit(1)
  if (probe && isMissingTable(probe)) {
    console.log('cms_blogs table missing — skipping (data remains in data/blogs_store.json)')
    return
  }

  for (const p of store.posts) {
    const row = {
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt ?? '',
      content: p.content ?? '',
      content_format: p.contentFormat || 'markdown',
      author: p.author ?? '',
      category: p.category ?? '',
      image: p.image ?? null,
      featured: Boolean(p.featured),
      read_time: p.readTime ?? null,
      status: p.status || 'draft',
      notified_at: p.notifiedAt ?? null,
      created_at: p.createdAt || new Date().toISOString(),
      updated_at: p.updatedAt || p.createdAt || new Date().toISOString(),
      published_at: p.publishedAt ?? null,
    }
    if (!dryRun) {
      const { error } = await sb.from('cms_blogs').upsert(row, { onConflict: 'id' })
      if (error) console.warn('  blog failed:', error.message)
    }
    bump('cms_blogs')
  }
}

async function migrateWanderworld(sb) {
  const raw = await readJson('wanderworld_store.json', null)
  if (!raw?.org) {
    console.log('wanderworld_store.json missing — skip')
    return
  }
  const snap = raw
  if (dryRun) {
    console.log('[dry-run] wanderworld sync', {
      trips: snap.trips?.length ?? 0,
      registrations: snap.registrations?.length ?? 0,
      installments: snap.installments?.length ?? 0,
    })
    bump('wanderworld')
    return
  }

  const isMissingTable = (msg) => {
    const t = String(msg || '').toLowerCase()
    return t.includes('does not exist') || t.includes('could not find') || t.includes('schema cache')
  }

  try {
    const { error: orgErr } = await sb.from('wanderworld_orgs').upsert({
      id: snap.org.id,
      name: snap.org.name,
      slug: snap.org.slug,
      created_at: snap.org.createdAt,
    })
    if (orgErr && isMissingTable(orgErr.message)) {
      console.log('wanderworld tables missing — run migration 017/021 first; skipping')
      return
    }
    if (orgErr) console.warn('  wanderworld org failed:', orgErr.message)

    if (snap.members?.length) {
      const { error } = await sb.from('wanderworld_members').upsert(
        snap.members.map((m) => ({
          id: m.id,
          org_id: m.orgId,
          email: m.email,
          user_id: m.userId || null,
          role: m.role,
          invited_at: m.invitedAt,
          joined_at: m.joinedAt || null,
          display_name: m.displayName || null,
          phone: m.phone || null,
          city: m.city || null,
          bio: m.bio || null,
          instagram: m.instagram || null,
          assigned_trip_ids: m.assignedTripIds || [],
        })),
        { onConflict: 'id' },
      )
      if (error) console.warn('  wanderworld members failed:', error.message)
    }

    if (snap.trips?.length) {
      const { error } = await sb.from('wanderworld_trips').upsert(
        snap.trips.map((t) => ({
          id: t.id,
          org_id: t.orgId,
          title: t.title,
          slug: t.slug,
          description: t.description || '',
          itinerary: t.itinerary || '',
          price_inr: t.priceInr,
          seats: t.seats,
          seats_taken: t.seatsTaken,
          start_date: t.startDate || null,
          end_date: t.endDate || null,
          cover_image_url: t.coverImageUrl || null,
          status: t.status,
          payment_plans_enabled: Boolean(t.paymentPlansEnabled),
          plan_template: t.planTemplate || [],
          group_booking_enabled: Boolean(t.groupBookingEnabled),
          group_seats: t.groupSeats ?? 0,
          group_seats_taken: t.groupSeatsTaken ?? 0,
          group_discount_type: t.groupDiscountType || 'percent',
          group_discount_value: t.groupDiscountValue ?? 0,
          group_min_size: t.groupMinSize ?? 2,
          group_max_size: t.groupMaxSize ?? 20,
          created_at: t.createdAt,
          updated_at: t.updatedAt,
        })),
        { onConflict: 'id' },
      )
      if (error) console.warn('  wanderworld trips failed:', error.message)
    }

    if (snap.promoterLinks?.length) {
      const { error } = await sb.from('wanderworld_promoter_links').upsert(
        snap.promoterLinks.map((l) => ({
          id: l.id,
          org_id: l.orgId,
          member_id: l.memberId,
          code: l.code,
          trip_id: l.tripId || null,
          previous_codes: l.previousCodes || [],
          click_count: l.clickCount ?? 0,
          last_clicked_at: l.lastClickedAt || null,
          created_at: l.createdAt,
        })),
        { onConflict: 'id' },
      )
      if (error) console.warn('  wanderworld promoter links failed:', error.message)
    }

    if (snap.registrations?.length) {
      const { error } = await sb.from('wanderworld_registrations').upsert(
        snap.registrations.map((r) => ({
          id: r.id,
          org_id: r.orgId,
          trip_id: r.tripId,
          user_id: String(r.userId || r.id),
          buyer_email: r.buyerEmail,
          buyer_name: r.buyerName,
          buyer_phone: r.buyerPhone || null,
          promoter_code: r.promoterCode || null,
          payment_mode: r.paymentMode,
          status: r.status,
          amount_due_inr: r.amountDueInr,
          amount_paid_inr: r.amountPaidInr,
          notes: r.notes || null,
          city: r.city || null,
          group_size: r.groupSize ?? null,
          is_group: Boolean(r.isGroup),
          join_code: r.joinCode || null,
          per_seat_inr: r.perSeatInr ?? null,
          list_price_inr: r.listPriceInr ?? null,
          discount_inr: r.discountInr ?? null,
          booked_by_member_id: r.bookedByMemberId || null,
          created_at: r.createdAt,
          updated_at: r.updatedAt,
        })),
        { onConflict: 'id' },
      )
      if (error) console.warn('  wanderworld registrations failed:', error.message)
    }

    if (snap.installments?.length) {
      const { error } = await sb.from('wanderworld_installments').upsert(
        snap.installments.map((i) => ({
          id: i.id,
          registration_id: i.registrationId,
          sequence: i.sequence,
          label: i.label,
          amount_inr: i.amountInr,
          due_at: i.dueAt,
          status: i.status,
          razorpay_order_id: i.razorpayOrderId || null,
          razorpay_payment_id: i.razorpayPaymentId || null,
          paid_at: i.paidAt || null,
          payment_method: i.paymentMethod || null,
          collected_by_member_id: i.collectedByMemberId || null,
          cash_note: i.cashNote || null,
          claimed_by_user_id: i.claimedByUserId || null,
          claimed_by_email: i.claimedByEmail || null,
          claimed_by_name: i.claimedByName || null,
          claimed_at: i.claimedAt || null,
        })),
        { onConflict: 'id' },
      )
      if (error) console.warn('  wanderworld installments failed:', error.message)
    }

    bump('wanderworld')
    console.log('wanderworld snapshot synced to Supabase')
  } catch (e) {
    if (!isMissingTable(e?.message)) console.warn('  wanderworld sync failed:', e?.message || e)
  }
}

async function printCounts(sb) {
  const tables = [
    'waitlist',
    'admin_users',
    'financial_ledger_cache',
    'planning_inboxes',
    'planning_budgets',
    'planning_inbox_cache',
    'goldback_accounts',
    'goldback_ledger',
    'hubble_orders',
    'super_browse_stores',
    'user_notifications',
    'cms_careers',
    'wanderworld_trips',
    'wanderworld_registrations',
  ]
  console.log('\n--- Supabase row counts ---')
  for (const table of tables) {
    const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true })
    console.log(`${table}: ${error ? `error (${error.message})` : count ?? 0}`)
  }
}

async function main() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env')
    process.exit(1)
  }

  const sb = createClient(url, key, { auth: { persistSession: false } })
  console.log(`Backfill from ${DATA} → ${url}${dryRun ? ' (dry-run)' : ''}\n`)

  await migrateWaitlist(sb)
  await migrateAdmins(sb)
  await migrateLedgerCache(sb)
  await migratePlanning(sb)
  await migrateGoldback(sb)
  await migrateHubble(sb)
  await migrateSuperBrowse(sb)
  await migrateNotifications(sb)
  await migrateCareers(sb)
  await migrateBlogs(sb)
  await migrateWanderworld(sb)

  console.log('\n--- Migrated ---')
  for (const [k, v] of Object.entries(stats)) console.log(`${k}: ${v}`)

  if (!dryRun) await printCounts(sb)
  console.log('\nNote: wanderworld + blogs (if cms_blogs missing) stay in data/*.json — rsync data/ to EC2 on deploy.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
