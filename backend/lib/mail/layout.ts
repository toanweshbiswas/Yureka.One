function appOrigin(): string {
  return (
    (process.env.APP_ORIGIN || process.env.FRONTEND_URL || process.env.PUBLIC_APP_URL || '').trim() ||
    'https://app.yureka.one'
  ).replace(/\/$/, '')
}

function adminOrigin(): string {
  return (
    (process.env.VITE_ADMIN_PORTAL_URL || '').trim() || 'https://admin.yureka.one'
  ).replace(/\/$/, '')
}

function landingOrigin(): string {
  return (process.env.VITE_LANDING_URL || '').trim().replace(/\/$/, '') || 'https://yureka.one'
}

export function mailUrls() {
  return {
    app: appOrigin(),
    admin: adminOrigin(),
    landing: landingOrigin(),
    appLogin: `${appOrigin()}/login?next=${encodeURIComponent('/dashboard')}`,
    appDashboard: `${appOrigin()}/dashboard`,
    adminLogin: `${adminOrigin()}/admin`,
  }
}

export function brandedEmail(opts: {
  preheader?: string
  heading: string
  bodyHtml: string
  ctaLabel?: string
  ctaUrl?: string
  footerNote?: string
}): { html: string } {
  const preheader = opts.preheader
    ? `<span style="display:none;max-height:0;overflow:hidden">${opts.preheader}</span>`
    : ''
  const cta = opts.ctaUrl
    ? `<p style="margin:28px 0">
        <a href="${opts.ctaUrl}" style="background:#00933b;color:#fff;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:700;display:inline-block">
          ${opts.ctaLabel || 'Open Yureka'}
        </a>
      </p>`
    : ''
  return {
    html: `
      ${preheader}
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;color:#111;padding:8px">
        <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#00933b;font-weight:700;margin:0 0 16px">Yureka.One</p>
        <h1 style="font-size:22px;margin:0 0 12px;letter-spacing:-0.03em">${opts.heading}</h1>
        ${opts.bodyHtml}
        ${cta}
        ${opts.footerNote ? `<p style="color:#888;font-size:13px;line-height:1.5">${opts.footerNote}</p>` : ''}
        <p style="color:#bbb;font-size:12px;margin-top:32px">— Team Yureka · <a href="mailto:support@yureka.one" style="color:#888">support@yureka.one</a></p>
      </div>
    `,
  }
}
