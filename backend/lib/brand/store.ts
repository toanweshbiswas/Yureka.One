import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { normalizeEmail } from '../mail/emailAddress.js'
import type {
  Brand,
  BrandDayPoint,
  BrandEventType,
  BrandListRow,
  BrandMember,
  BrandMemberRole,
  BrandOffer,
  BrandOfferEvent,
  BrandOverview,
  BrandSnapshot,
  BrandStatus,
} from './types.js'

function forceFileMode() {
  return (process.env.BRAND_STORE || '').toLowerCase() === 'file'
}

let supabaseSchemaUnavailable = false

function isMissingSchemaError(message: string | undefined) {
  const text = String(message || '').toLowerCase()
  return (
    text.includes('could not find the table') ||
    text.includes('schema cache') ||
    text.includes('does not exist')
  )
}

function disableSchema(reason: unknown) {
  supabaseSchemaUnavailable = true
  console.warn(
    '[brand] supabase schema unavailable, using file store:',
    (reason as Error)?.message || reason,
  )
}

function noteSchemaError(error: { message?: string } | null | undefined): boolean {
  if (!error?.message || !isMissingSchemaError(error.message)) return false
  disableSchema(error)
  return true
}

function filePath() {
  return path.join(process.cwd(), 'data', 'brand_store.json')
}

function emptySnapshot(): BrandSnapshot {
  return { brands: [], members: [], offers: [], events: [] }
}

function readFileStore(): BrandSnapshot {
  const p = filePath()
  try {
    if (!fs.existsSync(p)) {
      const snap = emptySnapshot()
      fs.mkdirSync(path.dirname(p), { recursive: true })
      fs.writeFileSync(p, JSON.stringify(snap, null, 2))
      return snap
    }
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as BrandSnapshot
    if (!Array.isArray(raw.brands)) raw.brands = []
    if (!Array.isArray(raw.members)) raw.members = []
    if (!Array.isArray(raw.offers)) raw.offers = []
    if (!Array.isArray(raw.events)) raw.events = []
    return raw
  } catch {
    const snap = emptySnapshot()
    writeFileStore(snap)
    return snap
  }
}

function writeFileStore(snap: BrandSnapshot) {
  fs.mkdirSync(path.dirname(filePath()), { recursive: true })
  fs.writeFileSync(filePath(), JSON.stringify(snap, null, 2))
}

