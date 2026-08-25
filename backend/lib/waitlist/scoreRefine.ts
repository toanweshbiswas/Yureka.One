import { openaiChatJson, openaiConfigured } from '../ai/openai.js'
import type { ScorePayload } from './score.js'

type RefineResult = {
  scoreDelta?: number
  summary?: string
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

function decisionFromScore(score: number): string {
  if (score >= 70) return 'Approved'
  if (score >= 40) return 'Review'
  if (score >= 20) return 'Conditional'
  return 'Rejected'
}

const MAX_DELTA = 5

function thinData(metrics: Record<string, unknown>): boolean {
  const orders = Number(metrics.orders_6m) || 0
  const spend = Number(metrics.spend_total_inr) || 0
  return orders < 3 && spend < 5_000
}

/**
 * Deterministic scanner score is authoritative.
 * OpenAI is optional, tiny, and skipped when data is thin or SCORE_AI=0.
 */
export async function refineYurekaScore(payload: ScorePayload): Promise<ScorePayload> {
  const baseScore = clampScore(Number(payload?.score))
  if (!Number.isFinite(Number(payload?.score))) return payload

  const metrics =
    payload.metrics && typeof payload.metrics === 'object'
      ? ({ ...payload.metrics } as Record<string, unknown>)
      : {}

  const heuristicDecision =
    typeof payload.decision === 'string' && payload.decision.trim()
      ? payload.decision.trim()
      : decisionFromScore(baseScore)

  const scoreAiOff = ['0', 'false', 'off', 'no'].includes(
    String(process.env.SCORE_AI || '1').trim().toLowerCase(),
  )

  if (!openaiConfigured() || scoreAiOff || thinData(metrics)) {
    return {
      score: baseScore,
      decision: heuristicDecision,
      metrics: {
        ...metrics,
        score_engine: 'heuristic',
        openai_refined: false,
        openai_skipped: scoreAiOff ? 'score_ai_off' : thinData(metrics) ? 'thin_data' : 'no_key',
      },
    }
  }

  const compact = {
    s: baseScore,
    o: metrics.orders_6m,
    avg: metrics.avg_monthly_spend_inr,
    prepaid: metrics.prepaid_orders,
    cod: metrics.cod_orders,
    ret: metrics.returned_orders,
    ref: metrics.refunded_orders,
    pen: metrics.penalty,
    bon: metrics.bonus,
  }

  const ai = await openaiChatJson<RefineResult>({
    system:
      'Yureka Score. heuristic s is truth. JSON only: scoreDelta (-5..5 int), summary (≤90 chars). No invented spend.',
    user: JSON.stringify(compact),
    temperature: 0,
    timeoutMs: 6_000,
    maxTokens: 100,
    maxUserChars: 400,
  })

  if (!ai.data) {
    if (ai.error) console.warn('[scoreRefine] OpenAI skipped:', ai.error)
    return {
      score: baseScore,
      decision: heuristicDecision,
      metrics: {
        ...metrics,
        score_engine: 'heuristic',
        openai_refined: false,
        openai_error: ai.error || 'invalid_response',
      },
    }
  }

  const deltaRaw = Number(ai.data.scoreDelta)
  const delta = Number.isFinite(deltaRaw)
    ? Math.max(-MAX_DELTA, Math.min(MAX_DELTA, Math.round(deltaRaw)))
    : 0
  const refined = clampScore(baseScore + delta)

  return {
    score: refined,
    decision: decisionFromScore(refined),
    metrics: {
      ...metrics,
      score_engine: 'heuristic+openai',
      openai_refined: true,
      openai_model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      heuristic_score: baseScore,
      score_delta: delta,
      score_summary:
        typeof ai.data.summary === 'string' ? ai.data.summary.trim().slice(0, 120) : undefined,
    },
  }
}
