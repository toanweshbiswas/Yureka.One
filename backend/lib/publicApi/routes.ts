import type { Express, Request, Response } from 'express'
import { readLedgerCache, runGmailScanner, writeLedgerCache } from '../ledger/scannerRunner.js'
import { consumeLedgerResync, getLedgerResyncQuota } from '../ledger/resyncQuota.js'
import { blogToApi, getBlogBySlug, listBlogs } from '../cms/blogStore.js'
import { sendAppPasswordResetEmail } from '../auth/passwordReset.js'

function ok<T>(res: Response, data: T, status = 200) {
  res.status(status).json({ data, status, timestamp: new Date().toISOString() })
}

function fail(res: Response, status: number, error: string, extra?: Record<string, unknown>) {
  res.status(status).json({
    data: null,
    status,
    error,
    timestamp: new Date().toISOString(),
    ...(extra || {}),
  })
}

/**
 * Lightweight public CMS + dashboard companion routes so the SPA does not
 * hard-fail when the full Java/CMS backend is not present. Cards fall through
 * to the frontend static set when this returns [].
 */
export function registerPublicApiRoutes(app: Express) {
  app.get('/api/v1/health', (_req, res) => {
    ok(res, { status: 'ok', env: process.env.NODE_ENV || 'development' })
  })

  app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
    try {
      const email = String(req.body?.email || '').trim()
      const redirectTo = typeof req.body?.redirectTo === 'string' ? req.body.redirectTo : undefined
      if (!email) return fail(res, 400, 'Email is required')
      await sendAppPasswordResetEmail({ email, redirectTo })
      // Always succeed from the client's perspective (no account enumeration).
      ok(res, { queued: true })
    } catch (e: any) {
      console.error('[auth] reset-password:', e?.message || e)
      fail(res, 500, e?.message || 'Could not send reset email')
    }
  })

  app.get('/api/v1/cms/cards', (_req, res) => {
    ok(res, [])
  })

  app.get('/api/v1/cms/blogs', async (_req, res) => {
    try {
      const posts = await listBlogs({ includeDrafts: false })
      ok(res, posts.map(blogToApi))
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load blogs')
    }
  })

  app.get('/api/v1/cms/blogs/:slug', async (req, res) => {
    try {
      const blog = await getBlogBySlug(String(req.params.slug || ''))
      if (!blog) {
        return res.status(404).json({
          data: null,
          status: 404,
          error: 'Blog not found',
          timestamp: new Date().toISOString(),
        })
      }
      ok(res, blogToApi(blog))
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load blog')
    }
  })

  app.get('/api/v1/cms/reviews', (_req, res) => {
    ok(res, [])
  })

  app.get('/api/v1/ledger', async (req, res) => {
    try {
      const { requireAuthEmail } = await import('../auth/userId.js')
      const auth = await requireAuthEmail(req)
      if ('error' in auth) return fail(res, auth.status, auth.error)
      const requested = String(req.query.email || '').trim().toLowerCase()
      if (requested && requested !== auth.email) {
        return fail(res, 403, 'Forbidden')
      }
      const email = auth.email
      const data = await readLedgerCache(email)
      const resyncQuota = await getLedgerResyncQuota(email)
      ok(res, {
        profile: data.profile || {},
        transactions: Array.isArray(data.transactions) ? data.transactions : [],
        score: data.score || null,
        resyncQuota,
      })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load ledger')
    }
  })

  app.post('/api/v1/ledger/scan', async (req, res) => {
    try {
      const { requireAuthEmail } = await import('../auth/userId.js')
      const auth = await requireAuthEmail(req)
      if ('error' in auth) return fail(res, auth.status, auth.error)

      const accessToken = String(req.body?.accessToken || '').trim()
      const bodyEmail = String(req.body?.email || req.body?.fallbackData?.email || '')
        .trim()
        .toLowerCase()
      if (bodyEmail && bodyEmail !== auth.email) {
        return fail(res, 403, 'Forbidden')
      }
      const email = auth.email
      const fallbackData =
        req.body?.fallbackData && typeof req.body.fallbackData === 'object'
          ? { ...req.body.fallbackData, email }
          : { email }

      if (!accessToken) {
        return fail(res, 401, 'AUTH_EXPIRED', {
          details: 'Gmail read-only access token is required to sync spending.',
        })
      }

      const quota = await getLedgerResyncQuota(email)
      if (!quota.allowed) {
        return fail(res, 429, 'RESYNC_LIMIT', {
          details: `You can resync inbox ${quota.limit} times every ${quota.windowDays} days.`,
          resyncQuota: quota,
        })
      }

      const result = await runGmailScanner({
        accessToken,
        fallbackData,
        mode: 'full',
        timeoutMs: 180_000,
      })

      if (result.error) {
        const isAuth =
          result.error === 'AUTH_EXPIRED' || String(result.error).includes('AUTH_EXPIRED')
        return fail(res, isAuth ? 401 : 400, isAuth ? 'AUTH_EXPIRED' : result.error, {
          details: result.details,
        })
      }

      await writeLedgerCache(email, result)
      const recipient = email
      let resyncQuota = await getLedgerResyncQuota(recipient)
      let scoreOut = result.score || null
      if (result.score && Number.isFinite(Number(result.score.score))) {
        const { persistScoreToWaitlist } = await import('../waitlist/score.js')
        const { refineYurekaScore } = await import('../waitlist/scoreRefine.js')
        try {
          const refined = await refineYurekaScore({
            ...(result.score as any),
            metrics: (result.score as any)?.metrics as Record<string, unknown>,
          })
          scoreOut = refined
          await persistScoreToWaitlist({
            email: recipient,
            profile: result.profile as { name?: string } | undefined,
            score: refined,
            notify: true,
            refine: false,
          })
        } catch (err) {
          console.error('[ledger] persist score failed:', err)
        }
      }
      try {
        resyncQuota = await consumeLedgerResync(recipient)
      } catch (err) {
        console.error('[ledger] resync quota update failed:', err)
      }
      ok(res, {
        profile: result.profile || {},
        transactions: Array.isArray(result.transactions) ? result.transactions : [],
        score: scoreOut,
        resyncQuota,
      })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Ledger scan failed')
    }
  })

  app.get('/api/v1/users/cards', (_req, res) => {
    ok(res, [])
  })

  app.post('/api/v1/users/cards', (req, res) => {
    const body = req.body || {}
    ok(
      res,
      {
        id: `local_${Date.now()}`,
        bankName: body.bankName || body.bank_name || 'Unknown',
        cardName: body.cardName || body.card_name || 'Card',
        ...body,
      },
      201
    )
  })

  app.delete('/api/v1/users/cards/:id', (req, res) => {
    ok(res, { deleted: true, id: String(req.params.id) })
  })

  app.patch('/api/v1/users/cards/:id/priority', (req, res) => {
    ok(res, { id: String(req.params.id), ...(req.body || {}) })
  })

  // Admin CMS stubs — never expose waitlist/team/audit without admin session.
  // Real admin data lives on /api/admin/* with X-Admin-Session.
  app.get('/api/v1/admin/cards', (_req, res) => fail(res, 401, 'Unauthorized'))
  app.get('/api/v1/admin/blogs', (_req, res) => fail(res, 401, 'Unauthorized'))
  app.get('/api/v1/admin/reviews', (_req, res) => fail(res, 401, 'Unauthorized'))
  app.get('/api/v1/admin/waitlist', (_req, res) => fail(res, 401, 'Unauthorized'))
  app.get('/api/v1/admin/team', (_req, res) => fail(res, 401, 'Unauthorized'))
  app.get('/api/v1/admin/audit-logs', (_req, res) => fail(res, 401, 'Unauthorized'))
}
