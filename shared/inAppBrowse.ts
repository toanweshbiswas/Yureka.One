const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1'])

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '')
  if (BLOCKED_HOSTS.has(h)) return true
  if (/^10\.\d+\.\d+\.\d+$/.test(h)) return true
  if (/^192\.168\.\d+\.\d+$/.test(h)) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(h)) return true
  return false
}

/** Only http(s) destinations — never javascript:/data: open-redirects. */
export function sanitizeBrowseUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const url = new URL(raw.trim())
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (url.username || url.password) return null
    if (isPrivateHost(url.hostname)) return null
    url.protocol = 'https:'
    return url.toString()
  } catch {
    return null
  }
}

export function browseHost(raw: string | null | undefined): string {
  const safe = sanitizeBrowseUrl(raw)
  if (!safe) return ''
  try {
    return new URL(safe).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}

export function browsePath(opts: { url: string; title?: string; returnTo?: string }): string | null {
  const url = sanitizeBrowseUrl(opts.url)
  if (!url) return null
  const params = new URLSearchParams()
  params.set('url', url)
  if (opts.title?.trim()) params.set('title', opts.title.trim())
  if (opts.returnTo?.trim()) params.set('from', opts.returnTo.trim())
  return `/dashboard/browse?${params.toString()}`
}

export function explorePath(sceneId: string, brand?: string) {
  const params = new URLSearchParams()
  if (brand) params.set('brand', brand)
  const q = params.toString()
  return q ? `/dashboard/explore/${sceneId}?${q}` : `/dashboard/explore/${sceneId}`
}

/** Prefer the live store URL in the iframe. Proxy is a fallback for frame-blocked hosts. */
export function embedFrameSrc(raw: string | null | undefined): string | null {
  return sanitizeBrowseUrl(raw)
}
