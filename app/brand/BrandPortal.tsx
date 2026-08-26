import React, { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Loader2, LogOut, Plus, Pause, Play, Store, Users, BarChart3 } from 'lucide-react'
import { useSupabase } from '@shared/SupabaseProvider'
import { signOutGmail } from '@shared/auth'
import { brandApi } from '@backend/lib/brand/client'
import type { BrandMembership, BrandOffer, BrandOverview, BrandMember } from '@backend/lib/brand/types'
import { BrandActivityChart } from './BrandCharts'

const BRAND_ID_KEY = 'yureka_brand_id'

type Tab = 'overview' | 'offers' | 'members'

const emptyForm = {
  title: '',
  url: '',
  couponCode: '',
  category: 'general',
  description: '',
  imageUrl: '',
  startsAt: '',
  endsAt: '',
}

const BrandPortal: React.FC = () => {
  const { user, isLoading } = useSupabase()
  const location = useLocation()
  const userId = user?.id || user?.email || ''
  const [tab, setTab] = useState<Tab>('overview')
  const [memberships, setMemberships] = useState<BrandMembership[]>([])
  const [current, setCurrent] = useState<BrandMembership | null>(null)
  const [overview, setOverview] = useState<BrandOverview | null>(null)
  const [offers, setOffers] = useState<BrandOffer[]>([])
  const [members, setMembers] = useState<BrandMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<BrandOffer | null>(null)

  const brandId = current?.brand.id
  const canEdit = current?.member.role === 'owner' || current?.member.role === 'editor'

  const load = useCallback(async () => {
    if (!userId) return
    const stored = localStorage.getItem(BRAND_ID_KEY) || undefined
    const me = await brandApi.me(userId, stored)
    if (!me.data) {
      setError(me.error || 'Could not load membership')
      setLoading(false)
      return
    }
    setMemberships(me.data.memberships)
    const selected =
      me.data.memberships.find((m) => m.brand.id === stored) || me.data.current || me.data.memberships[0] || null
    setCurrent(selected)
    if (selected) localStorage.setItem(BRAND_ID_KEY, selected.brand.id)
    if (!selected) {
      setLoading(false)
      return
    }
    const [ov, of, mem] = await Promise.all([
      brandApi.overview(userId, selected.brand.id),
      brandApi.offers(userId, selected.brand.id),
      brandApi.members(userId, selected.brand.id),
    ])
    setOverview(ov.data)
    setOffers(of.data?.offers || [])
    setMembers(mem.data?.members || [])
    setError(null)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    void load()
  }, [userId, load])

  const switchBrand = async (id: string) => {
    localStorage.setItem(BRAND_ID_KEY, id)
    setLoading(true)
    await load()
  }

  const saveOffer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !canEdit) return
    setSaving(true)
    const body = {
      title: form.title,
      url: form.url,
      couponCode: form.couponCode || undefined,
      category: form.category,
      description: form.description,
      imageUrl: form.imageUrl || undefined,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      active: true,
    }
    const res = editing
      ? await brandApi.updateOffer(userId, editing.id, body)
      : await brandApi.createOffer(userId, body, brandId)
    setSaving(false)
    if (!res.data) {
      setError(res.error || 'Could not save offer')
      return
    }
    setForm(emptyForm)
    setEditing(null)
    await load()
  }

  const toggleOffer = async (offer: BrandOffer) => {
    if (!userId || !canEdit) return
    const res = await brandApi.updateOffer(userId, offer.id, { active: !offer.active })
    if (!res.data) setError(res.error || 'Could not update offer')
    else await load()
  }

  if (isLoading || (user && loading && !current && !error && memberships.length === 0)) {
    return (
      <div className="min-h-screen bg-[#070707] flex items-center justify-center">
        <Loader2 className="animate-spin text-clay" size={40} />
      </div>
    )
  }

  if (!user && !isLoading) {
    return <Navigate to="/brand/login" state={{ from: location }} replace />
  }

  if (!loading && memberships.length === 0) {
    return (
      <div className="min-h-screen bg-[#070707] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Brand portal</p>
          <h1 className="text-2xl font-black text-white mt-3">You have not been invited yet</h1>
          <p className="text-white/45 text-sm mt-3">
            This portal is invite-only. Ask Yureka to add {user?.email} to a brand, then sign in again.
          </p>
          <button type="button" onClick={() => void signOutGmail()} className="mt-8 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white">
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <header className="border-b border-white/5 px-5 sm:px-8 py-4 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/30">Yureka brands</p>
          <h1 className="text-lg font-black truncate">{current?.brand.name || 'Portal'}</h1>
        </div>
        {memberships.length > 1 && (
          <select
            value={current?.brand.id || ''}
            onChange={(e) => void switchBrand(e.target.value)}
            className="bg-[#111] border border-white/10 rounded-xl px-3 py-2 text-sm"
          >
            {memberships.map((m) => (
              <option key={m.brand.id} value={m.brand.id}>{m.brand.name}</option>
            ))}
          </select>
        )}
        <button type="button" onClick={() => void signOutGmail()} className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/40 hover:text-white">
          <LogOut size={14} /> Sign out
        </button>
      </header>

      <nav className="px-5 sm:px-8 py-3 flex gap-2 border-b border-white/5">
        {([
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'offers', label: 'Offers', icon: Store },
          { id: 'members', label: 'Members', icon: Users },
        ] as const).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] ${tab === item.id ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
          >
            <item.icon size={14} /> {item.label}
          </button>
        ))}
      </nav>

      <main className="px-5 sm:px-8 py-8 max-w-5xl mx-auto space-y-8">
        {error && <p className="text-sm text-red-200 bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3">{error}</p>}
        {current?.brand.status === 'paused' && (
          <p className="text-sm text-amber-200 bg-amber-500/10 border border-amber-400/20 rounded-2xl px-4 py-3">
            This brand is paused. Offers stay hidden from members until Yureka reactivates it.
          </p>
        )}

        {tab === 'overview' && overview && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Live offers', value: overview.liveOfferCount },
                { label: 'Clicks (30d)', value: overview.clicks },
                { label: 'Copies (30d)', value: overview.copies },
                { label: 'Unique members', value: overview.uniqueUsers },
              ].map((stat) => (
                <div key={stat.label} className="rounded-[1.5rem] border border-white/5 bg-white/[0.02] p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">{stat.label}</p>
                  <p className="text-2xl font-black mt-2">{stat.value.toLocaleString('en-IN')}</p>
                </div>
              ))}
            </div>
            <div className="rounded-[1.75rem] border border-white/5 bg-white/[0.02] p-5">
              <BrandActivityChart data={overview.series} />
            </div>
            {!!overview.topOffers.length && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35 mb-3">Top offers</p>
                <ul className="space-y-2">
                  {overview.topOffers.map((o) => (
                    <li key={o.id} className="flex justify-between gap-3 rounded-xl border border-white/5 px-4 py-3 text-sm">
                      <span className="truncate">{o.title}</span>
                      <span className="text-clay font-bold shrink-0">{o.clicks} clicks</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {tab === 'offers' && (
          <>
            {canEdit && (
              <form onSubmit={saveOffer} className="rounded-[1.75rem] border border-white/5 bg-white/[0.02] p-5 grid sm:grid-cols-2 gap-3">
                <p className="sm:col-span-2 text-sm font-bold flex items-center gap-2">
                  <Plus size={16} /> {editing ? 'Edit offer' : 'New offer. live immediately'}
                </p>
                <input required placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2.5 text-sm" />
                <input required placeholder="https://…" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2.5 text-sm" />
                <input placeholder="Coupon code" value={form.couponCode} onChange={(e) => setForm({ ...form, couponCode: e.target.value })} className="rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2.5 text-sm" />
                <input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2.5 text-sm" />
                <input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className="rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2.5 text-sm" />
                <input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} className="rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2.5 text-sm" />
                <input placeholder="Image URL" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} className="sm:col-span-2 rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2.5 text-sm" />
                <textarea placeholder="Description" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="sm:col-span-2 rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2.5 text-sm" />
                <div className="sm:col-span-2 flex gap-2">
                  <button type="submit" disabled={saving} className="rounded-xl bg-clay text-black px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.16em] disabled:opacity-40">
                    {saving ? 'Saving…' : editing ? 'Save' : 'Publish'}
                  </button>
                  {editing && (
                    <button type="button" onClick={() => { setEditing(null); setForm(emptyForm) }} className="rounded-xl border border-white/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/50">
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            )}
            <ul className="space-y-3">
              {offers.map((offer) => (
                <li key={offer.id} className="rounded-[1.5rem] border border-white/5 bg-white/[0.02] p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{offer.title}</p>
                    <p className="text-[12px] text-white/40 mt-1">
                      {offer.category} · {offer.clicks || 0} clicks · {offer.copies || 0} copies
                      {offer.couponCode ? ` · ${offer.couponCode}` : ''}
                    </p>
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-[0.14em] rounded-full px-2.5 py-1 ${offer.active ? 'bg-clay/15 text-clay' : 'bg-white/10 text-white/40'}`}>
                    {offer.active ? 'Live' : 'Paused'}
                  </span>
                  {canEdit && (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setEditing(offer); setForm({ title: offer.title, url: offer.url, couponCode: offer.couponCode || '', category: offer.category, description: offer.description, imageUrl: offer.imageUrl || '', startsAt: offer.startsAt?.slice(0, 16) || '', endsAt: offer.endsAt?.slice(0, 16) || '' }) }} className="text-[10px] font-black uppercase tracking-[0.14em] text-white/50 hover:text-white">
                        Edit
                      </button>
                      <button type="button" onClick={() => void toggleOffer(offer)} className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/50 hover:text-white">
                        {offer.active ? <><Pause size={12} /> Pause</> : <><Play size={12} /> Resume</>}
                      </button>
                    </div>
                  )}
                </li>
              ))}
              {!offers.length && <p className="text-white/35 text-sm text-center py-10">No offers yet.</p>}
            </ul>
          </>
        )}

        {tab === 'members' && (
          <ul className="divide-y divide-white/5 rounded-[1.75rem] border border-white/5 overflow-hidden">
            {members.map((m) => (
              <li key={m.id} className="px-5 py-4 flex justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">{m.email}</p>
                  <p className="text-[11px] text-white/35 mt-0.5">{m.joinedAt ? `Joined ${new Date(m.joinedAt).toLocaleDateString('en-IN')}` : 'Invited, not signed in'}</p>
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">{m.role}</span>
              </li>
            ))}
          </ul>
        )}
      </main>
      <p className="text-center pb-10 text-[10px] uppercase tracking-[0.2em] text-white/20">
        <Link to="/for-brands" className="hover:text-white/50">Partnership deck</Link>
      </p>
    </div>
  )
}

export default BrandPortal
