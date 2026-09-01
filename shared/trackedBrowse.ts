import { api, isApiError } from '@backend/lib/api/client'
import {
  browsePath,
  isAffiliateRedirectUrl,
  mobileWebBrowseUrl,
  needsFirstPartyCookies,
  stampAffiliateSubId,
  sanitizeBrowseUrl,
} from '@shared/inAppBrowse'
import { rememberBrowseReturn, saveDashboardScroll } from '@shared/dashboardScroll'
import { canUseInAppBrowse, isAndroidDevice, isStandalonePwa } from '@shared/pwaDisplay'
import { getAuthAccessToken } from '@shared/auth'

export type BrowseClickSource = 'super_browse' | 'explore' | 'offers' | 'manual' | 'unknown'

export type TrackedOpen = {
  openUrl: string
  destUrl: string
  host: string
  affiliate: boolean
  goldbackOfferId: string | null
}

export type TrackBrowseOpts = {
  record?: boolean
  storeId?: string | null
  storeName?: string | null
  source?: BrowseClickSource
  openedUrl?: string | null
}

export async function resolveTrackedOpen(
  url: string,
  userId: string,
  recordOrOpts: boolean | TrackBrowseOpts = true,
): Promise<TrackedOpen | null> {
  const safe = sanitizeBrowseUrl(url)
  if (!safe) return null
  const opts: TrackBrowseOpts =
    typeof recordOrOpts === 'boolean' ? { record: recordOrOpts } : recordOrOpts
  const res = await api.post<TrackedOpen>(
    '/api/browse/out',
    {
      url: safe,
      record: opts.record !== false,
      storeId: opts.storeId ?? undefined,
      storeName: opts.storeName ?? undefined,
      source: opts.source ?? undefined,
      openedUrl: opts.openedUrl ?? undefined,
    },
    { headers: { 'x-user-id': userId }, timeoutMs: 8000 },
  )
  if (isApiError(res) || !res.data) return null
  return res.data
}

export async function prefetchSuperBrowseLinks(userId: string) {
  const res = await api.get<{ links: Record<string, TrackedOpen> }>('/api/browse/super-browse', {
    headers: { 'x-user-id': userId },
    timeoutMs: 12000,
  })
  if (isApiError(res) || !res.data?.links) return {} as Record<string, TrackedOpen>
  return res.data.links
}

/** Resolve CueLinks / goldback for a subset of stores (e.g. home grid tiles). */
export async function prefetchStoreLinks(
  userId: string,
  stores: Array<{ id: string; url: string }>,
): Promise<Record<string, TrackedOpen>> {
  const links: Record<string, TrackedOpen> = {}
  await Promise.all(
    stores.map(async (store) => {
      const tracked = await resolveTrackedOpen(store.url, userId, { record: false })
      if (tracked) links[store.id] = tracked
    }),
  )
  return links
}

export type StoreBrowseTarget =
  | { mode: 'in-app'; path: string }
  | { mode: 'external'; url: string }

/** In-app Yureka browse shell when navigate is available; else system browser. */
export function storeBrowseTarget(
  url: string,
  opts?: { title?: string; returnTo?: string; allowInAppShell?: boolean },
): StoreBrowseTarget | null {
  const safe = sanitizeBrowseUrl(url)
  if (!safe) return null

  // Affiliate click trackers can't be framed. must open outside.
  if (isAffiliateRedirectUrl(safe)) {
    return { mode: 'external', url: safe }
  }

  // Super Browse / home tiles pass navigate → always stay inside Yureka's browse chrome.
  // That avoids Universal Links into Amazon/Pepe/etc. from window.open.
  const allowShell = opts?.allowInAppShell !== false
  if (allowShell && (canUseInAppBrowse() || opts?.allowInAppShell === true)) {
    const path = browsePath({
      url: safe,
      title: opts?.title,
      returnTo: opts?.returnTo || '/dashboard/browse',
    })
    if (path) return { mode: 'in-app', path }
  }

  if (!canUseInAppBrowse()) {
    return { mode: 'external', url: safe }
  }

  const path = browsePath({
    url: safe,
    title: opts?.title,
    returnTo: opts?.returnTo || '/dashboard/browse',
  })
  if (!path) return { mode: 'external', url: safe }
  return { mode: 'in-app', path }
}

