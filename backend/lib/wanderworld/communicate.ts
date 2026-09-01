import { notifyUserSafe, firstName } from '../notifications/notify.js'
import { mailUrls } from '../mail/layout.js'
import {
  sendWwBookingCreatedEmail,
  sendWwPaymentReceivedEmail,
  sendWwInstallmentDueEmail,
  sendWwInstallmentOverdueEmail,
  sendWwGroupInviteEmail,
  sendWwRegistrationCancelledEmail,
  sendWwTripUpdatedEmail,
  sendWwPromoterAttributionEmail,
  sendWwCashRecordedEmail,
  sendWwChatMessageEmail,
  sendWwTripAnnouncementEmail,
} from '../mail/appEmails.js'
import type { WwInstallment, WwRegistration, WwTrip } from './types.js'

export type WwCommEvent =
  | 'booking_created'
  | 'payment_received'
  | 'installment_due'
  | 'installment_overdue'
  | 'group_invite'
  | 'registration_cancelled'
  | 'trip_updated'
  | 'trip_announcement'
  | 'promoter_attribution'
  | 'cash_recorded'
  | 'chat_message'

type Channel = 'inbox' | 'email'

export type WwCommPayload = {
  registration?: WwRegistration
  installment?: WwInstallment
  trip?: WwTrip
  joinCode?: string
  joinUrl?: string
  promoterEmail?: string | null
  promoterUserId?: string | null
  amountInr?: number
  dueAt?: string
  updateNote?: string
  cashNote?: string | null
  chatMessageId?: string
  isStaffRecipient?: boolean
  messagePreview?: string
  senderName?: string
  announcementTitle?: string
}

