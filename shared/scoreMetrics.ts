const WINDOW_MONTHS = 6

function num(metrics: Record<string, unknown> | null | undefined, key: string): number {
  if (!metrics) return 0
  const v = Number(metrics[key])
  return Number.isFinite(v) ? v : 0
}

/** 6-month INR total and monthly average. Monthly is always total / 6. */
export function spendFromMetrics(metrics?: Record<string, unknown> | null): {
  spendTotal: number
  avgMonthly: number
  windowMonths: number
} {
  const windowMonths = num(metrics, 'window_months') || WINDOW_MONTHS
  const spendTotal = num(metrics, 'spend_total_inr')
  const rawAvg = num(metrics, 'avg_monthly_spend_inr')
  if (spendTotal > 0) {
    return { spendTotal, avgMonthly: spendTotal / windowMonths, windowMonths }
  }
  if (rawAvg > 0) {
    return { spendTotal: rawAvg * windowMonths, avgMonthly: rawAvg, windowMonths }
  }
  return { spendTotal: 0, avgMonthly: 0, windowMonths }
}

export function withNormalizedSpend(
  metrics: Record<string, unknown>
): Record<string, unknown> {
  const { spendTotal, avgMonthly, windowMonths } = spendFromMetrics(metrics)
  return {
    ...metrics,
    window_months: windowMonths,
    spend_total_inr: Math.round(spendTotal * 100) / 100,
    avg_monthly_spend_inr: Math.round(avgMonthly * 100) / 100,
  }
}
