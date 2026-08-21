import { api, isApiError } from '@backend/lib/api/client'
import {
  browsePath,
  isAffiliateRedirectUrl,
  mobileWebBrowseUrl,
  mustOpenExternally,
  preferDirectSiteOpen,
  stampAffiliateSubId,
  sanitizeBrowseUrl,
} from '@shared/inAppBrowse'
import { canUseInAppBrowse, isAndroidDevice } from '@shared/pwaDisplay'
import { getAuthAccessToken } from '@shared/auth'

export type TrackedOpen = {
  openUrl: string
  destUrl: string
  host: string
  affiliate: boolean
  goldbackOfferId: string | null
}

export async function resolveTrackedOpen(
  url: string,
  userId: string,
  record = true,
): Promise<TrackedOpen | null> {
  const safe = sanitizeBrowseUrl(url)
  if (!safe) return null
  const res = await api.post<TrackedOpen>(
    '/api/browse/out',
    { url: safe, record },
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

export type StoreBrowseTarget =
  | { mode: 'in-app'; path: string }
  | { mode: 'external'; url: string }

/** In-app iframe when allowed; otherwise tracked open in system browser. */
export function storeBrowseTarget(
  url: string,
  opts?: { title?: string; returnTo?: string },
): StoreBrowseTarget | null {
  const safe = sanitizeBrowseUrl(url)
  if (!safe) return null
  // Outside installed PWA (or on Android/iOS browser tabs), never route into a blank iframe.
  if (mustOpenExternally(safe) || !canUseInAppBrowse()) {
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

/** Record affiliate / goldback, then open in-app or external as appropriate. */
export async function openStoreBrowse(
  url: string,
  userId: string,
  opts?: {
    knownOpenUrl?: string
    title?: string
    returnTo?: string
    navigate?: (path: string) => void
  },
) {
  const returnTo = opts?.returnTo || '/dashboard/browse'
  const target = storeBrowseTarget(url, { title: opts?.title, returnTo })
  if (!target) return

  try {
    const { rememberBrowseReturn, saveDashboardScroll } = await import('@shared/dashboardScroll')
    rememberBrowseReturn(returnTo)
    saveDashboardScroll(returnTo.split('?')[0].split('#')[0])
  } catch {
    /* ignore */
  }

  if (target.mode === 'in-app') {
    void resolveTrackedOpen(url, userId, true)
    opts?.navigate?.(target.path)
    return
  }

  await openTrackedStore(url, userId, opts?.knownOpenUrl, opts?.title)
}

function launchUrl(raw: string) {
  const safe = sanitizeBrowseUrl(raw)
  if (!safe) return
  const target = isAffiliateRedirectUrl(safe) ? safe : mobileWebBrowseUrl(safe) || safe

  // Android Chrome / PWA often blocks or sticks on about:blank popups.
  // Prefer a single real navigation target.
  try {
    const opened = window.open(target, '_blank', 'noopener,noreferrer')
    if (opened) {
      try {
        opened.opener = null
      } catch {
        /* ignore */
      }
      return
    }
  } catch {
    /* fall through */
  }

  // Last resort: same-tab open so the user still reaches the store.
  window.location.assign(target)
}

function externalOpenTarget(destUrl: string, openUrl?: string | null, userId = '') {
  const direct = mobileWebBrowseUrl(destUrl) || destUrl
  if (preferDirectSiteOpen(destUrl)) return direct
  const stamped = openUrl ? stampAffiliateSubId(openUrl, userId) : null
  if (stamped && isAffiliateRedirectUrl(stamped)) return stamped
  return stamped ? mobileWebBrowseUrl(stamped) || direct : direct
}

/** Record click, open tracked / store link immediately — no intermediate screen. */
export async function openTrackedStore(
  url: string,
  userId: string,
  knownOpenUrl?: string,
  _title?: string,
) {
  const fallback = sanitizeBrowseUrl(url)
  if (!fallback) return

  if (knownOpenUrl) {
    void resolveTrackedOpen(url, userId, true)
    const target = preferDirectSiteOpen(fallback)
      ? mobileWebBrowseUrl(fallback) || fallback
      : stampAffiliateSubId(knownOpenUrl, userId)
    launchUrl(target)
    return
  }

  // Android: resolve first, then open once. The about:blank → replace pattern
  // frequently leaves a stuck loading tab on Chrome Android / PWAs.
  if (isAndroidDevice()) {
    const tracked = await resolveTrackedOpen(url, userId, true)
    const dest = tracked?.destUrl || fallback
    const openUrl = tracked?.openUrl ? stampAffiliateSubId(tracked.openUrl, userId) : null
    launchUrl(externalOpenTarget(dest, openUrl, userId))
    return
  }

  const popup = window.open('about:blank', '_blank')
  const tracked = await resolveTrackedOpen(url, userId, true)
  const dest = tracked?.destUrl || fallback
  const openUrl = tracked?.openUrl ? stampAffiliateSubId(tracked.openUrl, userId) : null
  const target = externalOpenTarget(dest, openUrl, userId)
  if (popup && !popup.closed) {
    try {
      popup.opener = null
      popup.location.replace(target)
      return
    } catch {
      popup.close()
    }
  }
  launchUrl(target)
}

export function authBrowseHeaders(userId: string): HeadersInit {
  const token = getAuthAccessToken()
  return {
    'Content-Type': 'application/json',
    'x-user-id': userId,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}
