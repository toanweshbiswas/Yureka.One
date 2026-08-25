import type { Express, Request, Response } from 'express'
import { requireAuthEmail, productUserIdOrFail } from '../auth/userId.js'
import { isRateLimited } from '../auth/rateLimit.js'
import {
  cancelDeletionRequest,
  findActiveDeletionByEmail,
  requestAccountDeletion,
  DELETION_RETENTION_DAYS,
} from './service.js'

function ok<T>(res: Response, data: T, status = 200) {
  res.status(status).json({ data, status, timestamp: new Date().toISOString() })
}

function fail(res: Response, status: number, error: string) {
  res.status(status).json({ data: null, status, error, timestamp: new Date().toISOString() })
}

/** Member-facing deletion request APIs. Admin APIs live in admin/routes.ts. */
export function registerAccountDeletionRoutes(app: Express) {
  app.get('/api/account/deletion-request', async (req: Request, res: Response) => {
    try {
      const auth = await requireAuthEmail(req)
      if ('error' in auth) return fail(res, auth.status, auth.error)
      const row = await findActiveDeletionByEmail(auth.email)
      ok(res, {
        request: row,
        retentionDays: DELETION_RETENTION_DAYS,
      })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load deletion request')
    }
  })

  app.post('/api/account/deletion-request', async (req: Request, res: Response) => {
    try {
      if (isRateLimited(req, 'account-deletion', { limit: 5, windowMs: 60 * 60_000 })) {
        return fail(res, 429, 'Too many deletion requests. Try again later.')
      }
      const auth = await requireAuthEmail(req)
      if ('error' in auth) return fail(res, auth.status, auth.error)
      const ident = await productUserIdOrFail(req)
      const userId = 'error' in ident ? null : ident.userId
      const reason = req.body?.reason != null ? String(req.body.reason).slice(0, 500) : null
      const result = await requestAccountDeletion({
        email: auth.email,
        userId,
        reason,
        source: 'app',
      })
      ok(res, { ...result, retentionDays: DELETION_RETENTION_DAYS }, result.created ? 201 : 200)
    } catch (e: any) {
      fail(res, 400, e?.message || 'Failed to submit deletion request')
    }
  })

  app.delete('/api/account/deletion-request', async (req: Request, res: Response) => {
    try {
      const auth = await requireAuthEmail(req)
      if ('error' in auth) return fail(res, auth.status, auth.error)
      const row = await cancelDeletionRequest({ email: auth.email })
      if (!row) return fail(res, 404, 'No pending deletion request')
      ok(res, { request: row })
    } catch (e: any) {
      fail(res, 400, e?.message || 'Failed to cancel deletion request')
    }
  })
}
