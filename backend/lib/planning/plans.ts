import type { CategorySpend, PlanningAnalysis, PlanningForecast } from './types.js'

export type SpendPlanId = 'conservative' | 'expected' | 'stretch'

export type SpendPlan = {
  id: SpendPlanId
  label: string
  projectedMonthEndInr: number
  dailyCapInr: number
  vsBudgetInr: number | null
  summary: string
  moves: string[]
}

function roundInr(n: number): number {
  return Math.round(Number(n) || 0)
}

function heuristicPlans(
  forecast: PlanningForecast,
  categories: CategorySpend[],
): SpendPlan[] {
  const remainingDays = Math.max(1, forecast.daysInMonth - forecast.daysElapsed)
  const pace = forecast.projectedMonthEndInr
  const budget = forecast.totalBudgetInr > 0 ? forecast.totalBudgetInr : null
  const spent = forecast.spentSoFarInr

  const conservativeEnd = roundInr(spent + forecast.dailyPaceInr * remainingDays * 0.75)
  const expectedEnd = roundInr(pace)
  const stretchEnd = roundInr(
    budget != null
      ? Math.min(pace * 1.12, Math.max(pace, budget * 1.08))
      : pace * 1.12,
  )

  const top = [...categories]
    .filter((c) => c.actualInr > 0)
    .sort((a, b) => b.actualInr - a.actualInr)[0]

  const topLabel = top?.category || 'discretionary'

  const mk = (
    id: SpendPlanId,
    label: string,
    end: number,
    summary: string,
    moves: string[],
  ): SpendPlan => ({
    id,
    label,
    projectedMonthEndInr: end,
    dailyCapInr: roundInr(Math.max(0, (end - spent) / remainingDays)),
    vsBudgetInr: budget != null ? roundInr(end - budget) : null,
    summary,
    moves,
  })

  return [
    mk(
      'conservative',
      'Conserve',
      conservativeEnd,
      'Cut pace ~25% for the rest of the month.',
      [
        `Cap daily spend near ₹${roundInr(Math.max(0, (conservativeEnd - spent) / remainingDays)).toLocaleString('en-IN')}`,
        `Trim ${topLabel} first — largest bucket this month`,
        'Park SIPs already committed; pause new one-off investments',
      ],
    ),
    mk(
      'expected',
      'Expected',
      expectedEnd,
      'Continue current daily pace through month-end.',
      [
        `Hold ~₹${roundInr(forecast.dailyPaceInr).toLocaleString('en-IN')}/day`,
        budget != null
          ? expectedEnd > budget
            ? `On track to exceed budget by ₹${roundInr(expectedEnd - budget).toLocaleString('en-IN')}`
            : `Leaves ~₹${roundInr(budget - expectedEnd).toLocaleString('en-IN')} under budget`
          : 'Set category budgets to compare against this pace',
        'Review upcoming bills before weekend spend',
      ],
    ),
    mk(
      'stretch',
      'Stretch',
      stretchEnd,
      'Allow a buffer for travel, gifts, or market dips.',
      [
        `Daily room ~₹${roundInr(Math.max(0, (stretchEnd - spent) / remainingDays)).toLocaleString('en-IN')}`,
        `Keep ${topLabel} from running away — soft cap +10%`,
        'Use Goldback / gift cards on planned shopping',
      ],
    ),
  ]
}

export async function buildSpendPlans(opts: {
  forecast: PlanningForecast
  categories: CategorySpend[]
  analysis: PlanningAnalysis
  month: string
}): Promise<{ plans: SpendPlan[]; engine: 'openai' | 'heuristic' }> {
  void opts.analysis
  void opts.month
  // Heuristic only — 3 spend plans must not call OpenAI on every planning load.
  return { plans: heuristicPlans(opts.forecast, opts.categories), engine: 'heuristic' }
}
