export interface GiftCardRedeemSite {
  label: string
  url: string
}

const BLOCKED_HOSTS = [
  'coda.io',
  'myhubble.money',
  'assets.myhubble.money',
  'flow.myhubble.money',
]

const URL_RE = /https?:\/\/[^\s<>"'\)\]\},]+/gi
const WWW_RE = /\bwww\.[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?:\/[^\s<>"'\)\]\},]*)?/gi
const DOMAIN_RE =
  /\b(?:go to |visit |on |at )?(?:[a-z0-9-]+\.)+(?:com|in|co|io|net|org|app|shop)(?:\/[^\s<>"'\)\]\},]*)?/gi

function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase()
  return BLOCKED_HOSTS.some((b) => h === b || h.endsWith(`.${b}`))
}

function stripTrailingJunk(raw: string): string {
  return raw.trim().replace(/[.,;:)\]}'"]+$/g, '')
}

function toHttpUrl(raw: string): string | null {
  let s = stripTrailingJunk(raw)
  if (!s) return null
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    if (!/^https?:\/\//i.test(s)) return null
  } else {
    s = `https://${s}`
  }
  try {
    const u = new URL(s)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (!u.hostname || isBlockedHost(u.hostname)) return null
    if (/^(sign|log|check|add|tap|opt)\.in$/i.test(u.hostname)) return null
    u.hash = ''
    if (u.searchParams.has('code') && [...u.searchParams.keys()].length === 1) {
      u.search = ''
    }
    return u.toString()
  } catch {
    return null
  }
}

function hostKey(href: string): string {
  try {
    const u = new URL(href)
    const host = u.hostname.replace(/^www\./i, '').toLowerCase()
    const path = u.pathname.replace(/\/+$/, '') || '/'
    return `${host}${path}`
  } catch {
    return href
  }
}

function displayHost(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./i, '')
  } catch {
    return href
  }
}

function extractFromText(text: string): string[] {
  const found: string[] = []
  for (const re of [URL_RE, WWW_RE, DOMAIN_RE]) {
    re.lastIndex = 0
    const matches = text.match(re) || []
    for (const m of matches) {
      found.push(m.replace(/^(?:go to|visit|on|at)\s+/i, ''))
    }
  }
  return found
}

export function collectRedeemSites(raw: {
  storeLocatorUrl?: string | null
  deeplinks?: Array<{ platform?: string; deeplink?: string | null }> | null
  howToUseInstructions?: Array<{ instructions?: string[] | null }> | null
  usageInstructions?: Record<string, string[]> | null
  brandDescription?: string | null
}): GiftCardRedeemSite[] {
  const candidates: Array<{ url: string; label: string }> = []

  if (raw.storeLocatorUrl) {
    const url = toHttpUrl(raw.storeLocatorUrl)
    if (url) candidates.push({ url, label: 'Find stores' })
  }

  for (const d of raw.deeplinks || []) {
    const url = toHttpUrl(String(d?.deeplink || ''))
    if (url) candidates.push({ url, label: displayHost(url) })
  }

  const texts: string[] = []
  for (const h of raw.howToUseInstructions || []) texts.push(...(h.instructions || []))
  texts.push(...Object.values(raw.usageInstructions || {}).flat())
  if (raw.brandDescription) texts.push(raw.brandDescription)

  for (const text of texts) {
    for (const piece of extractFromText(text)) {
      const url = toHttpUrl(piece)
      if (url) candidates.push({ url, label: displayHost(url) })
    }
  }

  const seen = new Set<string>()
  const usedLabels = new Set<string>()
  const sites: GiftCardRedeemSite[] = []

  for (const c of candidates) {
    const key = hostKey(c.url)
    if (seen.has(key)) continue
    seen.add(key)
    let label = c.label
    if (label !== 'Find stores' && usedLabels.has(label)) {
      try {
        const path = new URL(c.url).pathname.replace(/\/+$/, '')
        if (path && path !== '/') label = `${label}${path}`
      } catch {
        /* keep */
      }
    }
    usedLabels.add(label)
    sites.push({ label, url: c.url })
  }

  return sites
}
