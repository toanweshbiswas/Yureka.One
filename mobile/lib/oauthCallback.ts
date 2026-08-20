import { router } from 'expo-router'

const exchangedCodes = new Set<string>()

export function routeOAuthCallback(code: string) {
  if (exchangedCodes.has(code)) return
  exchangedCodes.add(code)
  router.replace(`/auth/callback?code=${encodeURIComponent(code)}`)
}

export function markCodeExchanged(code: string) {
  exchangedCodes.add(code)
}

export function wasCodeExchanged(code: string) {
  return exchangedCodes.has(code)
}
