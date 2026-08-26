import type {
  CueLinksCampaign,
  CueLinksPayoutCategory,
  CueLinksRawCampaign,
} from './types.js'

const CACHE_TTL_MS = 15 * 60 * 1000
const DEFAULT_PER_PAGE = 100
const MAX_PAGES = 40

type Cache = { campaigns: CueLinksCampaign[]; fetchedAt: number; totalCount: number }

let cache: Cache | null = null
let inflight: Promise<Cache> | null = null

function config() {
  return {
    token: process.env.CUELINKS_API_TOKEN || '',
    base: (process.env.CUELINKS_API_BASE || '').replace(/\/$/, ''),
    path: (process.env.CUELINKS_CAMPAIGNS_PATH || '/campaigns.json').trim() || '/campaigns.json',
    indiaOnly: (process.env.CUELINKS_INDIA_ONLY || 'true').toLowerCase() !== 'false',
  }
}

export function cuelinksCampaignsConfigured(): boolean {
  const { token, base, path } = config()
  return Boolean(token && base && path)
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function normalizeCategoryName(name: string): string {
  return name.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim()
}

function mapPayoutCategory(raw: any): CueLinksPayoutCategory {
  return {
    name: normalizeCategoryName(String(raw?.name || 'Payout')),
    payoutType: String(raw?.payout_type || ''),
    payout: num(raw?.payout),
    payoutCurrency: String(raw?.payout_currency || 'INR'),
    isHeader: Boolean(raw?.is_header),
  }
}

/** Pull New User / Existing User rates from CueLinks payout_categories. */
export function extractUserCommissions(categories: CueLinksPayoutCategory[]): {
  newUserCommission: number | null
  existingUserCommission: number | null
  newUserPayoutType: string | null
  existingUserPayoutType: string | null
} {
  let newUserCommission: number | null = null
  let existingUserCommission: number | null = null
  let newUserPayoutType: string | null = null
  let existingUserPayoutType: string | null = null

  for (const cat of categories) {
    if (cat.isHeader) continue
    const name = cat.name.toLowerCase()
    // Prefer exact "New User" / "Existing User" over combined rows.
    const isExactNew = /^(new\s*user|new\s*customer|ntb|new\s*to\s*brand)\b/.test(name) && !/existing/.test(name)
    const isExactExisting =
      /^(existing\s*user|existing\s*customer|etb|repeat)\b/.test(name) && !/\bnew\b/.test(name)
    const isLooseNew = /\bnew\s*(user|customer|users|customers)\b/.test(name) && !/\bexisting\b/.test(name)
    const isLooseExisting =
      /\bexisting\s*(user|customer|users|customers)\b/.test(name) && !/\bnew\b/.test(name)

    if ((isExactNew || (isLooseNew && newUserCommission == null)) && cat.payout != null) {
      newUserCommission = cat.payout
      newUserPayoutType = cat.payoutType || null
    }
    if ((isExactExisting || (isLooseExisting && existingUserCommission == null)) && cat.payout != null) {
      existingUserCommission = cat.payout
      existingUserPayoutType = cat.payoutType || null
    }
  }

  return { newUserCommission, existingUserCommission, newUserPayoutType, existingUserPayoutType }
}

function isPayPerClick(payoutType: string, categories: CueLinksPayoutCategory[]): boolean {
  const pt = payoutType.toLowerCase()
  if (pt.includes('click') || pt === 'cpc') return true
  return categories.some((c) => {
    const t = `${c.payoutType} ${c.name}`.toLowerCase()
    return t.includes('per click') || /\bcpc\b/.test(t)
  })
}

export function mapCampaign(raw: CueLinksRawCampaign): CueLinksCampaign {
  const payoutCategories = (raw.payout_categories || []).map(mapPayoutCategory)
  const userRates = extractUserCommissions(payoutCategories)
  const payoutType = String(raw.payout_type || '')
  const categories = (raw.categories || []).map((c) => ({
    id: Number(c.id) || 0,
    name: String(c.name || ''),
  }))
  const countries = (raw.countries || []).map((c) => ({
    id: Number(c.id) || 0,
    iso: String(c.iso || ''),
    name: String(c.name || ''),
  }))

  return {
    id: Number(raw.id) || 0,
    name: String(raw.name || 'Campaign'),
    url: String(raw.url || ''),
    domain: String(raw.domain || '').replace(/^www\./i, '').toLowerCase() || null,
    imageUrl: raw.image || null,
    payoutType,
    payout: num(raw.payout),
    payoutCurrency: String(raw.payout_currency || 'INR'),
    isPayPerClick: isPayPerClick(payoutType, payoutCategories),
    payoutCategories,
    newUserCommission: userRates.newUserCommission,
    existingUserCommission: userRates.existingUserCommission,
    newUserPayoutType: userRates.newUserPayoutType,
    existingUserPayoutType: userRates.existingUserPayoutType,
    categories,
    countries,
    reportingType: raw.reporting_type || null,
    deeplinkAllowed: Boolean(raw.deeplink_allowed),
    subIdsAllowed: Boolean(raw.sub_ids_allowed),
    cookieDuration: raw.cookie_duration != null ? String(raw.cookie_duration) : null,
    affiliateUrl: raw.affiliate_url || null,
    importantInfo: raw.important_info_html ? stripHtml(raw.important_info_html) : null,
    lastModified: raw.last_modified || null,
  }
}

async function fetchPage(
  page: number,
  perPage: number,
): Promise<{ campaigns: CueLinksRawCampaign[]; totalHint: number }> {
  const { token, base, path } = config()
  const url = new URL(`${base}${path.startsWith('/') ? path : `/${path}`}`)
  url.searchParams.set('page', String(page))
  url.searchParams.set('per_page', String(perPage))

  let lastErr: Error | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'User-Agent': 'Yureka.One/1.0',
        },
      })
      if (!res.ok) {
        throw new Error(`CueLinks campaigns failed (${res.status})`)
      }
      const text = await res.text()
      if (!text.trim()) {
        throw new Error(`CueLinks campaigns empty body (page ${page})`)
      }
      const data = JSON.parse(text) as any
      const campaigns: CueLinksRawCampaign[] = Array.isArray(data)
        ? data
        : data.campaigns || data.data || []
      const totalHint =
        typeof data.total_count === 'number'
          ? data.total_count
          : typeof data.total === 'number'
            ? data.total
            : campaigns.length
      return { campaigns, totalHint }
    } catch (e: any) {
      lastErr = e instanceof Error ? e : new Error(String(e?.message || e))
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
    }
  }
  throw lastErr || new Error('CueLinks campaigns failed')
}

