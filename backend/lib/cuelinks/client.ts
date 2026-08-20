import { resolveRemoteImageUrl } from '../media/offerImage.js'
import type { CueLinksOffer, CueLinksRawOffer } from './types.js'

const CACHE_TTL_MS = 10 * 60 * 1000
const FOREIGN_CURRENCY_RE = /[$€£]|USD|EUR|GBP|CAD|AUD|AED|SGD|MYR/i
const DEFAULT_PER_PAGE = 100
const MAX_PAGES = 50
const PAGE_CONCURRENCY = 4

type Cache = { offers: CueLinksOffer[]; fetchedAt: number; totalCount: number }

let cache: Cache | null = null
let inflight: Promise<Cache> | null = null
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
      'User-Agent': 'Yureka.One/1.0',
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

async function fetchAllPages(perPage: number, maxPages: number): Promise<{ offers: CueLinksOffer[]; totalCount: number }> {
  const first = await fetchPage(1, perPage)
  const totalCount = first.totalCount || first.offers.length
  const totalPages = Math.min(
    maxPages,
    Math.max(1, Math.ceil((totalCount || first.offers.length) / perPage)),
  )

  const byId = new Map<string, CueLinksOffer>()
  for (const raw of first.offers) {
    const offer = mapOffer(raw)
    byId.set(offer.id, offer)
  }

  const remaining = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
  for (let i = 0; i < remaining.length; i += PAGE_CONCURRENCY) {
    const batch = remaining.slice(i, i + PAGE_CONCURRENCY)
    const pages = await Promise.all(batch.map((page) => fetchPage(page, perPage)))
    for (const page of pages) {
      for (const raw of page.offers) {
        const offer = mapOffer(raw)
        byId.set(offer.id, offer)
      }
    }
  }

  return { offers: Array.from(byId.values()), totalCount }
}

/** Pull the full CueLinks offers catalog (paginated; cached). */
export async function fetchCueLinksOffers(opts?: { force?: boolean; maxPages?: number; perPage?: number }) {
  if (!opts?.force && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache
  }
  if (inflight && !opts?.force) return inflight

  const perPage = Math.min(100, Math.max(1, opts?.perPage ?? DEFAULT_PER_PAGE))
  const maxPages = Math.max(1, opts?.maxPages ?? MAX_PAGES)

  inflight = (async () => {
    const { offers, totalCount } = await fetchAllPages(perPage, maxPages)
    const filtered = applyIndiaFilter(offers).filter((o) => o.status === 'live' || !o.status)
    cache = { offers: filtered, fetchedAt: Date.now(), totalCount }
    return cache
  })().finally(() => {
    inflight = null
  })

  return inflight
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
      : Math.min(items.length, Math.max(1, Number(limitRaw)))
  const sliced = items.slice(offset, offset + limit)

  return {
    items: sliced,
    total: items.length,
    hasMore: offset + sliced.length < items.length,
    offset,
    limit,
    catalogTotal: snap.offers.length,
    categories: Array.from(catSet).sort((a, b) => a.localeCompare(b)),
    fetchedAt: new Date(snap.fetchedAt).toISOString(),
  }
}

function hostTokens(host: string): string[] {
  const h = host.toLowerCase().replace(/^www\./, '')
  const name = h.split('.')[0] || h
  const tokens = new Set<string>([h, name])
  if (name === 'zeptonow') tokens.add('zepto')
  if (name === 'makemytrip') {
    tokens.add('mmt')
    tokens.add('make my trip')
  }
  if (name === 'bookmyshow') tokens.add('book my show')
  if (name === 'bigbasket') tokens.add('big basket')
  if (name === 'jiomart') tokens.add('jio mart')
  return [...tokens].filter((t) => t.length >= 3)
}

export async function listCueLinksOffersForHost(host: string, limit = 8) {
  const snap = await fetchCueLinksOffers()
  const inHost = host.toLowerCase().replace(/^www\./, '')
  const tokens = hostTokens(inHost)
  const matched = snap.offers.filter((o) => {
    try {
      const u = new URL(o.url || o.affiliateUrl || 'https://invalid.invalid')
      const oh = u.hostname.replace(/^www\./i, '').toLowerCase()
      if (oh === inHost || oh.endsWith(`.${inHost}`) || inHost.endsWith(`.${oh}`)) return true
    } catch {
      /* ignore */
    }
    const hay = `${o.merchant} ${o.title} ${o.description} ${o.categories.join(' ')}`.toLowerCase()
    const compact = hay.replace(/[^a-z0-9]+/g, '')
    return tokens.some((t) => {
      const n = t.toLowerCase()
      const nCompact = n.replace(/[^a-z0-9]+/g, '')
      return hay.includes(n) || (nCompact.length >= 3 && compact.includes(nCompact))
    })
  })
  const cap = Math.min(24, Math.max(1, limit))
  return {
    host: inHost,
    items: matched.slice(0, cap),
    total: matched.length,
    catalogTotal: snap.offers.length,
    fetchedAt: new Date(snap.fetchedAt).toISOString(),
  }
}

export function clearCueLinksCache() {
  cache = null
}
