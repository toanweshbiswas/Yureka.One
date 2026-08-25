import { listWaitlist, type WaitlistRow } from './store.js'
import { listAllAccounts, listAllClicks, listAllLedger, listAllOffers } from '../goldback/store.js'
import { listAllOrders } from '../hubble/store.js'
import { listAllNotifications } from '../notifications/store.js'
import { parseWaitlistMeta } from '../waitlist/public.js'
import type { GoldbackBalance, GoldbackLedgerEntry } from '../goldback/types.js'
import type { StoredOrder } from '../hubble/types.js'
import type { UserNotification } from '../notifications/types.js'

export type AdminActivityKind =
  | 'waitlist'
  | 'goldback'
  | 'gift'
  | 'click'
  | 'notification'

export interface AdminDayPoint {
  date: string
  waitlist: number
  goldback: number
  gifts: number
  clicks: number
}

export interface AdminNamedCount {
  key: string
  label: string
  count: number
  value?: number
}

export interface AdminActivityEvent {
  id: string
  at: string
  kind: AdminActivityKind
  title: string
  subtitle: string
  userKey: string
  amountLabel?: string | null
}

export interface AdminUserRollup {
  key: string
  email: string | null
  name: string | null
  mobileNumber: string | null
  status: string
  score: number | null
  scoreDecision: string | null
  scoreMetrics: Record<string, unknown> | null
  goldbackPaise: number
  giftOrders: number
  giftSpendInr: number
  offerClicks: number
  lastActiveAt: string | null
  pwaInstalled: boolean
  pwaLastSeenAt: string | null
  pwaPlatform: string | null
}

export interface AdminGiftOrderRow {
  id: string
  userId: string
  email: string | null
  productTitle: string
  amountInr: number
  status: string
  paymentStatus: string
  createdAt: string
}

export interface AdminOverview {
  generatedAt: string
  kpis: {
    waitlistTotal: number
    pending: number
    accepted: number
    rejected: number
    onHold: number
    scored: number
    avgScore: number | null
    goldbackAccounts: number
    goldbackOutstandingPaise: number
    goldbackEarnedPaise: number
    goldbackEarns: number
    giftOrders: number
    giftPaidInr: number
    giftSuccess: number
    giftFailed: number
    offerClicks: number
    notifications: number
    activeUsers7d: number
    pwaInstalled: number
  }
  series: AdminDayPoint[]
  waitlistByStatus: AdminNamedCount[]
  goldbackByMerchant: AdminNamedCount[]
  giftsByStatus: AdminNamedCount[]
  scoreBuckets: AdminNamedCount[]
  activity: AdminActivityEvent[]
  users: AdminUserRollup[]
  giftOrders: AdminGiftOrderRow[]
}

function dayKey(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function lastNDays(n: number): string[] {
  const out: string[] = []
  const now = new Date()
  now.setUTCHours(0, 0, 0, 0)
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now)
    d.setUTCDate(now.getUTCDate() - i)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

function bump(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) || 0) + by)
}

function isEmail(value: string | null | undefined): boolean {
  return Boolean(value && value.includes('@'))
}

function shortUser(value: string | null | undefined) {
  const v = String(value || '').trim()
  if (!v) return 'unknown'
  if (isEmail(v)) return v
  return v.length > 12 ? `${v.slice(0, 8)}…` : v
}

