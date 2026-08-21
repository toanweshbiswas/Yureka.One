import type { Express, Response } from 'express'
import {
  clearCueLinksCache,
  cuelinksConfigured,
  fetchCueLinksOffers,
  listCueLinksOffers,
  listCueLinksOffersForHost,
} from './client.js'
import { listCueLinksBrands } from './brands.js'
import { listOffers as listGoldbackOffers } from '../goldback/store.js'

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

    app.get(`${prefix}/site`, async (req, res) => {
      const host = typeof req.query.host === 'string' ? req.query.host.trim() : ''
      if (!host) return fail(res, 400, 'host is required')
      try {
        const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 8
        const market = cuelinksConfigured()
          ? await listCueLinksOffersForHost(host, Number.isFinite(limit) ? limit : 8)
          : { host, items: [], total: 0, catalogTotal: 0, fetchedAt: new Date().toISOString() }

        let goldback: Awaited<ReturnType<typeof listGoldbackOffers>> = []
        try {
          goldback = await listGoldbackOffers()
        } catch {
          goldback = []
        }
        const needle = host.toLowerCase().replace(/^www\./, '')
        const slug = needle.split('.')[0] || needle
        const goldbackItems = goldback.filter((o) => {
          if (!o.active) return false
          const hay = `${o.merchant} ${o.title} ${o.url} ${o.category}`.toLowerCase()
          try {
            const u = new URL(o.url)
            const oh = u.hostname.replace(/^www\./i, '').toLowerCase()
            if (oh === needle || oh.endsWith(`.${needle}`) || needle.endsWith(`.${oh}`)) return true
          } catch {
            /* ignore */
          }
          return hay.includes(slug) && slug.length >= 3
        })

        ok(res, {
          host: market.host,
          marketplace: market.items,
          marketplaceTotal: market.total,
          goldback: goldbackItems.slice(0, 6),
          fetchedAt: market.fetchedAt,
        })
      } catch (e: any) {
        console.error('[marketplace] site lookup failed:', e?.message || e)
        fail(res, 502, 'Failed to look up store offers')
      }
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

    app.get(`${prefix}/brands`, async (req, res) => {
      if (!cuelinksConfigured()) {
        return fail(res, 503, 'Marketplace is temporarily unavailable')
      }
      try {
        const q = typeof req.query.q === 'string' ? req.query.q : ''
        const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined
        const result = await listCueLinksBrands({
          q,
          limit: Number.isFinite(limit) ? limit : undefined,
        })
        ok(res, result)
      } catch (e: any) {
        console.error('[marketplace] brands failed:', e?.message || e)
        fail(res, 502, 'Failed to load marketplace brands')
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