function sbClient(): SupabaseClient | null {
  if (forceFileMode() || supabaseSchemaUnavailable) return null
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function brandBackendMode() {
  return sbClient() ? 'supabase' : 'file'
}

function slugify(name: string) {
  const base = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return base || 'brand'
}

function mapBrand(row: any): Brand {
  return {
    id: String(row.id),
    name: String(row.name || ''),
    slug: String(row.slug || ''),
    logoUrl: row.logo_url ?? row.logoUrl ?? null,
    website: row.website ?? null,
    category: String(row.category || 'general'),
    contactEmail: row.contact_email ?? row.contactEmail ?? null,
    status: (row.status === 'paused' ? 'paused' : 'active') as BrandStatus,
    notes: row.notes ?? null,
    createdAt: String(row.created_at ?? row.createdAt),
  }
}

function mapMember(row: any): BrandMember {
  return {
    id: String(row.id),
    brandId: String(row.brand_id ?? row.brandId),
    email: normalizeEmail(row.email),
    userId: row.user_id ?? row.userId ?? null,
    role: (['owner', 'editor', 'viewer'].includes(String(row.role)) ? row.role : 'editor') as BrandMemberRole,
    invitedAt: String(row.invited_at ?? row.invitedAt),
    joinedAt: row.joined_at ?? row.joinedAt ?? null,
  }
}

function mapOffer(row: any): BrandOffer {
  return {
    id: String(row.id),
    brandId: String(row.brand_id ?? row.brandId),
    brandName: row.brand_name ?? row.brandName,
    brandLogoUrl: row.brand_logo_url ?? row.brandLogoUrl ?? null,
    title: String(row.title || ''),
    description: String(row.description || ''),
    url: String(row.url || ''),
    couponCode: row.coupon_code ?? row.couponCode ?? null,
    category: String(row.category || 'general'),
    imageUrl: row.image_url ?? row.imageUrl ?? null,
    startsAt: row.starts_at ?? row.startsAt ?? null,
    endsAt: row.ends_at ?? row.endsAt ?? null,
    active: row.active !== false,
    createdBy: row.created_by ?? row.createdBy ?? null,
    createdAt: String(row.created_at ?? row.createdAt),
  }
}

function mapEvent(row: any): BrandOfferEvent {
  return {
    id: String(row.id),
    offerId: String(row.offer_id ?? row.offerId),
    brandId: String(row.brand_id ?? row.brandId),
    userId: String(row.user_id ?? row.userId),
    type: row.type as BrandEventType,
    createdAt: String(row.created_at ?? row.createdAt),
  }
}

function offerIsLive(offer: BrandOffer, brand?: Brand | null, now = new Date()) {
  if (!offer.active) return false
  if (brand && brand.status !== 'active') return false
  if (offer.startsAt && new Date(offer.startsAt).getTime() > now.getTime()) return false
  if (offer.endsAt && new Date(offer.endsAt).getTime() < now.getTime()) return false
  return true
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function last30Days(now = new Date()): string[] {
  const days: string[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    days.push(dayKey(d))
  }
  return days
}

function since30d(now = new Date()) {
  return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
}

export async function listBrands(): Promise<Brand[]> {
  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb.from('brands').select('*').order('created_at', { ascending: false })
    if (!error && data) return data.map(mapBrand)
    noteSchemaError(error)
  }
  return readFileStore().brands.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

export async function getBrand(id: string): Promise<Brand | null> {
  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb.from('brands').select('*').eq('id', id).maybeSingle()
    if (!error && data) return mapBrand(data)
    noteSchemaError(error)
  }
  return readFileStore().brands.find((b) => b.id === id) || null
}

async function uniqueSlug(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name)
  const existing = await listBrands()
  const taken = new Set(existing.filter((b) => b.id !== excludeId).map((b) => b.slug))
  if (!taken.has(base)) return base
  let i = 2
  while (taken.has(`${base}-${i}`)) i += 1
  return `${base}-${i}`
}

export async function createBrand(input: {
  name: string
  website?: string
  category?: string
  contactEmail?: string
  logoUrl?: string
  notes?: string
  status?: BrandStatus
}): Promise<Brand> {
  const name = String(input.name || '').trim().slice(0, 80)
  if (!name) throw new Error('Brand name is required')
  const slug = await uniqueSlug(name)
  const brand: Brand = {
    id: randomUUID(),
    name,
    slug,
    logoUrl: input.logoUrl?.trim() || null,
    website: input.website?.trim() || null,
    category: String(input.category || 'general').trim().slice(0, 40) || 'general',
    contactEmail: input.contactEmail ? normalizeEmail(input.contactEmail) : null,
    status: input.status === 'paused' ? 'paused' : 'active',
    notes: input.notes?.trim().slice(0, 500) || null,
    createdAt: new Date().toISOString(),
  }

  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb
      .from('brands')
      .insert({
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        logo_url: brand.logoUrl,
        website: brand.website,
        category: brand.category,
        contact_email: brand.contactEmail,
        status: brand.status,
        notes: brand.notes,
        created_at: brand.createdAt,
      })
      .select('*')
      .single()
    if (!error && data) return mapBrand(data)
    if (!noteSchemaError(error) && error) throw new Error(error.message)
  }

  const snap = readFileStore()
  snap.brands.unshift(brand)
  writeFileStore(snap)
  return brand
}

