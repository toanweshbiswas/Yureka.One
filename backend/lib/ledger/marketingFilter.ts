/**
 * Drop newsletter / educational digests that quote example ₹ amounts
 * (e.g. CRED "credit utilization decoded", Groww portfolio updates).
 */

const CONTENT_DIGEST =
  /credit\s+utilization|utilisation\s+ratio|the\s+fine\s+print|\bdecoded\b|\bexplained\b|did\s+you\s+know|here.?s\s+why|how\s+to\s+(?:improve|boost|fix|build)|tips?\s+to\b|money\s+tips?|credit\s+health|score\s+decoded|in\s+case\s+you\s+missed|weekly\s+(?:wrap|digest|roundup)|your\s+credit\s+(?:report|score|limit)\s+(?:decoded|explained|guide)/i

const INVESTMENT_DIGEST =
  /(?:portfolio\s+(?:value|update|summary)|current\s+value|total\s+(?:returns?|gains?)|xirr|cagr|market\s+(?:update|wrap|today)|stocks?\s+to\s+watch|watchlist|your\s+investments?\s+(?:are|have)|mutual\s+fund\s+(?:insight|tip|guide)|sip\s+reminder(?!\s+successful)|invest(?:ing)?\s+101|learn\s+to\s+invest|nfo\s+(?:alert|open)|new\s+fund\s+offer|refer\s+(?:and|&)\s+earn|invite\s+friends|app\s+update|what.?s\s+new\s+on\s+groww|motilal\s+oswal\s+(?:research|view|digest)|weekly\s+market)/i

const REAL_PAYMENT =
  /\b(bill\s+paid|payment\s+(?:successful|received|done)|debited|emi\s+(?:paid|due)|txn\s+alert|transaction\s+alert|amount\s+due|statement\s+ready|order\s+confirmed|upi\s*ref|units?\s+allot(?:ted|ed)|order\s+executed|sip\s+(?:successful|instalment|installment|processed|done)|you\s+invested|successfully\s+invested|amount\s+invested|shares?\s+bought|equity\s+delivery)\b/i

const PROMO =
  /unsubscribe|newsletter|%[\s-]?off|flash\s+sale|refer\s+(?:and|&)\s+earn|invite\s+friends|weekly\s+digest|just\s+for\s+you/i

const BROKER =
  /groww|zerodha|kite|upstox|angelone|angel\s*one|kuvera|smallcase|indmoney|etmoney|paytm\s*money|motilal|hdfc\s*sec|icici\s*direct|5paisa|coin\.zerodha/i

export function isMarketingLedgerRow(tx: {
  brandName?: string
  description?: string
  sender?: string
  subject?: string
  type?: string
}): boolean {
  const brand = String(tx.brandName || '').toLowerCase()
  const sender = String(tx.sender || '').toLowerCase()
  const desc = String(tx.description || tx.subject || '')
  const hay = `${brand}\n${sender}\n${desc}`

  if (CONTENT_DIGEST.test(desc) || CONTENT_DIGEST.test(hay)) {
    if (!REAL_PAYMENT.test(desc) && !REAL_PAYMENT.test(hay)) return true
  }
  if (INVESTMENT_DIGEST.test(desc) || INVESTMENT_DIGEST.test(hay)) {
    if (!REAL_PAYMENT.test(desc) && !REAL_PAYMENT.test(hay)) return true
  }
  if (PROMO.test(desc) && !REAL_PAYMENT.test(desc)) return true

  // CRED editorial without a payment cue
  if ((brand.includes('cred') || sender.includes('cred')) && !REAL_PAYMENT.test(hay)) {
    if (
      /utilization|utilisation|fine print|decoded|explained|tips|guide|digest|newsletter|know more|credit score|credit limit/i.test(
        hay,
      )
    ) {
      return true
    }
  }

  // Broker / AMC content without a real invest/debit cue → not a ledger row
  if (BROKER.test(hay) && !REAL_PAYMENT.test(hay)) {
    if (
      /update|digest|insight|research|newsletter|returns?|portfolio|watchlist|market|nfo|refer|invite|learn|tip|guide|congratulat/i.test(
        hay,
      )
    ) {
      return true
    }
  }
  return false
}

export function filterMarketingTransactions<T extends Record<string, unknown>>(rows: T[] | undefined | null): T[] {
  if (!Array.isArray(rows)) return []
  return rows.filter((tx) => !isMarketingLedgerRow(tx as any))
}

/** Collapse near-duplicate invest/spend rows (confirm + allotment + bank debit). */
export function collapseRepetitiveTransactions<T extends Record<string, unknown>>(
  rows: T[] | undefined | null,
): T[] {
  if (!Array.isArray(rows) || rows.length < 2) return rows || []

  const out: T[] = []
  const seen = new Set<string>()

  for (const row of rows) {
    const brand = String(row.brandName || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
    const amount = String(row.amount || '').replace(/[₹$,\s,]/g, '')
    const dateRaw = String(row.date || '')
    const day = dateRaw.slice(0, 10) || dateRaw.slice(0, 16)
    const inbox = String(row.sourceEmail || row.sender || '')
      .trim()
      .toLowerCase()
    const desc = String(row.description || '')
      .toLowerCase()
      .replace(/investment\s*·\s*/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .slice(0, 40)

    // Soft key: same merchant + amount + day (+ inbox) — drops confirm/allotment twins
    const soft = `${brand}|${amount}|${day}|${inbox}`
    if (brand && amount && day && seen.has(soft)) continue
    if (brand && amount && day) seen.add(soft)

    // Harder repeat: identical amount+brand within same inbox and near-identical desc stem
    const stem = `${brand}|${amount}|${inbox}|${desc.slice(0, 24)}`
    if (brand && amount && seen.has(`stem:${stem}`)) continue
    if (brand && amount) seen.add(`stem:${stem}`)

    out.push(row)
  }
  return out
}
