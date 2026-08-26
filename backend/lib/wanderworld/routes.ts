import type { Express, Request, Response } from 'express'
import { raw as expressRaw } from 'express'
import { productUserIdOrFail, resolveRequestEmail } from '../auth/userId.js'
import { verifyAdminToken, type AdminRole } from '../admin/auth.js'
import { normalizeEmail } from '../mail/emailAddress.js'
import { sendWanderworldInviteEmail } from '../mail/appEmails.js'
import { uploadBlogImage } from '../cms/blogMedia.js'
import {
  createRazorpayOrder,
  getRazorpayPayment,
  publicRazorpayKeyId,
  razorpayConfigured,
  verifyRazorpayCheckoutSignature,
  verifyRazorpayWebhookSignature,
} from '../razorpay/client.js'
import { isWwRole, isWwTripStatus, type WwMemberRole, type WwPaymentMode, type WwPlanInstallmentTemplate } from './types.js'
import {
  analyticsOverview,
  attachMemberUser,
  createRegistration,
  createTrip,
  createGroupRegistration,
  computeGroupPricing,
  deleteTrip,
  cancelRegistration,
  ensureGroupJoinCode,
  ensurePromoterLink,
  findActiveRegistrationForUserTrip,
  findInstallmentByRazorpayOrder,
  getGroupByJoinCode,
  getInstallment,
  getOrg,
  getPublishedTrip,
  getRegistration,
  getTrip,
  installmentsForRegistration,
  inviteMember,
  joinGroupShare,
  listMembers,
  deleteMember,
  deleteRegistration,
  listPromoterLinks,
  listPublishedTrips,
  listRegistrations,
  listTrips,
  listGroupBookableTrips,
  markInstallmentPaid,
  markInstallmentCashByPromoter,
  maybeBootstrapOwner,
  memberCanAccessTrip,
  memberOwnsRegistration,
  membershipsForIdentity,
  patchInstallment,
  promoterStats,
  recordPromoterClick,
  registrationsForUser,
  releaseGroupShare,
  resolvePromoterCode,
  setMemberTripAssignments,
  updateMemberProfile,
  updatePromoterLinkCode,
  updateRegistrationDetails,
  updateGroupShareDetails,
  userCanPayInstallment,
  updateTrip,
  wwBackendMode,
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

async function resolveMemberships(req: Request) {
  const result = await productUserIdOrFail(req)
  if ('error' in result) {
    return {
      userId: null as string | null,
      email: null as string | null,
      memberships: [] as Awaited<ReturnType<typeof membershipsForIdentity>>,
    }
  }
  const userId = result.userId
  const email = result.email ?? resolveRequestEmail(req)
  if (email) await maybeBootstrapOwner(email, userId)
  let memberships = await membershipsForIdentity({ userId, email })
  for (const row of memberships) {
    if (!row.member.userId && email && row.member.email === normalizeEmail(email)) {
      const attached = await attachMemberUser(row.member.id, userId)
      if (attached) row.member = attached
    }
  }
  memberships = await membershipsForIdentity({ userId, email })
  return { userId, email, memberships }
}

function currentMember(memberships: Awaited<ReturnType<typeof membershipsForIdentity>>) {
  return memberships[0] || null
}

function canManage(role: WwMemberRole) {
  return role === 'owner' || role === 'admin'
}

/** Normalize admin-edited installment rows; percents may be 0 to 100 or 0 to 1. */
function parsePlanTemplate(raw: unknown): WwPlanInstallmentTemplate[] | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: 'Add at least one payment plan installment' }
  }
  if (raw.length > 8) return { error: 'Payment plans support up to 8 installments' }
  const rows: WwPlanInstallmentTemplate[] = []
  let sum = 0
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i] || {}
    const label = String(row.label || `Installment ${i + 1}`).trim().slice(0, 80)
    let percent = Number(row.percent)
    if (!Number.isFinite(percent) || percent <= 0) {
      return { error: `Installment ${i + 1}: percent must be greater than 0` }
    }
    // Accept 30 meaning 30%, or 0.3 meaning 30%
    if (percent > 1) percent = percent / 100
    if (percent > 1) return { error: `Installment ${i + 1}: percent too large` }
    let daysBeforeStart: number | null = null
    if (row.daysBeforeStart !== undefined && row.daysBeforeStart !== null && row.daysBeforeStart !== '') {
      const d = Number(row.daysBeforeStart)
      if (!Number.isFinite(d) || d < 0) {
        return { error: `Installment ${i + 1}: days before start must be 0 or more` }
      }
      daysBeforeStart = Math.floor(d)
    } else if (i === 0) {
      daysBeforeStart = null
    } else {
      daysBeforeStart = 14
    }
    sum += percent
    rows.push({
      label: label || `Installment ${i + 1}`,
      percent: Math.round(percent * 10000) / 10000,
      daysBeforeStart,
    })
  }
  if (Math.abs(sum - 1) > 0.02) {
    return { error: `Installment percents must add up to 100% (currently ${Math.round(sum * 100)}%)` }
  }
  // Renormalize tiny drift onto last row
  const drift = 1 - rows.reduce((a, r) => a + r.percent, 0)
  if (Math.abs(drift) > 0.00001) {
    rows[rows.length - 1].percent = Math.round((rows[rows.length - 1].percent + drift) * 10000) / 10000
  }
  return rows
}

function appGetawayBase() {
  const origin =
    (process.env.VITE_APP_URL || process.env.APP_ORIGIN || 'https://app.yureka.one')
      .trim()
      .replace(/\/$/, '') || 'https://app.yureka.one'
  return `${origin}/dashboard/getaway`
}

function promoterShareUrl(code: string, tripSlug?: string | null) {
  const c = encodeURIComponent(code)
  if (tripSlug) return `${appGetawayBase()}/${encodeURIComponent(tripSlug)}?ref=${c}`
  return `${appGetawayBase()}?ref=${c}`
}