export async function updateBrand(
  id: string,
  patch: Partial<Pick<Brand, 'name' | 'website' | 'category' | 'contactEmail' | 'logoUrl' | 'notes' | 'status'>>,
): Promise<Brand | null> {
  const current = await getBrand(id)
  if (!current) return null
  const next: Brand = {
    ...current,
    name: patch.name != null ? String(patch.name).trim().slice(0, 80) : current.name,
    website: patch.website !== undefined ? (patch.website?.trim() || null) : current.website,
    category: patch.category != null ? String(patch.category).trim().slice(0, 40) || 'general' : current.category,
    contactEmail:
      patch.contactEmail !== undefined
        ? patch.contactEmail
          ? normalizeEmail(patch.contactEmail)
          : null
        : current.contactEmail,
    logoUrl: patch.logoUrl !== undefined ? (patch.logoUrl?.trim() || null) : current.logoUrl,
    notes: patch.notes !== undefined ? (patch.notes?.trim().slice(0, 500) || null) : current.notes,
    status: patch.status === 'paused' || patch.status === 'active' ? patch.status : current.status,
  }
  if (!next.name) throw new Error('Brand name is required')
  if (next.name !== current.name) next.slug = await uniqueSlug(next.name, id)

  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb
      .from('brands')
      .update({
        name: next.name,
        slug: next.slug,
        logo_url: next.logoUrl,
        website: next.website,
        category: next.category,
        contact_email: next.contactEmail,
        status: next.status,
        notes: next.notes,
      })
      .eq('id', id)
      .select('*')
      .single()
    if (!error && data) return mapBrand(data)
    if (!noteSchemaError(error) && error) throw new Error(error.message)
  }

  const snap = readFileStore()
  const idx = snap.brands.findIndex((b) => b.id === id)
  if (idx < 0) return null
  snap.brands[idx] = next
  writeFileStore(snap)
  return next
}

export async function listMembers(brandId: string): Promise<BrandMember[]> {
  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb.from('brand_members').select('*').eq('brand_id', brandId)
    if (!error && data) return data.map(mapMember)
    noteSchemaError(error)
  }
  return readFileStore().members.filter((m) => m.brandId === brandId)
}

export async function membershipsForIdentity(opts: {
  userId: string
  email: string | null
}): Promise<{ member: BrandMember; brand: Brand }[]> {
  const email = opts.email ? normalizeEmail(opts.email) : ''
  const sb = sbClient()
  if (sb) {
    const [byUser, byEmail] = await Promise.all([
      sb.from('brand_members').select('*').eq('user_id', opts.userId),
      email ? sb.from('brand_members').select('*').eq('email', email) : Promise.resolve({ data: [], error: null }),
    ])
    const error = byUser.error || byEmail.error
    if (!error) {
      const seen = new Set<string>()
      const members = [...(byUser.data || []), ...(byEmail.data || [])]
        .map(mapMember)
        .filter((m) => {
          if (seen.has(m.id)) return false
          seen.add(m.id)
          return true
        })
      const brands = await listBrands()
      const byId = new Map(brands.map((b) => [b.id, b]))
      return members
        .map((member) => {
          const brand = byId.get(member.brandId)
          return brand ? { member, brand } : null
        })
        .filter((row): row is { member: BrandMember; brand: Brand } => Boolean(row))
    }
    noteSchemaError(error)
  }

  const snap = readFileStore()
  return snap.members
    .filter((m) => m.userId === opts.userId || (email && m.email === email))
    .map((member) => {
      const brand = snap.brands.find((b) => b.id === member.brandId)
      return brand ? { member, brand } : null
    })
    .filter((row): row is { member: BrandMember; brand: Brand } => Boolean(row))
}

export async function attachMemberUser(memberId: string, userId: string): Promise<BrandMember | null> {
  const now = new Date().toISOString()
  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb
      .from('brand_members')
      .update({ user_id: userId, joined_at: now })
      .eq('id', memberId)
      .select('*')
      .single()
    if (!error && data) return mapMember(data)
    if (!noteSchemaError(error) && error) throw new Error(error.message)
  }
  const snap = readFileStore()
  const idx = snap.members.findIndex((m) => m.id === memberId)
  if (idx < 0) return null
  snap.members[idx] = { ...snap.members[idx], userId, joinedAt: snap.members[idx].joinedAt || now }
  writeFileStore(snap)
  return snap.members[idx]
}

