import React, { useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  Callout,
  ConfirmDialog,
  EmptyState,
  FieldLabel,
  ImageUrlField,
  SectionHeading,
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

type OfferRow = {
  id: string
  title: string
  merchant: string
  url: string
  category: string
  description: string
  imageUrl?: string | null
  rewardPaise: number
  rewardLabel: string
  active: boolean
}

const emptyForm = {
  id: '' as string,
  title: '',
  merchant: '',
  url: '',
  category: 'marketplace',
  description: '',
  imageUrl: '',
  rewardPaise: 2500,
  rewardLabel: '₹25 Goldback',
  active: true,
  labelTouched: false,
}

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

function formatPaise(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function suggestLabel(paise: number) {
  return `${formatPaise(paise)} Goldback`
}

export default function GoldbackOffersTab({
  token,
  canWrite,
}: {
  token: string | null
  canWrite: boolean
}) {
  const [offers, setOffers] = useState<OfferRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const editing = Boolean(form.id)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    const res = await adminFetch<OfferRow[]>('/api/admin/offers', token)
    setLoading(false)
    if (res.error) {
      setError(res.error)
      setOffers([])
      return
    }
    setError(null)
    setOffers(Array.isArray(res.data) ? res.data : [])
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const resetForm = () => setForm(emptyForm)

  const startEdit = (o: OfferRow) => {
    setForm({
      id: o.id,
      title: o.title || '',
      merchant: o.merchant || '',
      url: o.url || '',
      category: o.category || 'marketplace',
      description: o.description || '',
      imageUrl: o.imageUrl || '',
      rewardPaise: Number(o.rewardPaise) || 0,
      rewardLabel: o.rewardLabel || suggestLabel(Number(o.rewardPaise) || 0),
      active: o.active !== false,
      labelTouched: true,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canWrite || saving) return
    setSaving(true)
    setError(null)
    const rewardPaise = Math.max(0, Math.round(Number(form.rewardPaise) || 0))
    const rewardLabel = form.rewardLabel.trim() || suggestLabel(rewardPaise)
    const body: Record<string, unknown> = {
      title: form.title.trim(),
      merchant: form.merchant.trim(),
      url: form.url.trim(),
      category: form.category.trim() || 'marketplace',
      description: form.description.trim(),
      imageUrl: form.imageUrl.trim() || null,
      rewardPaise,
      rewardLabel,
      active: form.active,
    }
    if (form.id) body.id = form.id
    const res = await adminFetch('/api/admin/offers', token, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.error) {
      setError(res.error)
      return
    }
    resetForm()
    await load()
  }

  const toggleActive = async (o: OfferRow) => {
    if (!canWrite || togglingId) return
    setTogglingId(o.id)
    setError(null)
    const res = await adminFetch('/api/admin/offers', token, {
      method: 'POST',
      body: JSON.stringify({
        id: o.id,
        title: o.title,
        merchant: o.merchant,
        url: o.url,
        category: o.category,
        description: o.description,
        imageUrl: o.imageUrl ?? null,
        rewardPaise: o.rewardPaise,
        rewardLabel: o.rewardLabel,
        active: !o.active,
      }),
    })
    setTogglingId(null)
    if (res.error) {
      setError(res.error)
      return
    }
    await load()
  }

  const remove = async (id: string) => {
    if (!id || deletingId) return
    setDeletingId(id)
    setError(null)
    const previous = offers
    setOffers((prev) => prev.filter((o) => o.id !== id))
    const res = await adminFetch<{ deleted?: boolean }>(
      `/api/admin/offers/${encodeURIComponent(id)}`,
      token,
      { method: 'DELETE' },
    )
    setDeletingId(null)
    setPendingDelete(null)
    if (res.error) {
      setOffers(previous)
      setError(res.error)
      return
    }
    if (form.id === id) resetForm()
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Goldback commission structure"
        subtitle="Fixed earn amount per offer (paise). Members receive this Goldback after a verified conversion. not a % of sale."
      />

      {canWrite && (
        <form onSubmit={save} className={`${surfaceClass} grid gap-3 p-5 md:grid-cols-2`}>
          <h3 className="md:col-span-2 flex items-center gap-2 text-[15px] font-semibold tracking-[-0.015em] text-white">
            {editing ? <Pencil size={16} /> : <Plus size={16} />}
            {editing ? 'Edit offer' : 'New offer'}
          </h3>
          <div>
            <FieldLabel>Title</FieldLabel>
            <input
              className={fieldClass}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>
          <div>
            <FieldLabel>Merchant</FieldLabel>
            <input
              className={fieldClass}
              value={form.merchant}
              onChange={(e) => setForm({ ...form, merchant: e.target.value })}
              required
            />
          </div>
          <div className="md:col-span-2">
            <FieldLabel>Tracked URL</FieldLabel>
            <input
              className={fieldClass}
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              required
            />
          </div>
          <ImageUrlField
            className="md:col-span-2"
            label="Offer image"
            value={form.imageUrl}
            onChange={(imageUrl) => setForm({ ...form, imageUrl })}
            token={token}
            canWrite={canWrite}
            placeholder="or paste an image URL"
            previewClassName="h-28 w-full max-w-xs object-cover rounded-[14px] border border-white/10"
          />
          <div>
            <FieldLabel>Category</FieldLabel>
            <input
              className={fieldClass}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </div>
          <div>
            <FieldLabel>Goldback earn amount (paise)</FieldLabel>
            <input
              type="number"
              min={0}
              step={100}
              className={fieldClass}
              value={form.rewardPaise}
              onChange={(e) => {
                const rewardPaise = Number(e.target.value)
                setForm((prev) => ({
                  ...prev,
                  rewardPaise,
                  rewardLabel: prev.labelTouched ? prev.rewardLabel : suggestLabel(rewardPaise),
                }))
              }}
            />
            <p className="mt-1 text-[12px] text-white/40">= {formatPaise(form.rewardPaise || 0)}</p>
          </div>
          <div>
            <FieldLabel>Reward label (member-facing)</FieldLabel>
            <input
              className={fieldClass}
              value={form.rewardLabel}
              onChange={(e) => setForm({ ...form, rewardLabel: e.target.value, labelTouched: true })}
              placeholder={suggestLabel(form.rewardPaise || 0)}
            />
          </div>
          <div className="flex items-end">
            <label className="flex min-h-[46px] items-center gap-2 text-[14px] text-white/70">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="h-4 w-4 rounded border-white/20"
              />
              Live in member catalog
            </label>
          </div>
          <div className="md:col-span-2">
            <FieldLabel>Description</FieldLabel>
            <textarea
              className={fieldClass}
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="md:col-span-2 flex flex-wrap gap-2">
            <button type="submit" disabled={saving} className={primaryBtnClass}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {editing ? 'Save changes' : 'Publish offer'}
            </button>
            {editing && (
              <button type="button" className={secondaryBtnClass} onClick={resetForm}>
                Cancel edit
              </button>
            )}
          </div>
        </form>
      )}

      {error && <Callout tone="error">{error}</Callout>}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-clay" />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {offers.map((o) => (
            <Surface key={o.id} className="p-5">
              <div className="flex justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[17px] font-semibold tracking-[-0.015em]">{o.title}</p>
                  <p className="mt-1 text-[13px] text-white/40">
                    {o.merchant} · {o.category}
                  </p>
                </div>
                <span className="h-fit shrink-0 rounded-full bg-clay/10 px-2.5 py-1 text-[13px] font-semibold text-clay">
                  {o.rewardLabel || formatPaise(o.rewardPaise)}
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-[15px] leading-relaxed text-white/45">{o.description}</p>
              <p className="mt-2 text-[12px] tabular-nums text-white/35">{o.rewardPaise} paise</p>
              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={!canWrite || togglingId === o.id}
                  onClick={() => void toggleActive(o)}
                  className={`${pressClass} rounded-full px-2.5 py-1 text-[12px] font-medium capitalize disabled:opacity-40 ${
                    o.active ? 'bg-clay/10 text-clay' : 'bg-white/5 text-white/35'
                  }`}
                >
                  {togglingId === o.id ? '…' : o.active ? 'Live' : 'Off'}
                </button>
                {canWrite && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(o)}
                      className={`${pressClass} rounded-[10px] p-2 text-white/45 hover:bg-white/10 hover:text-white`}
                      aria-label={`Edit ${o.title}`}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete({ id: o.id, title: o.title })}
                      disabled={deletingId === o.id}
                      className={`${pressClass} rounded-[10px] p-2 text-red-300/60 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40`}
                      aria-label={`Delete ${o.title}`}
                    >
                      {deletingId === o.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                )}
              </div>
            </Surface>
          ))}
          {!offers.length && <EmptyState>No offers yet</EmptyState>}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this offer?"
        body={
          pendingDelete
            ? `${pendingDelete.title} will be removed from the catalog. Members will no longer earn Goldback from it.`
            : ''
        }
        confirmLabel="Delete offer"
        busy={Boolean(pendingDelete && deletingId === pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && void remove(pendingDelete.id)}
      />
    </div>
  )
}
