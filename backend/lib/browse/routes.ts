import type { Express, Request, Response } from 'express'
import { productUserIdOrFail } from '../auth/userId.js'
import { resolveSuperBrowseLinks, resolveTrackedOpen } from './track.js'

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

async function requireUser(req: Request, res: Response): Promise<string | null> {
  const result = await productUserIdOrFail(req)
  if ('error' in result) {
    fail(res, 401, result.error)
    return null
  }
  return result.userId
}

export function registerBrowseRoutes(app: Express) {
  app.post('/api/browse/out', async (req: Request, res: Response) => {
    const userId = await requireUser(req, res)
    if (!userId) return
    const url = typeof req.body?.url === 'string' ? req.body.url : ''
    const record = req.body?.record !== false
    try {
      const tracked = await resolveTrackedOpen(url, userId, { record })
      ok(res, tracked)
    } catch (e: any) {
      fail(res, 400, e?.message || 'Could not track this store')
    }
  })

  app.get('/api/browse/super-browse', async (req: Request, res: Response) => {
    const userId = await requireUser(req, res)
    if (!userId) return
    try {
      const links = await resolveSuperBrowseLinks(userId)
      ok(res, { links })
    } catch (e: any) {
      fail(res, 502, e?.message || 'Could not load tracked store links')
    }
  })
}