export async function inviteMember(
  brandId: string,
  emailRaw: string,
  role: BrandMemberRole = 'editor',
): Promise<BrandMember> {
  const brand = await getBrand(brandId)
  if (!brand) throw new Error('Brand not found')
  const email = normalizeEmail(emailRaw)
  if (!email.includes('@')) throw new Error('A valid email is required')

  const existing = (await listMembers(brandId)).find((m) => m.email === email)
  if (existing) return existing

  const member: BrandMember = {
    id: randomUUID(),
    brandId,
    email,
    userId: null,
    role,
    invitedAt: new Date().toISOString(),
    joinedAt: null,
  }

  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb
      .from('brand_members')
      .insert({
        id: member.id,
        brand_id: brandId,
        email,
        role,
        invited_at: member.invitedAt,
      })
      .select('*')
      .single()
    if (!error && data) return mapMember(data)
    if (!noteSchemaError(error) && error) throw new Error(error.message)
  }

  const snap = readFileStore()
  snap.members.push(member)
  writeFileStore(snap)
  return member
}

export async function listOffers(brandId: string): Promise<BrandOffer[]> {
  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb
      .from('brand_offers')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
    if (!error && data) return data.map(mapOffer)
    noteSchemaError(error)
  }
  return readFileStore()
    .offers.filter((o) => o.brandId === brandId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

export async function getOffer(id: string): Promise<BrandOffer | null> {
  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb.from('brand_offers').select('*').eq('id', id).maybeSingle()
    if (!error && data) return mapOffer(data)
    noteSchemaError(error)
  }
  return readFileStore().offers.find((o) => o.id === id) || null
}

export async function listCatalog(): Promise<BrandOffer[]> {
  const [brands, offers] = await Promise.all([listBrands(), listAllOffers()])
  const byId = new Map(brands.map((b) => [b.id, b]))
  return offers
    .filter((o) => offerIsLive(o, byId.get(o.brandId)))
    .map((o) => {
      const brand = byId.get(o.brandId)
      return {
        ...o,
        brandName: brand?.name || o.brandName,
        brandLogoUrl: brand?.logoUrl || o.brandLogoUrl,
      }
    })
}

async function listAllOffers(): Promise<BrandOffer[]> {
  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb.from('brand_offers').select('*').order('created_at', { ascending: false })
    if (!error && data) return data.map(mapOffer)
    noteSchemaError(error)
  }
  return readFileStore().offers
}

export async function createOffer(
  brandId: string,
  input: {
    title: string
    description?: string
    url: string
    couponCode?: string
    category?: string
    imageUrl?: string
    startsAt?: string | null
    endsAt?: string | null
    active?: boolean
    createdBy?: string
  },
): Promise<BrandOffer> {
  const title = String(input.title || '').trim().slice(0, 120)
  const url = String(input.url || '').trim()
  if (!title) throw new Error('Title is required')
  if (!url) throw new Error('URL is required')
  const offer: BrandOffer = {
    id: randomUUID(),
    brandId,
    title,
    description: String(input.description || '').trim().slice(0, 600),
    url,
    couponCode: input.couponCode?.trim().slice(0, 40) || null,
    category: String(input.category || 'general').trim().slice(0, 40) || 'general',
    imageUrl: input.imageUrl?.trim() || null,
    startsAt: input.startsAt || null,
    endsAt: input.endsAt || null,
    active: input.active !== false,
    createdBy: input.createdBy || null,
    createdAt: new Date().toISOString(),
  }

  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb
      .from('brand_offers')
      .insert({
        id: offer.id,
        brand_id: brandId,
        title: offer.title,
        description: offer.description,
        url: offer.url,
        coupon_code: offer.couponCode,
        category: offer.category,
        image_url: offer.imageUrl,
        starts_at: offer.startsAt,
        ends_at: offer.endsAt,
        active: offer.active,
        created_by: offer.createdBy,
        created_at: offer.createdAt,
      })
      .select('*')
      .single()
    if (!error && data) return mapOffer(data)
    if (!noteSchemaError(error) && error) throw new Error(error.message)
  }

  const snap = readFileStore()
  snap.offers.unshift(offer)
  writeFileStore(snap)
  return offer
}

