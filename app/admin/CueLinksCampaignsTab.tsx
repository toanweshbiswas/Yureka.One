import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCw, Search, Percent, MousePointerClick } from 'lucide-react'
import {
  Callout,
  EmptyState,
  PageHeader,
  StatusPill,
  Surface,
  fieldClass,
  pressClass,
  secondaryBtnClass,
} from './ui'

interface Envelope<T> {
  data: T | null
  status: number
  error?: string
}

type PayoutCategory = {
  name: string
  payoutType: string
  payout: number | null
  payoutCurrency: string
  isHeader: boolean
}

type CampaignRow = {
  id: number
  name: string
  url: string
  domain: string | null
  imageUrl: string | null
  payoutType: string
  payout: number | null
  payoutCurrency: string
  isPayPerClick: boolean
  payoutCategories: PayoutCategory[]
  newUserCommission: number | null
  existingUserCommission: number | null
  newUserPayoutType: string | null
  existingUserPayoutType: string | null
  categories: { id: number; name: string }[]
  countries: { id: number; iso: string; name: string }[]
  affiliateUrl: string | null
  cookieDuration: string | null
  lastModified: string | null
}

type CampaignsPayload = {
  items: CampaignRow[]
  total: number
  hasMore: boolean
  catalogTotal: number
  payPerClickTotal: number
  newExistingTotal: number
  fetchedAt: string
}

type FilterMode = 'all' | 'cpc' | 'new_existing'

async function adminFetch<T>(path: string, token: string | null, init?: RequestInit): Promise<Envelope<T>> {
  try {
    const headers: Record<string, string> = {
      ...(token ? { 'X-Admin-Session': token } : {}),
    }
    if (init?.body) headers['Content-Type'] = 'application/json'
    const res = await fetch(path, { ...init, headers: { ...headers, ...(init?.headers || {}) } })
    const json = (await res.json()) as Envelope<T>
    if (!res.ok && !json.error) return { data: null, status: res.status, error: `Request failed (${res.status})` }
    return json
  } catch {
    return { data: null, status: 503, error: 'Admin API unreachable' }
  }
}

