import { resolveRemoteImageUrl } from '../media/offerImage.js'
import type { CueLinksOffer, CueLinksRawOffer } from './types.js'

const CACHE_TTL_MS = 10 * 60 * 1000
const FOREIGN_CURRENCY_RE = /[$€£]|USD|EUR|GBP|CAD|AUD|AED|SGD|MYR/i

type Cache = { offers: CueLinksOffer[]; fetchedAt: number; totalCount: number }

let cache: Cache | null = null
const foreignCampaigns = new Set<number>()

function config() {
  return {
    token: process.env.CUELINKS_API_TOKEN || '',
    base: (process.env.CUELINKS_API_BASE || '').replace(/\/$/, ''),
    path: process.env.CUELINKS_OFFERS_PATH || '',
    indiaOnly: (process.env.CUELINKS_INDIA_ONLY || 'true').toLowerCase() !== 'false',
  }
}

export function cuelinksConfigured(): boolean {
  const { token, base, path } = config()
  return Boolean(token && base && path)
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseCategories(raw: CueLinksRawOffer['categories']): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String)
  return Object.values(raw).filter(Boolean).map(String)
}

export function mapOffer(raw: CueLinksRawOffer): CueLinksOffer {
  const campaignId = raw.camapign_id ?? raw.campaign_id ?? null
  return {
    id: String(raw.id ?? `${campaignId}-${raw.title}`),
    campaignId,
    merchant: raw.campaign || raw.merchant_name || raw.merchant || 'Merchant',
    title: raw.title || 'Offer',
    description: raw.description ? stripHtml(raw.description) : '',
    couponCode: raw.coupon_code?.trim() || null,
    imageUrl: resolveRemoteImageUrl(
      raw.image_url || raw.image || raw.logo || raw.banner || raw.merchant_logo,
      raw.url || raw.affiliate_url,
      raw.campaign || raw.merchant_name || raw.merchant,
    ),
    type: raw.type || 'discount',
    status: raw.status || 'live',
    url: raw.url || '',
    affiliateUrl: raw.affiliate_url || raw.url || '',
    startDate: raw.start_date || null,
    endDate: raw.end_date || null,
    categories: parseCategories(raw.categories),
    source: 'marketplace',
  }
}

async function fetchPage(page: number, perPage: number): Promise<{ offers: CueLinksRawOffer[]; totalCount: number }> {
  const { token, base, path } = config()
  const url = new URL(`${base}${path}`)
  url.searchParams.set('page', String(page))
  url.searchParams.set('per_page', String(perPage))

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    throw new Error(`Marketplace offers failed (${res.status})`)
  }

  const data = (await res.json()) as any
  const offers: CueLinksRawOffer[] = Array.isArray(data) ? data : data.offers || []
  const totalCount = typeof data.total_count === 'number' ? data.total_count : offers.length
  return { offers, totalCount }
}

function applyIndiaFilter(offers: CueLinksOffer[]): CueLinksOffer[] {
  if (!config().indiaOnly) return offers
  return offers.filter((o) => {
    if (o.campaignId != null && foreignCampaigns.has(o.campaignId)) return false
    const blob = `${o.title} ${o.description}`
    if (FOREIGN_CURRENCY_RE.test(blob)) {
      if (o.campaignId != null) foreignCampaigns.add(o.campaignId)
      return false
    }
    return true
  })
}

/** Pull several pages for the marketplace UI (capped). */
export async function fetchCueLinksOffers(opts?: { force?: boolean; maxPages?: number; perPage?: number }) {
  if (!opts?.force && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache
  }

  const perPage = opts?.perPage ?? 50
  const maxPages = opts?.maxPages ?? 6
  const all: CueLinksOffer[] = []
  let totalCount = 0

  for (let page = 1; page <= maxPages; page++) {
    const { offers, totalCount: total } = await fetchPage(page, perPage)
    totalCount = total
    all.push(...offers.map(mapOffer))
    if (offers.length < perPage || all.length >= total) break
  }

  const filtered = applyIndiaFilter(all).filter((o) => o.status === 'live' || !o.status)
  cache = { offers: filtered, fetchedAt: Date.now(), totalCount }
  return cache
}

export async function listCueLinksOffers(filters?: {
  q?: string
  category?: string
  type?: string
  limit?: number
  offset?: number
}) {
  const snap = await fetchCueLinksOffers()
  let items = snap.offers

  const category = (filters?.category || '').trim()
  const type = (filters?.type || '').trim().toLowerCase()
  const q = (filters?.q || '').trim().toLowerCase()

  if (category && category.toLowerCase() !== 'all') {
    items = items.filter((o) =>
      o.categories.some((c) => c.toLowerCase() === category.toLowerCase())
    )
  }
  if (type && type !== 'all') {
    items = items.filter((o) => o.type.toLowerCase() === type)
  }
  if (q) {
    items = items.filter((o) => {
      const hay = `${o.title} ${o.merchant} ${o.description} ${o.categories.join(' ')} ${o.couponCode || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }

  const catSet = new Set<string>()
  for (const o of snap.offers) {
    for (const c of o.categories) catSet.add(c)
  }

  const offset = Math.max(0, Number(filters?.offset) || 0)
  const limitRaw = filters?.limit
  const limit =
    limitRaw == null || Number.isNaN(Number(limitRaw))
      ? items.length
      : Math.min(100, Math.max(1, Number(limitRaw)))
  const sliced = items.slice(offset, offset + limit)

  return {
    items: sliced,
    total: items.length,
    hasMore: offset + sliced.length < items.length,
    offset,
    limit,
    catalogTotal: snap.totalCount,
    categories: Array.from(catSet).sort((a, b) => a.localeCompare(b)),
    fetchedAt: new Date(snap.fetchedAt).toISOString(),
  }
}

export function clearCueLinksCache() {
  cache = null
}
