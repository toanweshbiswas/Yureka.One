import { listCueLinksOffersForHost } from '../cuelinks/client.js'
import { listOffers as listGoldbackOffers, recordClick } from '../goldback/store.js'
import { browseHost, isAffiliateRedirectUrl, sanitizeBrowseUrl, stampAffiliateSubId } from '../../../shared/inAppBrowse.js'
import { SUPER_BROWSE_STORES } from '../../../shared/superBrowseStores.js'
import { listSuperBrowseStores } from '../superBrowse/store.js'
import { recordBrowseClick, type BrowseClickSource } from './store.js'

export type TrackedOpen = {
  openUrl: string
  destUrl: string
  host: string
  affiliate: boolean
  goldbackOfferId: string | null
}

export type ResolveTrackedOpenOpts = {
  record?: boolean
  storeId?: string | null
  storeName?: string | null
  source?: BrowseClickSource
  openedUrl?: string | null
}

function hostMatches(offerUrl: string, destHost: string): boolean {
  try {
    const oh = new URL(offerUrl).hostname.replace(/^www\./i, '').toLowerCase()
    return oh === destHost || oh.endsWith(`.${destHost}`) || destHost.endsWith(`.${oh}`)
  } catch {
    return false
  }
}

export async function resolveTrackedOpen(
  rawUrl: string,
  userId: string,
  opts?: ResolveTrackedOpenOpts,
): Promise<TrackedOpen> {
  const destUrl = sanitizeBrowseUrl(rawUrl)
  if (!destUrl) {
    throw new Error('Invalid store link')
  }
  const host = browseHost(destUrl)
  let openUrl = destUrl
  let affiliate = false
  let goldbackOfferId: string | null = null

  try {
    const market = await listCueLinksOffersForHost(host, 12)
    const ranked = [...market.items].sort((a, b) => {
      const aHit = hostMatches(a.url || a.affiliateUrl, host) ? 0 : 1
      const bHit = hostMatches(b.url || b.affiliateUrl, host) ? 0 : 1
      return aHit - bHit
    })
    const aff = ranked.find((o) => {
      const link = sanitizeBrowseUrl(o.affiliateUrl)
      return Boolean(link && isAffiliateRedirectUrl(link))
    })?.affiliateUrl
    if (aff) {
      openUrl = stampAffiliateSubId(aff, userId)
      affiliate = true
    }
  } catch {
    /* catalog optional */
  }

  try {
    const offers = await listGoldbackOffers()
    const match = offers.find((o) => {
      if (!o.active) return false
      if (hostMatches(o.url, host)) return true
      const hay = `${o.merchant} ${o.title} ${o.url}`.toLowerCase()
      const slug = host.split('.')[0] || host
      return slug.length >= 3 && hay.includes(slug)
    })
    if (match) {
      goldbackOfferId = match.id
      if (opts?.record !== false) await recordClick(userId, match.id)
    }
  } catch {
    /* goldback optional */
  }

  if (opts?.record !== false) {
    const openedRaw = sanitizeBrowseUrl(opts?.openedUrl || '') || (affiliate ? openUrl : destUrl)
    void recordBrowseClick({
      userId,
      storeId: opts?.storeId ?? null,
      storeName: opts?.storeName ?? null,
      destUrl,
      openedUrl: openedRaw || destUrl,
      host,
      affiliate: Boolean(isAffiliateRedirectUrl(openedRaw || openUrl)),
      goldbackOfferId,
      source: opts?.source,
    }).catch((e) => console.warn('[browse] record failed:', (e as Error)?.message || e))
  }

  return { openUrl, destUrl, host, affiliate, goldbackOfferId }
}

export async function resolveSuperBrowseLinks(userId: string) {
  const links: Record<string, TrackedOpen> = {}
  let stores = SUPER_BROWSE_STORES
  try {
    const live = await listSuperBrowseStores()
    if (live.length) {
      stores = live.map((s) => ({
        id: s.id,
        name: s.name,
        domain: s.domain,
        url: s.url,
        cashback: s.cashback || undefined,
        bg: s.bg,
        logoUrl: s.logoUrl,
      }))
    }
  } catch {
    /* seed fallback */
  }
  await Promise.all(
    stores.map(async (store) => {
      links[store.id] = await resolveTrackedOpen(store.url, userId, { record: false })
    }),
  )
  return links
}