/**
 * Record affiliate / goldback, then open.
 * If CueLinks is available → window.open the CueLinks URL (provider credit).
 * If not → window.open the standard merchant URL.
 */
export async function openStoreBrowse(
  url: string,
  userId: string,
  opts?: {
    knownOpenUrl?: string
    title?: string
    returnTo?: string
    navigate?: (path: string) => void
    storeId?: string | null
    storeName?: string | null
    source?: BrowseClickSource
    /**
     * When true, open the merchant website.
     * When false, open CueLinks (when knownOpenUrl / resolve finds one).
     * Default: CueLinks if available, else standard.
     */
    preferWeb?: boolean
    /**
     * Always window.open externally (never /dashboard/browse iframe).
     * Default true. providers reject in-app / beacon-only clicks.
     */
    forceExternal?: boolean
  },
) {
  const returnTo = opts?.returnTo || '/dashboard/browse'
  const forceExternal = opts?.forceExternal !== false
  const safe = sanitizeBrowseUrl(url)
  if (!safe) return

  const known = sanitizeBrowseUrl(opts?.knownOpenUrl || '')
  const cueAvailable = Boolean(known && isAffiliateRedirectUrl(known))
  // CueLinks when available; otherwise standard merchant URL.
  const preferWeb = opts?.preferWeb ?? !cueAvailable

  // Persist scroll/return sync. never await before window.open (breaks iOS/PWA gesture).
  try {
    rememberBrowseReturn(returnTo)
    saveDashboardScroll(returnTo.split('?')[0].split('#')[0])
  } catch {
    /* ignore */
  }

  // External window.open path (Offers + Super Browse). Sync under the tap gesture.
  if (forceExternal || !opts?.navigate) {
    await openTrackedStore(safe, userId, cueAvailable ? known! : undefined, opts?.title, {
      preferWeb,
      storeId: opts?.storeId,
      storeName: opts?.storeName ?? opts?.title,
      source: opts?.source,
    })
    return
  }

  // Rare: explicit in-app shell (caller set forceExternal: false + navigate).
  void resolveTrackedOpen(safe, userId, true)
  if (!preferWeb && cueAvailable) {
    launchUrl(stampAffiliateSubId(known!, userId))
    return
  }

  const target = storeBrowseTarget(safe, {
    title: opts?.title,
    returnTo,
    allowInAppShell: true,
  })
  if (!target) return
  if (target.mode === 'in-app') {
    opts.navigate(target.path)
    return
  }
  launchUrl(target.url)
}

/**
 * Prefer mobile-web HTTPS for merchant opens.
 * Do not hop through DuckDuckGo/Google. those leave users stuck on the redirector.
 * Android may use Chrome intent to avoid installed store apps.
 */
export function stayInBrowserUrl(raw: string): string {
  const safe = sanitizeBrowseUrl(raw)
  if (!safe) return raw
  if (isAffiliateRedirectUrl(safe)) return safe

  const web = mobileWebBrowseUrl(safe) || safe
  if (typeof window === 'undefined') return web

  // Flipkart login treats Chrome intent / in-app shells as cookieless. plain HTTPS only.
  if (needsFirstPartyCookies(web)) return web

  try {
    const u = new URL(web)

    // Android: Chrome intent only for cookie-sensitive Indian retail (avoids breaking intl sites).
    if (isAndroidDevice() && needsFirstPartyCookies(web)) {
      const path = `${u.pathname || '/'}${u.search || ''}${u.hash || ''}`
      return `intent://${u.host}${path}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(web)};end`
    }
  } catch {
    /* fall through */
  }

  // iOS / desktop: direct https URL (no third-party redirector).
  return web
}

let launchLockUntil = 0

function prepareLaunchUrl(raw: string): string | null {
  const safe = sanitizeBrowseUrl(raw)
  if (!safe) return null
  // Affiliate: open as-is. Merchant: always wrap for browse-only.
  if (isAffiliateRedirectUrl(safe)) return safe
  return stayInBrowserUrl(mobileWebBrowseUrl(safe) || safe)
}

