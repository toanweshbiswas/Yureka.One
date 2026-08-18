import crypto from 'crypto'

export type AdminRole = 'viewer' | 'admin' | 'superadmin'

export interface AdminSession {
  email: string
  role: AdminRole
  exp: number
}

function secret() {
  const s = process.env.ADMIN_SESSION_SECRET || process.env.GOOGLE_CLIENT_SECRET
  if (s) return s
  if (process.env.NODE_ENV !== 'production') return 'dev-only-admin-session'
  throw new Error('ADMIN_SESSION_SECRET must be set in production')
}

export function createAdminToken(email: string, role: AdminRole, ttlHours = 24): string {
  const payload: AdminSession = {
    email: email.toLowerCase(),
    role,
    exp: Date.now() + ttlHours * 3600_000,
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyAdminToken(token: string | undefined | null): AdminSession | null {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url')
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  } catch {
    return null
  }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')) as AdminSession
    if (!payload?.email || !payload?.exp || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export function adminPasswordOk(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) return false
  const a = Buffer.from(password)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `scrypt$${salt}$${hash}`
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false
  const [scheme, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const computed = crypto.scryptSync(password, salt, 64).toString('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computed, 'hex'))
  } catch {
    return false
  }
}

export function newInviteToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function hashInviteToken(token: string): string {
  const key = process.env.ADMIN_INVITE_SECRET || secret()
  return crypto.createHmac('sha256', key).update(token).digest('hex')
}

export function inviteTtlHours(): number {
  const n = Number(process.env.ADMIN_INVITE_TTL_HOURS || 72)
  return Number.isFinite(n) && n > 0 ? n : 72
}

export function passwordMeetsPolicy(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters'
  if (password.length > 128) return 'Password is too long'
  return null
}
