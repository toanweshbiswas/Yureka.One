import type { Express, Request, Response, NextFunction } from 'express'
import {
  adminPasswordOk,
  createAdminToken,
  hashInviteToken,
  hashPassword,
  inviteTtlHours,
  newInviteToken,
  passwordMeetsPolicy,
  verifyAdminToken,
  verifyPassword,
  type AdminRole,
} from './auth.js'
import {
  adminBackendMode,
  bulkUpdateWaitlistStatus,
  createWaitlistEntry,
  deleteAdmin,
  deleteWaitlistEntry,
  findAdminByEmail,
  findAdminByInviteHash,
  findWaitlistByEmail,
  findWaitlistById,
  getAdminAuth,
  listAdmins,
  listWaitlist,
  saveAdminInvite,
  setAdminPassword,
  updateWaitlistStatus,
  updateWaitlistUser,
  upsertAdmin,
} from './store.js'
import { sendApprovalEmail, sendAdminInviteEmail, sendWaitlistRejectedEmail, sendUserInviteEmail, sendAccountReadyEmail } from '../mail/appEmails.js'
import { notifyWaitlistAccepted, notifyWaitlistRejected } from '../notifications/notify.js'
import { normalizeEmail } from '../mail/emailAddress.js'
import { createAppAuthUser } from '../auth/supabaseAdmin.js'
import { mailUrls } from '../mail/layout.js'
import {
  deleteOffer,
  goldbackBackendMode,
  listAllAccounts,
  listAllLedger,
  listAllOffers,
  upsertOffer,
  adminAdjustGoldback,
} from '../goldback/store.js'
import { blogToApi, deleteBlog, getBlogById, listBlogs, upsertBlog } from '../cms/blogStore.js'
import { careerToApi, deleteCareer, listCareers, upsertCareer } from '../cms/careersStore.js'
import { slugFromTitle } from '../cms/blogHtml.js'
import { notifyUsersNewBlog } from '../cms/notifyBlog.js'
import { uploadBlogImage } from '../cms/blogMedia.js'
import { raw as expressRaw } from 'express'

function ok<T>(res: Response, data: T, status = 200) {
  res.status(status).json({ data, status, timestamp: new Date().toISOString() })
}

function fail(res: Response, status: number, error: string) {
  res.status(status).json({ data: null, status, error, timestamp: new Date().toISOString() })
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.header('x-admin-session') || req.header('X-Admin-Session')
  const session = verifyAdminToken(token)
  if (!session) return fail(res, 401, 'Unauthorized')
  ;(req as any).admin = session
  next()
}

function requireRole(...roles: AdminRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const session = (req as any).admin
    if (!session || !roles.includes(session.role)) {
      return fail(res, 403, 'Forbidden')
    }
    next()
  }
}

