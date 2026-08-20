import type {
  CategorySpend,
  PlanningBudget,
  PlanningForecast,
  PlanningTransaction,
  UpcomingBill,
} from './types.js'
import { PLANNING_CATEGORIES } from './types.js'
import {
  currentMonthKey,
  isBillType,
  isSameMonth,
  parseInr,
  parseTxDate,
  spendByCategory,
} from './categories.js'

function daysInMonth(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
}

export function buildCategorySpend(
  txs: PlanningTransaction[],
  budgets: PlanningBudget[],
  now = new Date(),
): CategorySpend[] {
  const actuals = spendByCategory(txs, now)
  const limits = Object.fromEntries(PLANNING_CATEGORIES.map((c) => [c, 0])) as Record<string, number>
  for (const b of budgets) limits[b.category] = Math.max(0, Number(b.monthlyLimitInr) || 0)
  return PLANNING_CATEGORIES.map((category) => {
    const monthlyLimitInr = limits[category] || 0
    const actualInr = Math.round((actuals[category] || 0) * 100) / 100
    return {
      category,
      monthlyLimitInr,
      actualInr,
      remainingInr: Math.round((monthlyLimitInr - actualInr) * 100) / 100,
    }
  })
}

export function buildForecast(
  txs: PlanningTransaction[],
  budgets: PlanningBudget[],
  now = new Date(),
): PlanningForecast {
  const month = currentMonthKey(now)
  const inMonth = daysInMonth(now)
  const elapsed = Math.max(1, Math.min(now.getDate(), inMonth))
  const monthTxs = txs.filter((tx) => {
    if (tx.needsReview) return false
    const date = parseTxDate(tx.date)
    return date ? isSameMonth(date, now) : false
  })
  const spentSoFarInr = Math.round(
    monthTxs.reduce((sum, tx) => sum + parseInr(tx.amount), 0) * 100,
  ) / 100
  const dailyPaceInr = Math.round((spentSoFarInr / elapsed) * 100) / 100
  const projectedMonthEndInr = Math.round(dailyPaceInr * inMonth * 100) / 100
  const totalBudgetInr = budgets.reduce((sum, b) => sum + Math.max(0, Number(b.monthlyLimitInr) || 0), 0)

  const upcomingBills: UpcomingBill[] = []
  const seenMerchant = new Set<string>()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

  for (const tx of txs) {
    if (!isBillType(tx.type) || tx.needsReview) continue
    const date = parseTxDate(tx.date)
    if (!date || !isSameMonth(date, now)) continue
    if (date.getTime() < todayStart) continue
    const merchant = String(tx.brandName || '').trim().toLowerCase()
    if (!merchant || seenMerchant.has(merchant)) continue
    seenMerchant.add(merchant)
    upcomingBills.push({
      brandName: tx.brandName,
      amount: tx.amount,
      date: tx.date,
      type: tx.type,
      sourceEmail: tx.sourceEmail,
    })
  }

  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  for (const tx of txs) {
    if (!isBillType(tx.type) || tx.needsReview) continue
    const date = parseTxDate(tx.date)
    if (!date || !isSameMonth(date, lastMonth)) continue
    const merchant = String(tx.brandName || '').trim().toLowerCase()
    if (!merchant || seenMerchant.has(merchant)) continue
    seenMerchant.add(merchant)
    upcomingBills.push({
      brandName: tx.brandName,
      amount: tx.amount,
      date: tx.date,
      type: tx.type,
      sourceEmail: tx.sourceEmail,
      recurring: true,
    })
  }

  const upcomingBillsInr = Math.round(
    upcomingBills.reduce((sum, b) => sum + parseInr(b.amount), 0) * 100,
  ) / 100

  return {
    month,
    daysElapsed: elapsed,
    daysInMonth: inMonth,
    spentSoFarInr,
    dailyPaceInr,
    projectedMonthEndInr,
    totalBudgetInr,
    upcomingBills: upcomingBills.slice(0, 12),
    upcomingBillsInr,
  }
}
