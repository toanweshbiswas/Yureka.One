import type { GiftCard } from './types.js'
import { giftCardAmountAllowed, normalizeDenominations } from './denominations.js'
import { merchantHostKey } from '../../../shared/giftCardProduct.js'

const HOST_ALIASES: Record<string, string[]> = {
  'amazon.in': ['amazon', 'amazon pay', 'amazon.in', 'amazon india'],
  'amazon.com': ['amazon'],
  'flipkart.com': ['flipkart'],
  'myntra.com': ['myntra'],
  'ajio.com': ['ajio'],
  'bigbasket.com': ['bigbasket', 'big basket'],
  'blinkit.com': ['blinkit', 'grofers'],
  'zeptonow.com': ['zepto', 'zeptonow'],
  'swiggy.com': ['swiggy', 'instamart'],
  'jiomart.com': ['jiomart', 'jio mart'],
  'makemytrip.com': ['makemytrip', 'make my trip', 'mmt'],
  'goibibo.com': ['goibibo'],
  'bookmyshow.com': ['bookmyshow', 'book my show'],
  'uber.com': ['uber'],
  'meesho.com': ['meesho'],
  'nykaa.com': ['nykaa'],
}

function hostTokens(host: string): string[] {
  const h = host.toLowerCase().replace(/^www\./, '')
  const canonical = merchantHostKey(h)
  const base = canonical.split('.')[0] || canonical
  const fromMap = HOST_ALIASES[h] || HOST_ALIASES[canonical] || HOST_ALIASES[base] || []
  return Array.from(new Set([h, canonical, base, ...fromMap])).filter((t) => t.length >= 3)
}

function cardMatchesHost(card: GiftCard, host: string): boolean {
  const normalizedHost = merchantHostKey(host)
  const tokens = hostTokens(normalizedHost)
  const hay = `${card.brand} ${card.title} ${card.description} ${card.tags.join(' ')} ${card.categories.join(' ')}`.toLowerCase()
  const compact = hay.replace(/[^a-z0-9]+/g, '')
  if (tokens.some((t) => hay.includes(t.toLowerCase()))) return true
  for (const site of card.redeemSites || []) {
    try {
      const rh = merchantHostKey(new URL(site.url).hostname)
      if (
        rh === normalizedHost ||
        rh.endsWith(`.${normalizedHost}`) ||
        normalizedHost.endsWith(`.${rh}`)
      ) {
        return true
      }
    } catch {
      /* ignore */
    }
  }
  return tokens.some((t) => {
    const c = t.replace(/[^a-z0-9]+/g, '')
    return c.length >= 3 && compact.includes(c)
  })
}

/** Pick the closest allowed whole-rupee amount >= requested when possible. */
export function snapGiftCardAmount(card: GiftCard, requested: number): number | null {
  if (!Number.isFinite(requested) || requested <= 0) return null
  let amount = Math.ceil(requested)

  const denoms = normalizeDenominations(card.denominations)
  if (denoms.length) {
    const atOrAbove = denoms.filter((d) => d >= amount)
    amount = atOrAbove.length ? atOrAbove[0] : denoms[denoms.length - 1]
  }

  if (card.minAmount != null && amount < card.minAmount) amount = card.minAmount
  if (card.maxAmount != null && amount > card.maxAmount) {
    if (denoms.length) {
      const below = denoms.filter((d) => d <= card.maxAmount!)
      amount = below.length ? below[below.length - 1] : card.maxAmount
    } else {
      amount = card.maxAmount
    }
  }

  const check = giftCardAmountAllowed(card, amount)
  return check.ok ? amount : null
}

export function findGiftCardForHost(cards: GiftCard[], host: string): GiftCard | null {
  const active = cards.filter((c) => String(c.status).toUpperCase() === 'ACTIVE')
  const exact = active.filter((c) => cardMatchesHost(c, host))
  if (!exact.length) return null
  exact.sort((a, b) => {
    const da = a.discountPercentage ?? 0
    const db = b.discountPercentage ?? 0
    if (db !== da) return db - da
    return a.title.localeCompare(b.title)
  })
  return exact[0]
}

export type GiftCardMatch = {
  card: GiftCard
  requestedAmount: number | null
  suggestedAmount: number | null
  savingsInr: number | null
  checkoutPath: string
}

export function buildGiftCardMatch(
  card: GiftCard,
  requestedAmount?: number | null,
  productUrl?: string | null,
): GiftCardMatch {
  const requested =
    requestedAmount != null && Number.isFinite(requestedAmount) && requestedAmount > 0
      ? Math.ceil(requestedAmount)
      : null
  const suggested = requested != null ? snapGiftCardAmount(card, requested) : card.minAmount ?? normalizeDenominations(card.denominations)[0] ?? null
  const discount = card.discountPercentage ?? 0
  const savingsInr =
    suggested != null && discount > 0 ? Math.round((suggested * discount) / 100) : null

  const params = new URLSearchParams()
  params.set('buy', card.id)
  if (suggested != null) params.set('amount', String(suggested))
  if (productUrl?.trim()) params.set('product', productUrl.trim().slice(0, 500))
  if (requested != null) params.set('price', String(requested))

  return {
    card,
    requestedAmount: requested,
    suggestedAmount: suggested,
    savingsInr,
    checkoutPath: `/dashboard/giftcards?${params.toString()}`,
  }
}

export function matchGiftCardForPurchase(
  cards: GiftCard[],
  host: string,
  amount?: number | null,
  productUrl?: string | null,
): GiftCardMatch | null {
  const card = findGiftCardForHost(cards, host)
  if (!card) return null
  return buildGiftCardMatch(card, amount, productUrl)
}