export async function updateOffer(
  id: string,
  patch: Partial<
    Pick<
      BrandOffer,
      'title' | 'description' | 'url' | 'couponCode' | 'category' | 'imageUrl' | 'startsAt' | 'endsAt' | 'active'
    >
  >,
): Promise<BrandOffer | null> {
  const current = await getOffer(id)
  if (!current) return null
  const next: BrandOffer = {
    ...current,
    title: patch.title != null ? String(patch.title).trim().slice(0, 120) : current.title,
    description: patch.description != null ? String(patch.description).trim().slice(0, 600) : current.description,
    url: patch.url != null ? String(patch.url).trim() : current.url,
    couponCode: patch.couponCode !== undefined ? (patch.couponCode?.trim().slice(0, 40) || null) : current.couponCode,
    category: patch.category != null ? String(patch.category).trim().slice(0, 40) || 'general' : current.category,
    imageUrl: patch.imageUrl !== undefined ? (patch.imageUrl?.trim() || null) : current.imageUrl,
    startsAt: patch.startsAt !== undefined ? patch.startsAt : current.startsAt,
    endsAt: patch.endsAt !== undefined ? patch.endsAt : current.endsAt,
    active: patch.active !== undefined ? Boolean(patch.active) : current.active,
  }
  if (!next.title) throw new Error('Title is required')
  if (!next.url) throw new Error('URL is required')

  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb
      .from('brand_offers')
      .update({
        title: next.title,
        description: next.description,
        url: next.url,
        coupon_code: next.couponCode,
        category: next.category,
        image_url: next.imageUrl,
        starts_at: next.startsAt,
        ends_at: next.endsAt,
        active: next.active,
      })
      .eq('id', id)
      .select('*')
      .single()
    if (!error && data) return mapOffer(data)
    if (!noteSchemaError(error) && error) throw new Error(error.message)
  }

  const snap = readFileStore()
  const idx = snap.offers.findIndex((o) => o.id === id)
  if (idx < 0) return null
  snap.offers[idx] = next
  writeFileStore(snap)
  return next
}

export async function recordEvent(input: {
  offerId: string
  userId: string
  type: BrandEventType
}): Promise<BrandOfferEvent | null> {
  const offer = await getOffer(input.offerId)
  if (!offer) return null
  const brand = await getBrand(offer.brandId)
  if (!brand || !offerIsLive(offer, brand)) return null

  const event: BrandOfferEvent = {
    id: randomUUID(),
    offerId: offer.id,
    brandId: offer.brandId,
    userId: input.userId,
    type: input.type,
    createdAt: new Date().toISOString(),
  }

  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb
      .from('brand_offer_events')
      .insert({
        id: event.id,
        offer_id: event.offerId,
        brand_id: event.brandId,
        user_id: event.userId,
        type: event.type,
        created_at: event.createdAt,
      })
      .select('*')
      .single()
    if (!error && data) return mapEvent(data)
    if (!noteSchemaError(error) && error) throw new Error(error.message)
  }

  const snap = readFileStore()
  snap.events.push(event)
  writeFileStore(snap)
  return event
}

async function listEvents(brandId: string, sinceIso?: string): Promise<BrandOfferEvent[]> {
  const sb = sbClient()
  if (sb) {
    let query = sb.from('brand_offer_events').select('*').eq('brand_id', brandId)
    if (sinceIso) query = query.gte('created_at', sinceIso)
    const { data, error } = await query.order('created_at', { ascending: false }).limit(20_000)
    if (!error && data) return data.map(mapEvent)
    noteSchemaError(error)
  }
  return readFileStore().events.filter(
    (e) => e.brandId === brandId && (!sinceIso || e.createdAt >= sinceIso),
  )
}

