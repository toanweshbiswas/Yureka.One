import type { Express, Request, Response } from 'express'
import { productUserIdOrFail, resolveRequestEmail } from '../auth/userId.js'
import {
  dismissNotification,
  listUserNotifications,
  markNotificationsRead,
} from './store.js'
import { ensureWelcomeNotification } from './notify.js'

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

function requireIdentity(req: Request, res: Response): Promise<{ userId: string; email: string | null } | null> {
  return productUserIdOrFail(req).then((result) => {
    if ('error' in result) {
      fail(res, 401, result.error)
      return null
    }
    return { userId: result.userId, email: result.email ?? resolveRequestEmail(req) }
  })
}

async function inboxPayload(userId: string, email: string | null, fullName?: string | null) {
  await ensureWelcomeNotification({ userId, email, fullName })
  return listUserNotifications(userId, email)
}

export function registerNotificationRoutes(app: Express) {
  app.get('/api/notifications', async (req, res) => {
    try {
      const ident = await requireIdentity(req, res)
      if (!ident) return
      const data = await inboxPayload(ident.userId, ident.email)
      ok(res, data)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load notifications')
    }
  })

  app.patch('/api/notifications/read', async (req, res) => {
    try {
      const ident = await requireIdentity(req, res)
      if (!ident) return
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : undefined
      const updated = await markNotificationsRead(ident.userId, ident.email, ids)
      const data = await listUserNotifications(ident.userId, ident.email)
      ok(res, { updated, ...data })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to mark notifications read')
    }
  })

  app.patch('/api/notifications/read-all', async (req, res) => {
    try {
      const ident = await requireIdentity(req, res)
      if (!ident) return
      const updated = await markNotificationsRead(ident.userId, ident.email)
      const data = await listUserNotifications(ident.userId, ident.email)
      ok(res, { updated, ...data })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to mark notifications read')
    }
  })

  app.post('/api/notifications/:id/dismiss', async (req, res) => {
    try {
      const ident = await requireIdentity(req, res)
      if (!ident) return
      const okDismiss = await dismissNotification(ident.userId, ident.email, String(req.params.id))
      if (!okDismiss) return fail(res, 404, 'Notification not found')
      const data = await listUserNotifications(ident.userId, ident.email)
      ok(res, data)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to dismiss notification')
    }
  })

  // Legacy dashboard paths. same inbox, no client-side personalization.
  app.get('/api/v1/notifications', async (req, res) => {
    try {
      const ident = await requireIdentity(req, res)
      if (!ident) return
      const data = await inboxPayload(ident.userId, ident.email)
      ok(res, data.items)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load notifications')
    }
  })

  app.post('/api/v1/notifications/:id/interact', async (req, res) => {
    try {
      const ident = await requireIdentity(req, res)
      if (!ident) return
      const action = String(req.body?.action || 'read').toLowerCase()
      const id = String(req.params.id)
      if (action === 'clicked' || action === 'dismiss') {
        await dismissNotification(ident.userId, ident.email, id)
      } else {
        await markNotificationsRead(ident.userId, ident.email, [id])
      }
      ok(res, { id, recorded: true })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to record interaction')
    }
  })
}