async function safe<T>(label: string, fn: () => Promise<T>, fallback: T, ms = 12000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
      }),
    ])
  } catch (e: any) {
    console.warn(`[admin/overview] ${label}:`, e?.message || e)
    return fallback
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function buildAdminOverview(): Promise<AdminOverview> {
  const [waitlist, ledger, accounts, clicks, orders, notifications, offers] = await Promise.all([
    safe('waitlist', () => listWaitlist({ status: 'all' }), [] as WaitlistRow[]),
    safe('ledger', () => listAllLedger(2000), [] as GoldbackLedgerEntry[]),
    safe('accounts', () => listAllAccounts(), [] as GoldbackBalance[]),
    safe('clicks', () => listAllClicks(800), [] as { id: string; userId: string; offerId: string; createdAt: string }[]),
    safe('orders', () => listAllOrders(800), [] as StoredOrder[]),
    safe('notifications', () => listAllNotifications(400), [] as UserNotification[]),
    safe('offers', () => listAllOffers(), [] as { id: string; merchant: string; title: string }[]),
  ])

  const offerById = new Map(offers.map((o) => [o.id, o]))
  const uuidToEmail = new Map<string, string>()
  for (const o of orders) {
    if (o.userId && isEmail(o.customerEmail) && !isEmail(o.userId)) {
      uuidToEmail.set(o.userId, o.customerEmail.toLowerCase())
    }
  }

  const statusCounts = { pending: 0, accepted: 0, rejected: 0, on_hold: 0 }
  let scoreSum = 0
  let scored = 0
  for (const row of waitlist) {
    if (row.status === 'accepted') statusCounts.accepted += 1
    else if (row.status === 'rejected') statusCounts.rejected += 1
    else if (row.status === 'on_hold') statusCounts.on_hold += 1
    else statusCounts.pending += 1
    if (typeof row.yurekaScore === 'number' && Number.isFinite(row.yurekaScore)) {
      scoreSum += row.yurekaScore
      scored += 1
    }
  }

  const earned = ledger.filter((e) => e.type === 'earn' && e.status === 'earned')
  const goldbackEarnedPaise = earned.reduce((s, e) => s + Number(e.amountPaise || 0), 0)
  const goldbackOutstandingPaise = accounts.reduce((s, a) => s + Number(a.balancePaise || 0), 0)

  const giftPaid = orders.filter((o) => o.paymentStatus === 'paid' || o.status === 'SUCCESS')
  const giftPaidInr = giftPaid.reduce((s, o) => s + Number(o.amountInr || 0), 0)

  const days = lastNDays(30)
  const daySet = new Set(days)
  const waitlistDay = new Map<string, number>()
  const goldbackDay = new Map<string, number>()
  const giftDay = new Map<string, number>()
  const clickDay = new Map<string, number>()
  for (const row of waitlist) {
    const k = dayKey(row.createdAt)
    if (k && daySet.has(k)) bump(waitlistDay, k)
  }
  for (const e of earned) {
    const k = dayKey(e.createdAt)
    if (k && daySet.has(k)) bump(goldbackDay, k)
  }
  for (const o of orders) {
    const k = dayKey(o.createdAt)
    if (k && daySet.has(k)) bump(giftDay, k)
  }
  for (const c of clicks) {
    const k = dayKey(c.createdAt)
    if (k && daySet.has(k)) bump(clickDay, k)
  }
  const series: AdminDayPoint[] = days.map((date) => ({
    date,
    waitlist: waitlistDay.get(date) || 0,
    goldback: goldbackDay.get(date) || 0,
    gifts: giftDay.get(date) || 0,
    clicks: clickDay.get(date) || 0,
  }))

  const merchantMap = new Map<string, { count: number; paise: number }>()
  for (const e of earned) {
    const merchant = String(e.meta?.merchant || offerById.get(e.offerId || '')?.merchant || 'Other')
    const prev = merchantMap.get(merchant) || { count: 0, paise: 0 }
    merchantMap.set(merchant, { count: prev.count + 1, paise: prev.paise + Number(e.amountPaise || 0) })
  }
  const goldbackByMerchant: AdminNamedCount[] = [...merchantMap.entries()]
    .map(([key, v]) => ({ key, label: key, count: v.count, value: v.paise }))
    .sort((a, b) => (b.value || 0) - (a.value || 0))
    .slice(0, 8)

  const giftStatusMap = new Map<string, { count: number; amount: number }>()
  for (const o of orders) {
    const key = String(o.status || 'UNKNOWN')
    const prev = giftStatusMap.get(key) || { count: 0, amount: 0 }
    giftStatusMap.set(key, { count: prev.count + 1, amount: prev.amount + Number(o.amountInr || 0) })
  }
  const giftsByStatus: AdminNamedCount[] = [...giftStatusMap.entries()]
    .map(([key, v]) => ({ key, label: key, count: v.count, value: v.amount }))
    .sort((a, b) => b.count - a.count)

  const buckets = [
    { key: '0-40', label: '0–40', min: 0, max: 40 },
    { key: '41-60', label: '41–60', min: 41, max: 60 },
    { key: '61-80', label: '61–80', min: 61, max: 80 },
    { key: '81-100', label: '81–100', min: 81, max: 100 },
  ]
  const scoreBuckets: AdminNamedCount[] = buckets.map((b) => ({
    key: b.key,
    label: b.label,
    count: waitlist.filter((r) => typeof r.yurekaScore === 'number' && r.yurekaScore >= b.min && r.yurekaScore <= b.max).length,
  }))
  const unscored = waitlist.filter((r) => r.yurekaScore == null).length
  if (unscored) scoreBuckets.push({ key: 'none', label: 'Unscored', count: unscored })

  type Acc = {
    key: string
    email: string | null
    name: string | null
    mobileNumber: string | null
    status: string
    score: number | null
    scoreDecision: string | null
    scoreMetrics: Record<string, unknown> | null
    goldbackPaise: number
    giftOrders: number
    giftSpendInr: number
    offerClicks: number
    lastActiveAt: string | null
    pwaInstalled: boolean
    pwaLastSeenAt: string | null
    pwaPlatform: string | null
  }
  const users = new Map<string, Acc>()

  function touch(at: string | null | undefined, acc: Acc) {
    if (!at) return
    if (!acc.lastActiveAt || at > acc.lastActiveAt) acc.lastActiveAt = at
  }

  function ensure(key: string): Acc {
    const k = key.trim().toLowerCase()
    let acc = users.get(k)
    if (!acc) {
      acc = {
        key: k,
        email: isEmail(k) ? k : uuidToEmail.get(key) || null,
        name: null,
        mobileNumber: null,
        status: 'none',
        score: null,
        scoreDecision: null,
        scoreMetrics: null,
        goldbackPaise: 0,
        giftOrders: 0,
        giftSpendInr: 0,
        offerClicks: 0,
        lastActiveAt: null,
        pwaInstalled: false,
        pwaLastSeenAt: null,
        pwaPlatform: null,
      }
      users.set(k, acc)
    }
    return acc
  }

  function resolveKey(userId?: string | null, email?: string | null) {
    const em = email ? email.trim().toLowerCase() : ''
    if (em && users.has(em)) return em
    if (userId && isEmail(userId)) return userId.trim().toLowerCase()
    if (em) return em
    if (userId && uuidToEmail.has(userId)) return uuidToEmail.get(userId)!
    return String(userId || 'unknown').trim().toLowerCase()
  }

  for (const row of waitlist) {
    const acc = ensure(row.email)
    acc.email = row.email
    acc.name = row.fullName
    acc.status = row.status === 'on_hold' ? 'on-hold' : row.status
    const meta = parseWaitlistMeta(row)
    acc.mobileNumber = row.mobileNumber || (typeof meta.mobileNumber === 'string' ? meta.mobileNumber : acc.mobileNumber)
    const metaScore = Number(meta.yurekaScore ?? meta.score)
    acc.score =
      typeof row.yurekaScore === 'number' && Number.isFinite(row.yurekaScore)
        ? row.yurekaScore
        : Number.isFinite(metaScore)
          ? metaScore
          : acc.score
    acc.scoreDecision = row.scoreDecision || (typeof meta.scoreDecision === 'string' ? meta.scoreDecision : acc.scoreDecision)
    if (row.scoreMetrics && typeof row.scoreMetrics === 'object') acc.scoreMetrics = row.scoreMetrics
    else if (meta.scoreMetrics && typeof meta.scoreMetrics === 'object') acc.scoreMetrics = meta.scoreMetrics
    if (!acc.name && meta.name) acc.name = String(meta.name)
    if (meta.pwaInstalled) {
      acc.pwaInstalled = true
      if (typeof meta.pwaLastSeenAt === 'string') {
        acc.pwaLastSeenAt = meta.pwaLastSeenAt
        touch(meta.pwaLastSeenAt, acc)
      }
      if (typeof meta.pwaFirstSeenAt === 'string') touch(meta.pwaFirstSeenAt, acc)
      if (typeof meta.pwaPlatform === 'string') acc.pwaPlatform = meta.pwaPlatform
    }
    touch(row.updatedAt || row.createdAt, acc)
  }

  for (const a of accounts) {
    const acc = ensure(resolveKey(a.userId, uuidToEmail.get(a.userId)))
    acc.goldbackPaise += Number(a.balancePaise || 0)
    touch(a.updatedAt, acc)
  }
  for (const o of orders) {
    const acc = ensure(resolveKey(o.userId, o.customerEmail))
    acc.giftOrders += 1
    if (o.paymentStatus === 'paid' || o.status === 'SUCCESS') acc.giftSpendInr += Number(o.amountInr || 0)
    if (!acc.email && o.customerEmail) acc.email = o.customerEmail.toLowerCase()
    if (!acc.name && o.customerName) acc.name = o.customerName
    touch(o.updatedAt || o.createdAt, acc)
  }
  for (const c of clicks) {
    const acc = ensure(resolveKey(c.userId, uuidToEmail.get(c.userId)))
    acc.offerClicks += 1
    touch(c.createdAt, acc)
  }

  const weekAgo = new Date()
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7)
  const weekIso = weekAgo.toISOString()
  const STATUS_RANK: Record<string, number> = {
    pending: 0,
    on_hold: 1,
    accepted: 2,
    rejected: 3,
  }
  const userList = [...users.values()]
    .filter((u) => u.key && u.key !== 'unknown')
    .sort((a, b) => {
      const ra = STATUS_RANK[a.status || ''] ?? 9
      const rb = STATUS_RANK[b.status || ''] ?? 9
      if (ra !== rb) return ra - rb
      const as = a.score
      const bs = b.score
      if (as != null && bs != null && bs !== as) return bs - as
      if (as != null && bs == null) return -1
      if (as == null && bs != null) return 1
      return (b.lastActiveAt || '').localeCompare(a.lastActiveAt || '')
    })
  const activeUsers7d = userList.filter((u) => u.lastActiveAt && u.lastActiveAt >= weekIso).length
  const pwaInstalled = userList.filter((u) => u.pwaInstalled).length

  const activity: AdminActivityEvent[] = []
  for (const row of waitlist.slice(0, 80)) {
    activity.push({
      id: `wl:${row.id}`,
      at: row.updatedAt || row.createdAt,
      kind: 'waitlist',
      title: row.status === 'accepted' ? 'Waitlist accepted' : 'Waitlist update',
      subtitle: `${row.fullName || row.email} · ${row.status}${
        row.yurekaScore != null ? ` · score ${Math.round(row.yurekaScore)}/100` : ''
      }`,
      userKey: row.email,
    })
  }
  for (const e of ledger.slice(0, 80)) {
    const merchant = String(e.meta?.merchant || e.meta?.title || 'Goldback')
    activity.push({
      id: `gb:${e.id}`,
      at: e.createdAt,
      kind: 'goldback',
      title: e.type === 'earn' ? 'Goldback earned' : `Goldback ${e.type}`,
      subtitle: `${shortUser(e.userId)} · ${merchant}`,
      userKey: resolveKey(e.userId, uuidToEmail.get(e.userId)),
      amountLabel: `₹${(Number(e.amountPaise || 0) / 100).toLocaleString('en-IN')}`,
    })
  }
  for (const o of orders.slice(0, 80)) {
    activity.push({
      id: `gc:${o.id}`,
      at: o.createdAt,
      kind: 'gift',
      title: o.productTitle || 'Gift card',
      subtitle: `${shortUser(o.customerEmail || o.userId)} · ${o.status} · ${o.paymentStatus}`,
      userKey: resolveKey(o.userId, o.customerEmail),
      amountLabel: `₹${Number(o.amountInr || 0).toLocaleString('en-IN')}`,
    })
  }
  for (const c of clicks.slice(0, 80)) {
    const offer = offerById.get(c.offerId)
    activity.push({
      id: `ck:${c.id}`,
      at: c.createdAt,
      kind: 'click',
      title: 'Offer click',
      subtitle: `${shortUser(c.userId)} · ${offer?.merchant || offer?.title || c.offerId}`,
      userKey: resolveKey(c.userId, uuidToEmail.get(c.userId)),
    })
  }
  for (const n of notifications.slice(0, 40)) {
    activity.push({
      id: `nt:${n.id}`,
      at: n.createdAt,
      kind: 'notification',
      title: n.title,
      subtitle: shortUser(n.email || n.userId),
      userKey: resolveKey(n.userId, n.email),
    })
  }
  activity.sort((a, b) => b.at.localeCompare(a.at))

  const giftOrders: AdminGiftOrderRow[] = orders.map((o) => ({
    id: o.id,
    userId: o.userId,
    email: o.customerEmail,
    productTitle: o.productTitle,
    amountInr: o.amountInr,
    status: o.status,
    paymentStatus: o.paymentStatus,
    createdAt: o.createdAt,
  }))

  return {
    generatedAt: new Date().toISOString(),
    kpis: {
      waitlistTotal: waitlist.length,
      pending: statusCounts.pending,
      accepted: statusCounts.accepted,
      rejected: statusCounts.rejected,
      onHold: statusCounts.on_hold,
      scored,
      avgScore: scored ? Math.round((scoreSum / scored) * 10) / 10 : null,
      goldbackAccounts: accounts.length,
      goldbackOutstandingPaise,
      goldbackEarnedPaise,
      goldbackEarns: earned.length,
      giftOrders: orders.length,
      giftPaidInr,
      giftSuccess: orders.filter((o) => o.status === 'SUCCESS').length,
      giftFailed: orders.filter((o) => o.status === 'FAILED').length,
      offerClicks: clicks.length,
      notifications: notifications.length,
      activeUsers7d,
      pwaInstalled,
    },
    series,
    waitlistByStatus: [
      { key: 'pending', label: 'Pending', count: statusCounts.pending },
      { key: 'accepted', label: 'Accepted', count: statusCounts.accepted },
      { key: 'on_hold', label: 'On hold', count: statusCounts.on_hold },
      { key: 'rejected', label: 'Rejected', count: statusCounts.rejected },
    ],
    goldbackByMerchant,
    giftsByStatus,
    scoreBuckets,
    activity: activity.slice(0, 60),
    users: userList,
    giftOrders,
  }
}
