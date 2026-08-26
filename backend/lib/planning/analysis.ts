import type { PlanningAnalysis, PlanningCategory, PlanningTransaction } from './types.js'
import { PLANNING_CATEGORIES } from './types.js'
import {
  categorizeTransaction,
  isSameMonth,
  parseInr,
  parseTxDate,
  spendByCategory,
} from './categories.js'

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function categoryOf(tx: PlanningTransaction): PlanningCategory {
  return (tx.category as PlanningCategory) || categorizeTransaction(tx)
}

export function buildAnalysis(txs: PlanningTransaction[], now = new Date()): PlanningAnalysis {
  const actuals = spendByCategory(txs, now)
  const byCategory = PLANNING_CATEGORIES.map((category) => ({
    category,
    actualInr: Math.round((actuals[category] || 0) * 100) / 100,
  }))

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dayTotals = new Map<string, number>()
  for (let d = 1; d <= daysInMonth; d++) {
    dayTotals.set(dayKey(new Date(now.getFullYear(), now.getMonth(), d)), 0)
  }

  const monthTotals = new Map<string, number>()
  for (let i = 5; i >= 0; i--) {
    const cursor = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthTotals.set(monthKey(cursor), 0)
  }

  const spendMerchants = new Map<string, number>()
  const investMerchants = new Map<string, number>()

  for (const tx of txs) {
    const date = parseTxDate(tx.date)
    const amount = parseInr(tx.amount)
    if (!date || amount <= 0 || tx.needsReview) continue
    const mk = monthKey(date)
    if (monthTotals.has(mk)) monthTotals.set(mk, (monthTotals.get(mk) || 0) + amount)
    if (isSameMonth(date, now)) {
      const dk = dayKey(date)
      if (dayTotals.has(dk)) dayTotals.set(dk, (dayTotals.get(dk) || 0) + amount)
      const name = String(tx.brandName || 'Unknown').trim() || 'Unknown'
      const cat = categoryOf(tx)
      if (cat === 'investment') {
        investMerchants.set(name, (investMerchants.get(name) || 0) + amount)
      } else {
        spendMerchants.set(name, (spendMerchants.get(name) || 0) + amount)
      }
    }
  }

  const toList = (map: Map<string, number>, n: number) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([name, amountInr]) => ({ name, amountInr: Math.round(amountInr * 100) / 100 }))

  return {
    byCategory,
    byDay: [...dayTotals.entries()].map(([date, amountInr]) => ({
      date,
      amountInr: Math.round(amountInr * 100) / 100,
    })),
    byMonth: [...monthTotals.entries()].map(([month, amountInr]) => ({
      month,
      amountInr: Math.round(amountInr * 100) / 100,
    })),
    // Lifestyle / shopping only. brokers belong under topInvestments
    topMerchants: toList(spendMerchants, 6),
    topInvestments: toList(investMerchants, 6),
  }
}
