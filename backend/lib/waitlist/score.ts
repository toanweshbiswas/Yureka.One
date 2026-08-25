import { withNormalizedSpend } from '@shared/scoreMetrics'
import { findWaitlistByEmail, upsertWaitlistJoin } from '../admin/store.js'
import { parseWaitlistMeta } from './public.js'
import { refineYurekaScore } from './scoreRefine.js'

export type ScorePayload = {
  score?: number
  decision?: string
  metrics?: Record<string, unknown> | null
}

function formatAvgSpend(avg: number): string {
  if (!Number.isFinite(avg) || avg <= 0) return ''
  if (avg >= 1000) return `₹${Math.round(avg / 1000)}k/mo`
  return `₹${Math.round(avg)}/mo`
}

/** Write scanner score onto the waitlist row without changing membership status. */
export async function persistScoreToWaitlist(opts: {
  email: string
  profile?: { name?: string | null } | null
  score: ScorePayload
  notify?: boolean
  /** When false, skip OpenAI refine (e.g. admin manual overrides). Default true. */
  refine?: boolean
}): Promise<number | null> {
  const email = String(opts.email || '').trim().toLowerCase()
  if (!email) return null

  const refined =
    opts.refine === false ? opts.score : await refineYurekaScore(opts.score)

  let scoreNum = Number(refined?.score)
  if (!Number.isFinite(scoreNum)) return null

  const metrics = withNormalizedSpend(
    (refined?.metrics && typeof refined.metrics === 'object'
      ? refined.metrics
      : {}) as Record<string, unknown>
  )
  const avg = Number(metrics.avg_monthly_spend_inr)
  const existing = await findWaitlistByEmail(email)
  const prevMeta = existing ? parseWaitlistMeta(existing) : {}
  const prevScore = Number(existing?.yurekaScore)
  // Blend toward new score so rescans don't thrash the home card (87 ↔ 39).
  if (Number.isFinite(prevScore) && prevScore >= 0) {
    const raw = scoreNum
    const blended = Math.round(prevScore * 0.55 + raw * 0.45)
    const maxStep = 15
    const stepped =
      Math.abs(blended - prevScore) <= maxStep
        ? blended
        : prevScore + Math.sign(blended - prevScore) * maxStep
    metrics.raw_scan_score = raw
    metrics.prev_score = prevScore
    metrics.smoothed = true
    scoreNum = Math.max(0, Math.min(100, stepped))
  }
  const prevEmailed = Number(prevMeta.scoreEmailedFor)
  const shouldNotify = opts.notify !== false
  const shouldEmail =
    shouldNotify &&
    (!Number.isFinite(prevEmailed) || Math.round(prevEmailed) !== Math.round(scoreNum))
  const decision =
    scoreNum >= 70 ? 'Approved' : scoreNum >= 40 ? 'Review' : scoreNum >= 20 ? 'Conditional' : 'Rejected'

  await upsertWaitlistJoin({
    email,
    fullName: opts.profile?.name || existing?.fullName || null,
    yurekaScore: scoreNum,
    monthlySpend: formatAvgSpend(avg) || (Number.isFinite(avg) ? '₹0/mo' : null),
    meta: {
      ...prevMeta,
      scoreDecision: decision,
      scoreMetrics: metrics,
      scoredAt: new Date().toISOString(),
    },
  })

  if (shouldNotify) {
    const { notifyScoreReady } = await import('../notifications/notify.js')
    await notifyScoreReady({
      email,
      fullName: opts.profile?.name || existing?.fullName,
      score: scoreNum,
      decision: decision || undefined,
    })
  }

  if (shouldEmail) {
    const { sendScoreReadyEmail } = await import('../mail/appEmails.js')
    const mail = await sendScoreReadyEmail({
      to: email,
      fullName: opts.profile?.name || existing?.fullName,
      score: scoreNum,
      decision: decision || undefined,
      metrics,
    })
    if (mail.sent) {
      console.log(`Yureka Score email sent to ${email}`)
      await upsertWaitlistJoin({
        email,
        meta: {
          scoreEmailedFor: scoreNum,
          scoreEmailedAt: new Date().toISOString(),
        },
      })
    } else {
      console.warn(`Skipping Yureka Score email for ${email} — ${mail.skipped || mail.error}`)
    }
  }

  console.log(
    `Persisted Yureka Score ${scoreNum} for ${email}` +
      (metrics.openai_refined ? ' (openai refined)' : ''),
  )
  return scoreNum
}
