export const PLANNING_CATEGORIES = [
  'food',
  'shopping',
  'travel',
  'bills',
  'health',
  'entertainment',
  'housing',
  'education',
  'investment',
  'other',
] as const
export type PlanningCategory = (typeof PLANNING_CATEGORIES)[number]

export const PLANNING_CATEGORY_META: Record<PlanningCategory, { label: string; color: string }> = {
  food: { label: 'Food', color: '#34d399' },
  shopping: { label: 'Shopping', color: '#60a5fa' },
  travel: { label: 'Travel', color: '#c084fc' },
  bills: { label: 'Bills', color: '#fbbf24' },
  health: { label: 'Health', color: '#fb7185' },
  entertainment: { label: 'Entertainment', color: '#a78bfa' },
  housing: { label: 'Housing', color: '#818cf8' },
  education: { label: 'Education', color: '#38bdf8' },
  investment: { label: 'Investment', color: '#f59e0b' },
  other: { label: 'Other', color: '#94a3b8' },
}

export function isPlanningCategory(value: unknown): value is PlanningCategory {
  return PLANNING_CATEGORIES.includes(String(value || '') as PlanningCategory)
}

export function asPlanningCategory(value: unknown): PlanningCategory {
  return isPlanningCategory(value) ? value : 'other'
}

export const MAX_EXTRA_INBOXES = 3

export interface PlanningInbox {
  id: string
  userId: string
  gmail: string
  connectedAt: string
  lastScannedAt: string | null
  lastError: string | null
}

export interface PlanningBudget {
  id: string
  userId: string
  category: PlanningCategory
  monthlyLimitInr: number
  month: string
}

export interface PlanningTransaction {
  brandName: string
  amount: string
  description: string
  date: string
  sender: string
  type?: string
  sourceEmail?: string
  source?: 'gmail' | 'manual'
  category?: PlanningCategory
  needsReview?: boolean
  dedupeHash?: string
  entryId?: string
}

export interface PlanningManualEntry {
  id: string
  userId: string
  merchant: string
  amountInr: number
  category: PlanningCategory
  date: string
  note?: string
  createdAt: string
}

export interface PlanningTxOverride {
  userId: string
  dedupeHash: string
  category: PlanningCategory
  needsReview: boolean
}

export interface PlanningAnalysis {
  byCategory: { category: PlanningCategory; actualInr: number }[]
  byDay: { date: string; amountInr: number }[]
  byMonth: { month: string; amountInr: number }[]
  topMerchants: { name: string; amountInr: number }[]
  /** Broker / SIP / MF only — kept separate so Top merchants is lifestyle spend */
  topInvestments?: { name: string; amountInr: number }[]
}

export interface CategorySpend {
  category: PlanningCategory
  monthlyLimitInr: number
  actualInr: number
  remainingInr: number
}

export interface UpcomingBill {
  brandName: string
  amount: string
  date: string
  type?: string
  sourceEmail?: string
  recurring?: boolean
}

export interface PlanningForecast {
  month: string
  daysElapsed: number
  daysInMonth: number
  spentSoFarInr: number
  dailyPaceInr: number
  projectedMonthEndInr: number
  totalBudgetInr: number
  upcomingBills: UpcomingBill[]
  upcomingBillsInr: number
}

export type SpendPlanId = 'conservative' | 'expected' | 'stretch'

export interface SpendPlan {
  id: SpendPlanId
  label: string
  projectedMonthEndInr: number
  dailyCapInr: number
  vsBudgetInr: number | null
  summary: string
  moves: string[]
}

export interface PlanningSnapshot {
  inboxes: PlanningInbox[]
  budgets: PlanningBudget[]
  entries: PlanningManualEntry[]
  overrides?: PlanningTxOverride[]
}

export interface PlanningOverview {
  inboxes: PlanningInbox[]
  budgets: PlanningBudget[]
  entries: PlanningManualEntry[]
  categories: CategorySpend[]
  forecast: PlanningForecast
  analysis: PlanningAnalysis
  insights?: {
    headline: string
    tips: string[]
    riskFlags: string[]
    engine: 'openai' | 'heuristic'
  }
  plans?: SpendPlan[]
  plansEngine?: 'openai' | 'heuristic'
  transactions: PlanningTransaction[]
  reviewCount: number
  extraTransactionCount: number
  primaryTransactionCount: number
  /** All inboxes + manual after dedupe */
  mergedTransactionCount?: number
  /** Extra-inbox rows inside the selected month */
  extraInMonthCount?: number
  month: string
}
