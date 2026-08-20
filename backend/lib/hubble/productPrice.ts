import { parseInr } from '../../../shared/giftCardProduct.js'
import { browseHost, sanitizeBrowseUrl } from '../../../shared/inAppBrowse.js'

const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

const cache = new Map<string, { price: number | null; at: number }>()
const CACHE_MS = 2 * 60 * 1000

function fromJsonLd(html: string): number | null {
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  if (!blocks) return null
  for (const block of blocks) {
    const inner = block.replace(/<\/?script[^>]*>/gi, '').trim()
    try {
      const data = JSON.parse(inner)
      const nodes = Array.isArray(data) ? data : [data]
      for (const node of nodes) {
        const offers = node?.offers
        const list = Array.isArray(offers) ? offers : offers ? [offers] : []
        for (const offer of list) {
          const cur = String(offer?.priceCurrency || '').toUpperCase()
          if (cur && cur !== 'INR') continue
          const p = parseInr(String(offer?.price ?? offer?.lowPrice ?? ''))
          if (p) return p
        }
        const p = parseInr(String(node?.price ?? ''))
        if (p) return p
      }
    } catch {
      /* ignore malformed json-ld */
    }
  }
  return null
}

function fromMeta(html: string): number | null {
  const patterns = [
    /property=["']og:price:amount["'][^>]*content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]*property=["']og:price:amount["']/i,
    /property=["']product:price:amount["'][^>]*content=["']([^"']+)["']/i,
    /itemprop=["']price["'][^>]*content=["']([^"']+)["']/i,
  ]
  for (const re of patterns) {
    const m = html.match(re)
    const p = parseInr(m?.[1])
    if (p) return p
  }
  return null
}

function fromHostPatterns(html: string, host: string): number | null {
  if (host.includes('amazon.')) {
    const patterns = [
      /<span[^>]*class="[^"]*a-offscreen[^"]*"[^>]*>([^<]+)<\/span>/gi,
      /id=["']priceblock_(?:ourprice|dealprice|saleprice)["'][^>]*>([^<]+)</gi,
    ]
    for (const re of patterns) {
      for (const m of html.matchAll(re)) {
        const p = parseInr(m[1])
        if (p && p >= 50) return p
      }
    }
  }
  if (host.includes('flipkart.')) {
    const patterns = [
      /class="[^"]*Nx9bqj[^"]*"[^>]*>([^<]+)</gi,
      /class="[^"]*_30BxA[^"]*"[^>]*>([^<]+)</gi,
    ]
    for (const re of patterns) {
      for (const m of html.matchAll(re)) {
        const p = parseInr(m[1])
        if (p && p >= 50) return p
      }
    }
  }
  if (host.includes('myntra.')) {
    const m = html.match(/class="[^"]*pdp-price[^"]*"[^>]*>[\s\S]*?<strong[^>]*>([^<]+)</i)
    const p = parseInr(m?.[1])
    if (p) return p
  }
  return null
}

export function extractProductPriceFromHtml(html: string, host: string): number | null {
  return fromJsonLd(html) || fromMeta(html) || fromHostPatterns(html, host)
}

export async function scrapeProductPriceFromUrl(rawUrl: string): Promise<number | null> {
  const url = sanitizeBrowseUrl(rawUrl)
  if (!url) return null
  const host = browseHost(url)
  const hit = cache.get(url)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.price

  let price: number | null = null
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-IN,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(9000),
    })
    if (res.ok) {
      const html = await res.text()
      price = extractProductPriceFromHtml(html, host)
    }
  } catch {
    /* network / timeout */
  }

  cache.set(url, { price, at: Date.now() })
  return price
}
