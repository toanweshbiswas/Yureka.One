const MERCHANT_DOMAINS: Record<string, string> = {
  nykaa: 'nykaa.com',
  amazon: 'amazon.in',
  swiggy: 'swiggy.com',
  myntra: 'myntra.com',
  flipkart: 'flipkart.com',
  ajio: 'ajio.com',
  zomato: 'zomato.com',
  blinkit: 'blinkit.com',
  bigbasket: 'bigbasket.com',
  jiomart: 'jiomart.com',
  zepto: 'zeptonow.com',
  meesho: 'meesho.com',
  bookmyshow: 'bookmyshow.com',
  makemytrip: 'makemytrip.com',
  goibibo: 'goibibo.com',
  uber: 'uber.com',
}

/** Same-origin marks shipped in /public. sharper than remote favicons. */
const LOCAL_LOGO_BY_HOST: Record<string, string> = {
  'amazon.in': '/assets/brand-logos/amazon-logo.png',
  'amazon.com': '/assets/brand-logos/amazon-logo.png',
  'flipkart.com': '/assets/brand-logos/flipkart-logo.png',
  'myntra.com': '/assets/brand-logos/myntra-logo.jpeg',
  'blinkit.com': '/assets/brand-logos/blinkit-logo.png',
  'zeptonow.com': '/assets/brand-logos/zepto-logo.png',
  'swiggy.com': '/assets/brand-logos/swiggy-logo.png',
  'ajio.com': '/assets/brand-logos/ajio-logo.jpeg',
  'bookmyshow.com': '/assets/brand-logos/bookmyshow-logo.png',
  'bigbasket.com': '/assets/brand-logos/bigbasket-logo.png',
  'meesho.com': '/assets/brand-logos/meesho-mark.svg',
  'makemytrip.com': '/assets/brand-logos/makemytrip-logo.png',
  'goibibo.com': '/assets/brand-logos/goibibo-logo.png',
  'jiomart.com': '/assets/brand-logos/jiomart-full.png',
  'uber.com': '/assets/brand-logos/uber-logo.png',
  'nykaa.com': '/assets/brand-logos/nykaa-logo.jpeg',
}

function localLogoForHost(host: string | null): string | null {
  if (!host) return null
  const h = host.toLowerCase().replace(/^www\./, '')
  return LOCAL_LOGO_BY_HOST[h] || null
}

const CUELINKS_CDN_HOSTS = new Set([
  'cdn0.cuelinks.com',
  'cdn.cuelinks.com',
  'cdn1.cuelinks.com',
  'cdn2.cuelinks.com',
])

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

export function hostnameFromUrl(pageUrl?: string | null): string | null {
  if (!pageUrl) return null
  try {
    const host = new URL(pageUrl).hostname.replace(/^www\./i, '')
    return host || null
  } catch {
    return null
  }
}

export function faviconUrl(domain: string): string {
  const host = String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/^www\./, '')
  if (!host) return ''
  const local = localLogoForHost(host)
  if (local) return local
  return `https://www.google.com/s2/favicons?sz=256&domain_url=${encodeURIComponent(`https://www.${host}`)}`
}

export function merchantLogoUrl(merchant?: string | null, pageUrl?: string | null): string | null {
  const fromUrl = hostnameFromUrl(pageUrl)
  if (fromUrl) return faviconUrl(fromUrl)
  if (!merchant) return null
  const mapped = MERCHANT_DOMAINS[slug(merchant)]
  if (mapped) return faviconUrl(mapped)
  return null
}

export function isCuelinksCdnHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, '')
  return CUELINKS_CDN_HOSTS.has(h) || h.endsWith('.cuelinks.com')
}

function absolutizeImageUrl(value: string): string | null {
  let next = value.trim()
  if (!next) return null
  if (next.startsWith('//')) next = `https:${next}`
  else if (next.startsWith('/')) next = `https://cdn0.cuelinks.com${next}`
  else if (/^http:\/\//i.test(next)) next = next.replace(/^http:\/\//i, 'https://')
  try {
    return new URL(next).toString()
  } catch {
    try {
      return new URL(encodeURI(next)).toString()
    } catch {
      return null
    }
  }
}

/** Same-origin proxy so ad blockers / hotlink rules don't blank CueLinks logos. */
export function throughMediaProxy(url: string): string {
  try {
    const parsed = new URL(url)
    if (isCuelinksCdnHost(parsed.hostname)) {
      return `/api/media/remote?url=${encodeURIComponent(parsed.toString())}`
    }
  } catch {
    /* keep original */
  }
  return url
}

/** CueLinks often returns `/photos/medium/missing.png` which 404s on our origin. */
export function resolveRemoteImageUrl(
  raw?: string | null,
  fallbackPageUrl?: string | null,
  merchant?: string | null,
): string | null {
  const value = String(raw || '').trim()
  const unusable =
    !value ||
    /missing\.png/i.test(value) ||
    value === 'null' ||
    value === 'undefined'

  if (!unusable) {
    const absolute = absolutizeImageUrl(value)
    if (absolute) return throughMediaProxy(absolute)
  }

  const fallback = merchantLogoUrl(merchant, fallbackPageUrl)
  return fallback
}
