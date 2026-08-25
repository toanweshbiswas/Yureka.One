import React, { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Loader2, Plane, Trash2, UserPlus } from 'lucide-react'
import { Callout, EmptyState, PageHeader, SectionHeading, Surface, fieldClass, primaryBtnClass, pressClass } from './ui'

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

type Overview = {
  org: { id: string; name: string; slug: string }
  analytics: {
    trips: number
    publishedTrips: number
    registrations: number
    paidRegistrations: number
    partialRegistrations: number
    revenueInr: number
    planVsFull: { full: number; plan: number }
    byTrip: {
      tripId: string
      title: string
      registrations: number
      paid: number
      revenueInr: number
      seatsLeft: number
    }[]
    promoters: {
      memberId: string
      email: string
      code: string
      registrations: number
      paid?: number
      revenueInr: number
      clicks?: number
    }[]
    byBuyer?: {
      userId: string
      buyerEmail: string
      buyerName: string
      registrations: number
      paid: number
      revenueInr: number
      promoterCodes: string[]
    }[]
  }
  trips: {
    id: string
    title: string
    slug: string
    status: string
    priceInr: number
    seats: number
    seatsTaken: number
    startDate: string
    paymentPlansEnabled: boolean
  }[]
  members: { id: string; email: string; role: string; joinedAt?: string | null }[]
  registrations: {
    registration: {
      id: string
      buyerName: string
      buyerEmail: string
      status: string
      paymentMode: string
      amountPaidInr: number
      amountDueInr: number
      promoterCode?: string | null
      createdAt: string
    }
    trip: { title: string } | null
  }[]
  opsUrl: string
  getawayUrl: string
}

