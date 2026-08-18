const MERCHANT_DOMAINS: Record<string, string> = {
  nykaa: 'nykaa.com',
  amazon: 'amazon.in',
  swiggy: 'swiggy.com',
  myntra: 'myntra.com',
  flipkart: 'flipkart.com',
  ajio: 'ajio.com',
  zomato: 'zomato.com',
  blinkit: 'blinkit.com',
  bigbasket: 'bigbasket.com',
  jiomart: 'jiomart.com',
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

export function hostnameFromUrl(pageUrl?: string | null): string | null {
  if (!pageUrl) return null
  try {
    const host = new URL(pageUrl).hostname.replace(/^www\./i, '')
    return host || null
  } catch {
    return null
  }
}

export function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`
}

export function merchantLogoUrl(merchant?: string | null, pageUrl?: string | null): string | null {
  const fromUrl = hostnameFromUrl(pageUrl)
  if (fromUrl) return faviconUrl(fromUrl)
  if (!merchant) return null
  const mapped = MERCHANT_DOMAINS[slug(merchant)]
  if (mapped) return faviconUrl(mapped)
  return null
}

/** CueLinks often returns `/photos/medium/missing.png` which 404s on our origin. */
export function resolveRemoteImageUrl(
  raw?: string | null,
  fallbackPageUrl?: string | null,
  merchant?: string | null,
): string | null {
  const value = String(raw || '').trim()
  const unusable =
    !value ||
    /missing\.png/i.test(value) ||
    value === 'null' ||
    value === 'undefined'

  if (!unusable) {
    if (/^https?:\/\//i.test(value)) {
      return value.replace(/^http:\/\//i, 'https://')
    }
    if (value.startsWith('//')) return `https:${value}`
    if (value.startsWith('/')) return `https://cdn0.cuelinks.com${value}`
  }

  return merchantLogoUrl(merchant, fallbackPageUrl)
}
