import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

export type MailTransport = {
  transporter: Transporter | null
  from: string
  provider: string
  skipped?: string
}

let cached: { transporter: Transporter; from: string; provider: string } | null = null

function fromAddress(): string {
  const email = (process.env.MAIL_FROM_EMAIL || '').trim() || 'support@yureka.one'
  const name = (process.env.MAIL_FROM_NAME || '').trim() || 'Yureka One'
  return `"${name}" <${email}>`
}

/**
 * Resolution order matters: Resend/SMTP can send as support@yureka.one, while
 * Gmail can only send as the authenticated mailbox. Gmail stays last so older
 * deployments keep working until their env is migrated.
 */
export function getMailTransport(): MailTransport {
  if (cached) return { ...cached }

  const from = fromAddress()
  const resendKey = (process.env.RESEND_API_KEY || '').trim()
  const smtpHost = (process.env.SMTP_HOST || '').trim()
  const gmailUser = (process.env.GMAIL_USER || '').trim()
  const gmailPass = (process.env.GMAIL_APP_PASSWORD || '').trim()

  if (resendKey) {
    cached = {
      provider: 'resend',
      from,
      transporter: nodemailer.createTransport({
        host: 'smtp.resend.com',
        port: 465,
        secure: true,
        auth: { user: 'resend', pass: resendKey },
      }),
    }
    return { ...cached }
  }

  if (smtpHost) {
    const port = Number(process.env.SMTP_PORT || 587)
    cached = {
      provider: `smtp:${smtpHost}`,
      from,
      transporter: nodemailer.createTransport({
        host: smtpHost,
        port,
        secure: port === 465,
        auth: {
          user: (process.env.SMTP_USER || '').trim(),
          pass: (process.env.SMTP_PASSWORD || '').trim(),
        },
      }),
    }
    return { ...cached }
  }

  if (gmailUser && gmailPass) {
    cached = {
      provider: 'gmail',
      // Gmail rewrites mismatched senders, so authenticate and send as the same box.
      from: `"${(process.env.MAIL_FROM_NAME || 'Yureka One').trim()}" <${gmailUser}>`,
      transporter: nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailUser, pass: gmailPass.replace(/\s+/g, '') },
      }),
    }
    return { ...cached }
  }

  return { transporter: null, from, provider: 'none', skipped: 'No mail provider configured (set RESEND_API_KEY)' }
}

export async function sendMail(opts: {
  to: string
  subject: string
  text?: string
  html?: string
  replyTo?: string
}): Promise<{ sent: boolean; skipped?: string; error?: string; messageId?: string }> {
  const mail = getMailTransport()
  if (!mail.transporter) return { sent: false, skipped: mail.skipped }

  try {
    const info = await mail.transporter.sendMail({
      from: mail.from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      replyTo: opts.replyTo,
    })
    return { sent: true, messageId: info.messageId }
  } catch (e: any) {
    console.error(`[mail] send failed via ${mail.provider}:`, e?.message || e)
    return { sent: false, error: e?.message || 'Failed to send email' }
  }
}
