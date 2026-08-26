import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2, LogOut, Copy, Check, UserPlus, Trash2, Upload, ImagePlus, Banknote, Search, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence, LayoutGroup } from 'motion/react'
import { useSupabase } from '@shared/SupabaseProvider'
import { signOutGmail } from '@shared/auth'
import { appUrl } from '@shared/hosts'
import { wwApi, type WwAnalytics, type WwInstallment, type WwMember, type WwMembership, type WwTrip } from '@backend/lib/wanderworld/client'
import type { WwPlanInstallmentTemplate } from '@backend/lib/wanderworld/types'
import { WwLogo } from './wwBrand'
import { wwLoginPath } from './wwPaths'
import {
  WwPanel,
  WwStat,
  WwTabPanel,
  WwPageHeading,
  WwFieldGroup,
  useWwMotion,
  wwAmbient,
  wwBtnGhost,
  wwBtnPrimary,
  wwBtnSecondary,
  wwChip,
  wwField,
  wwGlassHeader,
  wwLabel,
  wwPage,
  wwSurface,
  wwSurfacePad,
  wwTableWrap,
  wwTd,
  wwTh,
  wwTitle,
  wwSearchField,
} from './wwUi'

type Tab = 'overview' | 'trips' | 'registrations' | 'members' | 'promoter'

function matchesAdminQuery(q: string, ...parts: Array<string | null | undefined | number>) {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  return parts.some((p) => String(p ?? '').toLowerCase().includes(needle))
}

type PlanDraftRow = {
  label: string
  /** Whole percent 1 to 100 for the form */
  percentPct: string
  /** Empty = due at booking */
  daysBeforeStart: string
}

const DEFAULT_PLAN_DRAFT: PlanDraftRow[] = [
  { label: 'Booking deposit', percentPct: '30', daysBeforeStart: '' },
  { label: 'Balance', percentPct: '70', daysBeforeStart: '14' },
]

function tripPlanToDraft(template: WwPlanInstallmentTemplate[] | undefined | null): PlanDraftRow[] {
  if (!template?.length) return DEFAULT_PLAN_DRAFT.map((r) => ({ ...r }))
  return template.map((row, i) => ({
    label: row.label || `Installment ${i + 1}`,
    percentPct: String(Math.round((row.percent > 1 ? row.percent : row.percent * 100) * 100) / 100),
    daysBeforeStart: row.daysBeforeStart == null ? '' : String(row.daysBeforeStart),
  }))
}

function draftToPlanTemplate(rows: PlanDraftRow[]): WwPlanInstallmentTemplate[] | { error: string } {
  if (!rows.length) return { error: 'Add at least one installment' }
  const out: WwPlanInstallmentTemplate[] = []
  let sum = 0
  for (let i = 0; i < rows.length; i++) {
    const pct = Number(rows[i].percentPct)
    if (!Number.isFinite(pct) || pct <= 0) return { error: `Row ${i + 1}: enter a percent greater than 0` }
    if (pct > 100) return { error: `Row ${i + 1}: percent cannot exceed 100` }
    const daysRaw = rows[i].daysBeforeStart.trim()
    let daysBeforeStart: number | null = null
    if (daysRaw !== '') {
      const d = Number(daysRaw)
      if (!Number.isFinite(d) || d < 0) return { error: `Row ${i + 1}: days before start must be 0 or more` }
      daysBeforeStart = Math.floor(d)
    }
    const percent = Math.round(pct) / 100
    sum += percent
    out.push({
      label: (rows[i].label || `Installment ${i + 1}`).trim(),
      percent,
      daysBeforeStart,
    })
  }
  if (Math.abs(sum - 1) > 0.02) {
    return { error: `Percents must add up to 100% (currently ${Math.round(sum * 100)}%)` }
  }
  return out
}

function PlanStepsEditor({
  rows,
  onChange,
  priceInr,
}: {
  rows: PlanDraftRow[]
  onChange: (rows: PlanDraftRow[]) => void
  priceInr?: number
}) {
  const sum = rows.reduce((a, r) => a + (Number(r.percentPct) || 0), 0)
  const price = Number(priceInr) || 0
  return (
    <div className={`${wwSurface} space-y-3 p-4`}>
      <div className="flex items-center justify-between gap-2">
        <p className={wwLabel}>Payment plan steps</p>
        <p
          className={`font-mono text-[11px] tabular-nums ${
            Math.abs(sum - 100) <= 1 ? 'text-emerald-300/85' : 'text-amber-300/90'
          }`}
        >
          {Math.round(sum)}% / 100%
        </p>
      </div>
      {rows.map((row, idx) => {
        const amt = price > 0 ? Math.round((price * (Number(row.percentPct) || 0)) / 100) : null
        return (
          <div
            key={idx}
            className="grid gap-2 rounded-[1.25rem] border border-white/[0.06] bg-black/25 p-3 sm:grid-cols-[1.2fr_0.7fr_0.9fr_auto]"
          >
            <input
              className={wwField}
              placeholder="Label"
              value={row.label}
              onChange={(e) => {
                const next = [...rows]
                next[idx] = { ...row, label: e.target.value }
                onChange(next)
              }}
            />
            <input
              className={wwField}
              type="number"
              min={1}
              max={100}
              step={1}
              placeholder="% of price"
              value={row.percentPct}
              onChange={(e) => {
                const next = [...rows]
                next[idx] = { ...row, percentPct: e.target.value }
                onChange(next)
              }}
            />
            <input
              className={wwField}
              type="number"
              min={0}
              placeholder="Days before start"
              value={row.daysBeforeStart}
              onChange={(e) => {
                const next = [...rows]
                next[idx] = { ...row, daysBeforeStart: e.target.value }
                onChange(next)
              }}
            />
            <button
              type="button"
              disabled={rows.length <= 1}
              onClick={() => onChange(rows.filter((_, i) => i !== idx))}
              className={wwBtnGhost}
            >
              Remove
            </button>
            {amt != null ? (
              <p className="sm:col-span-4 text-[12px] text-white/40">
                ≈ ₹{amt.toLocaleString('en-IN')}
                {row.daysBeforeStart === '' ? ' · due at booking' : ` · due ${row.daysBeforeStart}d before start`}
              </p>
            ) : null}
          </div>
        )
      })}
      <button
        type="button"
        disabled={rows.length >= 8}
        onClick={() =>
          onChange([
            ...rows,
            { label: `Installment ${rows.length + 1}`, percentPct: '', daysBeforeStart: '7' },
          ])
        }
        className="w-full rounded-[1.15rem] border border-dashed border-white/15 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45 transition-transform duration-100 active:scale-[0.98] disabled:opacity-40"
      >
        Add installment
      </button>
    </div>
  )
}

