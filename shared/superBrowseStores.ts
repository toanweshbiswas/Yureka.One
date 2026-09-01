import { localBrandLogo } from './localBrandLogos'
import { storeLogoSources } from './BrandLogo'
import catalog from './superBrowseCatalog.json'

export type SuperBrowseStore = {
  id: string
  name: string
  domain: string
  url: string
  cashback?: string
  bg: string
  logoUrl?: string | null
}

function withLocalLogo(
  store: Omit<SuperBrowseStore, 'logoUrl'> & { logoUrl?: string | null },
): SuperBrowseStore {
  const local = localBrandLogo(store.domain)
  const custom = String(store.logoUrl || '').trim()
  const weak =
    !custom ||
    /duckduckgo\.com\/ip3|google\.com\/s2\/favicons|gstatic\.com\/faviconV2/i.test(custom)
  return {
    ...store,
    logoUrl: weak ? local || custom || null : custom,
  }
}

const CATALOG_STORES: SuperBrowseStore[] = (catalog.stores || []).map((s) =>
  withLocalLogo({
    id: s.id,
    name: s.name,
    domain: s.domain,
    url: s.url,
    cashback: s.cashback ?? undefined,
    bg: s.bg || '#ffffff',
    logoUrl: s.logoUrl,
  }),
)

/** Offline / API-failure fallback — full imported catalog when available. */
export const SUPER_BROWSE_STORES: SuperBrowseStore[] = CATALOG_STORES.length
  ? CATALOG_STORES
  : [
      { id: 'amazon', name: 'Amazon', domain: 'amazon.in', url: 'https://www.amazon.in/ap/signin', cashback: '1%', bg: '#ffffff' },
      { id: 'flipkart', name: 'Flipkart', domain: 'flipkart.com', url: 'https://www.flipkart.com/', cashback: '2%', bg: '#2a55e6' },
      { id: 'myntra', name: 'Myntra', domain: 'myntra.com', url: 'https://www.myntra.com/', cashback: '4%', bg: '#ffffff' },
      { id: 'blinkit', name: 'Blinkit', domain: 'blinkit.com', url: 'https://blinkit.com/', cashback: '2%', bg: '#f8cb46' },
      { id: 'zepto', name: 'Zepto', domain: 'zeptonow.com', url: 'https://www.zeptonow.com/', cashback: '1%', bg: '#3b006a' },
      { id: 'instamart', name: 'Instamart', domain: 'swiggy.com', url: 'https://www.swiggy.com/instamart', bg: '#1b3c6e' },
      { id: 'ajio', name: 'Ajio', domain: 'ajio.com', url: 'https://www.ajio.com/', bg: '#2b2b2b' },
      { id: 'bms', name: 'BookMyShow', domain: 'bookmyshow.com', url: 'https://in.bookmyshow.com/', bg: '#c4242b' },
      { id: 'bigbasket', name: 'Bigbasket', domain: 'bigbasket.com', url: 'https://www.bigbasket.com/', cashback: '3%', bg: '#ffffff' },
      { id: 'meesho', name: 'Meesho', domain: 'meesho.com', url: 'https://www.meesho.com/', bg: '#4a1a5c' },
      { id: 'mmt', name: 'Makemytrip', domain: 'makemytrip.com', url: 'https://www.makemytrip.com/', bg: '#e31e24' },
      { id: 'jiomart', name: 'JioMart', domain: 'jiomart.com', url: 'https://www.jiomart.com/', cashback: '1%', bg: '#d71920' },
    ].map(withLocalLogo)

const EMBED_HOST_SUFFIXES = [
  'amazon.in',
  'amazon.com',
  'flipkart.com',
  'myntra.com',
  'blinkit.com',
  'zeptonow.com',
  'swiggy.com',
  'ajio.com',
  'bookmyshow.com',
  'bigbasket.com',
  'meesho.com',
  'makemytrip.com',
  'goibibo.com',
  'airindia.com',
  'jiomart.com',
  'uber.com',
  'clnk.in',
  'cuelinks.com',
  'linksredirect.com',
]

export function isEmbedHostAllowed(host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, '').replace(/\.$/, '')
  return EMBED_HOST_SUFFIXES.some((suffix) => h === suffix || h.endsWith(`.${suffix}`))
}

export function storeLogo(domain: string, logoUrl?: string | null) {
  return storeLogoSources(domain, logoUrl)[0] || ''
}

export function storeLogoFallbacks(domain: string, logoUrl?: string | null): string[] {
  return storeLogoSources(domain, logoUrl)
}

/** Fetch live Super Browse catalog; falls back to seed list offline. */
export async function fetchSuperBrowseStores(): Promise<SuperBrowseStore[]> {
  try {
    const res = await fetch('/api/super-browse/stores')
    if (!res.ok) return SUPER_BROWSE_STORES
    const json = (await res.json()) as { data?: SuperBrowseStore[] }
    if (Array.isArray(json.data) && json.data.length) {
      return json.data.map((s) => withLocalLogo(s))
    }
  } catch {
    // keep seed
  }
  return SUPER_BROWSE_STORES
}
