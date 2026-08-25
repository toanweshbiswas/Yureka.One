import type { Request, Response, NextFunction } from 'express'

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

function clientKey(req: Request, prefix: string): string {
  const xf = String(req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim()
  const ip = xf || req.socket.remoteAddress || 'unknown'
  return `${prefix}:${ip}`
}

/** Simple in-memory rate limit. Returns true when the request should be blocked. */
export function isRateLimited(
  req: Request,
  prefix: string,
  opts: { limit: number; windowMs: number }
): boolean {
  const key = clientKey(req, prefix)
  const now = Date.now()
  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs })
    return false
  }
  existing.count += 1
  if (existing.count > opts.limit) return true
  return false
}

export function rateLimitMiddleware(opts: {
  prefix: string
  limit: number
  windowMs: number
  message?: string
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (isRateLimited(req, opts.prefix, opts)) {
      res.status(429).json({
        data: null,
        status: 429,
        error: opts.message || 'Too many requests',
        timestamp: new Date().toISOString(),
      })
      return
    }
    next()
  }
}

/** Periodic cleanup to avoid unbounded growth on long-lived processes. */
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}, 60_000).unref?.()
