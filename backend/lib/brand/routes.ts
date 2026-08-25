import type { Express, Request, Response } from 'express'
import { productUserIdOrFail, resolveRequestEmail } from '../auth/userId.js'
import { verifyAdminToken, type AdminRole } from '../admin/auth.js'
import { sendBrandInviteEmail } from '../mail/appEmails.js'
import { normalizeEmail } from '../mail/emailAddress.js'
import {
  isBrandEventType,
  isBrandRole,
  type BrandMemberRole,
} from './types.js'
import {
  attachMemberUser,
  brandBackendMode,
  brandOverview,
  createBrand,
  createOffer,
  getBrand,
  getOffer,
  inviteMember,
  listBrandsWithRollup,
  listCatalog,
  listMembers,
  membershipsForIdentity,
  offerStats,
  offersWithStats,
  recordEvent,
  updateBrand,
  updateOffer,
} from './store.js'

function ok<T>(res: Response, data: T, status = 200) {
  res.status(status).json({ data, status, timestamp: new Date().toISOString() })
}

function fail(res: Response, status: number, error: string) {
  res.status(status).json({ data: null, status, error, timestamp: new Date().toISOString() })
}

async function requireUserId(req: Request, res: Response): Promise<string | null> {
  const result = await productUserIdOrFail(req)
  if ('error' in result) {
    fail(res, 401, result.error)
    return null
  }
  return result.userId
}

function requireAdmin(req: Request, res: Response, roles?: AdminRole[]) {
  const token = req.header('x-admin-session') || req.header('X-Admin-Session')
  const session = verifyAdminToken(token)
  if (!session) {
    fail(res, 401, 'Unauthorized')
    return null
  }
  if (roles && !roles.includes(session.role)) {
    fail(res, 403, 'Forbidden')
    return null
  }
  return session
}

async function resolveMemberships(req: Request) {
  const result = await productUserIdOrFail(req)
  if ('error' in result) {
    return { userId: null as string | null, memberships: [] as Awaited<ReturnType<typeof membershipsForIdentity>> }
  }
  const userId = result.userId
  const email = result.email ?? resolveRequestEmail(req)
  let memberships = await membershipsForIdentity({ userId, email })
  for (const row of memberships) {
    if (!row.member.userId && email && row.member.email === normalizeEmail(email)) {
      const attached = await attachMemberUser(row.member.id, userId)
      if (attached) row.member = attached
    }
  }
  memberships = await membershipsForIdentity({ userId, email })
  return { userId, memberships }
}

function pickBrandId(req: Request, memberships: Awaited<ReturnType<typeof membershipsForIdentity>>) {
  const hinted = String(req.query.brandId || req.header('x-brand-id') || req.body?.brandId || '').trim()
  if (hinted && memberships.some((m) => m.brand.id === hinted)) return hinted
  return memberships[0]?.brand.id || null
}

function canEdit(role: BrandMemberRole) {
  return role === 'owner' || role === 'editor'
}

