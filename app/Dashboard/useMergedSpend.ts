import { useMemo } from 'react'
import { useSupabase } from '@shared/SupabaseProvider'
import { isMarketingLedgerRow, collapseRepetitiveTransactions } from '@backend/lib/ledger/marketingFilter'
import { isInvestmentTransaction } from '@backend/lib/planning/categories'

export type SpendTransaction = {
  brandName: string
  amount: string
  description: string
  date: string
  sender: string
  type?: string
  sourceEmail?: string
  category?: string
}

/**
 * Expenses / Bills read the PRIMARY Gmail ledger only.
 * Planning extras + investments stay on the Planning path — never merge here.
 */
export function useExpenseLedger() {
  const { ledgerTransactions } = useSupabase()

  const lifestyle = useMemo(() => {
    const rows = (ledgerTransactions || []) as SpendTransaction[]
    const filtered = rows.filter((tx) => {
      if (isMarketingLedgerRow(tx)) return false
      if (isInvestmentTransaction(tx)) return false
      return true
    })
    return collapseRepetitiveTransactions(filtered as any) as SpendTransaction[]
  }, [ledgerTransactions])

  return { transactions: lifestyle }
}

/** @deprecated Use useExpenseLedger — kept so old imports fail loudly in types if needed */
export function useMergedSpend() {
  return useExpenseLedger()
}
