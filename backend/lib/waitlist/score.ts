import { withNormalizedSpend } from '@shared/scoreMetrics'
import { findWaitlistByEmail, upsertWaitlistJoin } from '../admin/store.js'
import { parseWaitlistMeta } from './public.js'

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
}): Promise<number | null> {
  const email = String(opts.email || '').trim().toLowerCase()
  const scoreNum = Number(opts.score?.score)
  if (!email || !Number.isFinite(scoreNum)) return null

  const metrics = withNormalizedSpend(
    (opts.score?.metrics && typeof opts.score.metrics === 'object'
      ? opts.score.metrics
      : {}) as Record<string, unknown>
  )
  const avg = Number(metrics.avg_monthly_spend_inr)
  const existing = await findWaitlistByEmail(email)
  const prevMeta = existing ? parseWaitlistMeta(existing) : {}
  const prevEmailed = Number(prevMeta.scoreEmailedFor)
  const shouldNotify = opts.notify !== false
  const shouldEmail =
    shouldNotify &&
    (!Number.isFinite(prevEmailed) || Math.round(prevEmailed) !== Math.round(scoreNum))

  await upsertWaitlistJoin({
    email,
    fullName: opts.profile?.name || existing?.fullName || null,
    yurekaScore: scoreNum,
    monthlySpend: formatAvgSpend(avg) || (Number.isFinite(avg) ? '₹0/mo' : null),
    meta: {
      ...prevMeta,
      scoreDecision: opts.score?.decision || null,
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
      decision: opts.score?.decision,
    })
  }

  if (shouldEmail) {
    const { sendScoreReadyEmail } = await import('../mail/appEmails.js')
    const mail = await sendScoreReadyEmail({
      to: email,
      fullName: opts.profile?.name || existing?.fullName,
      score: scoreNum,
      decision: opts.score?.decision,
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

  console.log(`Persisted Yureka Score ${scoreNum} for ${email}`)
  return scoreNum
}
