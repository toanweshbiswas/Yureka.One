import type { Express, Request, Response } from 'express'
import { productUserIdOrFail, resolveRequestEmail } from '../auth/userId.js'
import { findWaitlistByEmail, findWaitlistById, patchWaitlistMetadata } from '../admin/store.js'
import { isIosDeviceUa, isAndroidDeviceUa } from './platform.js'

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

function platformFromReq(req: Request, bodyPlatform?: string): 'ios' | 'android' | 'other' {
  const raw = String(bodyPlatform || '').toLowerCase()
  if (raw === 'ios' || raw === 'android' || raw === 'other') return raw
  const ua = req.header('user-agent') || ''
  if (isIosDeviceUa(ua)) return 'ios'
  if (isAndroidDeviceUa(ua)) return 'android'
  return 'other'
}

/**
 * Record that a signed-in member opened the installed PWA (or just installed it).
 * Persists on waitlist.notes JSON: pwaInstalled, pwaFirstSeenAt, pwaLastSeenAt, …
 */
export function registerPwaRoutes(app: Express) {
  app.post('/api/pwa/presence', async (req, res) => {
    try {
      const ident = await productUserIdOrFail(req)
      if ('error' in ident) return fail(res, 401, ident.error)

      const email =
        ident.email ||
        resolveRequestEmail(req) ||
        (ident.userId.includes('@') ? ident.userId.trim().toLowerCase() : null)
      if (!email) return fail(res, 400, 'email required to attribute PWA install')

      const standalone = Boolean(req.body?.standalone)
      const installedHint = Boolean(req.body?.installed)
      const source = String(req.body?.source || (standalone ? 'standalone' : 'unknown')).slice(0, 40)
      const platform = platformFromReq(req, req.body?.platform)
      const now = new Date().toISOString()

      let row = await findWaitlistByEmail(email)
      if (!row && !ident.userId.includes('@')) {
        row = await findWaitlistById(ident.userId)
      }
      if (!row) {
        // Member may be auth-only without waitlist yet. acknowledge without failing the client.
        return ok(res, {
          recorded: false,
          reason: 'no_waitlist',
          email,
          standalone,
          installed: standalone || installedHint,
        })
      }

      let prev: Record<string, any> = {}
      try {
        prev = row.notes ? JSON.parse(row.notes) : {}
      } catch {
        prev = {}
      }

      const alreadyInstalled = Boolean(prev.pwaInstalled)
      const installed = alreadyInstalled || standalone || installedHint
      const firstSeen =
        typeof prev.pwaFirstSeenAt === 'string' && prev.pwaFirstSeenAt
          ? prev.pwaFirstSeenAt
          : installed
            ? now
            : null

      const patch: Record<string, unknown> = {
        pwaLastSeenAt: now,
        pwaPlatform: platform,
        pwaSource: source,
      }
      if (installed) {
        patch.pwaInstalled = true
        if (firstSeen) patch.pwaFirstSeenAt = firstSeen
      }

      const updated = await patchWaitlistMetadata(row.id, patch)
      if (!updated) return fail(res, 500, 'Failed to save PWA presence')

      ok(res, {
        recorded: true,
        email: row.email,
        pwaInstalled: Boolean(updated.meta.pwaInstalled),
        pwaFirstSeenAt: updated.meta.pwaFirstSeenAt || null,
        pwaLastSeenAt: updated.meta.pwaLastSeenAt || null,
        pwaPlatform: updated.meta.pwaPlatform || platform,
      })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to record PWA presence')
    }
  })
}
