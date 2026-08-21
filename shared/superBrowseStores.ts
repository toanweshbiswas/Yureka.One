export type SuperBrowseStore = {
  id: string
  name: string
  domain: string
  url: string
  cashback?: string
  bg: string
  logoUrl?: string | null
}

export const SUPER_BROWSE_STORES: SuperBrowseStore[] = [
  { id: 'amazon', name: 'Amazon', domain: 'amazon.in', url: 'https://www.amazon.in/', cashback: '1%', bg: '#ffffff' },
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
]

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
  const host = String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
  const custom = String(logoUrl || '').trim()
  if (custom && /^https?:\/\//i.test(custom)) return custom
  if (!host) return ''
  // Prefer DuckDuckGo — Google s2 often blanks in PWA / Safari.
  return `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`
}

export function storeLogoFallbacks(domain: string, logoUrl?: string | null): string[] {
  const host = String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
  const out: string[] = []
  const custom = String(logoUrl || '').trim()
  if (custom && /^https?:\/\//i.test(custom)) out.push(custom)
  if (host) {
    out.push(`https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`)
    out.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`)
  }
  return out
}

/** Fetch live Super Browse catalog; falls back to seed list offline. */
export async function fetchSuperBrowseStores(): Promise<SuperBrowseStore[]> {
  try {
    const res = await fetch('/api/super-browse/stores')
    if (!res.ok) return SUPER_BROWSE_STORES
    const json = (await res.json()) as { data?: SuperBrowseStore[] }
    if (Array.isArray(json.data) && json.data.length) return json.data
  } catch {
    // keep seed
  }
  return SUPER_BROWSE_STORES
}
