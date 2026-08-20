import type { Express, Request, Response } from 'express'
import { isCuelinksCdnHost } from './offerImage.js'

const FETCH_MS = 8000
const MAX_BYTES = 1_500_000

export function registerMediaRoutes(app: Express) {
  app.get('/api/media/remote', async (req: Request, res: Response) => {
    const raw = typeof req.query.url === 'string' ? req.query.url : ''
    let target: URL
    try {
      target = new URL(raw)
    } catch {
      res.status(400).end()
      return
    }
    if (target.protocol !== 'https:' && target.protocol !== 'http:') {
      res.status(400).end()
      return
    }
    target.protocol = 'https:'
    if (!isCuelinksCdnHost(target.hostname)) {
      res.status(403).end()
      return
    }

    try {
      const upstream = await fetch(target.toString(), {
        signal: AbortSignal.timeout(FETCH_MS),
        headers: {
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          'User-Agent': 'Yureka.One/1.0',
        },
        redirect: 'follow',
      })
      if (!upstream.ok) {
        res.status(upstream.status).end()
        return
      }
      const contentType = (upstream.headers.get('content-type') || '').split(';')[0].trim()
      if (contentType && !contentType.startsWith('image/')) {
        res.status(415).end()
        return
      }
      const buf = Buffer.from(await upstream.arrayBuffer())
      if (buf.length > MAX_BYTES) {
        res.status(413).end()
        return
      }
      res.setHeader('Content-Type', contentType || 'image/png')
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
      res.status(200).send(buf)
    } catch {
      res.status(502).end()
    }
  })
}
