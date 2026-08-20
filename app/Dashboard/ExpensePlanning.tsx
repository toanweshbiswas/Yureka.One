import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import {
  AlertCircle,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Mail,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useSupabase } from '@shared/SupabaseProvider'
import {
  clearPlanningGmailToken,
  requestPlanningGmailToken,
  requestPlanningGmailTokenForInbox,
  storePlanningGmailToken,
} from '@shared/gmailPlanningConsent'
import { emitPlanningUpdated, planningApi } from '@backend/lib/planning/client'
import { currentMonthKey, shiftMonth } from '@backend/lib/planning/categories'
import {
  MAX_EXTRA_INBOXES,
  PLANNING_CATEGORIES,
  PLANNING_CATEGORY_META,
} from '@backend/lib/planning/types'
import type {
  PlanningCategory,
  PlanningInbox,
  PlanningOverview,
  PlanningTransaction,
} from '@backend/lib/planning/types'
import { PlanningDailyArea, PlanningDonut, PlanningMonthBars } from './PlanningCharts'

function categoryLabel(category: PlanningCategory | string | undefined) {
  if (!category) return PLANNING_CATEGORY_META.other.label
  return PLANNING_CATEGORY_META[category as PlanningCategory]?.label || PLANNING_CATEGORY_META.other.label
}

function inr(n: number) {
  return `₹${Math.round(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const spring = { type: 'spring' as const, bounce: 0, duration: 0.4 }
const selectClass =
  'w-full bg-[#111] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-clay/50'
const inputClass =
  'w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-clay/50'

function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number)
  if (!y || !m) return month
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

function csvCell(value: string | number | boolean | undefined) {
  const raw = String(value ?? '')
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`
  return raw
}

