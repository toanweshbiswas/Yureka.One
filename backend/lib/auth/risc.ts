import crypto from 'crypto'
import { createRemoteJWKSet, compactVerify } from 'jose'
import {
  findAuthUserByEmail,
  findAuthUserByGoogleSub,
  signOutAllSessions,
} from './supabaseAdmin.js'
import {
  listAllLedgerConnections,
  revokeAllLedgerConnectionsForUser,
  revokeLedgerConnection,
  revokeLedgerConnectionsByGmail,
} from '../ledger/connections.js'

const RISC_DISCOVERY = 'https://accounts.google.com/.well-known/risc-configuration'

export const RISC_EVENT_TYPES = [
  'https://schemas.openid.net/secevent/risc/event-type/sessions-revoked',
  'https://schemas.openid.net/secevent/oauth/event-type/tokens-revoked',
  'https://schemas.openid.net/secevent/oauth/event-type/token-revoked',
  'https://schemas.openid.net/secevent/risc/event-type/account-disabled',
  'https://schemas.openid.net/secevent/risc/event-type/account-enabled',
  'https://schemas.openid.net/secevent/risc/event-type/account-credential-change-required',
  'https://schemas.openid.net/secevent/risc/event-type/verification',
] as const

type RiscSubject = {
  subject_type?: string
  iss?: string
  sub?: string
  email?: string
  token_type?: string
  token_identifier_alg?: string
  token?: string
}

type RiscPayload = {
  iss?: string
  aud?: string | string[]
  iat?: number
  jti?: string
  events?: Record<string, { subject?: RiscSubject; reason?: string; state?: string }>
}

let discoveryCache: { issuer: string; jwksUri: string; jwks: ReturnType<typeof createRemoteJWKSet>; at: number } | null =
  null

function oauthAudiences(): string[] {
  return [
    process.env.GOOGLE_CLIENT_ID,
    process.env.VITE_GOOGLE_CLIENT_ID,
    process.env.GOOGLE_RISC_AUDIENCE,
  ]
    .flatMap((v) => String(v || '').split(','))
    .map((v) => v.trim())
    .filter(Boolean)
}

async function riscDiscovery() {
  const now = Date.now()
  if (discoveryCache && now - discoveryCache.at < 6 * 60 * 60 * 1000) return discoveryCache
  const res = await fetch(RISC_DISCOVERY)
  if (!res.ok) throw new Error(`RISC discovery failed (${res.status})`)
  const json = (await res.json()) as { issuer?: string; jwks_uri?: string }
  const issuer = String(json.issuer || 'https://accounts.google.com/')
  const jwksUri = String(json.jwks_uri || 'https://www.googleapis.com/oauth2/v3/certs')
  discoveryCache = {
    issuer,
    jwksUri,
    jwks: createRemoteJWKSet(new URL(jwksUri)),
    at: now,
  }
  return discoveryCache
}

function normalizeIss(iss: string) {
  return iss.replace(/\/$/, '')
}

function audiencesMatch(tokenAud: string | string[] | undefined, allowed: string[]) {
  const got = (Array.isArray(tokenAud) ? tokenAud : [tokenAud]).map((a) => String(a || '').trim()).filter(Boolean)
  return got.some((a) => allowed.includes(a))
}

export async function validateRiscToken(token: string): Promise<RiscPayload> {
  const compact = String(token || '').trim()
  if (!compact || compact.split('.').length !== 3) {
    throw new Error('Malformed security event token')
  }
  const allowed = oauthAudiences()
  if (!allowed.length) throw new Error('GOOGLE_CLIENT_ID is not configured for RISC audience checks')

  const disc = await riscDiscovery()
  const { payload } = await compactVerify(compact, disc.jwks)
  const claims = JSON.parse(new TextDecoder().decode(payload)) as RiscPayload
  const tokenIss = normalizeIss(String(claims.iss || ''))
  const expectedIss = normalizeIss(disc.issuer)
  if (tokenIss !== expectedIss && tokenIss !== 'accounts.google.com') {
    throw new Error('Invalid RISC issuer')
  }
  if (!audiencesMatch(claims.aud, allowed)) {
    throw new Error('Invalid RISC audience')
  }
  return claims
}

const seenJti = new Map<string, number>()

function alreadyHandled(jti: string) {
  if (!jti) return false
  const now = Date.now()
  for (const [key, at] of seenJti) {
    if (now - at > 90 * 24 * 60 * 60 * 1000) seenJti.delete(key)
  }
  if (seenJti.has(jti)) return true
  seenJti.set(jti, now)
  return false
}

function subjectEmail(subject?: RiscSubject) {
  return String(subject?.email || '').trim().toLowerCase()
}

function subjectSub(subject?: RiscSubject) {
  return String(subject?.sub || '').trim()
}

