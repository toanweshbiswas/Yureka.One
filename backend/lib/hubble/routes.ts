import type { Express, Request, Response } from 'express'
import { randomBytes } from 'crypto'
import {
  clearHubbleCaches,
  fetchAllGiftCards,
  getGiftCard,
  getHubbleOrder,
  giftcardCheckoutEnabled,
  giftcardCheckoutMode,
  giftcardDirectIssueEnabled,
  hubbleConfigured,
  listGiftCards,
} from './client.js'
import {
  applyHubbleOrderResult,
  claimWebhookEvent,
  createLocalOrder,
  getOrderByGuestToken,
  getOrderById,
  getOrderByRazorpayOrderId,
  listOrdersForUser,
  patchLocalOrder,
} from './store.js'
import { fulfillGiftCardWithHubble } from './fulfill.js'
import { giftCardAmountAllowed } from './denominations.js'
import { matchGiftCardForPurchase } from './matchMerchant.js'
import { scrapeProductPriceFromUrl } from './productPrice.js'
import { isProductPageUrl, merchantHostKey } from '../../../shared/giftCardProduct.js'
import { sanitizeBrowseUrl } from '../../../shared/inAppBrowse.js'
import {
  handleBrandDiscountWebhook,
  handleBrandUpdatedWebhook,
  handleOrderTerminalWebhook,
  handleWalletLowWebhook,
  requireHubbleWebhookSignature,
} from './webhooks.js'
import { productUserIdOrFail, resolveProductUserId } from '../auth/userId.js'
import {
  createRazorpayOrder,
  getRazorpayPayment,
  publicRazorpayKeyId,
  razorpayConfigured,
  verifyRazorpayCheckoutSignature,
  verifyRazorpayWebhookSignature,
} from '../razorpay/client.js'

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

function userIdFrom(req: Request, res: Response): string | null {
  const result = productUserIdOrFail(req)
  if ('error' in result) {
    fail(res, 401, result.error)
    return null
  }
  return result.userId
}

