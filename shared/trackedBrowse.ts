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
  if (mustOpenExternally(safe)) return { mode: 'external', url: safe }
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
  const target = storeBrowseTarget(url, { title: opts?.title, returnTo: opts?.returnTo })
  if (!target) return

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
  const opened = window.open(target, '_blank', 'noopener,noreferrer')
  if (!opened) window.location.assign(target)
}

function externalOpenTarget(destUrl: string, openUrl?: string | null) {
  const direct = mobileWebBrowseUrl(destUrl) || destUrl
  if (preferDirectSiteOpen(destUrl)) return direct
  const affiliate = openUrl ? stampAffiliateSubId(openUrl, '') : null
  if (affiliate && isAffiliateRedirectUrl(affiliate)) return affiliate
  return openUrl ? mobileWebBrowseUrl(openUrl) || direct : direct
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

  const popup = window.open('about:blank', '_blank')
  const tracked = await resolveTrackedOpen(url, userId, true)
  const dest = tracked?.destUrl || fallback
  const openUrl = tracked?.openUrl ? stampAffiliateSubId(tracked.openUrl, userId) : null
  const target = externalOpenTarget(dest, openUrl)
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
