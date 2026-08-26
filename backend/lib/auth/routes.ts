import type { Express, Request, Response } from 'express'
import {
  createWaitlistEntry,
  findAdminByEmail,
  findWaitlistByEmail,
  updateWaitlistStatus,
} from '../admin/store.js'
import { parseWaitlistMeta, toPublicWaitlistEntry } from '../waitlist/public.js'
import { requireAuthEmail } from './userId.js'
import { isWaitlistRequired } from './waitlistGate.js'

function ok<T>(res: Response, data: T, status = 200) {
  res.status(status).json({ data, status, timestamp: new Date().toISOString() })
}

function fail(res: Response, status: number, error: string) {
  res.status(status).json({ data: null, status, error, timestamp: new Date().toISOString() })
}

function bootstrapEmails(): string[] {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

async function resolveRole(email: string): Promise<'admin' | 'viewer' | 'user'> {
  const admin = await findAdminByEmail(email)
  if (admin) {
    if (admin.role === 'viewer') return 'viewer'
    return 'admin'
  }
  if (bootstrapEmails().includes(email)) return 'admin'
  return 'user'
}

export function registerAuthRoutes(app: Express) {
  app.get('/api/v1/auth/role', async (req: Request, res: Response) => {
    try {
      const auth = await requireAuthEmail(req)
      if ('error' in auth) return fail(res, auth.status, auth.error)
      const requested = String(req.query.email || '').trim().toLowerCase()
      if (requested && requested !== auth.email) return fail(res, 403, 'Forbidden')
      const role = await resolveRole(auth.email)
      return ok(res, { role, email: auth.email })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to resolve role')
    }
  })

  app.get('/api/v1/auth/admin-check', async (req: Request, res: Response) => {
    try {
      const auth = await requireAuthEmail(req)
      if ('error' in auth) return fail(res, auth.status, auth.error)
      const requested = String(req.query.email || '').trim().toLowerCase()
      if (requested && requested !== auth.email) return fail(res, 403, 'Forbidden')
      const role = await resolveRole(auth.email)
      ok(res, { isAdmin: role === 'admin' || role === 'viewer', role, email: auth.email })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to check admin')
    }
  })

  /**
   * Single gating endpoint for the SPA:
   * { role, status, entry }
   * status: admin | accepted | pending | on-hold | rejected | none
   * Requires Bearer JWT. email is taken from the token, not the query string.
   */
  app.get('/api/v1/auth/status', async (req: Request, res: Response) => {
    try {
      const auth = await requireAuthEmail(req)
      if ('error' in auth) return fail(res, auth.status, auth.error)
      const email = auth.email
      const requested = String(req.query.email || '').trim().toLowerCase()
      if (requested && requested !== email) return fail(res, 403, 'Forbidden')

      const [role, initialRow, deletion] = await Promise.all([
        resolveRole(email),
        findWaitlistByEmail(email),
        import('../accountDeletion/service.js').then((m) => m.findActiveDeletionByEmail(email)),
      ])
      let row = initialRow

      let status: 'admin' | 'accepted' | 'pending' | 'on-hold' | 'rejected' | 'none' | 'deletion' = 'none'
      if (role === 'admin') {
        status = 'admin'
      } else if (deletion?.status === 'approved') {
        status = 'deletion'
      } else if (!isWaitlistRequired()) {
        // Open onboard: any signed-in user can use the app (deletion block still applies).
        status = 'accepted'
        if (!row || (row.status !== 'accepted' && row.status !== 'rejected')) {
          try {
            if (!row) {
              row = await createWaitlistEntry({
                email,
                status: 'accepted',
              })
            } else {
              row = (await updateWaitlistStatus(row.id, 'accepted')) || row
            }
          } catch (e: any) {
            console.warn('[auth/status] auto-accept waitlist row failed:', e?.message || e)
          }
        }
      } else if (row?.status === 'accepted') {
        status = 'accepted'
      } else if (row?.status === 'rejected') {
        status = 'rejected'
      } else if (row?.status === 'on-hold' || row?.status === 'on_hold') {
        status = 'on-hold'
      } else if (row) {
        status = 'pending'
      }

      const publicEntry = row ? toPublicWaitlistEntry(row, parseWaitlistMeta(row)) : null

      ok(res, {
        email,
        role,
        status,
        entry: publicEntry,
        deletionRequest: deletion
          ? {
              id: deletion.id,
              status: deletion.status,
              purgeAt: deletion.purgeAt,
              requestedAt: deletion.requestedAt,
            }
          : null,
        canAccessDashboard:
          status === 'admin' || (status === 'accepted' && deletion?.status !== 'approved'),
        waitlistRequired: isWaitlistRequired(),
      })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to resolve auth status')
    }
  })
}
