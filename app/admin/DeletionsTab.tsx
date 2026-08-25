import React, { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import {
  Callout,
  EmptyState,
  PageHeader,
  ghostBtnClass,
  pressClass,
  primaryBtnClass,
  secondaryBtnClass,
} from './ui'

type DeletionRow = {
  id: string
  email: string
  fullName: string | null
  reason: string | null
  status: string
  purgeAt: string | null
  requestedAt: string
  reviewedAt: string | null
  reviewedBy: string | null
  source: string
  purgedAt: string | null
}

export function DeletionsTab({
  token,
  canWrite,
}: {
  token: string | null
  canWrite: boolean
}) {
  const [items, setItems] = useState<DeletionRow[]>([])
  const [retentionDays, setRetentionDays] = useState(30)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'all'>('pending')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token || !canWrite) {
      setLoading(false)
      setItems([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/deletion-requests?status=${filter}`, {
        headers: { 'X-Admin-Session': token },
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'Failed to load')
      setItems(json.data?.items || [])
      if (json.data?.retentionDays) setRetentionDays(json.data.retentionDays)
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
    }
    setLoading(false)
  }, [token, filter, canWrite])

  useEffect(() => {
    void load()
  }, [load])

  if (!canWrite) {
    return (
      <section className="space-y-6">
        <PageHeader
          title="Deletions"
          subtitle="Member deletion requests and retention."
        />
        <p className="rounded-[12px] border border-white/10 bg-white/[0.04] px-4 py-3 text-[14px] text-white/50">
          Viewer role cannot access deletion request details.
        </p>
      </section>
    )
  }

  const act = async (id: string, action: 'approve' | 'reject' | 'purge', force = false) => {
    if (!token || !canWrite) return
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/deletion-requests/${encodeURIComponent(id)}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Session': token,
        },
        body: JSON.stringify(action === 'purge' ? { force } : {}),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'Action failed')
      await load()
    } catch (e: any) {
      setError(e?.message || 'Action failed')
    }
    setBusyId(null)
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Deletions"
        subtitle={`Member requests need approval. Approved accounts are held ${retentionDays} days, then permanently deleted.`}
        actions={
          <button type="button" onClick={() => void load()} className={ghostBtnClass} aria-label="Refresh">
            <RefreshCw size={14} />
            Refresh
          </button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {(['pending', 'approved', 'all'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`${pressClass} rounded-[12px] px-3.5 py-2 text-[14px] font-medium capitalize ${
              filter === f ? 'bg-white text-black' : 'bg-white/[0.06] text-white/50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {error && <Callout tone="error">{error}</Callout>}
      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="animate-spin text-clay" />
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-4 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{r.fullName || r.email}</p>
                  <p className="text-[12px] text-white/40 truncate">{r.email}</p>
                  <p className="text-[11px] text-white/30 mt-1">
                    {r.status} · {r.source} · requested{' '}
                    {new Date(r.requestedAt).toLocaleString('en-IN')}
                    {r.purgeAt ? ` · purge ${new Date(r.purgeAt).toLocaleString('en-IN')}` : ''}
                  </p>
                  {r.reason ? <p className="text-[13px] text-white/55 mt-2">{r.reason}</p> : null}
                </div>
                {canWrite && (
                  <div className="flex flex-wrap gap-2">
                    {r.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void act(r.id, 'approve')}
                          className={primaryBtnClass}
                        >
                          Approve ({retentionDays}d)
                        </button>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void act(r.id, 'reject')}
                          className={secondaryBtnClass}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {r.status === 'approved' && (
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => {
                          if (
                            confirm(
                              'Permanently delete this user now? This skips the remaining retention window.',
                            )
                          ) {
                            void act(r.id, 'purge', true)
                          }
                        }}
                        className={`${pressClass} rounded-[14px] bg-red-500/20 text-red-200 px-4 py-2.5 text-[13px] font-semibold`}
                      >
                        Purge now
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {!items.length && <EmptyState>No deletion requests for this filter</EmptyState>}
        </div>
      )}
    </section>
  )
}