const WwPortal: React.FC = () => {
  const { user, isLoading } = useSupabase()
  const userId = user?.id || ''
  const [membership, setMembership] = useState<WwMembership | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [trips, setTrips] = useState<WwTrip[]>([])
  const [analytics, setAnalytics] = useState<WwAnalytics | null>(null)
  const [regs, setRegs] = useState<
    { registration: any; trip: WwTrip | null; installments?: WwInstallment[] }[]
  >([])
  const [members, setMembers] = useState<WwMember[]>([])
  const [promoter, setPromoter] = useState<any>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [refBusy, setRefBusy] = useState(false)
  const [adminQuery, setAdminQuery] = useState('')
  const [expandedRegId, setExpandedRegId] = useState<string | null>(null)
  const [editingRegId, setEditingRegId] = useState<string | null>(null)
  const [editingShareId, setEditingShareId] = useState<string | null>(null)
  const [editRegForm, setEditRegForm] = useState({
    buyerName: '',
    buyerEmail: '',
    buyerPhone: '',
    city: '',
    notes: '',
  })
  const [editShareForm, setEditShareForm] = useState({
    claimedByName: '',
    claimedByEmail: '',
  })
  const [regStatusFilter, setRegStatusFilter] = useState<
    'all' | 'pending' | 'partial' | 'paid' | 'cancelled'
  >('all')
  const [memberRefDrafts, setMemberRefDrafts] = useState<Record<string, string>>({})

  const [tripForm, setTripForm] = useState({
    title: '',
    description: '',
    itinerary: '',
    priceInr: '25000',
    seats: '20',
    startDate: '',
    endDate: '',
    paymentPlansEnabled: false,
    coverImageUrl: '',
  })
  const [coverUploading, setCoverUploading] = useState(false)
  const [tripCoverBusyId, setTripCoverBusyId] = useState<string | null>(null)
  const [planDraft, setPlanDraft] = useState<PlanDraftRow[]>(() => DEFAULT_PLAN_DRAFT.map((r) => ({ ...r })))
  const [editingPlanTripId, setEditingPlanTripId] = useState<string | null>(null)
  const [editPlanDraft, setEditPlanDraft] = useState<PlanDraftRow[]>([])
  const [editingDetailsTripId, setEditingDetailsTripId] = useState<string | null>(null)
  const [editTripForm, setEditTripForm] = useState({
    title: '',
    description: '',
    itinerary: '',
    priceInr: '',
    seats: '',
    startDate: '',
    endDate: '',
    coverImageUrl: '',
  })
  const [editingGroupTripId, setEditingGroupTripId] = useState<string | null>(null)
  const [groupDraft, setGroupDraft] = useState({
    groupBookingEnabled: false,
    groupSeats: '10',
    groupDiscountType: 'percent' as 'percent' | 'flat_per_seat',
    groupDiscountValue: '10',
    groupMinSize: '2',
    groupMaxSize: '10',
  })
  const [groupTrips, setGroupTrips] = useState<
    (WwTrip & {
      seatsLeft: number
      groupSeatsLeft: number
      pricingSample?: { listPriceInr: number; discountInr: number; amountDueInr: number }
    })[]
  >([])
  const [groupForm, setGroupForm] = useState({
    tripId: '',
    groupSize: '4',
    buyerName: '',
    buyerEmail: '',
    buyerPhone: '',
    city: '',
    paymentMode: 'full' as 'full' | 'plan',
    notes: '',
  })
  const [lastGroupJoinUrl, setLastGroupJoinUrl] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('promoter')
  const [inviteInfo, setInviteInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [profileForm, setProfileForm] = useState({
    displayName: '',
    phone: '',
    city: '',
    bio: '',
    instagram: '',
  })
  const [memberTripDrafts, setMemberTripDrafts] = useState<Record<string, string[]>>({})

  const isAdmin = membership?.member.role === 'owner' || membership?.member.role === 'admin'
  const { springFast, reduce } = useWwMotion()

  const loadMe = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    const me = await wwApi.me(userId)
    if (me.error || !me.data?.current) {
      setMembership(null)
      setError(me.error || 'No WanderWorld invitation for this account')
      setLoading(false)
      return
    }
    setMembership(me.data.current)
    const role = me.data.current.member.role
    if (role === 'promoter') setTab('promoter')
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (isLoading) return
    if (!userId) {
      setLoading(false)
      return
    }
    void loadMe()
  }, [isLoading, userId, loadMe])

  const refreshAdmin = useCallback(async () => {
    if (!userId || !isAdmin) return
    const [t, a, r, m] = await Promise.all([
      wwApi.adminTrips(userId),
      wwApi.analytics(userId),
      wwApi.registrations(userId),
      wwApi.members(userId),
    ])
    if (t.data) setTrips(t.data.trips)
    if (a.data) setAnalytics(a.data)
    if (r.data) setRegs(r.data.registrations)
    if (m.data) {
      setMembers(m.data.members)
      const drafts: Record<string, string[]> = {}
      for (const mem of m.data.members) {
        drafts[mem.id] = [...(mem.assignedTripIds || [])]
      }
      setMemberTripDrafts(drafts)
    }
  }, [userId, isAdmin])

  const refreshPromoter = useCallback(async () => {
    if (!userId) return
    const [p, gt] = await Promise.all([wwApi.promoterDashboard(userId), wwApi.groupTrips(userId)])
    if (p.data) {
      setPromoter(p.data)
      const prof = (p.data as any).profile
      if (prof) {
        setProfileForm({
          displayName: prof.displayName || '',
          phone: prof.phone || '',
          city: prof.city || '',
          bio: prof.bio || '',
          instagram: prof.instagram || '',
        })
      }
    }
    if (gt.data?.trips) {
      setGroupTrips(gt.data.trips)
      setGroupForm((f) =>
        f.tripId || !gt.data!.trips[0] ? f : { ...f, tripId: gt.data!.trips[0].id },
      )
    }
  }, [userId])

  const saveMyProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    setBusy(true)
    setError(null)
    const res = await wwApi.updatePromoterProfile(userId, profileForm)
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setInviteInfo('Profile saved')
    await refreshPromoter()
    if (isAdmin) await refreshAdmin()
  }

  const saveMemberTrips = async (memberId: string) => {
    if (!userId) return
    setBusy(true)
    setError(null)
    const res = await wwApi.assignMemberTrips(userId, memberId, memberTripDrafts[memberId] || [])
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setInviteInfo('Trip assignments saved')
    await refreshAdmin()
    await refreshPromoter()
  }

  const saveMemberReferralId = async (
    memberId: string,
    opts?: { linkId?: string; tripId?: string | null },
  ) => {
    if (!userId) return
    const key =
      opts?.tripId != null && opts.tripId !== ''
        ? `${memberId}:${opts.tripId}`
        : opts?.linkId || memberId
    const code = memberRefDrafts[key] ?? memberRefDrafts[memberId]
    if (!code?.trim()) return
    setRefBusy(true)
    setError(null)
    const res = await wwApi.updatePromoterCode(userId, {
      code,
      memberId,
      ...(opts?.linkId ? { linkId: opts.linkId } : {}),
      ...(opts?.tripId !== undefined ? { tripId: opts.tripId } : {}),
    })
    setRefBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setInviteInfo(`Set referral ID ${res.data?.link.code} for member`)
    await refreshAdmin()
    await refreshPromoter()
  }

  const collectCash = async (installmentId: string, label: string) => {
    if (!userId) return
    if (!window.confirm(`Mark "${label}" as cash collected?`)) return
    setBusy(true)
    setError(null)
    const res = isAdmin
      ? await wwApi.adminCollectCash(userId, installmentId)
      : await wwApi.collectCash(userId, { installmentId })
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setInviteInfo(`Cash recorded for ${label}`)
    await refreshPromoter()
    if (isAdmin) await refreshAdmin()
  }

  const cancelReg = async (registration: {
    id: string
    buyerName: string
    amountPaidInr: number
    status: string
  }) => {
    if (!userId || registration.status === 'cancelled') return
    const paidNote =
      registration.amountPaidInr > 0
        ? ` Paid ₹${Math.round(registration.amountPaidInr).toLocaleString('en-IN')} stays on record. refund offline if needed.`
        : ''
    if (
      !window.confirm(
        `Cancel booking for ${registration.buyerName}? Unpaid installments close and the seat opens again.${paidNote}`,
      )
    ) {
      return
    }
    setBusy(true)
    setError(null)
    const res = isAdmin
      ? await wwApi.cancelRegistration(userId, registration.id)
      : await wwApi.cancelMyRegistration(userId, registration.id)
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setInviteInfo(`Cancelled booking for ${registration.buyerName}`)
    setEditingRegId(null)
    setEditingShareId(null)
    if (isAdmin) await refreshAdmin()
    await refreshPromoter()
  }

  const deleteReg = async (registration: {
    id: string
    buyerName: string
    amountPaidInr: number
    status: string
  }) => {
    if (!userId || registration.status === 'cancelled') return
    if (registration.amountPaidInr > 0) {
      setError('This booking has payments. use Cancel instead of Delete')
      return
    }
    if (
      !window.confirm(
        `Delete booking for ${registration.buyerName}? This permanently removes the unpaid group/booking and frees seats.`,
      )
    ) {
      return
    }
    setBusy(true)
    setError(null)
    const res = await wwApi.deleteMyRegistration(userId, registration.id)
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setInviteInfo(`Deleted booking for ${registration.buyerName}`)
    setExpandedRegId(null)
    setEditingRegId(null)
    setEditingShareId(null)
    if (isAdmin) await refreshAdmin()
    await refreshPromoter()
  }

  const startEditReg = (registration: {
    id: string
    buyerName: string
    buyerEmail: string
    buyerPhone?: string | null
    city?: string | null
    notes?: string | null
  }) => {
    setEditingShareId(null)
    setEditingRegId(registration.id)
    setExpandedRegId(registration.id)
    setEditRegForm({
      buyerName: registration.buyerName || '',
      buyerEmail: registration.buyerEmail || '',
      buyerPhone: registration.buyerPhone || '',
      city: registration.city || '',
      notes: registration.notes || '',
    })
  }

  const saveEditReg = async (registrationId: string) => {
    if (!userId) return
    setBusy(true)
    setError(null)
    const res = await wwApi.updateMyRegistration(userId, registrationId, {
      buyerName: editRegForm.buyerName,
      buyerEmail: editRegForm.buyerEmail,
      buyerPhone: editRegForm.buyerPhone || null,
      city: editRegForm.city || null,
      notes: editRegForm.notes || null,
    })
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setInviteInfo('Lead details updated')
    setEditingRegId(null)
    await refreshPromoter()
    if (isAdmin) await refreshAdmin()
  }

  const startEditShare = (inst: WwInstallment) => {
    setEditingRegId(null)
    setEditingShareId(inst.id)
    setEditShareForm({
      claimedByName: inst.claimedByName || '',
      claimedByEmail: inst.claimedByEmail || '',
    })
  }

  const saveEditShare = async (installmentId: string) => {
    if (!userId) return
    setBusy(true)
    setError(null)
    const res = await wwApi.updateGroupShare(userId, installmentId, {
      claimedByName: editShareForm.claimedByName || null,
      claimedByEmail: editShareForm.claimedByEmail || null,
    })
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setInviteInfo('Traveler updated')
    setEditingShareId(null)
    await refreshPromoter()
    if (isAdmin) await refreshAdmin()
  }

  const releaseShare = async (installmentId: string, label: string) => {
    if (!userId) return
    if (!window.confirm(`Release unpaid share "${label}" so someone else can claim it?`)) return
    setBusy(true)
    setError(null)
    const res = await wwApi.releaseGroupShare(userId, installmentId)
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setInviteInfo(`Released share ${label}`)
    await refreshPromoter()
    if (isAdmin) await refreshAdmin()
  }

  useEffect(() => {
    if (!membership) return
    if (isAdmin) void refreshAdmin()
    void refreshPromoter()
  }, [membership, isAdmin, refreshAdmin, refreshPromoter])

  const tabs = useMemo(() => {
    if (isAdmin) {
      return [
        { id: 'overview' as Tab, label: 'Overview' },
        { id: 'trips' as Tab, label: 'Trips' },
        { id: 'registrations' as Tab, label: 'Registrations' },
        { id: 'members' as Tab, label: 'Members' },
        { id: 'promoter' as Tab, label: 'My link' },
      ]
    }
    return [{ id: 'promoter' as Tab, label: 'Dashboard' }]
  }, [isAdmin])

  const searchPlaceholder =
    tab === 'trips'
      ? 'Search trips by title or status…'
      : tab === 'registrations'
        ? 'Search buyers, email, trip, or referral…'
        : tab === 'members'
          ? 'Search members by name, email, or ref…'
          : tab === 'promoter'
            ? 'Search links, bookings, or installments…'
            : 'Search overview tables…'

  const filteredTrips = useMemo(
    () =>
      trips.filter((t) =>
        matchesAdminQuery(adminQuery, t.title, t.slug, t.status, t.description),
      ),
    [trips, adminQuery],
  )

  const filteredRegs = useMemo(() => {
    return regs.filter(({ registration, trip }) => {
      if (regStatusFilter !== 'all' && registration.status !== regStatusFilter) return false
      return matchesAdminQuery(
        adminQuery,
        registration.buyerName,
        registration.buyerEmail,
        registration.buyerPhone,
        registration.promoterCode,
        registration.joinCode,
        registration.status,
        trip?.title,
        trip?.slug,
      )
    })
  }, [regs, adminQuery, regStatusFilter])

  const filteredMembers = useMemo(
    () =>
      members.filter((m) => {
        const promo = (analytics?.promoters || []).find((p) => p.memberId === m.id)
        return matchesAdminQuery(
          adminQuery,
          m.email,
          m.displayName,
          m.role,
          promo?.code,
          m.phone,
          m.city,
        )
      }),
    [members, analytics?.promoters, adminQuery],
  )

  if (isLoading) {
    return (
      <div className={`${wwPage} flex items-center justify-center`}>
        <div className={wwAmbient} aria-hidden />
        <Loader2 className="relative h-8 w-8 animate-spin text-clay" />
      </div>
    )
  }

  if (!user) return <Navigate to={wwLoginPath()} replace />

  if (loading) {
    return (
      <div className={`${wwPage} flex items-center justify-center`}>
        <div className={wwAmbient} aria-hidden />
        <Loader2 className="relative h-8 w-8 animate-spin text-clay" />
      </div>
    )
  }

  if (!membership) {
    return (
      <div className={`${wwPage} flex flex-col items-center justify-center px-5 text-center`}>
        <div className={wwAmbient} aria-hidden />
        <div className="relative z-[1] max-w-md">
          <WwLogo size="inline" className="mx-auto mb-8" />
          <h1 className={wwTitle}>Invite required</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-white/50">
            {error ||
              'This account is not on the WanderWorld team yet. Ask a Club admin (admin.yureka.one → Club → WanderWorld) to invite this email, or sign in first when the team is empty to become owner.'}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={() => void loadMe()} className={wwBtnPrimary}>
              Retry
            </button>
            <button
              type="button"
              onClick={() => signOutGmail().then(() => (window.location.href = wwLoginPath()))}
              className={wwBtnSecondary}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    )
  }

  const createTrip = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    let planTemplate: WwPlanInstallmentTemplate[] | undefined
    if (tripForm.paymentPlansEnabled) {
      const parsed = draftToPlanTemplate(planDraft)
      if ('error' in parsed) {
        setBusy(false)
        setError(parsed.error)
        return
      }
      planTemplate = parsed
    }
    const res = await wwApi.createTrip(userId, {
      title: tripForm.title,
      description: tripForm.description,
      itinerary: tripForm.itinerary,
      priceInr: Number(tripForm.priceInr) || 0,
      seats: Number(tripForm.seats) || 1,
      startDate: tripForm.startDate,
      endDate: tripForm.endDate,
      paymentPlansEnabled: tripForm.paymentPlansEnabled,
      coverImageUrl: tripForm.coverImageUrl.trim() || null,
      ...(planTemplate ? { planTemplate } : {}),
    })
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setTripForm((f) => ({
      ...f,
      title: '',
      description: '',
      itinerary: '',
      coverImageUrl: '',
    }))
    setPlanDraft(DEFAULT_PLAN_DRAFT.map((r) => ({ ...r })))
    await refreshAdmin()
  }

  const uploadCoverFile = async (file: File | undefined) => {
    if (!file || !userId) return
    setCoverUploading(true)
    setError(null)
    const res = await wwApi.uploadCover(userId, file)
    setCoverUploading(false)
    if (res.error || !res.data?.url) {
      setError(res.error || 'Cover upload failed')
      return
    }
    setTripForm((f) => ({ ...f, coverImageUrl: res.data!.url }))
  }

  const replaceTripCover = async (tripId: string, file: File | undefined) => {
    if (!file || !userId) return
    setTripCoverBusyId(tripId)
    setError(null)
    const up = await wwApi.uploadCover(userId, file)
    if (up.error || !up.data?.url) {
      setTripCoverBusyId(null)
      setError(up.error || 'Cover upload failed')
      return
    }
    const res = await wwApi.updateTrip(userId, tripId, { coverImageUrl: up.data.url })
    setTripCoverBusyId(null)
    if (res.error) {
      setError(res.error)
      return
    }
    await refreshAdmin()
  }

  const setStatus = async (id: string, status: string) => {
    setBusy(true)
    await wwApi.updateTrip(userId, id, { status })
    setBusy(false)
    await refreshAdmin()
  }

  const removeTrip = async (trip: WwTrip) => {
    const booked = trip.seatsTaken > 0
    const msg = booked
      ? `Delete “${trip.title}”? This permanently removes the trip and its ${trip.seatsTaken} booking(s), payments, and trip referral links.`
      : `Delete “${trip.title}”? This cannot be undone.`
    if (!window.confirm(msg)) return
    setBusy(true)
    setError(null)
    const res = await wwApi.deleteTrip(userId, trip.id)
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
                if (editingPlanTripId === trip.id) setEditingPlanTripId(null)
    if (editingDetailsTripId === trip.id) setEditingDetailsTripId(null)
    if (editingGroupTripId === trip.id) setEditingGroupTripId(null)
    await refreshAdmin()
  }

  const togglePlans = async (trip: WwTrip) => {
    setBusy(true)
    await wwApi.updateTrip(userId, trip.id, { paymentPlansEnabled: !trip.paymentPlansEnabled })
    setBusy(false)
    await refreshAdmin()
  }

  const openPlanEditor = (trip: WwTrip) => {
    setEditingDetailsTripId(null)
    setEditingGroupTripId(null)
    setEditingPlanTripId(trip.id)
    setEditPlanDraft(tripPlanToDraft(trip.planTemplate))
    setError(null)
  }

  const openGroupEditor = (trip: WwTrip) => {
    setEditingDetailsTripId(null)
    setEditingPlanTripId(null)
    setEditingGroupTripId(trip.id)
    setGroupDraft({
      groupBookingEnabled: Boolean(trip.groupBookingEnabled),
      groupSeats: String(trip.groupSeats || 10),
      groupDiscountType: trip.groupDiscountType === 'flat_per_seat' ? 'flat_per_seat' : 'percent',
      groupDiscountValue: String(trip.groupDiscountValue || 0),
      groupMinSize: String(trip.groupMinSize || 2),
      groupMaxSize: String(trip.groupMaxSize || 10),
    })
    setError(null)
  }

  const openTripDetailsEditor = (trip: WwTrip) => {
    setEditingPlanTripId(null)
    setEditingGroupTripId(null)
    setEditingDetailsTripId(trip.id)
    setEditTripForm({
      title: trip.title || '',
      description: trip.description || '',
      itinerary: trip.itinerary || '',
      priceInr: String(trip.priceInr ?? ''),
      seats: String(trip.seats ?? ''),
      startDate: (trip.startDate || '').slice(0, 10),
      endDate: (trip.endDate || '').slice(0, 10),
      coverImageUrl: trip.coverImageUrl || '',
    })
    setError(null)
  }

  const saveTripDetails = async (tripId: string) => {
    if (!userId) return
    const title = editTripForm.title.trim()
    if (!title) {
      setError('Trip title is required')
      return
    }
    setBusy(true)
    setError(null)
    const res = await wwApi.updateTrip(userId, tripId, {
      title,
      description: editTripForm.description,
      itinerary: editTripForm.itinerary,
      priceInr: Number(editTripForm.priceInr) || 0,
      seats: Math.max(1, Math.floor(Number(editTripForm.seats) || 1)),
      startDate: editTripForm.startDate,
      endDate: editTripForm.endDate,
      coverImageUrl: editTripForm.coverImageUrl.trim() || null,
    })
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setInviteInfo(`Updated ${res.data?.trip.title || 'trip'}`)
    setEditingDetailsTripId(null)
    await refreshAdmin()
  }

  const saveGroupSettings = async (tripId: string) => {
    setBusy(true)
    setError(null)
    const res = await wwApi.updateTrip(userId, tripId, {
      groupBookingEnabled: groupDraft.groupBookingEnabled,
      groupSeats: Number(groupDraft.groupSeats) || 0,
      groupDiscountType: groupDraft.groupDiscountType,
      groupDiscountValue: Number(groupDraft.groupDiscountValue) || 0,
      groupMinSize: Number(groupDraft.groupMinSize) || 2,
      groupMaxSize: Number(groupDraft.groupMaxSize) || 10,
    })
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setEditingGroupTripId(null)
    setInviteInfo('Group booking settings saved')
    await refreshAdmin()
    await refreshPromoter()
  }

  const submitGroupBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !groupForm.tripId) return
    setBusy(true)
    setError(null)
    const res = await wwApi.createGroupBooking(userId, {
      tripId: groupForm.tripId,
      groupSize: Number(groupForm.groupSize) || 0,
      buyerName: groupForm.buyerName.trim(),
      buyerEmail: groupForm.buyerEmail.trim(),
      buyerPhone: groupForm.buyerPhone.trim() || undefined,
      city: groupForm.city.trim() || undefined,
      notes: groupForm.notes.trim() || undefined,
      paymentMode: groupForm.paymentMode,
    })
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    const disc = Math.round(res.data?.pricing.discountInr || 0)
    const perSeat = Math.round(res.data?.pricing.perSeatInr || 0)
    const joinUrl = res.data?.joinUrl || null
    setLastGroupJoinUrl(joinUrl)
    setInviteInfo(
      `Group booking created for ${res.data?.registration.buyerName} · ${res.data?.registration.groupSize} seats · ₹${perSeat.toLocaleString('en-IN')}/person · total ₹${Math.round(res.data?.pricing.amountDueInr || 0).toLocaleString('en-IN')}${disc ? ` (saved ₹${disc.toLocaleString('en-IN')})` : ''}. Share the join link so each person can pay their share.`,
    )
    if (joinUrl) void copy(joinUrl)
    setGroupForm((f) => ({
      ...f,
      buyerName: '',
      buyerEmail: '',
      buyerPhone: '',
      city: '',
      notes: '',
    }))
    await refreshPromoter()
    if (isAdmin) await refreshAdmin()
  }

  const savePlanTemplate = async (tripId: string) => {
    const parsed = draftToPlanTemplate(editPlanDraft)
    if ('error' in parsed) {
      setError(parsed.error)
      return
    }
    setBusy(true)
    setError(null)
    const res = await wwApi.updateTrip(userId, tripId, {
      planTemplate: parsed,
      paymentPlansEnabled: true,
    })
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setEditingPlanTripId(null)
    await refreshAdmin()
  }

  const invite = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInviteInfo(null)
    const res = await wwApi.inviteMember(userId, { email: inviteEmail, role: inviteRole })
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setInviteEmail('')
    setInviteInfo(
      res.data?.emailed
        ? `Invited ${res.data.member.email} as ${res.data.member.role}. Email sent.`
        : `Invited ${res.data?.member.email} as ${res.data?.member.role}. (Email may not have sent. they can still sign in at /ww/login with this email.)`,
    )
    setTab('members')
    await refreshAdmin()
  }

  const removeMember = async (id: string, email: string) => {
    if (!window.confirm(`Remove ${email} from the team?`)) return
    setBusy(true)
    setError(null)
    const res = await wwApi.deleteMember(userId, id)
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setInviteInfo(`Removed ${email}`)
    await refreshAdmin()
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(text)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className={wwPage}>
      <div className={wwAmbient} aria-hidden />
      <header className={`relative z-[1] ${wwGlassHeader}`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <WwLogo size="header" className="shrink-0" />
            <div className="min-w-0">
              <p className={wwLabel}>Ops</p>
              <h1 className="truncate text-[17px] font-semibold tracking-[-0.02em] text-white md:text-[19px]">
                {membership.org.name}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setTab('members')
                  setInviteInfo(null)
                }}
                className={wwBtnPrimary}
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Invite</span>
              </button>
            )}
            <span className={`hidden sm:inline ${wwLabel}`}>{membership.member.role}</span>
            <button
              type="button"
              onClick={() => signOutGmail().then(() => (window.location.href = wwLoginPath()))}
              className={wwBtnSecondary}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
        <LayoutGroup>
          <nav className="mx-auto mt-3 flex max-w-6xl gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map((t) => {
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`${wwChip} ${active ? 'text-black' : 'text-white/50 hover:text-white/80'}`}
                >
                  {active && (
                    <motion.span
                      layoutId="ww-tab-pill"
                      className="absolute inset-0 rounded-full bg-clay"
                      transition={springFast}
                    />
                  )}
                  <span className="relative z-[1]">{t.label}</span>
                </button>
              )
            })}
          </nav>
        </LayoutGroup>
      </header>

      <div className="relative z-[1] border-b border-white/[0.06] bg-[#080808]/80 px-4 py-3 supports-[backdrop-filter]:backdrop-blur-[16px] supports-[backdrop-filter]:backdrop-saturate-[160%] md:px-8">
        <div className="relative mx-auto max-w-6xl">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
            aria-hidden
          />
          <input
            type="search"
            value={adminQuery}
            onChange={(e) => setAdminQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className={wwSearchField}
            autoComplete="off"
            spellCheck={false}
          />
          {adminQuery ? (
            <button
              type="button"
              onClick={() => setAdminQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/45 transition-transform duration-100 ease-out active:scale-[0.97] hover:text-white/70"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <main className="relative z-[1] mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
        {error && (
          <p className="mb-5 rounded-[1.25rem] border border-red-500/25 bg-red-500/10 px-4 py-3.5 text-[13px] text-red-100">
            {error}
          </p>
        )}
        {inviteInfo && (
          <p className="mb-5 rounded-[1.25rem] border border-emerald-500/20 bg-emerald-500/10 px-4 py-3.5 text-[13px] text-emerald-100">
            {inviteInfo}
          </p>
        )}

        <AnimatePresence mode="wait">
          {tab === 'overview' && analytics && (
            <WwTabPanel key="overview" className="space-y-6">
            <WwPageHeading
              title="Overview"
              subtitle="Trip performance, buyers, and promoter revenue across WanderWorld."
            />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <WwStat label="Published" value={analytics.publishedTrips} />
              <WwStat label="Registrations" value={analytics.registrations} />
              <WwStat label="Paid" value={analytics.paidRegistrations} tone="ok" />
              <WwStat
                label="Revenue"
                value={`₹${Math.round(analytics.revenueInr).toLocaleString('en-IN')}`}
              />
            </div>
            <div className={wwSurfacePad}>
              <p className={wwLabel}>Plan vs full pay</p>
              <p className="mt-2 text-[15px] text-white/70">
                Full: {analytics.planVsFull.full} · Plans: {analytics.planVsFull.plan}
              </p>
            </div>
            <WwPanel title="Trips">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left">
                <thead className="bg-white/[0.03]">
                  <tr>
                    <th className={wwTh}>Trip</th>
                    <th className={wwTh}>Regs</th>
                    <th className={wwTh}>Paid</th>
                    <th className={wwTh}>Revenue</th>
                    <th className={wwTh}>Seats left</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.byTrip
                    .filter((row) => matchesAdminQuery(adminQuery, row.title))
                    .map((row) => (
                    <tr key={row.tripId} className="border-t border-white/[0.05]">
                      <td className={`${wwTd} font-medium text-white`}>{row.title}</td>
                      <td className={wwTd}>{row.registrations}</td>
                      <td className={wwTd}>{row.paid}</td>
                      <td className={wwTd}>₹{Math.round(row.revenueInr).toLocaleString('en-IN')}</td>
                      <td className={wwTd}>{row.seatsLeft}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </WwPanel>

            <WwPanel title="Buyers">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead className="bg-white/[0.03]">
                  <tr>
                    <th className={wwTh}>Buyer</th>
                    <th className={wwTh}>Regs</th>
                    <th className={wwTh}>Paid</th>
                    <th className={wwTh}>Revenue</th>
                    <th className={wwTh}>Refs</th>
                  </tr>
                </thead>
                <tbody>
                  {(analytics.byBuyer || [])
                    .filter((row) =>
                      matchesAdminQuery(
                        adminQuery,
                        row.buyerName,
                        row.buyerEmail,
                        ...(row.promoterCodes || []),
                      ),
                    )
                    .map((row) => (
                    <tr key={row.userId || row.buyerEmail} className="border-t border-white/[0.05]">
                      <td className={wwTd}>
                        <div className="font-medium text-white">{row.buyerName}</div>
                        <div className="text-[12px] text-white/40">{row.buyerEmail}</div>
                      </td>
                      <td className={wwTd}>{row.registrations}</td>
                      <td className={wwTd}>{row.paid}</td>
                      <td className={wwTd}>₹{Math.round(row.revenueInr).toLocaleString('en-IN')}</td>
                      <td className={`${wwTd} font-mono text-[12px] text-white/50`}>
                        {row.promoterCodes?.length ? row.promoterCodes.join(', ') : '·'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!(analytics.byBuyer || []).length && (
                <p className="p-5 text-[14px] text-white/40">No buyers yet.</p>
              )}
              </div>
            </WwPanel>

            <WwPanel title="Promoter revenue">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead className="bg-white/[0.03]">
                  <tr>
                    <th className={wwTh}>Promoter</th>
                    <th className={wwTh}>Code</th>
                    <th className={wwTh}>Clicks</th>
                    <th className={wwTh}>Regs</th>
                    <th className={wwTh}>Online</th>
                    <th className={wwTh}>Cash</th>
                    <th className={wwTh}>Total</th>
                    <th className={wwTh}>Due</th>
                    <th className={wwTh}>Trips</th>
                  </tr>
                </thead>
                <tbody>
                  {(analytics.promoters || [])
                    .filter((row) =>
                      matchesAdminQuery(adminQuery, row.displayName, row.email, row.code),
                    )
                    .map((row) => (
                    <tr key={row.memberId} className="border-t border-white/[0.05]">
                      <td className={wwTd}>
                        <div className="font-medium text-white">
                          {row.displayName || row.email}
                        </div>
                        {row.displayName ? (
                          <div className="text-[12px] text-white/40">{row.email}</div>
                        ) : null}
                      </td>
                      <td className={`${wwTd} font-mono text-[12px]`}>{row.code || '·'}</td>
                      <td className={wwTd}>{row.clicks ?? 0}</td>
                      <td className={wwTd}>{row.registrations}</td>
                      <td className={wwTd}>
                        ₹{Math.round(row.onlineCollectedInr || 0).toLocaleString('en-IN')}
                      </td>
                      <td className={wwTd}>
                        ₹{Math.round(row.cashCollectedInr || 0).toLocaleString('en-IN')}
                      </td>
                      <td className={`${wwTd} font-medium text-white`}>
                        ₹{Math.round(row.revenueInr).toLocaleString('en-IN')}
                      </td>
                      <td className={wwTd}>
                        ₹{Math.round(row.outstandingInr || 0).toLocaleString('en-IN')}
                      </td>
                      <td className={`${wwTd} text-[12px] text-white/45`}>
                        {row.assignedTripIds?.length
                          ? row.assignedTripIds
                              .map(
                                (id) =>
                                  analytics.byTrip.find((t) => t.tripId === id)?.title ||
                                  id.slice(0, 6),
                              )
                              .join(', ')
                          : 'All trips'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!(analytics.promoters || []).length && (
                <p className="p-5 text-[14px] text-white/40">No promoters yet.</p>
              )}
              </div>
            </WwPanel>
            </WwTabPanel>
          )}
        </AnimatePresence>
        {tab === 'trips' && (
          <div className="space-y-5">
            <WwPageHeading
              title="Trips"
              subtitle="Create drafts, publish to Join your getaway, and configure group seats."
            />
          <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
            <form onSubmit={createTrip} className={`${wwSurfacePad} space-y-5`}>
              <div>
                <h2 className="text-[17px] font-semibold tracking-[-0.02em]">New trip</h2>
                <p className="mt-1 text-[13px] text-white/40">
                  Starts as a draft. publish when the listing is ready.
                </p>
              </div>

              <WwFieldGroup title="Basics" hint="Name and story buyers see on Getaway.">
                <div className="space-y-3">
                  <input
                    className={wwField}
                    placeholder="Title"
                    value={tripForm.title}
                    onChange={(e) => setTripForm({ ...tripForm, title: e.target.value })}
                    required
                  />
                  <textarea
                    className={wwField}
                    placeholder="Description"
                    rows={3}
                    value={tripForm.description}
                    onChange={(e) => setTripForm({ ...tripForm, description: e.target.value })}
                  />
                  <textarea
                    className={wwField}
                    placeholder="Itinerary"
                    rows={3}
                    value={tripForm.itinerary}
                    onChange={(e) => setTripForm({ ...tripForm, itinerary: e.target.value })}
                  />
                </div>
              </WwFieldGroup>

              <WwFieldGroup title="Pricing & schedule" hint="List price is per seat before group discounts.">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    className={wwField}
                    type="number"
                    placeholder="Price INR"
                    value={tripForm.priceInr}
                    onChange={(e) => setTripForm({ ...tripForm, priceInr: e.target.value })}
                  />
                  <input
                    className={wwField}
                    type="number"
                    placeholder="Seats"
                    value={tripForm.seats}
                    onChange={(e) => setTripForm({ ...tripForm, seats: e.target.value })}
                  />
                  <input
                    className={wwField}
                    type="date"
                    value={tripForm.startDate}
                    onChange={(e) => setTripForm({ ...tripForm, startDate: e.target.value })}
                    required
                  />
                  <input
                    className={wwField}
                    type="date"
                    value={tripForm.endDate}
                    onChange={(e) => setTripForm({ ...tripForm, endDate: e.target.value })}
                    required
                  />
                </div>
              </WwFieldGroup>

              <WwFieldGroup title="Payment plans" hint="Optional deposits for solo bookings.">
                <label className="flex items-center gap-2.5 text-[14px] text-white/70">
                  <input
                    type="checkbox"
                    checked={tripForm.paymentPlansEnabled}
                    onChange={(e) => setTripForm({ ...tripForm, paymentPlansEnabled: e.target.checked })}
                    className="h-4 w-4 rounded border-white/20"
                  />
                  Enable payment plans
                </label>
                {tripForm.paymentPlansEnabled ? (
                  <PlanStepsEditor
                    rows={planDraft}
                    onChange={setPlanDraft}
                    priceInr={Number(tripForm.priceInr) || 0}
                  />
                ) : null}
              </WwFieldGroup>

              <WwFieldGroup title="Cover image" hint="Shown on the Getaway trip card.">
                <div className="space-y-2 rounded-[1.15rem] border border-white/[0.08] bg-black/30 p-3">
                <div className="flex flex-wrap gap-2">
                  <label
                    className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl bg-white/10 px-4 text-[10px] font-black uppercase tracking-[0.15em] text-white transition active:scale-[0.97] ${
                      coverUploading ? 'pointer-events-none opacity-50' : ''
                    }`}
                  >
                    {coverUploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    {coverUploading ? 'Uploading…' : 'Upload'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                      className="hidden"
                      disabled={coverUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        e.target.value = ''
                        void uploadCoverFile(file)
                      }}
                    />
                  </label>
                  {tripForm.coverImageUrl ? (
                    <button
                      type="button"
                      onClick={() => setTripForm({ ...tripForm, coverImageUrl: '' })}
                      className="rounded-2xl bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-white/60"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
                <input
                  className={wwField}
                  placeholder="or paste image URL"
                  value={tripForm.coverImageUrl}
                  onChange={(e) => setTripForm({ ...tripForm, coverImageUrl: e.target.value })}
                />
                {tripForm.coverImageUrl ? (
                  <img
                    src={tripForm.coverImageUrl}
                    alt=""
                    className="mt-1 h-28 w-full rounded-2xl object-cover border border-white/10"
                  />
                ) : null}
                </div>
              </WwFieldGroup>

              <button
                type="submit"
                disabled={busy}
                className={`${wwBtnPrimary} w-full`}
              >
                Create draft
              </button>
            </form>
            <div className="space-y-3">
              <div>
                <h2 className="text-[17px] font-semibold tracking-[-0.02em]">Your trips</h2>
                <p className="mt-1 text-[13px] text-white/40">
                  Edit details, publish, plans, or group booking.
                </p>
              </div>
              {filteredTrips.map((trip) => (
                <div key={trip.id} className={`${wwSurface} overflow-hidden p-4 md:p-5`}>
                  <div className="flex gap-3.5">
                    <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-[1.15rem] border border-white/[0.08] bg-black/40">
                      {trip.coverImageUrl ? (
                        <img src={trip.coverImageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-white/25">
                          <ImagePlus className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em] ${
                            trip.status === 'published'
                              ? 'bg-emerald-400/15 text-emerald-300'
                              : trip.status === 'closed'
                                ? 'bg-white/10 text-white/45'
                                : 'bg-amber-400/15 text-amber-200'
                          }`}
                        >
                          {trip.status}
                        </span>
                        <span className="truncate font-mono text-[10px] tracking-[0.08em] text-white/35">
                          /{trip.slug}
                        </span>
                      </div>
                      <h3 className="mt-1.5 truncate text-[17px] font-semibold tracking-[-0.02em] text-white">
                        {trip.title}
                      </h3>
                      <p className="mt-1.5 text-[13px] leading-snug text-white/55">
                        <span className="tabular-nums text-white/80">
                          ₹{trip.priceInr.toLocaleString('en-IN')}
                        </span>
                        <span className="text-white/25"> · </span>
                        <span className="tabular-nums">
                          {trip.seatsTaken}/{trip.seats} seats
                        </span>
                        {trip.groupBookingEnabled ? (
                          <>
                            <span className="text-white/25"> · </span>
                            <span className="tabular-nums text-clay/90">
                              group {(trip.groupSeatsTaken || 0)}/{trip.groupSeats || 0}
                              {trip.groupDiscountValue
                                ? trip.groupDiscountType === 'flat_per_seat'
                                  ? ` · −₹${trip.groupDiscountValue}/seat`
                                  : ` · −${trip.groupDiscountValue}%`
                                : ''}
                            </span>
                          </>
                        ) : null}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] tabular-nums tracking-wide text-white/40">
                        {trip.startDate} → {trip.endDate}
                      </p>
                    </div>
                  </div>

                  {trip.paymentPlansEnabled && trip.planTemplate?.length ? (
                    <ul className="mt-3.5 space-y-1.5 border-t border-white/[0.06] pt-3.5">
                      {trip.planTemplate.map((p, i) => (
                        <li
                          key={i}
                          className="flex items-baseline justify-between gap-3 text-[12px] leading-snug text-white/50"
                        >
                          <span className="min-w-0 truncate text-white/65">{p.label}</span>
                          <span className="shrink-0 tabular-nums text-white/40">
                            {Math.round(p.percent * 100)}%
                            {p.daysBeforeStart == null
                              ? ' · due now'
                              : ` · ${p.daysBeforeStart}d before`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-[12px] text-white/35">Payment plans off</p>
                  )}

                  <div className="mt-3.5 flex flex-wrap gap-2 border-t border-white/[0.06] pt-3.5">
                    <button
                      type="button"
                      onClick={() =>
                        editingDetailsTripId === trip.id
                          ? setEditingDetailsTripId(null)
                          : openTripDetailsEditor(trip)
                      }
                      className="inline-flex min-h-10 items-center justify-center rounded-[1rem] bg-clay/90 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-black transition-transform duration-100 ease-out active:scale-[0.97]"
                    >
                      {editingDetailsTripId === trip.id ? 'Close edit' : 'Edit details'}
                    </button>
                    <label
                      className={`${wwBtnGhost} cursor-pointer ${
                        tripCoverBusyId === trip.id ? 'pointer-events-none opacity-50' : ''
                      }`}
                    >
                      {tripCoverBusyId === trip.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Upload className="h-3 w-3" />
                      )}
                      Cover
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                        className="hidden"
                        disabled={tripCoverBusyId === trip.id}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          e.target.value = ''
                          void replaceTripCover(trip.id, file)
                        }}
                      />
                    </label>
                    {trip.status !== 'published' && (
                      <button
                        type="button"
                        onClick={() => setStatus(trip.id, 'published')}
                        className="inline-flex min-h-10 items-center justify-center rounded-[1rem] bg-emerald-400/90 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-black transition-transform duration-100 ease-out active:scale-[0.97]"
                      >
                        Publish
                      </button>
                    )}
                    {trip.status === 'published' && (
                      <button type="button" onClick={() => setStatus(trip.id, 'closed')} className={wwBtnGhost}>
                        Close
                      </button>
                    )}
                    <button type="button" onClick={() => togglePlans(trip)} className={wwBtnGhost}>
                      {trip.paymentPlansEnabled ? 'Disable plans' : 'Enable plans'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        editingPlanTripId === trip.id ? setEditingPlanTripId(null) : openPlanEditor(trip)
                      }
                      className="inline-flex min-h-10 items-center justify-center rounded-[1rem] bg-clay/90 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-black transition-transform duration-100 ease-out active:scale-[0.97]"
                    >
                      {editingPlanTripId === trip.id ? 'Close plan' : 'Edit plan'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        editingGroupTripId === trip.id
                          ? setEditingGroupTripId(null)
                          : openGroupEditor(trip)
                      }
                      className={wwBtnGhost}
                    >
                      {editingGroupTripId === trip.id ? 'Close group' : 'Group booking'}
                    </button>
                    <a
                      href={appUrl(`/dashboard/getaway/${trip.slug}`)}
                      className={wwBtnGhost}
                    >
                      Preview
                    </a>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void removeTrip(trip)}
                      className="inline-flex min-h-10 items-center justify-center rounded-[1rem] bg-rose-500/15 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-300 transition-transform duration-100 ease-out active:scale-[0.97] disabled:opacity-45"
                    >
                      Delete
                    </button>
                  </div>

                  {editingDetailsTripId === trip.id ? (
                    <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
                      <p className={wwLabel}>Edit trip details</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block sm:col-span-2">
                          <span className={wwLabel}>Title</span>
                          <input
                            className={wwField}
                            value={editTripForm.title}
                            onChange={(e) =>
                              setEditTripForm((f) => ({ ...f, title: e.target.value }))
                            }
                          />
                        </label>
                        <label className="block sm:col-span-2">
                          <span className={wwLabel}>Description</span>
                          <textarea
                            className={`${wwField} min-h-[88px]`}
                            value={editTripForm.description}
                            onChange={(e) =>
                              setEditTripForm((f) => ({ ...f, description: e.target.value }))
                            }
                          />
                        </label>
                        <label className="block sm:col-span-2">
                          <span className={wwLabel}>Itinerary</span>
                          <textarea
                            className={`${wwField} min-h-[120px]`}
                            value={editTripForm.itinerary}
                            onChange={(e) =>
                              setEditTripForm((f) => ({ ...f, itinerary: e.target.value }))
                            }
                          />
                        </label>
                        <label className="block">
                          <span className={wwLabel}>Price (₹)</span>
                          <input
                            className={wwField}
                            inputMode="numeric"
                            value={editTripForm.priceInr}
                            onChange={(e) =>
                              setEditTripForm((f) => ({ ...f, priceInr: e.target.value }))
                            }
                          />
                        </label>
                        <label className="block">
                          <span className={wwLabel}>Seats</span>
                          <input
                            className={wwField}
                            inputMode="numeric"
                            value={editTripForm.seats}
                            onChange={(e) =>
                              setEditTripForm((f) => ({ ...f, seats: e.target.value }))
                            }
                          />
                        </label>
                        <label className="block">
                          <span className={wwLabel}>Start</span>
                          <input
                            type="date"
                            className={wwField}
                            value={editTripForm.startDate}
                            onChange={(e) =>
                              setEditTripForm((f) => ({ ...f, startDate: e.target.value }))
                            }
                          />
                        </label>
                        <label className="block">
                          <span className={wwLabel}>End</span>
                          <input
                            type="date"
                            className={wwField}
                            value={editTripForm.endDate}
                            onChange={(e) =>
                              setEditTripForm((f) => ({ ...f, endDate: e.target.value }))
                            }
                          />
                        </label>
                        <label className="block sm:col-span-2">
                          <span className={wwLabel}>Cover image URL</span>
                          <input
                            className={wwField}
                            value={editTripForm.coverImageUrl}
                            onChange={(e) =>
                              setEditTripForm((f) => ({ ...f, coverImageUrl: e.target.value }))
                            }
                          />
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void saveTripDetails(trip.id)}
                          className={wwBtnPrimary}
                        >
                          {busy ? 'Saving…' : 'Save trip'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingDetailsTripId(null)}
                          className={wwBtnGhost}
                        >
                          Discard
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {editingPlanTripId === trip.id ? (
                    <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
                      <PlanStepsEditor
                        rows={editPlanDraft}
                        onChange={setEditPlanDraft}
                        priceInr={trip.priceInr}
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void savePlanTemplate(trip.id)}
                        className={`${wwBtnPrimary} w-full`}
                      >
                        {busy ? 'Saving…' : 'Save payment plan'}
                      </button>
                    </div>
                  ) : null}

                  {editingGroupTripId === trip.id ? (
                    <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
                      <p className={wwLabel}>Group booking (promoter / admin)</p>
                      <label className="flex items-center gap-2 text-sm text-white/70">
                        <input
                          type="checkbox"
                          checked={groupDraft.groupBookingEnabled}
                          onChange={(e) =>
                            setGroupDraft({ ...groupDraft, groupBookingEnabled: e.target.checked })
                          }
                        />
                        Enable group bookings for this trip
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="mb-1.5 text-[11px] text-white/40">Reserved group seats</p>
                          <input
                            className={wwField}
                            type="number"
                            min={0}
                            value={groupDraft.groupSeats}
                            onChange={(e) => setGroupDraft({ ...groupDraft, groupSeats: e.target.value })}
                          />
                        </div>
                        <div>
                          <p className="mb-1.5 text-[11px] text-white/40">Discount type</p>
                          <select
                            className={wwField}
                            value={groupDraft.groupDiscountType}
                            onChange={(e) =>
                              setGroupDraft({
                                ...groupDraft,
                                groupDiscountType: e.target.value as 'percent' | 'flat_per_seat',
                              })
                            }
                          >
                            <option value="percent">Percent off total</option>
                            <option value="flat_per_seat">Flat ₹ off per seat</option>
                          </select>
                        </div>
                        <div>
                          <p className="mb-1.5 text-[11px] text-white/40">
                            {groupDraft.groupDiscountType === 'flat_per_seat'
                              ? 'Discount ₹ / seat'
                              : 'Discount %'}
                          </p>
                          <input
                            className={wwField}
                            type="number"
                            min={0}
                            value={groupDraft.groupDiscountValue}
                            onChange={(e) =>
                              setGroupDraft({ ...groupDraft, groupDiscountValue: e.target.value })
                            }
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="mb-1.5 text-[11px] text-white/40">Min size</p>
                            <input
                              className={wwField}
                              type="number"
                              min={2}
                              value={groupDraft.groupMinSize}
                              onChange={(e) =>
                                setGroupDraft({ ...groupDraft, groupMinSize: e.target.value })
                              }
                            />
                          </div>
                          <div>
                            <p className="mb-1.5 text-[11px] text-white/40">Max size</p>
                            <input
                              className={wwField}
                              type="number"
                              min={2}
                              value={groupDraft.groupMaxSize}
                              onChange={(e) =>
                                setGroupDraft({ ...groupDraft, groupMaxSize: e.target.value })
                              }
                            />
                          </div>
                        </div>
                      </div>
                      <p className="text-[12px] text-white/40">
                        Taken so far: {trip.groupSeatsTaken || 0} / {trip.groupSeats || 0} group seats
                      </p>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void saveGroupSettings(trip.id)}
                        className={`${wwBtnPrimary} w-full`}
                      >
                        {busy ? 'Saving…' : 'Save group settings'}
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
              {filteredTrips.length === 0 && (
                <p className="text-sm text-white/40">
                  {adminQuery.trim() ? 'No trips match your search.' : 'No trips yet.'}
                </p>
              )}
            </div>
          </div>
          </div>
        )}

        {tab === 'registrations' && (
          <WwTabPanel key="registrations" className="space-y-4">
            <WwPageHeading
              title="Registrations"
              subtitle="Expand a row for installments, cash collection, and group join links."
              action={
                <p className="text-[13px] tabular-nums text-white/40">
                  {filteredRegs.length} shown
                  {regs.length !== filteredRegs.length ? ` · ${regs.length} total` : ''}
                </p>
              }
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ['all', 'All'],
                    ['pending', 'Pending'],
                    ['partial', 'Partial'],
                    ['paid', 'Paid'],
                    ['cancelled', 'Cancelled'],
                  ] as const
                ).map(([id, label]) => {
                  const active = regStatusFilter === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setRegStatusFilter(id)}
                      className={`${wwChip} ${
                        active ? 'bg-clay text-black' : 'bg-white/[0.06] text-white/55 hover:text-white/80'
                      }`}
                    >
                      <span className="relative z-[1]">{label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className={`${wwSurface} overflow-hidden divide-y divide-white/[0.06]`}>
              {filteredRegs.map((row) => {
                const { registration, trip, installments = [] } = row
                const cancelled = registration.status === 'cancelled'
                const expanded = expandedRegId === registration.id
                const dueCount = installments.filter((i: WwInstallment) => i.status === 'due').length
                const joinHref =
                  (row as { joinUrl?: string | null }).joinUrl ||
                  (registration.joinCode
                    ? appUrl(`/dashboard/getaway/group/${registration.joinCode}`)
                    : null)

                return (
                  <div
                    key={registration.id}
                    className={`${cancelled ? 'opacity-55' : ''} ${
                      expanded ? 'bg-white/[0.02]' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedRegId(expanded ? null : registration.id)
                      }
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-100 hover:bg-white/[0.03] active:bg-white/[0.05] md:px-5"
                    >
                      <span
                        className={`inline-flex shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-[0.14em] ${
                          cancelled
                            ? 'bg-white/10 text-white/45'
                            : registration.status === 'paid'
                              ? 'bg-emerald-400/15 text-emerald-300'
                              : registration.status === 'partial'
                                ? 'bg-amber-400/15 text-amber-200'
                                : 'bg-sky-400/15 text-sky-200'
                        }`}
                      >
                        {registration.status}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="truncate text-[15px] font-semibold tracking-[-0.02em] text-white">
                            {registration.buyerName}
                          </span>
                          <span className="truncate text-[12px] text-white/40">
                            {trip?.title || 'Trip'}
                          </span>
                          {registration.isGroup ? (
                            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-clay/90">
                              group×{registration.groupSize || 1}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-[12px] tabular-nums text-white/40">
                          ₹{Math.round(registration.amountPaidInr).toLocaleString('en-IN')} / ₹
                          {Math.round(registration.amountDueInr).toLocaleString('en-IN')}
                          {dueCount > 0 && !cancelled ? (
                            <span className="text-amber-200/80"> · {dueCount} due</span>
                          ) : null}
                          {registration.promoterCode ? (
                            <span className="text-white/30"> · ref {registration.promoterCode}</span>
                          ) : null}
                        </p>
                      </div>
                      <motion.span
                        animate={{ rotate: expanded ? 180 : 0 }}
                        transition={springFast}
                        className="shrink-0 text-white/35"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </motion.span>
                    </button>

                    <AnimatePresence initial={false}>
                      {expanded ? (
                        <motion.div
                          key="detail"
                          initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                          animate={
                            reduce
                              ? { opacity: 1 }
                              : { height: 'auto', opacity: 1 }
                          }
                          exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                          transition={springFast}
                          className="overflow-hidden"
                        >
                          <div className="space-y-3 border-t border-white/[0.06] px-4 pb-4 pt-3 md:px-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 text-[13px] text-white/55">
                                <p className="truncate">{registration.buyerEmail}</p>
                                {registration.buyerPhone ? (
                                  <p className="mt-0.5">{registration.buyerPhone}</p>
                                ) : null}
                                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
                                  {registration.paymentMode}
                                  {registration.isGroup && registration.discountInr
                                    ? ` · −₹${Math.round(registration.discountInr).toLocaleString('en-IN')}`
                                    : ''}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {registration.isGroup && joinHref ? (
                                  <button
                                    type="button"
                                    onClick={() => void copy(joinHref)}
                                    className={wwBtnGhost}
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                    Join link
                                  </button>
                                ) : null}
                                {!cancelled ? (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void cancelReg(registration)}
                                    className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-[1rem] bg-rose-500/15 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-300 transition-transform duration-100 ease-out active:scale-[0.97] disabled:opacity-45"
                                  >
                                    Cancel
                                  </button>
                                ) : null}
                              </div>
                            </div>

                            {installments.length > 0 ? (
                              <ul className="space-y-1.5">
                                {installments.map((inst: WwInstallment) => (
                                  <li
                                    key={inst.id}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-[1rem] bg-black/35 px-3 py-2.5"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-[13px] font-medium text-white/85">
                                        #{inst.sequence}{' '}
                                        {inst.claimedByName || inst.label}
                                      </p>
                                      <p className="mt-0.5 text-[11px] tabular-nums text-white/40">
                                        ₹{Math.round(inst.amountInr).toLocaleString('en-IN')} ·{' '}
                                        {inst.status}
                                        {inst.dueAt ? ` · ${inst.dueAt.slice(0, 10)}` : ''}
                                        {inst.status === 'paid' && inst.paymentMethod === 'cash'
                                          ? ' · cash'
                                          : ''}
                                      </p>
                                    </div>
                                    {!cancelled && inst.status === 'due' ? (
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() =>
                                          void collectCash(
                                            inst.id,
                                            `${registration.buyerName} · ${inst.label}`,
                                          )
                                        }
                                        className={`${wwBtnGhost} gap-1.5`}
                                      >
                                        <Banknote className="h-3.5 w-3.5" />
                                        Cash
                                      </button>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                )
              })}
              {filteredRegs.length === 0 && (
                <p className="px-5 py-10 text-center text-sm text-white/40">
                  {regs.length === 0
                    ? 'No registrations yet.'
                    : 'No bookings match your search or filters.'}
                </p>
              )}
            </div>
          </WwTabPanel>
        )}

        {tab === 'members' && (
          <div className="space-y-5">
            <WwPageHeading
              title="Members"
              subtitle="Invite owners, admins, and promoters. Club admin can also invite from Yureka admin → WanderWorld."
            />
          <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
            <form onSubmit={invite} className={`${wwSurfacePad} space-y-3`}>
              <h2 className="text-[17px] font-semibold tracking-[-0.02em]">Invite member</h2>
              <p className="text-sm text-white/45">
                They sign in at{' '}
                <span className="font-mono text-white/60">wanderworld.yureka.one</span> with this email.
              </p>
              {inviteInfo && (
                <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-100">
                  {inviteInfo}
                </p>
              )}
              <input
                className={wwField}
                type="email"
                placeholder="Email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
              <select
                className={wwField}
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                <option value="promoter">Promoter</option>
                <option value="admin">Admin</option>
                {membership.member.role === 'owner' && <option value="owner">Owner</option>}
              </select>
              <button
                type="submit"
                disabled={busy}
                className={`${wwBtnPrimary} w-full min-h-12`}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Send invite
              </button>
              <p className="text-xs text-white/40">
                First owner: set <span className="font-mono">WANDERWORLD_BOOTSTRAP_EMAIL</span> to your email
                (required. auto-bootstrap is disabled if unset), or invite from Club admin → WanderWorld.
              </p>
            </form>
            <div>
              <h2 className="mb-3 text-[17px] font-semibold tracking-[-0.02em]">Team</h2>
                            <ul className="space-y-2">
                {filteredMembers.map((m) => {
                  const promo = (analytics?.promoters || []).find((p) => p.memberId === m.id)
                  const draft = memberRefDrafts[m.id] ?? promo?.code ?? ''
                  const tripDraft = memberTripDrafts[m.id] || []
                  return (
                    <li
                      key={m.id}
                      className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold">
                            {m.displayName || m.email}
                          </div>
                          {m.displayName ? (
                            <div className="text-xs text-white/40">{m.email}</div>
                          ) : null}
                          <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
                            <span>{m.role}</span>
                            <span>·</span>
                            <span>{m.joinedAt ? 'Joined' : 'Pending'}</span>
                            {promo?.code ? (
                              <>
                                <span>·</span>
                                <span>ref {promo.code}</span>
                              </>
                            ) : null}
                          </div>
                          {(m.role === 'promoter' || promo) && (
                            <p className="mt-1.5 text-[12px] tabular-nums text-white/45">
                              Online ₹{Math.round(promo?.onlineCollectedInr || 0).toLocaleString('en-IN')}
                              {' · '}
                              Cash ₹{Math.round(promo?.cashCollectedInr || 0).toLocaleString('en-IN')}
                              {' · '}
                              Total ₹{Math.round(promo?.revenueInr || 0).toLocaleString('en-IN')}
                            </p>
                          )}
                        </div>
                        {m.id !== membership.member.id && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void removeMember(m.id, m.email)}
                            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-red-500/15 px-3 text-[10px] font-black uppercase tracking-[0.15em] text-red-200 active:scale-[0.97] disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <input
                          className={`${wwField} min-w-[10rem] flex-1 py-2.5 font-mono text-xs uppercase`}
                          placeholder={
                            (m.assignedTripIds || []).length
                              ? 'Global ref (unused if trips assigned)'
                              : 'Custom referral ID (all trips)'
                          }
                          value={draft}
                          onChange={(e) =>
                            setMemberRefDrafts((prev) => ({
                              ...prev,
                              [m.id]: e.target.value.toUpperCase(),
                            }))
                          }
                        />
                        <button
                          type="button"
                          disabled={refBusy || !draft.trim()}
                          onClick={() => void saveMemberReferralId(m.id, { tripId: null })}
                          className="rounded-xl bg-clay px-3 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-black disabled:opacity-50"
                        >
                          Set all-trips ref
                        </button>
                      </div>
                      {m.role === 'promoter' && (
                        <div className="space-y-2 border-t border-white/[0.06] pt-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-white/40">
                            Assigned trips
                            <span className="ml-2 normal-case tracking-normal text-white/30">
                              (none = all trips)
                            </span>
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {trips.map((t) => {
                              const on = tripDraft.includes(t.id)
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() =>
                                    setMemberTripDrafts((prev) => {
                                      const cur = prev[m.id] || []
                                      return {
                                        ...prev,
                                        [m.id]: on
                                          ? cur.filter((id) => id !== t.id)
                                          : [...cur, t.id],
                                      }
                                    })
                                  }
                                  className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-transform duration-100 active:scale-[0.97] ${
                                    on
                                      ? 'bg-clay/90 text-black'
                                      : 'bg-white/[0.08] text-white/60'
                                  }`}
                                >
                                  {t.title}
                                </button>
                              )
                            })}
                            {trips.length === 0 && (
                              <span className="text-xs text-white/35">Create a trip first</span>
                            )}
                          </div>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void saveMemberTrips(m.id)}
                            className={wwBtnGhost}
                          >
                            Save trip access
                          </button>
                          {tripDraft.length > 0 && (
                            <div className="space-y-2 pt-1">
                              <p className="text-[11px] text-white/40">
                                Custom ref per allocated trip
                              </p>
                              {tripDraft.map((tripId) => {
                                const trip = trips.find((t) => t.id === tripId)
                                const link = (promo?.links || []).find((l) => l.tripId === tripId)
                                const key = `${m.id}:${tripId}`
                                const tripDraftCode =
                                  memberRefDrafts[key] ?? link?.code ?? ''
                                return (
                                  <div key={tripId} className="flex flex-wrap gap-2">
                                    <span className="min-w-[6rem] self-center truncate text-[12px] text-white/55">
                                      {trip?.title || tripId.slice(0, 8)}
                                    </span>
                                    <input
                                      className={`${wwField} min-w-[8rem] flex-1 py-2 font-mono text-xs uppercase`}
                                      placeholder="TRIP-REF"
                                      value={tripDraftCode}
                                      onChange={(e) =>
                                        setMemberRefDrafts((prev) => ({
                                          ...prev,
                                          [key]: e.target.value.toUpperCase(),
                                        }))
                                      }
                                    />
                                    <button
                                      type="button"
                                      disabled={refBusy || !tripDraftCode.trim()}
                                      onClick={() =>
                                        void saveMemberReferralId(m.id, {
                                          tripId,
                                          linkId: link?.id,
                                        })
                                      }
                                      className="rounded-xl bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.15em] disabled:opacity-50"
                                    >
                                      Set ref
                                    </button>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
                {filteredMembers.length === 0 && (
                  <p className="text-sm text-white/40">
                    {members.length === 0
                      ? 'No members yet.'
                      : 'No members match your search.'}
                  </p>
                )}
              </ul>
            </div>
          </div>
          </div>
        )}

        {tab === 'promoter' && promoter && (
          <div className="space-y-6">
            <WwPageHeading
              title={isAdmin ? 'My promoter desk' : 'Dashboard'}
              subtitle="Profile, group bookings, referral links, and cash collection for your attributed seats."
            />
            <form onSubmit={saveMyProfile} className={`${wwSurfacePad} space-y-3`}>
              <h2 className="text-[17px] font-semibold tracking-[-0.02em]">Your profile</h2>
              <p className="text-sm text-white/45">
                Name and contact for ops. Complete this so admin can recognize your referrals.
              </p>
              {!profileForm.displayName?.trim() && (
                <p className="rounded-[1.15rem] border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-[13px] text-amber-100/90">
                  Profile incomplete. add your display name to finish setup.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className={wwField}
                  placeholder="Display name"
                  value={profileForm.displayName}
                  onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })}
                />
                <input
                  className={wwField}
                  placeholder="Phone"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                />
                <input
                  className={wwField}
                  placeholder="City"
                  value={profileForm.city}
                  onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                />
                <input
                  className={wwField}
                  placeholder="Instagram (optional)"
                  value={profileForm.instagram}
                  onChange={(e) => setProfileForm({ ...profileForm, instagram: e.target.value })}
                />
              </div>
              <textarea
                className={wwField}
                rows={2}
                placeholder="Short bio (optional)"
                value={profileForm.bio}
                onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
              />
              <button type="submit" disabled={busy} className={`${wwBtnPrimary} w-full sm:w-auto`}>
                {busy ? 'Saving…' : 'Save profile'}
              </button>
              {promoter.assignmentMode === 'specific' ||
              (Array.isArray(promoter.assignedTripIds) && promoter.assignedTripIds.length > 0) ? (
                <div className="rounded-[1.15rem] border border-clay/20 bg-clay/[0.06] px-4 py-3">
                  <p className={wwLabel}>Allocated trips</p>
                  <ul className="mt-2 space-y-1 text-[13px] text-white/75">
                    {(promoter.assignedTrips || []).map((t: any) => (
                      <li key={t.id}>
                        {t.title}
                        <span className="text-white/35"> · /{t.slug}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[12px] text-white/40">
                    Share the trip links below. admin sets your custom referral IDs.
                  </p>
                </div>
              ) : (
                <p className="text-[12px] text-white/40">
                  Access: <span className="text-white/70">all published trips</span> (one global referral ID).
                </p>
              )}
            </form>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <WwStat
                label="Regs"
                value={promoter.registrations}
                hint={`${promoter.uniqueBuyers ?? 0} buyers`}
              />
              <WwStat
                label="Paid / Partial"
                value={
                  <>
                    {promoter.paid ?? 0}
                    <span className="text-[1rem] font-medium text-white/40"> / {promoter.partial ?? 0}</span>
                  </>
                }
              />
              <WwStat label="Clicks" value={promoter.clicks ?? 0} />
              <WwStat
                label="Collected"
                value={`₹${Math.round(promoter.revenueInr || 0).toLocaleString('en-IN')}`}
                tone="ok"
              />
              <WwStat
                label="Cash"
                value={`₹${Math.round(promoter.cashCollectedInr || 0).toLocaleString('en-IN')}`}
              />
              <WwStat
                label="Outstanding"
                value={`₹${Math.round(promoter.outstandingInr || 0).toLocaleString('en-IN')}`}
                tone="warn"
              />
            </div>

            <div className={`${wwSurfacePad} space-y-3`}>
              <h2 className="text-[17px] font-semibold tracking-[-0.02em]">Take group booking</h2>
              <p className="text-sm text-white/45">
                Creates a discounted multi-seat booking under your referral. You get a share link. each
                traveler joins and pays their own seat online (or collect cash per share below).
              </p>
              {lastGroupJoinUrl ? (
                <div className="rounded-[1.15rem] border border-clay/25 bg-clay/10 px-4 py-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-clay/90">
                    Group join link
                  </p>
                  <p className="mt-1 break-all text-[13px] text-white/80">{lastGroupJoinUrl}</p>
                  <button
                    type="button"
                    onClick={() => void copy(lastGroupJoinUrl)}
                    className={`${wwBtnGhost} mt-3`}
                  >
                    Copy join link
                  </button>
                </div>
              ) : null}
              {groupTrips.length === 0 ? (
                <p className="rounded-[1.15rem] border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/40">
                  No trips with group booking enabled yet.
                </p>
              ) : (
                <form onSubmit={submitGroupBooking} className="space-y-3">
                  <select
                    className={wwField}
                    value={groupForm.tripId}
                    onChange={(e) => setGroupForm({ ...groupForm, tripId: e.target.value })}
                    required
                  >
                    {groupTrips.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} · {t.groupSeatsLeft} group seats left
                        {t.groupDiscountValue
                          ? t.groupDiscountType === 'flat_per_seat'
                            ? ` · −₹${t.groupDiscountValue}/seat`
                            : ` · −${t.groupDiscountValue}%`
                          : ''}
                      </option>
                    ))}
                  </select>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      className={wwField}
                      type="number"
                      min={2}
                      placeholder="Group size"
                      value={groupForm.groupSize}
                      onChange={(e) => setGroupForm({ ...groupForm, groupSize: e.target.value })}
                      required
                    />
                    <div className="flex items-center rounded-[1.15rem] border border-white/[0.08] bg-white/[0.03] px-4 text-[13px] text-white/45">
                      Equal shares · pay per person
                    </div>
                  </div>
                  <input
                    className={wwField}
                    placeholder="Lead name"
                    value={groupForm.buyerName}
                    onChange={(e) => setGroupForm({ ...groupForm, buyerName: e.target.value })}
                    required
                  />
                  <input
                    className={wwField}
                    type="email"
                    placeholder="Lead email"
                    value={groupForm.buyerEmail}
                    onChange={(e) => setGroupForm({ ...groupForm, buyerEmail: e.target.value })}
                    required
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      className={wwField}
                      placeholder="Phone"
                      value={groupForm.buyerPhone}
                      onChange={(e) => setGroupForm({ ...groupForm, buyerPhone: e.target.value })}
                    />
                    <input
                      className={wwField}
                      placeholder="City"
                      value={groupForm.city}
                      onChange={(e) => setGroupForm({ ...groupForm, city: e.target.value })}
                    />
                  </div>
                  <input
                    className={wwField}
                    placeholder="Notes (optional)"
                    value={groupForm.notes}
                    onChange={(e) => setGroupForm({ ...groupForm, notes: e.target.value })}
                  />
                  {(() => {
                    const t = groupTrips.find((x) => x.id === groupForm.tripId)
                    if (!t) return null
                    const size = Math.max(1, Number(groupForm.groupSize) || 1)
                    const list = t.priceInr * size
                    const disc =
                      t.groupDiscountType === 'flat_per_seat'
                        ? Math.min(list, (t.groupDiscountValue || 0) * size)
                        : Math.round(list * Math.min(100, t.groupDiscountValue || 0) * 0.01)
                    const due = Math.max(0, list - disc)
                    const per = size > 0 ? Math.round(due / size) : due
                    return (
                      <p className="text-[13px] tabular-nums text-white/55">
                        Est. ₹{per.toLocaleString('en-IN')}/person · ₹{Math.round(due).toLocaleString('en-IN')}{' '}
                        total
                        {disc > 0 ? (
                          <span className="text-clay">
                            {' '}
                            · save ₹{Math.round(disc).toLocaleString('en-IN')}
                          </span>
                        ) : null}
                        <span className="text-white/35">
                          {' '}
                          · min {t.groupMinSize || 2} to {t.groupMaxSize || 20}
                        </span>
                      </p>
                    )
                  })()}
                  <button type="submit" disabled={busy} className={`${wwBtnPrimary} w-full`}>
                    {busy ? 'Creating…' : 'Create group booking'}
                  </button>
                </form>
              )}
            </div>

            <div className={`${wwSurfacePad} space-y-4`}>
              <div>
                <h2 className="text-[17px] font-semibold tracking-[-0.02em]">
                  {promoter.assignmentMode === 'specific' || promoter.assignedTripIds?.length
                    ? 'Trip referral links'
                    : 'Your referral link'}
                </h2>
                <p className="mt-1 text-sm text-white/45">
                  Copy and share your link. Custom referral IDs are set by admin only.
                </p>
              </div>

              <div className="space-y-3">
                {(promoter.shareLinks || [])
                  .filter((link: any) =>
                    matchesAdminQuery(adminQuery, link.code, link.url, link.tripTitle, link.tripSlug),
                  )
                  .map((link: any) => (
                  <div
                    key={link.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
                        {link.tripTitle ? (
                          <>
                            Trip · <span className="text-clay/90">{link.tripTitle}</span>
                          </>
                        ) : (
                          'All trips'
                        )}
                        {' · '}
                        ref {link.code}
                        {' · '}
                        {link.clickCount || 0} clicks
                      </p>
                      <p className="mt-1 break-all text-[13px] text-white/65">{link.url}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copy(link.url)}
                      className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-clay px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] text-black active:scale-[0.97]"
                    >
                      {copied === link.url ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      Copy
                    </button>
                  </div>
                ))}
                {!(promoter.shareLinks || []).length && (
                  <p className="text-sm text-white/40">
                    No referral links yet. ask admin to allocate a trip, or refresh.
                  </p>
                )}
              </div>
            </div>

            <div className={wwTableWrap}>
              <p className="px-4 pt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">
                Your buyers · regs accumulated
              </p>
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-white/[0.04] font-mono text-[10px] uppercase tracking-[0.15em] text-white/40">
                  <tr>
                    <th className="px-4 py-3">Buyer</th>
                    <th className="px-4 py-3">Regs</th>
                    <th className="px-4 py-3">Paid</th>
                    <th className="px-4 py-3">Collected</th>
                    <th className="px-4 py-3">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {(promoter.byBuyer || []).map((row: any) => (
                    <tr key={row.userId || row.buyerEmail} className="border-t border-white/5">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{row.buyerName}</div>
                        <div className="text-xs text-white/40">{row.buyerEmail}</div>
                      </td>
                      <td className="px-4 py-3">{row.registrations}</td>
                      <td className="px-4 py-3">{row.paid}</td>
                      <td className="px-4 py-3">₹{Math.round(row.revenueInr || 0).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-amber-100/90">
                        ₹{Math.round(row.outstandingInr || 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!(promoter.byBuyer || []).length && (
                <p className="p-4 text-sm text-white/40">No attributed bookings yet.</p>
              )}
            </div>

            <div className={wwTableWrap}>
              <div className="border-b border-white/[0.06] px-4 py-3.5 md:px-5">
                <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-white">
                  Payments
                </h2>
                <p className="mt-0.5 text-[12px] text-white/40">
                  Collect cash for due shares on your attributed bookings.
                </p>
              </div>
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-white/[0.04] font-mono text-[10px] uppercase tracking-[0.15em] text-white/40">
                  <tr>
                    <th className="px-4 py-3">Buyer</th>
                    <th className="px-4 py-3">Trip</th>
                    <th className="px-4 py-3">Installment</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(promoter.payments || [])
                    .filter(({ installment, registration, trip }: any) =>
                      matchesAdminQuery(
                        adminQuery,
                        registration?.buyerName,
                        registration?.buyerEmail,
                        installment?.claimedByName,
                        installment?.claimedByEmail,
                        trip?.title,
                        installment?.label,
                        registration?.promoterCode,
                      ),
                    )
                    .map(({ installment, registration, trip }: any) => {
                      const travelerName =
                        installment.claimedByName ||
                        (registration.isGroup ? null : registration.buyerName) ||
                        registration.buyerName
                      const travelerEmail =
                        installment.claimedByEmail || registration.buyerEmail
                      const cashLabel = `${travelerName} · ${installment.label}`
                      return (
                    <tr key={installment.id} className="border-t border-white/5">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{travelerName}</div>
                        <div className="text-xs text-white/40">{travelerEmail}</div>
                        {registration.isGroup &&
                        installment.claimedByName &&
                        installment.claimedByName !== registration.buyerName ? (
                          <div className="mt-0.5 text-[10px] text-white/30">
                            Lead {registration.buyerName}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">{trip?.title || '·'}</td>
                      <td className="px-4 py-3">
                        <div>{installment.label}</div>
                        <div className="text-[10px] uppercase tracking-wider text-white/35">#{installment.sequence}</div>
                      </td>
                      <td className="px-4 py-3">₹{Math.round(installment.amountInr).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3">
                        {installment.status === 'paid' ? (
                          <span className="text-emerald-300/90">
                            {installment.paymentMethod === 'cash' ? 'Cash' : 'Online'}
                          </span>
                        ) : (
                          <span className="text-amber-200/90">Due</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {installment.status !== 'paid' && installment.status !== 'cancelled' ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void collectCash(installment.id, cashLabel)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-clay px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-black active:scale-[0.97] disabled:opacity-50"
                          >
                            <Banknote className="h-3.5 w-3.5" />
                            Collect cash
                          </button>
                        ) : (
                          <span className="text-xs text-white/35">·</span>
                        )}
                      </td>
                    </tr>
                      )
                    })}
                </tbody>
              </table>
              {!(promoter.payments || []).length && (
                <p className="p-4 text-sm text-white/40">No payments for your referrals yet.</p>
              )}
            </div>

            <div className={`${wwSurface} overflow-hidden`}>
              <div className="border-b border-white/[0.06] px-4 py-3.5 md:px-5">
                <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-white">
                  Bookings & groups
                </h2>
                <p className="mt-0.5 text-[12px] text-white/40">
                  Expand a row for join link, edit lead/traveler, collect cash, release seats, cancel, or delete unpaid bookings.
                </p>
              </div>
              <div className="divide-y divide-white/[0.06]">
                {(promoter.rows || [])
                  .filter(({ registration, trip }: any) =>
                    matchesAdminQuery(
                      adminQuery,
                      registration?.buyerName,
                      registration?.buyerEmail,
                      trip?.title,
                      registration?.status,
                      registration?.promoterCode,
                      registration?.joinCode,
                    ),
                  )
                  .map((row: any) => {
                    const { registration, trip, installments = [] } = row
                    const cancelled = registration.status === 'cancelled'
                    const expanded = expandedRegId === registration.id
                    const editing = editingRegId === registration.id
                    const dueCount = installments.filter((i: WwInstallment) => i.status === 'due').length
                    const joinHref =
                      row.joinUrl ||
                      (registration.joinCode
                        ? appUrl(`/dashboard/getaway/group/${registration.joinCode}`)
                        : null)

                    return (
                      <div
                        key={registration.id}
                        className={`${cancelled ? 'opacity-55' : ''} ${
                          expanded ? 'bg-white/[0.02]' : ''
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedRegId(expanded ? null : registration.id)
                          }
                          className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-100 hover:bg-white/[0.03] active:bg-white/[0.05] md:px-5"
                        >
                          <span
                            className={`inline-flex shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-[0.14em] ${
                              cancelled
                                ? 'bg-white/10 text-white/45'
                                : registration.status === 'paid'
                                  ? 'bg-emerald-400/15 text-emerald-300'
                                  : registration.status === 'partial'
                                    ? 'bg-amber-400/15 text-amber-200'
                                    : 'bg-sky-400/15 text-sky-200'
                            }`}
                          >
                            {registration.status}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                              <span className="truncate text-[15px] font-semibold tracking-[-0.02em] text-white">
                                {registration.buyerName}
                              </span>
                              <span className="truncate text-[12px] text-white/40">
                                {trip?.title || 'Trip'}
                              </span>
                              {registration.isGroup ? (
                                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-clay/90">
                                  group×{registration.groupSize || 1}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-0.5 truncate text-[12px] tabular-nums text-white/40">
                              ₹{Math.round(registration.amountPaidInr || 0).toLocaleString('en-IN')} / ₹
                              {Math.round(registration.amountDueInr || 0).toLocaleString('en-IN')}
                              {dueCount > 0 && !cancelled ? (
                                <span className="text-amber-200/80"> · {dueCount} due</span>
                              ) : null}
                            </p>
                          </div>
                          <motion.span
                            animate={{ rotate: expanded ? 180 : 0 }}
                            transition={springFast}
                            className="shrink-0 text-white/35"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </motion.span>
                        </button>

                        <AnimatePresence initial={false}>
                          {expanded ? (
                            <motion.div
                              key="detail"
                              initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                              animate={
                                reduce
                                  ? { opacity: 1 }
                                  : { height: 'auto', opacity: 1 }
                              }
                              exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                              transition={springFast}
                              className="overflow-hidden"
                            >
                              <div className="space-y-3 border-t border-white/[0.06] px-4 pb-4 pt-3 md:px-5">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0 text-[13px] text-white/55">
                                    <p className="truncate">{registration.buyerEmail}</p>
                                    {registration.buyerPhone ? (
                                      <p className="mt-0.5">{registration.buyerPhone}</p>
                                    ) : null}
                                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
                                      {registration.paymentMode}
                                      {registration.isGroup && registration.discountInr
                                        ? ` · −₹${Math.round(registration.discountInr).toLocaleString('en-IN')}`
                                        : ''}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {registration.isGroup && joinHref ? (
                                      <button
                                        type="button"
                                        onClick={() => void copy(joinHref)}
                                        className={wwBtnGhost}
                                      >
                                        <Copy className="h-3.5 w-3.5" />
                                        Join link
                                      </button>
                                    ) : null}
                                    {!cancelled ? (
                                      <>
                                        <button
                                          type="button"
                                          disabled={busy}
                                          onClick={() => startEditReg(registration)}
                                          className={wwBtnGhost}
                                        >
                                          Edit lead
                                        </button>
                                        {registration.amountPaidInr > 0 ? (
                                          <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() => void cancelReg(registration)}
                                            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-[1rem] bg-rose-500/15 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-300 transition-transform duration-100 ease-out active:scale-[0.97] disabled:opacity-45"
                                          >
                                            Cancel
                                          </button>
                                        ) : (
                                          <>
                                            <button
                                              type="button"
                                              disabled={busy}
                                              onClick={() => void cancelReg(registration)}
                                              className={wwBtnGhost}
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              type="button"
                                              disabled={busy}
                                              onClick={() => void deleteReg(registration)}
                                              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-[1rem] bg-rose-500/15 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-300 transition-transform duration-100 ease-out active:scale-[0.97] disabled:opacity-45"
                                            >
                                              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                              Delete
                                            </button>
                                          </>
                                        )}
                                      </>
                                    ) : null}
                                  </div>
                                </div>

                                {editing && !cancelled ? (
                                  <div className="grid gap-2 rounded-[1.15rem] bg-black/35 p-3 sm:grid-cols-2">
                                    <label className="block">
                                      <span className={wwLabel}>Name</span>
                                      <input
                                        className={wwField}
                                        value={editRegForm.buyerName}
                                        onChange={(e) =>
                                          setEditRegForm((f) => ({
                                            ...f,
                                            buyerName: e.target.value,
                                          }))
                                        }
                                      />
                                    </label>
                                    <label className="block">
                                      <span className={wwLabel}>Email</span>
                                      <input
                                        className={wwField}
                                        value={editRegForm.buyerEmail}
                                        onChange={(e) =>
                                          setEditRegForm((f) => ({
                                            ...f,
                                            buyerEmail: e.target.value,
                                          }))
                                        }
                                      />
                                    </label>
                                    <label className="block">
                                      <span className={wwLabel}>Phone</span>
                                      <input
                                        className={wwField}
                                        value={editRegForm.buyerPhone}
                                        onChange={(e) =>
                                          setEditRegForm((f) => ({
                                            ...f,
                                            buyerPhone: e.target.value,
                                          }))
                                        }
                                      />
                                    </label>
                                    <label className="block">
                                      <span className={wwLabel}>City</span>
                                      <input
                                        className={wwField}
                                        value={editRegForm.city}
                                        onChange={(e) =>
                                          setEditRegForm((f) => ({
                                            ...f,
                                            city: e.target.value,
                                          }))
                                        }
                                      />
                                    </label>
                                    <label className="block sm:col-span-2">
                                      <span className={wwLabel}>Notes</span>
                                      <input
                                        className={wwField}
                                        value={editRegForm.notes}
                                        onChange={(e) =>
                                          setEditRegForm((f) => ({
                                            ...f,
                                            notes: e.target.value,
                                          }))
                                        }
                                      />
                                    </label>
                                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => void saveEditReg(registration.id)}
                                        className={wwBtnPrimary}
                                      >
                                        Save
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingRegId(null)}
                                        className={wwBtnGhost}
                                      >
                                        Discard
                                      </button>
                                    </div>
                                  </div>
                                ) : null}

                                {installments.length > 0 ? (
                                  <ul className="space-y-1.5">
                                    {installments.map((inst: WwInstallment) => {
                                      const canRelease =
                                        registration.isGroup &&
                                        !cancelled &&
                                        inst.status === 'due' &&
                                        Boolean(inst.claimedByUserId || inst.claimedByEmail)
                                      const canEditShare =
                                        registration.isGroup &&
                                        !cancelled &&
                                        inst.status === 'due'
                                      const shareEditing = editingShareId === inst.id
                                      return (
                                        <li
                                          key={inst.id}
                                          className="space-y-2 rounded-[1rem] bg-black/35 px-3 py-2.5"
                                        >
                                          <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="min-w-0">
                                              <p className="text-[13px] font-medium text-white/85">
                                                #{inst.sequence}{' '}
                                                {inst.claimedByName || inst.label}
                                              </p>
                                              <p className="mt-0.5 text-[11px] tabular-nums text-white/40">
                                                ₹{Math.round(inst.amountInr).toLocaleString('en-IN')} ·{' '}
                                                {inst.status}
                                                {inst.dueAt ? ` · ${inst.dueAt.slice(0, 10)}` : ''}
                                                {inst.status === 'paid' &&
                                                inst.paymentMethod === 'cash'
                                                  ? ' · cash'
                                                  : ''}
                                                {!inst.claimedByUserId &&
                                                !inst.claimedByEmail &&
                                                registration.isGroup &&
                                                inst.status === 'due'
                                                  ? ' · open seat'
                                                  : ''}
                                              </p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                              {!cancelled && inst.status === 'due' ? (
                                                <button
                                                  type="button"
                                                  disabled={busy}
                                                  onClick={() =>
                                                    void collectCash(
                                                      inst.id,
                                                      `${registration.buyerName} · ${inst.label}`,
                                                    )
                                                  }
                                                  className={`${wwBtnGhost} gap-1.5`}
                                                >
                                                  <Banknote className="h-3.5 w-3.5" />
                                                  Cash
                                                </button>
                                              ) : null}
                                              {canEditShare ? (
                                                <button
                                                  type="button"
                                                  disabled={busy}
                                                  onClick={() => startEditShare(inst)}
                                                  className={wwBtnGhost}
                                                >
                                                  Edit
                                                </button>
                                              ) : null}
                                              {canRelease ? (
                                                <button
                                                  type="button"
                                                  disabled={busy}
                                                  onClick={() =>
                                                    void releaseShare(
                                                      inst.id,
                                                      inst.claimedByName || inst.label,
                                                    )
                                                  }
                                                  className="inline-flex min-h-10 items-center rounded-[1rem] bg-white/[0.06] px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70 transition-transform duration-100 active:scale-[0.97] disabled:opacity-45"
                                                >
                                                  Release
                                                </button>
                                              ) : null}
                                            </div>
                                          </div>
                                          {shareEditing ? (
                                            <div className="grid gap-2 sm:grid-cols-2">
                                              <label className="block">
                                                <span className={wwLabel}>Traveler name</span>
                                                <input
                                                  className={wwField}
                                                  value={editShareForm.claimedByName}
                                                  onChange={(e) =>
                                                    setEditShareForm((f) => ({
                                                      ...f,
                                                      claimedByName: e.target.value,
                                                    }))
                                                  }
                                                />
                                              </label>
                                              <label className="block">
                                                <span className={wwLabel}>Traveler email</span>
                                                <input
                                                  className={wwField}
                                                  value={editShareForm.claimedByEmail}
                                                  onChange={(e) =>
                                                    setEditShareForm((f) => ({
                                                      ...f,
                                                      claimedByEmail: e.target.value,
                                                    }))
                                                  }
                                                />
                                              </label>
                                              <div className="flex flex-wrap gap-2 sm:col-span-2">
                                                <button
                                                  type="button"
                                                  disabled={busy}
                                                  onClick={() => void saveEditShare(inst.id)}
                                                  className={wwBtnPrimary}
                                                >
                                                  Save traveler
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => setEditingShareId(null)}
                                                  className={wwBtnGhost}
                                                >
                                                  Discard
                                                </button>
                                              </div>
                                            </div>
                                          ) : null}
                                        </li>
                                      )
                                    })}
                                  </ul>
                                ) : null}
                              </div>
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </div>
                    )
                  })}
                {!(promoter.rows || []).length && (
                  <p className="p-4 text-sm text-white/40">No attributed bookings yet.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default WwPortal
