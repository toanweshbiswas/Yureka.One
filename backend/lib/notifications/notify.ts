import { notifyUser, listUserNotifications } from './store.js'
import type { NotifyUserInput, UserNotification } from './types.js'

export function firstName(fullName?: string | null, email?: string | null): string {
  const fromName = String(fullName || '').trim().split(/\s+/)[0]
  if (fromName) return fromName
  const local = String(email || '').split('@')[0]
  return local || 'there'
}

export function formatInrFromPaise(paise: number): string {
  return `₹${(Number(paise) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export async function notifyUserSafe(input: NotifyUserInput): Promise<UserNotification | null> {
  try {
    return await notifyUser(input)
  } catch (e: any) {
    console.warn('[notifications] notify failed:', e?.message || e)
    return null
  }
}

export async function notifyWaitlistAccepted(opts: {
  email: string
  fullName?: string | null
}) {
  const email = String(opts.email || '').trim().toLowerCase()
  if (!email) return null
  const name = firstName(opts.fullName, email)
  return notifyUserSafe({
    userId: email,
    email,
    title: `You're in, ${name}`,
    body: 'Your waitlist application was accepted. Open the dashboard to earn Goldback and browse offers.',
    type: 'success',
    href: '/dashboard/home',
    dedupeKey: `waitlist-accepted:${email}`,
  })
}

export async function notifyWaitlistRejected(opts: {
  email: string
  fullName?: string | null
}) {
  const email = String(opts.email || '').trim().toLowerCase()
  if (!email) return null
  return notifyUserSafe({
    userId: email,
    email,
    title: 'Waitlist update',
    body: 'Your application was not approved this time. You can apply again later.',
    type: 'warning',
    href: '/waitlist',
    dedupeKey: `waitlist-rejected:${email}`,
  })
}

export async function notifyScoreReady(opts: {
  email: string
  fullName?: string | null
  score: number
  decision?: string | null
}) {
  const email = String(opts.email || '').trim().toLowerCase()
  if (!email || !Number.isFinite(opts.score)) return null
  const name = firstName(opts.fullName, email)
  const decision = String(opts.decision || '').trim()
  const extra = decision ? ` Decision: ${decision}.` : ''
  return notifyUserSafe({
    userId: email,
    email,
    title: `${name}, your Yureka Score is ${Math.round(opts.score)}`,
    body: `Your score is ready on Home.${extra}`.trim(),
    type: 'success',
    href: '/dashboard/home',
    dedupeKey: `score-ready:${email}:${Math.round(opts.score)}`,
  })
}

export async function notifyGoldbackEarn(opts: {
  userId: string
  email?: string | null
  merchant?: string | null
  title?: string | null
  amountPaise: number
  offerId?: string | null
}) {
  const userId = String(opts.userId || '').trim()
  if (!userId) return null
  const merchant = String(opts.merchant || opts.title || 'an offer').trim()
  const amount = formatInrFromPaise(opts.amountPaise)
  return notifyUserSafe({
    userId,
    email: opts.email,
    title: `+${amount} Goldback`,
    body: `Goldback credited from ${merchant}.`,
    type: 'success',
    href: '/dashboard/home',
    imageUrl: null,
    dedupeKey: opts.offerId ? `goldback-earn:${userId}:${opts.offerId}` : `goldback-earn:${userId}:${Date.now()}`,
  })
}

export async function notifyGiftCardFulfilled(opts: {
  userId: string
  email?: string | null
  orderId: string
  productTitle?: string | null
  amountInr?: number | null
}) {
  const userId = String(opts.userId || '').trim()
  if (!userId) return null
  const title = String(opts.productTitle || 'Gift card').trim()
  const amount = Number.isFinite(Number(opts.amountInr)) ? `₹${Number(opts.amountInr).toLocaleString('en-IN')} ` : ''
  return notifyUserSafe({
    userId,
    email: opts.email,
    title: `${title} is ready`,
    body: `Your ${amount}voucher is in Gift cards. Open the order to view the code.`.replace(/\s+/g, ' ').trim(),
    type: 'success',
    href: `/dashboard/giftcards/orders/${opts.orderId}`,
    dedupeKey: `giftcard-success:${opts.orderId}`,
  })
}

export async function notifyGiftCardFailed(opts: {
  userId: string
  email?: string | null
  orderId: string
  productTitle?: string | null
}) {
  const userId = String(opts.userId || '').trim()
  if (!userId) return null
  const title = String(opts.productTitle || 'Gift card').trim()
  return notifyUserSafe({
    userId,
    email: opts.email,
    title: `${title} could not be issued`,
    body: 'Payment was received, but the voucher failed. Contact support for a retry or refund.',
    type: 'error',
    href: `/dashboard/giftcards/orders/${opts.orderId}`,
    dedupeKey: `giftcard-failed:${opts.orderId}`,
  })
}

export async function ensureWelcomeNotification(opts: {
  userId: string
  email?: string | null
  fullName?: string | null
}) {
  const userId = String(opts.userId || '').trim()
  if (!userId) return null
  const { items } = await listUserNotifications(userId, opts.email)
  if (items.length > 0) return null
  const name = firstName(opts.fullName, opts.email)
  const email = opts.email ? String(opts.email).trim().toLowerCase() : null
  return notifyUserSafe({
    userId,
    email,
    title: `Welcome, ${name}`,
    body: 'Your Yureka account is live. Check Offers to earn Goldback, or browse gift cards.',
    type: 'success',
    href: '/dashboard/home',
    dedupeKey: `welcome:${email || userId}`,
  })
}
