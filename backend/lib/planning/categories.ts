import {
  PLANNING_CATEGORIES,
  asPlanningCategory,
  type PlanningCategory,
  type PlanningTransaction,
  type PlanningTxOverride,
} from './types.js'

const FOOD = [
  'swiggy', 'zomato', 'blinkit', 'instamart', 'zepto', 'dunzo', 'bigbasket', 'grofers',
  'eatfit', 'box8', 'faasos', 'magicpin', 'dominos', 'mcdonald', 'kfc', 'starbucks',
  'burger king', 'pizza hut', 'eatsure', 'freshmenu', 'licious',
]

const SHOPPING = [
  'amazon', 'flipkart', 'myntra', 'nykaa', 'ajio', 'meesho', 'snapdeal', 'croma',
  'reliancedigital', 'tata cliq', 'tatacliq', 'shopify', 'decathlon', 'ikea',
  'firstcry', 'limeroad', 'shoppers stop', 'lifestyle stores',
]

const TRAVEL = [
  'uber', 'ola', 'rapido', 'irctc', 'makemytrip', 'goibibo', 'redbus', 'indigo',
  'air india', 'spicejet', 'airbnb', 'booking.com', 'yatra', 'cleartrip',
  'indigo', 'vistara', 'ixigo', 'confirmtkt',
]

const BILLS = [
  'jio', 'airtel', 'vodafone', 'bsnl', 'tata power', 'bescom', 'electricity',
  'act fibernet', 'hathway', 'google play', 'apple.com/bill',
  'hdfc', 'icici', 'sbi card', 'american express', 'axis bank', 'credit card',
  'phonepe', 'paytm', 'bharat bill', 'bbps', 'gas bill', 'water bill',
]

const HEALTH = [
  'pharmeasy', 'netmeds', '1mg', 'tata 1mg', 'apollo', 'practo', 'fortis',
  'medplus', 'policybazaar', 'star health', 'hdfc ergo', 'icici lombard',
  'acko', 'care health', 'pharmacy', 'hospital', 'diagnostic', 'cult.fit', 'curefit',
]

const ENTERTAINMENT = [
  'bookmyshow', 'pvr', 'inox', 'netflix', 'spotify', 'hotstar', 'disney',
  'prime video', 'youtube', 'sonyliv', 'jio cinema', 'gaana', 'wynk',
  'steam', 'playstation', 'xbox', 'district by zomato',
]

const HOUSING = [
  'nobroker', 'magicbricks', 'housing.com', 'rent', 'landlord', 'society',
  'maintenance', 'brokerage', 'urban company', 'nested', 'stashfin rent',
]

const EDUCATION = [
  'byju', 'unacademy', 'coursera', 'udemy', 'upgrad', 'vedantu', 'physics wallah',
  'school fee', 'tuition', 'college', 'university', 'kindle unlimited',
]

const INVESTMENT = [
  'groww', 'zerodha', 'kite', 'upstox', 'angel one', 'angelone', 'angelbroking',
  'kuvera', 'smallcase', 'indmoney', 'etmoney', 'paytm money', 'paytmmoney',
  'hdfc securities', 'hdfcsec', 'icici direct', 'icicidirect', '5paisa', 'motilal',
  'coin by zerodha', 'coin.zerodha', 'nps', 'ppf', 'elss', 'sip', 'xirr',
  'mutual fund', 'mutualfund', 'demat', 'nsdl', 'cdsl', 'sovereign gold', 'digital gold',
  'jar app', 'gold sipp', 'epfo', 'provident fund', 'fixed deposit', 'recurring deposit',
  'units allotted', 'units allocated', 'order executed', 'shares bought', 'shares sold',
  'equity delivery', 'intraday', 'nav ', 'folio', 'camsonline', 'kfintech', 'mf central',
  'mfcentral', 'bse star', 'nse india', 'cdslindia', 'nsdl.co', 'indianclearing',
  'fyers', 'alice blue', 'aliceblue', 'sharekhan', 'edelweiss', 'geojit', 'iifl',
  'sbi mutual', 'sbi mf', 'nippon india', 'axis mutual', 'uti mutual', 'parag parikh',
  'ppfas', 'mirae', 'quant mf', 'motilal oswal', 'hdfc mf', 'icici pru',
  'investment ·', 'growwmail', 'zrdha', 'zerodha broking', 'groww bse', 'bse groww',
  'you invested', 'successfully invested', 'sip processed', 'systematic investment',
]

function haystack(tx: Pick<PlanningTransaction, 'brandName' | 'sender' | 'description' | 'type'>): string {
  return `${tx.brandName || ''} ${tx.sender || ''} ${tx.description || ''} ${tx.type || ''}`.toLowerCase()
}

function matches(text: string, needles: string[]): boolean {
  return needles.some((n) => text.includes(n))
}

export function isBillType(type?: string): boolean {
  const t = String(type || '').trim().toLowerCase()
  if (!t || t === 'transaction') return false
  return true
}

/** Groww / Zerodha / SIP / MF. Planning only; never count in Expenses totals. */
export function isInvestmentTransaction(
  tx: Pick<PlanningTransaction, 'brandName' | 'sender' | 'description' | 'type' | 'category'>,
): boolean {
  if (tx.category === 'investment') return true
  return matches(haystack(tx), INVESTMENT)
}

