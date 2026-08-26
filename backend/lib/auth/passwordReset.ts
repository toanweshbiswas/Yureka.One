import { getServiceClient } from './supabaseAdmin.js'
import { brandedEmail, mailUrls } from '../mail/layout.js'
import { sendMail } from '../mail/transport.js'
import { normalizeEmail } from '../mail/emailAddress.js'

function resetRedirectBase(redirectTo?: string) {
  const urls = mailUrls()
  if (redirectTo && /^https?:\/\//i.test(redirectTo)) {
    try {
      const u = new URL(redirectTo)
      // Only allow our app / brand hosts (or localhost for dev).
      const host = u.hostname.toLowerCase()
      const allowed =
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host.endsWith('.yureka.one') ||
        host === 'yureka.one'
      if (allowed) {
        return `${u.origin}${u.pathname.startsWith('/brand') ? u.pathname : '/reset-password'}`
      }
    } catch {
      /* fall through */
    }
  }
  return `${urls.app}/reset-password`
}

/**
 * Send a recovery email with `token_hash` so the link works in any browser.
 * Supabase's default PKCE `?code=` links require the same browser that requested
 * the reset. email clients / phone browsers burn those and show "expired".
 */
export async function sendAppPasswordResetEmail(opts: {
  email: string
  redirectTo?: string
}): Promise<{ sent: boolean; skipped?: string }> {
  const email = normalizeEmail(opts.email)
  if (!email) throw new Error('Valid email is required')

  const redirectBase = resetRedirectBase(opts.redirectTo)
  const sb = getServiceClient()

  const generated = await sb.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: redirectBase },
  })

  if (generated.error) {
    // Don't leak whether the account exists.
    const msg = String(generated.error.message || '').toLowerCase()
    if (msg.includes('user not found') || msg.includes('unable to find')) {
      return { sent: false, skipped: 'unknown_user' }
    }
    throw new Error(generated.error.message || 'Failed to create reset link')
  }

  const hashed =
    generated.data.properties?.hashed_token ||
    (generated.data as { properties?: { hashed_token?: string } }).properties?.hashed_token

  if (!hashed) {
    throw new Error('Reset token missing from auth provider response')
  }

  const resetUrl = `${redirectBase}?token_hash=${encodeURIComponent(hashed)}&type=recovery`
  const { html } = brandedEmail({
    preheader: 'Reset your Yureka password',
    heading: 'Reset your password',
    bodyHtml: `
      <p style="line-height:1.6;margin:0 0 12px">We received a request to reset the password for <strong>${email}</strong>.</p>
      <p style="line-height:1.6;margin:0 0 12px">This link works in any browser and expires soon. If you did not request it, you can ignore this email.</p>
    `,
    ctaLabel: 'Choose a new password',
    ctaUrl: resetUrl,
    footerNote: 'For security, request a fresh link from the login page if this one stops working.',
  })

  const result = await sendMail({
    to: email,
    subject: 'Reset your Yureka password',
    html,
  })

  if (!result.sent) {
    throw new Error(result.error || result.skipped || 'Failed to send reset email')
  }

  return { sent: true }
}