function buildOverviewFrom(brand: Brand, offers: BrandOffer[], events: BrandOfferEvent[]): BrandOverview {
  const days = last30Days()
  const seriesMap = new Map<string, BrandDayPoint>(
    days.map((date) => [date, { date, clicks: 0, copies: 0, impressions: 0, uniqueUsers: 0 }]),
  )
  const usersByDay = new Map<string, Set<string>>()
  const offerClicks = new Map<string, { clicks: number; copies: number }>()
  const unique = new Set<string>()

  for (const ev of events) {
    const day = String(ev.createdAt).slice(0, 10)
    const point = seriesMap.get(day)
    if (point) {
      if (ev.type === 'click') point.clicks += 1
      if (ev.type === 'copy') point.copies += 1
      if (ev.type === 'impression') point.impressions += 1
      const set = usersByDay.get(day) || new Set<string>()
      set.add(ev.userId)
      usersByDay.set(day, set)
    }
    unique.add(ev.userId)
    const stats = offerClicks.get(ev.offerId) || { clicks: 0, copies: 0 }
    if (ev.type === 'click') stats.clicks += 1
    if (ev.type === 'copy') stats.copies += 1
    offerClicks.set(ev.offerId, stats)
  }

  const series = days.map((date) => {
    const point = seriesMap.get(date)!
    point.uniqueUsers = usersByDay.get(date)?.size || 0
    return point
  })

  return {
    brand,
    liveOfferCount: offers.filter((o) => offerIsLive(o, brand)).length,
    clicks: events.filter((e) => e.type === 'click').length,
    copies: events.filter((e) => e.type === 'copy').length,
    impressions: events.filter((e) => e.type === 'impression').length,
    uniqueUsers: unique.size,
    series,
    topOffers: offers
      .map((o) => ({
        id: o.id,
        title: o.title,
        clicks: offerClicks.get(o.id)?.clicks || 0,
        copies: offerClicks.get(o.id)?.copies || 0,
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 6),
  }
}

export async function brandOverview(brandId: string): Promise<BrandOverview | null> {
  const brand = await getBrand(brandId)
  if (!brand) return null
  const [offers, events] = await Promise.all([listOffers(brandId), listEvents(brandId, since30d())])
  return buildOverviewFrom(brand, offers, events)
}

export async function offerStats(offerId: string): Promise<{
  offer: BrandOffer
  clicks: number
  copies: number
  impressions: number
  uniqueUsers: number
  series: BrandDayPoint[]
} | null> {
  const offer = await getOffer(offerId)
  if (!offer) return null
  const events = (await listEvents(offer.brandId, since30d())).filter((e) => e.offerId === offerId)
  const overview = buildOverviewFrom({ id: offer.brandId } as Brand, [offer], events)
  return {
    offer,
    clicks: overview.clicks,
    copies: overview.copies,
    impressions: overview.impressions,
    uniqueUsers: overview.uniqueUsers,
    series: overview.series,
  }
}

export async function listBrandsWithRollup(): Promise<BrandListRow[]> {
  const brands = await listBrands()
  const since = since30d()
  const sb = sbClient()
  let events: BrandOfferEvent[] = []
  let offers: BrandOffer[] = []
  let members: BrandMember[] = []
  if (sb) {
    const [ev, of, mem] = await Promise.all([
      sb.from('brand_offer_events').select('*').gte('created_at', since).limit(50_000),
      sb.from('brand_offers').select('*'),
      sb.from('brand_members').select('*'),
    ])
    if (!ev.error && ev.data) events = ev.data.map(mapEvent)
    else noteSchemaError(ev.error)
    if (!of.error && of.data) offers = of.data.map(mapOffer)
    else noteSchemaError(of.error)
    if (!mem.error && mem.data) members = mem.data.map(mapMember)
    else noteSchemaError(mem.error)
  } else {
    const snap = readFileStore()
    events = snap.events.filter((e) => e.createdAt >= since)
    offers = snap.offers
    members = snap.members
  }

  return brands.map((brand) => {
    const brandEvents = events.filter((e) => e.brandId === brand.id)
    const last = brandEvents.reduce<string | null>((acc, ev) => {
      if (!acc || ev.createdAt > acc) return ev.createdAt
      return acc
    }, null)
    return {
      ...brand,
      liveOfferCount: offers.filter((o) => o.brandId === brand.id && offerIsLive(o, brand)).length,
      clicks30d: brandEvents.filter((e) => e.type === 'click').length,
      lastEventAt: last,
      memberCount: members.filter((m) => m.brandId === brand.id).length,
    }
  })
}

export async function offersWithStats(brandId: string): Promise<BrandOffer[]> {
  const [offers, events] = await Promise.all([listOffers(brandId), listEvents(brandId, since30d())])
  return offers.map((o) => ({
    ...o,
    clicks: events.filter((e) => e.offerId === o.id && e.type === 'click').length,
    copies: events.filter((e) => e.offerId === o.id && e.type === 'copy').length,
    impressions: events.filter((e) => e.offerId === o.id && e.type === 'impression').length,
  }))
}
