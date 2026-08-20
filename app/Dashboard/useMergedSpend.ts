import { useEffect, useMemo, useState } from 'react'
import { useSupabase } from '@shared/SupabaseProvider'
import { onPlanningUpdated, planningApi } from '@backend/lib/planning/client'
import type { PlanningTransaction } from '@backend/lib/planning/types'

export type SpendTransaction = {
  brandName: string
  amount: string
  description: string
  date: string
  sender: string
  type?: string
  sourceEmail?: string
}

function txKey(tx: Pick<SpendTransaction, 'brandName' | 'date' | 'amount'>) {
  return `${String(tx.brandName || '').trim().toLowerCase()}|${String(tx.date || '').trim()}|${String(tx.amount || '').trim()}`
}

function mergeSpend(primary: SpendTransaction[], extra: SpendTransaction[]): SpendTransaction[] {
  const seen = new Set<string>()
  const out: SpendTransaction[] = []
  for (const row of [...(primary || []), ...(extra || [])]) {
    const key = txKey(row)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}

export function useMergedSpend() {
  const { user, ledgerTransactions } = useSupabase()
  const userId = user?.id || user?.email || ''
  const [extra, setExtra] = useState<PlanningTransaction[]>([])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const load = async () => {
      const res = await planningApi.extraTransactions(userId)
      if (cancelled || !res.data) return
      setExtra(res.data.transactions || [])
    }
    void load()
    const off = onPlanningUpdated(() => {
      void load()
    })
    return () => {
      cancelled = true
      off()
    }
  }, [userId])

  const merged = useMemo(
    () => mergeSpend((ledgerTransactions || []) as SpendTransaction[], extra),
    [ledgerTransactions, extra],
  )

  return { transactions: merged, extraCount: extra.length }
}