function sha512Sha512Base64(token: string) {
  const inner = crypto.createHash('sha512').update(token).digest()
  return crypto.createHash('sha512').update(inner).digest('base64')
}

function sha512Sha512Base64Url(token: string) {
  const inner = crypto.createHash('sha512').update(token).digest()
  return crypto.createHash('sha512').update(inner).digest('base64url')
}

async function resolveUserIds(subject?: RiscSubject): Promise<string[]> {
  const ids = new Set<string>()
  const sub = subjectSub(subject)
  const email = subjectEmail(subject)
  if (sub) {
    try {
      const user = await findAuthUserByGoogleSub(sub)
      if (user?.id) ids.add(user.id)
    } catch (e: any) {
      console.warn('[risc] google sub lookup failed:', e?.message || e)
    }
  }
  if (email) {
    try {
      const user = await findAuthUserByEmail(email)
      if (user?.id) ids.add(user.id)
    } catch (e: any) {
      console.warn('[risc] email lookup failed:', e?.message || e)
    }
  }
  return [...ids]
}

async function resecureAccounts(userIds: string[], alsoRevokeGmail: boolean) {
  for (const userId of userIds) {
    try {
      await signOutAllSessions(userId)
    } catch (e: any) {
      console.warn('[risc] sign-out failed:', userId, e?.message || e)
    }
    if (alsoRevokeGmail) {
      try {
        await revokeAllLedgerConnectionsForUser(userId)
      } catch (e: any) {
        console.warn('[risc] gmail revoke failed:', userId, e?.message || e)
      }
    }
  }
}

async function revokeMatchingRefreshToken(subject?: RiscSubject): Promise<number> {
  const alg = String(subject?.token_identifier_alg || '')
  const marker = String(subject?.token || '')
  if (!marker) return 0
  const rows = await listAllLedgerConnections()
  let n = 0
  for (const row of rows) {
    const token = row.refreshToken || ''
    if (!token) continue
    const hit =
      alg === 'prefix'
        ? token.slice(0, 16) === marker
        : alg === 'hash_base64_sha512_sha512'
          ? sha512Sha512Base64(token) === marker || sha512Sha512Base64Url(token) === marker
          : token.slice(0, 16) === marker ||
            sha512Sha512Base64(token) === marker ||
            sha512Sha512Base64Url(token) === marker
    if (!hit) continue
    await revokeLedgerConnection(row.userId, row.gmail)
    try {
      await signOutAllSessions(row.userId)
    } catch {
      // continue
    }
    n += 1
  }
  return n
}

export async function handleRiscPayload(payload: RiscPayload): Promise<{
  jti: string
  actions: string[]
  duplicate: boolean
}> {
  const jti = String(payload.jti || '')
  if (alreadyHandled(jti)) {
    return { jti, actions: [], duplicate: true }
  }

  const actions: string[] = []
  const events = payload.events || {}

  for (const [type, detail] of Object.entries(events)) {
    const subject = detail?.subject
    const email = subjectEmail(subject)
    const userIds = await resolveUserIds(subject)

    if (type.endsWith('/verification')) {
      actions.push(`verification:${detail?.state || 'ok'}`)
      console.info('[risc] verification event', detail?.state || '')
      continue
    }

    if (type.endsWith('/sessions-revoked')) {
      await resecureAccounts(userIds, false)
      actions.push(`sessions-revoked:${userIds.length}`)
      continue
    }

    if (type.endsWith('/tokens-revoked')) {
      await resecureAccounts(userIds, true)
      if (email) await revokeLedgerConnectionsByGmail(email)
      actions.push(`tokens-revoked:${userIds.length}`)
      continue
    }

    if (type.endsWith('/token-revoked')) {
      const n = await revokeMatchingRefreshToken(subject)
      if (!n) await resecureAccounts(userIds, true)
      actions.push(`token-revoked:${n || userIds.length}`)
      continue
    }

    if (type.endsWith('/account-disabled')) {
      const hijack = detail?.reason === 'hijacking'
      await resecureAccounts(userIds, true)
      if (email) await revokeLedgerConnectionsByGmail(email)
      actions.push(`account-disabled:${detail?.reason || 'unspecified'}:${userIds.length}`)
      if (hijack) console.warn('[risc] google account hijacking', userIds.join(',') || email || subjectSub(subject))
      continue
    }

    if (type.endsWith('/account-enabled')) {
      actions.push(`account-enabled:${userIds.length}`)
      continue
    }

    if (type.endsWith('/account-credential-change-required')) {
      await resecureAccounts(userIds, false)
      actions.push(`credential-change:${userIds.length}`)
      continue
    }

    actions.push(`unhandled:${type}`)
    console.info('[risc] unhandled event type', type)
  }

  return { jti, actions, duplicate: false }
}
