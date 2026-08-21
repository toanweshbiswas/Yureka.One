import { sendMail } from './transport.js'
import { brandedEmail, mailUrls } from './layout.js'
import { spendFromMetrics } from '@shared/scoreMetrics'

function firstName(fullName?: string | null) {
  const n = (fullName || '').trim()
  return n ? n.split(/\s+/)[0] : 'there'
}

export async function sendAdminInviteEmail(opts: {
  to: string
  role: string
  inviteUrl: string
  invitedBy?: string | null
  expiresHours: number
  firstName?: string | null
}) {
  const name = firstName(opts.firstName)
  const inviter = (opts.invitedBy || '').trim()
  const who = inviter ? `${inviter} invited you` : 'You have been invited'
  const { html } = brandedEmail({
    preheader: `${who} to the Yureka admin console`,
    heading: 'Set your admin password',
    bodyHtml: `
      <p style="color:#444;line-height:1.55">Hi ${name},</p>
      <p style="color:#444;line-height:1.55">${who} as <strong>${opts.role}</strong> on the Yureka backoffice. Choose a password to open the dashboard — this link expires in ${opts.expiresHours} hours.</p>
    `,
    ctaLabel: 'Set password & open dashboard',
    ctaUrl: opts.inviteUrl,
    footerNote: `If the button does not work, open: ${opts.inviteUrl}`,
  })
  return sendMail({
    to: opts.to,
    subject: 'Set your Yureka admin password',
    text: `Hi ${name},\n\n${who} as ${opts.role}.\n\nSet your password here:\n${opts.inviteUrl}\n\nThis link expires in ${opts.expiresHours} hours.\n\n— Team Yureka`,
    html,
    replyTo: 'support@yureka.one',
  })
}

export async function sendWaitlistReceivedEmail(opts: { to: string; fullName?: string | null }) {
  const name = firstName(opts.fullName)
  const urls = mailUrls()
  const { html } = brandedEmail({
    preheader: 'We received your Yureka waitlist application',
    heading: "You're on the list",
    bodyHtml: `
      <p style="color:#444;line-height:1.55">Hi ${name},</p>
      <p style="color:#444;line-height:1.55">We received your Yureka.One application. We'll email you at this address when you're approved — then you can sign in with Gmail and open the app.</p>
    `,
    ctaLabel: 'Check your status',
    ctaUrl: `${urls.app}/waiting`,
  })
  return sendMail({
    to: opts.to,
    subject: "You're on the Yureka waitlist",
    text: `Hi ${name},\n\nWe received your Yureka.One application. We'll email you when you're approved.\n\n— Team Yureka`,
    html,
    replyTo: 'support@yureka.one',
  })
}

export async function sendApprovalEmail(opts: { to: string; fullName?: string | null }) {
  const name = firstName(opts.fullName)
  const urls = mailUrls()
  const { html } = brandedEmail({
    preheader: 'Your Yureka.One access is approved',
    heading: "You're in",
    bodyHtml: `
      <p style="color:#444;line-height:1.55">Hi ${name},</p>
      <p style="color:#444;line-height:1.55">Your waitlist application was accepted. Sign in with Gmail or your email and password to open your dashboard — Goldback, expenses, and offers are waiting.</p>
    `,
    ctaLabel: 'Open your dashboard',
    ctaUrl: urls.appLogin,
    footerNote: `Or open: ${urls.appLogin}`,
  })
  return sendMail({
    to: opts.to,
    subject: "You're in — Yureka.One access approved",
    text: `Hi ${name},\n\nYou're approved for Yureka.One.\n\nSign in with Gmail or email + password:\n${urls.appLogin}\n\n— Team Yureka`,
    html,
    replyTo: 'support@yureka.one',
  })
}

export async function sendAccountReadyEmail(opts: {
  to: string
  fullName?: string | null
  invitedBy?: string | null
}) {
  const name = firstName(opts.fullName)
  const urls = mailUrls()
  const inviter = (opts.invitedBy || '').trim()
  const who = inviter ? `${inviter} created your account` : 'Your Yureka account is ready'
  const { html } = brandedEmail({
    preheader: `${who} — sign in with email and password`,
    heading: 'Your account is ready',
    bodyHtml: `
      <p style="color:#444;line-height:1.55">Hi ${name},</p>
      <p style="color:#444;line-height:1.55">${who}. Sign in with this email and the password you were given — your access is already approved.</p>
    `,
    ctaLabel: 'Sign in',
    ctaUrl: urls.appLogin,
    footerNote: `Or open: ${urls.appLogin}`,
  })
  return sendMail({
    to: opts.to,
    subject: 'Your Yureka.One account is ready',
    text: `Hi ${name},\n\n${who}. Sign in with this email and the password you were given:\n${urls.appLogin}\n\n— Team Yureka`,
    html,
    replyTo: 'support@yureka.one',
  })
}

