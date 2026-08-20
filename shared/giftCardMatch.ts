import { isProductPageUrl } from './giftCardProduct'

export type GiftCardMatchPayload = {
  cardId: string
  title: string
  brand: string
  logoUrl: string | null
  discountPercentage: number | null
  requestedAmount: number | null
  suggestedAmount: number | null
  savingsInr: number | null
  checkoutPath: string
  checkoutUrl?: string
  productPrice: number | null
  isProductPage: boolean
}

export async function fetchGiftCardMatchFromUrl(
  pageUrl: string,
): Promise<GiftCardMatchPayload | null> {
  const params = new URLSearchParams({ url: pageUrl })
  const res = await fetch(`/api/giftcards/match-from-url?${params}`)
  const json = await res.json()
  if (!res.ok || json.error) return null
  return json.data?.match ?? null
}

export async function fetchGiftCardMatch(opts: {
  host: string
  amount?: number | null
  product?: string | null
}): Promise<GiftCardMatchPayload | null> {
  const params = new URLSearchParams({ host: opts.host })
  if (opts.amount != null && opts.amount > 0) params.set('amount', String(Math.ceil(opts.amount)))
  if (opts.product) params.set('product', opts.product)
  const res = await fetch(`/api/giftcards/match?${params}`)
  const json = await res.json()
  if (!res.ok || json.error) return null
  const m = json.data?.match
  if (!m) return null
  return {
    ...m,
    productPrice: opts.amount ?? null,
    isProductPage: isProductPageUrl(opts.product || ''),
  }
}
