import fs from 'fs'
import path from 'path'
import { randomUUID, randomBytes } from 'crypto'
import { normalizeEmail } from '../mail/emailAddress.js'
import type {
  WwAnalytics,
  WwInstallment,
  WwInstallmentStatus,
  WwMember,
  WwMemberRole,
  WwMembership,
  WwOrg,
  WwPaymentMode,
  WwPlanInstallmentTemplate,
  WwPromoterLink,
  WwRegistration,
  WwRegistrationStatus,
  WwSnapshot,
  WwTrip,
  WwTripPublic,
  WwTripStatus,
} from './types.js'

const ORG_SLUG = 'wanderworld'

function forceFileMode() {
  return true // v1: file store; migration 017 ready for later supabase
}

function filePath() {
  return path.join(process.cwd(), 'data', 'wanderworld_store.json')
}

function nowIso() {
  return new Date().toISOString()
}

function defaultOrg(): WwOrg {
  return {
    id: randomUUID(),
    name: 'WanderWorld',
    slug: ORG_SLUG,
    createdAt: nowIso(),
  }
}

function emptySnapshot(): WwSnapshot {
  return {
    org: defaultOrg(),
    members: [],
    trips: [],
    promoterLinks: [],
    registrations: [],
    installments: [],
  }
}

type WwTripNormalized = WwTrip & {
  groupBookingEnabled: boolean
  groupSeats: number
  groupSeatsTaken: number
  groupDiscountType: 'percent' | 'flat_per_seat'
  groupDiscountValue: number
  groupMinSize: number
  groupMaxSize: number
}

function normalizeTrip(t: WwTrip): WwTripNormalized {
  return {
    ...t,
    groupBookingEnabled: Boolean(t.groupBookingEnabled),
    groupSeats: Math.max(0, Math.floor(Number(t.groupSeats) || 0)),
    groupSeatsTaken: Math.max(0, Math.floor(Number(t.groupSeatsTaken) || 0)),
    groupDiscountType: t.groupDiscountType === 'flat_per_seat' ? 'flat_per_seat' : 'percent',
    groupDiscountValue: Math.max(0, Number(t.groupDiscountValue) || 0),
    groupMinSize: Math.max(2, Math.floor(Number(t.groupMinSize) || 2)),
    groupMaxSize: Math.max(2, Math.floor(Number(t.groupMaxSize) || 20)),
  }
}

function readStore(): WwSnapshot {
  const p = filePath()
  try {
    if (!fs.existsSync(p)) {
      const snap = emptySnapshot()
      writeStore(snap)
      return snap
    }
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as WwSnapshot
    if (!raw.org) raw.org = defaultOrg()
    if (!Array.isArray(raw.members)) raw.members = []
    if (!Array.isArray(raw.trips)) raw.trips = []
    else raw.trips = raw.trips.map((t) => normalizeTrip(t))
    if (!Array.isArray(raw.promoterLinks)) raw.promoterLinks = []
    if (!Array.isArray(raw.registrations)) raw.registrations = []
    if (!Array.isArray(raw.installments)) raw.installments = []
    return raw
  } catch {
    const snap = emptySnapshot()
    writeStore(snap)
    return snap
  }
}

function writeStore(snap: WwSnapshot) {
  fs.mkdirSync(path.dirname(filePath()), { recursive: true })
  fs.writeFileSync(filePath(), JSON.stringify(snap, null, 2))
}

function mutate<T>(fn: (snap: WwSnapshot) => T): T {
  const snap = readStore()
  const result = fn(snap)
  writeStore(snap)
  return result
}

export function wwBackendMode() {
  return forceFileMode() ? 'file' : 'file'
}

function slugify(title: string) {
  const base = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return base || 'trip'
}

function uniqueTripSlug(snap: WwSnapshot, title: string, excludeId?: string) {
  let base = slugify(title)
  let candidate = base
  let i = 2
  while (snap.trips.some((t) => t.slug === candidate && t.id !== excludeId)) {
    candidate = `${base}-${i++}`
  }
  return candidate
}

function randomCode(len = 8) {
  return randomBytes(Math.ceil(len / 2))
    .toString('hex')
    .slice(0, len)
    .toUpperCase()
}

export function getOrg(): WwOrg {
  return readStore().org
}

export async function membershipsForIdentity(opts: {
  userId?: string | null
  email?: string | null
}): Promise<WwMembership[]> {
  const snap = readStore()
  const email = opts.email ? normalizeEmail(opts.email) : ''
  const rows = snap.members.filter(
    (m) =>
      (opts.userId && m.userId === opts.userId) ||
      (email && m.email === email),
  )
  return rows.map((member) => ({ member, org: snap.org }))
}

export async function attachMemberUser(memberId: string, userId: string): Promise<WwMember | null> {
  return mutate((snap) => {
    const m = snap.members.find((x) => x.id === memberId)
    if (!m) return null
    m.userId = userId
    if (!m.joinedAt) m.joinedAt = nowIso()
    return { ...m }
  })
}

/** Seed first owner only when WANDERWORLD_BOOTSTRAP_EMAIL matches (fail closed if unset). */
export async function maybeBootstrapOwner(email: string, userId: string): Promise<WwMember | null> {
  const boot = normalizeEmail(process.env.WANDERWORLD_BOOTSTRAP_EMAIL || '')
  const emailNorm = normalizeEmail(email)
  if (!emailNorm) return null
  if (!boot) {
    // Never auto-promote the first login. prevents owner hijack on empty store.
    return null
  }
  if (emailNorm !== boot) return null
  return mutate((snap) => {
    if (snap.members.length > 0) return null
    const member: WwMember = {
      id: randomUUID(),
      orgId: snap.org.id,
      email: emailNorm,
      userId,
      role: 'owner',
      invitedAt: nowIso(),
      joinedAt: nowIso(),
    }
    snap.members.push(member)
    console.info('[wanderworld] bootstrapped owner', emailNorm)
    return { ...member }
  })
}

export async function inviteMember(input: {
  email: string
  role: WwMemberRole
}): Promise<WwMember> {
  return mutate((snap) => {
    const email = normalizeEmail(input.email)
    const existing = snap.members.find((m) => m.email === email)
    if (existing) {
      existing.role = input.role
      return { ...existing }
    }
    const member: WwMember = {
      id: randomUUID(),
      orgId: snap.org.id,
      email,
      userId: null,
      role: input.role,
      invitedAt: nowIso(),
      joinedAt: null,
    }
    snap.members.push(member)
    return { ...member }
  })
}

export async function deleteMember(memberId: string): Promise<boolean> {
  return mutate((snap) => {
    const idx = snap.members.findIndex((m) => m.id === memberId)
    if (idx < 0) return false
    const [removed] = snap.members.splice(idx, 1)
    // Drop their promoter links (keep historical registrations).
    snap.promoterLinks = snap.promoterLinks.filter((l) => l.memberId !== removed.id)
    return true
  })
}

export async function listMembers(): Promise<WwMember[]> {
  return readStore().members.map((m) => ({
    ...m,
    assignedTripIds: Array.isArray(m.assignedTripIds) ? [...m.assignedTripIds] : [],
  }))
}