export async function sendUserInviteEmail(opts: {
  to: string
  fullName?: string | null
  invitedBy?: string | null
}) {
  const name = firstName(opts.fullName)
  const urls = mailUrls()
  const signupUrl = `${urls.app}/signup`
  const inviter = (opts.invitedBy || '').trim()
  const who = inviter ? `${inviter} invited you` : 'You have been invited'
  const { html } = brandedEmail({
    preheader: `${who} to Yureka.One`,
    heading: "You're invited to Yureka",
    bodyHtml: `
      <p style="color:#444;line-height:1.55">Hi ${name},</p>
      <p style="color:#444;line-height:1.55">${who} to the Yureka app. Create an account with this email, set a password, then sign in. Your access is already approved.</p>
    `,
    ctaLabel: 'Create your account',
    ctaUrl: signupUrl,
    footerNote: `Already have a password? Sign in: ${urls.appLogin}`,
  })
  return sendMail({
    to: opts.to,
    subject: "You're invited to Yureka.One",
    text: `Hi ${name},\n\n${who} to Yureka.One. Create an account with this email:\n${signupUrl}\n\nThen sign in: ${urls.appLogin}\n\n— Team Yureka`,
    html,
    replyTo: 'support@yureka.one',
  })
}

export async function sendBrandInviteEmail(opts: {
  to: string
  brandName: string
  invitedBy?: string | null
}) {
  const urls = mailUrls()
  const signupUrl = `${urls.brandSignup}?email=${encodeURIComponent(opts.to)}`
  const inviter = (opts.invitedBy || '').trim()
  const who = inviter ? `${inviter} invited you` : 'You have been invited'
  const { html } = brandedEmail({
    preheader: `${who} to the ${opts.brandName} brand portal`,
    heading: `Join ${opts.brandName} on Yureka`,
    bodyHtml: `
      <p style="color:#444;line-height:1.55">Hi there,</p>
      <p style="color:#444;line-height:1.55">${who} to publish offers for <strong>${opts.brandName}</strong> and see how members interact with them. Create an account with this email, then sign in to the brand portal.</p>
    `,
    ctaLabel: 'Open brand portal',
    ctaUrl: signupUrl,
    footerNote: `Already have a password? Sign in: ${urls.brandLogin}`,
  })
  return sendMail({
    to: opts.to,
    subject: `You're invited to the ${opts.brandName} brand portal`,
    text: `Hi,\n\n${who} to the ${opts.brandName} brand portal on Yureka.\nCreate an account:\n${signupUrl}\n\nThen sign in: ${urls.brandLogin}\n\n— Team Yureka`,
    html,
    replyTo: 'support@yureka.one',
  })
}

export async function sendWaitlistRejectedEmail(opts: { to: string; fullName?: string | null }) {
  const name = firstName(opts.fullName)
  const urls = mailUrls()
  const { html } = brandedEmail({
    preheader: 'An update on your Yureka application',
    heading: 'Application update',
    bodyHtml: `
      <p style="color:#444;line-height:1.55">Hi ${name},</p>
      <p style="color:#444;line-height:1.55">Thanks for applying to Yureka.One. We're not able to offer access right now. You can reply to this email if you have questions.</p>
    `,
    ctaLabel: 'Visit Yureka',
    ctaUrl: urls.landing,
  })
  return sendMail({
    to: opts.to,
    subject: 'Update on your Yureka.One application',
    text: `Hi ${name},\n\nThanks for applying to Yureka.One. We're not able to offer access right now.\n\n— Team Yureka`,
    html,
    replyTo: 'support@yureka.one',
  })
}

