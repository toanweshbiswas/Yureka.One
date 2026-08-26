/** Server-side bill row detection (Cred-style credit card / utility bills). */
export type BillTransaction = {
  brandName: string
  amount: string
  description: string
  date: string
  sender: string
  type?: string
  messageId?: string
  dueDate?: string | null
  minimumDue?: string | null
  totalDue?: string | null
}

const BILL_TYPES = new Set([
  'credit card bill',
  'invoice',
  'bill',
  'bill transaction',
  'subscription',
  'utility bill',
])

export function isBillTransaction(tx: Record<string, unknown>): boolean {
  const type = String(tx.type || '').trim().toLowerCase()
  if (type && BILL_TYPES.has(type)) return true
  if (type === 'transaction') return false
  const hay = `${tx.description || ''} ${tx.sender || ''} ${tx.brandName || ''}`.toLowerCase()
  return (
    /statement|outstanding|amount due|minimum due|credit card bill|emi due|bill payment/.test(hay) &&
    !/order confirmed|shipped|delivered/.test(hay)
  )
}

export function filterBillTransactions(
  rows: Array<Record<string, unknown>> | undefined | null,
): BillTransaction[] {
  return (rows || [])
    .filter(isBillTransaction)
    .map((tx) => ({
      brandName: String(tx.brandName || 'Unknown'),
      amount: String(tx.amount || 'N/A'),
      description: String(tx.description || ''),
      date: String(tx.date || ''),
      sender: String(tx.sender || ''),
      type: String(tx.type || 'Bill'),
      messageId: tx.messageId ? String(tx.messageId) : undefined,
      dueDate: tx.dueDate ? String(tx.dueDate) : null,
      minimumDue: tx.minimumDue ? String(tx.minimumDue) : null,
      totalDue: tx.totalDue ? String(tx.totalDue) : tx.amount ? String(tx.amount) : null,
    }))
}