export async function updateMemberProfile(
  memberId: string,
  patch: Partial<{
    displayName: string | null
    phone: string | null
    city: string | null
    bio: string | null
    instagram: string | null
  }>,
): Promise<WwMember | null> {
  return mutate((snap) => {
    const m = snap.members.find((x) => x.id === memberId)
    if (!m) return null
    if (patch.displayName !== undefined) {
      m.displayName = String(patch.displayName || '').trim().slice(0, 80) || null
    }
    if (patch.phone !== undefined) {
      m.phone = String(patch.phone || '').trim().slice(0, 32) || null
    }
    if (patch.city !== undefined) {
      m.city = String(patch.city || '').trim().slice(0, 64) || null
    }
    if (patch.bio !== undefined) {
      m.bio = String(patch.bio || '').trim().slice(0, 400) || null
    }
    if (patch.instagram !== undefined) {
      m.instagram = String(patch.instagram || '')
        .trim()
        .replace(/^@/, '')
        .slice(0, 64) || null
    }
    return { ...m, assignedTripIds: [...(m.assignedTripIds || [])] }
  })
}

/** Admin assigns which trips a promoter can sell / promote. Empty = all trips. */
export async function setMemberTripAssignments(
  memberId: string,
  tripIds: string[],
): Promise<WwMember | null> {
  return mutate((snap) => {
    const m = snap.members.find((x) => x.id === memberId)
    if (!m) return null
    const valid = new Set(snap.trips.map((t) => t.id))
    const next = [...new Set(tripIds.map(String).filter((id) => valid.has(id)))]
    m.assignedTripIds = next

    // Ensure a trip-scoped referral link exists for each assignment
    for (const tripId of next) {
      const existing = snap.promoterLinks.find(
        (l) => l.memberId === memberId && (l.tripId || null) === tripId,
      )
      if (existing) continue
      let code = randomCode(8)
      while (snap.promoterLinks.some((l) => codesForLink(l).includes(code))) code = randomCode(8)
      snap.promoterLinks.push({
        id: randomUUID(),
        orgId: snap.org.id,
        memberId,
        code,
        previousCodes: [],
        tripId,
        clickCount: 0,
        lastClickedAt: null,
        createdAt: nowIso(),
      })
    }
    return { ...m, assignedTripIds: [...next] }
  })
}

export function memberCanAccessTrip(member: WwMember, tripId: string): boolean {
  if (member.role === 'owner' || member.role === 'admin') return true
  const assigned = member.assignedTripIds || []
  if (assigned.length === 0) return true
  return assigned.includes(tripId)
}

