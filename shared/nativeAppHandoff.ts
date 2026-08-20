/** Hand off mobile Safari OAuth / deep links to the native Yureka app. */

export const NATIVE_APP_SCHEME = 'yureka'

export function nativeAuthCallbackUrl(code: string) {
  return `${NATIVE_APP_SCHEME}://auth/callback?code=${encodeURIComponent(code)}`
}

export function isEmbeddedNativeWebView() {
  if (typeof window === 'undefined') return false
  if (window.navigator.userAgent.includes('YurekaApp')) return true
  return new URLSearchParams(window.location.search).get('embedded') === '1'
}

export function isMobileBrowser() {
  if (typeof window === 'undefined') return false
  return /iPhone|iPad|iPod|Android/i.test(window.navigator.userAgent)
}

/** True when the user is in mobile Safari/Chrome on app.yureka.one (not the native shell). */
export function shouldHandoffToNativeApp() {
  return isMobileBrowser() && !isEmbeddedNativeWebView()
}

export function tryHandoffOAuthCodeToNativeApp(code: string) {
  if (!shouldHandoffToNativeApp()) return false
  window.location.replace(nativeAuthCallbackUrl(code))
  return true
}

export function tryOpenNativeApp(path = '') {
  const trimmed = path.replace(/^\//, '')
  window.location.href = trimmed ? `${NATIVE_APP_SCHEME}://${trimmed}` : `${NATIVE_APP_SCHEME}://`
}
