import type { Express, Request, Response } from 'express'
import { productUserIdOrFail, resolveRequestEmail } from '../auth/userId.js'
import { readLedgerCache, runGmailScanner } from '../ledger/scannerRunner.js'
import {
  MAX_EXTRA_INBOXES,
  asPlanningCategory,
  isPlanningCategory,
  type PlanningManualEntry,
  type PlanningOverview,
  type PlanningTransaction,
} from './types.js'
import {
  applyOverrides,
  currentMonthKey,
  dedupeTransactions,
  monthAnchorDate,
  parseMonthKey,
  transactionsInMonth,
} from './categories.js'
import { deletePlanningCache, readPlanningCache, writePlanningCache } from './cache.js'
import { buildCategorySpend, buildForecast } from './forecast.js'
import { buildAnalysis } from './analysis.js'
import {
  addEntry,
  addInbox,
  deleteEntry,
  deleteInbox,
  getInbox,
  listBudgets,
  listEntries,
  listInboxes,
  listOverrides,
  planningBackendMode,
  updateEntry,
  updateInbox,
  upsertBudgets,
  upsertOverride,
} from './store.js'

function requireUserId(req: Request, res: Response): string | null {
  const result = productUserIdOrFail(req)
  if ('error' in result) {
    res.status(401).json({
      data: null,
      status: 401,
      error: result.error,
      timestamp: new Date().toISOString(),
    })
    return null
  }
  return result.userId
}

function ok<T>(res: Response, data: T, status = 200) {
  res.status(status).json({
    data,
    status,
    timestamp: new Date().toISOString(),
  })
}

function fail(res: Response, status: number, error: string, extra?: Record<string, unknown>) {
  res.status(status).json({
    data: null,
    status,
    error,
    timestamp: new Date().toISOString(),
    ...(extra || {}),
  })
}

function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase()
}

function asTransactions(rows: unknown, sourceEmail?: string): PlanningTransaction[] {
  if (!Array.isArray(rows)) return []
  return rows.map((row) => {
    const tx = row as PlanningTransaction
    const source = tx.source === 'manual' ? 'manual' : 'gmail'
    return {
      brandName: String(tx.brandName || ''),
      amount: String(tx.amount || ''),
      description: String(tx.description || ''),
      date: String(tx.date || ''),
      sender: String(tx.sender || ''),
      type: tx.type ? String(tx.type) : undefined,
      source,
      category: tx.category,
      needsReview: tx.needsReview,
      dedupeHash: tx.dedupeHash,
      entryId: tx.entryId,
      ...(sourceEmail ? { sourceEmail } : {}),
    }
  })
}

function entriesToTransactions(entries: PlanningManualEntry[]): PlanningTransaction[] {
  return entries.map((entry) => ({
    brandName: entry.merchant,
    amount: `₹${entry.amountInr}`,
    description: entry.note || 'Added manually',
    date: entry.date,
    sender: 'manual',
    type: 'Transaction',
    sourceEmail: 'manual',
    source: 'manual' as const,
    category: entry.category,
    needsReview: false,
    entryId: entry.id,
  }))
}

async function gmailProfileEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    const json = (await res.json()) as { emailAddress?: string }
    const email = normalizeEmail(json.emailAddress)
    return email.includes('@') ? email : null
  } catch {
    return null
  }
}

async function extraTransactions(userId: string): Promise<PlanningTransaction[]> {
  const [inboxes, entries, overrides] = await Promise.all([
    listInboxes(userId),
    listEntries(userId),
    listOverrides(userId),
  ])
  const batches = await Promise.all(
    inboxes.map(async (inbox) => {
      const rows = await readPlanningCache(userId, inbox.gmail)
      return asTransactions(rows, inbox.gmail)
    }),
  )
  return applyOverrides(
    dedupeTransactions([...batches.flat(), ...entriesToTransactions(entries)]),
    overrides,
  )
}

async function primaryTransactions(email: string | null): Promise<PlanningTransaction[]> {
  if (!email) return []
  const cache = await readLedgerCache(email)
  return asTransactions(cache.transactions || [], email)
}

async function buildOverview(
  userId: string,
  sessionEmail: string | null,
  monthRaw?: unknown,
): Promise<PlanningOverview> {
  const month = parseMonthKey(monthRaw, currentMonthKey())
  const now = monthAnchorDate(month)
  const [inboxes, budgets, extra, primary, entries, overrides] = await Promise.all([
    listInboxes(userId),
    listBudgets(userId, month),
    extraTransactions(userId),
    primaryTransactions(sessionEmail),
    listEntries(userId),
    listOverrides(userId),
  ])
  const merged = applyOverrides(dedupeTransactions([...primary, ...extra]), overrides)
  const monthTxs = transactionsInMonth(merged, month)
  const reviewCount = monthTxs.filter((tx) => tx.needsReview).length
  return {
    inboxes,
    budgets,
    entries,
    categories: buildCategorySpend(merged, budgets, now),
    forecast: buildForecast(merged, budgets, now),
    analysis: buildAnalysis(merged, now),
    transactions: monthTxs,
    reviewCount,
    extraTransactionCount: extra.length,
    primaryTransactionCount: primary.length,
    month,
  }
}