function groupJoinUrl(joinCode: string) {
  const origin =
    (process.env.VITE_APP_URL || process.env.APP_ORIGIN || 'https://app.yureka.one')
      .trim()
      .replace(/\/$/, '') || 'https://app.yureka.one'
  return `${origin}/dashboard/getaway/group/${encodeURIComponent(joinCode)}`
}

const claimedWebhookEvents = new Set<string>()

export function registerWanderworldRoutes(app: Express) {
  app.get('/api/wanderworld/health', (_req, res) => {
    ok(res, { mode: wwBackendMode(), org: getOrg().slug })
  })

  // . .  Public / buyer (app) . . 
  app.get('/api/wanderworld/trips', async (_req, res) => {
    try {
      const trips = await listPublishedTrips()
      ok(res, { trips })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to list trips')
    }
  })

  app.get('/api/wanderworld/trips/:slug', async (req, res) => {
    try {
      const trip = await getPublishedTrip(String(req.params.slug || ''))
      if (!trip) return fail(res, 404, 'Trip not found')
      ok(res, { trip })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load trip')
    }
  })

  app.get('/api/wanderworld/ref/:code', async (req, res) => {
    try {
      const raw = String(req.params.code || '')
      const link = await recordPromoterClick(raw)
      if (!link) {
        const existing = await resolvePromoterCode(raw)
        if (!existing) return fail(res, 404, 'Invalid referral code')
        return ok(res, { code: existing.code, tripId: existing.tripId || null, clicks: existing.clickCount || 0 })
      }
      ok(res, { code: link.code, tripId: link.tripId || null, clicks: link.clickCount || 0 })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to resolve code')
    }
  })

  app.get('/api/wanderworld/my/bookings', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const bookings = await registrationsForUser(userId)
      ok(res, { bookings })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load bookings')
    }
  })

  // Public group invite preview (auth not required to view; join requires login)
  app.get('/api/wanderworld/group/:code', async (req, res) => {
    try {
      const code = String(req.params.code || '')
      const group = await getGroupByJoinCode(code)
      if (!group) return fail(res, 404, 'Group not found')
      const { registration, trip, installments } = group
      const seats = registration.groupSize || installments.length
      const claimed = installments.filter((i) => i.claimedByUserId || i.claimedByEmail).length
      const paid = installments.filter((i) => i.status === 'paid').length
      const open = installments.filter(
        (i) => i.status === 'due' && !i.claimedByUserId && !i.claimedByEmail,
      ).length
      ok(res, {
        joinCode: registration.joinCode,
        joinUrl: groupJoinUrl(registration.joinCode || code),
        trip: {
          id: trip.id,
          title: trip.title,
          slug: trip.slug,
          coverImageUrl: trip.coverImageUrl,
          startDate: trip.startDate,
          endDate: trip.endDate,
          priceInr: trip.priceInr,
        },
        groupSize: seats,
        perSeatInr: registration.perSeatInr ?? Math.round((registration.amountDueInr / seats) * 100) / 100,
        amountDueInr: registration.amountDueInr,
        discountInr: registration.discountInr || 0,
        leadName: registration.buyerName,
        status: registration.status,
        seatsClaimed: claimed,
        seatsPaid: paid,
        seatsOpen: open,
        shares: installments.map((i) => ({
          sequence: i.sequence,
          label: i.label,
          amountInr: i.amountInr,
          status: i.status,
          claimed: Boolean(i.claimedByUserId || i.claimedByEmail),
          claimedName: i.claimedByName || null,
          isPaid: i.status === 'paid',
        })),
      })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load group')
    }
  })

  app.post('/api/wanderworld/group/:code/join', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const email =
        String(req.body?.email || '').trim() ||
        resolveRequestEmail(req) ||
        ''
      if (!email) return fail(res, 400, 'Email required')
      const name =
        String(req.body?.name || '').trim() ||
        email.split('@')[0] ||
        'Guest'
      const joined = await joinGroupShare({
        joinCode: String(req.params.code || ''),
        userId,
        email,
        name,
      })
      if ('error' in joined) {
        if (joined.error === 'not_found') return fail(res, 404, 'Group not found')
        if (joined.error === 'cancelled') return fail(res, 409, 'This group booking was cancelled')
        if (joined.error === 'full') return fail(res, 409, 'This group is full')
        if (joined.error === 'already_on_trip') {
          return fail(res, 409, 'You already have a booking on this trip')
        }
        return fail(res, 400, 'Could not join group')
      }

      const share = joined.installment
      if (share.status === 'paid') {
        return ok(res, {
          registration: joined.registration,
          installment: share,
          installments: joined.installments,
          trip: joined.trip,
          alreadyJoined: joined.alreadyJoined,
          alreadyPaid: true,
        })
      }

      if (!razorpayConfigured()) {
        return ok(res, {
          registration: joined.registration,
          installment: share,
          installments: joined.installments,
          trip: joined.trip,
          alreadyJoined: joined.alreadyJoined,
          paymentsUnavailable: true,
        })
      }

      const receipt = `ww-g-${joined.registration.id.slice(0, 6)}-${share.sequence}`.slice(0, 40)
      const rzp = await createRazorpayOrder({
        amountPaise: Math.round(share.amountInr * 100),
        receipt,
        notes: {
          wanderworld: '1',
          group: '1',
          registrationId: joined.registration.id,
          installmentId: share.id,
          tripId: joined.trip.id,
          userId,
        },
      })
      await patchInstallment(share.id, { razorpayOrderId: rzp.id })

      ok(res, {
        registration: joined.registration,
        installment: { ...share, razorpayOrderId: rzp.id },
        installments: joined.installments,
        trip: joined.trip,
        alreadyJoined: joined.alreadyJoined,
        keyId: publicRazorpayKeyId(),
        razorpayOrderId: rzp.id,
        amountPaise: rzp.amount,
        currency: 'INR',
        tripTitle: joined.trip.title,
        installmentId: share.id,
        prefill: {
          name,
          email,
          contact: joined.registration.buyerPhone || '',
        },
      })
    } catch (e: any) {
      console.error('[wanderworld] group join failed:', e?.message || e)
      fail(res, 502, e?.message || 'Failed to join group')
    }
  })

  app.post('/api/wanderworld/checkout', async (req, res) => {
    try {
      if (!razorpayConfigured()) return fail(res, 402, 'Payments are not configured')
      const userId = await requireUserId(req, res)
      if (!userId) return

      const tripId = String(req.body?.tripId || '').trim()
      const trip = tripId ? await getTrip(tripId) : null
      if (!trip || trip.status !== 'published') return fail(res, 404, 'Trip not found')
      if (trip.seatsTaken >= trip.seats) return fail(res, 409, 'No seats left')

      const existing = await findActiveRegistrationForUserTrip(userId, trip.id)
      if (existing) {
        return fail(res, 409, 'You already booked this trip. open My bookings to pay')
      }

      const paymentMode = (String(req.body?.paymentMode || 'full') === 'plan' ? 'plan' : 'full') as WwPaymentMode
      if (paymentMode === 'plan' && !trip.paymentPlansEnabled) {
        return fail(res, 400, 'Payment plans are not enabled for this trip')
      }

      const email =
        String(req.body?.buyerEmail || '').trim() ||
        resolveRequestEmail(req) ||
        ''
      if (!email) return fail(res, 400, 'Buyer email required')

      const created = await createRegistration({
        tripId: trip.id,
        userId,
        buyerEmail: email,
        buyerName: String(req.body?.buyerName || '').trim() || 'Guest',
        buyerPhone: String(req.body?.buyerPhone || '').trim() || null,
        promoterCode: String(req.body?.promoterCode || '').trim() || null,
        paymentMode,
        notes: String(req.body?.notes || '').trim() || null,
        city: String(req.body?.city || '').trim() || null,
        groupSize: req.body?.groupSize != null ? Number(req.body.groupSize) : null,
      })
      if ('error' in created) {
        if (created.error === 'already_booked') {
          return fail(res, 409, 'You already booked this trip. open My bookings to pay')
        }
        if (created.error === 'sold_out') return fail(res, 409, 'No seats left')
        return fail(res, 404, 'Trip not found')
      }

      const firstDue = created.installments.find((i) => i.status === 'due') || created.installments[0]
      if (!firstDue) return fail(res, 500, 'No installment to charge')

      const receipt = `ww-${created.registration.id.slice(0, 8)}-${firstDue.sequence}`.slice(0, 40)
      const rzp = await createRazorpayOrder({
        amountPaise: Math.round(firstDue.amountInr * 100),
        receipt,
        notes: {
          wanderworld: '1',
          registrationId: created.registration.id,
          installmentId: firstDue.id,
          tripId: trip.id,
          userId,
        },
      })
      await patchInstallment(firstDue.id, { razorpayOrderId: rzp.id })

      ok(
        res,
        {
          registrationId: created.registration.id,
          installmentId: firstDue.id,
          keyId: publicRazorpayKeyId(),
          razorpayOrderId: rzp.id,
          amountPaise: rzp.amount,
          currency: rzp.currency || 'INR',
          tripTitle: trip.title,
          paymentMode: created.registration.paymentMode,
          installments: created.installments,
          prefill: {
            name: created.registration.buyerName,
            email: created.registration.buyerEmail,
            contact: created.registration.buyerPhone || '',
          },
        },
        201,
      )
    } catch (e: any) {
      console.error('[wanderworld] checkout failed:', e?.message || e)
      fail(res, 502, e?.message || 'Failed to start checkout')
    }
  })

  app.post('/api/wanderworld/payments/verify', async (req, res) => {
    try {
      if (!razorpayConfigured()) return fail(res, 503, 'Payments unavailable')
      const userId = await requireUserId(req, res)
      if (!userId) return

      const installmentId = String(req.body?.installmentId || '').trim()
      const razorpayOrderId = String(req.body?.razorpay_order_id || req.body?.razorpayOrderId || '').trim()
      const razorpayPaymentId = String(
        req.body?.razorpay_payment_id || req.body?.razorpayPaymentId || '',
      ).trim()
      const signature = String(req.body?.razorpay_signature || req.body?.razorpaySignature || '').trim()

      if (!installmentId || !razorpayOrderId || !razorpayPaymentId || !signature) {
        return fail(res, 400, 'Missing payment fields')
      }

      const installment = await getInstallment(installmentId)
      if (!installment) return fail(res, 404, 'Installment not found')
      const reg = await getRegistration(installment.registrationId)
      if (!reg || !userCanPayInstallment(userId, reg, installment)) return fail(res, 403, 'Forbidden')
      if (reg.status === 'cancelled' || installment.status === 'cancelled') {
        return fail(res, 409, 'This booking was cancelled')
      }

      if (!verifyRazorpayCheckoutSignature({ orderId: razorpayOrderId, paymentId: razorpayPaymentId, signature })) {
        return fail(res, 400, 'Invalid payment signature')
      }

      const payment = await getRazorpayPayment(razorpayPaymentId)
      const expectedPaise = Math.round(installment.amountInr * 100)
      if (Number(payment.amount) !== expectedPaise) {
        return fail(res, 400, 'Payment amount mismatch')
      }
      if (String(payment.status) !== 'captured' && String(payment.status) !== 'authorized') {
        return fail(res, 400, 'Payment not captured')
      }

      const result = await markInstallmentPaid({
        installmentId,
        razorpayOrderId,
        razorpayPaymentId,
      })
      if (!result) return fail(res, 500, 'Failed to record payment')
      ok(res, {
        registration: result.registration,
        installment: result.installment,
        installments: await installmentsForRegistration(result.registration.id),
      })
    } catch (e: any) {
      console.error('[wanderworld] verify failed:', e?.message || e)
      fail(res, 502, e?.message || 'Payment verification failed')
    }
  })

  app.post('/api/wanderworld/payments/installment', async (req, res) => {
    try {
      if (!razorpayConfigured()) return fail(res, 402, 'Payments are not configured')
      const userId = await requireUserId(req, res)
      if (!userId) return
      const installmentId = String(req.body?.installmentId || '').trim()
      const installment = await getInstallment(installmentId)
      if (!installment || installment.status === 'paid' || installment.status === 'cancelled') {
        return fail(res, 400, 'Installment not payable')
      }
      const reg = await getRegistration(installment.registrationId)
      if (!reg || !userCanPayInstallment(userId, reg, installment)) return fail(res, 403, 'Forbidden')
      if (reg.status === 'cancelled') return fail(res, 409, 'This booking was cancelled')
      const trip = await getTrip(reg.tripId)

      const receipt = `ww-${reg.id.slice(0, 8)}-${installment.sequence}`.slice(0, 40)
      const rzp = await createRazorpayOrder({
        amountPaise: Math.round(installment.amountInr * 100),
        receipt,
        notes: {
          wanderworld: '1',
          registrationId: reg.id,
          installmentId: installment.id,
          tripId: reg.tripId,
          userId,
        },
      })
      await patchInstallment(installment.id, { razorpayOrderId: rzp.id })

      ok(res, {
        registrationId: reg.id,
        installmentId: installment.id,
        keyId: publicRazorpayKeyId(),
        razorpayOrderId: rzp.id,
        amountPaise: rzp.amount,
        currency: 'INR',
        tripTitle: trip?.title || 'Trip',
        prefill: {
          name: installment.claimedByName || reg.buyerName,
          email: installment.claimedByEmail || reg.buyerEmail,
          contact: reg.buyerPhone || '',
        },
      })
    } catch (e: any) {
      fail(res, 502, e?.message || 'Failed to start installment payment')
    }
  })

  // Webhook: also handle WW payments on the shared Razorpay webhook path via side-effect
  // Dedicated path for clarity / dual registration with giftcards.
  app.post('/api/wanderworld/webhooks/razorpay', async (req, res) => {
    try {
      const signature = String(req.header('x-razorpay-signature') || '')
      const raw = String((req as any).rawBody || JSON.stringify(req.body || {}))
      if (!verifyRazorpayWebhookSignature(raw, signature)) {
        return fail(res, 401, 'Invalid webhook signature')
      }
      const event = req.body || {}
      const eventId = String(event.event_id || event.id || `${event.event}-${Date.now()}`)
      if (claimedWebhookEvents.has(eventId)) return ok(res, { duplicate: true })
      claimedWebhookEvents.add(eventId)

      const paymentEntity = event.payload?.payment?.entity
      const orderId = String(paymentEntity?.order_id || '')
      const paymentId = String(paymentEntity?.id || '')
      if (event.event === 'payment.captured' && orderId && paymentId) {
        const installment = await findInstallmentByRazorpayOrder(orderId)
        if (installment && installment.status !== 'paid') {
          await markInstallmentPaid({
            installmentId: installment.id,
            razorpayOrderId: orderId,
            razorpayPaymentId: paymentId,
          })
        }
      }
      ok(res, { received: true })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Webhook failed')
    }
  })

  // . .  Ops portal . . 
  app.get('/api/wanderworld/me', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const { memberships } = await resolveMemberships(req)
      const current = currentMember(memberships)
      ok(res, { memberships, current, org: getOrg() })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load membership')
    }
  })

  app.get('/api/wanderworld/admin/trips', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const { memberships } = await resolveMemberships(req)
      const current = currentMember(memberships)
      if (!current || !canManage(current.member.role)) return fail(res, 403, 'Forbidden')
      const trips = await listTrips({ status: 'all' })
      ok(res, { trips })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to list trips')
    }
  })

  app.post(
    '/api/wanderworld/admin/upload',
    expressRaw({ type: () => true, limit: '8mb' }),
    async (req, res) => {
      try {
        const userId = await requireUserId(req, res)
        if (!userId) return
        const { memberships } = await resolveMemberships(req)
        const current = currentMember(memberships)
        if (!current || !canManage(current.member.role)) return fail(res, 403, 'Forbidden')
        const filename = String(req.header('x-filename') || req.query.filename || 'cover.jpg')
        const contentType = String(req.header('x-content-type') || req.header('content-type') || 'image/jpeg')
          .split(';')[0]
          .trim()
        const body = req.body as Buffer | { data?: string } | undefined
        const buffer = Buffer.isBuffer(body)
          ? body
          : body && typeof body === 'object' && 'data' in body && body.data
            ? Buffer.from(String(body.data), 'base64')
            : Buffer.alloc(0)
        const uploaded = await uploadBlogImage({
          buffer,
          filename,
          contentType,
          kind: 'wanderworld',
        })
        ok(res, uploaded, 201)
      } catch (e: any) {
        const msg = e?.message || 'Failed to upload image'
        fail(res, msg.includes('not configured') ? 503 : 400, msg)
      }
    },
  )

  app.post('/api/wanderworld/admin/trips', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const { memberships } = await resolveMemberships(req)
      const current = currentMember(memberships)
      if (!current || !canManage(current.member.role)) return fail(res, 403, 'Forbidden')
      const title = String(req.body?.title || '').trim()
      if (!title) return fail(res, 400, 'Title required')
      let planTemplate: WwPlanInstallmentTemplate[] | undefined
      if (req.body?.planTemplate != null) {
        const parsed = parsePlanTemplate(req.body.planTemplate)
        if ('error' in parsed) return fail(res, 400, parsed.error)
        planTemplate = parsed
      }
      const trip = await createTrip({
        title,
        description: String(req.body?.description || ''),
        itinerary: String(req.body?.itinerary || ''),
        priceInr: Number(req.body?.priceInr) || 0,
        seats: Number(req.body?.seats) || 1,
        startDate: String(req.body?.startDate || ''),
        endDate: String(req.body?.endDate || ''),
        coverImageUrl: req.body?.coverImageUrl || null,
        paymentPlansEnabled: Boolean(req.body?.paymentPlansEnabled),
        planTemplate,
      })
      ok(res, { trip }, 201)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to create trip')
    }
  })

  app.patch('/api/wanderworld/admin/trips/:id', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const { memberships } = await resolveMemberships(req)
      const current = currentMember(memberships)
      if (!current || !canManage(current.member.role)) return fail(res, 403, 'Forbidden')
      const patch: Record<string, unknown> = {}
      for (const key of [
        'title',
        'description',
        'itinerary',
        'priceInr',
        'seats',
        'startDate',
        'endDate',
        'coverImageUrl',
        'paymentPlansEnabled',
        'groupBookingEnabled',
        'groupSeats',
        'groupDiscountType',
        'groupDiscountValue',
        'groupMinSize',
        'groupMaxSize',
      ]) {
        if (req.body?.[key] !== undefined) patch[key] = req.body[key]
      }
      if (req.body?.planTemplate !== undefined) {
        const parsed = parsePlanTemplate(req.body.planTemplate)
        if ('error' in parsed) return fail(res, 400, parsed.error)
        patch.planTemplate = parsed
      }
      if (req.body?.status != null) {
        if (!isWwTripStatus(req.body.status)) return fail(res, 400, 'Invalid status')
        patch.status = req.body.status
      }
      const trip = await updateTrip(String(req.params.id), patch as any)
      if (!trip) return fail(res, 404, 'Trip not found')
      ok(res, { trip })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to update trip')
    }
  })

  app.delete('/api/wanderworld/admin/trips/:id', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const { memberships } = await resolveMemberships(req)
      const current = currentMember(memberships)
      if (!current || !canManage(current.member.role)) return fail(res, 403, 'Forbidden')
      const id = String(req.params.id || '')
      if (!id) return fail(res, 400, 'Trip id required')
      const trip = await getTrip(id)
      if (!trip) return fail(res, 404, 'Trip not found')
      const okDel = await deleteTrip(id)
      if (!okDel) return fail(res, 404, 'Trip not found')
      ok(res, { deleted: true })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to delete trip')
    }
  })

  app.get('/api/wanderworld/admin/registrations', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const { memberships } = await resolveMemberships(req)
      const current = currentMember(memberships)
      if (!current || !canManage(current.member.role)) return fail(res, 403, 'Forbidden')
      const rows = await listRegistrations({
        tripId: String(req.query.tripId || '') || undefined,
        promoterCode: String(req.query.promoterCode || '') || undefined,
      })
      const enriched = []
      for (const row of rows) {
        let joinCode = row.registration.joinCode || null
        if (row.registration.isGroup && !joinCode) {
          joinCode = await ensureGroupJoinCode(row.registration.id)
        }
        enriched.push({
          ...row,
          registration: {
            ...row.registration,
            joinCode,
          },
          joinUrl: joinCode ? groupJoinUrl(joinCode) : null,
        })
      }
      ok(res, { registrations: enriched })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to list registrations')
    }
  })

  app.post('/api/wanderworld/admin/registrations/:id/cancel', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const { memberships } = await resolveMemberships(req)
      const current = currentMember(memberships)
      if (!current || !canManage(current.member.role)) return fail(res, 403, 'Forbidden')
      const id = String(req.params.id || '')
      if (!id) return fail(res, 400, 'Registration id required')
      const result = await cancelRegistration(id)
      if ('error' in result) {
        if (result.error === 'already_cancelled') return fail(res, 409, 'Already cancelled')
        return fail(res, 404, 'Registration not found')
      }
      ok(res, result)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to cancel registration')
    }
  })

  app.post('/api/wanderworld/admin/installments/:id/cash', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const { memberships } = await resolveMemberships(req)
      const current = currentMember(memberships)
      if (!current || !canManage(current.member.role)) return fail(res, 403, 'Forbidden')
      const installmentId = String(req.params.id || '')
      if (!installmentId) return fail(res, 400, 'Installment id required')
      const installment = await getInstallment(installmentId)
      if (!installment) return fail(res, 404, 'Installment not found')
      if (installment.status === 'cancelled') return fail(res, 409, 'Installment cancelled')
      const reg = await getRegistration(installment.registrationId)
      if (!reg) return fail(res, 404, 'Registration not found')
      if (reg.status === 'cancelled') return fail(res, 409, 'Registration cancelled')
      const result = await markInstallmentCashByPromoter({
        installmentId,
        memberId: current.member.id,
        note: String(req.body?.note || '').trim() || 'Admin cash',
      })
      if ('error' in result) return fail(res, 400, result.error)
      ok(res, {
        registration: result.registration,
        installment: result.installment,
        installments: await installmentsForRegistration(result.registration.id),
      })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to record cash')
    }
  })

  app.get('/api/wanderworld/admin/analytics', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const { memberships } = await resolveMemberships(req)
      const current = currentMember(memberships)
      if (!current || !canManage(current.member.role)) return fail(res, 403, 'Forbidden')
      ok(res, await analyticsOverview())
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load analytics')
    }
  })

  app.get('/api/wanderworld/admin/members', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const { memberships } = await resolveMemberships(req)
      const current = currentMember(memberships)
      if (!current || !canManage(current.member.role)) return fail(res, 403, 'Forbidden')
      ok(res, { members: await listMembers() })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to list members')
    }
  })

  app.post('/api/wanderworld/admin/members', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const { memberships } = await resolveMemberships(req)
      const current = currentMember(memberships)
      if (!current || !canManage(current.member.role)) return fail(res, 403, 'Forbidden')
      const email = String(req.body?.email || '').trim()
      const role = String(req.body?.role || 'promoter')
      if (!email) return fail(res, 400, 'Email required')
      if (!isWwRole(role)) return fail(res, 400, 'Invalid role')
      if (role === 'owner' && current.member.role !== 'owner') {
        return fail(res, 403, 'Only owner can invite owners')
      }
      const member = await inviteMember({ email, role })
      if (role === 'promoter' || role === 'admin' || role === 'owner') {
        await ensurePromoterLink(member.id, null)
      }
      const invitedBy = resolveRequestEmail(req) || current.member.email
      let emailed = false
      try {
        const mail = await sendWanderworldInviteEmail({
          to: member.email,
          role: member.role,
          invitedBy,
        })
        emailed = Boolean(mail?.sent)
      } catch (mailErr: any) {
        console.warn('[wanderworld] invite email failed:', mailErr?.message || mailErr)
      }
      ok(res, { member, emailed }, 201)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to invite member')
    }
  })

  app.delete('/api/wanderworld/admin/members/:id', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const { memberships } = await resolveMemberships(req)
      const current = currentMember(memberships)
      if (!current || !canManage(current.member.role)) return fail(res, 403, 'Forbidden')
      const id = String(req.params.id || '')
      if (!id) return fail(res, 400, 'Member id required')
      if (id === current.member.id) return fail(res, 400, 'Cannot remove yourself')
      const target = (await listMembers()).find((m) => m.id === id)
      if (!target) return fail(res, 404, 'Member not found')
      if (target.role === 'owner' && current.member.role !== 'owner') {
        return fail(res, 403, 'Only owner can remove owners')
      }
      const okDel = await deleteMember(id)
      if (!okDel) return fail(res, 404, 'Member not found')
      ok(res, { deleted: true })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to delete member')
    }
  })

  app.get('/api/wanderworld/promoter/dashboard', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const { memberships } = await resolveMemberships(req)
      const current = currentMember(memberships)
      if (!current) return fail(res, 403, 'No WanderWorld invitation')
      let links = await listPromoterLinks(current.member.id)
      const assigned = current.member.assignedTripIds || []
      const trips = await listTrips({ status: 'all' })

      if (assigned.length === 0) {
        await ensurePromoterLink(current.member.id, null)
        links = await listPromoterLinks(current.member.id)
      } else {
        for (const tripId of assigned) {
          await ensurePromoterLink(current.member.id, tripId)
        }
        links = await listPromoterLinks(current.member.id)
      }

      const stats = await promoterStats(current.member.id)
      // Assigned → only trip-scoped links. Unassigned → only the global (all trips) link.
      const filteredLinks =
        assigned.length === 0
          ? links.filter((l) => !l.tripId)
          : links.filter((l) => l.tripId && assigned.includes(l.tripId))

      const shareLinks = filteredLinks.map((l) => {
        const trip = l.tripId ? trips.find((t) => t.id === l.tripId) : null
        const url = promoterShareUrl(l.code, trip?.slug)
        return {
          ...l,
          url,
          tripTitle: trip?.title || null,
          tripSlug: trip?.slug || null,
          scope: trip ? ('trip' as const) : ('all' as const),
        }
      })

      const assignedTrips =
        assigned.length === 0
          ? trips
              .filter((t) => t.status === 'published')
              .map((t) => ({ id: t.id, title: t.title, slug: t.slug, status: t.status }))
          : trips
              .filter((t) => assigned.includes(t.id))
              .map((t) => ({ id: t.id, title: t.title, slug: t.slug, status: t.status }))

      const rows = []
      for (const row of stats.rows) {
        let joinCode = row.registration.joinCode || null
        if (row.registration.isGroup && !joinCode) {
          joinCode = await ensureGroupJoinCode(row.registration.id)
        }
        rows.push({
          ...row,
          registration: { ...row.registration, joinCode },
          joinUrl: joinCode ? groupJoinUrl(joinCode) : null,
        })
      }

      ok(res, {
        role: current.member.role,
        profile: {
          displayName: current.member.displayName || null,
          phone: current.member.phone || null,
          city: current.member.city || null,
          bio: current.member.bio || null,
          instagram: current.member.instagram || null,
          email: current.member.email,
        },
        assignedTripIds: assigned,
        assignmentMode: assigned.length === 0 ? 'all' : 'specific',
        assignedTrips,
        ...stats,
        rows,
        shareLinks,
        getawayBase: appGetawayBase(),
      })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load promoter dashboard')
    }
  })

  app.patch('/api/wanderworld/promoter/code', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const { memberships } = await resolveMemberships(req)
      const current = currentMember(memberships)
      if (!current) return fail(res, 403, 'No WanderWorld invitation')
      // Custom referral IDs are admin-only. promoters may copy links but not rename codes.
      if (!canManage(current.member.role)) {
        return fail(res, 403, 'Only admins can set custom referral IDs')
      }

      const code = String(req.body?.code || '')
      const linkId = req.body?.linkId ? String(req.body.linkId) : null
      const tripId = req.body?.tripId != null ? String(req.body.tripId || '') || null : null
      const targetMemberId = req.body?.memberId ? String(req.body.memberId) : current.member.id

      const target =
        (await listMembers()).find((m) => m.id === targetMemberId) || current.member
      if (!target) return fail(res, 404, 'Member not found')

      if (linkId) {
        // linkId path. updatePromoterLinkCode finds it
      } else if (tripId) {
        await ensurePromoterLink(targetMemberId, tripId)
      } else {
        await ensurePromoterLink(targetMemberId, null)
      }

      const result = await updatePromoterLinkCode({
        memberId: targetMemberId,
        linkId:
          linkId ||
          (await listPromoterLinks(targetMemberId)).find(
            (l) => (l.tripId || null) === (tripId || null),
          )?.id ||
          null,
        code,
        asAdmin: true,
      })
      if ('error' in result) return fail(res, 400, result.error)

      const trip = result.link.tripId ? await getTrip(result.link.tripId) : null
      const url = promoterShareUrl(result.link.code, trip?.slug)
      ok(res, { link: result.link, url })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to update referral ID')
    }
  })

  app.post('/api/wanderworld/promoter/cash', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const { memberships } = await resolveMemberships(req)
      const current = currentMember(memberships)
      if (!current) return fail(res, 403, 'No WanderWorld invitation')
      const installmentId = String(req.body?.installmentId || '').trim()
      if (!installmentId) return fail(res, 400, 'installmentId required')
      const note = req.body?.note != null ? String(req.body.note) : null
      const result = await markInstallmentCashByPromoter({
        installmentId,
        memberId: current.member.id,
        note,
      })
      if ('error' in result) return fail(res, 400, result.error)
      ok(res, result)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to record cash collection')
    }
  })

  app.get('/api/wanderworld/promoter/group-trips', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const { memberships } = await resolveMemberships(req)
      const current = currentMember(memberships)
      if (!current) return fail(res, 403, 'No WanderWorld invitation')
      const trips = await listGroupBookableTrips(current.member)
      ok(res, {
        trips: trips.map((t) => ({
          ...t,
          pricingSample: computeGroupPricing(t, t.groupMinSize || 2),
        })),
      })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to list group trips')
    }
  })

  app.post('/api/wanderworld/promoter/group-booking', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const { memberships } = await resolveMemberships(req)
      const current = currentMember(memberships)
      if (!current) return fail(res, 403, 'No WanderWorld invitation')

      const tripId = String(req.body?.tripId || '').trim()
      if (!tripId) return fail(res, 400, 'tripId required')
      if (!memberCanAccessTrip(current.member, tripId)) {
        return fail(res, 403, 'You are not assigned to this trip')
      }
      const groupSize = Math.floor(Number(req.body?.groupSize) || 0)
      const paymentMode = (String(req.body?.paymentMode || 'full') === 'plan' ? 'plan' : 'full') as WwPaymentMode
      const buyerEmail = String(req.body?.buyerEmail || '').trim()
      const buyerName = String(req.body?.buyerName || '').trim()
      if (!buyerEmail || !buyerName) return fail(res, 400, 'Lead name and email required')

      const promoterCode =
        String(req.body?.promoterCode || '').trim() ||
        (await listPromoterLinks(current.member.id)).find((l) => l.tripId === tripId)?.code ||
        (await listPromoterLinks(current.member.id))[0]?.code ||
        null

      const created = await createGroupRegistration({
        tripId,
        userId,
        bookedByMemberId: current.member.id,
        buyerEmail,
        buyerName,
        buyerPhone: String(req.body?.buyerPhone || '').trim() || null,
        promoterCode,
        paymentMode,
        groupSize,
        notes: String(req.body?.notes || '').trim() || null,
        city: String(req.body?.city || '').trim() || null,
      })
      if ('error' in created) {
        if (created.error === 'group_disabled') {
          return fail(res, 400, 'Group booking is not enabled for this trip')
        }
        if (created.error === 'invalid_size') {
          return fail(res, 400, 'Group size is outside the allowed range')
        }
        if (created.error === 'group_sold_out') return fail(res, 409, 'Not enough group seats left')
        if (created.error === 'sold_out') return fail(res, 409, 'Not enough seats left')
        return fail(res, 404, 'Trip not found')
      }

      ok(
        res,
        {
          registration: created.registration,
          installments: created.installments,
          trip: created.trip,
          pricing: {
            listPriceInr: created.registration.listPriceInr,
            discountInr: created.registration.discountInr,
            amountDueInr: created.registration.amountDueInr,
            perSeatInr: created.registration.perSeatInr,
          },
          joinCode: created.registration.joinCode,
          joinUrl: groupJoinUrl(created.registration.joinCode || ''),
        },
        201,
      )
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to create group booking')
    }
  })

  app.post('/api/wanderworld/promoter/registrations/:id/cancel', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const { memberships } = await resolveMemberships(req)
      const current = currentMember(memberships)
      if (!current) return fail(res, 403, 'No WanderWorld invitation')
      const id = String(req.params.id || '')
      if (!id) return fail(res, 400, 'Registration id required')
      const reg = await getRegistration(id)
      if (!reg) return fail(res, 404, 'Registration not found')
      if (!memberOwnsRegistration(current.member, reg)) {
        return fail(res, 403, 'You can only cancel bookings on your referral or that you created')
      }
      const result = await cancelRegistration(id)
      if ('error' in result) {
        if (result.error === 'already_cancelled') return fail(res, 409, 'Already cancelled')
        return fail(res, 404, 'Registration not found')
      }
      ok(res, result)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to cancel registration')
    }
  })

  app.patch('/api/wanderworld/promoter/registrations/:id', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const { memberships } = await resolveMemberships(req)
      const current = currentMember(memberships)
      if (!current) return fail(res, 403, 'No WanderWorld invitation')
      const id = String(req.params.id || '')
      if (!id) return fail(res, 400, 'Registration id required')
      const existing = await getRegistration(id)
      if (!existing) return fail(res, 404, 'Registration not found')
      if (!memberOwnsRegistration(current.member, existing)) {
        return fail(res, 403, 'You can only edit bookings on your referral or that you created')
      }
      if (existing.status === 'cancelled') return fail(res, 409, 'Booking is cancelled')
      const registration = await updateRegistrationDetails(id, {
        buyerName: req.body?.buyerName,
        buyerEmail: req.body?.buyerEmail,
        buyerPhone: req.body?.buyerPhone,
        notes: req.body?.notes,
        city: req.body?.city,
      })
      if (!registration) return fail(res, 404, 'Registration not found')
      ok(res, {
        registration,
        installments: await installmentsForRegistration(registration.id),
        joinUrl: registration.joinCode ? groupJoinUrl(registration.joinCode) : null,
      })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to update registration')
    }
  })

  app.post('/api/wanderworld/promoter/shares/:id/release', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const { memberships } = await resolveMemberships(req)
      const current = currentMember(memberships)
      if (!current) return fail(res, 403, 'No WanderWorld invitation')
      const installmentId = String(req.params.id || '')
      if (!installmentId) return fail(res, 400, 'Share id required')
      const installment = await getInstallment(installmentId)
      if (!installment) return fail(res, 404, 'Share not found')
      const reg = await getRegistration(installment.registrationId)
      if (!reg) return fail(res, 404, 'Registration not found')
      if (!memberOwnsRegistration(current.member, reg)) {
        return fail(res, 403, 'You can only manage shares on your bookings')
      }
      const result = await releaseGroupShare({ installmentId })
      if ('error' in result) return fail(res, 400, result.error)
      ok(res, {
        installment: result.installment,
        registration: result.registration,
        installments: await installmentsForRegistration(result.registration.id),
      })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to release share')
    }
  })

  app.patch('/api/wanderworld/promoter/shares/:id', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const { memberships } = await resolveMemberships(req)
      const current = currentMember(memberships)
      if (!current) return fail(res, 403, 'No WanderWorld invitation')
      const installmentId = String(req.params.id || '')
      if (!installmentId) return fail(res, 400, 'Share id required')
      const installment = await getInstallment(installmentId)
      if (!installment) return fail(res, 404, 'Share not found')
      const reg = await getRegistration(installment.registrationId)
      if (!reg) return fail(res, 404, 'Registration not found')
      if (!memberOwnsRegistration(current.member, reg)) {
        return fail(res, 403, 'You can only manage shares on your bookings')
      }
      const result = await updateGroupShareDetails({
        installmentId,
        claimedByName: req.body?.claimedByName,
        claimedByEmail: req.body?.claimedByEmail,
      })
      if ('error' in result) return fail(res, 400, result.error)
      ok(res, {
        installment: result.installment,
        registration: result.registration,
        installments: await installmentsForRegistration(result.registration.id),
      })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to update share')
    }
  })

  app.delete('/api/wanderworld/promoter/registrations/:id', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const { memberships } = await resolveMemberships(req)
      const current = currentMember(memberships)
      if (!current) return fail(res, 403, 'No WanderWorld invitation')
      const id = String(req.params.id || '')
      if (!id) return fail(res, 400, 'Registration id required')
      const reg = await getRegistration(id)
      if (!reg) return fail(res, 404, 'Registration not found')
      if (!memberOwnsRegistration(current.member, reg)) {
        return fail(res, 403, 'You can only delete bookings on your referral or that you created')
      }
      const result = await deleteRegistration(id)
      if ('error' in result) {
        if (result.error === 'has_payments') {
          return fail(res, 409, 'Booking has payments. cancel instead of delete')
        }
        if (result.error === 'already_cancelled') {
          return fail(res, 409, 'Already cancelled. nothing to delete')
        }
        return fail(res, 404, 'Registration not found')
      }
      ok(res, result)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to delete registration')
    }
  })

  app.patch('/api/wanderworld/promoter/profile', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const { memberships } = await resolveMemberships(req)
      const current = currentMember(memberships)
      if (!current) return fail(res, 403, 'No WanderWorld invitation')
      const member = await updateMemberProfile(current.member.id, {
        displayName: req.body?.displayName,
        phone: req.body?.phone,
        city: req.body?.city,
        bio: req.body?.bio,
        instagram: req.body?.instagram,
      })
      if (!member) return fail(res, 404, 'Member not found')
      ok(res, { member })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to update profile')
    }
  })

  app.patch('/api/wanderworld/admin/members/:id/trips', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const { memberships } = await resolveMemberships(req)
      const current = currentMember(memberships)
      if (!current || !canManage(current.member.role)) return fail(res, 403, 'Forbidden')
      const id = String(req.params.id || '')
      if (!id) return fail(res, 400, 'Member id required')
      const tripIds = Array.isArray(req.body?.tripIds)
        ? req.body.tripIds.map((x: unknown) => String(x))
        : []
      const member = await setMemberTripAssignments(id, tripIds)
      if (!member) return fail(res, 404, 'Member not found')
      ok(res, { member })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to assign trips')
    }
  })

  app.patch('/api/wanderworld/admin/members/:id/profile', async (req, res) => {
    try {
      const userId = await requireUserId(req, res)
      if (!userId) return
      const { memberships } = await resolveMemberships(req)
      const current = currentMember(memberships)
      if (!current || !canManage(current.member.role)) return fail(res, 403, 'Forbidden')
      const id = String(req.params.id || '')
      if (!id) return fail(res, 400, 'Member id required')
      const member = await updateMemberProfile(id, {
        displayName: req.body?.displayName,
        phone: req.body?.phone,
        city: req.body?.city,
        bio: req.body?.bio,
        instagram: req.body?.instagram,
      })
      if (!member) return fail(res, 404, 'Member not found')
      ok(res, { member })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to update member profile')
    }
  })

  // . .  Club admin (admin.yureka.one) . . 
  function requireClubAdmin(req: Request, res: Response, roles?: AdminRole[]) {
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

  app.get('/api/admin/wanderworld/overview', async (req, res) => {
    try {
      if (!requireClubAdmin(req, res, ['admin', 'superadmin'])) return
      const [analytics, trips, members, registrations] = await Promise.all([
        analyticsOverview(),
        listTrips({ status: 'all' }),
        listMembers(),
        listRegistrations(),
      ])
      ok(res, {
        org: getOrg(),
        analytics,
        trips,
        members,
        registrations: registrations.slice(0, 50),
        opsUrl: `${(process.env.VITE_WANDERWORLD_URL || 'https://wanderworld.yureka.one').replace(/\/$/, '')}/`,
        getawayUrl: `${appGetawayBase()}`,
      })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load WanderWorld overview')
    }
  })

  app.post('/api/admin/wanderworld/members', async (req, res) => {
    try {
      const session = requireClubAdmin(req, res, ['admin', 'superadmin'])
      if (!session) return
      const email = String(req.body?.email || '').trim()
      const role = String(req.body?.role || 'owner')
      if (!email) return fail(res, 400, 'Email required')
      if (!isWwRole(role)) return fail(res, 400, 'Invalid role')
      const member = await inviteMember({ email, role: role as any })
      if (role === 'promoter' || role === 'admin' || role === 'owner') {
        await ensurePromoterLink(member.id, null)
      }
      let emailed = false
      try {
        const mail = await sendWanderworldInviteEmail({
          to: member.email,
          role: member.role,
          invitedBy: session.email || 'Yureka Club admin',
        })
        emailed = Boolean(mail?.sent)
      } catch (mailErr: any) {
        console.warn('[wanderworld] club invite email failed:', mailErr?.message || mailErr)
      }
      ok(res, { member, emailed }, 201)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to invite WanderWorld member')
    }
  })

  app.delete('/api/admin/wanderworld/members/:id', async (req, res) => {
    try {
      const session = requireClubAdmin(req, res, ['admin', 'superadmin'])
      if (!session) return
      const id = String(req.params.id || '')
      if (!id) return fail(res, 400, 'Member id required')
      const okDel = await deleteMember(id)
      if (!okDel) return fail(res, 404, 'Member not found')
      ok(res, { deleted: true })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to delete WanderWorld member')
    }
  })
}
