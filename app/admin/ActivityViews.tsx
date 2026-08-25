import React, { useMemo, useState } from 'react'
import { ArrowDownAZ, ChevronDown, ChevronUp, RefreshCw, Search } from 'lucide-react'
import type { AdminOverview } from '@backend/lib/admin/overview'
import { spendFromMetrics } from '@shared/scoreMetrics'
import { D3BarChart, D3DonutChart, D3MultiLineChart } from './D3Charts'
import {
  compareUserRows,
  toggleSortDir,
  type SortDir,
  type UserSortKey,
} from './listSort'
import { EmptyState, PageHeader, Surface, fieldClass, ghostBtnClass, pressClass } from './ui'

function formatPaise(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN')}`
}

function formatInr(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`
}

function timeAgo(iso: string | null) {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return 'just now'
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

const KIND_STYLE: Record<string, string> = {
  waitlist: 'text-clay bg-clay/10 border-clay/25',
  goldback: 'text-amber-200 bg-amber-400/10 border-amber-400/20',
  gift: 'text-sky-200 bg-sky-400/10 border-sky-400/20',
  click: 'text-violet-200 bg-violet-400/10 border-violet-400/20',
  notification: 'text-white/70 bg-white/5 border-white/10',
}

export function UserScoreAnalysis({
  metrics,
}: {
  metrics?: Record<string, unknown> | null
}) {
  if (!metrics) {
    return (
      <p className="text-[11px] text-white/30 mt-2">No Gmail score analysis yet — resync after inbox scan.</p>
    )
  }
  const n = (k: string) => {
    const v = Number(metrics[k])
    return Number.isFinite(v) ? v : 0
  }
  const { avgMonthly, spendTotal } = spendFromMetrics(metrics)
  const hasOrderMix =
    n('orders_6m') > 0 ||
    n('prepaid_orders') > 0 ||
    n('cod_orders') > 0 ||
    n('returned_orders') > 0 ||
    n('refunded_orders') > 0 ||
    n('rejected_payments') > 0 ||
    n('failed_orders') > 0

  const kpis = [
    { label: 'Avg monthly', value: avgMonthly > 0 ? formatInr(Math.round(avgMonthly)) : '—' },
    { label: 'Spend (6m)', value: spendTotal > 0 ? formatInr(Math.round(spendTotal)) : '—' },
    { label: 'Orders (6m)', value: n('orders_6m') ? String(n('orders_6m')) : '—' },
    { label: 'Prepaid', value: n('prepaid_orders') ? String(n('prepaid_orders')) : '—' },
    { label: 'COD', value: n('cod_orders') ? String(n('cod_orders')) : '—' },
    { label: 'Returned', value: n('returned_orders') ? String(n('returned_orders')) : '—' },
    { label: 'Refunded', value: n('refunded_orders') ? String(n('refunded_orders')) : '—' },
    { label: 'Rejected pay', value: n('rejected_payments') ? String(n('rejected_payments')) : '—' },
    { label: 'Failed orders', value: n('failed_orders') ? String(n('failed_orders')) : '—' },
  ]

  return (
    <div className="mt-3 space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Score analysis (6 months)</p>
      {typeof metrics.score_summary === 'string' && metrics.score_summary ? (
        <div className="rounded-xl border border-clay/20 bg-clay/5 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-clay/80">
            {metrics.openai_refined ? 'OpenAI refine' : 'Score notes'}
          </p>
          <p className="text-[12px] text-white/70 mt-1 leading-snug">{String(metrics.score_summary)}</p>
          {Array.isArray(metrics.planning_tips) && metrics.planning_tips.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {(metrics.planning_tips as unknown[]).slice(0, 3).map((tip, i) => (
                <li key={i} className="text-[11px] text-white/45">• {String(tip)}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {kpis.map((c) => (
          <div key={c.label} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5">
            <p className="text-[10px] font-medium text-white/40">{c.label}</p>
            <p className="text-[15px] font-semibold tabular-nums mt-1 tracking-tight">{c.value}</p>
          </div>
        ))}
      </div>
      {hasOrderMix ? (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
          <D3BarChart
            data={[
              { label: 'Prepaid', value: n('prepaid_orders') },
              { label: 'COD', value: n('cod_orders') },
              { label: 'Returned', value: n('returned_orders') },
              { label: 'Refunded', value: n('refunded_orders') },
              { label: 'Rejected', value: n('rejected_payments') },
              { label: 'Failed', value: n('failed_orders') },
            ]}
            valueLabel="Orders"
            color="#34d399"
            height={160}
          />
        </div>
      ) : null}
    </div>
  )
}

/** Compact one-line summary for tight layouts */
export function ScoreSignals({
  metrics,
}: {
  metrics?: Record<string, unknown> | null
}) {
  if (!metrics) return null
  const n = (k: string) => {
    const v = Number(metrics[k])
    return Number.isFinite(v) ? v : 0
  }
  const { avgMonthly, spendTotal } = spendFromMetrics(metrics)
  const parts: string[] = []
  if (avgMonthly > 0) parts.push(`Monthly ₹${Math.round(avgMonthly).toLocaleString('en-IN')}`)
  if (spendTotal > 0) parts.push(`₹${Math.round(spendTotal).toLocaleString('en-IN')} / 6m`)
  if (n('orders_6m')) parts.push(`${n('orders_6m')} orders`)
  if (!parts.length) return null
  return <p className="text-[11px] text-white/40 mt-1 leading-snug">{parts.join(' · ')}</p>
}

export function ScoreBadge({
  score,
  decision,
}: {
  score: number | null | undefined
  decision?: string | null
}) {
  if (score == null || !Number.isFinite(Number(score))) {
    return <span className="text-[10px] font-bold uppercase tracking-widest text-white/25">No score</span>
  }
  const n = Math.round(Number(score))
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-clay font-black tabular-nums tracking-tight">
        {n}
        <span className="text-white/35 font-bold text-[11px]">/100</span>
      </span>
      {decision ? <span className="text-[10px] text-white/40 capitalize">{decision}</span> : null}
    </span>
  )
}

function ChartCard({
  title,
  caption,
  children,
}: {
  title: string
  caption: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-4 min-w-0">
      <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-white">{title}</h3>
      <p className="text-[13px] text-white/40 mt-1 mb-3">{caption}</p>
      {children}
    </div>
  )
}

export function OverviewTab({
  data,
  loading,
  error,
  onRefresh,
}: {
  data: AdminOverview | null
  loading: boolean
  error: string | null
  onRefresh: () => void
}) {
  const kpis = data?.kpis
  const cards = [
    { label: 'Waitlist', value: kpis ? String(kpis.waitlistTotal) : '—' },
    { label: 'Accepted', value: kpis ? String(kpis.accepted) : '—' },
    { label: 'Active (7d)', value: kpis ? String(kpis.activeUsers7d) : '—' },
    { label: 'Saved app', value: kpis ? String(kpis.pwaInstalled ?? 0) : '—' },
    { label: 'Scored', value: kpis ? String(kpis.scored) : '—' },
    { label: 'Avg score', value: kpis?.avgScore != null ? String(kpis.avgScore) : '—' },
    { label: 'Goldback out', value: kpis ? formatPaise(kpis.goldbackOutstandingPaise) : '—' },
    { label: 'Goldback earned', value: kpis ? formatPaise(kpis.goldbackEarnedPaise) : '—' },
    { label: 'Gift GMV', value: kpis ? formatInr(kpis.giftPaidInr) : '—' },
    { label: 'Offer clicks', value: kpis ? String(kpis.offerClicks) : '—' },
  ]

  return (
    <section className="space-y-6">
      <PageHeader
        title="Overview"
        subtitle={`Live activity across waitlist, Goldback, gift cards, and offer clicks${data?.generatedAt ? ` · updated ${timeAgo(data.generatedAt)}` : ''}`}
        actions={
          <button
            type="button"
            onClick={onRefresh}
            className={`${ghostBtnClass} border border-white/10`}
            aria-label="Refresh overview"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      {error && (
        <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-red-300 text-sm">{error}</p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] px-4 py-4">
            <p className="text-[12px] font-medium text-white/40">{c.label}</p>
            <p className="text-[22px] font-semibold tabular-nums mt-2 tracking-[-0.02em]">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard
          title="Daily activity (30 days)"
          caption="Source: waitlist joins, Goldback earns, gift-card orders, offer clicks · UTC days"
        >
          <D3MultiLineChart
            data={data?.series || []}
            series={[
              { key: 'waitlist', label: 'Waitlist', color: '#34d399' },
              { key: 'goldback', label: 'Goldback', color: '#fbbf24' },
              { key: 'gifts', label: 'Gift cards', color: '#60a5fa' },
              { key: 'clicks', label: 'Clicks', color: '#a78bfa' },
            ]}
          />
          <div className="flex flex-wrap gap-3 mt-2 text-[10px] uppercase tracking-widest text-white/40">
            <span className="text-[#34d399]">Waitlist</span>
            <span className="text-[#fbbf24]">Goldback</span>
            <span className="text-[#60a5fa]">Gift cards</span>
            <span className="text-[#a78bfa]">Clicks</span>
          </div>
        </ChartCard>

        <ChartCard title="Waitlist by status" caption="Source: waitlist table · current snapshot">
          <D3DonutChart
            data={(data?.waitlistByStatus || []).map((d) => ({ label: d.label, count: d.count }))}
            colors={['#fbbf24', '#34d399', '#60a5fa', '#f87171']}
          />
        </ChartCard>

        <ChartCard title="Goldback earned by merchant" caption="Source: goldback ledger · amount in ₹">
          <D3BarChart
            data={(data?.goldbackByMerchant || []).map((d) => ({
              label: d.label,
              value: (d.value || 0) / 100,
            }))}
            valueLabel="Amount (₹)"
            color="#fbbf24"
          />
        </ChartCard>

        <ChartCard title="Yureka Score distribution" caption="Source: waitlist yurekaScore · 20 = ₹25–30k/mo avg, +5 per ₹5k, 100 = over ₹100k">
          <D3BarChart
            data={(data?.scoreBuckets || []).map((d) => ({ label: d.label, value: d.count }))}
            valueLabel="Members"
          />
        </ChartCard>
      </div>

      <div>
        <h3 className="text-[13px] font-medium text-white/40 mb-3">Latest activity</h3>
        <div className="space-y-1.5">
          {(data?.activity || []).slice(0, 18).map((ev) => (
            <div
              key={ev.id}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 flex items-center gap-3"
            >
              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border shrink-0 ${KIND_STYLE[ev.kind] || KIND_STYLE.notification}`}>
                {ev.kind}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold truncate">{ev.title}</p>
                <p className="text-[11px] text-white/35 truncate">{ev.subtitle}</p>
              </div>
              {ev.amountLabel && (
                <span className="text-clay font-black tabular-nums text-sm shrink-0">{ev.amountLabel}</span>
              )}
              <span className="text-[10px] text-white/30 shrink-0 w-16 text-right">{timeAgo(ev.at)}</span>
            </div>
          ))}
          {!loading && !data?.activity.length && (
            <p className="text-white/30 text-sm py-8 text-center">No member activity recorded yet</p>
          )}
        </div>
      </div>
    </section>
  )
}

