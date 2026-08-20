/** Preset chips are shortcuts. Any whole-rupee value inside min/max is allowed. */

export function normalizeDenominations(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  const nums = raw
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0)
  return Array.from(new Set(nums)).sort((a, b) => a - b)
}

export function isFlexibleGiftCard(card: {
  denominationType?: string | null
}): boolean {
  return String(card.denominationType || '').toUpperCase() === 'FLEXIBLE'
}

export function giftCardAmountAllowed(
  card: {
    denominationType?: string | null
    denominations?: number[] | null
    minAmount?: number | null
    maxAmount?: number | null
  },
  amount: number,
): { ok: true } | { ok: false; error: string } {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Enter a valid amount' }
  }
  if (!Number.isInteger(amount)) {
    return { ok: false, error: 'Amount must be a whole rupee value' }
  }

  const denoms = normalizeDenominations(card.denominations)
  const inDenoms = denoms.includes(amount)
  const belowMin = card.minAmount != null && amount < card.minAmount
  const aboveMax = card.maxAmount != null && amount > card.maxAmount

  if (belowMin) {
    return { ok: false, error: `Minimum amount is ₹${card.minAmount!.toLocaleString('en-IN')}` }
  }
  if (aboveMax) {
    return { ok: false, error: `Maximum amount is ₹${card.maxAmount!.toLocaleString('en-IN')}` }
  }
  if (inDenoms) return { ok: true }
  if (card.minAmount != null || card.maxAmount != null) return { ok: true }
  if (denoms.length) {
    const listed = denoms.map((d) => `₹${d.toLocaleString('en-IN')}`).join(', ')
    return { ok: false, error: `This brand only allows ${listed}` }
  }
  return { ok: true }
}