function formatRate(value: number | null, payoutType: string | null | undefined, currency = 'INR') {
  if (value == null) return '—'
  const pt = (payoutType || '').toLowerCase()
  if (pt.includes('%') || pt.includes('percent') || pt.includes('sale(%)')) {
    return `${value}%`
  }
  if (pt.includes('click') || pt.includes('cpc')) {
    return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 4 })}`
  }
  if (currency === 'INR' || !currency) {
    return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
  }
  return `${value} ${currency}`
}

export default function CueLinksCampaignsTab({
  token,
  canWrite,
}: {
  token: string | null
  canWrite: boolean
}) {
  const [rows, setRows] = useState<CampaignRow[]>([])
  const [meta, setMeta] = useState<Omit<CampaignsPayload, 'items' | 'hasMore'> | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [draftQ, setDraftQ] = useState('')
  const [filter, setFilter] = useState<FilterMode>('new_existing')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    params.set('filter', filter)
    if (q.trim()) params.set('q', q.trim())
    params.set('limit', '500')
    const res = await adminFetch<CampaignsPayload>(`/api/marketplace/campaigns?${params}`, token)
    if (!res.data) {
      setError(res.error || 'Failed to load CueLinks campaigns')
      setRows([])
      setLoading(false)
      return
    }
    setRows(res.data.items)
    setMeta({
      total: res.data.total,
      catalogTotal: res.data.catalogTotal,
      payPerClickTotal: res.data.payPerClickTotal,
      newExistingTotal: res.data.newExistingTotal,
      fetchedAt: res.data.fetchedAt,
    })
    setLoading(false)
  }, [token, filter, q])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = async () => {
    if (!canWrite) return
    setRefreshing(true)
    setError(null)
    const res = await adminFetch<{
      campaignsLoaded?: number
      campaignsTotal?: number
    }>('/api/marketplace/refresh', token, { method: 'POST', body: '{}' })
    setRefreshing(false)
    if (res.error) {
      setError(res.error)
      return
    }
    await load()
  }

  const filters: { id: FilterMode; label: string }[] = useMemo(
    () => [
      { id: 'new_existing', label: 'New / Existing' },
      { id: 'cpc', label: 'Pay per click' },
      { id: 'all', label: 'All campaigns' },
    ],
    [],
  )

  return (
    <section className="space-y-5">
      <PageHeader
        title="CueLinks commissions"
        subtitle="Live brand payouts from CueLinks — pay-per-click, New User, and Existing User rates. Read-only in admin; not shown in the member app."
        actions={
          <button
            type="button"
            disabled={!canWrite || refreshing || loading}
            onClick={() => void onRefresh()}
            className={secondaryBtnClass}
          >
            {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Refresh catalog
          </button>
        }
      />

      {meta && (
        <div className="flex flex-wrap gap-2">
          <StatusPill tone="neutral">{meta.catalogTotal.toLocaleString('en-IN')} in catalog</StatusPill>
          <StatusPill tone="ok">{meta.newExistingTotal.toLocaleString('en-IN')} with new/existing</StatusPill>
          <StatusPill tone="warn">{meta.payPerClickTotal.toLocaleString('en-IN')} pay-per-click</StatusPill>
          <StatusPill tone="neutral">
            Showing {meta.total.toLocaleString('en-IN')}
            {meta.fetchedAt ? ` · synced ${new Date(meta.fetchedAt).toLocaleString('en-IN')}` : ''}
          </StatusPill>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => {
            const active = filter === f.id
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`${pressClass} inline-flex items-center gap-1.5 rounded-[12px] px-3.5 py-2 text-[13px] font-medium ${
                  active ? 'bg-white text-black' : 'bg-white/[0.06] text-white/55 hover:text-white'
                }`}
              >
                {f.id === 'cpc' ? <MousePointerClick size={13} /> : <Percent size={13} />}
                {f.label}
              </button>
            )
          })}
        </div>
        <form
          className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-sm sm:justify-end"
          onSubmit={(e) => {
            e.preventDefault()
            setQ(draftQ)
          }}
        >
          <div className="relative min-w-0 flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
            <input
              value={draftQ}
              onChange={(e) => setDraftQ(e.target.value)}
              placeholder="Search brand or domain"
              className={`${fieldClass} !py-2.5 !pl-9 !text-[14px]`}
            />
          </div>
          <button type="submit" className={secondaryBtnClass}>
            Search
          </button>
        </form>
      </div>

      {error && <Callout tone="error">{error}</Callout>}

      <Surface className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-white/45">
            <Loader2 size={18} className="animate-spin" /> Loading CueLinks campaigns…
          </div>
        ) : rows.length === 0 ? (
          <EmptyState>No campaigns match this filter</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="border-b border-white/[0.08] text-[11px] uppercase tracking-[0.08em] text-white/40">
                <tr>
                  <th className="px-4 py-3 font-medium">Brand</th>
                  <th className="px-4 py-3 font-medium">Payout type</th>
                  <th className="px-4 py-3 font-medium">Base</th>
                  <th className="px-4 py-3 font-medium">New user</th>
                  <th className="px-4 py-3 font-medium">Existing user</th>
                  <th className="px-4 py-3 font-medium">Flags</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const open = expandedId === row.id
                  return (
                    <React.Fragment key={row.id}>
                      <tr
                        className="border-b border-white/[0.05] hover:bg-white/[0.03] cursor-pointer"
                        onClick={() => setExpandedId(open ? null : row.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/90">
                              {row.imageUrl ? (
                                <img src={row.imageUrl} alt="" className="h-7 w-7 object-contain" />
                              ) : (
                                <span className="text-[11px] font-semibold text-black/50">
                                  {row.name.slice(0, 2).toUpperCase()}
                                </span>
                              )}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-white">{row.name}</p>
                              <p className="truncate text-[12px] text-white/40">
                                {row.domain || row.url || `ID ${row.id}`}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-white/70">{row.payoutType || '—'}</td>
                        <td className="px-4 py-3 tabular-nums text-white/80">
                          {formatRate(row.payout, row.payoutType, row.payoutCurrency)}
                        </td>
                        <td className="px-4 py-3 tabular-nums font-medium text-clay">
                          {formatRate(row.newUserCommission, row.newUserPayoutType || row.payoutType)}
                        </td>
                        <td className="px-4 py-3 tabular-nums font-medium text-white/85">
                          {formatRate(
                            row.existingUserCommission,
                            row.existingUserPayoutType || row.payoutType,
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {row.isPayPerClick && <StatusPill tone="warn">CPC</StatusPill>}
                            {row.newUserCommission != null && <StatusPill tone="ok">New</StatusPill>}
                            {row.existingUserCommission != null && (
                              <StatusPill tone="neutral">Existing</StatusPill>
                            )}
                          </div>
                        </td>
                      </tr>
                      {open && (
                        <tr className="border-b border-white/[0.05] bg-black/20">
                          <td colSpan={6} className="px-4 py-4">
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/40">
                              Payout categories
                            </p>
                            {row.payoutCategories.length === 0 ? (
                              <p className="text-[13px] text-white/40">No category breakdown</p>
                            ) : (
                              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {row.payoutCategories.map((cat, i) => (
                                  <li
                                    key={`${row.id}-${i}-${cat.name}`}
                                    className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                                  >
                                    <p className="text-[13px] font-medium text-white/85">{cat.name}</p>
                                    <p className="mt-0.5 text-[12px] text-white/45">
                                      {cat.payoutType} ·{' '}
                                      {formatRate(cat.payout, cat.payoutType, cat.payoutCurrency)}
                                    </p>
                                  </li>
                                ))}
                              </ul>
                            )}
                            {(row.affiliateUrl || row.cookieDuration) && (
                              <p className="mt-3 text-[12px] text-white/35">
                                {row.cookieDuration ? `Cookie ${row.cookieDuration}` : null}
                                {row.cookieDuration && row.affiliateUrl ? ' · ' : null}
                                {row.affiliateUrl ? (
                                  <a
                                    href={row.affiliateUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-clay hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    Tracking link
                                  </a>
                                ) : null}
                              </p>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Surface>
    </section>
  )
}