export function registerBrandRoutes(app: Express) {
  app.get('/api/v1/brands/health', (_req, res) => {
    ok(res, { mode: brandBackendMode() })
  })

  app.get('/api/v1/brands/me', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const { memberships } = await resolveMemberships(req)
      const brandId = pickBrandId(req, memberships)
      const current = memberships.find((m) => m.brand.id === brandId) || memberships[0] || null
      ok(res, { memberships, current })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load brand membership')
    }
  })

  app.get('/api/v1/brands/overview', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const { memberships } = await resolveMemberships(req)
      const brandId = pickBrandId(req, memberships)
      if (!brandId) return fail(res, 403, 'No brand invitation for this account')
      const overview = await brandOverview(brandId)
      if (!overview) return fail(res, 404, 'Brand not found')
      ok(res, overview)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load brand overview')
    }
  })

  app.get('/api/v1/brands/offers', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const { memberships } = await resolveMemberships(req)
      const brandId = pickBrandId(req, memberships)
      if (!brandId) return fail(res, 403, 'No brand invitation for this account')
      ok(res, { offers: await offersWithStats(brandId) })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to list offers')
    }
  })

  app.post('/api/v1/brands/offers', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const { memberships } = await resolveMemberships(req)
      const brandId = pickBrandId(req, memberships)
      const row = memberships.find((m) => m.brand.id === brandId)
      if (!row) return fail(res, 403, 'No brand invitation for this account')
      if (!canEdit(row.member.role)) return fail(res, 403, 'Viewers cannot publish offers')
      const offer = await createOffer(brandId, {
        title: String(req.body?.title || ''),
        description: req.body?.description,
        url: String(req.body?.url || ''),
        couponCode: req.body?.couponCode,
        category: req.body?.category,
        imageUrl: req.body?.imageUrl,
        startsAt: req.body?.startsAt || null,
        endsAt: req.body?.endsAt || null,
        active: req.body?.active !== false,
        createdBy: userId,
      })
      ok(res, { offer }, 201)
    } catch (e: any) {
      fail(res, 400, e?.message || 'Failed to create offer')
    }
  })

  app.patch('/api/v1/brands/offers/:id', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const { memberships } = await resolveMemberships(req)
      const offer = await getOffer(String(req.params.id || ''))
      if (!offer) return fail(res, 404, 'Offer not found')
      const row = memberships.find((m) => m.brand.id === offer.brandId)
      if (!row) return fail(res, 403, 'Forbidden')
      if (!canEdit(row.member.role)) return fail(res, 403, 'Viewers cannot edit offers')
      const updated = await updateOffer(offer.id, {
        title: req.body?.title,
        description: req.body?.description,
        url: req.body?.url,
        couponCode: req.body?.couponCode,
        category: req.body?.category,
        imageUrl: req.body?.imageUrl,
        startsAt: req.body?.startsAt,
        endsAt: req.body?.endsAt,
        active: req.body?.active,
      })
      ok(res, { offer: updated })
    } catch (e: any) {
      fail(res, 400, e?.message || 'Failed to update offer')
    }
  })

  app.get('/api/v1/brands/offers/:id/stats', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const { memberships } = await resolveMemberships(req)
      const stats = await offerStats(String(req.params.id || ''))
      if (!stats) return fail(res, 404, 'Offer not found')
      if (!memberships.some((m) => m.brand.id === stats.offer.brandId)) return fail(res, 403, 'Forbidden')
      ok(res, stats)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load offer stats')
    }
  })

  app.get('/api/v1/brands/members', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const { memberships } = await resolveMemberships(req)
      const brandId = pickBrandId(req, memberships)
      if (!brandId) return fail(res, 403, 'No brand invitation for this account')
      ok(res, { members: await listMembers(brandId) })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to list members')
    }
  })

  app.get('/api/v1/brands/catalog', async (_req, res) => {
    try {
      ok(res, { offers: await listCatalog() })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load partner offers')
    }
  })

  app.post('/api/v1/brands/events', async (req, res) => {
    try {
      const { isRateLimited } = await import('../auth/rateLimit.js')
      if (isRateLimited(req, 'brand-events', { limit: 120, windowMs: 60_000 })) {
        return fail(res, 429, 'Too many events')
      }
      const userId = await requireUserId(req, res)
      if (!userId) return
      const type = String(req.body?.type || '')
      if (!isBrandEventType(type)) return fail(res, 400, 'Invalid event type')
      const offerId = String(req.body?.offerId || '')
      const event = await recordEvent({ offerId, userId, type })
      if (!event) return fail(res, 404, 'Offer is not live')
      ok(res, { event }, 201)
    } catch (e: any) {
      fail(res, 400, e?.message || 'Failed to record event')
    }
  })

  app.get('/api/admin/brands', requireAdminMw(), async (req, res) => {
    try {
      ok(res, { brands: await listBrandsWithRollup() })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to list brands')
    }
  })

  app.post('/api/admin/brands', requireAdminMw(['admin', 'superadmin']), async (req, res) => {
    try {
      const brand = await createBrand({
        name: String(req.body?.name || ''),
        website: req.body?.website,
        category: req.body?.category,
        contactEmail: req.body?.contactEmail,
        logoUrl: req.body?.logoUrl,
        notes: req.body?.notes,
        status: req.body?.status === 'paused' ? 'paused' : 'active',
      })
      ok(res, { brand }, 201)
    } catch (e: any) {
      fail(res, 400, e?.message || 'Failed to create brand')
    }
  })

  app.get('/api/admin/brands/:id', requireAdminMw(), async (req, res) => {
    try {
      const brand = await getBrand(String(req.params.id || ''))
      if (!brand) return fail(res, 404, 'Brand not found')
      const [overview, offers, members] = await Promise.all([
        brandOverview(brand.id),
        offersWithStats(brand.id),
        listMembers(brand.id),
      ])
      ok(res, { brand, overview, offers, members })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load brand')
    }
  })

  app.patch('/api/admin/brands/:id', requireAdminMw(['admin', 'superadmin']), async (req, res) => {
    try {
      const brand = await updateBrand(String(req.params.id || ''), {
        name: req.body?.name,
        website: req.body?.website,
        category: req.body?.category,
        contactEmail: req.body?.contactEmail,
        logoUrl: req.body?.logoUrl,
        notes: req.body?.notes,
        status: req.body?.status,
      })
      if (!brand) return fail(res, 404, 'Brand not found')
      ok(res, { brand })
    } catch (e: any) {
      fail(res, 400, e?.message || 'Failed to update brand')
    }
  })

  app.post('/api/admin/brands/:id/invites', requireAdminMw(['admin', 'superadmin']), async (req, res) => {
    try {
      const brand = await getBrand(String(req.params.id || ''))
      if (!brand) return fail(res, 404, 'Brand not found')
      const role = String(req.body?.role || 'editor')
      if (!isBrandRole(role)) return fail(res, 400, 'Invalid role')
      const member = await inviteMember(brand.id, String(req.body?.email || ''), role)
      const mail = await sendBrandInviteEmail({
        to: member.email,
        brandName: brand.name,
        invitedBy: (req as any).admin?.email,
      })
      ok(res, { member, emailed: mail.sent })
    } catch (e: any) {
      fail(res, 400, e?.message || 'Failed to invite member')
    }
  })

  app.get('/api/admin/brands/:id/overview', requireAdminMw(), async (req, res) => {
    try {
      const overview = await brandOverview(String(req.params.id || ''))
      if (!overview) return fail(res, 404, 'Brand not found')
      ok(res, overview)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load overview')
    }
  })

  app.patch('/api/admin/brands/:id/offers/:offerId', requireAdminMw(['admin', 'superadmin']), async (req, res) => {
    try {
      const offer = await getOffer(String(req.params.offerId || ''))
      if (!offer || offer.brandId !== String(req.params.id || '')) return fail(res, 404, 'Offer not found')
      const updated = await updateOffer(offer.id, {
        title: req.body?.title,
        description: req.body?.description,
        url: req.body?.url,
        couponCode: req.body?.couponCode,
        category: req.body?.category,
        imageUrl: req.body?.imageUrl,
        startsAt: req.body?.startsAt,
        endsAt: req.body?.endsAt,
        active: req.body?.active,
      })
      ok(res, { offer: updated })
    } catch (e: any) {
      fail(res, 400, e?.message || 'Failed to update offer')
    }
  })
}

function requireAdminMw(roles?: AdminRole[]) {
  return (req: Request, res: Response, next: () => void) => {
    const session = requireAdmin(req, res, roles)
    if (!session) return
    ;(req as any).admin = session
    next()
  }
}