function makeReferenceId(): string {
  // Max 40 chars, globally unique per Hubble rules.
  return `yrk_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9 ]/g, '').trim().slice(0, 80) || 'Yureka User'
}

function sanitizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length >= 10) return digits.slice(-10)
  return ''
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function guestStatusPath(guestToken: string) {
  return `/gift/orders/${guestToken}`
}

export function registerGiftcardRoutes(app: Express) {
  app.get('/api/giftcards/health', (_req, res) => {
    ok(res, {
      configured: hubbleConfigured(),
      razorpay: razorpayConfigured(),
      checkoutEnabled: giftcardCheckoutEnabled(),
      checkout: giftcardCheckoutMode(),
      keyId: giftcardCheckoutMode() === 'razorpay' ? publicRazorpayKeyId() : null,
      directIssue: giftcardDirectIssueEnabled(),
    })
  })

  app.get('/api/giftcards/match', async (req, res) => {
    if (!hubbleConfigured()) {
      return fail(res, 503, 'Gift cards are temporarily unavailable')
    }
    try {
      const hostRaw = typeof req.query.host === 'string' ? req.query.host.trim().toLowerCase() : ''
      const host = hostRaw.replace(/^www\./, '')
      if (!host) return fail(res, 400, 'host is required')

      const amountRaw = typeof req.query.amount === 'string' ? Number(req.query.amount) : NaN
      const amount = Number.isFinite(amountRaw) && amountRaw > 0 ? amountRaw : null
      const product = typeof req.query.product === 'string' ? req.query.product.trim() : null

      const all = await fetchAllGiftCards()
      const match = matchGiftCardForPurchase(all, host, amount, product)
      if (!match) return ok(res, { match: null })

      const appOrigin =
        (process.env.APP_ORIGIN || process.env.FRONTEND_URL || process.env.PUBLIC_APP_URL || '').trim() ||
        'https://app.yureka.one'

      ok(res, {
        match: {
          cardId: match.card.id,
          title: match.card.title,
          brand: match.card.brand,
          logoUrl: match.card.logoUrl,
          discountPercentage: match.card.discountPercentage,
          requestedAmount: match.requestedAmount,
          suggestedAmount: match.suggestedAmount,
          savingsInr: match.savingsInr,
          checkoutPath: match.checkoutPath,
          checkoutUrl: `${appOrigin.replace(/\/$/, '')}${match.checkoutPath}`,
        },
      })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Gift card match failed')
    }
  })

  app.get('/api/giftcards/match-from-url', async (req, res) => {
    if (!hubbleConfigured()) {
      return fail(res, 503, 'Gift cards are temporarily unavailable')
    }
    try {
      const raw = typeof req.query.url === 'string' ? req.query.url.trim() : ''
      const pageUrl = sanitizeBrowseUrl(raw)
      if (!pageUrl) return fail(res, 400, 'url is required')

      const host = merchantHostKey(pageUrl)
      if (!host) return fail(res, 400, 'Invalid store URL')

      const isProductPage = isProductPageUrl(pageUrl)
      const productPrice = isProductPage ? await scrapeProductPriceFromUrl(pageUrl) : null

      const all = await fetchAllGiftCards()
      const match = matchGiftCardForPurchase(all, host, productPrice, pageUrl)
      if (!match) return ok(res, { match: null, isProductPage, productPrice })

      const appOrigin =
        (process.env.APP_ORIGIN || process.env.FRONTEND_URL || process.env.PUBLIC_APP_URL || '').trim() ||
        'https://app.yureka.one'

      ok(res, {
        isProductPage,
        productPrice,
        match: {
          cardId: match.card.id,
          title: match.card.title,
          brand: match.card.brand,
          logoUrl: match.card.logoUrl,
          discountPercentage: match.card.discountPercentage,
          requestedAmount: match.requestedAmount,
          suggestedAmount: match.suggestedAmount,
          savingsInr: match.savingsInr,
          checkoutPath: match.checkoutPath,
          checkoutUrl: `${appOrigin.replace(/\/$/, '')}${match.checkoutPath}`,
          productPrice,
          isProductPage,
        },
      })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Gift card match failed')
    }
  })

  app.get('/api/giftcards', async (req, res) => {
    if (!hubbleConfigured()) {
      return fail(res, 503, 'Gift cards are temporarily unavailable')
    }
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : 'ACTIVE'
      const category = typeof req.query.category === 'string' ? req.query.category : ''
      const q = typeof req.query.q === 'string' ? req.query.q : ''
      const result = await listGiftCards({ status, category, q })
      ok(res, result)
    } catch (e: any) {
      console.error('[giftcards] list failed:', e?.message || e)
      fail(res, 502, 'Failed to load gift cards')
    }
  })

  app.post('/api/giftcards/refresh', async (_req, res) => {
    if (!hubbleConfigured()) {
      return fail(res, 503, 'Gift cards are temporarily unavailable')
    }
    try {
      clearHubbleCaches()
      const all = await fetchAllGiftCards({ force: true })
      ok(res, {
        total: all.length,
        active: all.filter((c) => c.status === 'ACTIVE').length,
      })
    } catch (e: any) {
      fail(res, 502, 'Failed to refresh gift cards')
    }
  })

  // --- Orders (must be registered before /:id) ---

  app.get('/api/giftcards/orders', async (req, res) => {
    try {
      const userId = userIdFrom(req, res)
      if (!userId) return
      const orders = await listOrdersForUser(userId)
      ok(res, { items: orders })
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to list orders')
    }
  })

  app.get('/api/giftcards/orders/:id', async (req, res) => {
    try {
      const userId = userIdFrom(req, res)
      if (!userId) return
      const id = String(req.params.id)
      const order = await getOrderById(id, userId)
      if (!order) return fail(res, 404, 'Order not found')

      // Refresh from Hubble if still processing and we have a Hubble id.
      if (order.status === 'PROCESSING' && order.hubbleOrderId && hubbleConfigured()) {
        try {
          const remote = await getHubbleOrder(order.hubbleOrderId)
          const updated = await applyHubbleOrderResult(order.id, remote)
          return ok(res, updated || order)
        } catch (e: any) {
          console.warn('[giftcards] poll order failed:', e?.message || e)
        }
      }
      ok(res, order)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load order')
    }
  })

  async function buildCheckoutDraft(req: Request, res: Response) {
    const productId = String(req.body?.productId || '').trim()
    const denomination = Number(req.body?.denomination)
    const quantity = Math.max(1, Number(req.body?.quantity) || 1)
    if (!productId) {
      fail(res, 400, 'productId is required')
      return null
    }
    if (!Number.isFinite(denomination) || denomination <= 0) {
      fail(res, 400, 'denomination must be a positive number')
      return null
    }

    const card = await getGiftCard(productId)
    if (!card || card.status !== 'ACTIVE') {
      fail(res, 404, 'Gift card not available')
      return null
    }
    const amountCheck = giftCardAmountAllowed(card, denomination)
    if ('error' in amountCheck) {
      fail(res, 400, amountCheck.error)
      return null
    }

    const amount = denomination * quantity
    const customerName = sanitizeName(String(req.body?.customerName || req.body?.name || 'Yureka User'))
    const customerEmail = String(req.body?.customerEmail || req.body?.email || '')
      .trim()
      .toLowerCase()
      .slice(0, 120)
    const customerPhone = sanitizePhone(String(req.body?.customerPhone || req.body?.phone || ''))
    if (!/^\d{10}$/.test(customerPhone)) {
      fail(res, 400, 'Enter a valid 10-digit mobile number to receive the voucher')
      return null
    }

    const wantGuest = Boolean(req.body?.guestCheckout)
    const resolvedAuth = resolveProductUserId(req)
    let userId = resolvedAuth
    let isGuest = false

    if (!userId) {
      if (!wantGuest) {
        const required = productUserIdOrFail(req)
        if ('error' in required) {
          fail(res, 401, required.error)
          return null
        }
        userId = required.userId
      } else {
        if (!isValidEmail(customerEmail)) {
          fail(res, 400, 'Enter your email so we can send the order confirmation')
          return null
        }
        userId = `guest:${customerEmail}`
        isGuest = true
      }
    }

    if (!customerEmail && !isGuest) {
      // Logged-in buyers may omit email in body; keep a placeholder for Hubble.
    }
    const resolvedEmail =
      customerEmail ||
      (userId.includes('@') ? userId : '') ||
      'noreply@yureka.one'

    const isGift = Boolean(req.body?.isGift || req.body?.giftForSomeone || wantGuest)
    const recipientName = isGift
      ? sanitizeName(String(req.body?.recipientName || ''))
      : ''
    const recipientEmail = isGift
      ? String(req.body?.recipientEmail || '')
          .trim()
          .toLowerCase()
          .slice(0, 120)
      : ''
    const giftMessage = isGift
      ? String(req.body?.giftMessage || '')
          .trim()
          .slice(0, 280)
      : ''

    if (isGift) {
      if (recipientName.length < 2) {
        fail(res, 400, 'Enter the recipient’s name')
        return null
      }
      if (!isValidEmail(recipientEmail)) {
        fail(res, 400, 'Enter a valid recipient email')
        return null
      }
    }

    return {
      userId,
      isGuest,
      card,
      amount,
      denomination,
      quantity,
      customerName,
      customerEmail: resolvedEmail,
      customerPhone,
      isGift,
      recipientName: isGift ? recipientName : null,
      recipientEmail: isGift ? recipientEmail : null,
      giftMessage: isGift && giftMessage ? giftMessage : null,
    }
  }

  /** Step 1: create a Razorpay order. Hubble is called only after payment is verified. */
  app.post('/api/giftcards/checkout', async (req, res) => {
    if (!hubbleConfigured()) {
      return fail(res, 503, 'Gift cards are temporarily unavailable')
    }
    if (giftcardCheckoutMode() !== 'razorpay') {
      return fail(res, 402, 'Razorpay checkout is not configured')
    }
    try {
      const draft = await buildCheckoutDraft(req, res)
      if (!draft) return
      const referenceId = makeReferenceId()
      const local = await createLocalOrder({
        userId: draft.userId,
        referenceId,
        productId: draft.card.id,
        productTitle: draft.card.title,
        amountInr: draft.amount,
        denomination: draft.denomination,
        quantity: draft.quantity,
        customerName: draft.customerName,
        customerEmail: draft.customerEmail,
        customerPhone: draft.customerPhone,
        isGift: draft.isGift,
        recipientName: draft.recipientName,
        recipientEmail: draft.recipientEmail,
        giftMessage: draft.giftMessage,
        paymentStatus: 'unpaid',
      })

      const rzp = await createRazorpayOrder({
        amountPaise: Math.round(draft.amount * 100),
        receipt: referenceId,
        notes: {
          yurekaOrderId: local.id,
          productId: draft.card.id,
          userId: draft.userId,
        },
      })

      await patchLocalOrder(local.id, { razorpayOrderId: rzp.id })

      ok(
        res,
        {
          orderId: local.id,
          guestToken: local.guestToken,
          keyId: publicRazorpayKeyId(),
          razorpayOrderId: rzp.id,
          amountPaise: rzp.amount,
          currency: rzp.currency || 'INR',
          productTitle: draft.card.title,
          prefill: {
            name: draft.customerName,
            email: draft.customerEmail,
            contact: draft.customerPhone,
          },
          statusUrl: local.guestToken
            ? guestStatusPath(local.guestToken)
            : `/dashboard/giftcards/orders/${local.id}`,
        },
        201,
      )
    } catch (e: any) {
      console.error('[giftcards] checkout failed:', e?.message || e)
      fail(res, 502, e?.message || 'Failed to start checkout')
    }
  })

  /** Step 2: verify Razorpay signature, then issue the Hubble voucher. */
  app.post('/api/giftcards/checkout/verify', async (req, res) => {
    if (!hubbleConfigured() || !razorpayConfigured()) {
      return fail(res, 503, 'Gift cards are temporarily unavailable')
    }
    try {
      const localId = String(req.body?.orderId || req.body?.localOrderId || '').trim()
      const guestToken = String(req.body?.guestToken || '').trim()
      const razorpayOrderId = String(req.body?.razorpay_order_id || req.body?.razorpayOrderId || '').trim()
      const razorpayPaymentId = String(req.body?.razorpay_payment_id || req.body?.razorpayPaymentId || '').trim()
      const signature = String(req.body?.razorpay_signature || req.body?.razorpaySignature || '').trim()
      if (!localId || !razorpayOrderId || !razorpayPaymentId || !signature) {
        return fail(res, 400, 'Missing Razorpay payment details')
      }

      let order = null as Awaited<ReturnType<typeof getOrderById>>
      if (guestToken) {
        const byToken = await getOrderByGuestToken(guestToken)
        if (!byToken || byToken.id !== localId) return fail(res, 404, 'Order not found')
        order = byToken
      } else {
        const userId = userIdFrom(req, res)
        if (!userId) return
        order = await getOrderById(localId, userId)
        if (!order) return fail(res, 404, 'Order not found')
      }

      if (order.razorpayOrderId && order.razorpayOrderId !== razorpayOrderId) {
        return fail(res, 400, 'Payment does not match this order')
      }

      const valid = verifyRazorpayCheckoutSignature({
        orderId: razorpayOrderId,
        paymentId: razorpayPaymentId,
        signature,
      })
      if (!valid) return fail(res, 400, 'Payment signature could not be verified')

      const payment = await getRazorpayPayment(razorpayPaymentId)
      if (payment.order_id !== razorpayOrderId) {
        return fail(res, 400, 'Payment does not belong to this Razorpay order')
      }
      const expectedPaise = Math.round(order.amountInr * 100)
      if (Number(payment.amount) !== expectedPaise) {
        return fail(res, 400, 'Paid amount does not match the gift card value')
      }
      if (!['captured', 'authorized'].includes(String(payment.status || '').toLowerCase())) {
        await patchLocalOrder(order.id, { paymentStatus: 'failed', razorpayPaymentId })
        return fail(res, 402, 'Payment was not captured')
      }

      await patchLocalOrder(order.id, {
        paymentStatus: 'paid',
        razorpayOrderId,
        razorpayPaymentId,
      })

      const paid = (await getOrderById(order.id)) || order
      const fulfilled = await fulfillGiftCardWithHubble(paid)
      ok(res, {
        order: fulfilled,
        guestToken: fulfilled.guestToken || guestToken || null,
        statusUrl: fulfilled.guestToken
          ? guestStatusPath(fulfilled.guestToken)
          : `/dashboard/giftcards/orders/${order.id}`,
      })
    } catch (e: any) {
      console.error('[giftcards] verify failed:', e?.message || e)
      fail(res, 502, e?.message || 'Failed to confirm payment')
    }
  })

  /** Public order status for guest (landing) checkout — token is the capability. */
  app.get('/api/giftcards/guest/orders/:token', async (req, res) => {
    try {
      const token = String(req.params.token || '').trim()
      if (!token) return fail(res, 400, 'Missing order token')
      const order = await getOrderByGuestToken(token)
      if (!order) return fail(res, 404, 'Order not found')
      ok(res, order)
    } catch (e: any) {
      fail(res, 500, e?.message || 'Failed to load order')
    }
  })

  app.post('/api/razorpay/webhooks', async (req, res) => {
    const raw =
      typeof (req as any).rawBody === 'string' ? (req as any).rawBody : JSON.stringify(req.body ?? {})
    const sig = (req.header('x-razorpay-signature') || '').trim()
    if (!verifyRazorpayWebhookSignature(raw, sig)) {
      return res.status(401).json({ ok: false, error: 'Invalid signature' })
    }
    try {
      const event = String(req.body?.event || '')
      const payment = req.body?.payload?.payment?.entity
      const paymentId = String(payment?.id || '')
      const razorpayOrderId = String(payment?.order_id || '')
      const eventKey = `razorpay:${event}:${paymentId || razorpayOrderId}`
      const claimed = await claimWebhookEvent(eventKey, event || 'razorpay', req.body)
      if (!claimed) return res.status(200).json({ ok: true, duplicate: true })

      if (event === 'payment.captured' && razorpayOrderId) {
        const local = await getOrderByRazorpayOrderId(razorpayOrderId)
        if (local && local.paymentStatus !== 'paid') {
          await patchLocalOrder(local.id, {
            paymentStatus: 'paid',
            razorpayPaymentId: paymentId || local.razorpayPaymentId,
          })
        }
        const latest = local ? await getOrderById(local.id) : null
        if (latest && latest.paymentStatus === 'paid' && !latest.hubbleOrderId) {
          await fulfillGiftCardWithHubble(latest)
        }
      }
      if (event === 'payment.failed' && razorpayOrderId) {
        const local = await getOrderByRazorpayOrderId(razorpayOrderId)
        if (local && local.paymentStatus === 'unpaid') {
          await patchLocalOrder(local.id, { paymentStatus: 'failed', status: 'FAILED', failureReason: 'Payment failed' })
        }
      }
      res.status(200).json({ ok: true })
    } catch (e: any) {
      console.error('[razorpay webhook]', e?.message || e)
      res.status(500).json({ ok: false, error: e?.message || 'handler failed' })
    }
  })

  /** Direct wallet issue — only when GIFTCARD_DIRECT_ISSUE=true (no Razorpay). */
  app.post('/api/giftcards/orders', async (req, res) => {
    if (!hubbleConfigured()) {
      return fail(res, 503, 'Gift cards are temporarily unavailable')
    }
    if (giftcardCheckoutMode() === 'razorpay') {
      return fail(res, 400, 'Pay with Razorpay checkout first')
    }
    if (!giftcardDirectIssueEnabled()) {
      return fail(res, 402, 'Gift card checkout is currently disabled.')
    }
    try {
      const draft = await buildCheckoutDraft(req, res)
      if (!draft) return
      const local = await createLocalOrder({
        userId: draft.userId,
        referenceId: makeReferenceId(),
        productId: draft.card.id,
        productTitle: draft.card.title,
        amountInr: draft.amount,
        denomination: draft.denomination,
        quantity: draft.quantity,
        customerName: draft.customerName,
        customerEmail: draft.customerEmail,
        customerPhone: draft.customerPhone,
        isGift: draft.isGift,
        recipientName: draft.recipientName,
        recipientEmail: draft.recipientEmail,
        giftMessage: draft.giftMessage,
        paymentStatus: 'paid',
      })
      const fulfilled = await fulfillGiftCardWithHubble(local)
      ok(
        res,
        {
          order: fulfilled,
          statusUrl: `/dashboard/giftcards/orders/${local.id}`,
        },
        201,
      )
    } catch (e: any) {
      console.error('[giftcards] place order failed:', e?.message || e)
      fail(res, 502, 'Failed to place gift card order')
    }
  })

  app.get('/api/giftcards/:id', async (req, res) => {
    if (!hubbleConfigured()) {
      return fail(res, 503, 'Gift cards are temporarily unavailable')
    }
    try {
      const card = await getGiftCard(String(req.params.id))
      if (!card) return fail(res, 404, 'Gift card not found')
      ok(res, card)
    } catch (e: any) {
      console.error('[giftcards] get failed:', e?.message || e)
      fail(res, 502, 'Failed to load gift card')
    }
  })

  // --- Webhooks (signature via X-Verify) ---

  const webhookAuth = [requireHubbleWebhookSignature]

  app.post('/api/hubble/webhooks/order-terminal', ...webhookAuth, async (req, res) => {
    try {
      const result = await handleOrderTerminalWebhook(req.body)
      res.status(200).json({ ok: true, ...result })
    } catch (e: any) {
      console.error('[hubble webhook] order-terminal:', e?.message || e)
      res.status(500).json({ ok: false, error: e?.message || 'handler failed' })
    }
  })

  app.post('/api/hubble/webhooks/brand-updated', ...webhookAuth, async (req, res) => {
    try {
      const result = await handleBrandUpdatedWebhook(req.body)
      res.status(200).json({ ok: true, ...result })
    } catch (e: any) {
      console.error('[hubble webhook] brand-updated:', e?.message || e)
      res.status(500).json({ ok: false, error: e?.message || 'handler failed' })
    }
  })

  app.post('/api/hubble/webhooks/brand-discount', ...webhookAuth, async (req, res) => {
    try {
      const result = await handleBrandDiscountWebhook(req.body)
      res.status(200).json({ ok: true, ...result })
    } catch (e: any) {
      console.error('[hubble webhook] brand-discount:', e?.message || e)
      res.status(500).json({ ok: false, error: e?.message || 'handler failed' })
    }
  })

  app.post('/api/hubble/webhooks/wallet-low', ...webhookAuth, async (req, res) => {
    try {
      await handleWalletLowWebhook(req.body)
      res.status(200).json({ ok: true })
    } catch (e: any) {
      console.error('[hubble webhook] wallet-low:', e?.message || e)
      res.status(500).json({ ok: false, error: e?.message || 'handler failed' })
    }
  })
}