export function registerAdminRoutes(app: Express) {
  app.get('/api/admin/health', (_req, res) => {
    ok(res, {
      ok: true,
      waitlist: adminBackendMode() === 'supabase' ? 'primary' : 'local',
      goldback: goldbackBackendMode() === 'supabase' ? 'primary' : 'local',
    })
  })

  /** Public catalog for Super Browse / home explore grid */
  app.get('/api/super-browse/stores', async (_req, res) => {
    try {
      const { listSuperBrowseStores } = await import('../superBrowse/store.js')
      const rows = await listSuperBrowseStores({ includeInactive: false })
      ok(
        res,
        rows.map((s) => ({
          id: s.id,
          name: s.name,
          domain: s.domain,
          url: s.url,
          logoUrl: s.logoUrl,
          cashback: s.cashback || undefined,
          bg: s.bg,
        })),
      )
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load stores')
    }
  })

  app.post('/api/admin/login', async (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase()
      const password = String(req.body?.password || '')
      if (!email || !password) return fail(res, 400, 'email and password required')
      const admin = await findAdminByEmail(email)
      if (!admin) return fail(res, 401, 'This account is not authorized for admin access')

      const auth = await getAdminAuth(email)
      const bootstrap = (process.env.ADMIN_EMAILS || '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
      const invitePending = Boolean(
        auth.inviteTokenHash && auth.inviteExpiresAt && new Date(auth.inviteExpiresAt).getTime() > Date.now()
      )

      let passwordOk = false
      if (auth.passwordHash) {
        passwordOk = verifyPassword(password, auth.passwordHash)
      } else if (invitePending) {
        return fail(res, 401, 'Open the invite link in your email to set a password first')
      } else if (bootstrap.includes(email) || !auth.passwordHash) {
        passwordOk = adminPasswordOk(password)
      }

      if (!passwordOk) return fail(res, 401, 'Invalid credentials')
      const token = createAdminToken(admin.email, admin.role)
      ok(res, { token, role: admin.role, email: admin.email, fullName: admin.fullName })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Login failed')
    }
  })

  app.get('/api/admin/me', requireAdmin, (req, res) => {
    ok(res, (req as any).admin)
  })

  // ─── Waitlist ───
  app.get('/api/admin/waitlist', requireAdmin, async (req, res) => {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : 'all'
      const search = typeof req.query.search === 'string' ? req.query.search : ''
      const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : NaN
      const rows = await listWaitlist({
        status,
        search,
        limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
      })
      ok(res, rows)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load waitlist')
    }
  })

  app.post('/api/admin/waitlist', requireAdmin, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
      const email = String(req.body?.email || '').trim()
      if (!email) return fail(res, 400, 'email required')
      const row = await createWaitlistEntry({
        email,
        fullName: req.body?.fullName,
        status: req.body?.status,
      })
      ok(res, row, 201)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to create waitlist entry')
    }
  })

  app.patch('/api/admin/waitlist/:id/status', requireAdmin, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
      const status = String(req.body?.status || '') as any
      if (!['pending', 'accepted', 'rejected', 'on_hold'].includes(status)) {
        return fail(res, 400, 'Invalid status')
      }
      const row = await updateWaitlistStatus(String(req.params.id), status)
      if (!row) return fail(res, 404, 'Not found')

      let emailResult: { sent: boolean; skipped?: string; error?: string } | null = null
      if (status === 'accepted' && row.email) {
        emailResult = await sendApprovalEmail({ to: row.email, fullName: row.fullName })
        if (!emailResult.sent) {
          console.warn('[admin] approval email not sent:', emailResult.skipped || emailResult.error)
        }
        await notifyWaitlistAccepted({ email: row.email, fullName: row.fullName })
      }
      if (status === 'rejected' && row.email) {
        emailResult = await sendWaitlistRejectedEmail({ to: row.email, fullName: row.fullName })
        if (!emailResult.sent) {
          console.warn('[admin] rejection email not sent:', emailResult.skipped || emailResult.error)
        }
        await notifyWaitlistRejected({ email: row.email, fullName: row.fullName })
      }

      ok(res, { ...row, approvalEmail: emailResult })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to update status')
    }
  })

  app.post('/api/admin/waitlist/bulk-status', requireAdmin, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
      const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : []
      const status = String(req.body?.status || '') as any
      if (!ids.length) return fail(res, 400, 'ids required')
      if (!['pending', 'accepted', 'rejected', 'on_hold'].includes(status)) {
        return fail(res, 400, 'Invalid status')
      }
      await bulkUpdateWaitlistStatus(ids, status)

      let emailsSent = 0
      if (status === 'accepted' || status === 'rejected') {
        const rows = await listWaitlist({ status: 'all' })
        const idSet = new Set(ids)
        for (const row of rows) {
          if (!idSet.has(row.id) || !row.email) continue
          const result =
            status === 'accepted'
              ? await sendApprovalEmail({ to: row.email, fullName: row.fullName })
              : await sendWaitlistRejectedEmail({ to: row.email, fullName: row.fullName })
          if (status === 'accepted') {
            await notifyWaitlistAccepted({ email: row.email, fullName: row.fullName })
          } else {
            await notifyWaitlistRejected({ email: row.email, fullName: row.fullName })
          }
          if (result.sent) emailsSent += 1
        }
      }

      ok(res, { updated: ids.length, emailsSent })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Bulk update failed')
    }
  })

  app.post('/api/admin/users/invite', requireAdmin, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
      const email = normalizeEmail(String(req.body?.email || ''))
      const fullName = String(req.body?.fullName || '').trim() || undefined
      if (!email) return fail(res, 400, 'Valid email required')

      const existing = await findWaitlistByEmail(email)
      const row = existing
        ? (existing.status === 'accepted'
            ? existing
            : (await updateWaitlistStatus(existing.id, 'accepted')) || existing)
        : await createWaitlistEntry({ email, fullName, status: 'accepted' })

      const inviteEmail = await sendUserInviteEmail({
        to: email,
        fullName: fullName || row.fullName,
        invitedBy: (req as any).admin?.email,
      })
      if (!inviteEmail.sent) {
        console.warn('[admin] user invite email not sent:', inviteEmail.skipped || inviteEmail.error)
      }
      await notifyWaitlistAccepted({ email, fullName: fullName || row.fullName })

      ok(res, { ...row, status: 'accepted', inviteEmail }, existing ? 200 : 201)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to invite user')
    }
  })

  app.post('/api/admin/users/create', requireAdmin, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
      const email = normalizeEmail(String(req.body?.email || ''))
      const password = String(req.body?.password || '')
      const fullName = String(req.body?.fullName || '').trim() || undefined
      const sendEmail = req.body?.sendEmail !== false
      if (!email) return fail(res, 400, 'Valid email required')
      const policy = passwordMeetsPolicy(password)
      if (policy) return fail(res, 400, policy)

      const authUser = await createAppAuthUser({ email, password, fullName })

      const existing = await findWaitlistByEmail(email)
      const row = existing
        ? (existing.status === 'accepted'
            ? existing
            : (await updateWaitlistStatus(existing.id, 'accepted')) || existing)
        : await createWaitlistEntry({ email, fullName, status: 'accepted' })

      let accountEmail: { sent: boolean; skipped?: string; error?: string } | null = null
      if (sendEmail) {
        accountEmail = await sendAccountReadyEmail({
          to: email,
          fullName: fullName || row.fullName,
          invitedBy: (req as any).admin?.email,
        })
        if (!accountEmail.sent) {
          console.warn('[admin] account-ready email not sent:', accountEmail.skipped || accountEmail.error)
        }
      }

      await notifyWaitlistAccepted({ email, fullName: fullName || row.fullName })

      ok(
        res,
        {
          ...row,
          status: 'accepted',
          authUserId: authUser.userId,
          created: authUser.created,
          passwordUpdated: authUser.passwordUpdated,
          accountEmail,
        },
        authUser.created ? 201 : 200,
      )
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to create user')
    }
  })

  // ─── Admins ───
  app.get('/api/admin/team', requireAdmin, requireRole('superadmin'), async (_req, res) => {
    try {
      ok(res, await listAdmins())
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load admins')
    }
  })

  app.post('/api/admin/team', requireAdmin, requireRole('superadmin'), async (req, res) => {
    try {
      const email = normalizeEmail(String(req.body?.email || ''))
      const role = (req.body?.role || 'admin') as AdminRole
      if (!email) return fail(res, 400, 'Valid email required')
      if (!['viewer', 'admin', 'superadmin'].includes(role)) return fail(res, 400, 'Invalid role')
      const row = await upsertAdmin({ email, role, fullName: req.body?.fullName })
      const rawToken = newInviteToken()
      const ttl = inviteTtlHours()
      const expiresAt = new Date(Date.now() + ttl * 3600_000).toISOString()
      await saveAdminInvite({
        email,
        tokenHash: hashInviteToken(rawToken),
        expiresAt,
      })

      const inviteUrl = `${mailUrls().admin}/admin?token=${encodeURIComponent(rawToken)}`
      const inviteEmail = await sendAdminInviteEmail({
        to: email,
        role,
        inviteUrl,
        firstName: req.body?.fullName,
        invitedBy: (req as any).admin?.email,
        expiresHours: ttl,
      })
      if (!inviteEmail.sent) {
        console.warn('[admin] invite email not sent:', inviteEmail.skipped || inviteEmail.error)
      }

      ok(res, { ...row, invitePending: true, inviteEmail, expiresAt }, 201)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to add admin')
    }
  })

  app.get('/api/admin/invites/preview', async (req, res) => {
    try {
      const token = String(req.query.token || '').trim()
      if (!token) return fail(res, 400, 'token required')
      const found = await findAdminByInviteHash(hashInviteToken(token))
      if (!found) return fail(res, 404, 'Invite is invalid or expired')
      ok(res, { email: found.admin.email, role: found.admin.role, fullName: found.admin.fullName })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load invite')
    }
  })

  app.post('/api/admin/invites/accept', async (req, res) => {
    try {
      const token = String(req.body?.token || '').trim()
      const password = String(req.body?.password || '')
      if (!token || !password) return fail(res, 400, 'token and password required')
      const policy = passwordMeetsPolicy(password)
      if (policy) return fail(res, 400, policy)

      const found = await findAdminByInviteHash(hashInviteToken(token))
      if (!found) return fail(res, 400, 'Invite is invalid or expired')

      const admin = await setAdminPassword(found.admin.email, hashPassword(password))
      if (!admin) return fail(res, 500, 'Could not save password')
      const session = createAdminToken(admin.email, admin.role)
      ok(res, { token: session, role: admin.role, email: admin.email, fullName: admin.fullName })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to accept invite')
    }
  })

  app.patch('/api/admin/team/:id/role', requireAdmin, requireRole('superadmin'), async (req, res) => {
    try {
      const role = req.body?.role as AdminRole
      const admins = await listAdmins()
      const target = admins.find((a) => a.id === req.params.id)
      if (!target) return fail(res, 404, 'Not found')
      const row = await upsertAdmin({ email: target.email, role, fullName: target.fullName || undefined })
      ok(res, row)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to update role')
    }
  })

  app.delete('/api/admin/team/:id', requireAdmin, requireRole('superadmin'), async (req, res) => {
    try {
      const okDel = await deleteAdmin(String(req.params.id))
      if (!okDel) return fail(res, 404, 'Not found')
      ok(res, { deleted: true })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to delete admin')
    }
  })

  // ─── Goldback / Offers ───
  app.get('/api/admin/offers', requireAdmin, async (_req, res) => {
    try {
      ok(res, await listAllOffers())
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load offers')
    }
  })

  app.post('/api/admin/offers', requireAdmin, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
      const title = String(req.body?.title || '').trim()
      const merchant = String(req.body?.merchant || '').trim()
      const url = String(req.body?.url || '').trim()
      if (!title || !merchant || !url) return fail(res, 400, 'title, merchant, url required')
      const offer = await upsertOffer({
        id: req.body?.id,
        title,
        merchant,
        url,
        category: req.body?.category,
        description: req.body?.description,
        imageUrl: req.body?.imageUrl != null ? String(req.body.imageUrl).trim() || null : undefined,
        rewardPaise: Number(req.body?.rewardPaise ?? 0),
        rewardLabel: req.body?.rewardLabel,
        active: req.body?.active !== false,
      })
      const { bumpCatalogRevision } = await import('../catalog/revision.js')
      bumpCatalogRevision('admin-offer-upsert')
      ok(res, offer, req.body?.id ? 200 : 201)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to save offer')
    }
  })

  app.delete('/api/admin/offers/:id', requireAdmin, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
      const id = decodeURIComponent(String(req.params.id || '')).trim()
      const deleted = await deleteOffer(id)
      if (!deleted) return ok(res, { deleted: true, missing: true })
      const { bumpCatalogRevision } = await import('../catalog/revision.js')
      bumpCatalogRevision('admin-offer-delete')
      ok(res, { deleted: true })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to delete offer')
    }
  })

  app.post('/api/admin/offers/:id/delete', requireAdmin, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
      const id = decodeURIComponent(String(req.params.id || '')).trim()
      const deleted = await deleteOffer(id)
      if (!deleted) return ok(res, { deleted: true, missing: true })
      const { bumpCatalogRevision } = await import('../catalog/revision.js')
      bumpCatalogRevision('admin-offer-delete')
      ok(res, { deleted: true })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to delete offer')
    }
  })

  app.get('/api/admin/goldback/ledger', requireAdmin, async (_req, res) => {
    try {
      ok(res, await listAllLedger())
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load ledger')
    }
  })

  app.get('/api/admin/goldback/accounts', requireAdmin, async (_req, res) => {
    try {
      ok(res, await listAllAccounts())
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load accounts')
    }
  })

  app.get('/api/admin/overview', requireAdmin, async (_req, res) => {
    try {
      const { buildAdminOverview } = await import('./overview.js')
      ok(res, await buildAdminOverview())
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load overview')
    }
  })

  // ─── Blog ───
  app.get('/api/admin/blogs', requireAdmin, async (_req, res) => {
    try {
      const posts = await listBlogs({ includeDrafts: true })
      ok(res, posts.map(blogToApi))
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load blogs')
    }
  })

  app.get('/api/admin/blogs/slug', requireAdmin, (req, res) => {
    ok(res, { slug: slugFromTitle(String(req.query.title || '')) })
  })

  app.post(
    '/api/admin/blogs/upload',
    requireAdmin,
    requireRole('admin', 'superadmin'),
    expressRaw({ type: () => true, limit: '8mb' }),
    async (req, res) => {
      try {
        const kindRaw = String(req.query.kind || req.header('x-image-kind') || 'cover')
        const kind = kindRaw === 'inline' ? 'inline' : kindRaw === 'club' ? 'club' : 'cover'
        const filename = String(req.header('x-filename') || req.query.filename || 'image.jpg')
        const contentType = String(req.header('x-content-type') || req.header('content-type') || 'image/jpeg')
          .split(';')[0]
          .trim()
        const body = req.body as Buffer | { data?: string } | undefined
        const buffer = Buffer.isBuffer(body)
          ? body
          : body && typeof body === 'object' && 'data' in body && body.data
            ? Buffer.from(String(body.data), 'base64')
            : Buffer.alloc(0)
        const uploaded = await uploadBlogImage({ buffer, filename, contentType, kind })
        ok(res, uploaded, 201)
      } catch (e: any) {
        const msg = e?.message || 'Failed to upload image'
        fail(res, msg.includes('not configured') ? 503 : 400, msg)
      }
    }
  )

  app.post('/api/admin/blogs', requireAdmin, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
      const title = String(req.body?.title || '').trim()
      if (!title) return fail(res, 400, 'title required')
      const blog = await upsertBlog({
        id: req.body?.id,
        title,
        slug: req.body?.slug,
        excerpt: req.body?.excerpt,
        content: req.body?.content,
        contentFormat: req.body?.contentFormat === 'markdown' ? 'markdown' : 'html',
        author: req.body?.author,
        category: req.body?.category,
        image: req.body?.image,
        featured: Boolean(req.body?.featured),
        status: req.body?.status === 'published' ? 'published' : 'draft',
      })

      let notify: { queued?: boolean; sent?: number; failed?: number; total?: number } | null = null
      if (req.body?.notify && blog.status === 'published') {
        notify = { queued: true }
        void notifyUsersNewBlog(blog)
          .then((result) => {
            console.log(`[blogs] notified ${result.sent}/${result.total} for ${blog.slug}`)
          })
          .catch((err) => {
            console.error('[blogs] notify failed:', (err as Error)?.message || err)
          })
      }

      ok(res, { ...blogToApi(blog), notify }, req.body?.id ? 200 : 201)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to save blog')
    }
  })

  app.patch('/api/admin/blogs/:id', requireAdmin, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
      const existing = await getBlogById(String(req.params.id || ''))
      if (!existing) return fail(res, 404, 'Blog not found')
      const title = String(req.body?.title || existing.title).trim()
      if (!title) return fail(res, 400, 'title required')
      const blog = await upsertBlog({
        ...existing,
        ...req.body,
        id: existing.id,
        title,
        contentFormat: req.body?.contentFormat === 'markdown' ? 'markdown' : req.body?.contentFormat || existing.contentFormat,
      })

      let notify: { queued?: boolean } | null = null
      if (req.body?.notify && blog.status === 'published') {
        notify = { queued: true }
        void notifyUsersNewBlog(blog)
          .then((result) => {
            console.log(`[blogs] notified ${result.sent}/${result.total} for ${blog.slug}`)
          })
          .catch((err) => {
            console.error('[blogs] notify failed:', (err as Error)?.message || err)
          })
      }

      ok(res, { ...blogToApi(blog), notify })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to update blog')
    }
  })

  app.delete('/api/admin/blogs/:id', requireAdmin, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
      const deleted = await deleteBlog(String(req.params.id || ''))
      if (!deleted) return fail(res, 404, 'Blog not found')
      ok(res, { deleted: true })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to delete blog')
    }
  })

  app.post('/api/admin/blogs/:id/notify', requireAdmin, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
      const blog = await getBlogById(String(req.params.id || ''))
      if (!blog) return fail(res, 404, 'Blog not found')
      if (blog.status !== 'published') return fail(res, 400, 'Publish the post before emailing users')
      const result = await notifyUsersNewBlog(blog)
      ok(res, result)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to email users')
    }
  })

  // ─── Careers ───
  app.get('/api/admin/careers', requireAdmin, async (_req, res) => {
    try {
      const roles = await listCareers({ includeDrafts: true })
      ok(res, roles.map(careerToApi))
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load careers')
    }
  })

  app.post('/api/admin/careers', requireAdmin, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
      const title = String(req.body?.title || '').trim()
      if (!title) return fail(res, 400, 'title required')
      const role = await upsertCareer({
        id: req.body?.id,
        refId: req.body?.refId,
        title,
        department: req.body?.department ?? req.body?.dept,
        location: req.body?.location,
        type: req.body?.type,
        description: req.body?.description,
        applyEmail: req.body?.applyEmail,
        status: req.body?.status === 'published' ? 'published' : 'draft',
        sortOrder: req.body?.sortOrder,
      })
      ok(res, careerToApi(role), req.body?.id ? 200 : 201)
    } catch (e: any) {
      fail(res, 400, e?.message || 'Failed to save career role')
    }
  })

  app.patch('/api/admin/careers/:id', requireAdmin, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
      const title = String(req.body?.title || '').trim()
      if (!title) return fail(res, 400, 'title required')
      const role = await upsertCareer({
        id: String(req.params.id || ''),
        refId: req.body?.refId,
        title,
        department: req.body?.department ?? req.body?.dept,
        location: req.body?.location,
        type: req.body?.type,
        description: req.body?.description,
        applyEmail: req.body?.applyEmail,
        status: req.body?.status === 'published' ? 'published' : 'draft',
        sortOrder: req.body?.sortOrder,
      })
      ok(res, careerToApi(role))
    } catch (e: any) {
      fail(res, 400, e?.message || 'Failed to update career role')
    }
  })

  app.delete('/api/admin/careers/:id', requireAdmin, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
      const okDeleted = await deleteCareer(String(req.params.id || ''))
      if (!okDeleted) return fail(res, 404, 'Role not found')
      ok(res, { deleted: true })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to delete career role')
    }
  })

  // ─── Users CRUD + drill-down ───
  app.get('/api/admin/users/:key/activity', requireAdmin, async (req, res) => {
    try {
      const { buildUserActivity } = await import('./userActivity.js')
      const activity = await buildUserActivity(String(req.params.key || ''))
      if (!activity) return fail(res, 404, 'User not found')
      ok(res, activity)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load user activity')
    }
  })

  app.patch('/api/admin/users/:id', requireAdmin, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
      const id = String(req.params.id || '').trim()
      const row = await updateWaitlistUser(id, {
        fullName: req.body?.fullName,
        mobileNumber: req.body?.mobileNumber,
        status: req.body?.status,
        yurekaScore: req.body?.yurekaScore,
        scoreDecision: req.body?.scoreDecision,
        rewardPoints: req.body?.rewardPoints,
      })
      if (!row) return fail(res, 404, 'User not found')
      ok(res, row)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to update user')
    }
  })

  app.delete('/api/admin/users/:id', requireAdmin, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
      const raw = decodeURIComponent(String(req.params.id || '')).trim()
      if (!raw) return fail(res, 400, 'User id required')

      let row = await findWaitlistById(raw)
      if (!row && raw.includes('@')) {
        row = await findWaitlistByEmail(raw)
      }
      if (!row) return fail(res, 404, 'User not found')

      // Close any open deletion request so Deletions tab stays consistent.
      try {
        const {
          findActiveDeletionByEmail,
          updateDeletionRequest,
        } = await import('../accountDeletion/store.js')
        const active = await findActiveDeletionByEmail(row.email)
        if (active && active.status !== 'purged') {
          await updateDeletionRequest(active.id, {
            status: 'purged',
            purgedAt: new Date().toISOString(),
            waitlistId: row.id,
            reviewedBy: String((req as any).admin?.email || 'admin'),
            reviewNote: 'Hard-deleted from Users tab',
          })
        }
      } catch (e) {
        console.warn('[admin] deletion request cleanup failed', e)
      }

      const deleted = await deleteWaitlistEntry(row.id)
      if (!deleted) return fail(res, 500, 'Failed to delete waitlist row')
      ok(res, { deleted: true, id: row.id, email: row.email })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to delete user')
    }
  })

  // ─── Account deletion requests (app → admin approval → 30-day retention) ───
  app.get('/api/admin/deletion-requests', requireAdmin, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
      const { listDeletionRequests, DELETION_RETENTION_DAYS } = await import('../accountDeletion/service.js')
      const status = String(req.query.status || 'all') as any
      const rows = await listDeletionRequests({ status })
      ok(res, { items: rows, retentionDays: DELETION_RETENTION_DAYS })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to list deletion requests')
    }
  })

  app.post('/api/admin/deletion-requests/:id/approve', requireAdmin, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
      const { approveDeletionRequest } = await import('../accountDeletion/service.js')
      const adminEmail = String((req as any).admin?.email || 'admin')
      const row = await approveDeletionRequest({
        id: String(req.params.id || ''),
        reviewedBy: adminEmail,
        note: req.body?.note != null ? String(req.body.note) : null,
      })
      ok(res, row)
    } catch (e: any) {
      fail(res, 400, e?.message || 'Failed to approve')
    }
  })

  app.post('/api/admin/deletion-requests/:id/reject', requireAdmin, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
      const { rejectDeletionRequest } = await import('../accountDeletion/service.js')
      const adminEmail = String((req as any).admin?.email || 'admin')
      const row = await rejectDeletionRequest({
        id: String(req.params.id || ''),
        reviewedBy: adminEmail,
        note: req.body?.note != null ? String(req.body.note) : null,
      })
      ok(res, row)
    } catch (e: any) {
      fail(res, 400, e?.message || 'Failed to reject')
    }
  })

  app.post('/api/admin/deletion-requests/:id/purge', requireAdmin, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
      const { purgeDeletionRequest } = await import('../accountDeletion/service.js')
      const adminEmail = String((req as any).admin?.email || 'admin')
      const row = await purgeDeletionRequest(String(req.params.id || ''), {
        force: Boolean(req.body?.force),
        actor: adminEmail,
      })
      ok(res, row)
    } catch (e: any) {
      fail(res, 400, e?.message || 'Failed to purge')
    }
  })

  /** Users tab: schedule 30-day deletion or purge immediately. */
  app.post('/api/admin/users/:id/schedule-deletion', requireAdmin, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
      const { findWaitlistById } = await import('./store.js')
      const { adminScheduleUserDeletion } = await import('../accountDeletion/service.js')
      const waitlistId = String(req.params.id || '').trim()
      const row = await findWaitlistById(waitlistId)
      if (!row) return fail(res, 404, 'User not found')
      const adminEmail = String((req as any).admin?.email || 'admin')
      const result = await adminScheduleUserDeletion({
        email: row.email,
        waitlistId: row.id,
        fullName: row.fullName,
        reviewedBy: adminEmail,
        immediate: Boolean(req.body?.immediate),
      })
      ok(res, result)
    } catch (e: any) {
      fail(res, 400, e?.message || 'Failed to schedule deletion')
    }
  })

  app.post('/api/admin/goldback/adjust', requireAdmin, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
      const userId = String(req.body?.userId || '').trim()
      if (!userId) return fail(res, 400, 'userId required')
      const result = await adminAdjustGoldback({
        userId,
        balancePaise: req.body?.balancePaise != null ? Number(req.body.balancePaise) : undefined,
        deltaPaise: req.body?.deltaPaise != null ? Number(req.body.deltaPaise) : undefined,
        note: req.body?.note ? String(req.body.note) : undefined,
      })
      ok(res, result)
    } catch (e: any) {
      fail(res, 400, e?.message || 'Failed to adjust Goldback')
    }
  })

  // ─── Push notifications ───
  app.get('/api/admin/notifications', requireAdmin, async (req, res) => {
    try {
      const { listAllNotifications } = await import('../notifications/store.js')
      const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100))
      ok(res, await listAllNotifications(limit))
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load notifications')
    }
  })

  app.post('/api/admin/notifications/broadcast', requireAdmin, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
      const title = String(req.body?.title || '').trim()
      const body = String(req.body?.body || '').trim()
      if (!title) return fail(res, 400, 'title required')
      const { broadcastNotifications } = await import('../notifications/store.js')
      const { listWaitlist } = await import('./store.js')

      const mode = String(req.body?.mode || '').trim().toLowerCase()
      const singleEmail = String(req.body?.email || '').trim().toLowerCase()
      let recipients: { userId: string; email?: string | null }[] = []

      // Prefer explicit single-user send. never silently fan out when email is set.
      if (mode === 'one' || singleEmail) {
        if (!singleEmail || !singleEmail.includes('@')) {
          return fail(res, 400, 'email required for one-user notification')
        }
        recipients = [{ userId: singleEmail, email: singleEmail }]
      } else if (Array.isArray(req.body?.userIds) && req.body.userIds.length) {
        recipients = req.body.userIds.map((id: string) => ({ userId: String(id) }))
      } else if (mode === 'broadcast' || mode === 'audience') {
        if (req.body?.confirmBroadcast !== true) {
          return fail(res, 400, 'confirmBroadcast required for audience sends')
        }
        const status = typeof req.body?.audience === 'string' ? req.body.audience : 'accepted'
        const rows = await listWaitlist({ status: status === 'all' ? 'all' : status })
        recipients = rows
          .map((r) => ({
            userId: String(r.email || '').trim().toLowerCase(),
            email: String(r.email || '').trim().toLowerCase() || null,
          }))
          .filter((r) => r.userId.includes('@'))
      } else {
        return fail(res, 400, 'Set mode to "one" (with email) or "broadcast" (with confirmBroadcast)')
      }

      if (!recipients.length) return fail(res, 400, 'No recipients')

      const result = await broadcastNotifications({
        recipients,
        title,
        body,
        type: req.body?.type || 'info',
        href: req.body?.href || '/dashboard',
        imageUrl: req.body?.imageUrl || null,
      })
      ok(res, { ...result, recipients: recipients.length, mode: singleEmail ? 'one' : 'broadcast' })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to broadcast')
    }
  })

  // ─── Super Browse stores ───
  app.get('/api/admin/super-browse', requireAdmin, async (_req, res) => {
    try {
      const { listSuperBrowseStores } = await import('../superBrowse/store.js')
      ok(res, await listSuperBrowseStores({ includeInactive: true }))
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load Super Browse stores')
    }
  })

  app.post('/api/admin/super-browse', requireAdmin, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
      const name = String(req.body?.name || '').trim()
      const url = String(req.body?.url || '').trim()
      if (!name || !url) return fail(res, 400, 'name and url (website) required')
      const { upsertSuperBrowseStore } = await import('../superBrowse/store.js')
      const row = await upsertSuperBrowseStore({
        id: req.body?.id,
        name,
        url,
        domain: req.body?.domain,
        logoUrl: req.body?.logoUrl,
        cashback: req.body?.cashback,
        bg: req.body?.bg,
        active: req.body?.active !== false,
        sortOrder: req.body?.sortOrder,
      })
      const { bumpCatalogRevision } = await import('../catalog/revision.js')
      bumpCatalogRevision('admin-super-browse-upsert')
      ok(res, row, 201)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to save store')
    }
  })

  app.post('/api/admin/super-browse/reorder', requireAdmin, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((id: unknown) => String(id)) : []
      if (!ids.length) return fail(res, 400, 'ids array required')
      const { reorderSuperBrowseStores } = await import('../superBrowse/store.js')
      const rows = await reorderSuperBrowseStores(ids)
      const { bumpCatalogRevision } = await import('../catalog/revision.js')
      bumpCatalogRevision('admin-super-browse-reorder')
      ok(res, rows)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to reorder stores')
    }
  })

  app.patch('/api/admin/super-browse/:id', requireAdmin, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
      const { listSuperBrowseStores, upsertSuperBrowseStore } = await import('../superBrowse/store.js')
      const id = String(req.params.id || '')
      const existing = (await listSuperBrowseStores({ includeInactive: true })).find((s) => s.id === id)
      if (!existing) return fail(res, 404, 'Store not found')
      const row = await upsertSuperBrowseStore({
        ...existing,
        ...req.body,
        id,
        name: req.body?.name ?? existing.name,
        url: req.body?.url ?? existing.url,
      })
      const { bumpCatalogRevision } = await import('../catalog/revision.js')
      bumpCatalogRevision('admin-super-browse-patch')
      ok(res, row)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to update store')
    }
  })

  app.delete('/api/admin/super-browse/:id', requireAdmin, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
      const { deleteSuperBrowseStore } = await import('../superBrowse/store.js')
      const deleted = await deleteSuperBrowseStore(String(req.params.id || ''))
      if (!deleted) return fail(res, 404, 'Store not found')
      const { bumpCatalogRevision } = await import('../catalog/revision.js')
      bumpCatalogRevision('admin-super-browse-delete')
      ok(res, { deleted: true })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to delete store')
    }
  })

  // ─── Commission structures (reward points rates + CueLinks pass-through) ───
  app.get('/api/admin/commission/reward-points', requireAdmin, async (_req, res) => {
    try {
      const { getRewardPointsCommission } = await import('../commission/rewardPointsStore.js')
      ok(res, getRewardPointsCommission())
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load reward points commission')
    }
  })

  app.put('/api/admin/commission/reward-points', requireAdmin, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
      const { saveRewardPointsCommission } = await import('../commission/rewardPointsStore.js')
      ok(
        res,
        saveRewardPointsCommission({
          enabled: req.body?.enabled,
          pointsPerHundredInr: req.body?.pointsPerHundredInr,
          maxPercentOfOrder: req.body?.maxPercentOfOrder,
          notes: req.body?.notes,
        }),
      )
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to save reward points commission')
    }
  })

  app.get('/api/admin/commission/cuelinks', requireAdmin, async (_req, res) => {
    try {
      const { getCueLinksPassThrough } = await import('../commission/cuelinksPassThroughStore.js')
      ok(res, getCueLinksPassThrough())
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load CueLinks pass-through')
    }
  })

  app.put('/api/admin/commission/cuelinks', requireAdmin, requireRole('admin', 'superadmin'), async (req, res) => {
    try {
      const { saveCueLinksPassThrough, setCampaignOverride } = await import(
        '../commission/cuelinksPassThroughStore.js'
      )
      if (req.body?.campaignId != null && Object.prototype.hasOwnProperty.call(req.body, 'campaignOverride')) {
        const override = req.body.campaignOverride
        ok(
          res,
          setCampaignOverride(
            req.body.campaignId,
            override == null || override === '' ? null : Number(override),
          ),
        )
        return
      }
      ok(
        res,
        saveCueLinksPassThrough({
          memberSharePercent: req.body?.memberSharePercent,
          campaignOverrides: req.body?.campaignOverrides,
          notes: req.body?.notes,
        }),
      )
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to save CueLinks pass-through')
    }
  })
}
