import { readFileSync } from 'fs'
import { SignJWT, importPKCS8 } from 'jose'
import { RISC_EVENT_TYPES } from './risc.js'

type ServiceAccount = {
  client_email?: string
  private_key?: string
  private_key_id?: string
}

function loadServiceAccount(): ServiceAccount {
  const raw = (process.env.GOOGLE_RISC_SA_JSON || '').trim()
  if (!raw) throw new Error('Set GOOGLE_RISC_SA_JSON to the RISC service-account JSON (or a file path)')
  if (raw.startsWith('{')) return JSON.parse(raw) as ServiceAccount
  return JSON.parse(readFileSync(raw, 'utf8')) as ServiceAccount
}

async function riscAuthToken(): Promise<string> {
  const sa = loadServiceAccount()
  if (!sa.client_email || !sa.private_key) throw new Error('RISC service account JSON is missing client_email/private_key')
  const key = await importPKCS8(sa.private_key.replace(/\\n/g, '\n'), 'RS256')
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: sa.private_key_id, typ: 'JWT' })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience('https://risc.googleapis.com/google.identity.risc.v1beta.RiscManagementService')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key)
}

export function riscReceiverUrl(): string {
  return (
    (process.env.RISC_RECEIVER_URL || '').trim() ||
    'https://app.yureka.one/api/auth/google-risc'
  )
}

export async function registerRiscStream(): Promise<{ ok: true; url: string }> {
  const token = await riscAuthToken()
  const url = riscReceiverUrl()
  const res = await fetch('https://risc.googleapis.com/v1beta/stream:update', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      delivery: {
        delivery_method: 'https://schemas.openid.net/secevent/risc/delivery-method/push',
        url,
      },
      events_requested: [...RISC_EVENT_TYPES],
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`RISC stream:update failed (${res.status}): ${text.slice(0, 500)}`)
  }
  return { ok: true, url }
}

export async function verifyRiscStream(state: string): Promise<void> {
  const token = await riscAuthToken()
  const res = await fetch('https://risc.googleapis.com/v1beta/stream:verify', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ state }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`RISC stream:verify failed (${res.status}): ${text.slice(0, 500)}`)
  }
}