function appGetawayUrl(path = '/dashboard/getaway/bookings'): string {
  const base = mailUrls().app.replace(/\/$/, '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

function wwPortalUrl(path = '/'): string {
  const base = mailUrls().wanderworld.replace(/\/$/, '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

function resolveUserId(userId?: string | null, email?: string | null): string {
  const uid = String(userId || '').trim()
  if (uid) return uid
  return String(email || '').trim().toLowerCase()
}

async function sendInbox(
  userId: string,
  email: string | null | undefined,
  title: string,
  body: string,
  href: string,
  dedupeKey: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info',
) {
  return notifyUserSafe({ userId, email: email || null, title, body, type, href, dedupeKey })
}

export async function communicateWwEvent(opts: {
  event: WwCommEvent
  userId?: string | null
  email?: string | null
  payload: WwCommPayload
  channels?: Channel[]
}) {
  const channels = opts.channels ?? ['inbox', 'email']
  const email = String(opts.email || opts.payload.registration?.buyerEmail || '').trim().toLowerCase()
  const userId = resolveUserId(opts.userId, email)
  if (!userId && !email) return

  const reg = opts.payload.registration
  const inst = opts.payload.installment
  const trip = opts.payload.trip
  const tripTitle = trip?.title || 'your trip'
  const name = firstName(reg?.buyerName, email)

  switch (opts.event) {
    case 'booking_created': {
      if (!reg) return
      const href = '/dashboard/getaway/bookings'
      const dedupe = `ww-booking:${reg.id}`
      if (channels.includes('inbox')) {
        await sendInbox(
          userId,
          email,
          `Booking started — ${tripTitle}`,
          `Your WanderWorld booking is created. Complete payment from My bookings, then open Trip chat to meet your group.`,
          href,
          dedupe,
          'success',
        )
      }
      if (channels.includes('email') && email) {
        await sendWwBookingCreatedEmail({ to: email, name, tripTitle, bookingsUrl: appGetawayUrl(href) })
      }
      break
    }
    case 'payment_received': {
      if (!reg || !inst) return
      const amount = opts.payload.amountInr ?? inst.amountInr
      const href = '/dashboard/getaway/bookings'
      const dedupe = `ww-paid:${inst.id}`
      const paidLabel = reg.status === 'paid' ? 'Trip fully paid!' : 'Payment received'
      if (channels.includes('inbox')) {
        await sendInbox(
          userId,
          email,
          `${paidLabel} — ${tripTitle}`,
          `${inst.label}: ₹${amount.toLocaleString('en-IN')} received.${reg.status === 'partial' ? ' Remaining balance due later.' : ''}`,
          href,
          dedupe,
          'success',
        )
      }
      if (channels.includes('email') && email) {
        await sendWwPaymentReceivedEmail({
          to: email,
          name,
          tripTitle,
          label: inst.label,
          amountInr: amount,
          fullyPaid: reg.status === 'paid',
          bookingsUrl: appGetawayUrl(href),
        })
      }
      if (reg.promoterCode && opts.payload.promoterEmail) {
        void communicateWwEvent({
          event: 'promoter_attribution',
          userId: opts.payload.promoterUserId || opts.payload.promoterEmail,
          email: opts.payload.promoterEmail,
          payload: { registration: reg, installment: inst, trip, amountInr: amount },
          channels,
        })
      }
      break
    }
    case 'installment_due': {
      if (!reg || !inst) return
      const href = '/dashboard/getaway/bookings'
      const dueKey = (opts.payload.dueAt || inst.dueAt || '').slice(0, 10)
      const dedupe = `ww-due:${inst.id}:${dueKey}`
      if (channels.includes('inbox')) {
        await sendInbox(
          userId,
          email,
          `Payment due soon — ${tripTitle}`,
          `${inst.label} of ₹${inst.amountInr.toLocaleString('en-IN')} is due ${dueKey}.`,
          href,
          dedupe,
          'warning',
        )
      }
      if (channels.includes('email') && email) {
        await sendWwInstallmentDueEmail({
          to: email,
          name,
          tripTitle,
          label: inst.label,
          amountInr: inst.amountInr,
          dueAt: inst.dueAt,
          bookingsUrl: appGetawayUrl(href),
        })
      }
      break
    }
    case 'installment_overdue': {
      if (!reg || !inst) return
      const href = '/dashboard/getaway/bookings'
      const dedupe = `ww-overdue:${inst.id}`
      if (channels.includes('inbox')) {
        await sendInbox(
          userId,
          email,
          `Payment overdue — ${tripTitle}`,
          `${inst.label} of ₹${inst.amountInr.toLocaleString('en-IN')} is overdue. Pay from My bookings.`,
          href,
          dedupe,
          'error',
        )
      }
      if (channels.includes('email') && email) {
        await sendWwInstallmentOverdueEmail({
          to: email,
          name,
          tripTitle,
          label: inst.label,
          amountInr: inst.amountInr,
          bookingsUrl: appGetawayUrl(href),
        })
      }
      break
    }
    case 'group_invite': {
      const joinCode = opts.payload.joinCode || reg?.joinCode
      const joinUrl =
        opts.payload.joinUrl ||
        (joinCode ? appGetawayUrl(`/dashboard/getaway/group/${joinCode}`) : appGetawayUrl())
      const dedupe = `ww-group:${joinCode || reg?.id}`
      const leadEmail = email || reg?.buyerEmail
      if (!leadEmail) return
      const leadId = resolveUserId(reg?.userId, leadEmail)
      if (channels.includes('inbox')) {
        await sendInbox(
          leadId,
          leadEmail,
          `Group trip invite — ${tripTitle}`,
          `You're invited to join a group booking. Open the link to claim your seat and pay.`,
          joinCode ? `/dashboard/getaway/group/${joinCode}` : '/dashboard/getaway',
          dedupe,
          'info',
        )
      }
      if (channels.includes('email')) {
        await sendWwGroupInviteEmail({
          to: leadEmail,
          name: firstName(reg?.buyerName, leadEmail),
          tripTitle,
          joinUrl,
          groupSize: reg?.groupSize ?? undefined,
        })
      }
      break
    }
    case 'registration_cancelled': {
      if (!reg) return
      const href = '/dashboard/getaway'
      const dedupe = `ww-cancel:${reg.id}`
      if (channels.includes('inbox')) {
        await sendInbox(
          userId,
          email,
          `Booking cancelled — ${tripTitle}`,
          `Your WanderWorld booking was cancelled. Contact support if you have questions.`,
          href,
          dedupe,
          'warning',
        )
      }
      if (channels.includes('email') && email) {
        await sendWwRegistrationCancelledEmail({ to: email, name, tripTitle, getawayUrl: appGetawayUrl(href) })
      }
      break
    }
    case 'trip_updated': {
      if (!trip) return
      const slug = trip.slug
      const href = `/dashboard/getaway/${slug}`
      const dedupe = `ww-trip:${trip.id}:${trip.updatedAt}`
      const note = opts.payload.updateNote || 'Trip details were updated.'
      if (channels.includes('inbox')) {
        await sendInbox(userId, email, `Trip update — ${trip.title}`, note, href, dedupe, 'info')
      }
      if (channels.includes('email') && email) {
        await sendWwTripUpdatedEmail({
          to: email,
          name,
          tripTitle: trip.title,
          note,
          tripUrl: appGetawayUrl(href),
        })
      }
      break
    }
    case 'trip_announcement': {
      if (!trip) return
      const slug = trip.slug
      const staff = Boolean(opts.payload.isStaffRecipient)
      const href = staff ? '/' : `/dashboard/getaway/${slug}`
      const headline =
        opts.payload.announcementTitle?.trim() || `Announcement — ${trip.title}`
      const note = opts.payload.updateNote || 'New trip announcement from WanderWorld.'
      const dedupe = `ww-announce:${trip.id}:${opts.payload.chatMessageId || Date.now()}:${userId}`
      if (channels.includes('inbox')) {
        await sendInbox(userId, email, headline.slice(0, 160), note.slice(0, 600), href, dedupe, 'info')
      }
      if (channels.includes('email') && email) {
        const ctaUrl = staff
          ? wwPortalUrl('/')
          : appGetawayUrl(`/dashboard/getaway/${slug}`)
        await sendWwTripAnnouncementEmail({
          to: email,
          name,
          tripTitle: trip.title,
          headline,
          body: note,
          ctaUrl,
          ctaLabel: staff ? 'Open WanderWorld' : 'View trip',
        })
      }
      break
    }
    case 'promoter_attribution': {
      const promoterEmail = String(opts.payload.promoterEmail || email || '').trim().toLowerCase()
      if (!promoterEmail || !reg) return
      const amount = opts.payload.amountInr ?? inst?.amountInr ?? 0
      const dedupe = `ww-ref:${reg.id}:${inst?.id || 'booking'}`
      const promoterId = resolveUserId(opts.payload.promoterUserId, promoterEmail)
      if (channels.includes('inbox')) {
        await sendInbox(
          promoterId,
          promoterEmail,
          `New booking via your link`,
          `${reg.buyerName || reg.buyerEmail} paid ₹${amount.toLocaleString('en-IN')} on ${tripTitle}.`,
          '/',
          dedupe,
          'success',
        )
      }
      if (channels.includes('email')) {
        await sendWwPromoterAttributionEmail({
          to: promoterEmail,
          buyerName: reg.buyerName,
          tripTitle,
          amountInr: amount,
          portalUrl: wwPortalUrl('/'),
        })
      }
      break
    }
    case 'cash_recorded': {
      if (!reg || !inst) return
      const promoterEmail = String(opts.payload.promoterEmail || email || '').trim().toLowerCase()
      if (!promoterEmail) return
      const dedupe = `ww-cash:${inst.id}`
      const promoterId = resolveUserId(opts.payload.promoterUserId, promoterEmail)
      if (channels.includes('inbox')) {
        await sendInbox(
          promoterId,
          promoterEmail,
          `Cash recorded — ${tripTitle}`,
          `₹${inst.amountInr.toLocaleString('en-IN')} cash recorded for ${reg.buyerName}.${opts.payload.cashNote ? ` Note: ${opts.payload.cashNote}` : ''}`,
          '/',
          dedupe,
          'success',
        )
      }
      if (channels.includes('email')) {
        await sendWwCashRecordedEmail({
          to: promoterEmail,
          buyerName: reg.buyerName,
          tripTitle,
          amountInr: inst.amountInr,
          note: opts.payload.cashNote,
          portalUrl: wwPortalUrl('/'),
        })
      }
      break
    }
    case 'chat_message': {
      if (!trip) return
      const slug = trip.slug
      const staff = Boolean(opts.payload.isStaffRecipient)
      const href = staff
        ? `/?chat=${encodeURIComponent(slug)}`
        : `/dashboard/getaway/chat/${slug}`
      const preview =
        opts.payload.messagePreview ||
        opts.payload.updateNote ||
        'New message in your trip group chat'
      const sender = opts.payload.senderName || 'Someone'
      const dedupe = `ww-chat:${opts.payload.chatMessageId || trip.id}:${userId}`
      const inboxTitle = `New group message — ${trip.title}`
      const inboxBody = `${sender}: ${preview}`
      if (channels.includes('inbox')) {
        await sendInbox(userId, email, inboxTitle, inboxBody, href, dedupe, 'info')
      }
      if (channels.includes('email') && email) {
        const chatUrl = staff
          ? wwPortalUrl(`/?chat=${encodeURIComponent(slug)}`)
          : appGetawayUrl(`/dashboard/getaway/chat/${slug}`)
        await sendWwChatMessageEmail({
          to: email,
          name: firstName(null, email),
          tripTitle: trip.title,
          senderName: sender,
          preview,
          chatUrl,
        })
      }
      break
    }
  }
}

export async function notifyWwPaymentSuccess(opts: {
  registration: WwRegistration
  installment: WwInstallment
  trip: WwTrip
  promoterEmail?: string | null
  promoterUserId?: string | null
}) {
  const payUserId = opts.installment.claimedByUserId || opts.registration.userId
  const payEmail = opts.installment.claimedByEmail || opts.registration.buyerEmail
  await communicateWwEvent({
    event: 'payment_received',
    userId: payUserId.startsWith('group:') ? payEmail : payUserId,
    email: payEmail,
    payload: {
      registration: opts.registration,
      installment: opts.installment,
      trip: opts.trip,
      amountInr: opts.installment.amountInr,
      promoterEmail: opts.promoterEmail,
      promoterUserId: opts.promoterUserId,
    },
  })
}