function applyIndiaFilter(items: CueLinksCampaign[]): CueLinksCampaign[] {
  if (!config().indiaOnly) return items
  return items.filter((c) => {
    if (!c.countries.length) return true
    return c.countries.some((country) => country.iso === 'IN' || country.id === 252)
  })
}

async function fetchAllPages(perPage: number, maxPages: number): Promise<Cache> {
  const first = await fetchPage(1, perPage)
  const byId = new Map<number, CueLinksCampaign>()
  for (const raw of first.campaigns) {
    const mapped = mapCampaign(raw)
    if (mapped.id) byId.set(mapped.id, mapped)
  }

  // Sequential pages. CueLinks rate-limits aggressive parallel bursts.
  for (let page = 2; page <= maxPages; page++) {
    const { campaigns } = await fetchPage(page, perPage)
    if (!campaigns.length) break
    for (const raw of campaigns) {
      const mapped = mapCampaign(raw)
      if (mapped.id) byId.set(mapped.id, mapped)
    }
    if (campaigns.length < perPage) break
  }

  const campaigns = applyIndiaFilter(Array.from(byId.values())).sort((a, b) =>
    a.name.localeCompare(b.name),
  )
  return {
    campaigns,
    fetchedAt: Date.now(),
    totalCount: first.totalHint || campaigns.length,
  }
}

export async function fetchCueLinksCampaigns(opts?: {
  force?: boolean
  maxPages?: number
  perPage?: number
}) {
  if (!opts?.force && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache
  }
  if (inflight && !opts?.force) return inflight

  const perPage = Math.min(100, Math.max(1, opts?.perPage ?? DEFAULT_PER_PAGE))
  const maxPages = Math.max(1, opts?.maxPages ?? MAX_PAGES)

  inflight = fetchAllPages(perPage, maxPages)
    .then((snap) => {
      cache = snap
      return snap
    })
    .finally(() => {
      inflight = null
    })

  return inflight
}

export async function listCueLinksCampaigns(filters?: {
  q?: string
  /** `cpc` = pay-per-click only; `new_existing` = has new/existing rates; default all */
  filter?: 'all' | 'cpc' | 'new_existing' | 'ppc'
  limit?: number
  offset?: number
}) {
  const snap = await fetchCueLinksCampaigns()
  let items = snap.campaigns

  const mode = (filters?.filter || 'all').toLowerCase()
  if (mode === 'cpc' || mode === 'ppc') {
    items = items.filter((c) => c.isPayPerClick)
  } else if (mode === 'new_existing') {
    items = items.filter(
      (c) => c.newUserCommission != null || c.existingUserCommission != null,
    )
  }

  const q = (filters?.q || '').trim().toLowerCase()
  if (q) {
    items = items.filter((c) => {
      const hay = `${c.name} ${c.domain || ''} ${c.payoutType} ${c.categories.map((x) => x.name).join(' ')}`.toLowerCase()
      return hay.includes(q)
    })
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
    catalogTotal: snap.campaigns.length,
    payPerClickTotal: snap.campaigns.filter((c) => c.isPayPerClick).length,
    newExistingTotal: snap.campaigns.filter(
      (c) => c.newUserCommission != null || c.existingUserCommission != null,
    ).length,
    fetchedAt: new Date(snap.fetchedAt).toISOString(),
  }
}

export function clearCueLinksCampaignsCache() {
  cache = null
}