export function registerPlanningRoutes(app: Express) {
  app.get('/api/v1/planning/health', (_req, res) => {
    ok(res, { mode: planningBackendMode() })
  })

  app.get('/api/v1/planning', async (req, res) => {
    try {
      const userId = requireUserId(req, res)
      if (!userId) return
      const overview = await buildOverview(userId, resolveRequestEmail(req), req.query.month)
      ok(res, overview)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load planning')
    }
  })

  app.put('/api/v1/planning/budgets', async (req, res) => {
    try {
      const userId = requireUserId(req, res)
      if (!userId) return
      const month = parseMonthKey(req.body?.month ?? req.query.month, currentMonthKey())
      const rows = Array.isArray(req.body)
        ? req.body
        : Array.isArray(req.body?.budgets)
          ? req.body.budgets
          : []
      const budgets = await upsertBudgets(
        userId,
        month,
        rows.map((row: any) => ({
          category: asPlanningCategory(row.category),
          monthlyLimitInr: Number(row.monthlyLimitInr),
        })),
      )
      const overview = await buildOverview(userId, resolveRequestEmail(req), month)
      ok(res, { ...overview, budgets })
    } catch (e: any) {
      fail(res, 400, e?.message || 'Failed to save budgets')
    }
  })

  app.get('/api/v1/planning/transactions', async (req, res) => {
    try {
      const userId = requireUserId(req, res)
      if (!userId) return
      const transactions = await extraTransactions(userId)
      ok(res, { transactions })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load planning transactions')
    }
  })

  app.get('/api/v1/planning/inboxes', async (req, res) => {
    try {
      const userId = requireUserId(req, res)
      if (!userId) return
      ok(res, { inboxes: await listInboxes(userId) })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to list inboxes')
    }
  })

  app.post('/api/v1/planning/inboxes/connect', async (req, res) => {
    try {
      const userId = requireUserId(req, res)
      if (!userId) return
      const accessToken = String(req.body?.accessToken || '').trim()
      if (!accessToken) return fail(res, 401, 'AUTH_EXPIRED', {
        details: 'Gmail read-only access token is required to connect an extra inbox.',
      })

      const gmail = await gmailProfileEmail(accessToken)
      if (!gmail) {
        return fail(res, 401, 'AUTH_EXPIRED', {
          details: 'Could not read the Gmail address for this token. Grant access and try again.',
        })
      }

      const sessionEmail = resolveRequestEmail(req)
      const primaryEmail = normalizeEmail(req.body?.primaryEmail) || sessionEmail
      if (primaryEmail && gmail === primaryEmail) {
        return fail(res, 400, 'PRIMARY_INBOX', {
          details: 'That Gmail is already your primary inbox. Connect a different account.',
        })
      }

      const existing = await listInboxes(userId)
      if (existing.some((i) => i.gmail === gmail)) {
        const inbox = existing.find((i) => i.gmail === gmail)!
        return ok(res, { inbox, created: false })
      }
      if (existing.length >= MAX_EXTRA_INBOXES) {
        return fail(res, 400, 'INBOX_LIMIT', {
          details: `You can connect up to ${MAX_EXTRA_INBOXES} extra Gmail accounts.`,
        })
      }

      const inbox = await addInbox(userId, gmail)
      ok(res, { inbox, created: true }, 201)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to connect inbox')
    }
  })

  app.post('/api/v1/planning/inboxes/:id/scan', async (req, res) => {
    try {
      const userId = requireUserId(req, res)
      if (!userId) return
      const inbox = await getInbox(userId, String(req.params.id || ''))
      if (!inbox) return fail(res, 404, 'Inbox not found')

      const accessToken = String(req.body?.accessToken || '').trim()
      if (!accessToken) {
        return fail(res, 401, 'AUTH_EXPIRED', {
          details: 'Gmail read-only access token is required to scan this inbox.',
        })
      }

      const gmail = await gmailProfileEmail(accessToken)
      if (!gmail) {
        return fail(res, 401, 'AUTH_EXPIRED', {
          details: 'Could not read the Gmail address for this token.',
        })
      }
      if (gmail !== inbox.gmail) {
        return fail(res, 400, 'INBOX_MISMATCH', {
          details: `Pick ${inbox.gmail} in the Google account picker, not ${gmail}.`,
        })
      }

      const result = await runGmailScanner({
        accessToken,
        fallbackData: { email: inbox.gmail },
        mode: 'full',
        timeoutMs: 180_000,
      })

      if (result.error) {
        await updateInbox(userId, inbox.id, { lastError: result.error })
        const isAuth =
          result.error === 'AUTH_EXPIRED' || String(result.error).includes('AUTH_EXPIRED')
        return fail(res, isAuth ? 401 : 400, isAuth ? 'AUTH_EXPIRED' : result.error, {
          details: result.details,
        })
      }

      const transactions = asTransactions(result.transactions || [], inbox.gmail)
      await writePlanningCache(userId, inbox.gmail, transactions)
      const updated = await updateInbox(userId, inbox.id, {
        lastScannedAt: new Date().toISOString(),
        lastError: null,
      })
      ok(res, {
        inbox: updated || inbox,
        transactions,
        count: transactions.length,
      })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Planning inbox scan failed')
    }
  })

  app.delete('/api/v1/planning/inboxes/:id', async (req, res) => {
    try {
      const userId = requireUserId(req, res)
      if (!userId) return
      const removed = await deleteInbox(userId, String(req.params.id || ''))
      if (!removed) return fail(res, 404, 'Inbox not found')
      await deletePlanningCache(userId, removed.gmail)
      ok(res, { removed: true, inbox: removed })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to remove inbox')
    }
  })

  app.get('/api/v1/planning/entries', async (req, res) => {
    try {
      const userId = requireUserId(req, res)
      if (!userId) return
      ok(res, { entries: await listEntries(userId) })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to list expenses')
    }
  })

  app.post('/api/v1/planning/entries', async (req, res) => {
    try {
      const userId = requireUserId(req, res)
      if (!userId) return
      const category = String(req.body?.category || 'other')
      if (!isPlanningCategory(category)) {
        return fail(res, 400, 'Invalid category')
      }
      const entry = await addEntry(userId, {
        merchant: String(req.body?.merchant || ''),
        amountInr: Number(req.body?.amountInr),
        category,
        date: String(req.body?.date || ''),
        note: req.body?.note ? String(req.body.note) : undefined,
      })
      const overview = await buildOverview(userId, resolveRequestEmail(req), req.body?.month)
      ok(res, { entry, ...overview }, 201)
    } catch (e: any) {
      fail(res, 400, e?.message || 'Failed to add expense')
    }
  })

  app.patch('/api/v1/planning/entries/:id', async (req, res) => {
    try {
      const userId = requireUserId(req, res)
      if (!userId) return
      if (req.body?.category != null && !isPlanningCategory(req.body.category)) {
        return fail(res, 400, 'Invalid category')
      }
      const entry = await updateEntry(userId, String(req.params.id || ''), {
        merchant: req.body?.merchant,
        amountInr: req.body?.amountInr != null ? Number(req.body.amountInr) : undefined,
        category: req.body?.category,
        date: req.body?.date,
        note: req.body?.note,
      })
      if (!entry) return fail(res, 404, 'Expense not found')
      const overview = await buildOverview(userId, resolveRequestEmail(req), req.body?.month)
      ok(res, { entry, ...overview })
    } catch (e: any) {
      fail(res, 400, e?.message || 'Failed to update expense')
    }
  })

  app.delete('/api/v1/planning/entries/:id', async (req, res) => {
    try {
      const userId = requireUserId(req, res)
      if (!userId) return
      const removed = await deleteEntry(userId, String(req.params.id || ''))
      if (!removed) return fail(res, 404, 'Expense not found')
      const overview = await buildOverview(userId, resolveRequestEmail(req), req.query.month)
      ok(res, { removed: true, entry: removed, ...overview })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to remove expense')
    }
  })

  app.put('/api/v1/planning/overrides', async (req, res) => {
    try {
      const userId = requireUserId(req, res)
      if (!userId) return
      const dedupeHash = String(req.body?.dedupeHash || '').trim()
      if (!dedupeHash) return fail(res, 400, 'Transaction hash is required')
      const category = String(req.body?.category || 'other')
      if (!isPlanningCategory(category)) return fail(res, 400, 'Invalid category')
      const override = await upsertOverride(userId, {
        dedupeHash,
        category,
        needsReview: req.body?.needsReview === true,
      })
      const overview = await buildOverview(userId, resolveRequestEmail(req), req.body?.month)
      ok(res, { override, ...overview })
    } catch (e: any) {
      fail(res, 400, e?.message || 'Failed to save category')
    }
  })
}
