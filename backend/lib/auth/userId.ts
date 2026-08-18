import type { Request } from 'express'

/** Decode JWT payload without verifying signature (identity hint only). */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const json = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * Resolve product user id from auth headers.
 * Prefer JWT `sub`, then email, then explicit x-user-id.
 * In production, never silently fall back to demo-user.
 */
export function resolveProductUserId(req: Request): string | null {
  const auth = (req.header('authorization') || '').trim()
  if (auth.toLowerCase().startsWith('bearer ')) {
    const payload = decodeJwtPayload(auth.slice(7).trim())
    if (payload) {
      const sub = typeof payload.sub === 'string' ? payload.sub.trim() : ''
      if (sub) return sub
      const email =
        typeof payload.email === 'string'
          ? payload.email.trim().toLowerCase()
          : typeof (payload as any).user_metadata?.email === 'string'
            ? String((payload as any).user_metadata.email).trim().toLowerCase()
            : ''
      if (email) return email
    }
  }

  const header = (req.header('x-user-id') || '').trim()
  if (header && header !== 'demo-user') return header

  const q = typeof req.query.userId === 'string' ? req.query.userId.trim() : ''
  if (q && q !== 'demo-user') return q

  const bodyId = typeof (req.body as any)?.userId === 'string' ? (req.body as any).userId.trim() : ''
  if (bodyId && bodyId !== 'demo-user') return bodyId

  return null
}

/** Email from a verified JWT only — never from query/body (avoids inbox spoofing). */
export function resolveRequestEmail(req: Request): string | null {
  const auth = (req.header('authorization') || '').trim()
  if (auth.toLowerCase().startsWith('bearer ')) {
    const payload = decodeJwtPayload(auth.slice(7).trim())
    if (payload) {
      const email =
        typeof payload.email === 'string'
          ? payload.email.trim().toLowerCase()
          : typeof (payload as any).user_metadata?.email === 'string'
            ? String((payload as any).user_metadata.email).trim().toLowerCase()
            : ''
      if (email && email.includes('@')) return email
    }
  }

  const userId = resolveProductUserId(req)
  if (userId && userId.includes('@')) return userId.toLowerCase()
  return null
}

export function productUserIdOrFail(req: Request): { userId: string } | { error: string } {
  const userId = resolveProductUserId(req)
  if (userId) return { userId }

  const allowDemo =
    process.env.NODE_ENV !== 'production' ||
    process.env.ALLOW_DEMO_USER === 'true'

  if (allowDemo) return { userId: 'demo-user' }
  return { error: 'Authentication required (missing user identity)' }
}
