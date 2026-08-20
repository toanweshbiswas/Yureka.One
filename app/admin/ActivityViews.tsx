import React, { useMemo, useState } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import type { AdminOverview } from '@backend/lib/admin/overview'
import { spendFromMetrics } from '@shared/scoreMetrics'
import { D3BarChart, D3DonutChart, D3MultiLineChart } from './D3Charts'
import { PageHeader, Surface, fieldClass, ghostBtnClass } from './ui'

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

export function UsersTab({ data, loading }: { data: AdminOverview | null; loading: boolean }) {
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const rows = useMemo(() => {
    const list = data?.users || []
    const s = q.trim().toLowerCase()
    if (!s) return list
    return list.filter(
      (u) =>
        (u.email || '').toLowerCase().includes(s) ||
        (u.name || '').toLowerCase().includes(s) ||
        (u.mobileNumber || '').toLowerCase().includes(s) ||
        u.key.toLowerCase().includes(s),
    )
  }, [data?.users, q])

  return (
    <section className="space-y-6">
      <PageHeader
        title="Users"
        subtitle="Click a member to open per-user score analysis — spend, order mix, and Gmail flags."
      />
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          className={`${fieldClass} pl-9`}
          placeholder="Search email, name, or phone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-white/[0.07]">
        <table className="w-full text-left text-sm">
          <thead className="text-[10px] uppercase tracking-[0.18em] text-white/35 bg-white/[0.03]">
            <tr>
              <th className="px-4 py-3 font-black">User</th>
              <th className="px-4 py-3 font-black">Phone</th>
              <th className="px-4 py-3 font-black">Status</th>
                <th className="px-4 py-3 font-black">Yureka Score</th>
              <th className="px-4 py-3 font-black">Goldback</th>
              <th className="px-4 py-3 font-black">Gifts</th>
              <th className="px-4 py-3 font-black">Clicks</th>
              <th className="px-4 py-3 font-black">Last active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const open = expanded === u.key
              return (
                <React.Fragment key={u.key}>
                  <tr
                    className={`border-t border-white/[0.06] cursor-pointer transition ${open ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'}`}
                    onClick={() => setExpanded(open ? null : u.key)}
                  >
                    <td className="px-4 py-3 min-w-[12rem]">
                      <p className="font-bold truncate">{u.name || u.email || u.key}</p>
                      <p className="text-[11px] text-white/35 truncate">{u.email || u.key}</p>
                    </td>
                    <td className="px-4 py-3 text-[12px] tabular-nums text-white/70 whitespace-nowrap">
                      {u.mobileNumber || '—'}
                    </td>
                    <td className="px-4 py-3 text-[11px] uppercase tracking-widest text-white/50">{u.status}</td>
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
                      <td colSpan={8} className="px-4 py-4">
                        <UserScoreAnalysis metrics={u.scoreMetrics} />
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
        {!loading && !rows.length && (
          <p className="text-white/30 text-sm py-10 text-center">No users yet</p>
        )}
      </div>
    </section>
  )
}

export function GiftOrdersTab({ data, loading }: { data: AdminOverview | null; loading: boolean }) {
  const rows = data?.giftOrders || []
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
        {!loading && !rows.length && <p className="text-white/30 text-sm py-10 text-center">No gift-card orders yet</p>}
      </div>
    </section>
  )
}
