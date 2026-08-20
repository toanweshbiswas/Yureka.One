import { listCueLinksOffersForHost } from '../cuelinks/client.js'
import { listOffers as listGoldbackOffers, recordClick } from '../goldback/store.js'
import { browseHost, sanitizeBrowseUrl, stampAffiliateSubId } from '../../../shared/inAppBrowse.js'
import { SUPER_BROWSE_STORES } from '../../../shared/superBrowseStores.js'

export type TrackedOpen = {
  openUrl: string
  destUrl: string
  host: string
  affiliate: boolean
  goldbackOfferId: string | null
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
  opts?: { record?: boolean },
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
    const aff = ranked.find((o) => o.affiliateUrl)?.affiliateUrl
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

  return { openUrl, destUrl, host, affiliate, goldbackOfferId }
}

export async function resolveSuperBrowseLinks(userId: string) {
  const links: Record<string, TrackedOpen> = {}
  for (const store of SUPER_BROWSE_STORES) {
    links[store.id] = await resolveTrackedOpen(store.url, userId, { record: false })
  }
  return links
}
