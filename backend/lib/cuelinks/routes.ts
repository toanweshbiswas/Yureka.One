import type { Express, Response } from 'express'
import {
  clearCueLinksCache,
  cuelinksConfigured,
  fetchCueLinksOffers,
  listCueLinksOffers,
} from './client.js'

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

export function registerCuelinksRoutes(app: Express) {
  const register = (prefix: string) => {
    app.get(`${prefix}/health`, (_req, res) => {
      ok(res, {
        configured: cuelinksConfigured(),
      })
    })

    app.get(`${prefix}/offers`, async (req, res) => {
      if (!cuelinksConfigured()) {
        return fail(res, 503, 'Marketplace is temporarily unavailable')
      }
      try {
        const q = typeof req.query.q === 'string' ? req.query.q : ''
        const category = typeof req.query.category === 'string' ? req.query.category : ''
        const type = typeof req.query.type === 'string' ? req.query.type : ''
        const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined
        const offset = typeof req.query.offset === 'string' ? Number(req.query.offset) : undefined
        const result = await listCueLinksOffers({ q, category, type, limit, offset })
        ok(res, result)
      } catch (e: any) {
        console.error('[marketplace] list failed:', e?.message || e)
        fail(res, 502, 'Failed to load marketplace offers')
      }
    })

    app.post(`${prefix}/refresh`, async (_req, res) => {
      if (!cuelinksConfigured()) {
        return fail(res, 503, 'Marketplace is temporarily unavailable')
      }
      try {
        clearCueLinksCache()
        const snap = await fetchCueLinksOffers({ force: true })
        ok(res, { loaded: snap.offers.length, catalogTotal: snap.totalCount })
      } catch (e: any) {
        fail(res, 502, 'Failed to refresh marketplace offers')
      }
    })
  }

  // Public path stays vendor-neutral; legacy prefix kept for existing clients.
  register('/api/marketplace')
  register('/api/cuelinks')
}
