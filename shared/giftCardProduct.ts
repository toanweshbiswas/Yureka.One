import { browseHost, sanitizeBrowseUrl } from './inAppBrowse'

export function parseInr(text: string | null | undefined): number | null {
  if (!text) return null
  const cleaned = String(text).replace(/,/g, '')
  const m = cleaned.match(/(?:₹|Rs\.?\s*|INR\s*)?(\d+(?:\.\d+)?)/i)
  if (!m) return null
  const n = Math.round(Number(m[1]))
  return Number.isFinite(n) && n >= 10 ? n : null
}

export function isProductPageUrl(raw: string | null | undefined): boolean {
  const safe = sanitizeBrowseUrl(raw)
  if (!safe) return false
  try {
    const u = new URL(safe)
    const host = u.hostname.replace(/^www\./i, '').toLowerCase()
    const path = u.pathname
    if (host.includes('amazon.')) return /\/dp\/|\/gp\/product\//.test(path)
    if (host.includes('flipkart.')) return /\/p\//.test(path) || /\/product\//.test(path)
    if (host.includes('myntra.')) return /\/buy\b/.test(path) || /\/[\w-]+\/buy\b/.test(path)
    if (host.includes('ajio.')) return /\/p\//.test(path)
    if (host.includes('nykaa.')) return /\/p\//.test(path) || /\/product\//.test(path)
    if (host.includes('meesho.')) return /\/p\//.test(path)
    return false
  } catch {
    return false
  }
}

export function merchantHostKey(raw: string | null | undefined): string {
  const host = browseHost(raw).toLowerCase()
  if (!host) return ''
  const parts = host.split('.').filter(Boolean)
  if (parts.length < 2) return host
  const tld = parts[parts.length - 1]
  const sld = parts[parts.length - 2]
  if (tld === 'in' && parts.length >= 2) {
    return `${sld}.${tld}`
  }
  return `${sld}.${tld}`
}

export function productHost(raw: string | null | undefined): string {
  return merchantHostKey(raw)
}
