import { resolveSiteRole } from '@shared/hosts'

/** Publisher ID from AdSense → Account → Account information. */
export const ADSENSE_CLIENT = (
  import.meta.env.VITE_GOOGLE_ADSENSE_CLIENT as string | undefined
)?.trim()

export type AdPlacementId = 'dashboard-home-footer'

type PlacementConfig = {
  /** Env key for the ad unit slot ID (AdSense → Ads → By ad unit). */
  slotEnv: string
  format: 'auto' | 'horizontal' | 'rectangle' | 'vertical'
  fullWidthResponsive: boolean
  label: string
}

export const AD_PLACEMENTS: Record<AdPlacementId, PlacementConfig> = {
  'dashboard-home-footer': {
    slotEnv: 'VITE_ADSENSE_SLOT_HOME_FOOTER',
    format: 'auto',
    fullWidthResponsive: true,
    label: 'App home footer',
  },
}

export function slotForPlacement(id: AdPlacementId): string {
  const key = AD_PLACEMENTS[id].slotEnv
  return String((import.meta.env as Record<string, string | undefined>)[key] || '').trim()
}

/** Hosts where the AdSense library may load (site verification + serving). */
export function isAdsenseScriptHost(hostname = typeof window !== 'undefined' ? window.location.hostname : '') {
  const role = resolveSiteRole(hostname.toLowerCase())
  return role === 'landing' || role === 'app' || role === 'all'
}

/** Hosts where display ad units render (product app only). */
export function isAdsenseAdUnitHost(hostname = typeof window !== 'undefined' ? window.location.hostname : '') {
  const role = resolveSiteRole(hostname.toLowerCase())
  if (role === 'app') return true
  if (role === 'all' && typeof window !== 'undefined') {
    return window.location.pathname.startsWith('/dashboard')
  }
  return false
}

/** @deprecated use isAdsenseAdUnitHost */
export function isAdsenseAppHost(hostname?: string) {
  return isAdsenseAdUnitHost(hostname)
}

export function isAdsenseScriptEnabled() {
  if (!ADSENSE_CLIENT) return false
  if (import.meta.env.VITE_GOOGLE_ADSENSE_ENABLED === 'false') return false
  return isAdsenseScriptHost()
}

export function isAdsenseEnabled() {
  if (!isAdsenseScriptEnabled()) return false
  return isAdsenseAdUnitHost()
}

let scriptPromise: Promise<void> | null = null

export function loadAdsenseScript(client = ADSENSE_CLIENT): Promise<void> {
  if (!client) return Promise.resolve()
  if (typeof document === 'undefined') return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-adsense-client="${client}"]`,
    )
    if (existing) {
      if (existing.dataset.loaded === '1') resolve()
      else existing.addEventListener('load', () => resolve(), { once: true })
      return
    }

    const script = document.createElement('script')
    script.async = true
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`
    script.crossOrigin = 'anonymous'
    script.setAttribute('data-adsense-client', client)
    script.onload = () => {
      script.dataset.loaded = '1'
      resolve()
    }
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('AdSense script failed to load'))
    }
    document.head.appendChild(script)
  })

  return scriptPromise
}

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[]
  }
}
