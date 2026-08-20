const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1'])

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '')
  if (BLOCKED_HOSTS.has(h)) return true
  if (/^10\.\d+\.\d+\.\d+$/.test(h)) return true
  if (/^192\.168\.\d+\.\d+$/.test(h)) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(h)) return true
  return false
}

/** Only http(s) destinations — never javascript:/data: open-redirects. */
export function sanitizeBrowseUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const url = new URL(raw.trim())
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (url.username || url.password) return null
    if (isPrivateHost(url.hostname)) return null
    url.protocol = 'https:'
    return url.toString()
  } catch {
    return null
  }
}

export function browseHost(raw: string | null | undefined): string {
  const safe = sanitizeBrowseUrl(raw)
  if (!safe) return ''
  try {
    return new URL(safe).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}

/**
 * These hosts refuse iframes (X-Frame-Options / CSP) or rate-limit embedded
 * WebViews ("max requests exceeded", blank grocery SPAs). Open in Safari/Chrome.
 *
 * Flipkart, Myntra, Ajio, Meesho, travel, etc. load in the in-app browser on PWA.
 */
const EXTERNAL_ONLY_SUFFIXES = [
  'amazon.in',
  'amazon.com',
  'blinkit.com',
  'grofers.com',
  'bigbasket.com',
  'zeptonow.com',
  'swiggy.com',
  'jiomart.com',
  'bookmyshow.com',
  'makemytrip.com',
  'goibibo.com',
  'airindia.com',
  'uber.com',
]

const PREFER_DIRECT_SITE_SUFFIXES = [
  'amazon.in',
  'amazon.com',
  'blinkit.com',
  'grofers.com',
  'bigbasket.com',
  'zeptonow.com',
  'swiggy.com',
  'jiomart.com',
  'bookmyshow.com',
]

export function mustOpenExternally(raw: string | null | undefined): boolean {
  const host = browseHost(raw)
  if (!host) return false
  return EXTERNAL_ONLY_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))
}

export function openStoreInSystemBrowser(raw: string | null | undefined): boolean {
  const url = sanitizeBrowseUrl(raw)
  if (!url || typeof window === 'undefined') return false
  const opened = window.open(url, '_blank', 'noopener,noreferrer')
  return Boolean(opened)
}

/** Some merchants' affiliate redirects hand off to the native app; prefer web URL directly. */
export function preferDirectSiteOpen(raw: string | null | undefined): boolean {
  const host = browseHost(raw)
  if (!host) return false
  return PREFER_DIRECT_SITE_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))
}

/** CueLinks / Impact-style click id so conversions in Safari still map to this user. */
export function stampAffiliateSubId(raw: string, userId: string): string {
  const id = userId.trim().slice(0, 64)
  if (!id) return raw
  try {
    const u = new URL(raw)
    if (!u.searchParams.get('subid') && !u.searchParams.get('sub_id') && !u.searchParams.get('s1')) {
      u.searchParams.set('subid', id)
    }
    return u.toString()
  } catch {
    return raw
  }
}

/** CueLinks / affiliate redirect — safe to auto-follow (not a merchant Universal Link). */
export function isAffiliateRedirectUrl(raw: string | null | undefined): boolean {
  const safe = sanitizeBrowseUrl(raw)
  if (!safe) return false
  try {
    const host = new URL(safe).hostname.replace(/^www\./i, '').toLowerCase()
    return (
      host === 'linksredirect.com' ||
      host === 'clnk.in' ||
      host.endsWith('.cuelinks.com') ||
      host === 'cuelinks.com'
    )
  } catch {
    return false
  }
}

/** Prefer mobile-web entry points — still may open the native app on some iOS builds. */
export function mobileWebBrowseUrl(raw: string | null | undefined): string | null {
  const safe = sanitizeBrowseUrl(raw)
  if (!safe) return null
  try {
    const u = new URL(safe)
    const host = u.hostname.replace(/^www\./i, '').toLowerCase()
    if (host === 'amazon.in' || host.endsWith('.amazon.in')) {
      u.pathname = '/gp/aw/c.html'
      u.search = ''
      return u.toString()
    }
    if (host === 'amazon.com' || host.endsWith('.amazon.com')) {
      u.pathname = '/gp/aw/c.html'
      u.search = ''
      return u.toString()
    }
    if (host === 'flipkart.com') {
      u.hostname = 'www.flipkart.com'
      if (u.pathname.startsWith('/dl/')) u.pathname = '/'
      return u.toString()
    }
    if (host === 'myntra.com') {
      u.hostname = 'www.myntra.com'
      return u.toString()
    }
    if (host === 'bookmyshow.com' || host.endsWith('.bookmyshow.com')) {
      u.hostname = 'in.bookmyshow.com'
      if (u.pathname === '/') u.pathname = '/explore/home'
      return u.toString()
    }
    if (host === 'swiggy.com' || host.endsWith('.swiggy.com')) {
      u.hostname = 'www.swiggy.com'
      if (!u.pathname || u.pathname === '/') u.pathname = '/instamart'
      u.searchParams.set('source', 'web')
      return u.toString()
    }
    if (host === 'zeptonow.com' || host.endsWith('.zeptonow.com')) {
      u.hostname = 'www.zeptonow.com'
      u.searchParams.set('source', 'web')
      return u.toString()
    }
    if (host === 'jiomart.com' || host.endsWith('.jiomart.com')) {
      u.hostname = 'www.jiomart.com'
      u.searchParams.set('source', 'web')
      return u.toString()
    }
    if (host === 'bigbasket.com' || host.endsWith('.bigbasket.com')) {
      u.hostname = 'www.bigbasket.com'
      u.searchParams.set('source', 'web')
      return u.toString()
    }
    if (host === 'blinkit.com' || host === 'grofers.com') {
      u.searchParams.set('source', 'web')
      return u.toString()
    }
    return safe
  } catch {
    return safe
  }
}

export function browsePath(opts: { url: string; title?: string; returnTo?: string }): string | null {
  const url = sanitizeBrowseUrl(opts.url)
  if (!url) return null
  const params = new URLSearchParams()
  params.set('url', url)
  if (opts.title?.trim()) params.set('title', opts.title.trim())
  if (opts.returnTo?.trim()) params.set('from', opts.returnTo.trim())
  return `/dashboard/browse?${params.toString()}`
}

export function explorePath(sceneId: string, brand?: string) {
  const params = new URLSearchParams()
  if (brand) params.set('brand', brand)
  const q = params.toString()
  return q ? `/dashboard/explore/${sceneId}?${q}` : `/dashboard/explore/${sceneId}`
}

/** Live store URL for hosts that still allow framing. Never the HTML proxy — SPAs break and trip rate limits. */
export function embedFrameSrc(raw: string | null | undefined): string | null {
  const url = sanitizeBrowseUrl(raw)
  if (!url || mustOpenExternally(url)) return null
  return url
}
