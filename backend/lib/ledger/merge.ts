/** Stable dedupe key for ledger rows (Gmail message id when available). */
export function ledgerTransactionKey(
  tx: Record<string, unknown>,
  sourceEmail?: string | null,
): string {
  const messageId = String(tx.messageId || tx.gmailMessageId || '').trim()
  if (messageId) return `msg:${messageId}`

  const dateRaw = String(tx.date || '').trim()
  const dateKey = /^\d{4}-\d{2}-\d{2}/.test(dateRaw)
    ? dateRaw.slice(0, 10)
    : dateRaw.slice(0, 16)

  return [
    String(tx.brandName || '').trim().toLowerCase(),
    dateKey,
    String(tx.amount || '').replace(/[₹$,\s,]/g, ''),
    String(tx.sender || '').trim().toLowerCase().slice(0, 80),
    String(tx.type || 'Transaction').trim().toLowerCase(),
    String(tx.description || '').trim().toLowerCase().slice(0, 48),
    String(sourceEmail || tx.sourceEmail || '').trim().toLowerCase(),
  ].join('|')
}

function txSortTime(tx: Record<string, unknown>): number {
  const raw = String(tx.date || '').trim()
  const parsed = Date.parse(raw)
  if (Number.isFinite(parsed)) return parsed
  return 0
}

const RETENTION_MONTHS = 24

function txAgeMonths(tx: Record<string, unknown>): number | null {
  const raw = String(tx.date || '').trim()
  const parsed = Date.parse(raw)
  if (!Number.isFinite(parsed)) return null
  return (Date.now() - parsed) / (30.44 * 24 * 60 * 60 * 1000)
}

function pruneStaleTransactions(
  rows: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return rows.filter((tx) => {
    const messageId = String(tx.messageId || tx.gmailMessageId || '').trim()
    if (messageId) return true
    const age = txAgeMonths(tx)
    if (age == null) return true
    return age <= RETENTION_MONTHS
  })
}

/** Merge incoming scan rows into existing cache without dropping unseen history. */
export function mergeLedgerTransactions(
  existing: Array<Record<string, unknown>>,
  incoming: Array<Record<string, unknown>>,
  sourceEmail?: string | null,
): Array<Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>()

  for (const tx of existing) {
    map.set(ledgerTransactionKey(tx, sourceEmail), tx)
  }

  for (const tx of incoming) {
    const key = ledgerTransactionKey(tx, sourceEmail)
    const prev = map.get(key)
    map.set(key, prev ? { ...prev, ...tx } : tx)
  }

  return pruneStaleTransactions([...map.values()].sort((a, b) => txSortTime(b) - txSortTime(a)))
}
