import type { Express, Request, Response } from 'express'
import { getCatalogRevision } from './revision.js'

function ok<T>(res: Response, data: T, status = 200) {
  res.status(status).json({
    data,
    status,
    timestamp: new Date().toISOString(),
  })
}

/** Public poll endpoint — member apps watch this for admin catalog changes. */
export function registerCatalogRoutes(app: Express) {
  app.get('/api/catalog/revision', (_req: Request, res: Response) => {
    ok(res, getCatalogRevision())
  })
}
