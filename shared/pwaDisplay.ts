/** Home-screen PWA (Add to Home Screen) vs Safari/Chrome tabs vs native Expo. */

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false
  const nav = navigator as Navigator & { standalone?: boolean }
  if (nav.standalone) return true

  // Android Chrome / Samsung Internet / TWA can report several installed modes.
  const modes = ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'] as const
  if (modes.some((mode) => window.matchMedia(`(display-mode: ${mode})`).matches)) return true

  // Trusted Web Activity / Android app wrapper.
  try {
    if (document.referrer.startsWith('android-app://')) return true
  } catch {
    /* ignore */
  }

  // Explicit PWA launch markers we set ourselves.
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('source') === 'pwa') {
      sessionStorage.setItem('yureka-pwa', '1')
      return true
    }
    if (sessionStorage.getItem('yureka-pwa') === '1') return true
  } catch {
    /* ignore */
  }

  return false
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/Android/i.test(ua)) return true
  // Some WebViews omit "Android" but still expose Linux + mobile Chrome.
  if (/Linux/i.test(ua) && /Mobile|wv\)/i.test(ua) && !isIosDevice()) return true
  return false
}

export function isLikelyMobile(): boolean {
  if (typeof window === 'undefined') return false
  if (isIosDevice() || isAndroidDevice()) return true
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

export function systemBrowserLabel(): string {
  if (isIosDevice()) return 'Safari'
  if (isAndroidDevice()) return 'Chrome'
  return 'your browser'
}
