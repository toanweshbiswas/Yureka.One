import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCw, Search, Percent, MousePointerClick, Save } from 'lucide-react'
import {
  Callout,
  EmptyState,
  FieldLabel,
  PageHeader,
  StatusPill,
  Surface,
  fieldClass,
  pressClass,
  primaryBtnClass,
  secondaryBtnClass,
  surfaceClass,
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

type PassThrough = {
  memberSharePercent: number
  campaignOverrides: Record<string, number>
  notes: string
  updatedAt: string
}

type FilterMode = 'all' | 'cpc' | 'new_existing'

const PAGE_SIZE = 100

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
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [draftQ, setDraftQ] = useState('')
  const [filter, setFilter] = useState<FilterMode>('all')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [passThrough, setPassThrough] = useState<PassThrough>({
    memberSharePercent: 50,
    campaignOverrides: {},
    notes: '',
    updatedAt: '',
  })
  const [shareDraft, setShareDraft] = useState('50')
  const [notesDraft, setNotesDraft] = useState('')
  const [savingShare, setSavingShare] = useState(false)
  const [shareNotice, setShareNotice] = useState<string | null>(null)
  const [overrideDrafts, setOverrideDrafts] = useState<Record<string, string>>({})
  const [savingOverrideId, setSavingOverrideId] = useState<string | null>(null)

  const loadPassThrough = useCallback(async () => {
    const res = await adminFetch<PassThrough>('/api/admin/commission/cuelinks', token)
    if (res.data) {
      setPassThrough(res.data)
      setShareDraft(String(res.data.memberSharePercent))
      setNotesDraft(res.data.notes || '')
      const drafts: Record<string, string> = {}
      for (const [k, v] of Object.entries(res.data.campaignOverrides || {})) {
        drafts[k] = String(v)
      }
      setOverrideDrafts(drafts)
    }
  }, [token])

  const loadPage = useCallback(
    async (offset: number, append: boolean) => {
      if (append) setLoadingMore(true)
      else {
        setLoading(true)
        setError(null)
      }
      const params = new URLSearchParams()
      params.set('filter', filter)
      if (q.trim()) params.set('q', q.trim())
      params.set('limit', String(PAGE_SIZE))
      params.set('offset', String(offset))
      const res = await adminFetch<CampaignsPayload>(`/api/marketplace/campaigns?${params}`, token)
      if (append) setLoadingMore(false)
      else setLoading(false)
      if (!res.data) {
        setError(res.error || 'Failed to load CueLinks campaigns')
        if (!append) {
          setRows([])
          setHasMore(false)
        }
        return
      }
      setRows((prev) => (append ? [...prev, ...res.data!.items] : res.data!.items))
      setHasMore(Boolean(res.data.hasMore))
      setMeta({
        total: res.data.total,
        catalogTotal: res.data.catalogTotal,
        payPerClickTotal: res.data.payPerClickTotal,
        newExistingTotal: res.data.newExistingTotal,
        fetchedAt: res.data.fetchedAt,
      })
    },
    [token, filter, q],
  )

  useEffect(() => {
    void loadPassThrough()
  }, [loadPassThrough])

  useEffect(() => {
    void loadPage(0, false)
  }, [loadPage])

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
    await loadPage(0, false)
  }

  const saveShare = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canWrite || savingShare) return
    setSavingShare(true)
    setShareNotice(null)
    setError(null)
    const res = await adminFetch<PassThrough>('/api/admin/commission/cuelinks', token, {
      method: 'PUT',
      body: JSON.stringify({
        memberSharePercent: Number(shareDraft),
        notes: notesDraft,
        campaignOverrides: passThrough.campaignOverrides,
      }),
    })
    setSavingShare(false)
    if (!res.data) {
      setError(res.error || 'Failed to save member share')
      return
    }
    setPassThrough(res.data)
    setShareDraft(String(res.data.memberSharePercent))
    setNotesDraft(res.data.notes || '')
    setShareNotice('Member share saved (policy only — earn wiring comes later)')
  }

  const saveOverride = async (campaignId: number) => {
    if (!canWrite) return
    const key = String(campaignId)
    const raw = overrideDrafts[key]
    setSavingOverrideId(key)
    setError(null)
    const res = await adminFetch<PassThrough>('/api/admin/commission/cuelinks', token, {
      method: 'PUT',
      body: JSON.stringify({
        campaignId,
        campaignOverride: raw === undefined || raw.trim() === '' ? null : Number(raw),
      }),
    })
    setSavingOverrideId(null)
    if (!res.data) {
      setError(res.error || 'Failed to save campaign override')
      return
    }
    setPassThrough(res.data)
    const drafts: Record<string, string> = {}
    for (const [k, v] of Object.entries(res.data.campaignOverrides || {})) {
      drafts[k] = String(v)
    }
    setOverrideDrafts(drafts)
  }

  const filters: { id: FilterMode; label: string }[] = useMemo(
    () => [
      { id: 'all', label: 'All campaigns' },
      { id: 'new_existing', label: 'New / Existing' },
      { id: 'cpc', label: 'Pay per click' },
    ],
    [],
  )

  const shown = rows.length
  const totalMatching = meta?.total ?? 0
  const effectiveShare = (id: number) => {
    const key = String(id)
    if (passThrough.campaignOverrides[key] != null) return passThrough.campaignOverrides[key]
    return passThrough.memberSharePercent
  }

  return (
    <section className="space-y-5">
      <PageHeader
        title="CueLinks commissions"
        subtitle="Vendor rates from CueLinks are read-only. Set Yureka’s member Goldback share of those payouts below."
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

      <form onSubmit={saveShare} className={`${surfaceClass} grid gap-3 p-5 md:grid-cols-2`}>
        <h3 className="md:col-span-2 text-[15px] font-semibold tracking-[-0.015em] text-white">
          Member Goldback share of CueLinks payout
        </h3>
        <div>
          <FieldLabel>Default member share (%)</FieldLabel>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            disabled={!canWrite}
            className={fieldClass}
            value={shareDraft}
            onChange={(e) => setShareDraft(e.target.value)}
          />
          <p className="mt-1 text-[12px] text-white/40">
            Stored for future earn wiring — does not credit members yet.
          </p>
        </div>
        <div>
          <FieldLabel>Ops notes</FieldLabel>
          <input
            disabled={!canWrite}
            className={fieldClass}
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="Optional"
          />
        </div>
        {canWrite && (
          <div className="md:col-span-2">
            <button type="submit" disabled={savingShare} className={primaryBtnClass}>
              {savingShare ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save share %
            </button>
          </div>
        )}
      </form>

      {shareNotice && <Callout tone="ok">{shareNotice}</Callout>}

      {meta && (
        <div className="flex flex-wrap gap-2">
          <StatusPill tone="neutral">{meta.catalogTotal.toLocaleString('en-IN')} in catalog</StatusPill>
          <StatusPill tone="ok">{meta.newExistingTotal.toLocaleString('en-IN')} with new/existing</StatusPill>
          <StatusPill tone="warn">{meta.payPerClickTotal.toLocaleString('en-IN')} pay-per-click</StatusPill>
          <StatusPill tone="neutral">
            Showing {shown.toLocaleString('en-IN')} of {totalMatching.toLocaleString('en-IN')}
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
          <EmptyState>
            {filter === 'new_existing'
              ? 'No campaigns with new/existing rates — try “All campaigns” or refresh the catalog.'
              : filter === 'cpc'
                ? 'No pay-per-click campaigns match — try “All campaigns” or clear search.'
                : 'No campaigns match this filter'}
          </EmptyState>
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
                  <th className="px-4 py-3 font-medium">Member share</th>
                  <th className="px-4 py-3 font-medium">Flags</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const open = expandedId === row.id
                  const key = String(row.id)
                  const hasOverride = passThrough.campaignOverrides[key] != null
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
                        <td className="px-4 py-3 tabular-nums text-white/70">
                          {effectiveShare(row.id)}%
                          {hasOverride ? <span className="ml-1 text-[11px] text-clay">override</span> : null}
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
                          <td colSpan={7} className="px-4 py-4">
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
                            {canWrite && (
                              <div
                                className="mt-4 flex flex-wrap items-end gap-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="min-w-[140px]">
                                  <FieldLabel>Override member share %</FieldLabel>
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    className={fieldClass}
                                    placeholder={`Default ${passThrough.memberSharePercent}`}
                                    value={overrideDrafts[key] ?? ''}
                                    onChange={(e) =>
                                      setOverrideDrafts((prev) => ({ ...prev, [key]: e.target.value }))
                                    }
                                  />
                                </div>
                                <button
                                  type="button"
                                  disabled={savingOverrideId === key}
                                  className={secondaryBtnClass}
                                  onClick={() => void saveOverride(row.id)}
                                >
                                  {savingOverrideId === key ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <Save size={14} />
                                  )}
                                  Save override
                                </button>
                                {hasOverride && (
                                  <button
                                    type="button"
                                    disabled={savingOverrideId === key}
                                    className={secondaryBtnClass}
                                    onClick={() => {
                                      setOverrideDrafts((prev) => ({ ...prev, [key]: '' }))
                                      void (async () => {
                                        setSavingOverrideId(key)
                                        const res = await adminFetch<PassThrough>(
                                          '/api/admin/commission/cuelinks',
                                          token,
                                          {
                                            method: 'PUT',
                                            body: JSON.stringify({
                                              campaignId: row.id,
                                              campaignOverride: null,
                                            }),
                                          },
                                        )
                                        setSavingOverrideId(null)
                                        if (res.data) {
                                          setPassThrough(res.data)
                                          const drafts: Record<string, string> = {}
                                          for (const [k, v] of Object.entries(res.data.campaignOverrides || {})) {
                                            drafts[k] = String(v)
                                          }
                                          setOverrideDrafts(drafts)
                                        }
                                      })()
                                    }}
                                  >
                                    Clear override
                                  </button>
                                )}
                              </div>
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

      {!loading && rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-white/45">
            Showing {shown.toLocaleString('en-IN')} of {totalMatching.toLocaleString('en-IN')}
          </p>
          {hasMore && (
            <button
              type="button"
              disabled={loadingMore}
              className={secondaryBtnClass}
              onClick={() => void loadPage(rows.length, true)}
            >
              {loadingMore ? <Loader2 size={16} className="animate-spin" /> : null}
              Load more
            </button>
          )}
        </div>
      )}
    </section>
  )
}
