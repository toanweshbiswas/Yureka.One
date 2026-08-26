/**
 * First-party brand marks. prefer these over tiny favicons so Explore tiles stay sharp.
 * Paths are under /public and work same-origin on every host.
 */
const LOCAL_BY_HOST: Record<string, string> = {
  'amazon.in': '/assets/brand-logos/amazon-logo.png',
  'amazon.com': '/assets/brand-logos/amazon-logo.png',
  'flipkart.com': '/assets/brand-logos/flipkart-logo.png',
  'myntra.com': '/assets/brand-logos/myntra-logo.jpeg',
  'blinkit.com': '/assets/brand-logos/blinkit-logo.png',
  'zeptonow.com': '/assets/brand-logos/zepto-logo.png',
  'zepto.com': '/assets/brand-logos/zepto-logo.png',
  'swiggy.com': '/assets/brand-logos/swiggy-logo.png',
  'ajio.com': '/assets/brand-logos/ajio-logo.jpeg',
  'bookmyshow.com': '/assets/brand-logos/bookmyshow-logo.png',
  'bigbasket.com': '/assets/brand-logos/bigbasket-logo.png',
  'meesho.com': '/assets/brand-logos/meesho-mark.svg',
  'makemytrip.com': '/assets/brand-logos/makemytrip-logo.png',
  'goibibo.com': '/assets/brand-logos/goibibo-logo.png',
  'jiomart.com': '/assets/brand-logos/jiomart-full.png',
  'uber.com': '/assets/brand-logos/uber-logo.png',
  'airindia.com': '/assets/brand-logos-2/air-india-logo.png',
  'nykaa.com': '/assets/brand-logos/nykaa-logo.jpeg',
}

export function normalizeLogoHost(domain: string): string {
  return String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .replace(/[^a-z0-9.-]/g, '')
}

/** Same-origin PNG/JPEG/SVG when we ship one for the merchant. */
export function localBrandLogo(domain: string): string | null {
  const host = normalizeLogoHost(domain)
  if (!host) return null
  if (LOCAL_BY_HOST[host]) return LOCAL_BY_HOST[host]
  // Match parent domain (e.g. shop.amazon.in → amazon.in)
  const parts = host.split('.')
  for (let i = 1; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join('.')
    if (LOCAL_BY_HOST[candidate]) return LOCAL_BY_HOST[candidate]
  }
  return null
}

/** High-res remote favicon candidates (browser-friendly). */
export function remoteBrandLogoSources(host: string): string[] {
  if (!host) return []
  const enc = encodeURIComponent(host)
  return [
    `https://www.google.com/s2/favicons?sz=256&domain_url=${encodeURIComponent(`https://www.${host}`)}`,
    `https://www.google.com/s2/favicons?domain=${enc}&sz=128`,
    `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${enc}&size=128`,
    `https://icons.duckduckgo.com/ip3/${enc}.ico`,
  ]
}