export default function WanderWorldTab({ token, canWrite }: { token: string | null; canWrite: boolean }) {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('promoter')
  const [inviteInfo, setInviteInfo] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const match = (...parts: Array<string | null | undefined | number>) => {
    if (!q) return true
    return parts.some((p) => String(p ?? '').toLowerCase().includes(q))
  }

  const load = useCallback(async () => {
    if (!canWrite) {
      setLoading(false)
      setData(null)
      setError(null)
      return
    }
    setLoading(true)
    const res = await adminFetch<Overview>('/api/admin/wanderworld/overview', token)
    if (!res.data) {
      setError(res.error || 'Failed to load WanderWorld')
      setData(null)
      setLoading(false)
      return
    }
    setData(res.data)
    setError(null)
    setLoading(false)
  }, [token, canWrite])

  useEffect(() => {
    void load()
  }, [load])

  if (!canWrite) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="WanderWorld"
          subtitle="Trips sold in Join your getaway — registrations, revenue, team, and ops links."
        />
        <Callout tone="error">Viewer role cannot access WanderWorld buyer or revenue data.</Callout>
      </div>
    )
  }

  const invite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canWrite) return
    setSaving(true)
    setInviteInfo(null)
    setError(null)
    const res = await adminFetch<{ member: { email: string; role: string }; emailed?: boolean }>(
      '/api/admin/wanderworld/members',
      token,
      { method: 'POST', body: JSON.stringify({ email: inviteEmail, role: inviteRole }) },
    )
    setSaving(false)
    if (!res.data) {
      setError(res.error || 'Invite failed')
      return
    }
    setInviteEmail('')
    setInviteInfo(
      res.data.emailed
        ? `Invited ${res.data.member.email} as ${res.data.member.role} (email sent).`
        : `Invited ${res.data.member.email} as ${res.data.member.role}. They can sign in at WanderWorld ops.`,
    )
    await load()
  }

  const removeMember = async (id: string, email: string) => {
    if (!canWrite) return
    if (!window.confirm(`Remove ${email} from WanderWorld ops?`)) return
    setSaving(true)
    setError(null)
    const res = await adminFetch<{ deleted: boolean }>(
      `/api/admin/wanderworld/members/${encodeURIComponent(id)}`,
      token,
      { method: 'DELETE' },
    )
    setSaving(false)
    if (!res.data?.deleted) {
      setError(res.error || 'Could not remove member')
      return
    }
    setInviteInfo(`Removed ${email}`)
    await load()
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-7 w-7 animate-spin text-white/40" />
      </div>
    )
  }

  const a = data?.analytics

  return (
    <div className="space-y-6">
      <PageHeader
        title="WanderWorld"
        subtitle="Club overview of trips and bookings. Day-to-day ops (publish trips, group links, cash) live in the WanderWorld portal."
      />

      {error && <Callout tone="error">{error}</Callout>}
      {inviteInfo && <Callout tone="ok">{inviteInfo}</Callout>}

      {data && (
        <>
          <div className="flex flex-wrap gap-2">
            <a
              href={data.opsUrl}
              target="_blank"
              rel="noreferrer"
              className={`${pressClass} inline-flex items-center gap-2 rounded-[12px] bg-white px-3.5 py-2 text-[14px] font-medium text-black`}
            >
              <ExternalLink size={14} /> Open ops portal
            </a>
            <a
              href={data.getawayUrl}
              target="_blank"
              rel="noreferrer"
              className={`${pressClass} inline-flex items-center gap-2 rounded-[12px] bg-white/[0.06] px-3.5 py-2 text-[14px] font-medium text-white/70 hover:text-white`}
            >
              <Plane size={14} /> Join your getaway
            </a>
          </div>

          <input
            className={fieldClass}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search buyers, trips, promoters, or emails…"
            autoComplete="off"
          />

          <SectionHeading title="Snapshot" subtitle="Live counts from the WanderWorld store." />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ['Published trips', a?.publishedTrips ?? 0],
              ['Registrations', a?.registrations ?? 0],
              ['Paid', a?.paidRegistrations ?? 0],
              ['Revenue', `₹${Math.round(a?.revenueInr || 0).toLocaleString('en-IN')}`],
            ].map(([label, value]) => (
              <Surface key={String(label)} className="p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">{label}</p>
                <p className="mt-2 text-2xl font-black text-white">{value}</p>
              </Surface>
            ))}
          </div>

          <Surface className="p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">Pay mix</p>
            <p className="mt-2 text-sm text-white/70">
              Full pay: {a?.planVsFull.full ?? 0} · Plans: {a?.planVsFull.plan ?? 0} · Partial:{' '}
              {a?.partialRegistrations ?? 0}
            </p>
          </Surface>

          <SectionHeading
            title="Buyers & referrals"
            subtitle="Who booked and which promoter codes are tracking."
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <Surface className="overflow-x-auto p-0">
              <div className="border-b border-white/10 px-4 py-3 font-semibold text-white">Buyers</div>
              {(a?.byBuyer || []).filter((b) => match(b.buyerName, b.buyerEmail, ...(b.promoterCodes || [])))
                .length === 0 ? (
                <EmptyState>{q ? 'No buyers match.' : 'No buyers yet.'}</EmptyState>
              ) : (
                <table className="w-full min-w-[360px] text-left text-sm">
                  <thead className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/40">
                    <tr>
                      <th className="px-4 py-2">Buyer</th>
                      <th className="px-4 py-2">Regs</th>
                      <th className="px-4 py-2">Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(a?.byBuyer || [])
                      .filter((b) => match(b.buyerName, b.buyerEmail, ...(b.promoterCodes || [])))
                      .slice(0, 20)
                      .map((b) => (
                      <tr key={b.userId || b.buyerEmail} className="border-t border-white/5">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-white">{b.buyerName}</div>
                          <div className="text-xs text-white/40">{b.buyerEmail}</div>
                        </td>
                        <td className="px-4 py-2.5 text-white/55">{b.registrations}</td>
                        <td className="px-4 py-2.5 text-white/55">{b.paid}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Surface>
            <Surface className="overflow-x-auto p-0">
              <div className="border-b border-white/10 px-4 py-3 font-semibold text-white">Referral tracking</div>
              {(a?.promoters || []).filter((p) => match(p.code, p.email)).length === 0 ? (
                <EmptyState>{q ? 'No promoters match.' : 'No referral activity yet.'}</EmptyState>
              ) : (
                <table className="w-full min-w-[360px] text-left text-sm">
                  <thead className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/40">
                    <tr>
                      <th className="px-4 py-2">Code</th>
                      <th className="px-4 py-2">Clicks</th>
                      <th className="px-4 py-2">Regs</th>
                      <th className="px-4 py-2">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(a?.promoters || [])
                      .filter((p) => match(p.code, p.email))
                      .map((p) => (
                      <tr key={p.memberId} className="border-t border-white/5">
                        <td className="px-4 py-2.5">
                          <div className="font-mono text-xs text-white">{p.code || '—'}</div>
                          <div className="text-xs text-white/40">{p.email}</div>
                        </td>
                        <td className="px-4 py-2.5 text-white/55">{p.clicks ?? 0}</td>
                        <td className="px-4 py-2.5 text-white/55">{p.registrations}</td>
                        <td className="px-4 py-2.5 text-white/55">
                          ₹{Math.round(p.revenueInr).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Surface>
          </div>

          <SectionHeading
            title="Inventory & bookings"
            subtitle="Create and publish trips in the ops portal — this list is read-only here."
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <Surface className="overflow-x-auto p-0">
              <div className="border-b border-white/10 px-4 py-3 font-semibold text-white">Trips</div>
              {data.trips.filter((t) => match(t.title, t.slug, t.status)).length === 0 ? (
                <EmptyState>
                  {q
                    ? 'No trips match.'
                    : 'No trips yet — create and publish in the WanderWorld ops portal.'}
                </EmptyState>
              ) : (
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/40">
                    <tr>
                      <th className="px-4 py-2">Title</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Seats</th>
                      <th className="px-4 py-2">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.trips
                      .filter((t) => match(t.title, t.slug, t.status))
                      .map((t) => (
                      <tr key={t.id} className="border-t border-white/5">
                        <td className="px-4 py-2.5 font-medium text-white">{t.title}</td>
                        <td className="px-4 py-2.5 text-white/55">{t.status}</td>
                        <td className="px-4 py-2.5 text-white/55">
                          {t.seatsTaken}/{t.seats}
                        </td>
                        <td className="px-4 py-2.5 text-white/55">₹{t.priceInr.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Surface>

            <Surface className="overflow-x-auto p-0">
              <div className="border-b border-white/10 px-4 py-3 font-semibold text-white">Recent registrations</div>
              {data.registrations.filter(({ registration, trip }) =>
                match(
                  registration.buyerName,
                  registration.buyerEmail,
                  trip?.title,
                  registration.status,
                  registration.promoterCode,
                ),
              ).length === 0 ? (
                <EmptyState>
                  {q
                    ? 'No registrations match.'
                    : 'No registrations yet — bookings from Join your getaway will show here.'}
                </EmptyState>
              ) : (
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/40">
                    <tr>
                      <th className="px-4 py-2">Buyer</th>
                      <th className="px-4 py-2">Trip</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.registrations
                      .filter(({ registration, trip }) =>
                        match(
                          registration.buyerName,
                          registration.buyerEmail,
                          trip?.title,
                          registration.status,
                          registration.promoterCode,
                        ),
                      )
                      .map(({ registration, trip }) => (
                      <tr key={registration.id} className="border-t border-white/5">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-white">{registration.buyerName}</div>
                          <div className="text-xs text-white/40">{registration.buyerEmail}</div>
                        </td>
                        <td className="px-4 py-2.5 text-white/55">{trip?.title || '—'}</td>
                        <td className="px-4 py-2.5 text-white/55">
                          {registration.status} · {registration.paymentMode}
                        </td>
                        <td className="px-4 py-2.5 text-white/55">
                          ₹{Math.round(registration.amountPaidInr).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Surface>
          </div>

          <SectionHeading
            title="Ops team"
            subtitle="Invite promoters or owners. They use wanderworld.yureka.one — same store as this overview."
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <Surface className="p-4">
              <h3 className="mb-3 font-semibold text-white">Team</h3>
              <ul className="space-y-2">
                {data.members
                  .filter((m) => match(m.email, m.role))
                  .map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-[12px] bg-white/[0.04] px-3 py-2.5"
                  >
                    <div>
                      <div className="text-sm font-medium text-white">{m.email}</div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
                        {m.role} · {m.joinedAt ? 'joined' : 'pending'}
                      </div>
                    </div>
                    {canWrite && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void removeMember(m.id, m.email)}
                        className={`${pressClass} inline-flex items-center gap-1.5 rounded-[10px] bg-red-500/15 px-2.5 py-2 text-[11px] font-medium text-red-200 hover:bg-red-500/25 disabled:opacity-50`}
                        title="Remove member"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    )}
                  </li>
                ))}
                {data.members.length === 0 && (
                  <p className="text-sm text-white/40">No members yet — invite an owner below.</p>
                )}
              </ul>
            </Surface>

            <Surface className="p-4">
              <h3 className="mb-1 font-semibold text-white">Invite owner / admin / promoter</h3>
              <p className="mb-3 text-sm text-white/45">
                Seed the first owner or add team members. They sign in at{' '}
                <span className="font-mono text-white/60">wanderworld.yureka.one</span>.
              </p>
              <form onSubmit={invite} className="space-y-3">
                <input
                  className={fieldClass}
                  type="email"
                  placeholder="Email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  disabled={!canWrite}
                />
                <select
                  className={fieldClass}
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  disabled={!canWrite}
                >
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                  <option value="promoter">Promoter</option>
                </select>
                <button type="submit" disabled={!canWrite || saving} className={`${primaryBtnClass} w-full`}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Send invite
                </button>
              </form>
            </Surface>
          </div>

          {a && a.promoters.length > 0 && (
            <Surface className="overflow-x-auto p-0">
              <div className="border-b border-white/10 px-4 py-3 font-semibold text-white">Promoter attribution</div>
              <table className="w-full min-w-[400px] text-left text-sm">
                <thead className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/40">
                  <tr>
                    <th className="px-4 py-2">Email</th>
                    <th className="px-4 py-2">Code</th>
                    <th className="px-4 py-2">Regs</th>
                    <th className="px-4 py-2">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {a.promoters.map((p) => (
                    <tr key={p.memberId} className="border-t border-white/5">
                      <td className="px-4 py-2.5 text-white">{p.email}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-white/55">{p.code || '—'}</td>
                      <td className="px-4 py-2.5 text-white/55">{p.registrations}</td>
                      <td className="px-4 py-2.5 text-white/55">
                        ₹{Math.round(p.revenueInr).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Surface>
          )}
        </>
      )}
    </div>
  )
}
