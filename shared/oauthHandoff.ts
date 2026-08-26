/**
 * OAuth / PKCE must finish on the same origin that started sign-in.
 * If Supabase Site URL still points at the marketing host (or a temporary
 * sslip host), the `?code=` lands there first. exchanging it there stores
 * the session on the wrong origin.
 *
 * WanderWorld ops tags redirects with `portal=ww` (and may land on
 * `app.yureka.one/ww-oauth`) so a misrouted callback is bounced to
 * wanderworld.yureka.one *before* the Supabase client mounts / exchanges PKCE.
 *
 * Call this before mounting React / creating the Supabase client.
 */

function hashParams(hash: string) {
  return new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
}

export function isPasswordRecoveryCallback(
  pathname = typeof window !== 'undefined' ? window.location.pathname : '',
  search = typeof window !== 'undefined' ? window.location.search : '',
  hash = typeof window !== 'undefined' ? window.location.hash : '',
): boolean {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const hashP = hashParams(hash)
  const onResetPath =
    pathname === '/reset-password' ||
    pathname.startsWith('/reset-password/') ||
    pathname === '/brand/reset-password' ||
    pathname.startsWith('/brand/reset-password/') ||
    pathname === '/ww/reset-password' ||
    pathname.startsWith('/ww/reset-password/')
  const onWwHostReset =
    (typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '') ===
      'wanderworld.yureka.one' &&
    (pathname === '/reset-password' || pathname.startsWith('/reset-password/'))
  return (
    onResetPath ||
    onWwHostReset ||
    params.get('type') === 'recovery' ||
    hashP.get('type') === 'recovery' ||
    Boolean(params.get('token_hash')) ||
    Boolean(hashP.get('token_hash'))
  )
}

function wanderworldBase() {
  return (
    (import.meta.env.VITE_WANDERWORLD_URL as string | undefined)?.replace(/\/$/, '') ||
    'https://wanderworld.yureka.one'
  )
}

function appBase() {
  return (
    (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, '') ||
    'https://app.yureka.one'
  )
}

/** Auth intended for WanderWorld ops (invite / Google / email confirm). */
export function wantsWanderworldPortal(
  search = typeof window !== 'undefined' ? window.location.search : '',
  pathname = typeof window !== 'undefined' ? window.location.pathname : '',
): boolean {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const portal = (params.get('portal') || '').toLowerCase()
  const next = params.get('next') || ''
  if (pathname === '/ww-oauth' || pathname.startsWith('/ww-oauth/')) return true
  if (portal === 'ww' || portal === 'wanderworld') return true
  if (pathname === '/ww' || pathname.startsWith('/ww/')) return true
  if (next === '/ww' || next.startsWith('/ww/')) return true
  return false
}

function buildHandoffUrl(
  base: string,
  destPath: string,
  params: URLSearchParams,
  hash: string,
  defaultNext: string,
) {
  const url = new URL(`${base}${destPath}`)
  params.forEach((value, key) => {
    url.searchParams.set(key, value)
  })
  if ((destPath === '/login' || destPath.endsWith('/login')) && !url.searchParams.has('next')) {
    url.searchParams.set('next', defaultNext)
  }
  if (hash) url.hash = hash.startsWith('#') ? hash : `#${hash}`
  return url.toString()
}

function wwAuthDest(pathname: string, search: string, hash: string) {
  const recovery = isPasswordRecoveryCallback(pathname, search, hash)
  if (recovery) return '/reset-password'
  if (pathname.includes('signup')) return '/signup'
  return '/login'
}

export function oauthHandoffUrl(
  hostname = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '',
  search = typeof window !== 'undefined' ? window.location.search : '',
  hash = typeof window !== 'undefined' ? window.location.hash : '',
  pathname = typeof window !== 'undefined' ? window.location.pathname : '',
): string | null {
  if (typeof window === 'undefined') return null

  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const hasCode = params.has('code') || params.has('error') || params.has('error_description')
  const hasHashToken =
    hash.includes('access_token') || hash.includes('refresh_token') || hash.includes('error=')
  const wantsWw = wantsWanderworldPortal(search, pathname)
  const isApp = hostname === 'app.yureka.one'
  const isBrand = hostname === 'brand.yureka.one'
  const isWanderworld = hostname === 'wanderworld.yureka.one'
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1'

  // Combined SPA / already on ops host. exchange here.
  if (isWanderworld || isLocal) return null

  // App or marketing received a WW callback. bounce before PKCE exchange.
  if (wantsWw && !isBrand) {
    const nextParams = new URLSearchParams(params)
    nextParams.set('portal', 'ww')
    const next = nextParams.get('next')
    if (!next || next === '/dashboard' || next.startsWith('/dashboard')) {
      nextParams.set('next', '/')
    }
    return buildHandoffUrl(
      wanderworldBase(),
      wwAuthDest(pathname, search, hash),
      nextParams,
      hash,
      '/',
    )
  }

  if (!hasCode && !hasHashToken) return null
  if (isApp || isBrand) return null

  // Marketing / unknown host → app (legacy Site URL handoff).
  const dest = isPasswordRecoveryCallback(pathname, search, hash) ? '/reset-password' : '/login'
  return buildHandoffUrl(appBase(), dest, params, hash, '/dashboard')
}
