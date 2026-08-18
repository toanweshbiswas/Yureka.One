import type { Express, Request, Response } from 'express'
import {
  creditEarn,
  getBalance,
  goldbackBackendMode,
  listLedger,
  listOffers,
  recordClick,
} from './store.js'
import { productUserIdOrFail, resolveRequestEmail } from '../auth/userId.js'
import { notifyGoldbackEarn } from '../notifications/notify.js'

function requireUserId(req: Request, res: Response): string | null {
  const result = productUserIdOrFail(req)
  if ('error' in result) {
    res.status(401).json({
      data: null,
      status: 401,
      error: result.error,
      timestamp: new Date().toISOString(),
    })
    return null
  }
  return result.userId
}

function ok<T>(res: Response, data: T, status = 200) {
  res.status(status).json({
    data,
    status,
    timestamp: new Date().toISOString(),
  })
}

function fail(res: Response, status: number, error: string) {
  res.status(status).json({
    data: null,
    status,
    error,
    timestamp: new Date().toISOString(),
  })
}

export function registerGoldbackRoutes(app: Express) {
  app.get('/api/goldback/health', (_req, res) => {
    ok(res, { mode: goldbackBackendMode() })
  })

  app.get('/api/goldback/offers', async (_req, res) => {
    try {
      const offers = await listOffers()
      ok(res, offers)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to list offers')
    }
  })

  app.get('/api/goldback/balance', async (req, res) => {
    try {
      const userId = requireUserId(req, res)
      if (!userId) return
      const balance = await getBalance(userId)
      ok(res, balance)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to get balance')
    }
  })

  app.get('/api/goldback/ledger', async (req, res) => {
    try {
      const userId = requireUserId(req, res)
      if (!userId) return
      const ledger = await listLedger(userId)
      ok(res, ledger)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to get ledger')
    }
  })

  app.post('/api/goldback/click', async (req, res) => {
    try {
      const userId = requireUserId(req, res)
      if (!userId) return
      const offerId = String(req.body?.offerId || '')
      if (!offerId) return fail(res, 400, 'offerId is required')
      await recordClick(userId, offerId)
      ok(res, { recorded: true })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to record click')
    }
  })

  app.post('/api/goldback/earn', async (req, res) => {
    try {
      const userId = requireUserId(req, res)
      if (!userId) return
      const offerId = String(req.body?.offerId || '')
      const idempotencyKey = String(req.body?.idempotencyKey || `earn:${userId}:${offerId}`)
      if (!offerId) return fail(res, 400, 'offerId is required')
      const result = await creditEarn(userId, offerId, idempotencyKey)
      if (result.created) {
        const merchant = String(result.entry.meta?.merchant || '')
        const title = String(result.entry.meta?.title || '')
        await notifyGoldbackEarn({
          userId,
          email: resolveRequestEmail(req),
          merchant,
          title,
          amountPaise: result.entry.amountPaise,
          offerId: result.entry.offerId || offerId,
        })
      }
      ok(res, result)
    } catch (e: any) {
      fail(res, 400, e?.message || 'Failed to credit earn')
    }
  })
}
