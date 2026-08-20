/** Deep link into gift-card checkout with amount prefilled. */

export function giftCardBuyPath(opts: {
  cardId: string
  amount?: number | null
  productUrl?: string | null
  price?: number | null
}) {
  const params = new URLSearchParams()
  params.set('buy', opts.cardId)
  if (opts.amount != null && Number.isFinite(opts.amount) && opts.amount > 0) {
    params.set('amount', String(Math.ceil(opts.amount)))
  }
  if (opts.price != null && Number.isFinite(opts.price) && opts.price > 0) {
    params.set('price', String(Math.ceil(opts.price)))
  }
  if (opts.productUrl?.trim()) params.set('product', opts.productUrl.trim().slice(0, 500))
  return `/dashboard/giftcards?${params.toString()}`
}

export function formatInr(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`
}
