const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1'])

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '')
  if (BLOCKED_HOSTS.has(h)) return true
  if (/^10\.\d+\.\d+\.\d+$/.test(h)) return true
  if (/^192\.168\.\d+\.\d+$/.test(h)) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(h)) return true
  return false
}

/** Only http(s) destinations. never javascript:/data: open-redirects. */
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

/** Hosts that break login when framed or after cross-site hops (ITP / 3p cookies). */
export function needsFirstPartyCookies(raw: string | null | undefined): boolean {
  const host = browseHost(raw).toLowerCase()
  if (!host) return false
  return (
    host === 'flipkart.com' ||
    host.endsWith('.flipkart.com') ||
    host === 'shopsy.in' ||
    host.endsWith('.shopsy.in') ||
    host === 'myntra.com' ||
    host.endsWith('.myntra.com') ||
    host === 'amazon.in' ||
    host.endsWith('.amazon.in') ||
    host === 'amazon.com' ||
    host.endsWith('.amazon.com')
  )
}

/**
 * Affiliate click trackers can't be framed. Cookie-sensitive merchants must be
 * top-level (Flipkart login shows “enable cookies” inside iframes / ITP hops).
 */
export function mustOpenExternally(raw: string | null | undefined): boolean {
  return isAffiliateRedirectUrl(raw) || needsFirstPartyCookies(raw)
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

/** CueLinks / affiliate redirect. safe to auto-follow (not a merchant Universal Link). */
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

export function openStoreInSystemBrowser(raw: string | null | undefined): boolean {
  const url = sanitizeBrowseUrl(raw)
  if (!url || typeof window === 'undefined') return false
  const opened = window.open(url, '_blank', 'noopener,noreferrer')
  return Boolean(opened)
}

/**
 * Prefer the merchant website over affiliate redirects for ANY store URL.
 * Affiliate redirects frequently Universal-Link into installed apps.
 */
export function preferDirectSiteOpen(raw: string | null | undefined): boolean {
  if (!raw || isAffiliateRedirectUrl(raw)) return false
  return Boolean(browseHost(raw))
}

function withWebSource(u: URL) {
  if (!u.searchParams.get('source')) u.searchParams.set('source', 'web')
  if (!u.searchParams.get('utm_source')) u.searchParams.set('utm_source', 'yureka')
  return u
}

function stripAppDeepPath(u: URL) {
  const path = u.pathname || '/'
  if (
    path.startsWith('/dl/') ||
    path.startsWith('/app/') ||
    path.startsWith('/open/') ||
    path.startsWith('/deeplink') ||
    path === '/gp/aw/c.html'
  ) {
    u.pathname = '/'
  }
}

/** Prefer mobile-web entry points. still may open the native app on some iOS builds. */
export function mobileWebBrowseUrl(raw: string | null | undefined): string | null {
  const safe = sanitizeBrowseUrl(raw)
  if (!safe) return null
  try {
    const u = new URL(safe)
    let host = u.hostname.replace(/^www\./i, '').toLowerCase()

    // Collapse m.* app gateways to www.* when possible.
    if (host.startsWith('m.') && host.split('.').length >= 3) {
      host = host.slice(2)
      u.hostname = `www.${host}`
    }

    if (host === 'amazon.in' || host.endsWith('.amazon.in')) {
      u.hostname = 'www.amazon.in'
      const path = u.pathname.replace(/\/+$/, '') || '/'
      if (
        path === '/' ||
        path === '/gp/aw/c.html' ||
        path === '/gp/aw/h.html' ||
        path === '/gp/aw' ||
        path === '/ref=nav_logo'
      ) {
        u.pathname = '/'
        u.search = ''
        u.searchParams.set('ref_', 'nav_logo')
      }
      return u.toString()
    }
    if (host === 'amazon.com' || host.endsWith('.amazon.com')) {
      u.hostname = 'www.amazon.com'
      const path = u.pathname.replace(/\/+$/, '') || '/'
      if (
        path === '/' ||
        path === '/gp/aw/c.html' ||
        path === '/gp/aw/h.html' ||
        path === '/gp/aw'
      ) {
        u.pathname = '/'
        u.search = ''
        u.searchParams.set('ref_', 'nav_logo')
      }
      return u.toString()
    }
    if (host === 'flipkart.com' || host.endsWith('.flipkart.com')) {
      u.hostname = 'www.flipkart.com'
      stripAppDeepPath(u)
      // Clean www session so Flipkart login can set first-party cookies.
      withWebSource(u)
      if (!u.searchParams.get('otracker')) u.searchParams.set('otracker', 'web')
      return u.toString()
    }
    if (host === 'myntra.com' || host.endsWith('.myntra.com')) {
      u.hostname = 'www.myntra.com'
      stripAppDeepPath(u)
      return withWebSource(u).toString()
    }
    if (host === 'ajio.com' || host.endsWith('.ajio.com')) {
      u.hostname = 'www.ajio.com'
      stripAppDeepPath(u)
      return withWebSource(u).toString()
    }
    if (host === 'meesho.com' || host.endsWith('.meesho.com')) {
      u.hostname = 'www.meesho.com'
      stripAppDeepPath(u)
      return withWebSource(u).toString()
    }
    if (host === 'bookmyshow.com' || host.endsWith('.bookmyshow.com')) {
      u.hostname = 'in.bookmyshow.com'
      if (u.pathname === '/') u.pathname = '/explore/home'
      return withWebSource(u).toString()
    }
    if (host === 'swiggy.com' || host.endsWith('.swiggy.com')) {
      u.hostname = 'www.swiggy.com'
      if (!u.pathname || u.pathname === '/') u.pathname = '/instamart'
      return withWebSource(u).toString()
    }
    if (host === 'zeptonow.com' || host.endsWith('.zeptonow.com')) {
      u.hostname = 'www.zeptonow.com'
      return withWebSource(u).toString()
    }
    if (host === 'jiomart.com' || host.endsWith('.jiomart.com')) {
      u.hostname = 'www.jiomart.com'
      return withWebSource(u).toString()
    }
    if (host === 'bigbasket.com' || host.endsWith('.bigbasket.com')) {
      u.hostname = 'www.bigbasket.com'
      return withWebSource(u).toString()
    }
    if (host === 'blinkit.com' || host === 'grofers.com') {
      return withWebSource(u).toString()
    }
    if (host === 'uber.com' || host.endsWith('.uber.com')) {
      u.hostname = 'www.uber.com'
      if (!u.pathname || u.pathname === '/') u.pathname = '/in/en/'
      return withWebSource(u).toString()
    }
    if (host === 'makemytrip.com' || host.endsWith('.makemytrip.com')) {
      u.hostname = 'www.makemytrip.com'
      return withWebSource(u).toString()
    }
    if (host === 'goibibo.com' || host.endsWith('.goibibo.com')) {
      u.hostname = 'www.goibibo.com'
      return withWebSource(u).toString()
    }
    if (host === 'airindia.com' || host.endsWith('.airindia.com')) {
      u.hostname = 'www.airindia.com'
      return withWebSource(u).toString()
    }
    if (host === 'nykaa.com' || host.endsWith('.nykaa.com')) {
      u.hostname = 'www.nykaa.com'
      stripAppDeepPath(u)
      return withWebSource(u).toString()
    }
    if (host === 'pepejeans.in' || host.endsWith('.pepejeans.in') || host === 'pepejeans.com' || host.endsWith('.pepejeans.com')) {
      u.hostname = host.includes('.com') ? 'www.pepejeans.com' : 'www.pepejeans.in'
      stripAppDeepPath(u)
      return withWebSource(u).toString()
    }
    if (host === 'tatacliq.com' || host.endsWith('.tatacliq.com')) {
      u.hostname = 'www.tatacliq.com'
      stripAppDeepPath(u)
      return withWebSource(u).toString()
    }
    if (host === 'croma.com' || host.endsWith('.croma.com')) {
      u.hostname = 'www.croma.com'
      stripAppDeepPath(u)
      return withWebSource(u).toString()
    }
    if (host === 'shopsy.in' || host.endsWith('.shopsy.in')) {
      u.hostname = 'www.shopsy.in'
      stripAppDeepPath(u)
      return withWebSource(u).toString()
    }

    // Generic CueLinks merchant: force www + strip app deep links + web markers.
    if (!u.hostname.startsWith('www.') && host.split('.').length <= 3) {
      u.hostname = `www.${host}`
    }
    stripAppDeepPath(u)
    return withWebSource(u).toString()
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

/** Live store URL for framing when the host allows it. Never the HTML proxy. */
export function embedFrameSrc(raw: string | null | undefined): string | null {
  const url = sanitizeBrowseUrl(raw)
  if (!url || isAffiliateRedirectUrl(url) || needsFirstPartyCookies(url)) return null
  // Always return the merchant URL. callers detect X-Frame blocks and fall back in-shell.
  return mobileWebBrowseUrl(url) || url
}