export function UsersTab({
  data,
  loading,
  token,
  canWrite,
  onRefresh,
}: {
  data: AdminOverview | null
  loading: boolean
  token: string | null
  canWrite: boolean
  onRefresh?: () => void
}) {
  const [q, setQ] = useState('')
  const [sortKey, setSortKey] = useState<UserSortKey>('action')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [activity, setActivity] = useState<any | null>(null)
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityError, setActivityError] = useState<string | null>(null)
  const [edit, setEdit] = useState({
    waitlistId: '',
    fullName: '',
    status: 'accepted',
    yurekaScore: '',
    rewardPoints: '',
    goldbackPaise: '',
  })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  const rows = useMemo(() => {
    const list = data?.users || []
    const s = q.trim().toLowerCase()
    const filtered = !s
      ? [...list]
      : list.filter(
          (u) =>
            (u.email || '').toLowerCase().includes(s) ||
            (u.name || '').toLowerCase().includes(s) ||
            (u.mobileNumber || '').toLowerCase().includes(s) ||
            u.key.toLowerCase().includes(s),
        )
    filtered.sort((a, b) => compareUserRows(a, b, sortKey, sortDir))
    return filtered
  }, [data?.users, q, sortKey, sortDir])

  const onHeaderSort = (key: UserSortKey) => {
    if (sortKey === key) {
      setSortDir(toggleSortDir(sortDir))
      return
    }
    setSortKey(key)
    setSortDir(key === 'name' || key === 'status' ? 'asc' : 'desc')
  }

  const SortHint = ({ column }: { column: UserSortKey }) => {
    if (sortKey !== column) return null
    return sortDir === 'asc' ? (
      <ChevronUp size={12} className="inline ml-0.5 opacity-80" />
    ) : (
      <ChevronDown size={12} className="inline ml-0.5 opacity-80" />
    )
  }

  const loadActivity = async (u: AdminOverview['users'][number]) => {
    setActivityLoading(true)
    setActivityError(null)
    setActivity(null)
    const key = encodeURIComponent(u.email || u.key)
    try {
      const res = await fetch(`/api/admin/users/${key}/activity`, {
        headers: token ? { 'X-Admin-Session': token } : {},
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setActivityError(json.error || 'Failed to load activity')
      } else {
        setActivity(json.data)
        setEdit({
          waitlistId: json.data?.waitlistId || '',
          fullName: u.name || '',
          status: u.status || 'accepted',
          yurekaScore: u.score != null ? String(u.score) : '',
          rewardPoints: json.data?.saved?.rewardPoints != null ? String(json.data.saved.rewardPoints) : '',
          goldbackPaise: String(u.goldbackPaise ?? 0),
        })
      }
    } catch {
      setActivityError('Failed to load activity')
    }
    setActivityLoading(false)
  }

  const openUser = (u: AdminOverview['users'][number]) => {
    const next = expanded === u.key ? null : u.key
    setExpanded(next)
    setSaveMsg(null)
    if (next) {
      // Seed edit target immediately so Delete works even before activity finishes.
      setEdit({
        waitlistId: '',
        fullName: u.name || '',
        status: u.status || 'accepted',
        yurekaScore: u.score != null ? String(u.score) : '',
        rewardPoints: '',
        goldbackPaise: String(u.goldbackPaise ?? 0),
      })
      setActivity({
        key: u.key,
        email: u.email,
        waitlistId: null,
      })
      void loadActivity(u)
    }
  }

  const saveUser = async () => {
    if (!canWrite || !edit.waitlistId) {
      setSaveMsg('No waitlist row linked — create via Waitlist first.')
      return
    }
    setSaving(true)
    setSaveMsg(null)
    try {
      const patchRes = await fetch(`/api/admin/users/${encodeURIComponent(edit.waitlistId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'X-Admin-Session': token } : {}),
        },
        body: JSON.stringify({
          fullName: edit.fullName || null,
          status: edit.status,
          yurekaScore: edit.yurekaScore === '' ? null : Number(edit.yurekaScore),
          rewardPoints: edit.rewardPoints === '' ? null : Number(edit.rewardPoints),
        }),
      })
      const patchJson = await patchRes.json()
      if (!patchRes.ok || patchJson.error) {
        setSaveMsg(patchJson.error || 'Update failed')
        setSaving(false)
        return
      }

      const userId = activity?.email || activity?.key
      if (userId && edit.goldbackPaise !== '') {
        const goldRes = await fetch('/api/admin/goldback/adjust', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'X-Admin-Session': token } : {}),
          },
          body: JSON.stringify({
            userId,
            balancePaise: Math.round(Number(edit.goldbackPaise) || 0),
            note: 'Admin user panel',
          }),
        })
        const goldJson = await goldRes.json()
        if (!goldRes.ok || goldJson.error) {
          setSaveMsg(goldJson.error || 'Goldback adjust failed')
          setSaving(false)
          return
        }
      }

      setSaveMsg('Saved')
      onRefresh?.()
      if (expanded) {
        const u = rows.find((r) => r.key === expanded)
        if (u) void loadActivity(u)
      }
    } catch {
      setSaveMsg('Save failed')
    }
    setSaving(false)
  }

  const deleteUser = async () => {
    if (!canWrite) return
    const targetId = (edit.waitlistId || activity?.waitlistId || '').trim()
    const targetEmail = (activity?.email || '').trim()
    const target = targetId || targetEmail
    if (!target) {
      setSaveMsg('Cannot delete — waitlist row not loaded yet. Expand the user again, then retry.')
      return
    }
    const label = targetEmail || target
    if (
      !confirm(
        `Permanently delete ${label}?\n\nThis removes them from the waitlist immediately. This cannot be undone.`,
      )
    ) {
      return
    }
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(target)}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { 'X-Admin-Session': token } : {}),
        },
      })
      const json = await res.json().catch(() => ({} as { error?: string }))
      if (!res.ok || json.error) {
        setSaveMsg(json.error || `Delete failed (${res.status})`)
        setSaving(false)
        return
      }
      setSaveMsg('User deleted')
      setExpanded(null)
      setActivity(null)
      onRefresh?.()
    } catch {
      setSaveMsg('Delete failed')
    }
    setSaving(false)
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Users"
        subtitle="Drill into transactions, top categories, and savings. Edit score, Goldback, and reward points."
        actions={
          onRefresh ? (
            <button type="button" onClick={onRefresh} className={ghostBtnClass} aria-label="Refresh users">
              <RefreshCw size={14} />
              Refresh
            </button>
          ) : null
        }
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            className={`${fieldClass} pl-9`}
            placeholder="Search email, name, or phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[11px] text-white/30 mr-1 flex items-center gap-1">
            <ArrowDownAZ size={12} /> Sort
          </span>
          {(
            [
              { id: 'action' as const, label: 'Needs action' },
              { id: 'score' as const, label: 'Score' },
              { id: 'active' as const, label: 'Active' },
              { id: 'goldback' as const, label: 'Goldback' },
              { id: 'name' as const, label: 'Name' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                if (sortKey === opt.id) setSortDir(toggleSortDir(sortDir))
                else {
                  setSortKey(opt.id)
                  setSortDir(opt.id === 'name' ? 'asc' : 'desc')
                }
              }}
              className={`${pressClass} rounded-[10px] px-2.5 py-1.5 text-[12px] font-medium ${
                sortKey === opt.id ? 'bg-white text-black' : 'bg-white/[0.06] text-white/50 hover:text-white'
              }`}
            >
              {opt.label}
              {sortKey === opt.id ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[12px] text-white/35 tabular-nums">
        {rows.length} user{rows.length === 1 ? '' : 's'}
        {q.trim() ? ' matching search' : ''}
        {sortKey === 'action' ? ' · pending & on hold first' : ''}
      </p>
      <div className="overflow-x-auto rounded-2xl border border-white/[0.07]">
        <table className="w-full text-left text-sm">
          <thead className="text-[10px] uppercase tracking-[0.18em] text-white/35 bg-white/[0.03]">
            <tr>
              <th className="px-4 py-3 font-black">
                <button type="button" className={`${pressClass} inline-flex items-center`} onClick={() => onHeaderSort('name')}>
                  User
                  <SortHint column="name" />
                </button>
              </th>
              <th className="px-4 py-3 font-black">Phone</th>
              <th className="px-4 py-3 font-black">
                <button type="button" className={`${pressClass} inline-flex items-center`} onClick={() => onHeaderSort('status')}>
                  Status
                  <SortHint column="status" />
                </button>
              </th>
              <th className="px-4 py-3 font-black">App</th>
              <th className="px-4 py-3 font-black">
                <button type="button" className={`${pressClass} inline-flex items-center`} onClick={() => onHeaderSort('score')}>
                  Yureka Score
                  <SortHint column="score" />
                </button>
              </th>
              <th className="px-4 py-3 font-black">
                <button type="button" className={`${pressClass} inline-flex items-center`} onClick={() => onHeaderSort('goldback')}>
                  Goldback
                  <SortHint column="goldback" />
                </button>
              </th>
              <th className="px-4 py-3 font-black">Gifts</th>
              <th className="px-4 py-3 font-black">Clicks</th>
              <th className="px-4 py-3 font-black">
                <button type="button" className={`${pressClass} inline-flex items-center`} onClick={() => onHeaderSort('active')}>
                  Last active
                  <SortHint column="active" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const open = expanded === u.key
              return (
                <React.Fragment key={u.key}>
                  <tr
                    className={`border-t border-white/[0.06] cursor-pointer transition ${open ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'}`}
                    onClick={() => openUser(u)}
                  >
                    <td className="px-4 py-3 min-w-[12rem]">
                      <p className="font-bold truncate">{u.name || u.email || u.key}</p>
                      <p className="text-[11px] text-white/35 truncate">{u.email || u.key}</p>
                    </td>
                    <td className="px-4 py-3 text-[12px] tabular-nums text-white/70 whitespace-nowrap">
                      {u.mobileNumber || '—'}
                    </td>
                    <td className="px-4 py-3 text-[11px] uppercase tracking-widest">
                      <span
                        className={
                          u.status === 'pending'
                            ? 'text-amber-300'
                            : u.status === 'accepted'
                              ? 'text-clay'
                              : u.status === 'rejected'
                                ? 'text-red-300'
                                : 'text-white/50'
                        }
                      >
                        {(u.status || '—').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.pwaInstalled ? (
                        <span className="inline-flex items-center rounded-full bg-clay/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-clay">
                          Saved{u.pwaPlatform ? ` · ${u.pwaPlatform}` : ''}
                        </span>
                      ) : (
                        <span className="text-[11px] text-white/25">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBadge score={u.score} decision={u.scoreDecision} />
                      {(() => {
                        const { avgMonthly } = spendFromMetrics(u.scoreMetrics)
                        if (!(avgMonthly > 0)) return null
                        return (
                          <p className="text-[11px] text-clay/85 mt-1 font-medium tabular-nums">
                            Monthly {formatInr(Math.round(avgMonthly))}
                          </p>
                        )
                      })()}
                      <ScoreSignals metrics={u.scoreMetrics} />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-clay font-bold">{formatPaise(u.goldbackPaise)}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {u.giftOrders}
                      {u.giftSpendInr ? <span className="text-white/35"> · {formatInr(u.giftSpendInr)}</span> : null}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{u.offerClicks}</td>
                    <td className="px-4 py-3 text-white/40 text-xs whitespace-nowrap">{timeAgo(u.lastActiveAt)}</td>
                  </tr>
                  {open ? (
                    <tr className="border-t border-white/[0.04] bg-white/[0.02]">
                      <td colSpan={9} className="px-4 py-4 space-y-5">
                        <UserScoreAnalysis metrics={u.scoreMetrics} />
                        {activityLoading && <p className="text-[13px] text-white/40">Loading activity…</p>}
                        {activityError && <p className="text-[13px] text-red-300">{activityError}</p>}
                        {activity && (
                          <div className="space-y-4">
                            <div className="grid sm:grid-cols-3 gap-2">
                              <Surface className="px-3 py-3">
                                <p className="text-[11px] text-white/40">Tx since start</p>
                                <p className="text-[18px] font-semibold tabular-nums mt-1">{activity.transactions.sinceStart}</p>
                                <p className="text-[11px] text-white/35 mt-1">Spend {formatInr(Math.round(activity.transactions.totalSpendInr || 0))}</p>
                              </Surface>
                              <Surface className="px-3 py-3">
                                <p className="text-[11px] text-white/40">Amount saved</p>
                                <p className="text-[13px] mt-2 text-white/70">Discounts {formatInr(Math.round(activity.saved.discountsInr || 0))}</p>
                                <p className="text-[13px] text-white/70">Gold {formatPaise(activity.saved.goldbackEarnedPaise || 0)} earned</p>
                                <p className="text-[13px] text-white/70">Points {Number(activity.saved.rewardPoints || 0).toLocaleString('en-IN')}</p>
                              </Surface>
                              <Surface className="px-3 py-3">
                                <p className="text-[11px] text-white/40">Top categories</p>
                                <div className="mt-2 space-y-1">
                                  {(activity.topCategories || []).map((c: any) => (
                                    <p key={c.category} className="text-[13px] flex justify-between gap-2">
                                      <span className="truncate capitalize">{c.category}</span>
                                      <span className="tabular-nums text-white/50 shrink-0">{formatInr(Math.round(c.spendInr))}</span>
                                    </p>
                                  ))}
                                  {!activity.topCategories?.length && <p className="text-[12px] text-white/30">No category data</p>}
                                </div>
                              </Surface>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35 mb-2">Last transactions</p>
                              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                                {(activity.transactions.last || []).map((t: any) => (
                                  <div key={t.id} className="rounded-lg border border-white/[0.06] px-3 py-2 flex justify-between gap-3 text-[13px]">
                                    <div className="min-w-0">
                                      <p className="font-medium truncate">{t.merchant}</p>
                                      <p className="text-[11px] text-white/35 capitalize">{t.category}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <p className="tabular-nums font-semibold">{formatInr(Math.round(t.amountInr))}</p>
                                      <p className="text-[10px] text-white/30">{t.at ? timeAgo(t.at) : '—'}</p>
                                    </div>
                                  </div>
                                ))}
                                {!activity.transactions.last?.length && <p className="text-[12px] text-white/30">No ledger transactions cached</p>}
                              </div>
                            </div>
                          </div>
                        )}
                        {canWrite && (
                          <div className="rounded-2xl border border-white/[0.08] bg-black/30 p-4 space-y-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Edit score / Goldback / points</p>
                            <div className="space-y-2">
                              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
                                <input className={fieldClass} placeholder="Name" value={edit.fullName} onChange={(e) => setEdit({ ...edit, fullName: e.target.value })} onClick={(e) => e.stopPropagation()} />
                                <select className={fieldClass} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} onClick={(e) => e.stopPropagation()}>
                                  <option value="pending">pending</option>
                                  <option value="accepted">accepted</option>
                                  <option value="on_hold">on_hold</option>
                                  <option value="rejected">rejected</option>
                                </select>
                                <input className={fieldClass} type="number" placeholder="Yureka score" value={edit.yurekaScore} onChange={(e) => setEdit({ ...edit, yurekaScore: e.target.value })} onClick={(e) => e.stopPropagation()} />
                              </div>
                              <div className="grid sm:grid-cols-2 gap-2">
                                <input className={fieldClass} type="number" placeholder="Goldback paise" value={edit.goldbackPaise} onChange={(e) => setEdit({ ...edit, goldbackPaise: e.target.value })} onClick={(e) => e.stopPropagation()} />
                                <input className={fieldClass} type="number" placeholder="Reward points" value={edit.rewardPoints} onChange={(e) => setEdit({ ...edit, rewardPoints: e.target.value })} onClick={(e) => e.stopPropagation()} />
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                              <button type="button" disabled={saving} onClick={() => void saveUser()} className="rounded-xl bg-clay text-black px-3 py-2 text-xs font-black disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button>
                              <button type="button" disabled={saving} onClick={() => void deleteUser()} className="rounded-xl bg-red-500/20 text-red-300 px-3 py-2 text-xs font-bold disabled:opacity-50">Delete user</button>
                              {saveMsg && <span className="text-[12px] text-white/50 self-center">{saveMsg}</span>}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
        {!loading && !rows.length && (
          <EmptyState>{q.trim() ? 'No users match that search' : 'No users yet'}</EmptyState>
        )}
      </div>
    </section>
  )
}

export function GiftOrdersTab({ data, loading }: { data: AdminOverview | null; loading: boolean }) {
  const [q, setQ] = useState('')
  const rows = useMemo(() => {
    const list = [...(data?.giftOrders || [])]
    list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    const s = q.trim().toLowerCase()
    if (!s) return list
    return list.filter(
      (o) =>
        (o.productTitle || '').toLowerCase().includes(s) ||
        (o.email || '').toLowerCase().includes(s) ||
        (o.userId || '').toLowerCase().includes(s) ||
        (o.status || '').toLowerCase().includes(s) ||
        (o.paymentStatus || '').toLowerCase().includes(s),
    )
  }, [data?.giftOrders, q])

  return (
    <section className="space-y-6">
      <PageHeader
        title="Gift cards"
        subtitle="Gift card orders across all members (codes are not shown)."
      />
      <div className="grid sm:grid-cols-3 gap-3">
        <Surface className="px-4 py-4">
          <p className="text-[12px] font-medium text-white/40">Orders</p>
          <p className="text-[22px] font-semibold mt-2 tracking-[-0.02em]">{data?.kpis.giftOrders ?? '—'}</p>
        </Surface>
        <Surface className="px-4 py-4">
          <p className="text-[12px] font-medium text-white/40">Issued</p>
          <p className="text-[22px] font-semibold mt-2 tracking-[-0.02em]">{data?.kpis.giftSuccess ?? '—'}</p>
        </Surface>
        <Surface className="px-4 py-4">
          <p className="text-[12px] font-medium text-white/40">Paid GMV</p>
          <p className="text-[22px] font-semibold mt-2 tracking-[-0.02em]">{data ? formatInr(data.kpis.giftPaidInr) : '—'}</p>
        </Surface>
      </div>
      <ChartCard title="Orders by status" caption="Source: gift-card orders · count">
        <D3BarChart
          data={(data?.giftsByStatus || []).map((d) => ({ label: d.label, value: d.count }))}
          valueLabel="Orders"
          color="#60a5fa"
          height={200}
        />
      </ChartCard>
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          className={`${fieldClass} pl-9`}
          placeholder="Search product, email, or status…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        {rows.map((o) => (
          <div key={o.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5 flex justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="font-bold truncate">{o.productTitle}</p>
              <p className="text-[10px] text-white/30 uppercase tracking-widest mt-1 truncate">
                {o.email || o.userId} · {o.status} · {o.paymentStatus}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-black tabular-nums">{formatInr(o.amountInr)}</p>
              <p className="text-[10px] text-white/30 mt-1">{timeAgo(o.createdAt)}</p>
            </div>
          </div>
        ))}
        {!loading && !rows.length && (
          <EmptyState>{q.trim() ? 'No orders match that search' : 'No gift-card orders yet'}</EmptyState>
        )}
      </div>
    </section>
  )
}
