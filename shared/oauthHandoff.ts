/**
 * OAuth / PKCE must finish on the same origin that started sign-in.
 * If Supabase Site URL still points at the marketing host (or a temporary
 * sslip host), the `?code=` lands there first — exchanging it there stores
 * the session on the wrong origin and app.yureka.one looks "not logged in".
 *
 * Call this before mounting React / creating the Supabase client.
 */
export function oauthHandoffUrl(
  hostname = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '',
  search = typeof window !== 'undefined' ? window.location.search : '',
  hash = typeof window !== 'undefined' ? window.location.hash : '',
): string | null {
  if (typeof window === 'undefined') return null

  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const hasCode = params.has('code') || params.has('error') || params.has('error_description')
  const hasHashToken =
    hash.includes('access_token') || hash.includes('refresh_token') || hash.includes('error=')
  if (!hasCode && !hasHashToken) return null

  const isApp = hostname === 'app.yureka.one'
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1'
  if (isApp || isLocal) return null

  const appBase =
    (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, '') ||
    'https://app.yureka.one'

  const url = new URL(`${appBase}/login`)
  params.forEach((value, key) => {
    url.searchParams.set(key, value)
  })
  if (!url.searchParams.has('next')) {
    url.searchParams.set('next', '/dashboard')
  }
  if (hash) url.hash = hash.startsWith('#') ? hash : `#${hash}`
  return url.toString()
}
