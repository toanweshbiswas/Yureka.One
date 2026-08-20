/**
 * Map universal links and `yureka://` URLs onto Expo Router paths.
 * Prefer native tabs for screens that are already nativized.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  try {
    const raw = path.trim()
    const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw)
    const url = hasScheme ? new URL(raw) : null
    const pathname = (url ? url.pathname : raw).replace(/\/+$/, '') || '/'
    const search = url?.searchParams

    if (pathname.includes('/auth/callback')) {
      const code = search?.get('code')
      return code ? `/auth/callback?code=${encodeURIComponent(code)}` : '/auth/callback'
    }

    const orderMatch = pathname.match(/\/giftcards\/orders\/([^/?#]+)/)
    if (orderMatch?.[1]) return `/(app)/(tabs)/giftcards/${orderMatch[1]}`

    if (pathname.includes('/dashboard/giftcards/orders/')) {
      const id = pathname.split('/').pop()
      if (id) return `/(app)/(tabs)/giftcards/${id}`
    }

    if (pathname.includes('/dashboard/home') || pathname === '/dashboard') return '/(app)/(tabs)/index'
    if (pathname.includes('/dashboard/offers')) return '/(app)/(tabs)/offers'
    if (pathname.includes('/dashboard/giftcards')) return '/(app)/(tabs)/giftcards'

    if (pathname.includes('/offers')) return '/(app)/(tabs)/offers'
    if (pathname.includes('/giftcards')) return '/(app)/(tabs)/giftcards'

    if (pathname.includes('/dashboard')) {
      const encoded = encodeURIComponent(pathname + (url?.search || ''))
      return `/(app)/web?path=${encoded}`
    }

    if (pathname.includes('/login') || pathname.includes('/signup')) return '/(auth)/login'
    if (pathname.includes('/waiting') || pathname.includes('/join-waitlist')) return '/(auth)/waiting'
    if (search?.get('code')) return '/auth/callback'
    if (!hasScheme) return path
    return '/'
  } catch {
    return path
  }
}
