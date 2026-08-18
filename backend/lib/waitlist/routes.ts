import type { Express, Request, Response } from 'express'
import { randomInt } from 'crypto'
import {
  countWaitlist,
  findWaitlistByEmail,
  listWaitlist,
  patchWaitlistMetadata,
  upsertWaitlistJoin,
  type WaitlistJoinInput,
  type WaitlistRow,
} from '../admin/store.js'
import { parseWaitlistMeta, toPublicWaitlistEntry } from './public.js'

const RANK_BOOST_PER_REFERRAL = 15
const RANK_BOOST_PER_APPROVAL = 35

function ok<T>(res: Response, data: T, status = 200) {
  res.status(status).json({ data, status, timestamp: new Date().toISOString() })
}

function fail(res: Response, status: number, error: string) {
  res.status(status).json({ data: null, status, error, timestamp: new Date().toISOString() })
}

function makeReferralCode() {
  return `YRKMNY${String(randomInt(1000, 9999))}`
}

function computeRankFor(row: WaitlistRow, all: WaitlistRow[]) {
  const meta = parseWaitlistMeta(row)
  const code = String(meta.personalReferralCode || '').trim()
  const baseRank = typeof meta.rank === 'number' ? meta.rank : 1000
  let totalReferrals = 0
  let approvedReferrals = 0

  if (code) {
    for (const other of all) {
      const otherMeta = parseWaitlistMeta(other)
      if (String(otherMeta.referredBy || '').trim() === code) {
        totalReferrals += 1
        if (other.status === 'accepted') approvedReferrals += 1
      }
    }
  }

  const rankBoost =
    totalReferrals * RANK_BOOST_PER_REFERRAL + approvedReferrals * RANK_BOOST_PER_APPROVAL
  const effectiveRank = Math.max(1, baseRank - rankBoost)

  return {
    baseRank,
    effectiveRank,
    totalReferrals,
    approvedReferrals,
    rankBoost,
    entry: toPublicWaitlistEntry(row, { ...meta, rank: effectiveRank }),
  }
}