export function categorizeTransaction(tx: PlanningTransaction): PlanningCategory {
  if (tx.category && PLANNING_CATEGORIES.includes(tx.category)) return tx.category
  const text = haystack(tx)
  if (matches(text, INVESTMENT)) return 'investment'
  if (matches(text, FOOD)) return 'food'
  if (matches(text, SHOPPING)) return 'shopping'
  if (matches(text, TRAVEL)) return 'travel'
  if (matches(text, HEALTH)) return 'health'
  if (matches(text, ENTERTAINMENT)) return 'entertainment'
  if (matches(text, HOUSING)) return 'housing'
  if (matches(text, EDUCATION)) return 'education'
  if (matches(text, BILLS) || isBillType(tx.type)) return 'bills'
  return 'other'
}

export function parseInr(amount: string | number | null | undefined): number {
  if (typeof amount === 'number') return Number.isFinite(amount) ? amount : 0
  const n = parseFloat(String(amount || '').replace(/[₹$,\s,]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function parseTxDate(raw: string | null | undefined): Date | null {
  const value = String(raw || '').trim()
  if (!value || value === '(Unknown Date)') return null
  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) return parsed
  const m = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (m) {
    const day = Number(m[1])
    const month = Number(m[2]) - 1
    const year = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3])
    const d = new Date(year, month, day)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

export function currentMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function monthKeyToDate(month: string, endOfMonth = false): Date {
  const [y, m] = String(month || '').split('-').map(Number)
  const year = y || new Date().getFullYear()
  const monthIndex = (m || 1) - 1
  if (endOfMonth) return new Date(year, monthIndex + 1, 0, 23, 59, 59)
  return new Date(year, monthIndex, 1)
}

export function shiftMonth(month: string, delta: number): string {
  const base = monthKeyToDate(month)
  return currentMonthKey(new Date(base.getFullYear(), base.getMonth() + delta, 1))
}

export function isSameMonth(date: Date, now = new Date()): boolean {
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
}

export function transactionKey(tx: Pick<PlanningTransaction, 'brandName' | 'date' | 'amount' | 'sourceEmail' | 'description'>): string {
  return [
    String(tx.brandName || '').trim().toLowerCase(),
    String(tx.date || '').trim().slice(0, 10),
    String(tx.amount || '').replace(/[₹$,\s,]/g, ''),
    // Always key by inbox so extra Gmail spends ADD to primary instead of collapsing.
    String(tx.sourceEmail || '').trim().toLowerCase(),
    String(tx.description || '').trim().toLowerCase().slice(0, 48),
  ].join('|')
}

export function needsReview(tx: PlanningTransaction, category: PlanningCategory): boolean {
  if (tx.needsReview === false) return false
  if (tx.needsReview) return true
  // Investment / broker mail is often sparse on brand wording. keep it in totals.
  if (category === 'investment' && parseInr(tx.amount) > 0) return false
  if (category !== 'other') return false
  const brand = String(tx.brandName || '').trim().toLowerCase()
  if (!brand || brand === 'unknown' || brand === 'n/a' || brand === 'na') return true
  return parseInr(tx.amount) <= 0
}

export function enrichTransaction(tx: PlanningTransaction): PlanningTransaction {
  const category = categorizeTransaction(tx)
  const withSource = {
    ...tx,
    sourceEmail: tx.sourceEmail ? String(tx.sourceEmail).trim().toLowerCase() : tx.sourceEmail,
  }
  return {
    ...withSource,
    category,
    needsReview: needsReview(withSource, category),
    // Always recompute so inbox-scoped keys cannot be clobbered by a stale hash.
    dedupeHash: transactionKey(withSource),
  }
}

export function dedupeTransactions(rows: PlanningTransaction[]): PlanningTransaction[] {
  const seen = new Set<string>()
  const out: PlanningTransaction[] = []
  for (const row of rows) {
    const enriched = enrichTransaction(row)
    const key = enriched.dedupeHash || transactionKey(enriched)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(enriched)
  }
  return out
}

export function emptyCategorySpend(month: string): Record<PlanningCategory, number> {
  void month
  return Object.fromEntries(PLANNING_CATEGORIES.map((c) => [c, 0])) as Record<PlanningCategory, number>
}

export function spendByCategory(txs: PlanningTransaction[], now = new Date()): Record<PlanningCategory, number> {
  const totals = emptyCategorySpend(currentMonthKey(now))
  for (const tx of txs) {
    const date = parseTxDate(tx.date)
    if (!date || !isSameMonth(date, now) || tx.needsReview) continue
    totals[asPlanningCategory(tx.category || categorizeTransaction(tx))] += parseInr(tx.amount)
  }
  return totals
}

export function parseMonthKey(raw: unknown, fallback = currentMonthKey()): string {
  const value = String(raw || '').trim()
  return /^\d{4}-\d{2}$/.test(value) ? value : fallback
}

/** Current month → now. Past month → last day. Future month → first day. */
export function monthAnchorDate(month: string, now = new Date()): Date {
  const current = currentMonthKey(now)
  if (month === current) return now
  if (month < current) return monthKeyToDate(month, true)
  return monthKeyToDate(month)
}

export function transactionsInMonth(txs: PlanningTransaction[], month: string): PlanningTransaction[] {
  return txs.filter((tx) => {
    const date = parseTxDate(tx.date)
    return date ? currentMonthKey(date) === month : false
  })
}

export function applyOverrides(
  txs: PlanningTransaction[],
  overrides: PlanningTxOverride[],
): PlanningTransaction[] {
  if (!overrides.length) return txs
  const map = new Map(overrides.map((o) => [o.dedupeHash, o]))
  return txs.map((tx) => {
    const hash = tx.dedupeHash || transactionKey(tx)
    const override = map.get(hash)
    if (!override) return tx
    return {
      ...tx,
      category: override.category,
      needsReview: override.needsReview,
      dedupeHash: hash,
    }
  })
}
