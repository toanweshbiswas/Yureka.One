/** Home-screen PWA (Add to Home Screen) vs Safari/Chrome tabs vs native Expo. */

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false
  const mq = window.matchMedia('(display-mode: standalone)').matches
  const ios = Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return mq || ios
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function isLikelyMobile(): boolean {
  if (typeof window === 'undefined') return false
  if (isIosDevice() || /Android/i.test(navigator.userAgent)) return true
  return window.matchMedia('(max-width: 900px)').matches || navigator.maxTouchPoints > 1
}

function isNativeExpoShell(): boolean {
  if (typeof window === 'undefined') return false
  if (window.navigator.userAgent.includes('YurekaApp')) return true
  if (new URLSearchParams(window.location.search).get('embedded') === '1') return true
  try {
    return sessionStorage.getItem('yureka-embedded') === '1'
  } catch {
    return false
  }
}

/** In-app store iframe: installed mobile PWA only — not desktop, Safari tabs, or the native Expo app. */
export function canUseInAppBrowse(): boolean {
  return isStandalonePwa() && isLikelyMobile() && !isNativeExpoShell()
}