export function registerWaitlistRoutes(app: Express) {
  app.post('/api/v1/waitlist/join', async (req: Request, res: Response) => {
    try {
      const body = req.body || {}
      const email = String(body.email || '').trim().toLowerCase()
      if (!email || !email.includes('@')) {
        return fail(res, 400, 'Valid email is required')
      }

      const name = String(body.name || [body.first_name, body.last_name].filter(Boolean).join(' ') || '').trim()
      const mobile = String(body.mobile_number || body.phone || '').trim() || null
      const existing = await findWaitlistByEmail(email)

      // Idempotent resume: anyone already on the waitlist should not be treated as a new join.
      // Accepted / rejected / on_hold never re-run intake. Pending can optionally patch
      // profile fields, but still returns alreadyExists so the UI does not say "newly added".
      if (existing && existing.status !== 'pending') {
        return ok(res, {
          data: toPublicWaitlistEntry(existing, parseWaitlistMeta(existing)),
          alreadyExists: true,
        })
      }

      // Soft resume: if they already applied as pending and this request has no new profile
      // fields (status-check style), return the existing row without rewriting it.
      const hasProfilePatch = Boolean(
        name ||
          mobile ||
          body.yureka_score != null ||
          body.monthly_spend != null ||
          body.most_used_for != null ||
          body.source_channel != null ||
          body.date_of_birth != null ||
          body.gender != null
      )
      if (existing && existing.status === 'pending' && !hasProfilePatch) {
        return ok(res, {
          data: toPublicWaitlistEntry(existing, parseWaitlistMeta(existing)),
          alreadyExists: true,
        })
      }

      let personalReferralCode = ''
      let rank = 1000
      let alreadyExists = false

      if (existing) {
        alreadyExists = true
        const meta = parseWaitlistMeta(existing)
        personalReferralCode = meta.personalReferralCode || makeReferralCode()
        rank = typeof meta.rank === 'number' ? meta.rank : 1000
      } else {
        const total = await countWaitlist()
        rank = 1000 + total + 1
        personalReferralCode = makeReferralCode()
      }

      const input: WaitlistJoinInput = {
        email,
        fullName: name || null,
        mobileNumber: mobile,
        // Never demote accepted / rejected / on_hold — preserve existing terminal status.
        status: existing?.status && existing.status !== 'pending' ? existing.status : 'pending',
        yurekaScore:
          body.yureka_score != null && Number.isFinite(Number(body.yureka_score))
            ? Number(body.yureka_score)
            : existing?.yurekaScore ?? null,
        monthlySpend: body.monthly_spend != null ? String(body.monthly_spend) : existing?.monthlySpend ?? null,
        topCategory: body.most_used_for != null ? String(body.most_used_for) : existing?.topCategory ?? null,
        meta: {
          personalReferralCode,
          rank,
          referredBy: body.referral_code ? String(body.referral_code) : undefined,
          sourceChannel: body.source_channel ? String(body.source_channel) : undefined,
          dateOfBirth: body.date_of_birth ? String(body.date_of_birth) : undefined,
          gender: body.gender ? String(body.gender) : undefined,
          mostUsedFor: body.most_used_for ? String(body.most_used_for) : undefined,
        },
      }

      const { row, meta } = await upsertWaitlistJoin(input)
      if (!alreadyExists) {
        const { sendWaitlistReceivedEmail } = await import('../mail/appEmails.js')
        const mail = await sendWaitlistReceivedEmail({ to: email, fullName: name || row.fullName })
        if (!mail.sent) {
          console.warn('[waitlist] received email not sent:', mail.skipped || mail.error)
        }
      }
      ok(res, {
        data: toPublicWaitlistEntry(row, meta),
        alreadyExists,
      })
    } catch (e: any) {
      console.error('[waitlist] join failed:', e?.message || e)
      fail(res, 500, e?.message || 'Failed to join waitlist')
    }
  })

  app.get('/api/v1/waitlist/entry', async (req: Request, res: Response) => {
    try {
      const email = String(req.query.email || '').trim().toLowerCase()
      if (!email) return fail(res, 400, 'email is required')
      const row = await findWaitlistByEmail(email)
      if (!row) return fail(res, 404, 'Waitlist entry not found')
      ok(res, toPublicWaitlistEntry(row, parseWaitlistMeta(row)))
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load waitlist entry')
    }
  })

  app.post('/api/v1/waitlist/rank/compute', async (req: Request, res: Response) => {
    try {
      const email = String(req.body?.email || req.query.email || '').trim().toLowerCase()
      if (!email) return fail(res, 400, 'email is required')
      const row = await findWaitlistByEmail(email)
      if (!row) return fail(res, 404, 'Waitlist entry not found')
      const all = await listWaitlist({ status: 'all' })
      const result = computeRankFor(row, all)
      await patchWaitlistMetadata(row.id, { rank: result.effectiveRank })
      ok(res, result)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to compute rank')
    }
  })

  app.get('/api/v1/waitlist/referrals', async (req: Request, res: Response) => {
    try {
      const code = String(req.query.code || '').trim()
      if (!code) return fail(res, 400, 'code is required')
      const all = await listWaitlist({ status: 'all' })
      const referrals = all
        .filter((row) => String(parseWaitlistMeta(row).referredBy || '').trim() === code)
        .map((row) => toPublicWaitlistEntry(row, parseWaitlistMeta(row)))
      ok(res, { code, count: referrals.length, referrals })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load referrals')
    }
  })

  app.patch('/api/v1/waitlist/:id/metadata', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id || '').trim()
      if (!id) return fail(res, 400, 'id is required')
      const patch = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>
      const updated = await patchWaitlistMetadata(id, patch)
      if (!updated) return fail(res, 404, 'Waitlist entry not found')
      ok(res, toPublicWaitlistEntry(updated.row, updated.meta))
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to update metadata')
    }
  })
}
