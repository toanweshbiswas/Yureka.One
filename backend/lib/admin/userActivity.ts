import { readLedgerCache, resolveLedgerUserId } from '../ledger/scannerRunner.js'
import { listLedger, getBalance } from '../goldback/store.js'
import { listOrdersForUser } from '../hubble/store.js'
import { findWaitlistByEmail, findWaitlistById } from './store.js'
import { parseWaitlistMeta } from '../waitlist/public.js'

export type AdminUserActivity = {
  key: string
  email: string | null
  waitlistId: string | null
  transactions: {
    last: Array<{
      id: string
      merchant: string
      category: string
      amountInr: number
      at: string | null
    }>
    sinceStart: number
    totalSpendInr: number
  }
  topCategories: Array<{ category: string; count: number; spendInr: number }>
  saved: {
    discountsInr: number
    goldbackPaise: number
    goldbackEarnedPaise: number
    rewardPoints: number
    giftSavingsInr: number
  }
  score: number | null
  goldbackBalancePaise: number
}

function asNum(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function txCategory(tx: Record<string, unknown>) {
  return String(tx.category || tx.merchant_category || tx.top_category || 'general').trim() || 'general'
}

function txMerchant(tx: Record<string, unknown>) {
  return String(tx.merchant || tx.brand || tx.description || 'Unknown').trim() || 'Unknown'
}

function txAmount(tx: Record<string, unknown>) {
  return Math.abs(asNum(tx.amount_inr ?? tx.amountInr ?? tx.amount ?? tx.total_inr))
}

function txAt(tx: Record<string, unknown>) {
  const raw = tx.date || tx.at || tx.created_at || tx.timestamp
  return raw ? String(raw) : null
}

export async function buildUserActivity(key: string): Promise<AdminUserActivity | null> {
  const raw = String(key || '').trim()
  if (!raw) return null

  let waitlist = await findWaitlistById(raw)
  if (!waitlist && raw.includes('@')) {
    waitlist = await findWaitlistByEmail(raw)
  }
  const email = (waitlist?.email || (raw.includes('@') ? raw : null) || '').toLowerCase() || null
  const userKey = email || waitlist?.id || raw
  const meta = waitlist ? parseWaitlistMeta(waitlist) : {}

  const ledgerUserId =
    waitlist?.id ||
    (email ? await resolveLedgerUserId({ authEmail: email, gmailEmail: email }) : null)

  const cache =
    ledgerUserId || email
      ? await readLedgerCache({ userId: ledgerUserId, authEmail: email })
      : { transactions: [] as Array<Record<string, unknown>> }
  const txs = Array.isArray(cache.transactions) ? cache.transactions : []

  const normalized = txs.map((tx, i) => {
    const t = tx as Record<string, unknown>
    return {
      id: String(t.id || `tx-${i}`),
      merchant: txMerchant(t),
      category: txCategory(t),
      amountInr: txAmount(t),
      at: txAt(t),
    }
  })

  const catMap = new Map<string, { count: number; spendInr: number }>()
  let totalSpendInr = 0
  for (const t of normalized) {
    totalSpendInr += t.amountInr
    const cur = catMap.get(t.category) || { count: 0, spendInr: 0 }
    cur.count += 1
    cur.spendInr += t.amountInr
    catMap.set(t.category, cur)
  }
  const topCategories = [...catMap.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.spendInr - a.spendInr || b.count - a.count)
    .slice(0, 3)

  const goldUserIds = [userKey, email, waitlist?.id].filter(Boolean) as string[]
  let balancePaise = 0
  let earnedPaise = 0
  for (const uid of goldUserIds) {
    const bal = await getBalance(uid)
    if (bal.balancePaise > balancePaise) balancePaise = bal.balancePaise
    const ledger = await listLedger(uid, 500)
    const earnSum = ledger
      .filter((e) => e.type === 'earn' || (e.type === 'adjust' && e.amountPaise > 0))
      .reduce((s, e) => s + Math.max(0, e.amountPaise), 0)
    if (earnSum > earnedPaise) earnedPaise = earnSum
  }

  let giftSavingsInr = 0
  try {
    for (const uid of goldUserIds) {
      const orders = await listOrdersForUser(uid)
      for (const o of orders) {
        giftSavingsInr += asNum((o as any).savingsInr ?? (o as any).savings_inr)
      }
    }
  } catch {
    // hubble may be empty
  }

  const metrics = (waitlist?.scoreMetrics || meta.scoreMetrics || {}) as Record<string, unknown>
  const discountsInr = asNum(
    metrics.discount_savings_inr ?? metrics.total_discount_inr ?? metrics.savings_inr ?? metrics.estimated_savings_inr,
  )
  // Reward points are independent of Goldback; never infer from balancePaise.
  const rewardPoints = meta.rewardPoints != null && meta.rewardPoints !== '' ? asNum(meta.rewardPoints) : 0

  return {
    key: userKey,
    email,
    waitlistId: waitlist?.id || null,
    transactions: {
      last: normalized.slice(0, 25),
      sinceStart: normalized.length,
      totalSpendInr,
    },
    topCategories,
    saved: {
      discountsInr,
      goldbackPaise: balancePaise,
      goldbackEarnedPaise: earnedPaise,
      rewardPoints: Math.round(rewardPoints),
      giftSavingsInr,
    },
    score: waitlist?.yurekaScore ?? null,
    goldbackBalancePaise: balancePaise,
  }
}