function exportCsv(month: string, txs: PlanningTransaction[]) {
  const header = ['Date', 'Merchant', 'Amount', 'Category', 'Source', 'Inbox', 'Review', 'Note']
  const lines = [
    header.join(','),
    ...txs.map((tx) =>
      [
        csvCell(tx.date),
        csvCell(tx.brandName),
        csvCell(tx.amount),
        csvCell(categoryLabel(tx.category)),
        csvCell(tx.source === 'manual' ? 'manual' : 'gmail'),
        csvCell(tx.sourceEmail || ''),
        csvCell(tx.needsReview ? 'needs_review' : ''),
        csvCell(tx.description),
      ].join(','),
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `planning-${month}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const ExpensePlanning: React.FC = () => {
  const reduceMotion = useReducedMotion()
  const { user } = useSupabase()
  const userId = user?.id || user?.email || ''
  const primaryEmail = String(user?.email || '').trim().toLowerCase()
  const thisMonth = currentMonthKey()

  const [month, setMonth] = useState(thisMonth)
  const [overview, setOverview] = useState<PlanningOverview | null>(null)
  const [limits, setLimits] = useState<Record<PlanningCategory, string>>(
    () => Object.fromEntries(PLANNING_CATEGORIES.map((c) => [c, ''])) as Record<PlanningCategory, string>,
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [scanningId, setScanningId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [merchant, setMerchant] = useState('')
  const [amount, setAmount] = useState('')
  const [entryCategory, setEntryCategory] = useState<PlanningCategory>('other')
  const [entryDate, setEntryDate] = useState(todayIso)
  const [note, setNote] = useState('')
  const [adding, setAdding] = useState(false)
  const [txCategory, setTxCategory] = useState<'all' | PlanningCategory>('all')
  const [txReview, setTxReview] = useState<'all' | 'review' | 'ok'>('all')
  const [txInbox, setTxInbox] = useState('all')

  const applyOverview = useCallback((data: PlanningOverview) => {
    setOverview(data)
    setMonth(data.month)
    setLimits(
      Object.fromEntries(
        PLANNING_CATEGORIES.map((c) => {
          const row = data.categories.find((x) => x.category === c)
          return [c, row?.monthlyLimitInr ? String(Math.round(row.monthlyLimitInr)) : '']
        }),
      ) as Record<PlanningCategory, string>,
    )
  }, [])

  const load = useCallback(async () => {
    if (!userId) return
    const res = await planningApi.overview(userId, month)
    if (!res.data) {
      setError(res.error || 'Failed to load planning')
      setLoading(false)
      return
    }
    applyOverview(res.data)
    setError(null)
    setLoading(false)
  }, [userId, month, applyOverview])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  const inboxes: PlanningInbox[] = overview?.inboxes || []
  const atInboxCap = inboxes.length >= MAX_EXTRA_INBOXES
  const forecast = overview?.forecast
  const primaryEmpty = (overview?.primaryTransactionCount || 0) === 0
  const canNextMonth = month < thisMonth
  const reviewCount = overview?.reviewCount || 0

  const inboxOptions = useMemo(() => {
    const set = new Set<string>()
    for (const inbox of inboxes) set.add(inbox.gmail)
    if (primaryEmail) set.add(primaryEmail)
    for (const tx of overview?.transactions || []) {
      if (tx.sourceEmail && tx.sourceEmail !== 'manual') set.add(tx.sourceEmail)
    }
    return [...set]
  }, [inboxes, overview?.transactions, primaryEmail])

  const filteredTxs = useMemo(() => {
    return (overview?.transactions || []).filter((tx) => {
      if (txCategory !== 'all' && tx.category !== txCategory) return false
      if (txReview === 'review' && !tx.needsReview) return false
      if (txReview === 'ok' && tx.needsReview) return false
      if (txInbox === 'manual' && tx.source !== 'manual') return false
      if (txInbox !== 'all' && txInbox !== 'manual' && tx.sourceEmail !== txInbox) return false
      return true
    })
  }, [overview?.transactions, txCategory, txReview, txInbox])

  const dirty = useMemo(() => {
    if (!overview) return false
    return PLANNING_CATEGORIES.some((c) => {
      const saved = overview.categories.find((x) => x.category === c)?.monthlyLimitInr || 0
      const next = Number(limits[c] || 0) || 0
      return saved !== next
    })
  }, [overview, limits])

  const saveBudgets = async () => {
    if (!userId) return
    setSaving(true)
    const res = await planningApi.saveBudgets(
      userId,
      PLANNING_CATEGORIES.map((category) => ({
        category,
        monthlyLimitInr: Number(limits[category] || 0) || 0,
      })),
      month,
    )
    setSaving(false)
    if (!res.data) {
      setError(res.details || res.error || 'Failed to save budgets')
      return
    }
    applyOverview(res.data)
    setError(null)
  }

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    setAdding(true)
    setError(null)
    const res = await planningApi.addEntry(userId, {
      merchant,
      amountInr: Number(amount),
      category: entryCategory,
      date: entryDate,
      note: note || undefined,
      month,
    })
    setAdding(false)
    if (!res.data) {
      setError(res.details || res.error || 'Could not add expense')
      return
    }
    applyOverview(res.data)
    setMerchant('')
    setAmount('')
    setNote('')
    emitPlanningUpdated()
  }

  const recategorize = async (tx: PlanningTransaction, category: PlanningCategory) => {
    if (!userId) return
    if (tx.entryId) {
      const res = await planningApi.patchEntry(userId, tx.entryId, { category, month })
      if (!res.data) {
        setError(res.details || res.error || 'Could not update expense')
        return
      }
      applyOverview(res.data)
      emitPlanningUpdated()
      return
    }
    if (!tx.dedupeHash) return
    const res = await planningApi.saveOverride(userId, {
      dedupeHash: tx.dedupeHash,
      category,
      needsReview: false,
      month,
    })
    if (!res.data) {
      setError(res.details || res.error || 'Could not update category')
      return
    }
    applyOverview(res.data)
    emitPlanningUpdated()
  }

  const confirmReview = async (tx: PlanningTransaction) => {
    await recategorize(tx, (tx.category as PlanningCategory) || 'other')
  }

  const removeExpense = async (id: string) => {
    if (!userId) return
    const res = await planningApi.removeEntry(userId, id, month)
    if (!res.data) {
      setError(res.details || res.error || 'Could not remove expense')
      return
    }
    applyOverview(res.data)
    emitPlanningUpdated()
  }

  const connectInbox = async () => {
    if (!userId || atInboxCap) return
    setConnecting(true)
    setError(null)
    const token = await requestPlanningGmailToken()
    if (!token.accessToken) {
      setConnecting(false)
      setError(token.error || 'Gmail access was denied')
      return
    }
    const res = await planningApi.connectInbox(userId, token.accessToken, primaryEmail)
    if (!res.data) {
      setConnecting(false)
      setError(res.details || res.error || 'Could not connect that Gmail')
      return
    }
    storePlanningGmailToken(res.data.inbox.gmail, token.accessToken)
    setConnecting(false)
    await load()
    emitPlanningUpdated()
    await scanInbox(res.data.inbox, token.accessToken)
  }

  const scanInbox = async (inbox: PlanningInbox, existingToken?: string) => {
    if (!userId) return
    setScanningId(inbox.id)
    setError(null)
    let accessToken = existingToken
    if (!accessToken) {
      const next = await requestPlanningGmailTokenForInbox(inbox.gmail)
      accessToken = next.accessToken
      if (!accessToken) {
        setScanningId(null)
        setError(next.error || 'Gmail access was denied')
        return
      }
    }
    const res = await planningApi.scanInbox(userId, inbox.id, accessToken)
    if (res.status === 400 && res.error === 'INBOX_MISMATCH') {
      clearPlanningGmailToken(inbox.gmail)
      const retry = await requestPlanningGmailToken({ hint: inbox.gmail })
      if (retry.accessToken) {
        const again = await planningApi.scanInbox(userId, inbox.id, retry.accessToken)
        if (again.data) {
          storePlanningGmailToken(inbox.gmail, retry.accessToken)
          setScanningId(null)
          await load()
          emitPlanningUpdated()
          return
        }
        setScanningId(null)
        setError(again.details || again.error || 'Scan failed')
        return
      }
    }
    if (!res.data) {
      setScanningId(null)
      setError(res.details || res.error || 'Scan failed')
      await load()
      return
    }
    storePlanningGmailToken(inbox.gmail, accessToken)
    setScanningId(null)
    await load()
    emitPlanningUpdated()
  }

  const removeInbox = async (inbox: PlanningInbox) => {
    if (!userId) return
    const res = await planningApi.removeInbox(userId, inbox.id)
    if (!res.data) {
      setError(res.details || res.error || 'Could not remove inbox')
      return
    }
    clearPlanningGmailToken(inbox.gmail)
    await load()
    emitPlanningUpdated()
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Account</p>
          <h2 className="text-2xl font-black tracking-tight text-white mt-1">Expense planning</h2>
          <p className="text-white/40 text-sm mt-2 max-w-xl">
            Track spend across food, bills, investments, and more. Extra Gmail stays off the Yureka Score path.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            className="p-2 rounded-xl border border-white/10 text-white/70 hover:text-white active:scale-[0.97]"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/70 min-w-[9.5rem] text-center">
            {monthLabel(month)}
          </p>
          <button
            type="button"
            disabled={!canNextMonth}
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            className="p-2 rounded-xl border border-white/10 text-white/70 hover:text-white active:scale-[0.97] disabled:opacity-30"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-red-500/10 border border-red-500/20 rounded-3xl p-5 flex items-start gap-4"
          >
            <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-white/70">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {reviewCount > 0 && (
        <button
          type="button"
          onClick={() => setTxReview('review')}
          className="w-full text-left rounded-[1.75rem] border border-amber-400/25 bg-amber-400/10 px-6 py-5 flex items-center justify-between gap-4"
        >
          <div>
            <p className="text-white font-bold">{reviewCount} transaction{reviewCount === 1 ? '' : 's'} need review</p>
            <p className="text-white/45 text-sm mt-1">Low-confidence parses stay out of reports until you confirm the category.</p>
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">Show</span>
        </button>
      )}

      {primaryEmpty && !loading && !(overview?.entries?.length) && !(overview?.transactions?.length) && (
        <div className="rounded-[1.75rem] border border-dashed border-white/15 bg-white/[0.02] px-6 py-8">
          <p className="text-white font-bold">Start this month’s picture</p>
          <p className="text-white/45 text-sm mt-2 max-w-lg">
            Add a cash expense below, or resync Gmail from Expenses. Planning never runs the score scan.
          </p>
          <Link
            to="/dashboard/expenses"
            className="inline-flex mt-5 rounded-2xl bg-clay text-black px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] active:scale-[0.97]"
          >
            Open expenses
          </Link>
        </div>
      )}

      {loading && (
        <p className="text-white/40 text-sm">Loading planning…</p>
      )}

      {forecast && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { label: 'Spent so far', value: inr(forecast.spentSoFarInr), icon: Wallet, desc: `${forecast.daysElapsed} days in` },
            { label: 'Daily pace', value: inr(forecast.dailyPaceInr), icon: TrendingUp, desc: 'Average this month' },
            { label: 'Projected month-end', value: inr(forecast.projectedMonthEndInr), icon: Calendar, desc: forecast.totalBudgetInr ? `Budget ${inr(forecast.totalBudgetInr)}` : 'Set a budget below' },
            { label: 'Upcoming bills', value: inr(forecast.upcomingBillsInr), icon: Mail, desc: `${forecast.upcomingBills.length} lined up` },
          ].map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduceMotion ? { duration: 0.2 } : { ...spring, delay: idx * 0.04 }}
              className="bg-white/[0.01] border border-white/5 p-7 rounded-[2rem]"
            >
              <div className="flex items-center justify-between mb-5">
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30">{stat.label}</p>
                <stat.icon size={16} className="text-clay" />
              </div>
              <p className="text-2xl font-black italic tracking-tighter text-white">{stat.value}</p>
              <p className="text-[10px] text-white/40 mt-2">{stat.desc}</p>
            </motion.div>
          ))}
        </div>
      )}

      <section className="bg-white/[0.01] border border-white/5 rounded-[2rem] overflow-hidden">
        <div className="p-7 border-b border-white/5">
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Add expense</h3>
          <p className="text-white/35 text-xs mt-1">Cash, UPI, or anything Gmail missed. Counts toward this month’s analysis.</p>
        </div>
        <form onSubmit={addExpense} className="p-5 sm:p-7 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <label className="lg:col-span-2">
            <span className="sr-only">Merchant</span>
            <input
              required
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="Merchant"
              className={inputClass}
            />
          </label>
          <label>
            <span className="sr-only">Amount</span>
            <input
              required
              type="number"
              min={1}
              step="1"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="₹ amount"
              className={inputClass}
            />
          </label>
          <label>
            <span className="sr-only">Category</span>
            <select
              value={entryCategory}
              onChange={(e) => setEntryCategory(e.target.value as PlanningCategory)}
              className={selectClass}
            >
              {PLANNING_CATEGORIES.map((c) => (
                <option key={c} value={c}>{PLANNING_CATEGORY_META[c].label}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Date</span>
            <input
              type="date"
              required
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <button
            type="submit"
            disabled={adding}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-clay text-black px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] active:scale-[0.97] disabled:opacity-40"
          >
            <Plus size={14} />
            {adding ? 'Adding…' : 'Add'}
          </button>
          <label className="sm:col-span-2 lg:col-span-6">
            <span className="sr-only">Note</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optional)"
              className={inputClass}
            />
          </label>
        </form>
      </section>

      <section className="bg-white/[0.01] border border-white/5 rounded-[2rem] overflow-hidden">
        <div className="p-7 border-b border-white/5 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Transactions</h3>
            <p className="text-white/35 text-xs mt-1">
              {filteredTxs.length} of {overview?.transactions?.length || 0} this month. Recategorize Gmail rows or edit cash entries.
            </p>
          </div>
          <button
            type="button"
            disabled={!filteredTxs.length}
            onClick={() => exportCsv(month, filteredTxs)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-[0.16em] text-white/70 disabled:opacity-40"
          >
            <Download size={12} /> Export CSV
          </button>
        </div>
        <div className="px-5 sm:px-7 py-4 grid grid-cols-1 sm:grid-cols-3 gap-3 border-b border-white/5">
          <label>
            <span className="sr-only">Filter by category</span>
            <select value={txCategory} onChange={(e) => setTxCategory(e.target.value as 'all' | PlanningCategory)} className={selectClass}>
              <option value="all">All categories</option>
              {PLANNING_CATEGORIES.map((c) => (
                <option key={c} value={c}>{PLANNING_CATEGORY_META[c].label}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by review</span>
            <select value={txReview} onChange={(e) => setTxReview(e.target.value as typeof txReview)} className={selectClass}>
              <option value="all">All statuses</option>
              <option value="review">Needs review</option>
              <option value="ok">Confirmed</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by inbox</span>
            <select value={txInbox} onChange={(e) => setTxInbox(e.target.value)} className={selectClass}>
              <option value="all">All sources</option>
              <option value="manual">Manual</option>
              {inboxOptions.map((email) => (
                <option key={email} value={email}>{email}</option>
              ))}
            </select>
          </label>
        </div>
        {filteredTxs.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-white/40 text-sm">No transactions for these filters.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5 max-h-[28rem] overflow-y-auto">
            {filteredTxs.map((tx, idx) => {
              const category = (tx.category as PlanningCategory) || 'other'
              return (
                <li key={tx.dedupeHash || tx.entryId || `${tx.brandName}-${tx.date}-${idx}`} className="px-5 sm:px-7 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{tx.brandName || 'Unknown'}</p>
                    <p className="text-[11px] text-white/35 mt-0.5 truncate">
                      {tx.date}
                      {tx.source === 'manual' ? ' · Manual' : tx.sourceEmail ? ` · ${tx.sourceEmail}` : ''}
                      {tx.needsReview ? ' · Needs review' : ''}
                      {tx.description && tx.description !== 'Added manually' ? ` · ${tx.description}` : ''}
                    </p>
                  </div>
                  <p className="text-clay font-black text-sm shrink-0">{tx.amount}</p>
                  <label className="sm:w-40 shrink-0">
                    <span className="sr-only">Category for {tx.brandName}</span>
                    <select
                      value={category}
                      onChange={(e) => void recategorize(tx, e.target.value as PlanningCategory)}
                      className={selectClass}
                    >
                      {PLANNING_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{PLANNING_CATEGORY_META[c].label}</option>
                      ))}
                    </select>
                  </label>
                  {tx.needsReview && (
                    <button
                      type="button"
                      onClick={() => void confirmReview(tx)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-400/30 text-[10px] font-black uppercase tracking-[0.14em] text-amber-200"
                    >
                      <Check size={12} /> Confirm
                    </button>
                  )}
                  {tx.entryId && (
                    <button
                      type="button"
                      onClick={() => void removeExpense(tx.entryId!)}
                      className="p-2 rounded-lg text-white/30 hover:text-red-300 active:scale-[0.97]"
                      aria-label={`Remove ${tx.brandName}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {overview?.analysis && (
        <section className="bg-white/[0.01] border border-white/5 rounded-[2rem] overflow-hidden">
          <div className="p-7 border-b border-white/5">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Monthly analysis</h3>
            <p className="text-white/35 text-xs mt-1">Gmail spend plus anything you added, by category, day, and the last six months.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-5 sm:p-7">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35 mb-3">By category</p>
              <PlanningDonut data={overview.analysis.byCategory} height={280} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35 mb-3">Daily this month</p>
              <PlanningDailyArea data={overview.analysis.byDay} />
            </div>
            <div className="lg:col-span-2">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35 mb-3">Last six months</p>
              <PlanningMonthBars data={overview.analysis.byMonth} />
            </div>
          </div>
          {!!overview.analysis.topMerchants.length && (
            <div className="px-5 sm:px-7 pb-7">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35 mb-3">Top merchants</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {overview.analysis.topMerchants.map((m) => (
                  <div key={m.name} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
                    <p className="text-[12px] font-bold text-white truncate">{m.name}</p>
                    <p className="text-clay text-[13px] font-black mt-1">{inr(m.amountInr)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <section className="bg-white/[0.01] border border-white/5 rounded-[2rem] overflow-hidden">
        <div className="p-7 border-b border-white/5 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Category budgets</h3>
            <p className="text-white/35 text-xs mt-1">Monthly INR limits vs actuals for {monthLabel(month)}.</p>
          </div>
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => void saveBudgets()}
            className="px-5 py-3 rounded-2xl bg-clay text-black text-[10px] font-black uppercase tracking-[0.18em] disabled:opacity-40 active:scale-[0.97]"
          >
            {saving ? 'Saving…' : 'Save limits'}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-white/5">
          {(overview?.categories || PLANNING_CATEGORIES.map((category) => ({
            category,
            monthlyLimitInr: 0,
            actualInr: 0,
            remainingInr: 0,
          }))).map((row) => {
            const over = row.monthlyLimitInr > 0 && row.actualInr > row.monthlyLimitInr
            const pct = row.monthlyLimitInr > 0 ? Math.min(100, (row.actualInr / row.monthlyLimitInr) * 100) : 0
            return (
              <div key={row.category} className="p-6 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
                  {categoryLabel(row.category)}
                </p>
                <label className="block">
                  <span className="sr-only">Monthly limit for {row.category}</span>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    placeholder="0"
                    value={limits[row.category] ?? ''}
                    onChange={(e) => setLimits((prev) => ({ ...prev, [row.category]: e.target.value }))}
                    className={inputClass}
                  />
                </label>
                <div>
                  <div className="flex justify-between text-[10px] uppercase tracking-widest text-white/35 mb-2">
                    <span>{inr(row.actualInr)} spent</span>
                    <span className={over ? 'text-red-400' : ''}>{over ? 'Over' : `${inr(row.remainingInr)} left`}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className={`h-full ${over ? 'bg-red-400' : 'bg-clay'}`}
                      style={{ width: `${row.monthlyLimitInr ? pct : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {!!forecast?.upcomingBills.length && (
        <section className="bg-white/[0.01] border border-white/5 rounded-[2rem] overflow-hidden">
          <div className="p-7 border-b border-white/5">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Upcoming bills</h3>
          </div>
          <ul className="divide-y divide-white/5">
            {forecast.upcomingBills.map((bill, idx) => (
              <li key={`${bill.brandName}-${idx}`} className="px-7 py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-white">{bill.brandName}</p>
                  <p className="text-[11px] text-white/35 mt-0.5">
                    {bill.recurring ? 'Expected from last month' : bill.date}
                    {bill.sourceEmail ? ` · ${bill.sourceEmail}` : ''}
                  </p>
                </div>
                <p className="text-clay font-black text-sm">{bill.amount}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="bg-white/[0.01] border border-white/5 rounded-[2rem] overflow-hidden">
        <div className="p-7 border-b border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Extra Gmail accounts</h3>
            <p className="text-white/35 text-xs mt-1">
              Optional extra inboxes for more accurate spend. Does not change Yureka Score or resync quota.
            </p>
          </div>
          <button
            type="button"
            disabled={connecting || atInboxCap}
            onClick={() => void connectInbox()}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-white/10 text-[10px] font-black uppercase tracking-[0.18em] text-white/80 hover:border-clay/40 hover:text-clay disabled:opacity-40"
          >
            <Plus size={14} />
            {connecting ? 'Connecting…' : atInboxCap ? `Limit ${MAX_EXTRA_INBOXES}` : 'Add Gmail'}
          </button>
        </div>
        {inboxes.length === 0 ? (
          <div className="py-14 text-center">
            <Mail size={28} className="mx-auto text-white/20 mb-3" />
            <p className="text-white/40 text-sm">No extra inboxes yet. Add one if receipts land in another Gmail.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {inboxes.map((inbox) => (
              <li key={inbox.id} className="px-7 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{inbox.gmail}</p>
                  <p className="text-[11px] text-white/35 mt-1">
                    {inbox.lastScannedAt
                      ? `Last scan ${new Date(inbox.lastScannedAt).toLocaleString('en-IN')}`
                      : 'Not scanned yet'}
                    {inbox.lastError ? ` · ${inbox.lastError}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={scanningId === inbox.id}
                    onClick={() => void scanInbox(inbox)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-[10px] font-black uppercase tracking-[0.16em] text-white/70"
                  >
                    <RefreshCw size={12} className={scanningId === inbox.id ? 'animate-spin' : ''} />
                    {scanningId === inbox.id ? 'Scanning…' : 'Scan'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeInbox(inbox)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/20 text-[10px] font-black uppercase tracking-[0.16em] text-red-300/80"
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default ExpensePlanning
