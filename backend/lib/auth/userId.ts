import type { Request } from 'express'

export type ProductIdentity = { userId: string; email: string | null }

type Cached =
  | { kind: 'ok'; identity: ProductIdentity }
  | { kind: 'none' }
  | { kind: 'pending'; promise: Promise<ProductIdentity | null> }

const identityCache = new WeakMap<Request, Cached>()

/** Decode JWT payload without verifying signature (dev / fallback only). */
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

function emailFromPayload(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null
  const email =
    typeof payload.email === 'string'
      ? payload.email.trim().toLowerCase()
      : typeof (payload as any).user_metadata?.email === 'string'
        ? String((payload as any).user_metadata.email).trim().toLowerCase()
        : ''
  if (email && email.includes('@')) return email
  return null
}

function bearerToken(req: Request): string | null {
  const auth = (req.header('authorization') || '').trim()
  if (!auth.toLowerCase().startsWith('bearer ')) return null
  const token = auth.slice(7).trim()
  return token || null
}

function allowHeaderUserId(): boolean {
  if (process.env.ALLOW_HEADER_USER_ID === 'true') return true
  if (process.env.ALLOW_HEADER_USER_ID === 'false') return false
  return process.env.NODE_ENV !== 'production'
}

async function verifySupabaseBearer(token: string): Promise<ProductIdentity | null> {
  try {
    const { getServiceClient } = await import('./supabaseAdmin.js')
    const sb = getServiceClient()
    const { data, error } = await sb.auth.getUser(token)
    if (error || !data.user) return null
    const email = String(data.user.email || '').trim().toLowerCase()
    const userId = String(data.user.id || '').trim()
    if (!userId) return null
    return {
      userId,
      email: email && email.includes('@') ? email : null,
    }
  } catch {
    return null
  }
}

function identityFromDevHeaders(req: Request): ProductIdentity | null {
  if (!allowHeaderUserId()) return null

  const header = (req.header('x-user-id') || '').trim()
  if (header && header !== 'demo-user') {
    return {
      userId: header,
      email: header.includes('@') ? header.toLowerCase() : null,
    }
  }

  const q = typeof req.query.userId === 'string' ? req.query.userId.trim() : ''
  if (q && q !== 'demo-user') {
    return {
      userId: q,
      email: q.includes('@') ? q.toLowerCase() : null,
    }
  }

  const bodyId = typeof (req.body as any)?.userId === 'string' ? (req.body as any).userId.trim() : ''
  if (bodyId && bodyId !== 'demo-user') {
    return {
      userId: bodyId,
      email: bodyId.includes('@') ? bodyId.toLowerCase() : null,
    }
  }

  const token = bearerToken(req)
  if (token) {
    const payload = decodeJwtPayload(token)
    const sub = typeof payload?.sub === 'string' ? payload.sub.trim() : ''
    const email = emailFromPayload(payload)
    if (sub) return { userId: sub, email }
    if (email) return { userId: email, email }
  }

  return null
}

async function resolveVerifiedIdentityUncached(req: Request): Promise<ProductIdentity | null> {
  const token = bearerToken(req)
  if (token) {
    const verified = await verifySupabaseBearer(token)
    if (verified) return verified
    // Forged / expired Bearer must not fall through to decoded payload in production.
    if (!allowHeaderUserId()) return null
  }

  return identityFromDevHeaders(req)
}

/**
 * Verified product identity (Supabase Auth getUser). Cached per request.
 * Never trusts unsigned JWT payloads in production.
 */
export async function resolveVerifiedIdentity(req: Request): Promise<ProductIdentity | null> {
  const cached = identityCache.get(req)
  if (cached?.kind === 'ok') return cached.identity
  if (cached?.kind === 'none') return null
  if (cached?.kind === 'pending') return cached.promise

  const promise = resolveVerifiedIdentityUncached(req).then((identity) => {
    identityCache.set(req, identity ? { kind: 'ok', identity } : { kind: 'none' })
    return identity
  })
  identityCache.set(req, { kind: 'pending', promise })
  return promise
}

/**
 * @deprecated Prefer resolveVerifiedIdentity. Sync path only returns a previously
 * verified identity from this request's cache (never decodes forged JWTs).
 */
export function resolveProductUserId(req: Request): string | null {
  const cached = identityCache.get(req)
  if (cached?.kind === 'ok') return cached.identity.userId
  if (allowHeaderUserId()) {
    return identityFromDevHeaders(req)?.userId ?? null
  }
  return null
}

/**
 * Email for the request. Prefer calling after resolveVerifiedIdentity / productUserIdOrFail
 * so production uses the verified cache.
 */
export function resolveRequestEmail(req: Request): string | null {
  const cached = identityCache.get(req)
  if (cached?.kind === 'ok') return cached.identity.email
  if (allowHeaderUserId()) return identityFromDevHeaders(req)?.email ?? null
  return null
}

export async function requireAuthEmail(
  req: Request
): Promise<{ email: string; userId?: string } | { error: string; status: number }> {
  const identity = await resolveVerifiedIdentity(req)
  if (identity?.email) return { email: identity.email, userId: identity.userId }
  return { error: 'Authentication required', status: 401 }
}

export async function productUserIdOrFail(
  req: Request
): Promise<{ userId: string; email: string | null } | { error: string }> {
  const identity = await resolveVerifiedIdentity(req)
  if (identity) return identity

  const allowDemo =
    process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEMO_USER === 'true'

  if (allowDemo && allowHeaderUserId()) return { userId: 'demo-user', email: null }
  return { error: 'Authentication required (missing user identity)' }
}