export async function listTrips(opts?: { status?: WwTripStatus | 'all' }): Promise<WwTrip[]> {
  const snap = readStore()
  let trips = [...snap.trips]
  if (opts?.status && opts.status !== 'all') {
    trips = trips.filter((t) => t.status === opts.status)
  }
  return trips.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function listPublishedTrips(): Promise<WwTripPublic[]> {
  const trips = await listTrips({ status: 'published' })
  return trips.map((t) => ({
    ...t,
    seatsLeft: Math.max(0, t.seats - t.seatsTaken),
    groupSeatsLeft: Math.max(0, (t.groupSeats || 0) - (t.groupSeatsTaken || 0)),
  }))
}

export async function getTrip(idOrSlug: string): Promise<WwTrip | null> {
  const snap = readStore()
  return snap.trips.find((t) => t.id === idOrSlug || t.slug === idOrSlug) || null
}

export async function getPublishedTrip(slug: string): Promise<WwTripPublic | null> {
  const t = await getTrip(slug)
  if (!t || t.status !== 'published') return null
  return { ...t, seatsLeft: Math.max(0, t.seats - t.seatsTaken), groupSeatsLeft: Math.max(0, (t.groupSeats || 0) - (t.groupSeatsTaken || 0)) }
}

export async function createTrip(input: {
  title: string
  description?: string
  itinerary?: string
  priceInr: number
  seats: number
  startDate: string
  endDate: string
  coverImageUrl?: string | null
  paymentPlansEnabled?: boolean
  planTemplate?: WwPlanInstallmentTemplate[]
}): Promise<WwTrip> {
  return mutate((snap) => {
    const ts = nowIso()
    const trip: WwTrip = {
      id: randomUUID(),
      orgId: snap.org.id,
      title: String(input.title || '').trim(),
      slug: uniqueTripSlug(snap, input.title),
      description: String(input.description || ''),
      itinerary: String(input.itinerary || ''),
      priceInr: Math.max(0, Number(input.priceInr) || 0),
      seats: Math.max(1, Math.floor(Number(input.seats) || 1)),
      seatsTaken: 0,
      startDate: String(input.startDate || '').slice(0, 10),
      endDate: String(input.endDate || '').slice(0, 10),
      coverImageUrl: input.coverImageUrl || null,
      status: 'draft',
      paymentPlansEnabled: Boolean(input.paymentPlansEnabled),
      planTemplate:
        input.planTemplate && input.planTemplate.length > 0
          ? input.planTemplate
          : [
              { percent: 0.3, daysBeforeStart: null, label: 'Booking deposit' },
              { percent: 0.7, daysBeforeStart: 14, label: 'Balance' },
            ],
      groupBookingEnabled: false,
      groupSeats: 0,
      groupSeatsTaken: 0,
      groupDiscountType: 'percent',
      groupDiscountValue: 0,
      groupMinSize: 2,
      groupMaxSize: 20,
      createdAt: ts,
      updatedAt: ts,
    }
    snap.trips.push(trip)
    return { ...trip }
  })
}

export async function updateTrip(
  id: string,
  patch: Partial<{
    title: string
    description: string
    itinerary: string
    priceInr: number
    seats: number
    startDate: string
    endDate: string
    coverImageUrl: string | null
    status: WwTripStatus
    paymentPlansEnabled: boolean
    planTemplate: WwPlanInstallmentTemplate[]
    groupBookingEnabled: boolean
    groupSeats: number
    groupDiscountType: 'percent' | 'flat_per_seat'
    groupDiscountValue: number
    groupMinSize: number
    groupMaxSize: number
  }>,
): Promise<WwTrip | null> {
  return mutate((snap) => {
    const trip = snap.trips.find((t) => t.id === id)
    if (!trip) return null
    if (patch.title != null) {
      trip.title = String(patch.title).trim()
      trip.slug = uniqueTripSlug(snap, trip.title, trip.id)
    }
    if (patch.description != null) trip.description = String(patch.description)
    if (patch.itinerary != null) trip.itinerary = String(patch.itinerary)
    if (patch.priceInr != null) trip.priceInr = Math.max(0, Number(patch.priceInr) || 0)
    if (patch.seats != null) trip.seats = Math.max(trip.seatsTaken, Math.floor(Number(patch.seats) || 1))
    if (patch.startDate != null) trip.startDate = String(patch.startDate).slice(0, 10)
    if (patch.endDate != null) trip.endDate = String(patch.endDate).slice(0, 10)
    if (patch.coverImageUrl !== undefined) trip.coverImageUrl = patch.coverImageUrl
    if (patch.status != null) trip.status = patch.status
    if (patch.paymentPlansEnabled != null) trip.paymentPlansEnabled = Boolean(patch.paymentPlansEnabled)
    if (patch.planTemplate != null) trip.planTemplate = patch.planTemplate
    if (patch.groupBookingEnabled != null) trip.groupBookingEnabled = Boolean(patch.groupBookingEnabled)
    if (patch.groupSeats != null) {
      const taken = Math.max(0, Math.floor(Number(trip.groupSeatsTaken) || 0))
      trip.groupSeats = Math.max(taken, Math.floor(Number(patch.groupSeats) || 0))
    }
    if (patch.groupDiscountType != null) {
      trip.groupDiscountType = patch.groupDiscountType === 'flat_per_seat' ? 'flat_per_seat' : 'percent'
    }
    if (patch.groupDiscountValue != null) {
      trip.groupDiscountValue = Math.max(0, Number(patch.groupDiscountValue) || 0)
    }
    if (patch.groupMinSize != null) {
      trip.groupMinSize = Math.max(2, Math.floor(Number(patch.groupMinSize) || 2))
    }
    if (patch.groupMaxSize != null) {
      trip.groupMaxSize = Math.max(trip.groupMinSize || 2, Math.floor(Number(patch.groupMaxSize) || 20))
    }
    trip.updatedAt = nowIso()
    return { ...normalizeTrip(trip) }
  })
}

/** Hard-delete a trip and cascade registrations, installments, and trip-scoped promoter links. */
export async function deleteTrip(id: string): Promise<boolean> {
  return mutate((snap) => {
    const idx = snap.trips.findIndex((t) => t.id === id)
    if (idx < 0) return false
    const regIds = new Set(
      snap.registrations.filter((r) => r.tripId === id).map((r) => r.id),
    )
    snap.installments = snap.installments.filter((i) => !regIds.has(i.registrationId))
    snap.registrations = snap.registrations.filter((r) => r.tripId !== id)
    snap.promoterLinks = snap.promoterLinks.filter((l) => l.tripId !== id)
    snap.trips.splice(idx, 1)
    return true
  })
}

function codesForLink(link: WwPromoterLink): string[] {
  const set = new Set<string>([link.code, ...(link.previousCodes || [])])
  return [...set].filter(Boolean)
}

/** Public referral IDs: 3 to 24 chars, A to Z / 0 to 9 / _ / - */
export function normalizeReferralCode(raw: string): string | null {
  const c = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
  if (!/^[A-Z0-9_-]{3,24}$/.test(c)) return null
  return c
}

export async function ensurePromoterLink(memberId: string, tripId?: string | null): Promise<WwPromoterLink> {
  return mutate((snap) => {
    const existing = snap.promoterLinks.find(
      (l) => l.memberId === memberId && (l.tripId || null) === (tripId || null),
    )
    if (existing) return { ...existing }
    let code = randomCode(8)
    while (snap.promoterLinks.some((l) => codesForLink(l).includes(code))) code = randomCode(8)
    const link: WwPromoterLink = {
      id: randomUUID(),
      orgId: snap.org.id,
      memberId,
      code,
      previousCodes: [],
      tripId: tripId || null,
      clickCount: 0,
      lastClickedAt: null,
      createdAt: nowIso(),
    }
    snap.promoterLinks.push(link)
    return { ...link }
  })
}

export async function updatePromoterLinkCode(opts: {
  memberId: string
  linkId?: string | null
  code: string
  /** When true, any team admin can edit any member's link */
  asAdmin?: boolean
}): Promise<{ link: WwPromoterLink } | { error: string }> {
  const next = normalizeReferralCode(opts.code)
  if (!next) {
    return { error: 'Referral ID must be 3 to 24 characters (letters, numbers, _ or -)' }
  }
  return mutate((snap) => {
    const link = opts.linkId
      ? snap.promoterLinks.find((l) => l.id === opts.linkId)
      : snap.promoterLinks.find((l) => l.memberId === opts.memberId && !l.tripId) ||
        snap.promoterLinks.find((l) => l.memberId === opts.memberId)
    if (!link) return { error: 'Promoter link not found' }
    if (!opts.asAdmin && link.memberId !== opts.memberId) {
      return { error: 'Forbidden' }
    }
    const taken = snap.promoterLinks.some(
      (l) => l.id !== link.id && codesForLink(l).includes(next),
    )
    if (taken) return { error: 'That referral ID is already taken' }
    const old = link.code
    if (old === next) return { link: { ...link } }
    const prev = new Set(link.previousCodes || [])
    prev.add(old)
    prev.delete(next)
    link.previousCodes = [...prev]
    link.code = next
    // Keep attribution continuous for dashboards
    for (const reg of snap.registrations) {
      if (reg.promoterCode === old) reg.promoterCode = next
    }
    return { link: { ...link } }
  })
}

export async function recordPromoterClick(code: string): Promise<WwPromoterLink | null> {
  const c = normalizeReferralCode(code) || String(code || '').trim().toUpperCase()
  if (!c) return null
  return mutate((snap) => {
    const link = snap.promoterLinks.find((l) => codesForLink(l).includes(c))
    if (!link) return null
    link.clickCount = (link.clickCount || 0) + 1
    link.lastClickedAt = nowIso()
    return { ...link }
  })
}

export async function resolvePromoterCode(code: string): Promise<WwPromoterLink | null> {
  const c = normalizeReferralCode(code) || String(code || '').trim().toUpperCase()
  if (!c) return null
  return readStore().promoterLinks.find((l) => codesForLink(l).includes(c)) || null
}

export async function listPromoterLinks(memberId?: string): Promise<WwPromoterLink[]> {
  const snap = readStore()
  const links = memberId
    ? snap.promoterLinks.filter((l) => l.memberId === memberId)
    : snap.promoterLinks
  return links.map((l) => ({ ...l }))
}

function dueDateForTemplate(
  tripStart: string,
  tmpl: WwPlanInstallmentTemplate,
  index: number,
): string {
  if (index === 0 || tmpl.daysBeforeStart == null) return nowIso()
  const start = new Date(`${tripStart}T12:00:00.000Z`)
  const days = Number(tmpl.daysBeforeStart) || 0
  start.setUTCDate(start.getUTCDate() - days)
  return start.toISOString()
}

export async function findActiveRegistrationForUserTrip(
  userId: string,
  tripId: string,
): Promise<WwRegistration | null> {
  const row = readStore().registrations.find(
    (r) => r.userId === userId && r.tripId === tripId && r.status !== 'cancelled',
  )
  return row ? { ...row } : null
}

export async function createRegistration(input: {
  tripId: string
  userId: string
  buyerEmail: string
  buyerName: string
  buyerPhone?: string | null
  promoterCode?: string | null
  paymentMode: WwPaymentMode
  notes?: string | null
  city?: string | null
  groupSize?: number | null
}): Promise<
  | { registration: WwRegistration; installments: WwInstallment[]; trip: WwTrip }
  | { error: 'not_found' | 'sold_out' | 'already_booked' }
> {
  return mutate((snap) => {
    const trip = snap.trips.find((t) => t.id === input.tripId)
    if (!trip || trip.status !== 'published') return { error: 'not_found' as const }
    if (trip.seatsTaken >= trip.seats) return { error: 'sold_out' as const }

    const already = snap.registrations.find(
      (r) =>
        r.userId === input.userId &&
        r.tripId === input.tripId &&
        r.status !== 'cancelled',
    )
    if (already) return { error: 'already_booked' as const }

    const mode: WwPaymentMode =
      input.paymentMode === 'plan' && trip.paymentPlansEnabled ? 'plan' : 'full'
    const ts = nowIso()
    const reg: WwRegistration = {
      id: randomUUID(),
      orgId: snap.org.id,
      tripId: trip.id,
      userId: input.userId,
      buyerEmail: normalizeEmail(input.buyerEmail),
      buyerName: String(input.buyerName || '').trim() || 'Guest',
      buyerPhone: input.buyerPhone || null,
      promoterCode: input.promoterCode
        ? normalizeReferralCode(input.promoterCode) || String(input.promoterCode).trim().toUpperCase()
        : null,
      paymentMode: mode,
      status: 'pending',
      amountDueInr: trip.priceInr,
      amountPaidInr: 0,
      notes: input.notes || null,
      city: input.city || null,
      groupSize: input.groupSize ?? null,
      createdAt: ts,
      updatedAt: ts,
    }
    snap.registrations.push(reg)

    const installments: WwInstallment[] = []
    if (mode === 'full') {
      installments.push({
        id: randomUUID(),
        registrationId: reg.id,
        sequence: 1,
        label: 'Full payment',
        amountInr: trip.priceInr,
        dueAt: ts,
        status: 'due',
      })
    } else {
      const template = trip.planTemplate.length
        ? trip.planTemplate
        : [
            { percent: 0.3, daysBeforeStart: null, label: 'Booking deposit' },
            { percent: 0.7, daysBeforeStart: 14, label: 'Balance' },
          ]
      let allocated = 0
      template.forEach((tmpl, i) => {
        const isLast = i === template.length - 1
        const amount = isLast
          ? Math.round((trip.priceInr - allocated) * 100) / 100
          : Math.round(trip.priceInr * tmpl.percent * 100) / 100
        allocated += amount
        installments.push({
          id: randomUUID(),
          registrationId: reg.id,
          sequence: i + 1,
          label: tmpl.label || `Installment ${i + 1}`,
          amountInr: amount,
          dueAt: dueDateForTemplate(trip.startDate, tmpl, i),
          status: 'due',
        })
      })
    }
    snap.installments.push(...installments)
    trip.seatsTaken += 1
    trip.updatedAt = ts
    return { registration: { ...reg }, installments: installments.map((i) => ({ ...i })), trip: { ...trip } }
  })
}

export function computeGroupPricing(
  trip: WwTrip,
  groupSize: number,
): { listPriceInr: number; discountInr: number; amountDueInr: number } {
  const size = Math.max(1, Math.floor(groupSize))
  const listPriceInr = Math.round(trip.priceInr * size * 100) / 100
  const dtype = trip.groupDiscountType === 'flat_per_seat' ? 'flat_per_seat' : 'percent'
  const dval = Math.max(0, Number(trip.groupDiscountValue) || 0)
  let discountInr = 0
  if (dtype === 'percent') {
    discountInr = Math.round(listPriceInr * Math.min(100, dval) * 0.01 * 100) / 100
  } else {
    discountInr = Math.round(Math.min(listPriceInr, dval * size) * 100) / 100
  }
  const amountDueInr = Math.max(0, Math.round((listPriceInr - discountInr) * 100) / 100)
  return { listPriceInr, discountInr, amountDueInr }
}

export async function listGroupBookableTrips(member?: WwMember | null): Promise<
  (WwTrip & { seatsLeft: number; groupSeatsLeft: number })[]
> {
  const trips = await listTrips({ status: 'published' })
  return trips
    .filter((t) => t.groupBookingEnabled && (t.groupSeats || 0) > 0)
    .filter((t) => !member || memberCanAccessTrip(member, t.id))
    .map((t) => ({
      ...t,
      seatsLeft: Math.max(0, t.seats - t.seatsTaken),
      groupSeatsLeft: Math.max(0, (t.groupSeats || 0) - (t.groupSeatsTaken || 0)),
    }))
}

/** Promoter/admin group booking. reserves N seats; creates N per-seat shares + join link. */
export async function createGroupRegistration(input: {
  tripId: string
  userId: string
  bookedByMemberId: string
  buyerEmail: string
  buyerName: string
  buyerPhone?: string | null
  promoterCode?: string | null
  paymentMode: WwPaymentMode
  groupSize: number
  notes?: string | null
  city?: string | null
}): Promise<
  | { registration: WwRegistration; installments: WwInstallment[]; trip: WwTrip }
  | {
      error:
        | 'not_found'
        | 'group_disabled'
        | 'invalid_size'
        | 'group_sold_out'
        | 'sold_out'
    }
> {
  return mutate((snap) => {
    const trip = snap.trips.find((t) => t.id === input.tripId)
    if (!trip || trip.status !== 'published') return { error: 'not_found' as const }
    const nt = normalizeTrip(trip)
    if (!nt.groupBookingEnabled || nt.groupSeats <= 0) return { error: 'group_disabled' as const }

    const size = Math.floor(Number(input.groupSize) || 0)
    if (size < nt.groupMinSize || size > nt.groupMaxSize) return { error: 'invalid_size' as const }

    const groupLeft = Math.max(0, nt.groupSeats - nt.groupSeatsTaken)
    if (size > groupLeft) return { error: 'group_sold_out' as const }
    if (trip.seatsTaken + size > trip.seats) return { error: 'sold_out' as const }

    const pricing = computeGroupPricing(nt, size)
    // Group join/pay uses equal per-seat shares (plan templates don't apply to shares).
    const mode: WwPaymentMode = 'full'
    const perSeatInr =
      size > 0 ? Math.round((pricing.amountDueInr / size) * 100) / 100 : pricing.amountDueInr
    // Fix remainder on last share so seats sum to amountDueInr
    let allocated = 0
    const seatAmounts: number[] = []
    for (let i = 0; i < size; i++) {
      const isLast = i === size - 1
      const amt = isLast
        ? Math.round((pricing.amountDueInr - allocated) * 100) / 100
        : perSeatInr
      allocated += amt
      seatAmounts.push(amt)
    }

    let joinCode = `G${randomCode(7)}`
    while (snap.registrations.some((r) => r.joinCode === joinCode)) joinCode = `G${randomCode(7)}`

    const ts = nowIso()
    const leadEmail = normalizeEmail(input.buyerEmail)
    const leadName = String(input.buyerName || '').trim() || 'Group lead'
    const reg: WwRegistration = {
      id: randomUUID(),
      orgId: snap.org.id,
      tripId: trip.id,
      // Lead attaches when they open the join link; promoter userId is not the buyer.
      userId: `group:${joinCode}`,
      buyerEmail: leadEmail,
      buyerName: leadName,
      buyerPhone: input.buyerPhone || null,
      promoterCode: input.promoterCode
        ? normalizeReferralCode(input.promoterCode) || String(input.promoterCode).trim().toUpperCase()
        : null,
      paymentMode: mode,
      status: 'pending',
      amountDueInr: pricing.amountDueInr,
      amountPaidInr: 0,
      notes: input.notes || null,
      city: input.city || null,
      groupSize: size,
      isGroup: true,
      joinCode,
      perSeatInr,
      listPriceInr: pricing.listPriceInr,
      discountInr: pricing.discountInr,
      bookedByMemberId: input.bookedByMemberId,
      createdAt: ts,
      updatedAt: ts,
    }
    snap.registrations.push(reg)

    const installments: WwInstallment[] = seatAmounts.map((amountInr, i) => ({
      id: randomUUID(),
      registrationId: reg.id,
      sequence: i + 1,
      label: `Group share ${i + 1}/${size}`,
      amountInr,
      dueAt: ts,
      status: 'due' as const,
      // Reserve first share for the lead (email); they claim userId via join link.
      claimedByUserId: null,
      claimedByEmail: i === 0 ? leadEmail : null,
      claimedByName: i === 0 ? leadName : null,
      claimedAt: i === 0 ? ts : null,
    }))
    snap.installments.push(...installments)
    trip.seatsTaken += size
    trip.groupSeatsTaken = (trip.groupSeatsTaken || 0) + size
    trip.updatedAt = ts
    return {
      registration: { ...reg },
      installments: installments.map((i) => ({ ...i })),
      trip: { ...normalizeTrip(trip) },
    }
  })
}

export async function getGroupByJoinCode(code: string): Promise<{
  registration: WwRegistration
  trip: WwTrip
  installments: WwInstallment[]
} | null> {
  const c = String(code || '').trim().toUpperCase()
  if (!c) return null
  const snap = readStore()
  const registration = snap.registrations.find(
    (r) => r.isGroup && r.joinCode && r.joinCode.toUpperCase() === c && r.status !== 'cancelled',
  )
  if (!registration) return null
  const trip = snap.trips.find((t) => t.id === registration.tripId)
  if (!trip) return null
  const installments = snap.installments
    .filter((i) => i.registrationId === registration.id)
    .sort((a, b) => a.sequence - b.sequence)
    .map((i) => ({ ...i }))
  return { registration: { ...registration }, trip: { ...normalizeTrip(trip) }, installments }
}

/** Claim an open (or email-reserved) group share for the signed-in user. */
export async function joinGroupShare(opts: {
  joinCode: string
  userId: string
  email: string
  name?: string | null
}): Promise<
  | {
      registration: WwRegistration
      trip: WwTrip
      installment: WwInstallment
      installments: WwInstallment[]
      alreadyJoined: boolean
    }
  | {
      error: 'not_found' | 'cancelled' | 'full' | 'already_on_trip'
    }
> {
  return mutate((snap) => {
    const c = String(opts.joinCode || '').trim().toUpperCase()
    const reg = snap.registrations.find(
      (r) => r.isGroup && r.joinCode && r.joinCode.toUpperCase() === c,
    )
    if (!reg) return { error: 'not_found' as const }
    if (reg.status === 'cancelled') return { error: 'cancelled' as const }
    const trip = snap.trips.find((t) => t.id === reg.tripId)
    if (!trip) return { error: 'not_found' as const }

    const email = normalizeEmail(opts.email)
    const name = String(opts.name || '').trim() || email.split('@')[0] || 'Guest'
    const shares = snap.installments
      .filter((i) => i.registrationId === reg.id)
      .sort((a, b) => a.sequence - b.sequence)

    const mine = shares.find((i) => i.claimedByUserId === opts.userId)
    if (mine) {
      return {
        registration: { ...reg },
        trip: { ...normalizeTrip(trip) },
        installment: { ...mine },
        installments: shares.map((i) => ({ ...i })),
        alreadyJoined: true,
      }
    }

    // Don't let the same user hold two seats via another solo booking + group
    const otherActive = snap.registrations.find(
      (r) =>
        r.id !== reg.id &&
        r.tripId === reg.tripId &&
        r.status !== 'cancelled' &&
        (r.userId === opts.userId ||
          snap.installments.some(
            (i) => i.registrationId === r.id && i.claimedByUserId === opts.userId,
          )),
    )
    if (otherActive) return { error: 'already_on_trip' as const }

    const byEmail = shares.find(
      (i) =>
        i.status !== 'cancelled' &&
        !i.claimedByUserId &&
        i.claimedByEmail &&
        i.claimedByEmail.toLowerCase() === email,
    )
    const open = shares.find(
      (i) => i.status !== 'cancelled' && i.status !== 'paid' && !i.claimedByUserId && !i.claimedByEmail,
    )
    const target = byEmail || open
    if (!target) return { error: 'full' as const }

    const ts = nowIso()
    target.claimedByUserId = opts.userId
    target.claimedByEmail = email
    target.claimedByName = name
    target.claimedAt = ts

    // Attach lead as primary buyer when they claim their reserved share
    if (
      (reg.userId.startsWith('group:') || !reg.userId) &&
      reg.buyerEmail.toLowerCase() === email
    ) {
      reg.userId = opts.userId
      reg.buyerName = name
      reg.updatedAt = ts
    }

    return {
      registration: { ...reg },
      trip: { ...normalizeTrip(trip) },
      installment: { ...target },
      installments: shares.map((i) => ({ ...i })),
      alreadyJoined: false,
    }
  })
}

export function userCanPayInstallment(
  userId: string,
  reg: WwRegistration,
  installment: WwInstallment,
): boolean {
  if (reg.userId === userId) return true
  if (installment.claimedByUserId === userId) return true
  return false
}

export async function ensureGroupJoinCode(registrationId: string): Promise<string | null> {
  return mutate((snap) => {
    const reg = snap.registrations.find((r) => r.id === registrationId)
    if (!reg || !reg.isGroup) return null
    if (reg.joinCode) return reg.joinCode
    let joinCode = `G${randomCode(7)}`
    while (snap.registrations.some((r) => r.joinCode === joinCode)) joinCode = `G${randomCode(7)}`
    reg.joinCode = joinCode
    if (!reg.perSeatInr && reg.groupSize && reg.groupSize > 0) {
      reg.perSeatInr = Math.round((reg.amountDueInr / reg.groupSize) * 100) / 100
    }
    reg.updatedAt = nowIso()
    return joinCode
  })
}

export async function getRegistration(id: string): Promise<WwRegistration | null> {
  return readStore().registrations.find((r) => r.id === id) || null
}

export async function getInstallment(id: string): Promise<WwInstallment | null> {
  return readStore().installments.find((i) => i.id === id) || null
}

export async function installmentsForRegistration(registrationId: string): Promise<WwInstallment[]> {
  return readStore()
    .installments.filter((i) => i.registrationId === registrationId)
    .sort((a, b) => a.sequence - b.sequence)
    .map((i) => ({ ...i }))
}

export async function registrationsForUser(userId: string): Promise<
  { registration: WwRegistration; trip: WwTrip | null; installments: WwInstallment[] }[]
> {
  const snap = readStore()
  const claimedRegIds = new Set(
    snap.installments.filter((i) => i.claimedByUserId === userId).map((i) => i.registrationId),
  )
  return snap.registrations
    .filter((r) => r.userId === userId || claimedRegIds.has(r.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((registration) => ({
      registration: { ...registration },
      trip: snap.trips.find((t) => t.id === registration.tripId) || null,
      installments: snap.installments
        .filter((i) => i.registrationId === registration.id)
        .sort((a, b) => a.sequence - b.sequence)
        .map((i) => ({ ...i })),
    }))
}

export async function listRegistrations(opts?: {
  tripId?: string
  promoterCode?: string
}): Promise<
  { registration: WwRegistration; trip: WwTrip | null; installments: WwInstallment[] }[]
> {
  const snap = readStore()
  let regs = [...snap.registrations]
  if (opts?.tripId) regs = regs.filter((r) => r.tripId === opts.tripId)
  if (opts?.promoterCode) {
    const c = opts.promoterCode.toUpperCase()
    regs = regs.filter((r) => r.promoterCode === c)
  }
  return regs
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((registration) => ({
      registration: { ...registration },
      trip: snap.trips.find((t) => t.id === registration.tripId) || null,
      installments: snap.installments
        .filter((i) => i.registrationId === registration.id)
        .sort((a, b) => a.sequence - b.sequence)
        .map((i) => ({ ...i })),
    }))
}

/** Cancel a registration: free seat, cancel unpaid installments. Paid amounts stay for history. */
export async function cancelRegistration(
  id: string,
): Promise<
  | { registration: WwRegistration; installments: WwInstallment[]; trip: WwTrip | null }
  | { error: 'not_found' | 'already_cancelled' }
> {
  return mutate((snap) => {
    const reg = snap.registrations.find((r) => r.id === id)
    if (!reg) return { error: 'not_found' as const }
    if (reg.status === 'cancelled') return { error: 'already_cancelled' as const }

    const wasActive = true
    reg.status = 'cancelled'
    reg.updatedAt = nowIso()

    for (const inst of snap.installments) {
      if (inst.registrationId !== reg.id) continue
      if (inst.status === 'paid') continue
      inst.status = 'cancelled'
    }

    if (wasActive) {
      const trip = snap.trips.find((t) => t.id === reg.tripId)
      if (trip) {
        const seats = reg.isGroup && reg.groupSize && reg.groupSize > 0 ? reg.groupSize : 1
        trip.seatsTaken = Math.max(0, trip.seatsTaken - seats)
        if (reg.isGroup) {
          trip.groupSeatsTaken = Math.max(0, (trip.groupSeatsTaken || 0) - seats)
        }
        trip.updatedAt = nowIso()
      }
    }

    const installments = snap.installments
      .filter((i) => i.registrationId === reg.id)
      .sort((a, b) => a.sequence - b.sequence)
      .map((i) => ({ ...i }))
    const trip = snap.trips.find((t) => t.id === reg.tripId) || null
    return {
      registration: { ...reg },
      installments,
      trip: trip ? { ...trip } : null,
    }
  })
}

/** Whether this WW member may manage (cancel/edit/cash) a registration. */
export function memberOwnsRegistration(member: WwMember, reg: WwRegistration): boolean {
  if (member.role === 'owner' || member.role === 'admin') return true
  if (reg.bookedByMemberId && reg.bookedByMemberId === member.id) return true
  const snap = readStore()
  const links = snap.promoterLinks.filter((l) => l.memberId === member.id)
  const codes = new Set(links.flatMap((l) => codesForLink(l)))
  return Boolean(reg.promoterCode && codes.has(reg.promoterCode))
}

export async function updateRegistrationDetails(
  id: string,
  patch: {
    buyerName?: string
    buyerEmail?: string
    buyerPhone?: string | null
    notes?: string | null
    city?: string | null
  },
): Promise<WwRegistration | null> {
  return mutate((snap) => {
    const reg = snap.registrations.find((r) => r.id === id)
    if (!reg || reg.status === 'cancelled') return null
    if (patch.buyerName != null) {
      const name = String(patch.buyerName).trim()
      if (name) reg.buyerName = name
    }
    if (patch.buyerEmail != null) {
      const email = normalizeEmail(patch.buyerEmail)
      if (email) reg.buyerEmail = email
    }
    if (patch.buyerPhone !== undefined) {
      reg.buyerPhone = patch.buyerPhone ? String(patch.buyerPhone).trim() : null
    }
    if (patch.notes !== undefined) {
      reg.notes = patch.notes ? String(patch.notes).trim().slice(0, 500) : null
    }
    if (patch.city !== undefined) {
      reg.city = patch.city ? String(patch.city).trim() : null
    }
    reg.updatedAt = nowIso()
    return { ...reg }
  })
}

/** Release an unpaid, claimed group share so another traveler can take it. */
export async function releaseGroupShare(opts: {
  installmentId: string
}): Promise<
  | { installment: WwInstallment; registration: WwRegistration }
  | { error: string }
> {
  return mutate((snap) => {
    const inst = snap.installments.find((i) => i.id === opts.installmentId)
    if (!inst) return { error: 'Share not found' }
    if (inst.status === 'paid') return { error: 'Cannot release a paid share' }
    if (inst.status === 'cancelled') return { error: 'Share already cancelled' }
    const reg = snap.registrations.find((r) => r.id === inst.registrationId)
    if (!reg || !reg.isGroup) return { error: 'Not a group booking' }
    if (reg.status === 'cancelled') return { error: 'Group booking cancelled' }

    inst.claimedByUserId = null
    inst.claimedByEmail = null
    inst.claimedByName = null
    inst.claimedAt = null
    inst.razorpayOrderId = null
    return { installment: { ...inst }, registration: { ...reg } }
  })
}

/** Update traveler name/email on an unpaid group share. */
export async function updateGroupShareDetails(opts: {
  installmentId: string
  claimedByName?: string | null
  claimedByEmail?: string | null
}): Promise<
  | { installment: WwInstallment; registration: WwRegistration }
  | { error: string }
> {
  return mutate((snap) => {
    const inst = snap.installments.find((i) => i.id === opts.installmentId)
    if (!inst) return { error: 'Share not found' }
    if (inst.status === 'paid') return { error: 'Cannot edit a paid share' }
    if (inst.status === 'cancelled') return { error: 'Share cancelled' }
    const reg = snap.registrations.find((r) => r.id === inst.registrationId)
    if (!reg || !reg.isGroup) return { error: 'Not a group booking' }
    if (reg.status === 'cancelled') return { error: 'Group booking cancelled' }

    if (opts.claimedByName !== undefined) {
      const name = opts.claimedByName ? String(opts.claimedByName).trim().slice(0, 80) : null
      inst.claimedByName = name
      if (name && !inst.claimedAt) inst.claimedAt = nowIso()
    }
    if (opts.claimedByEmail !== undefined) {
      const email = opts.claimedByEmail ? normalizeEmail(opts.claimedByEmail) : null
      inst.claimedByEmail = email || null
      if (email && !inst.claimedAt) inst.claimedAt = nowIso()
    }
    // Keep lead registration in sync when editing seat #1.
    if (inst.sequence === 1) {
      if (inst.claimedByName) reg.buyerName = inst.claimedByName
      if (inst.claimedByEmail) reg.buyerEmail = inst.claimedByEmail
      reg.updatedAt = nowIso()
    }
    return { installment: { ...inst }, registration: { ...reg } }
  })
}

/**
 * Hard-delete an unpaid booking (no cash/online collected yet).
 * Use cancelRegistration when money was already recorded.
 */
export async function deleteRegistration(id: string): Promise<
  | { deleted: true; trip: WwTrip | null }
  | { error: 'not_found' | 'has_payments' | 'already_cancelled' }
> {
  return mutate((snap) => {
    const idx = snap.registrations.findIndex((r) => r.id === id)
    if (idx < 0) return { error: 'not_found' as const }
    const reg = snap.registrations[idx]
    if (reg.status === 'cancelled') return { error: 'already_cancelled' as const }
    if (reg.amountPaidInr > 0) return { error: 'has_payments' as const }
    const paidSibling = snap.installments.some(
      (i) => i.registrationId === reg.id && i.status === 'paid',
    )
    if (paidSibling) return { error: 'has_payments' as const }

    const seats = reg.isGroup && reg.groupSize && reg.groupSize > 0 ? reg.groupSize : 1
    const trip = snap.trips.find((t) => t.id === reg.tripId) || null
    if (trip) {
      trip.seatsTaken = Math.max(0, trip.seatsTaken - seats)
      if (reg.isGroup) {
        trip.groupSeatsTaken = Math.max(0, (trip.groupSeatsTaken || 0) - seats)
      }
      trip.updatedAt = nowIso()
    }

    snap.registrations.splice(idx, 1)
    snap.installments = snap.installments.filter((i) => i.registrationId !== id)
    return { deleted: true as const, trip: trip ? { ...trip } : null }
  })
}

export async function patchInstallment(
  id: string,
  patch: Partial<{
    razorpayOrderId: string | null
    razorpayPaymentId: string | null
    status: WwInstallmentStatus
    paidAt: string | null
  }>,
): Promise<WwInstallment | null> {
  return mutate((snap) => {
    const row = snap.installments.find((i) => i.id === id)
    if (!row) return null
    if (patch.razorpayOrderId !== undefined) row.razorpayOrderId = patch.razorpayOrderId
    if (patch.razorpayPaymentId !== undefined) row.razorpayPaymentId = patch.razorpayPaymentId
    if (patch.status != null) row.status = patch.status
    if (patch.paidAt !== undefined) row.paidAt = patch.paidAt
    return { ...row }
  })
}

export async function markInstallmentPaid(opts: {
  installmentId: string
  razorpayOrderId: string
  razorpayPaymentId: string
}): Promise<{ registration: WwRegistration; installment: WwInstallment } | null> {
  return mutate((snap) => {
    const installment = snap.installments.find((i) => i.id === opts.installmentId)
    if (!installment) return null
    if (installment.status === 'paid') {
      const reg = snap.registrations.find((r) => r.id === installment.registrationId)
      return reg ? { registration: { ...reg }, installment: { ...installment } } : null
    }
    installment.status = 'paid'
    installment.paidAt = nowIso()
    installment.razorpayOrderId = opts.razorpayOrderId
    installment.razorpayPaymentId = opts.razorpayPaymentId
    installment.paymentMethod = 'razorpay'
    installment.collectedByMemberId = null
    installment.cashNote = null

    const reg = snap.registrations.find((r) => r.id === installment.registrationId)
    if (!reg) return null
    reg.amountPaidInr = Math.round((reg.amountPaidInr + installment.amountInr) * 100) / 100
    const siblings = snap.installments.filter((i) => i.registrationId === reg.id)
    const allPaid = siblings.every((i) => i.status === 'paid')
    const anyPaid = siblings.some((i) => i.status === 'paid')
    let status: WwRegistrationStatus = 'pending'
    if (allPaid) status = 'paid'
    else if (anyPaid) status = 'partial'
    reg.status = status
    reg.updatedAt = nowIso()
    return { registration: { ...reg }, installment: { ...installment } }
  })
}

/** Promoter (or admin) records cash collected for an attributed registration installment. */
export async function markInstallmentCashByPromoter(opts: {
  installmentId: string
  memberId: string
  note?: string | null
}): Promise<
  { registration: WwRegistration; installment: WwInstallment } | { error: string }
> {
  return mutate((snap) => {
    const member = snap.members.find((m) => m.id === opts.memberId)
    if (!member) return { error: 'Member not found' }

    const installment = snap.installments.find((i) => i.id === opts.installmentId)
    if (!installment) return { error: 'Installment not found' }
    if (installment.status === 'paid') return { error: 'Already paid' }

    const reg = snap.registrations.find((r) => r.id === installment.registrationId)
    if (!reg) return { error: 'Registration not found' }
    if (reg.status === 'cancelled') return { error: 'Registration cancelled' }
    if (installment.status === 'cancelled') return { error: 'Installment cancelled' }

    // Same ownership as cancel/edit: referral code OR booking you created OR ops admin.
    if (!memberOwnsRegistration(member, reg)) {
      return { error: 'You can only collect cash for bookings on your referral or that you created' }
    }

    installment.status = 'paid'
    installment.paidAt = nowIso()
    installment.paymentMethod = 'cash'
    installment.collectedByMemberId = opts.memberId
    installment.cashNote = opts.note ? String(opts.note).trim().slice(0, 200) : null
    installment.razorpayOrderId = installment.razorpayOrderId || null
    installment.razorpayPaymentId = null

    reg.amountPaidInr = Math.round((reg.amountPaidInr + installment.amountInr) * 100) / 100
    const siblings = snap.installments.filter((i) => i.registrationId === reg.id)
    const allPaid = siblings.every((i) => i.status === 'paid')
    const anyPaid = siblings.some((i) => i.status === 'paid')
    let status: WwRegistrationStatus = 'pending'
    if (allPaid) status = 'paid'
    else if (anyPaid) status = 'partial'
    reg.status = status
    reg.updatedAt = nowIso()
    return { registration: { ...reg }, installment: { ...installment } }
  })
}

export async function findInstallmentByRazorpayOrder(
  razorpayOrderId: string,
): Promise<WwInstallment | null> {
  return readStore().installments.find((i) => i.razorpayOrderId === razorpayOrderId) || null
}

export async function analyticsOverview(): Promise<WwAnalytics> {
  const snap = readStore()
  const regs = snap.registrations.filter((r) => r.status !== 'cancelled')
  const paid = regs.filter((r) => r.status === 'paid')
  const partial = regs.filter((r) => r.status === 'partial')
  const revenueInr = snap.registrations.reduce((s, r) => s + r.amountPaidInr, 0)

  const byTrip = snap.trips.map((trip) => {
    const tAll = snap.registrations.filter((r) => r.tripId === trip.id)
    const tActive = tAll.filter((r) => r.status !== 'cancelled')
    return {
      tripId: trip.id,
      title: trip.title,
      registrations: tActive.length,
      paid: tActive.filter((r) => r.status === 'paid').length,
      revenueInr: tAll.reduce((s, r) => s + r.amountPaidInr, 0),
      seatsLeft: Math.max(0, trip.seats - trip.seatsTaken),
    }
  })

  const buyerMap = new Map<
    string,
    {
      userId: string
      buyerEmail: string
      buyerName: string
      registrations: number
      paid: number
      revenueInr: number
      promoterCodes: Set<string>
    }
  >()
  for (const r of regs) {
    const key = r.userId || r.buyerEmail
    let row = buyerMap.get(key)
    if (!row) {
      row = {
        userId: r.userId,
        buyerEmail: r.buyerEmail,
        buyerName: r.buyerName,
        registrations: 0,
        paid: 0,
        revenueInr: 0,
        promoterCodes: new Set(),
      }
      buyerMap.set(key, row)
    }
    row.registrations += 1
    if (r.status === 'paid') row.paid += 1
    row.revenueInr += r.amountPaidInr
    if (r.promoterCode) row.promoterCodes.add(r.promoterCode)
    if (r.buyerName) row.buyerName = r.buyerName
  }
  const byBuyer = [...buyerMap.values()]
    .map((b) => ({
      userId: b.userId,
      buyerEmail: b.buyerEmail,
      buyerName: b.buyerName,
      registrations: b.registrations,
      paid: b.paid,
      revenueInr: b.revenueInr,
      promoterCodes: [...b.promoterCodes],
    }))
    .sort((a, b) => b.registrations - a.registrations || b.revenueInr - a.revenueInr)

  const promoters = snap.members
    .filter((m) => m.role === 'promoter' || m.role === 'admin' || m.role === 'owner')
    .map((m) => {
      const links = snap.promoterLinks.filter((l) => l.memberId === m.id)
      const codes = new Set(links.flatMap((l) => codesForLink(l)))
      const attributed = regs.filter((r) => r.promoterCode && codes.has(r.promoterCode))
      const attributedIds = new Set(attributed.map((r) => r.id))
      const paidInst = snap.installments.filter(
        (i) => attributedIds.has(i.registrationId) && i.status === 'paid',
      )
      const cashCollectedInr = paidInst
        .filter((i) => i.paymentMethod === 'cash')
        .reduce((s, i) => s + i.amountInr, 0)
      const onlineCollectedInr = paidInst
        .filter((i) => i.paymentMethod !== 'cash')
        .reduce((s, i) => s + i.amountInr, 0)
      const outstandingInr = snap.installments
        .filter(
          (i) =>
            attributedIds.has(i.registrationId) &&
            i.status !== 'paid' &&
            i.status !== 'cancelled',
        )
        .reduce((s, i) => s + i.amountInr, 0)
      return {
        memberId: m.id,
        email: m.email,
        displayName: m.displayName || null,
        role: m.role,
        code: links.find((l) => !l.tripId)?.code || links[0]?.code || '',
        links: links.map((l) => ({
          id: l.id,
          code: l.code,
          tripId: l.tripId || null,
          tripTitle: l.tripId
            ? snap.trips.find((t) => t.id === l.tripId)?.title || null
            : null,
        })),
        registrations: attributed.length,
        paid: attributed.filter((r) => r.status === 'paid').length,
        revenueInr: attributed.reduce((s, r) => s + r.amountPaidInr, 0),
        onlineCollectedInr: Math.round(onlineCollectedInr * 100) / 100,
        cashCollectedInr: Math.round(cashCollectedInr * 100) / 100,
        outstandingInr: Math.round(outstandingInr * 100) / 100,
        clicks: links.reduce((s, l) => s + (l.clickCount || 0), 0),
        assignedTripIds: Array.isArray(m.assignedTripIds) ? [...m.assignedTripIds] : [],
      }
    })
    .filter(
      (p) =>
        p.role === 'promoter' ||
        Boolean(p.code) ||
        p.registrations > 0 ||
        p.clicks > 0 ||
        p.revenueInr > 0,
    )
    .sort((a, b) => b.revenueInr - a.revenueInr)

  return {
    trips: snap.trips.length,
    publishedTrips: snap.trips.filter((t) => t.status === 'published').length,
    registrations: regs.length,
    paidRegistrations: paid.length,
    partialRegistrations: partial.length,
    revenueInr,
    planVsFull: {
      full: regs.filter((r) => r.paymentMode === 'full').length,
      plan: regs.filter((r) => r.paymentMode === 'plan').length,
    },
    byTrip,
    byBuyer,
    promoters,
  }
}

export async function promoterStats(memberId: string) {
  const snap = readStore()
  const links = snap.promoterLinks.filter((l) => l.memberId === memberId)
  const codes = new Set(links.flatMap((l) => codesForLink(l)))
  const attributed = snap.registrations.filter(
    (r) =>
      (r.promoterCode && codes.has(r.promoterCode)) || r.bookedByMemberId === memberId,
  )
  const attributedIds = new Set(attributed.map((r) => r.id))
  const payments = snap.installments
    .filter((i) => attributedIds.has(i.registrationId))
    .sort((a, b) => (b.paidAt || b.dueAt || '').localeCompare(a.paidAt || a.dueAt || ''))
    .map((installment) => {
      const registration = attributed.find((r) => r.id === installment.registrationId)!
      return {
        installment: { ...installment },
        registration: { ...registration },
        trip: snap.trips.find((t) => t.id === registration.tripId) || null,
      }
    })

  const duePayments = payments.filter((p) => p.installment.status !== 'paid')
  const paidPayments = payments.filter((p) => p.installment.status === 'paid')
  const cashCollectedInr = paidPayments
    .filter((p) => p.installment.paymentMethod === 'cash')
    .reduce((s, p) => s + p.installment.amountInr, 0)
  const onlineCollectedInr = paidPayments
    .filter((p) => p.installment.paymentMethod !== 'cash')
    .reduce((s, p) => s + p.installment.amountInr, 0)
  const outstandingInr = duePayments.reduce((s, p) => s + p.installment.amountInr, 0)

  const buyerMap = new Map<
    string,
    {
      userId: string
      buyerEmail: string
      buyerName: string
      registrations: number
      paid: number
      revenueInr: number
      outstandingInr: number
    }
  >()
  for (const r of attributed) {
    const key = r.userId || r.buyerEmail
    let row = buyerMap.get(key)
    if (!row) {
      row = {
        userId: r.userId,
        buyerEmail: r.buyerEmail,
        buyerName: r.buyerName,
        registrations: 0,
        paid: 0,
        revenueInr: 0,
        outstandingInr: 0,
      }
      buyerMap.set(key, row)
    }
    row.registrations += 1
    if (r.status === 'paid') row.paid += 1
    row.revenueInr += r.amountPaidInr
    row.outstandingInr += Math.max(0, r.amountDueInr - r.amountPaidInr)
    if (r.buyerName) row.buyerName = r.buyerName
  }
  return {
    links: links.map((l) => ({ ...l })),
    registrations: attributed.length,
    uniqueBuyers: buyerMap.size,
    paid: attributed.filter((r) => r.status === 'paid').length,
    partial: attributed.filter((r) => r.status === 'partial').length,
    pending: attributed.filter((r) => r.status === 'pending').length,
    revenueInr: attributed.reduce((s, r) => s + r.amountPaidInr, 0),
    outstandingInr,
    cashCollectedInr,
    onlineCollectedInr,
    clicks: links.reduce((s, l) => s + (l.clickCount || 0), 0),
    byBuyer: [...buyerMap.values()].sort((a, b) => b.registrations - a.registrations),
    payments,
    rows: attributed.map((registration) => ({
      registration: { ...registration },
      trip: snap.trips.find((t) => t.id === registration.tripId) || null,
      installments: snap.installments
        .filter((i) => i.registrationId === registration.id)
        .sort((a, b) => a.sequence - b.sequence)
        .map((i) => ({ ...i })),
    })),
  }
}