/** Open a real tab under the current tap so a later await can still navigate it. */
function openGestureTab(): Window | null {
  if (typeof window === 'undefined') return null
  try {
    // Do not use noopener here. we need a Window handle to set location after await.
    const w = window.open('about:blank', '_blank')
    if (w) {
      try {
        w.opener = null
      } catch {
        /* ignore */
      }
      try {
        w.document.title = 'Yureka'
      } catch {
        /* cross-origin / opaque */
      }
    }
    return w
  } catch {
    return null
  }
}

function navigateGestureTab(w: Window | null, raw: string) {
  const target = prepareLaunchUrl(raw)
  if (!target) {
    try {
      w?.close()
    } catch {
      /* ignore */
    }
    return
  }

  if (w && !w.closed) {
    try {
      w.location.replace(target)
      return
    } catch {
      try {
        w.close()
      } catch {
        /* ignore */
      }
    }
  }

  launchUrl(target)
}

function tryNativeOpen(url: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const w = window as Window & {
      ReactNativeWebView?: { postMessage: (msg: string) => void }
      webkit?: { messageHandlers?: { yurekaOpen?: { postMessage: (msg: unknown) => void } } }
    }
    if (w.ReactNativeWebView?.postMessage) {
      w.ReactNativeWebView.postMessage(JSON.stringify({ type: 'openExternal', url }))
      return true
    }
    if (w.webkit?.messageHandlers?.yurekaOpen?.postMessage) {
      w.webkit.messageHandlers.yurekaOpen.postMessage({ type: 'openExternal', url })
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}

function launchUrl(raw: string, opts?: { allowCookies?: boolean }) {
  const target = prepareLaunchUrl(raw) || sanitizeBrowseUrl(raw)
  if (!target) return

  // Ignore double-taps / overlapping openStoreBrowse calls.
  const now = Date.now()
  if (now < launchLockUntil) return
  launchLockUntil = now + 900

  // Native Expo / WKWebView shell. ask the host to open Safari / Chrome Custom Tabs.
  if (tryNativeOpen(target)) return

  // Cookie-sensitive merchants (Flipkart login): top-level tab without noreferrer so
  // the browser allows a normal first-party cookie jar. We still null opener after.
  const cookieMode = opts?.allowCookies || needsFirstPartyCookies(target)

  try {
    const opened = cookieMode
      ? window.open(target, '_blank')
      : window.open(target, '_blank', 'noopener,noreferrer')
    if (opened) {
      try {
        opened.opener = null
      } catch {
        /* ignore */
      }
      try {
        opened.focus()
      } catch {
        /* ignore */
      }
      return
    }
  } catch {
    /* fall through */
  }

  try {
    const a = document.createElement('a')
    a.href = target
    a.target = '_blank'
    a.rel = cookieMode ? 'noopener' : 'noopener noreferrer'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } catch {
    /* fall through */
  }

  // Popup / new-tab often blocked in installed PWA and native WebView. Same-document
  // navigation is the reliable fallback there; skip it on normal browser tabs where
  // the anchor click above usually opened a tab.
  const constrainedShell =
    isStandalonePwa() ||
    (typeof navigator !== 'undefined' && /YurekaApp/i.test(navigator.userAgent || '')) ||
    (() => {
      try {
        return sessionStorage.getItem('yureka-embedded') === '1'
      } catch {
        return false
      }
    })()

  if (!constrainedShell) return

  try {
    window.location.assign(target)
  } catch {
    /* ignore */
  }
}

/** Same-gesture CueLinks hit + first-party merchant tab (Flipkart cookies / login). */
function launchMerchantAndAffiliate(merchant: string, affiliate: string) {
  const shop = prepareLaunchUrl(merchant) || sanitizeBrowseUrl(merchant)
  const aff = sanitizeBrowseUrl(affiliate)
  if (!shop) return

  const now = Date.now()
  if (now < launchLockUntil) return
  launchLockUntil = now + 900

  // Provider click first (same user gesture. popup blockers usually allow both).
  if (aff) {
    try {
      window.open(aff, '_blank', 'noopener,noreferrer')
    } catch {
      /* ignore */
    }
  }

  try {
    const opened = window.open(shop, '_blank')
    if (opened) {
      try {
        opened.opener = null
      } catch {
        /* ignore */
      }
      try {
        opened.focus()
      } catch {
        /* ignore */
      }
      return
    }
  } catch {
    /* fall through */
  }

  launchLockUntil = 0
  launchUrl(shop, { allowCookies: true })
}

function externalOpenTarget(
  destUrl: string,
  openUrl?: string | null,
  userId = '',
  preferWeb = true,
) {
  const direct = mobileWebBrowseUrl(destUrl) || destUrl
  const stamped = openUrl ? stampAffiliateSubId(openUrl, userId) : null
  const affiliate =
    stamped && isAffiliateRedirectUrl(stamped)
      ? stamped
      : isAffiliateRedirectUrl(direct)
        ? stampAffiliateSubId(direct, userId)
        : null

  // Browse-only: merchant website (anti-app wrap applied in prepareLaunchUrl).
  if (preferWeb) return direct

  // Conversion path when caller explicitly wants CueLinks (rare. still may UL at end).
  if (affiliate) return affiliate
  return direct
}

function trackBrowseOpen(
  url: string,
  userId: string,
  openedUrl: string,
  meta?: { storeId?: string | null; storeName?: string | null; source?: BrowseClickSource },
) {
  void resolveTrackedOpen(url, userId, {
    record: true,
    storeId: meta?.storeId,
    storeName: meta?.storeName,
    source: meta?.source,
    openedUrl,
  })
}

/** Record click, open tracked / store link immediately. no intermediate screen. */
export async function openTrackedStore(
  url: string,
  userId: string,
  knownOpenUrl?: string,
  _title?: string,
  opts?: {
    preferWeb?: boolean
    alsoOpenAffiliate?: boolean
    storeId?: string | null
    storeName?: string | null
    source?: BrowseClickSource
  },
) {
  const fallback = sanitizeBrowseUrl(url)
  if (!fallback) return
  const trackMeta = {
    storeId: opts?.storeId,
    storeName: opts?.storeName ?? _title,
    source: opts?.source,
  }

  // Sync path: window.open under the tap so CueLinks accepts the click.
  if (knownOpenUrl) {
    const cue = isAffiliateRedirectUrl(knownOpenUrl)
    const preferWeb = opts?.preferWeb ?? !cue
    const stamped = stampAffiliateSubId(knownOpenUrl, userId)
    const target = externalOpenTarget(fallback, knownOpenUrl, userId, preferWeb)
    if (opts?.alsoOpenAffiliate && cue && preferWeb) {
      launchMerchantAndAffiliate(target, stamped)
      trackBrowseOpen(fallback, userId, target, trackMeta)
      return
    }
    launchUrl(target, { allowCookies: needsFirstPartyCookies(fallback) && preferWeb })
    trackBrowseOpen(fallback, userId, target, trackMeta)
    return
  }

  const preferWeb = opts?.preferWeb ?? true

  // Merchant website: open immediately under the tap (no about:blank while awaiting /api/browse/out).
  if (preferWeb) {
    const target = externalOpenTarget(fallback, null, userId, true)
    launchUrl(target, { allowCookies: needsFirstPartyCookies(fallback) })
    trackBrowseOpen(fallback, userId, target, trackMeta)
    return
  }

  // CueLinks-only path: hold a blank tab under the gesture, then point it at the tracker.
  const held = openGestureTab()
  try {
    const tracked = await resolveTrackedOpen(url, userId, true)
    const dest = tracked?.destUrl || fallback
    const openUrl = tracked?.openUrl ? stampAffiliateSubId(tracked.openUrl, userId) : null
    const cue = Boolean(openUrl && isAffiliateRedirectUrl(openUrl))
    const preferWeb = opts?.preferWeb ?? !cue
    const target = externalOpenTarget(dest, openUrl, userId, preferWeb)
    if (
      opts?.alsoOpenAffiliate &&
      openUrl &&
      cue &&
      preferWeb &&
      needsFirstPartyCookies(dest)
    ) {
      try {
        held?.close()
      } catch {
        /* ignore */
      }
      launchMerchantAndAffiliate(target, openUrl)
      return
    }
    navigateGestureTab(held, target)
    trackBrowseOpen(fallback, userId, target, trackMeta)
  } catch {
    navigateGestureTab(held, fallback)
    trackBrowseOpen(fallback, userId, fallback, trackMeta)
  }
}

export function authBrowseHeaders(userId: string): HeadersInit {
  const token = getAuthAccessToken()
  return {
    'Content-Type': 'application/json',
    'x-user-id': userId,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}
