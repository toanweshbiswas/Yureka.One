/**
 * Multi-domain host helpers.
 *
 * Production:
 *   yureka.one / www.yureka.one  → marketing landing
 *   app.yureka.one               → waitlist / login / dashboard
 *   admin.yureka.one             → backoffice
 *   brand.yureka.one             → partner portal
 *
 * Temporary sslip.io / nip.io hosts permanently redirect to the production
 * map above (cutover). Localhost stays all-in-one for local/dev.
 */

export type SiteRole = 'landing' | 'app' | 'admin' | 'brand' | 'all'

const LANDING_HOSTS = new Set(['yureka.one', 'www.yureka.one'])
const APP_HOSTS = new Set(['app.yureka.one'])
const ADMIN_HOSTS = new Set(['admin.yureka.one'])
const BRAND_HOSTS = new Set(['brand.yureka.one'])

export const APP_PATH_PREFIXES = [
  '/login',
  '/signup',
  '/join-waitlist',
  '/waiting',
  '/reset-password',
  '/dashboard',
] as const

export const BRAND_PATH_PREFIXES = ['/brand'] as const

function trimSlash(url: string) {
  return url.replace(/\/$/, '')
}

function envUrl(key: string, fallback: string) {
  const raw = (import.meta.env[key] as string | undefined)?.trim()
  return trimSlash(raw || fallback)
}

export function landingOrigin() {
  return envUrl('VITE_LANDING_URL', 'https://yureka.one')
}

export function appOrigin() {
  return envUrl('VITE_APP_URL', 'https://app.yureka.one')
}

export function adminOrigin() {
  return envUrl('VITE_ADMIN_PORTAL_URL', 'https://admin.yureka.one')
}

export function brandOrigin() {
  return envUrl('VITE_BRAND_URL', 'https://brand.yureka.one')
}

export function currentHostname() {
  if (typeof window === 'undefined') return ''
  return window.location.hostname.toLowerCase()
}

export function isTemporaryPublicHost(hostname = currentHostname()) {
  return hostname.endsWith('.sslip.io') || hostname.endsWith('.nip.io')
}

export function resolveSiteRole(hostname = currentHostname()): SiteRole {
  if (!hostname) return 'all'
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'all'
  // Temporary hosts are redirected away; treat as combined until the jump.
  if (isTemporaryPublicHost(hostname)) return 'all'
  if (ADMIN_HOSTS.has(hostname)) return 'admin'
  if (BRAND_HOSTS.has(hostname)) return 'brand'
  if (APP_HOSTS.has(hostname)) return 'app'
  if (LANDING_HOSTS.has(hostname)) return 'landing'
  // Unknown hosts (preview IPs, Elastic IP): keep combined SPA.
  return 'all'
}

export function isSplitHostsEnabled(hostname = currentHostname()) {
  const role = resolveSiteRole(hostname)
  return role === 'landing' || role === 'app' || role === 'admin' || role === 'brand'
}

/** Absolute URL helper — same-origin when hosts are combined. */
export function absoluteUrl(origin: string, path: string) {
  const p = path.startsWith('/') ? path : `/${path}`
  if (!isSplitHostsEnabled() && !isTemporaryPublicHost()) {
    return p
  }
  return `${trimSlash(origin)}${p}`
}

export function landingUrl(path = '/') {
  return absoluteUrl(landingOrigin(), path)
}

export function appUrl(path = '/') {
  return absoluteUrl(appOrigin(), path)
}

export function adminUrl(path = '/admin') {
  return absoluteUrl(adminOrigin(), path)
}

export function brandUrl(path = '/brand') {
  return absoluteUrl(brandOrigin(), path)
}

function pathStartsWith(pathname: string, prefixes: readonly string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/** Map any path onto the correct production origin (used for sslip cutover). */
export function productionUrlForPath(pathname: string, search = '', hash = '') {
  const rest = `${pathname}${search}${hash}`
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return `${adminOrigin()}${rest === '/admin' ? '/admin' : rest}`
  }
  if (pathStartsWith(pathname, BRAND_PATH_PREFIXES)) {
    return `${brandOrigin()}${rest === '/brand' ? '/brand' : rest}`
  }
  if (pathStartsWith(pathname, APP_PATH_PREFIXES)) {
    return `${appOrigin()}${rest}`
  }
  return `${landingOrigin()}${rest === '/' ? '/' : rest}`
}

/** Hard navigation when the target lives on another subdomain. */
export function goExternal(url: string) {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    window.location.replace(url)
    return
  }
  window.location.assign(url)
}
