import type { CueLinksOffer } from './types.js'
import { fetchCueLinksOffers } from './client.js'

const AFFILIATE_HOSTS = new Set(['linksredirect.com', 'clnk.in', 'cuelinks.com'])

export type CueLinksBrand = {
  id: string
  merchant: string
  host: string | null
  homeUrl: string | null
  offerCount: number
  imageUrl: string | null
  categories: string[]
}

function merchantHost(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const host = new URL(raw).hostname.replace(/^www\./i, '').toLowerCase()
    if (!host || AFFILIATE_HOSTS.has(host) || host.endsWith('.cuelinks.com')) return null
    return host
  } catch {
    return null
  }
}

function homeUrlForHost(host: string): string {
  return `https://www.${host}/`
}

/** Aggregate CueLinks offers into unique brands with a browser-safe homepage. */
export function brandsFromOffers(offers: CueLinksOffer[]): CueLinksBrand[] {
  const byKey = new Map<string, CueLinksBrand & { catSet: Set<string> }>()

  for (const offer of offers) {
    const merchant = String(offer.merchant || '').trim() || 'Merchant'
    const host = merchantHost(offer.url) || merchantHost(offer.affiliateUrl)
    const key = `${merchant.toLowerCase()}::${host || 'unknown'}`
    const existing = byKey.get(key)
    if (existing) {
      existing.offerCount += 1
      if (!existing.imageUrl && offer.imageUrl) existing.imageUrl = offer.imageUrl
      for (const c of offer.categories || []) existing.catSet.add(c)
      continue
    }
    const catSet = new Set<string>(offer.categories || [])
    byKey.set(key, {
      id: key,
      merchant,
      host,
      homeUrl: host ? homeUrlForHost(host) : null,
      offerCount: 1,
      imageUrl: offer.imageUrl || null,
      categories: [],
      catSet,
    })
  }

  return Array.from(byKey.values())
    .map(({ catSet, ...brand }) => ({
      ...brand,
      categories: Array.from(catSet).sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => b.offerCount - a.offerCount || a.merchant.localeCompare(b.merchant))
}

export async function listCueLinksBrands(opts?: { q?: string; limit?: number }) {
  const snap = await fetchCueLinksOffers()
  let items = brandsFromOffers(snap.offers)
  const q = (opts?.q || '').trim().toLowerCase()
  if (q) {
    items = items.filter((b) => {
      const hay = `${b.merchant} ${b.host || ''} ${b.categories.join(' ')}`.toLowerCase()
      return hay.includes(q)
    })
  }
  const limitRaw = opts?.limit
  const limit =
    limitRaw == null || Number.isNaN(Number(limitRaw))
      ? items.length
      : Math.min(items.length, Math.max(1, Number(limitRaw)))

  return {
    items: items.slice(0, limit),
    total: items.length,
    hosts: Array.from(new Set(items.map((b) => b.host).filter(Boolean) as string[])).sort(),
    catalogTotal: snap.offers.length,
    fetchedAt: new Date(snap.fetchedAt).toISOString(),
  }
}
