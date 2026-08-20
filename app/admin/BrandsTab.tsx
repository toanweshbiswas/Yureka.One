import React, { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Pause, Play, ArrowLeft } from 'lucide-react'
import type { BrandListRow, BrandMember, BrandOffer, BrandOverview } from '@backend/lib/brand/types'
import { BrandActivityChart } from '../brand/BrandCharts'
import {
  Callout,
  EmptyState,
  PageHeader,
  Surface,
  fieldClass,
  primaryBtnClass,
  secondaryBtnClass,
  surfaceClass,
} from './ui'

interface Envelope<T> {
  data: T | null
  status: number
  error?: string
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

export default function BrandsTab({ token, canWrite }: { token: string | null; canWrite: boolean }) {
  const [brands, setBrands] = useState<BrandListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<{
    brand: BrandListRow | { id: string; name: string; status: string; website?: string | null; category: string }
    overview: BrandOverview | null
    offers: BrandOffer[]
    members: BrandMember[]
  } | null>(null)
  const [form, setForm] = useState({ name: '', website: '', category: 'general', contactEmail: '', logoUrl: '', notes: '' })
  const [invite, setInvite] = useState({ email: '', role: 'editor' })
  const [saving, setSaving] = useState(false)

  const loadList = useCallback(async () => {
    const res = await adminFetch<{ brands: BrandListRow[] }>('/api/admin/brands', token)
    if (!res.data) {
      setError(res.error || 'Failed to load brands')
      setLoading(false)
      return
    }
    setBrands(res.data.brands)
    setError(null)
    setLoading(false)
  }, [token])

  const loadDetail = useCallback(async (id: string) => {
    const res = await adminFetch<{
      brand: BrandListRow
      overview: BrandOverview
      offers: BrandOffer[]
      members: BrandMember[]
    }>(`/api/admin/brands/${encodeURIComponent(id)}`, token)
    if (!res.data) {
      setError(res.error || 'Failed to load brand')
      return
    }
    setDetail(res.data)
  }, [token])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId)
  }, [selectedId, loadDetail])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canWrite) return
    setSaving(true)
    const res = await adminFetch<{ brand: BrandListRow }>('/api/admin/brands', token, {
      method: 'POST',
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (!res.data) {
      setError(res.error || 'Could not create brand')
      return
    }
    setForm({ name: '', website: '', category: 'general', contactEmail: '', logoUrl: '', notes: '' })
    await loadList()
    setSelectedId(res.data.brand.id)
  }

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedId || !canWrite) return
    setSaving(true)
    const res = await adminFetch(`/api/admin/brands/${encodeURIComponent(selectedId)}/invites`, token, {
      method: 'POST',
      body: JSON.stringify(invite),
    })
    setSaving(false)
    if (!res.data) {
      setError(res.error || 'Could not invite')
      return
    }
    setInvite({ email: '', role: 'editor' })
    await loadDetail(selectedId)
  }

  const pauseBrand = async () => {
    if (!selectedId || !detail || !canWrite) return
    const next = detail.brand.status === 'paused' ? 'active' : 'paused'
    const res = await adminFetch(`/api/admin/brands/${encodeURIComponent(selectedId)}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ status: next }),
    })
    if (!res.data) setError(res.error || 'Could not update brand')
    else {
      await loadList()
      await loadDetail(selectedId)
    }
  }

  const pauseOffer = async (offer: BrandOffer) => {
    if (!selectedId || !canWrite) return
    const res = await adminFetch(
      `/api/admin/brands/${encodeURIComponent(selectedId)}/offers/${encodeURIComponent(offer.id)}`,
      token,
      { method: 'PATCH', body: JSON.stringify({ active: !offer.active }) },
    )
    if (!res.data) setError(res.error || 'Could not update offer')
    else await loadDetail(selectedId)
  }

  if (selectedId && detail) {
    return (
      <section className="space-y-6">
        <button type="button" onClick={() => { setSelectedId(null); setDetail(null) }} className="inline-flex items-center gap-2 text-[13px] text-white/50 hover:text-white">
          <ArrowLeft size={14} /> All brands
        </button>
        <PageHeader
          title={detail.brand.name}
          subtitle={`${detail.brand.category} · ${detail.brand.status}`}
          actions={canWrite ? (
            <button type="button" onClick={() => void pauseBrand()} className={secondaryBtnClass}>
              {detail.brand.status === 'paused' ? <><Play size={14} /> Activate</> : <><Pause size={14} /> Pause brand</>}
            </button>
          ) : undefined}
        />
        {error && <Callout tone="error">{error}</Callout>}
        {detail.overview && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Live offers', value: detail.overview.liveOfferCount },
                { label: 'Clicks (30d)', value: detail.overview.clicks },
                { label: 'Copies', value: detail.overview.copies },
                { label: 'Unique members', value: detail.overview.uniqueUsers },
              ].map((s) => (
                <Surface key={s.label} className="p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">{s.label}</p>
                  <p className="text-xl font-semibold mt-1">{s.value.toLocaleString('en-IN')}</p>
                </Surface>
              ))}
            </div>
            <Surface className="p-5">
              <BrandActivityChart data={detail.overview.series} />
            </Surface>
          </>
        )}
        {canWrite && (
          <form onSubmit={sendInvite} className={`${surfaceClass} p-5 grid sm:grid-cols-[1fr_140px_auto] gap-3`}>
            <input required type="email" className={fieldClass} placeholder="Invite email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
            <select className={fieldClass} value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>
              <option value="owner">Owner</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button type="submit" disabled={saving} className={primaryBtnClass}>Invite</button>
          </form>
        )}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35 mb-3">Offers</h3>
            <div className="space-y-2">
              {detail.offers.map((o) => (
                <Surface key={o.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{o.title}</p>
                    <p className="text-[12px] text-white/40">{o.clicks || 0} clicks · {o.active ? 'live' : 'paused'}</p>
                  </div>
                  {canWrite && (
                    <button type="button" onClick={() => void pauseOffer(o)} className="text-[11px] text-white/50 hover:text-white">
                      {o.active ? 'Pause' : 'Resume'}
                    </button>
                  )}
                </Surface>
              ))}
              {!detail.offers.length && <EmptyState>No offers yet</EmptyState>}
            </div>
          </div>
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35 mb-3">Members</h3>
            <div className="space-y-2">
              {detail.members.map((m) => (
                <Surface key={m.id} className="p-4">
                  <p className="text-sm font-semibold">{m.email}</p>
                  <p className="text-[12px] text-white/40 mt-1">{m.role} · {m.joinedAt ? 'joined' : 'invited'}</p>
                </Surface>
              ))}
              {!detail.members.length && <EmptyState>No members invited</EmptyState>}
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <PageHeader title="Brands" subtitle="Onboard partners by creating a brand, then inviting their email. Offers they publish go live immediately; you can pause a brand or a single offer." />
      {error && <Callout tone="error">{error}</Callout>}
      {canWrite && (
        <form onSubmit={create} className={`${surfaceClass} p-5 grid md:grid-cols-2 gap-3`}>
          <h3 className="md:col-span-2 text-[15px] font-semibold flex items-center gap-2"><Plus size={16} /> Add brand</h3>
          <input required className={fieldClass} placeholder="Brand name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={fieldClass} placeholder="Website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          <input className={fieldClass} placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <input className={fieldClass} placeholder="Contact email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
          <input className={`${fieldClass} md:col-span-2`} placeholder="Logo URL" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} />
          <textarea className={`${fieldClass} md:col-span-2`} rows={2} placeholder="Internal notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <button type="submit" disabled={saving} className={`${primaryBtnClass} md:col-span-2`}>Create brand</button>
        </form>
      )}
      {loading ? (
        <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-clay" /></div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {brands.map((b) => (
            <button key={b.id} type="button" onClick={() => setSelectedId(b.id)} className={`${surfaceClass} p-5 text-left hover:border-white/20`}>
              <div className="flex justify-between gap-3">
                <p className="text-[17px] font-semibold">{b.name}</p>
                <span className={`text-[12px] rounded-full px-2.5 py-1 h-fit ${b.status === 'active' ? 'text-clay bg-clay/10' : 'text-white/40 bg-white/5'}`}>{b.status}</span>
              </div>
              <p className="text-white/40 text-[13px] mt-2">
                {b.liveOfferCount} live · {b.clicks30d} clicks (30d) · {b.memberCount} members
              </p>
            </button>
          ))}
          {!brands.length && <EmptyState>No brands onboarded</EmptyState>}
        </div>
      )}
    </section>
  )
}
