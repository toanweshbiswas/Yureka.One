import type { PlanningAnalysis, PlanningForecast, CategorySpend } from './types.js'

export type PlanningInsight = {
  headline: string
  tips: string[]
  riskFlags: string[]
  engine: 'openai' | 'heuristic'
}

function heuristicInsights(
  forecast: PlanningForecast,
  categories: CategorySpend[],
  analysis: PlanningAnalysis,
): PlanningInsight {
  const tips: string[] = []
  const riskFlags: string[] = []
  const investment = categories.find((c) => c.category === 'investment')
  const lifestyleSpend = categories
    .filter((c) => c.category !== 'investment')
    .reduce((sum, c) => sum + (c.actualInr || 0), 0)

  if (forecast.totalBudgetInr > 0 && forecast.projectedMonthEndInr > forecast.totalBudgetInr * 1.05) {
    riskFlags.push('Pace is above your monthly budget')
    tips.push('Trim the top overspend lifestyle category by 10% for the rest of the month')
  } else if (lifestyleSpend > 0) {
    tips.push('Keep daily lifestyle pace steady. you are on track for this month')
  } else {
    tips.push('Add a few expenses or resync Gmail to unlock a full plan')
  }

  const over = categories
    .filter((c) => c.category !== 'investment' && c.monthlyLimitInr > 0 && c.actualInr > c.monthlyLimitInr)
    .sort((a, b) => b.actualInr - a.actualInr)
  if (over[0]) {
    riskFlags.push(`${over[0].category} is over budget`)
    tips.push(`Pause non-essential ${over[0].category} spend until next month`)
  }

  const top = analysis.topMerchants[0]
  if (top) tips.push(`${top.name} is your top lifestyle merchant. check gift-card or Goldback`)

  const topInvest = analysis.topInvestments?.[0]
  if (investment && investment.actualInr > 0 && topInvest) {
    tips.push(
      `Invested ₹${Math.round(investment.actualInr).toLocaleString('en-IN')} via ${topInvest.name}. tracked separately from spend`,
    )
  }

  return {
    headline:
      lifestyleSpend > 0
        ? `₹${Math.round(lifestyleSpend).toLocaleString('en-IN')} lifestyle · ₹${Math.round(investment?.actualInr || 0).toLocaleString('en-IN')} invested`
        : forecast.spentSoFarInr > 0
          ? `₹${Math.round(forecast.spentSoFarInr).toLocaleString('en-IN')} tracked this month`
          : 'Plan this month from inbox spend and manual entries',
    tips: tips.slice(0, 3),
    riskFlags: riskFlags.slice(0, 3),
    engine: 'heuristic',
  }
}

/** Planning insights stay local. no OpenAI on month loads / reloads. */
export async function buildPlanningInsights(opts: {
  forecast: PlanningForecast
  categories: CategorySpend[]
  analysis: PlanningAnalysis
  month: string
}): Promise<PlanningInsight> {
  void opts.month
  return heuristicInsights(opts.forecast, opts.categories, opts.analysis)
}