export async function sendScoreReadyEmail(opts: {
  to: string
  fullName?: string | null
  score: number
  decision?: string
  metrics?: Record<string, unknown> | null
}) {
  const name = firstName(opts.fullName)
  const urls = mailUrls()
  const decision = opts.decision ? ` · ${opts.decision}` : ''
  const { avgMonthly, spendTotal } = spendFromMetrics(opts.metrics)
  const orders = Number(opts.metrics?.orders_6m)
  const breakdown: string[] = []
  if (avgMonthly > 0) breakdown.push(`Avg monthly spend: ₹${Math.round(avgMonthly).toLocaleString('en-IN')}`)
  if (spendTotal > 0) breakdown.push(`Total spend (6 months): ₹${Math.round(spendTotal).toLocaleString('en-IN')}`)
  if (Number.isFinite(orders) && orders > 0) breakdown.push(`Orders (6 months): ${Math.round(orders)}`)
  const breakdownHtml = breakdown.length
    ? `<ul style="color:#444;line-height:1.6;padding-left:20px;margin:16px 0">${breakdown.map((line) => `<li>${line}</li>`).join('')}</ul>`
    : ''
  const breakdownText = breakdown.length ? `\n\n${breakdown.join('\n')}` : ''
  const { html } = brandedEmail({
    preheader: `Your Yureka Score is ${opts.score}/100`,
    heading: 'Your Yureka Score is ready',
    bodyHtml: `
      <p style="color:#444;line-height:1.55">Hi ${name},</p>
      <p style="color:#444;line-height:1.55">We finished analysing your inbox. Your <strong>Yureka Score</strong> is <strong>${opts.score}/100</strong>${decision}.</p>
      ${breakdownHtml}
      <p style="color:#444;line-height:1.55">Open your dashboard to see the full spending breakdown and start earning Goldback.</p>
    `,
    ctaLabel: 'See your breakdown',
    ctaUrl: urls.appDashboard,
  })
  return sendMail({
    to: opts.to,
    subject: `Your Yureka Score is ready: ${opts.score}/100`,
    text: `Hi ${name},\n\nYour Yureka Score is ${opts.score}/100${decision}.${breakdownText}\n\nOpen your dashboard: ${urls.appDashboard}\n\n— Team Yureka`,
    html,
    replyTo: 'support@yureka.one',
  })
}

export async function sendAppUpdateEmail(opts: {
  to: string
  fullName?: string | null
  title: string
  body: string
  ctaLabel?: string
  ctaUrl?: string
}) {
  const name = firstName(opts.fullName)
  const urls = mailUrls()
  const { html } = brandedEmail({
    preheader: opts.title,
    heading: opts.title,
    bodyHtml: `
      <p style="color:#444;line-height:1.55">Hi ${name},</p>
      <p style="color:#444;line-height:1.55">${opts.body}</p>
    `,
    ctaLabel: opts.ctaLabel || 'Open Yureka',
    ctaUrl: opts.ctaUrl || urls.appDashboard,
  })
  return sendMail({
    to: opts.to,
    subject: opts.title,
    text: `Hi ${name},\n\n${opts.body}\n\n${opts.ctaUrl || urls.appDashboard}\n\n— Team Yureka`,
    html,
    replyTo: 'support@yureka.one',
  })
}

export async function sendBlogPublishedEmail(opts: {
  to: string
  fullName?: string | null
  title: string
  excerpt?: string | null
  url: string
}) {
  const name = firstName(opts.fullName)
  const excerpt = (opts.excerpt || '').trim()
  const { html } = brandedEmail({
    preheader: `New on the Yureka blog: ${opts.title}`,
    heading: 'New on the blog',
    bodyHtml: `
      <p style="color:#444;line-height:1.55">Hi ${name},</p>
      <p style="color:#444;line-height:1.55">We just published a new piece: <strong>${opts.title}</strong>.</p>
      ${excerpt ? `<p style="color:#666;line-height:1.55">${excerpt}</p>` : ''}
    `,
    ctaLabel: 'Read the article',
    ctaUrl: opts.url,
    footerNote: `Or open: ${opts.url}`,
  })
  return sendMail({
    to: opts.to,
    subject: `New on Yureka: ${opts.title}`,
    text: `Hi ${name},\n\nWe just published: ${opts.title}\n\n${excerpt ? `${excerpt}\n\n` : ''}${opts.url}\n\n— Team Yureka`,
    html,
    replyTo: 'support@yureka.one',
  })
}

