import React, { useCallback, useEffect, useState } from 'react'
import {
  Loader2, Plus, Pencil, Trash2, RefreshCw, X, ChevronUp, ChevronDown, GripVertical,
} from 'lucide-react'
import {
  Callout,
  EmptyState,
  FieldLabel,
  PageHeader,
  Surface,
  fieldClass,
  pressClass,
  primaryBtnClass,
  secondaryBtnClass,
} from './ui'
import { BrandLogo } from '@shared/BrandLogo'

interface Envelope<T> {
  data: T | null
  status: number
  error?: string
}

type StoreRow = {
  id: string
  name: string
  domain: string
  url: string
  logoUrl: string | null
  cashback: string | null
  bg: string
  active: boolean
  sortOrder: number
}

const emptyForm = {
  name: '',
  url: '',
  logoUrl: '',
  cashback: '',
  bg: '#ffffff',
  active: true,
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

export default function SuperBrowseTab({ token, canWrite }: { token: string | null; canWrite: boolean }) {
  const [stores, setStores] = useState<StoreRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [dragId, setDragId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await adminFetch<StoreRow[]>('/api/admin/super-browse', token)
    if (!res.data) {
      setError(res.error || 'Failed to load stores')
      setLoading(false)
      return
    }
    setStores(res.data.slice().sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)))
    setError(null)
    setLoading(false)
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const persistOrder = async (next: StoreRow[]) => {
    if (!canWrite) return
    setStores(next)
    setReordering(true)
    setError(null)
    const res = await adminFetch<StoreRow[]>('/api/admin/super-browse/reorder', token, {
      method: 'POST',
      body: JSON.stringify({ ids: next.map((s) => s.id) }),
    })
    setReordering(false)
    if (res.error || !res.data) {
      setError(res.error || 'Reorder failed')
      void load()
      return
    }
    setStores(res.data.slice().sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)))
  }

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= stores.length) return
    const next = stores.slice()
    const [row] = next.splice(index, 1)
    next.splice(target, 0, row)
    void persistOrder(next)
  }

  const onDrop = (overId: string) => {
    if (!dragId || dragId === overId) {
      setDragId(null)
      return
    }
    const from = stores.findIndex((s) => s.id === dragId)
    const to = stores.findIndex((s) => s.id === overId)
    setDragId(null)
    if (from < 0 || to < 0) return
    const next = stores.slice()
    const [row] = next.splice(from, 1)
    next.splice(to, 0, row)
    void persistOrder(next)
  }

  const startEdit = (s: StoreRow) => {
    setEditingId(s.id)
    setForm({
      name: s.name,
      url: s.url,
      logoUrl: s.logoUrl || '',
      cashback: s.cashback || '',
      bg: s.bg || '#ffffff',
      active: s.active !== false,
    })
    setError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm(emptyForm)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canWrite) return
    setSaving(true)
    setError(null)
    const payload = {
      name: form.name,
      url: form.url,
      logoUrl: form.logoUrl || null,
      cashback: form.cashback || null,
      bg: form.bg || '#ffffff',
      active: form.active,
    }
    const res = editingId
      ? await adminFetch<StoreRow>(`/api/admin/super-browse/${encodeURIComponent(editingId)}`, token, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
      : await adminFetch<StoreRow>('/api/admin/super-browse', token, {
          method: 'POST',
          body: JSON.stringify(payload),
        })
    setSaving(false)
    if (res.error || !res.data) {
      setError(res.error || 'Save failed')
      return
    }
    cancelEdit()
    void load()
  }

  const remove = async (id: string) => {
    if (!canWrite) return
    if (!confirm('Remove this Super Browse brand?')) return
    if (editingId === id) cancelEdit()
    const res = await adminFetch<{ deleted?: boolean }>(`/api/admin/super-browse/${encodeURIComponent(id)}`, token, {
      method: 'DELETE',
    })
    if (res.error) {
      setError(res.error)
      return
    }
    void load()
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Super Browse"
        subtitle="Brands shown in Super Browse and Explore — name, website, logo, and display order."
      />
      {canWrite && (
        <form onSubmit={save} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 grid md:grid-cols-2 gap-3">
          <h3 className="md:col-span-2 text-[15px] font-semibold tracking-[-0.015em] flex items-center gap-2">
            {editingId ? <Pencil size={16} /> : <Plus size={16} />}
            {editingId ? 'Edit brand' : 'Add brand'}
          </h3>
          <label className="block">
            <FieldLabel>Brand name</FieldLabel>
            <input
              className={fieldClass}
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Amazon"
            />
          </label>
          <label className="block">
            <FieldLabel>Website</FieldLabel>
            <input
              className={fieldClass}
              required
              type="url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://www.amazon.in/"
            />
          </label>
          <label className="block md:col-span-2">
            <FieldLabel>Brand logo URL (optional — favicon used if empty)</FieldLabel>
            <input
              className={fieldClass}
              value={form.logoUrl}
              onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
              placeholder="https://…"
            />
          </label>
          <label className="block">
            <FieldLabel>Cashback badge</FieldLabel>
            <input
              className={fieldClass}
              value={form.cashback}
              onChange={(e) => setForm({ ...form, cashback: e.target.value })}
              placeholder="2%"
            />
          </label>
          <label className="block">
            <FieldLabel>Tile background</FieldLabel>
            <input
              className={fieldClass}
              value={form.bg}
              onChange={(e) => setForm({ ...form, bg: e.target.value })}
              placeholder="#ffffff"
            />
          </label>
          {editingId && (
            <label className="md:col-span-2 flex items-center gap-2 text-[14px] text-white/70">
              <input
                type="checkbox"
                className="accent-emerald-400 h-4 w-4"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Active (shown in Super Browse)
            </label>
          )}
          <div className="md:col-span-2 flex flex-wrap gap-2">
            <button type="submit" disabled={saving} className={primaryBtnClass}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : editingId ? <Pencil size={14} /> : <Plus size={14} />}
              {editingId ? 'Update brand' : 'Save brand'}
            </button>
            {editingId && (
              <button type="button" onClick={cancelEdit} className={secondaryBtnClass}>
                <X size={14} /> Cancel
              </button>
            )}
          </div>
        </form>
      )}
      {error && <Callout tone="error">{error}</Callout>}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-white/40">
          {canWrite ? 'Drag rows or use arrows to rearrange · order matches the app grid' : 'Display order'}
          {reordering ? ' · saving…' : ''}
        </p>
        <button type="button" onClick={() => void load()} className={`${pressClass} text-white/40 p-2`}>
          <RefreshCw size={14} />
        </button>
      </div>
      {loading ? (
        <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-clay" /></div>
      ) : (
        <div className="space-y-2">
          {stores.map((s, index) => (
            <div
              key={s.id}
              onDragOver={(e) => {
                if (!canWrite) return
                e.preventDefault()
              }}
              onDrop={() => {
                if (!canWrite) return
                onDrop(s.id)
              }}
            >
              <Surface
                className={`p-3 flex gap-3 items-center ${editingId === s.id ? 'ring-1 ring-clay/40' : ''} ${
                  dragId === s.id ? 'opacity-60' : ''
                }`}
              >
              {canWrite && (
                <button
                  type="button"
                  draggable
                  onDragStart={() => setDragId(s.id)}
                  onDragEnd={() => setDragId(null)}
                  className={`${pressClass} cursor-grab active:cursor-grabbing text-white/25 hover:text-white/55 p-1.5 shrink-0`}
                  aria-label={`Drag to reorder ${s.name}`}
                  title="Drag to reorder"
                >
                  <GripVertical size={16} />
                </button>
              )}
              <span className="text-[11px] tabular-nums text-white/30 w-5 shrink-0 text-center">{index + 1}</span>
              <div
                className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-white/10"
                style={{ background: s.bg }}
              >
                <BrandLogo
                  domain={s.domain}
                  name={s.name}
                  logoUrl={s.logoUrl}
                  className="flex h-7 w-7 items-center justify-center"
                  imgClassName="h-7 w-7 object-contain"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate text-[15px]">{s.name}</p>
                <p className="text-[12px] text-white/40 truncate">{s.domain}</p>
                <div className="flex flex-wrap gap-2 mt-0.5">
                  {s.cashback && <span className="text-[11px] text-clay">{s.cashback}</span>}
                  {!s.active && <span className="text-[11px] text-amber-300/80">Inactive</span>}
                </div>
              </div>
              {canWrite && (
                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    disabled={index === 0 || reordering}
                    onClick={() => move(index, -1)}
                    className={`${pressClass} text-white/40 hover:text-white p-2 disabled:opacity-25`}
                    aria-label={`Move ${s.name} up`}
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    disabled={index === stores.length - 1 || reordering}
                    onClick={() => move(index, 1)}
                    className={`${pressClass} text-white/40 hover:text-white p-2 disabled:opacity-25`}
                    aria-label={`Move ${s.name} down`}
                  >
                    <ChevronDown size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(s)}
                    className={`${pressClass} text-white/40 hover:text-clay p-2`}
                    aria-label={`Edit ${s.name}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(s.id)}
                    className={`${pressClass} text-red-300/50 hover:text-red-300 p-2`}
                    aria-label={`Delete ${s.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
              </Surface>
            </div>
          ))}
          {!stores.length && <EmptyState>No Super Browse brands yet</EmptyState>}
        </div>
      )}
    </section>
  )
}
