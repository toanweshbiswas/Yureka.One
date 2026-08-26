import type { Express, Request, Response } from 'express'
import { readLedgerCache, resolveLedgerUserId } from '../ledger/scannerRunner.js'
import { getLedgerResyncQuota } from '../ledger/resyncQuota.js'
import { filterBillTransactions } from '../ledger/bills.js'
import { runLedgerScan } from '../ledger/scanService.js'
import {
  getPrimaryLedgerConnection,
  revokeLedgerConnection,
  saveLedgerConnection,
} from '../ledger/connections.js'
import { exchangeGoogleAuthCode } from '../ledger/googleOAuth.js'
import { blogToApi, getBlogBySlug, listBlogs } from '../cms/blogStore.js'
import { careerToApi, listCareers } from '../cms/careersStore.js'
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

  app.get('/api/v1/cms/jobs', async (_req, res) => {
    try {
      const roles = await listCareers({ includeDrafts: false })
      ok(res, roles.map(careerToApi))
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load jobs')
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
      const data = await readLedgerCache({ userId: auth.userId, authEmail: email })
      const resyncQuota = await getLedgerResyncQuota(email)
      ok(res, {
        profile: data.profile || {},
        transactions: Array.isArray(data.transactions) ? data.transactions : [],
        score: data.score || null,
        scannedAt: data.scannedAt || null,
        resyncQuota,
      })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load ledger')
    }
  })

  app.get('/api/v1/ledger/bills', async (req, res) => {
    try {
      const { requireAuthEmail } = await import('../auth/userId.js')
      const auth = await requireAuthEmail(req)
      if ('error' in auth) return fail(res, auth.status, auth.error)
      const email = auth.email
      const data = await readLedgerCache({ userId: auth.userId, authEmail: email })
      const bills = filterBillTransactions(data.transactions)
      ok(res, {
        bills,
        scannedAt: data.scannedAt || null,
        count: bills.length,
      })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load bills')
    }
  })

  app.post('/api/v1/ledger/connect', async (req, res) => {
    try {
      const { requireAuthEmail } = await import('../auth/userId.js')
      const auth = await requireAuthEmail(req)
      if ('error' in auth) return fail(res, auth.status, auth.error)

      const code = String(req.body?.code || '').trim()
      const redirectUri = typeof req.body?.redirectUri === 'string' ? req.body.redirectUri : 'postmessage'
      if (!code) return fail(res, 400, 'Authorization code is required')

      const userId =
        auth.userId || (await resolveLedgerUserId({ authEmail: auth.email })) || null
      if (!userId) return fail(res, 401, 'Authentication required')

      const tokens = await exchangeGoogleAuthCode({ code, redirectUri })
      const gmail = auth.email.trim().toLowerCase()
      if (tokens.refreshToken) {
        await saveLedgerConnection({ userId, gmail, refreshToken: tokens.refreshToken })
      }

      ok(res, {
        connected: true,
        gmail,
        hasRefreshToken: Boolean(tokens.refreshToken),
        expiresIn: tokens.expiresIn || null,
        accessToken: tokens.accessToken,
      })
    } catch (e: any) {
      const msg = e?.message || 'Gmail connect failed'
      if (msg === 'AUTH_EXPIRED') return fail(res, 401, 'AUTH_EXPIRED')
      fail(res, 400, msg)
    }
  })

  app.delete('/api/v1/ledger/connect', async (req, res) => {
    try {
      const { requireAuthEmail } = await import('../auth/userId.js')
      const auth = await requireAuthEmail(req)
      if ('error' in auth) return fail(res, auth.status, auth.error)
      const userId =
        auth.userId || (await resolveLedgerUserId({ authEmail: auth.email })) || null
      if (!userId) return fail(res, 401, 'Authentication required')
      const gmail = String(req.body?.gmail || auth.email).trim().toLowerCase()
      await revokeLedgerConnection(userId, gmail)
      ok(res, { revoked: true, gmail })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to revoke Gmail connect')
    }
  })

  app.get('/api/v1/ledger/connection', async (req, res) => {
    try {
      const { requireAuthEmail } = await import('../auth/userId.js')
      const auth = await requireAuthEmail(req)
      if ('error' in auth) return fail(res, auth.status, auth.error)
      const userId =
        auth.userId || (await resolveLedgerUserId({ authEmail: auth.email })) || null
      if (!userId) return fail(res, 401, 'Authentication required')
      const conn = await getPrimaryLedgerConnection(userId)
      ok(res, {
        connected: Boolean(conn?.syncEnabled),
        gmail: conn?.gmail || null,
        lastSyncAt: conn?.lastSyncAt || null,
        lastSyncError: conn?.lastSyncError || null,
      })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load Gmail connection')
    }
  })

  app.post('/api/v1/ledger/scan', async (req, res) => {
    try {
      const { requireAuthEmail } = await import('../auth/userId.js')
      const auth = await requireAuthEmail(req)
      if ('error' in auth) return fail(res, auth.status, auth.error)

      const accessToken = String(req.body?.accessToken || '').trim()
      const authCode = String(req.body?.authCode || req.body?.code || '').trim()
      const redirectUri = typeof req.body?.redirectUri === 'string' ? req.body.redirectUri : undefined
      const bodyEmail = String(req.body?.email || req.body?.fallbackData?.email || '')
        .trim()
        .toLowerCase()
      if (bodyEmail && bodyEmail !== auth.email) {
        return fail(res, 403, 'Forbidden')
      }
      const email = auth.email
      const forceFull = Boolean(req.body?.forceFull)

      if (!accessToken && !authCode) {
        return fail(res, 401, 'AUTH_EXPIRED', {
          details: 'Gmail read-only access is required to sync spending.',
        })
      }

      const userId =
        auth.userId ||
        (await resolveLedgerUserId({ authEmail: email })) ||
        null
      if (!userId) {
        return fail(res, 401, 'Authentication required')
      }

      const outcome = await runLedgerScan({
        userId,
        authEmail: email,
        accessToken: accessToken || undefined,
        authCode: authCode || undefined,
        redirectUri,
        forceFull,
        persistScore: true,
        consumeQuota: true,
      })

      if (outcome.error) {
        const isAuth = outcome.error === 'AUTH_EXPIRED'
        const isLimit = outcome.error === 'RESYNC_LIMIT'
        return fail(res, isAuth ? 401 : isLimit ? 429 : 400, outcome.error, {
          details: outcome.details,
          resyncQuota: outcome.resyncQuota,
        })
      }

      ok(res, {
        profile: outcome.saved.profile || {},
        transactions: Array.isArray(outcome.saved.transactions) ? outcome.saved.transactions : [],
        score: outcome.score || null,
        scannedAt: outcome.saved.scannedAt || null,
        resyncQuota: outcome.resyncQuota,
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

  // Admin CMS stubs. never expose waitlist/team/audit without admin session.
  // Real admin data lives on /api/admin/* with X-Admin-Session.
  app.get('/api/v1/admin/cards', (_req, res) => fail(res, 401, 'Unauthorized'))
  app.get('/api/v1/admin/blogs', (_req, res) => fail(res, 401, 'Unauthorized'))
  app.get('/api/v1/admin/reviews', (_req, res) => fail(res, 401, 'Unauthorized'))
  app.get('/api/v1/admin/waitlist', (_req, res) => fail(res, 401, 'Unauthorized'))
  app.get('/api/v1/admin/team', (_req, res) => fail(res, 401, 'Unauthorized'))
  app.get('/api/v1/admin/audit-logs', (_req, res) => fail(res, 401, 'Unauthorized'))
}
