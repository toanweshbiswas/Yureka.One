export function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN')}`
}

export function formatPaise(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

export function giftCardAmountOk(
  card: { minAmount?: number | null; maxAmount?: number | null; denominations?: number[] },
  amount: number,
) {
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) return false
  if (card.minAmount != null && amount < card.minAmount) return false
  if (card.maxAmount != null && amount > card.maxAmount) return false
  return true
}