export async function sendGiftCardRecipientEmail(opts: {
  to: string
  recipientName?: string | null
  senderName?: string | null
  productTitle: string
  amountInr: number
  giftMessage?: string | null
  vouchers: Array<{ cardNumber?: string | null; cardPin?: string | null; validTill?: string | null }>
}) {
  const name = firstName(opts.recipientName)
  const sender = (opts.senderName || 'Someone').trim() || 'Someone'
  const amount = `₹${Number(opts.amountInr || 0).toLocaleString('en-IN')}`
  const message = (opts.giftMessage || '').trim()
  const voucherBlocks = (opts.vouchers || [])
    .map((v, i) => {
      const lines = [
        v.cardNumber ? `Card number: ${v.cardNumber}` : null,
        v.cardPin ? `PIN: ${v.cardPin}` : null,
        v.validTill ? `Valid till: ${v.validTill}` : null,
      ].filter(Boolean)
      if (!lines.length) return null
      return `<p style="color:#111;line-height:1.55;margin:12px 0 0;padding:12px 14px;background:#f4f4f4;border-radius:12px"><strong>Voucher ${i + 1}</strong><br/>${lines.join('<br/>')}</p>`
    })
    .filter(Boolean)
    .join('')

  const textVouchers = (opts.vouchers || [])
    .map((v, i) => {
      const lines = [
        v.cardNumber ? `Card number: ${v.cardNumber}` : null,
        v.cardPin ? `PIN: ${v.cardPin}` : null,
        v.validTill ? `Valid till: ${v.validTill}` : null,
      ].filter(Boolean)
      return lines.length ? `Voucher ${i + 1}\n${lines.join('\n')}` : null
    })
    .filter(Boolean)
    .join('\n\n')

  const { html } = brandedEmail({
    preheader: `${sender} sent you a ${opts.productTitle} gift card`,
    heading: 'You received a gift card',
    bodyHtml: `
      <p style="color:#444;line-height:1.55">Hi ${name},</p>
      <p style="color:#444;line-height:1.55"><strong>${sender}</strong> sent you a <strong>${opts.productTitle}</strong> gift card worth <strong>${amount}</strong> via Yureka.</p>
      ${message ? `<p style="color:#444;line-height:1.55;padding:12px 14px;background:#f7faf8;border-left:3px solid #00933b;border-radius:8px">“${message.replace(/</g, '&lt;')}”</p>` : ''}
      ${voucherBlocks || '<p style="color:#666;line-height:1.55">Your voucher details will follow shortly from the sender if they are not shown above.</p>'}
    `,
    footerNote: 'Keep this email private — anyone with the card number and PIN can redeem the balance.',
  })

  return sendMail({
    to: opts.to,
    subject: `${sender} sent you a ${opts.productTitle} gift card`,
    text: `Hi ${name},\n\n${sender} sent you a ${opts.productTitle} gift card worth ${amount} via Yureka.\n${message ? `\nMessage: ${message}\n` : ''}\n${textVouchers || 'Voucher details will follow from the sender.'}\n\n— Team Yureka`,
    html,
    replyTo: 'support@yureka.one',
  })
}

export async function sendGiftCardSenderConfirmationEmail(opts: {
  to: string
  senderName?: string | null
  recipientName?: string | null
  recipientEmail: string
  productTitle: string
  amountInr: number
  orderUrl: string
}) {
  const name = firstName(opts.senderName)
  const recipient = (opts.recipientName || opts.recipientEmail).trim()
  const amount = `₹${Number(opts.amountInr || 0).toLocaleString('en-IN')}`
  const { html } = brandedEmail({
    preheader: `Gift card sent to ${recipient}`,
    heading: 'Gift card delivered',
    bodyHtml: `
      <p style="color:#444;line-height:1.55">Hi ${name},</p>
      <p style="color:#444;line-height:1.55">Your <strong>${opts.productTitle}</strong> gift card (${amount}) was emailed to <strong>${recipient}</strong> (${opts.recipientEmail}).</p>
    `,
    ctaLabel: 'View order',
    ctaUrl: opts.orderUrl,
    footerNote: `Or open: ${opts.orderUrl}`,
  })
  return sendMail({
    to: opts.to,
    subject: `Gift card sent to ${recipient}`,
    text: `Hi ${name},\n\nYour ${opts.productTitle} gift card (${amount}) was emailed to ${recipient} (${opts.recipientEmail}).\n\nView order:\n${opts.orderUrl}\n\n— Team Yureka`,
    html,
    replyTo: 'support@yureka.one',
  })
}
